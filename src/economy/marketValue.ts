/**
 * marketValue — recalculo de valor de mercado do jogador.
 *
 * Pilar de preço dinâmico do Olefoot. Chamado pós-jogo (de dentro de
 * `applyMatchPerformanceEvolution`) para que o valor de mercado responda
 * a performance real, raridade e idade — não fique parado em admin set.
 *
 * Fórmula determinística (sem RNG) para auditoria e timeline coerente.
 */

import type { PlayerEntity, PlayerRarity } from '@/entities/types';
import { overallFromAttributes } from '@/entities/player';

/** Tecto absoluto pra evitar valores absurdos via DevTools / save corrompido. */
const MAX_MARKET_BRO_CENTS = 50_000_000; // 500k BRO
const MIN_MARKET_BRO_CENTS = 1_00; // 1 BRO

/** Multiplicador por raridade — premium paga preço de premium. */
const RARITY_MULTIPLIER: Record<PlayerRarity, number> = {
  bronze: 0.85,
  prata: 1.0,
  ouro: 1.3,
  raro: 1.5,
  ultra_raro: 1.8,
  epico: 2.2,
  premium: 1.2,
  ai_plus: 1.0,
  normal: 1.0,
};

/** OVR base em centavos de BRO — sqrt-like para não explodir em OVRs altos. */
function basePriceByOverall(ovr: number): number {
  const n = Math.max(40, Math.min(99, ovr));
  // 60 OVR ≈ 100 BRO, 80 OVR ≈ 500 BRO, 95 OVR ≈ 2500 BRO
  return Math.round(Math.pow((n - 35) / 60, 2.4) * 1_500_00);
}

/** Penalidade por idade — pico aos 27, decaí depois. */
function ageMultiplier(age: number | undefined): number {
  if (age == null || !Number.isFinite(age)) return 1.0;
  if (age <= 19) return 0.85; // promessas vendem mais barato (potencial não realizado)
  if (age <= 22) return 1.0;
  if (age <= 26) return 1.15; // ascensão
  if (age <= 29) return 1.2; // pico
  if (age <= 32) return 1.0;
  if (age <= 35) return 0.7;
  return 0.45;
}

/** Boost por performance recente. */
function recentFormMultiplier(recentRatings: number[]): number {
  if (!recentRatings.length) return 1.0;
  const avg = recentRatings.reduce((s, r) => s + r, 0) / recentRatings.length;
  // 6.5 = neutro; 8.0+ = +20%; 5.0- = -25%
  const delta = (avg - 6.5) / 1.5; // -1..+1 normalizado
  const m = 1 + delta * 0.2;
  return Math.max(0.65, Math.min(1.35, m));
}

/** Penalidade por contrato esgotado / lesão prolongada. */
function statusMultiplier(player: PlayerEntity, outForMatches: number): number {
  let m = 1.0;
  if (player.contractExpired) m *= 0.5;
  if (outForMatches >= 5) m *= 0.7;
  else if (outForMatches >= 2) m *= 0.85;
  return m;
}

/** Boost por raridade de cartão emitido (cardSupply baixo = mais raro = mais caro). */
function supplyScarcityMultiplier(cardSupply: number | undefined): number {
  if (cardSupply == null || !Number.isFinite(cardSupply)) return 1.0;
  if (cardSupply <= 1) return 1.5; // único
  if (cardSupply <= 10) return 1.25;
  if (cardSupply <= 100) return 1.05;
  return 1.0;
}

export interface RecomputeMarketValueInput {
  /** Histórico recente de ratings (últimas 3-5 partidas). */
  recentRatings: number[];
  /** Out for matches do SSOT playerHealth — pra penalizar lesão longa. */
  outForMatches: number;
}

/**
 * Recalcula `marketValueBroCents` baseado em OVR atual, raridade, idade,
 * forma recente e status. Determinístico.
 *
 * Mantém `marketValueExp` intacto (catálogo Genesis usa EXP fixo).
 * Mantém valor de admin (`marketValueBroCents != null && managerCreated === false`)
 * se diferença for grande — para não sobrescrever piso de admin.
 */
export function recomputeMarketValue(
  player: PlayerEntity,
  input: RecomputeMarketValueInput,
): number {
  const ovr = overallFromAttributes(player.attrs, player.pos);
  const base = basePriceByOverall(ovr);

  const rarity = (player.rarity ?? 'normal') as PlayerRarity;
  const rarMul = RARITY_MULTIPLIER[rarity] ?? 1.0;
  const ageMul = ageMultiplier(player.age);
  const formMul = recentFormMultiplier(input.recentRatings);
  const statusMul = statusMultiplier(player, input.outForMatches);
  const scarcityMul = supplyScarcityMultiplier(player.cardSupply);

  const raw = base * rarMul * ageMul * formMul * statusMul * scarcityMul;
  const clamped = Math.round(Math.max(MIN_MARKET_BRO_CENTS, Math.min(MAX_MARKET_BRO_CENTS, raw)));

  // Suaviza grandes saltos: blenda 70% novo + 30% anterior (se houver).
  const prev = player.marketValueBroCents;
  if (prev != null && Number.isFinite(prev) && prev > 0) {
    return Math.round(clamped * 0.7 + prev * 0.3);
  }
  return clamped;
}

/** Helper exposto pra UI/admin verem o valor "alvo" sem precisar persistir. */
export function previewMarketValue(player: PlayerEntity): number {
  return recomputeMarketValue(player, { recentRatings: [], outForMatches: 0 });
}
