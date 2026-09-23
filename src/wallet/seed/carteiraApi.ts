/**
 * O que a carteira embutida fala com o servidor (A VIRADA · V1).
 *
 * Só duas coisas, e nenhuma delas manda segredo:
 *   — o saldo, pelo nosso proxy (o browser não fala com RPC de terceiro);
 *   — o vínculo, assinando a MESMA mensagem e batendo no MESMO endpoint que a
 *     Phantom já usa. Nada de rota nova pra carteira própria: se existissem
 *     duas portas, uma delas ia envelhecer sem ninguém olhar, e a que guarda o
 *     destino do airdrop não pode ser essa.
 *
 * A chave privada é usada pra assinar e não sai daqui.
 */
import { getSupabase } from '@/supabase/client';
import { buildSolanaLinkMessage } from '@/wallet/solanaLinkMessage';
import { assinar, type ChaveSolana } from './derive.js';

const API_BASE =
  (import.meta.env.VITE_OLEFOOT_API_URL as string) ||
  (import.meta.env.VITE_API_URL as string) ||
  'http://localhost:4000';

const paraB64 = (b: Uint8Array): string => {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};

export interface Saldo { lamports: string; sol: number }

export async function buscarSaldo(endereco: string): Promise<Saldo | null> {
  try {
    const r = await fetch(`${API_BASE}/api/wallet/solana/saldo/${endereco}`);
    const j = (await r.json()) as { ok: boolean; lamports?: string; sol?: number };
    return j.ok ? { lamports: j.lamports ?? '0', sol: j.sol ?? 0 } : null;
  } catch {
    return null;
  }
}

/**
 * Chato de propósito: os três campos sempre presentes, em vez de união
 * discriminada. O `tsconfig.json` do app não liga `strict`, e sem
 * `strictNullChecks` o TypeScript NÃO estreita união no ramo `else` — o
 * `r.erro` depois de `if (r.ok)` vira erro de compilação, e o jeito de calar
 * seria um `as` que apaga a checagem justo no caminho do dinheiro. Forma
 * simples, sem cast.
 */
export interface ResultadoVinculo {
  readonly ok: boolean;
  readonly endereco: string | null;
  readonly erro: string | null;
}

/** Assina a prova de posse com a chave derivada e registra o vínculo. */
export async function vincular(chave: ChaveSolana): Promise<ResultadoVinculo> {
  // `getSupabase()` devolve null quando o cliente não subiu (env faltando, por
  // exemplo). Sem esta guarda o vínculo estourava com TypeError em vez de dizer
  // o que aconteceu — e quem acha esta linha é o strict deste diretório, não o
  // `npm run lint` do app.
  const sb = getSupabase();
  if (!sb) return { ok: false, endereco: null, erro: 'Sem conexão com a sua conta agora.' };
  const { data } = await sb.auth.getSession();
  const sessao = data.session;
  if (!sessao) return { ok: false, endereco: null, erro: 'Entre na sua conta do jogo pra vincular.' };

  const issuedAt = new Date().toISOString();
  const mensagem = buildSolanaLinkMessage(sessao.user.id, chave.endereco, issuedAt);
  const bytes = new TextEncoder().encode(mensagem);
  const assinatura = assinar(bytes, chave);

  try {
    const r = await fetch(`${API_BASE}/api/wallet/solana/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessao.access_token}` },
      body: JSON.stringify({
        address: chave.endereco,
        issuedAt,
        signature: paraB64(assinatura),
        signedMessage: paraB64(bytes),
      }),
    });
    const j = (await r.json().catch(() => null)) as
      | { ok: true; link: { wallet_address: string } }
      | { ok: false; error?: string }
      | null;
    if (!j || j.ok !== true || !r.ok) {
      return { ok: false, endereco: null, erro: (j && j.ok === false && j.error) || 'Não foi possível vincular.' };
    }
    return { ok: true, endereco: j.link.wallet_address, erro: null };
  } catch {
    return { ok: false, endereco: null, erro: 'Sem conexão com o servidor.' };
  }
}

/** Reusa a RPC que a tela da Phantom já usa — uma leitura só, uma verdade só. */
export async function meuVinculo(): Promise<{ endereco: string; verificado: boolean } | null> {
  const { fetchMyLinkedSolanaWallet } = await import('@/supabase/solanaWallet');
  const l = await fetchMyLinkedSolanaWallet();
  return l ? { endereco: l.walletAddress, verificado: l.verified } : null;
}
