/**
 * Vínculo de carteira Solana ao manager (ponte mínima pro lançamento).
 *
 * NÃO é login (signInWithWeb3) — a conta continua sendo a de e-mail, wallet
 * entra AO LADO dela. Isto só registra qual endereço o manager diz ser dono,
 * pelo connect() da extensão. A verificação de posse por assinatura
 * (Sign-In-With-Solana) fica pra quando o claim (Onda 4) existir de verdade —
 * ver nota completa na migration 20260918210000_solana_wallet_link.sql.
 */
import { getSupabase } from '@/supabase/client';

interface PhantomProvider {
  isPhantom?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
}

function getSolanaProvider(): PhantomProvider | null {
  const w = window as unknown as { phantom?: { solana?: PhantomProvider }; solana?: PhantomProvider };
  if (w.phantom?.solana?.isPhantom) return w.phantom.solana;
  if (w.solana?.isPhantom) return w.solana;
  return null;
}

export function hasSolanaWalletInstalled(): boolean {
  return getSolanaProvider() != null;
}

export interface SolanaWalletLink {
  walletAddress: string;
  verified: boolean;
  linkedAt: string;
}

export async function connectAndLinkSolanaWallet(): Promise<{ ok: boolean; address?: string; error?: string }> {
  const provider = getSolanaProvider();
  if (!provider) {
    return { ok: false, error: 'Nenhuma carteira Solana encontrada. Instale a Phantom (phantom.app).' };
  }
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Supabase não configurado.' };

  let address: string;
  try {
    const resp = await provider.connect();
    address = resp.publicKey.toString();
  } catch {
    return { ok: false, error: 'Conexão com a carteira cancelada.' };
  }

  const { data, error } = await sb.rpc('link_my_solana_wallet', { p_address: address });
  if (error) return { ok: false, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, address: row?.wallet_address ?? address };
}

export async function fetchMyLinkedSolanaWallet(): Promise<SolanaWalletLink | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_my_solana_wallet');
  if (error) {
    console.warn('[solanaWallet] fetchMyLinkedSolanaWallet:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.wallet_address) return null;
  return {
    walletAddress: row.wallet_address,
    verified: Boolean(row.verified),
    linkedAt: row.linked_at,
  };
}
