/**
 * Depósito em BRO — a conversão.
 *
 * 1 BRO = 1 dólar, comprado a dólar + margem (decisão do fundador, 2026-09-29).
 * Quem deposita R$ 100 com o dólar a R$ 5,535 recebe 18,06 BRO — não 100.
 *
 * 🔴 Por que isto existe: até esta data o servidor creditava centavo de real
 * como centavo de BRO, enquanto a tela dizia "1 BRO ≈ 1 dólar" e a prévia do
 * depósito dividia pela cotação. R$ 100 mostravam ~17 BRO e creditavam 100,
 * que a Carteira exibia como "≈ US$ 100". Tela e servidor agora fazem a mesma
 * conta, e a do servidor é a que vale.
 *
 * A cotação é CONGELADA na criação da cobrança e gravada em
 * `payment_intents.server_data`. A confirmação lê de lá: o Pix pode ser pago
 * uma hora depois, e o que a pessoa recebe é o que ela viu, não o dólar da
 * hora do pagamento.
 *
 * Inteiro, sempre. `bigint` na menor unidade, mesma disciplina de packs.ts.
 */

const MICRO = 1_000_000n;

export interface Recarga {
  /** Centavos de BRO a creditar. 1806 = 18,06 BRO. */
  readonly broCents: bigint;
  /** Reais por dólar já com a margem, em micro (1e6). 5,535 → 5_535_000. */
  readonly brlPorUsdMicro: bigint;
}

export type RecargaRecusada =
  | { readonly ok: false; readonly motivo: 'valor_invalido' }
  | { readonly ok: false; readonly motivo: 'cotacao_invalida' }
  | { readonly ok: false; readonly motivo: 'nao_compra_um_centavo' };

/**
 * Reais pagos → BRO creditado.
 *
 * Arredonda pra BAIXO: a fração de centavo de dólar que sobra fica com a casa.
 * O erro máximo é de 1 centavo de BRO por depósito, e o contrário — arredondar
 * pra cima — creditaria dinheiro que ninguém pagou.
 */
export function converterRecarga(
  brlCents: number,
  brlPorUsdMicro: bigint,
): { readonly ok: true; readonly recarga: Recarga } | RecargaRecusada {
  if (!Number.isInteger(brlCents) || brlCents <= 0) return { ok: false, motivo: 'valor_invalido' };
  if (brlPorUsdMicro <= 0n) return { ok: false, motivo: 'cotacao_invalida' };

  const broCents = (BigInt(brlCents) * MICRO) / brlPorUsdMicro;
  if (broCents <= 0n) return { ok: false, motivo: 'nao_compra_um_centavo' };

  return { ok: true, recarga: { broCents, brlPorUsdMicro } };
}

/** Cotação em reais (5.535) → micro inteiro (5_535_000n). */
export function cotacaoEmMicro(brlPorUsd: number): bigint {
  if (!Number.isFinite(brlPorUsd) || brlPorUsd <= 0) return 0n;
  return BigInt(Math.round(brlPorUsd * 1_000_000));
}
