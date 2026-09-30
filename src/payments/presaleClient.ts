/**
 * Pré-venda do OLEFOOT — o que a tela precisa pra mostrar os packs.
 *
 * 🔴 A tela MOSTRA, não decide. Preço, cotação, quantos tokens e quanto resta
 * vêm de GET /api/presale/estado. Na compra a tela manda só QUAL pack (em
 * centavos de dólar); o servidor refaz a conta com a cotação da hora e é o
 * número dele que vai pro Pix.
 */

const API_BASE =
  (import.meta.env.VITE_OLEFOOT_API_URL as string) ||
  (import.meta.env.VITE_API_URL as string) ||
  'http://localhost:4000';

export type MotivoPackFechado =
  | 'abaixo_do_minimo' | 'nao_inteiro' | 'acima_do_teto_por_conta'
  | 'alocacao_insuficiente' | 'cotacao_invalida';

export interface PackDaPresale {
  readonly usdCents: number;
  readonly disponivel: boolean;
  /** OLEFOOT que a pessoa recebe, em token inteiro. */
  readonly recebe: bigint;
  /** Quanto custa em reais agora, em centavos. */
  readonly brlCents: number;
  readonly motivo?: MotivoPackFechado;
}

export interface PlanoAtivacao3x {
  readonly kind: 'ativacao_3x';
  readonly usdCents: number;
  readonly disponivel: boolean;
  /** OLEFOOT que CADA uma das 3 contas recebe, em token inteiro. */
  readonly recebePorConta: bigint;
  /** Custo total em reais agora, em centavos. */
  readonly brlCents: number;
  readonly motivo?: MotivoPackFechado;
}

export interface EstadoDaPresale {
  readonly aberta: boolean;
  /** Preço de 1 OLEFOOT em dólar, como texto ("0.000125"). */
  readonly preco: string;
  /** Reais por dólar, já com a margem. */
  readonly cotacaoBrlPorUsd: number;
  readonly minimoUsdCents: number;
  readonly tetoPorContaUsdCents: number | null;
  readonly restam: bigint;
  readonly packs: readonly PackDaPresale[];
  /** A Ativação 3× (e planos futuros). Servidor antigo: lista vazia. */
  readonly planos: readonly PlanoAtivacao3x[];
}

export type EstadoDaPresaleCarregado =
  | { readonly status: 'carregando' }
  | { readonly status: 'erro'; readonly mensagem: string }
  | { readonly status: 'ok'; readonly estado: EstadoDaPresale };

const inteiro = (v: unknown): bigint => {
  try { return BigInt(String(v ?? '0').split('.')[0] || '0'); } catch { return 0n; }
};

export async function lerEstadoDaPresale(): Promise<EstadoDaPresale> {
  const res = await fetch(`${API_BASE}/api/presale/estado`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(body.error ?? `http_${res.status}`);

  return {
    aberta: body.aberta === true,
    preco: String(body.preco ?? ''),
    cotacaoBrlPorUsd: Number(body.cotacaoBrlPorUsd ?? 0),
    minimoUsdCents: Number(body.minimoUsdCents ?? 1000),
    tetoPorContaUsdCents: body.tetoPorContaUsdCents == null ? null : Number(body.tetoPorContaUsdCents),
    restam: inteiro(body.restam),
    packs: (Array.isArray(body.packs) ? body.packs : []).map((p: Record<string, unknown>) => ({
      usdCents: Number(p.usdCents ?? 0),
      disponivel: p.disponivel === true,
      recebe: inteiro(p.recebe),
      brlCents: Number(p.brlCents ?? 0),
      motivo: p.motivo as MotivoPackFechado | undefined,
    })),
    planos: (Array.isArray(body.planos) ? body.planos : [])
      .filter((p: Record<string, unknown>) => p.kind === 'ativacao_3x')
      .map((p: Record<string, unknown>) => ({
        kind: 'ativacao_3x' as const,
        usdCents: Number(p.usdCents ?? 0),
        disponivel: p.disponivel === true,
        recebePorConta: inteiro(p.recebePorConta),
        brlCents: Number(p.brlCents ?? 0),
        motivo: p.motivo as MotivoPackFechado | undefined,
      })),
  };
}

/**
 * Prévia de um valor digitado ("Outro"). É PRÉVIA: serve pra pessoa ver a ordem
 * de grandeza antes de gerar o Pix. O servidor refaz a conta na criação.
 *
 * Tokens arredondam pra baixo e reais pra cima — as mesmas direções de
 * `orcar` em packs.ts, pra prévia nunca prometer mais do que o servidor entrega.
 */
export function previaDoValor(usdCents: number, estado: EstadoDaPresale): { recebe: bigint; brlCents: number } | null {
  const preco = Number(estado.preco);
  if (!Number.isInteger(usdCents) || usdCents <= 0 || !(preco > 0) || !(estado.cotacaoBrlPorUsd > 0)) return null;
  // Em centavo inteiro a conta é exata: $0,01 ÷ $0,000125 = 80 tokens.
  const porCentavo = Math.round(0.01 / preco);
  return {
    recebe: BigInt(usdCents) * BigInt(porCentavo),
    brlCents: Math.ceil(usdCents * estado.cotacaoBrlPorUsd - 1e-9),
  };
}
