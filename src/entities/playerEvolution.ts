import type { PlayerAttributes, PlayerEntity } from './types';
import { overallFromAttributes } from './player';
import { MANAGER_PROSPECT_EVOLVED_MAX_OVR, scaleAttrsToMaxOvr } from './managerProspect';
import { evolvePositionKnowledgePostMatch } from '@/gamespirit/legacy/positionKnowledgeTypes';
import type { PositionActionKey, KnowledgeZoneKey } from '@/gamespirit/legacy/positionKnowledgeTypes';
import { recomputeMarketValue } from '@/economy/marketValue';

/** Pilar 3 (evolução pós-jogo / tectos): mapa de rastreio em `@/lib/veracityPillarsMap`. */

/** Jogadores Admin / campeões: crescimento máximo de OVR acima do valor na criação (mint). */
export const ADMIN_OVR_GROWTH_MAX = 15;

const ATTR_KEYS = [
  'passe',
  'marcacao',
  'velocidade',
  'drible',
  'finalizacao',
  'fisico',
  'tatico',
  'mentalidade',
  'confianca',
  'fairPlay',
] as const satisfies readonly (keyof PlayerAttributes)[];

function clampEvolutionAttr(n: number): number {
  return Math.min(99, Math.max(35, Math.round(n)));
}

export type MatchOutcomeLetter = 'win' | 'draw' | 'loss';

export type HomePlayerStatRow = {
  passesOk: number;
  passesAttempt: number;
  tackles: number;
  km: number;
  rating: number;
};

/** Tecto de OVR após treinos / jogos / evolução. */
export function getEvolvedOverallCap(player: PlayerEntity): number {
  if (player.managerCreated) return MANAGER_PROSPECT_EVOLVED_MAX_OVR;
  const mint = player.mintOverall;
  if (mint != null && Number.isFinite(mint)) {
    return Math.min(99, Math.round(mint) + ADMIN_OVR_GROWTH_MAX);
  }
  return 99;
}

function clampEvolutionRate(n: number): number {
  return Math.min(3, Math.max(0.25, n));
}

/** Garante `mintOverall` e `evolutionRate` coerentes (save legado / migração). */
export function ensureMintOverall(player: PlayerEntity): PlayerEntity {
  const ovr = overallFromAttributes(player.attrs, player.pos);
  const mint =
    player.mintOverall != null && Number.isFinite(player.mintOverall)
      ? Math.round(player.mintOverall)
      : ovr;
  const rate =
    player.evolutionRate != null && Number.isFinite(player.evolutionRate)
      ? clampEvolutionRate(player.evolutionRate)
      : 1;
  return { ...player, mintOverall: mint, evolutionRate: rate };
}

/** Reduz atributos se OVR atual exceder o tecto de evolução. */
export function clampPlayerToEvolutionCap(player: PlayerEntity): PlayerEntity {
  const p = ensureMintOverall(player);
  const cap = getEvolvedOverallCap(p);
  const ovr = overallFromAttributes(p.attrs, p.pos);
  if (ovr <= cap) return p;
  return { ...p, attrs: scaleAttrsToMaxOvr(p.attrs, cap, p.pos) };
}

function bumpAttrsBySwing(attrs: PlayerAttributes, swing: number): PlayerAttributes {
  if (swing === 0) return { ...attrs };
  const out = { ...attrs };
  const keys = [...ATTR_KEYS];
  const steps = Math.abs(swing);
  const up = swing > 0;
  for (let i = 0; i < steps; i++) {
    if (up) {
      keys.sort((a, b) => out[a] - out[b]);
      const k = keys[0]!;
      out[k] = clampEvolutionAttr(out[k] + 1);
    } else {
      keys.sort((a, b) => out[b] - out[a]);
      const k = keys[0]!;
      out[k] = clampEvolutionAttr(out[k] - 1);
    }
  }
  return out;
}

/**
 * Ajusta atributos e EXP de evolução com base na linha de estatísticas da partida (casa).
 * `evolutionRate` amplifica ganhos/perdas de swing e de XP.
 * `legacyModeWasActive`: se true, dobra o delta de evolução do positionKnowledge —
 * a lenda "ensinou mais" nesta partida.
 */
