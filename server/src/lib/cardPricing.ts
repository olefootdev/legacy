/**
 * Preço e entrega autoritativos do card no checkout PIX.
 *
 * Nem o valor nem o jogador entregue podem vir do cliente: `confirm_payment_intent`
 * credita o split sobre `payment_intents.amount_cents` e insere `metadata->'player'`
 * direto no `manager_squad` do comprador. Quem monta a intent é o servidor, então é
 * aqui que os dois são recalculados a partir de `legacy_players`.
 *
 * Espelha o front — `legacyRowToPlayerEntity` (src/supabase/legacyPlayers.ts),
 * `overallFromAttributes` (src/entities/player.ts) e a cotação de
 * src/wallet/olefootUsdBrlQuote.ts. O server tem rootDir próprio e não importa de
 * `src/`: se a fórmula do overall ou a margem mudarem lá, mude aqui junto.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const BR_DOLAR_API_URL = 'https://br.dolarapi.com/v1/cotacoes';

/** Margem Olefoot sobre a cotação de referência. Espelha OLEFOOT_BRL_MARKUP no front. */
const OLEFOOT_BRL_MARKUP = 0.05;

const ATTR_KEYS = [
  'passe', 'marcacao', 'velocidade', 'drible', 'finalizacao',
  'fisico', 'tatico', 'mentalidade', 'confianca', 'fairPlay',
] as const;

type AttrKey = (typeof ATTR_KEYS)[number];
type PlayerAttrs = Record<AttrKey, number>;

/**
 * Pesos do OVR POR POSIÇÃO. ESPELHO de `src/entities/ovrWeights.ts` — o servidor
 * é um build separado e não importa de `src/`, então a tabela é duplicada de
 * propósito. **Se mudar lá, mude aqui**: este cálculo está no caminho do
 * dinheiro (define o preço do card).
 */
const UNIVERSAL = { mentalidade: 0.08, confianca: 0.08, fairPlay: 0.06 } as const;
const OVERALL_WEIGHTS_BY_POS: Record<string, Record<AttrKey, number>> = {
  GOL: { passe: 0.06, marcacao: 0.18, velocidade: 0.06, drible: 0.04, finalizacao: 0.02, fisico: 0.22, tatico: 0.20, ...UNIVERSAL },
  ZAG: { passe: 0.08, marcacao: 0.24, velocidade: 0.07, drible: 0.02, finalizacao: 0.01, fisico: 0.18, tatico: 0.18, ...UNIVERSAL },
  LE:  { passe: 0.10, marcacao: 0.17, velocidade: 0.18, drible: 0.10, finalizacao: 0.01, fisico: 0.14, tatico: 0.08, ...UNIVERSAL },
  LD:  { passe: 0.10, marcacao: 0.17, velocidade: 0.18, drible: 0.10, finalizacao: 0.01, fisico: 0.14, tatico: 0.08, ...UNIVERSAL },
  VOL: { passe: 0.16, marcacao: 0.22, velocidade: 0.05, drible: 0.02, finalizacao: 0.01, fisico: 0.14, tatico: 0.18, ...UNIVERSAL },
  MC:  { passe: 0.20, marcacao: 0.13, velocidade: 0.08, drible: 0.05, finalizacao: 0.02, fisico: 0.11, tatico: 0.19, ...UNIVERSAL },
  MEI: { passe: 0.24, marcacao: 0.02, velocidade: 0.08, drible: 0.15, finalizacao: 0.12, fisico: 0.03, tatico: 0.14, ...UNIVERSAL },
  PE:  { passe: 0.13, marcacao: 0.01, velocidade: 0.22, drible: 0.20, finalizacao: 0.12, fisico: 0.06, tatico: 0.04, ...UNIVERSAL },
  PD:  { passe: 0.13, marcacao: 0.01, velocidade: 0.22, drible: 0.20, finalizacao: 0.12, fisico: 0.06, tatico: 0.04, ...UNIVERSAL },
  ATA: { passe: 0.05, marcacao: 0.01, velocidade: 0.16, drible: 0.13, finalizacao: 0.30, fisico: 0.09, tatico: 0.04, ...UNIVERSAL },
};
/** Neutro = peso único antigo. Usado quando a posição é desconhecida. */
const OVERALL_WEIGHTS: Record<AttrKey, number> = {
  passe: 0.12, marcacao: 0.1, velocidade: 0.12, drible: 0.1, finalizacao: 0.12,
  fisico: 0.1, tatico: 0.12, mentalidade: 0.08, confianca: 0.08, fairPlay: 0.06,
};

const ATTR_DEFAULT = 70;

interface LegacyRow {
  id: string;
  name: string;
  pos: string;
  attributes: Record<string, unknown> | null;
  taught_attributes: unknown;
  team_booster: Record<string, number> | null;
  price_unit_cents: number | null;
  currency: string | null;
  listed_on_market: boolean;
  country: string | null;
  bio: string | null;
}

function attrsFromRow(attributes: Record<string, unknown> | null): PlayerAttrs {
  const a = attributes && typeof attributes === 'object' ? attributes : {};
  const out = {} as PlayerAttrs;
  for (const k of ATTR_KEYS) {
    const v = a[k];
    out[k] = typeof v === 'number' && Number.isFinite(v) ? v : ATTR_DEFAULT;
  }
  return out;
}

