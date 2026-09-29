import { getSupabase } from './client';

/**
 * A posição de OLEFOOT comprada na pré-venda.
 *
 * Fala direto com o Supabase, como o painel de expansão: `presale_position` tem
 * RLS de linha própria, então o que volta é só o da pessoa logada — não é o
 * cliente que escolhe de quem pedir.
 *
 * 🔴 Isto é POSIÇÃO EM TABELA, não saldo na Solana. O token ainda não tem mint.
 * A custódia passa pra pessoa na entrega à carteira vinculada, e a tela que usa
 * este número tem que dizer isso com essas palavras.
 */

/** O mint tem 9 casas: 1 OLEFOOT = 10^9 na menor unidade (ver packs.ts). */
const UNIDADE = 10n ** 9n;

export interface PosicaoOlefoot {
  /** Tokens inteiros comprados — o número anunciado na compra. */
  readonly tokens: bigint;
  /** Quanto já foi liberado pelas duas portas (compra e tempo), em token inteiro. */
  readonly liberado: bigint;
  /** O que ainda está travado. */
  readonly travado: bigint;
  /** Total comprado, em centavos de dólar. */
  readonly compradoUsdCents: number;
}

export const POSICAO_VAZIA: PosicaoOlefoot = {
  tokens: 0n, liberado: 0n, travado: 0n, compradoUsdCents: 0,
};

const inteiro = (v: unknown): bigint => {
  try { return BigInt(String(v ?? '0').split('.')[0] || '0'); } catch { return 0n; }
};

export async function lerMinhaPosicao(): Promise<PosicaoOlefoot> {
  const sb = getSupabase();
  if (!sb) return POSICAO_VAZIA;
  const { data, error } = await sb
    .from('presale_position')
    .select('tokens_totais, liberado_por_compra, liberado_por_tempo, compra_original_usd_cents')
    .maybeSingle();
  if (error || !data) return POSICAO_VAZIA;

  const total = inteiro(data.tokens_totais);
  // As duas portas SOMAM — é a régua de `liberarPorCompra` em travas.ts, que
  // mede o que cabe na posição descontando as duas. O teto é a própria posição.
  const soma = inteiro(data.liberado_por_compra) + inteiro(data.liberado_por_tempo);
  const liberado = soma > total ? total : soma;

  return {
    tokens: total / UNIDADE,
    liberado: liberado / UNIDADE,
    travado: (total - liberado) / UNIDADE,
    compradoUsdCents: Number(data.compra_original_usd_cents ?? 0),
  };
}