export function applyMatchPerformanceEvolution(
  player: PlayerEntity,
  stat: HomePlayerStatRow | undefined,
  outcome: MatchOutcomeLetter,
  legacyModeWasActive = false,
): PlayerEntity {
  const rate =
    player.evolutionRate != null && Number.isFinite(player.evolutionRate)
      ? clampEvolutionRate(player.evolutionRate)
      : 1;
  let swing = 0;
  if (stat) {
    const rating = stat.rating ?? 6.5;
    swing += Math.round((rating - 6.5) * rate * 2);
    const attempt = stat.passesAttempt ?? 0;
    if (attempt > 4) {
      const acc = stat.passesOk / attempt;
      if (acc >= 0.78) swing += 1;
      if (acc <= 0.45) swing -= 1;
    }
    if ((stat.tackles ?? 0) >= 5) swing += 1;
    if ((stat.km ?? 0) >= 10) swing += 1;
  }
  if (outcome === 'win') swing += 1;
  if (outcome === 'loss') swing -= 1;
  swing = Math.max(-5, Math.min(6, swing));
  const xpGain = Math.max(0, Math.round((4 + Math.max(0, swing)) * rate));

  // Evolui positionKnowledge pós-partida de forma determinística (zero tokens)
  let updatedKnowledge = player.positionKnowledge;
  if (updatedKnowledge && updatedKnowledge.sessionsCompleted > 0 && stat) {
    // Inferir a ação dominante pelo perfil de stats do jogador nesta partida
    const zone = playerDominantZoneFromStat(player.pos, stat);
    const action = playerDominantActionFromStat(stat, swing);
    if (zone && action) {
      updatedKnowledge = evolvePositionKnowledgePostMatch(updatedKnowledge, outcome, action, zone);
      // Legacy Mode ativo: aplica uma segunda evolução com peso reduzido (sessão extra)
      if (legacyModeWasActive) {
        updatedKnowledge = evolvePositionKnowledgePostMatch(updatedKnowledge, outcome, action, zone);
      }
    }
  }

  const nextAttrs = bumpAttrsBySwing(player.attrs, swing);
  const playerAfterAttrs: PlayerEntity = {
    ...player,
    attrs: nextAttrs,
    evolutionXp: Math.max(0, (player.evolutionXp ?? 0) + xpGain),
    ...(updatedKnowledge ? { positionKnowledge: updatedKnowledge } : {}),
  };

  // Preço dinâmico: recalcula marketValueBroCents pós-jogo.
  // Mantém `marketValueExp` (catálogo Genesis) intacto. Apenas BRO responde
  // a performance/forma/idade/raridade — mata o "mock" de preço estático.
  const recentRating = stat?.rating ?? 6.5;
  const nextMarketValue = recomputeMarketValue(playerAfterAttrs, {
    recentRatings: [recentRating],
    outForMatches: player.outForMatches ?? 0,
  });

  return {
    ...playerAfterAttrs,
    marketValueBroCents: nextMarketValue,
  };
}

/** Deriva zona dominante a partir da posição do jogador (sem tokens). */
function playerDominantZoneFromStat(pos: string, _stat: HomePlayerStatRow): KnowledgeZoneKey | undefined {
  const p = pos.toUpperCase();
  if (p === 'GOL' || p === 'ZAG' || p === 'LE' || p === 'LD') return 'def';
  if (p === 'VOL' || p === 'MC' || p === 'MEI') return 'mid';
  if (p === 'PE' || p === 'PD' || p === 'ATA') return 'att';
  return 'mid';
}

/** Deriva ação dominante a partir das estatísticas (sem tokens). */
function playerDominantActionFromStat(stat: HomePlayerStatRow, swing: number): PositionActionKey | undefined {
  if (!stat) return undefined;
  // Rating alto + tackles = press
  if (stat.tackles >= 4 && stat.rating >= 7.0) return 'press';
  // Alta taxa de passe = recycle/progress
  if (stat.passesAttempt > 8) {
    const acc = stat.passesOk / stat.passesAttempt;
    return acc >= 0.75 ? 'progress' : 'recycle';
  }
  // Swing positivo em vitória = shot (atacante/meia)
  if (swing >= 2 && stat.rating >= 7.5) return 'shot';
  // Default: progress
  return 'progress';
}
