/**
 * Vínculo de carteira Solana ao manager — COM prova de posse (A VIRADA · C1).
 *
 * NÃO é login (signInWithWeb3) — a conta continua sendo a de e-mail, a carteira
 * entra AO LADO dela. O que mudou em 2026-09-19:
 *
 *   1. Qualquer carteira Solana, não só a Phantom: a lista vem do Wallet
 *      Standard (Phantom, MetaMask, Solflare, Backpack… — a MetaMask implementa
 *      o padrão na Solana, conferido na doc dela).
 *   2. O vínculo exige a ASSINATURA da carteira sobre uma mensagem que amarra
 *      conta + endereço + instante. Quem confere e grava é o servidor
 *      (POST /api/wallet/solana/link); a RPC antiga, que aceitava qualquer
 *      endereço, foi revogada na migration 20260919110000.
 *
 * Esse endereço é o cadastro do airdrop da v1 e a ponte com olefoot.com/wallet.
 * A assinatura NÃO move fundos e NÃO custa taxa — é só uma mensagem.
 */
import { getWallets } from '@wallet-standard/app';
import type { Wallet, WalletAccount } from '@wallet-standard/base';
import { getSupabase } from '@/supabase/client';
import { buildSolanaLinkMessage } from '@/wallet/solanaLinkMessage';

const API_BASE =
  (import.meta.env.VITE_OLEFOOT_API_URL as string) ||
  (import.meta.env.VITE_API_URL as string) ||
  'http://localhost:4000';

type ConnectFeature = {
  connect: (input?: { silent?: boolean }) => Promise<{ accounts: readonly WalletAccount[] }>;
};
type SignMessageFeature = {
  signMessage: (
    ...inputs: { account: WalletAccount; message: Uint8Array }[]
  ) => Promise<readonly { signedMessage: Uint8Array; signature: Uint8Array }[]>;
};

export interface SolanaWalletOption {
  name: string;
  /** data: URI entregue pela própria carteira. */
  icon: string;
  wallet: Wallet;
}

export interface SolanaWalletLink {
  walletAddress: string;
  verified: boolean;
  linkedAt: string;
}

function isSolanaSigner(w: Wallet): boolean {
  return (
    w.chains.some((c) => c.startsWith('solana:')) &&
    'standard:connect' in w.features &&
    'solana:signMessage' in w.features
  );
}

/** Carteiras Solana que sabem assinar mensagem, instaladas neste navegador. */
export function listSolanaWallets(): SolanaWalletOption[] {
  if (typeof window === 'undefined') return [];
  const seen = new Set<string>();
  const out: SolanaWalletOption[] = [];
  for (const w of getWallets().get()) {
    if (!isSolanaSigner(w) || seen.has(w.name)) continue;
    seen.add(w.name);
    out.push({ name: w.name, icon: w.icon, wallet: w });
  }
  return out;
}

/** Carteiras se registram de forma assíncrona (a extensão injeta depois do load). */
export function onSolanaWalletsChange(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const api = getWallets();
  const offRegister = api.on('register', cb);
  const offUnregister = api.on('unregister', cb);
  return () => {
    offRegister();
    offUnregister();
  };
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export async function connectAndLinkSolanaWallet(
  option: SolanaWalletOption,
): Promise<{ ok: boolean; address?: string; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Supabase não configurado.' };
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user?.id || !session.access_token) {
    return { ok: false, error: 'Entre na sua conta pra vincular a carteira.' };
  }

  const connect = option.wallet.features['standard:connect'] as ConnectFeature | undefined;
  const signer = option.wallet.features['solana:signMessage'] as SignMessageFeature | undefined;
  if (!connect || !signer) return { ok: false, error: `${option.name} não assina mensagens na Solana.` };

  let account: WalletAccount | undefined;
  try {
    const { accounts } = await connect.connect();
    account = accounts.find((a) => a.chains.some((c) => c.startsWith('solana:'))) ?? accounts[0];
  } catch {
    return { ok: false, error: 'Conexão com a carteira cancelada.' };
  }
  if (!account) return { ok: false, error: 'A carteira não liberou nenhuma conta Solana.' };

  const address = account.address;
  const issuedAt = new Date().toISOString();
  const message = new TextEncoder().encode(buildSolanaLinkMessage(session.user.id, address, issuedAt));

  let signature: Uint8Array;
  let signedMessage: Uint8Array;
  try {
    const [out] = await signer.signMessage({ account, message });
    if (!out) return { ok: false, error: 'A carteira não devolveu a assinatura.' };
    signature = out.signature;
    signedMessage = out.signedMessage ?? message;
  } catch {
    return { ok: false, error: 'Assinatura cancelada.' };
  }

  try {
    const res = await fetch(`${API_BASE}/api/wallet/solana/link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        address,
        issuedAt,
        signature: toBase64(signature),
        signedMessage: toBase64(signedMessage),
      }),
    });
    const json = (await res.json().catch(() => null)) as
      | { ok: true; link: { wallet_address: string } }
      | { ok: false; error?: string }
      | null;
    if (!json || json.ok !== true || !res.ok) {
      const reason = json && json.ok === false ? json.error : undefined;
      return { ok: false, error: reason || 'Não foi possível vincular a carteira.' };
    }
    return { ok: true, address: json.link.wallet_address };
  } catch {
    return { ok: false, error: 'Sem conexão com o servidor. Tente de novo.' };
  }
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
