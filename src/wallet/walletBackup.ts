/**
 * Sistema de backup automático de wallets para Supabase.
 * Sincroniza estado local com cloud para recuperação de desastres.
 */

import type { WalletState } from './types';
import { getSupabase } from '@/supabase/client';

export interface WalletBackup {
  id: string;
  user_id: string;
  wallet_snapshot: WalletState;
  created_at: string;
  checksum: string;
}

export interface BackupResult {
  ok: boolean;
  error?: string;
  backupId?: string;
}

/**
 * Gera checksum simples para validar integridade do backup.
 */
function generateChecksum(wallet: WalletState): string {
  const data = JSON.stringify(wallet);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Salva backup do wallet no Supabase.
 * Mantém últimos 10 backups por usuário.
 */
export async function backupWalletToSupabase(
  wallet: WalletState,
  userId: string,
): Promise<BackupResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: 'Supabase não configurado' };
  }

  try {
    const checksum = generateChecksum(wallet);
    const now = new Date().toISOString();

    // Inserir novo backup
    const { data, error } = await supabase
      .from('wallet_backups')
      .insert({
        user_id: userId,
        wallet_snapshot: wallet,
        checksum,
        created_at: now,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[walletBackup] Erro ao salvar:', error.message);
      return { ok: false, error: error.message };
    }

    // Limpar backups antigos (manter últimos 10)
    const { data: oldBackups } = await supabase
      .from('wallet_backups')
      .select('id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(10, 100); // Pega do 11º em diante

    if (oldBackups && oldBackups.length > 0) {
      const idsToDelete = oldBackups.map((b) => b.id);
      await supabase.from('wallet_backups').delete().in('id', idsToDelete);
    }

    return { ok: true, backupId: data.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[walletBackup] Exceção:', msg);
    return { ok: false, error: msg };
  }
}

/**
 * Restaura wallet do backup mais recente.
 */
export async function restoreWalletFromSupabase(
  userId: string,
): Promise<{ ok: boolean; wallet?: WalletState; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: 'Supabase não configurado' };
  }

  try {
    const { data, error } = await supabase
      .from('wallet_backups')
      .select('wallet_snapshot, checksum, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[walletBackup] Erro ao restaurar:', error.message);
      return { ok: false, error: error.message };
    }

    if (!data) {
      return { ok: false, error: 'Nenhum backup encontrado' };
    }

    // Validar checksum
    const wallet = data.wallet_snapshot as WalletState;
    const expectedChecksum = generateChecksum(wallet);

    if (data.checksum !== expectedChecksum) {
      console.error('[walletBackup] Checksum inválido - backup corrompido');
      return { ok: false, error: 'Backup corrompido (checksum inválido)' };
    }

    return { ok: true, wallet };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[walletBackup] Exceção:', msg);
    return { ok: false, error: msg };
  }
}

/**
 * Lista backups disponíveis para um usuário.
 */
export async function listWalletBackups(userId: string): Promise<{
  ok: boolean;
  backups?: Array<{ id: string; created_at: string; checksum: string }>;
  error?: string;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: 'Supabase não configurado' };
  }

  try {
    const { data, error } = await supabase
      .from('wallet_backups')
      .select('id, created_at, checksum')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, backups: data || [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return { ok: false, error: msg };
  }
}

/**
 * Backup automático periódico (chamar a cada transação importante).
 */
export async function autoBackupIfNeeded(
  wallet: WalletState,
  userId: string,
  lastBackupAt?: string,
): Promise<void> {
  // Só faz backup se passou 5+ minutos desde o último
  if (lastBackupAt) {
    const lastBackupTime = new Date(lastBackupAt).getTime();
    const now = new Date().getTime();
    const diffMinutes = (now - lastBackupTime) / (1000 * 60);

    if (diffMinutes < 5) {
      return; // Muito recente, skip
    }
  }

  // Backup assíncrono (não bloqueia UI)
  backupWalletToSupabase(wallet, userId).catch((e) => {
    console.warn('[walletBackup] Auto-backup falhou:', e);
  });
}
