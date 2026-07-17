/**
 * Durabilidade da wallet — liga o backup/restore (walletBackup.ts) ao boot.
 *
 * Problema que resolve: o ledger vive no localStorage.
 * Limpar o navegador / trocar de dispositivo apagava o "tesouro". Aqui:
 *   - restoreWalletIfEmpty(): se a wallet local está vazia, puxa o último
 *     backup da nuvem e restaura SÓ a data durável (nunca saldos spot).
 *   - backupWalletNow(): salva o estado atual (throttle 5min).
 *   - startWalletAutoBackup(): interval + backup ao esconder a aba.
 *
 * NÃO é servidor-autoritativo — é rede de segurança. O saldo real de BRO/EXP
 * continua vindo do servidor via créditos; o snapshot nunca credita dinheiro.
 */

import { getSupabase } from '@/supabase/client';
import { getGameState, dispatchGame } from '@/game/store';
import { normalizeWalletState } from './initial';
import { restoreWalletFromSupabase, backupWalletToSupabase } from './walletBackup';
import type { WalletState } from './types';

const BACKUP_THROTTLE_MS = 5 * 60 * 1000;

let lastBackupAt: number | null = null;
let autoBackupStarted = false;

function currentWallet(): WalletState | null {
  const s = getGameState();
  return s?.finance?.wallet ?? null;
}

/** Wallet "vazia" = sem nada durável (ledger). Cenário de navegador limpo. */
function walletIsEmpty(w: WalletState | null): boolean {
  if (!w) return true;
  return (w.ledger?.length ?? 0) === 0;
}

async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Restaura posições/ledger do backup na nuvem quando a wallet local está vazia
 * (navegador limpo / novo dispositivo). Nunca sobrescreve estado local existente
 * — o guard no reducer também protege contra isso.
 */
export async function restoreWalletIfEmpty(): Promise<void> {
  if (!walletIsEmpty(currentWallet())) return; // já tem dados locais — não toca
  const userId = await currentUserId();
  if (!userId) return;

  const res = await restoreWalletFromSupabase(userId);
  if (!res.ok || !res.wallet) return;

  const snapshot = normalizeWalletState(res.wallet);
  if (walletIsEmpty(snapshot)) return; // backup também vazio — nada a restaurar

  dispatchGame({ type: 'WALLET_RESTORE_SNAPSHOT', snapshot });
}

/** Salva o estado atual da wallet no Supabase. Throttle 5min (a menos que force). */
export async function backupWalletNow(force = false): Promise<void> {
  const w = currentWallet();
  if (!w || walletIsEmpty(w)) return; // nada durável pra salvar

  if (!force && lastBackupAt != null && Date.now() - lastBackupAt < BACKUP_THROTTLE_MS) {
    return;
  }

  const userId = await currentUserId();
  if (!userId) return;

  const res = await backupWalletToSupabase(w, userId);
  if (res.ok) lastBackupAt = Date.now();
}

/** Liga o auto-backup periódico + ao esconder a aba. Idempotente. */
export function startWalletAutoBackup(): void {
  if (autoBackupStarted) return;
  autoBackupStarted = true;

  window.setInterval(() => {
    void backupWalletNow();
  }, BACKUP_THROTTLE_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void backupWalletNow();
  });
}