function overallFromAttributes(a: PlayerAttrs, pos?: string | null): number {
  const weights = (pos && OVERALL_WEIGHTS_BY_POS[pos.trim().toUpperCase()]) || OVERALL_WEIGHTS;
  let w = 0;
  for (const k of ATTR_KEYS) w += a[k] * weights[k];
  return Math.round(Math.min(99, Math.max(40, w)));
}

/** Cotação USD→BRL (venda) já com a margem Olefoot. Lança se a API falhar. */
async function fetchUsdBrlVenda(): Promise<number> {
  const res = await fetch(BR_DOLAR_API_URL);
  if (!res.ok) throw new Error(`cotação indisponível (${res.status})`);
  const rows = (await res.json()) as Array<{ moeda?: string; venda?: number }>;
  const usd = Array.isArray(rows) ? rows.find((r) => r.moeda === 'USD') : undefined;
  if (!usd || typeof usd.venda !== 'number' || !Number.isFinite(usd.venda) || usd.venda <= 0) {
    throw new Error('resposta da API sem USD');
  }
  return Math.round(usd.venda * (1 + OLEFOOT_BRL_MARKUP) * 10_000) / 10_000;
}

/**
 * Fixa no jogador os campos que definem valor, preservando o resto do que o
 * cliente montou (retrato, número, enquadramento — cosmético e só afeta o
 * plantel do próprio comprador). Sem isto, `metadata.player` é entregue como
 * veio: dá pra pagar por um card barato e receber outro com atributos inflados.
 */
function sanitizeCardPlayer(row: LegacyRow, clientPlayer: unknown): Record<string, unknown> {
  const base =
    clientPlayer && typeof clientPlayer === 'object' && !Array.isArray(clientPlayer)
      ? { ...(clientPlayer as Record<string, unknown>) }
      : {};

  const attrs = attrsFromRow(row.attributes);

  return {
    ...base,
    // O id carrega o prefixo `legacy-` no plantel; a row já pode trazê-lo.
    id: row.id.startsWith('legacy-') ? row.id : `legacy-${row.id}`,
    name: row.name.trim(),
    pos: row.pos.trim(),
    attrs,
    mintOverall: overallFromAttributes(attrs, row.pos),
    archetype: 'lenda',
    rarity: 'epico',
    isLegacy: true,
    listedOnMarket: false,
    legacyTeamBooster: row.team_booster ?? {},
    legacyTaughtAttributes: Array.isArray(row.taught_attributes) ? row.taught_attributes : [],
    country: row.country?.trim() || undefined,
    bio: row.bio?.trim() || undefined,
    // Condição sempre zerada na entrega — o card nasce novo.
    fatigue: 0,
    injuryRisk: 0,
    evolutionXp: 0,
    outForMatches: 0,
  };
}

export interface CardCheckout {
  amountCents: number;
  player: Record<string, unknown>;
}

export type CardCheckoutResult =
  | { ok: true; checkout: CardCheckout }
  | { ok: false; status: 400 | 404 | 409 | 502; error: string };

/**
 * Resolve valor + jogador de um checkout PIX de card a partir do banco.
 * `clientPlayer` entra só como base cosmética — nada que valha dinheiro sai dele.
 */
export async function resolveCardCheckout(params: {
  sb: SupabaseClient;
  productRef: string | null | undefined;
  clientPlayer: unknown;
}): Promise<CardCheckoutResult> {
  const productRef = params.productRef?.trim();
  if (!productRef) {
    return { ok: false, status: 400, error: 'product_ref obrigatório para product_kind=card.' };
  }

  const { data, error } = await params.sb
    .from('legacy_players')
    .select(
      'id, name, pos, attributes, taught_attributes, team_booster, price_unit_cents, currency, listed_on_market, country, bio',
    )
    .eq('id', productRef)
    .maybeSingle();

  if (error) return { ok: false, status: 502, error: 'Não foi possível consultar o card.' };
  if (!data) return { ok: false, status: 404, error: 'Card não encontrado.' };

  const row = data as unknown as LegacyRow;

  if (!row.listed_on_market) {
    return { ok: false, status: 409, error: 'Este card não está à venda.' };
  }

  // Só card em USDT tem preço em R$. Card OLEFOOT se compra em /api/market/buy-legacy.
  if ((row.currency ?? 'OLEFOOT') !== 'USDT') {
    return { ok: false, status: 409, error: 'Este card não é vendido via PIX.' };
  }

  const priceUnitCents = Math.round(Number(row.price_unit_cents ?? 0));
  if (!Number.isFinite(priceUnitCents) || priceUnitCents <= 0) {
    return { ok: false, status: 409, error: 'Preço do card indisponível.' };
  }

  let venda: number;
  try {
    venda = await fetchUsdBrlVenda();
  } catch {
    // Fail closed: sem cotação não dá pra cobrar o valor certo, e cobrar errado
    // é pior que não vender.
    return { ok: false, status: 502, error: 'Cotação do dólar indisponível. Tente em instantes.' };
  }

  // price_unit_cents é centavo de USD; × (BRL/USD) dá centavo de BRL.
  const amountCents = Math.round(priceUnitCents * venda);
  if (amountCents < 100) {
    return { ok: false, status: 409, error: 'Preço do card indisponível.' };
  }

  return {
    ok: true,
    checkout: { amountCents, player: sanitizeCardPlayer(row, params.clientPlayer) },
  };
}
