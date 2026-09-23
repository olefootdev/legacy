/**
 * O único endereço de rede que esta origem conhece: o saldo, pelo nosso
 * servidor. Nada mais sai daqui — nem a frase, nem a chave, nem a senha.
 */
const BASE =
  (import.meta.env.VITE_OLEFOOT_API_URL as string | undefined) ||
  'https://legacy-production-de1e.up.railway.app';

export interface Saldo { lamports: string; sol: number }

export async function buscarSaldo(endereco: string): Promise<Saldo | null> {
  try {
    const r = await fetch(`${BASE}/api/wallet/solana/saldo/${endereco}`);
    const j = (await r.json()) as { ok: boolean; lamports?: string; sol?: number };
    return j.ok ? { lamports: j.lamports ?? '0', sol: j.sol ?? 0 } : null;
  } catch {
    return null;
  }
}
