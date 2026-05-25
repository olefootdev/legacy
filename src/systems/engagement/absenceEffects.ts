/**
 * OLEFOOT PYTHON MODE — Aplicação ativa das penalidades de ausência.
 *
 * Quando o manager volta após período longo fora, este módulo:
 *   - Gera lesões automáticas em jogadores aleatórios (conforme tier)
 *   - Cria consequência de queda de apoio da torcida (escopo clube)
 *   - Cria mensagens de inbox para deixar visível o que aconteceu
 *
 * Idempotente: usa `lastAbsenceTier` da presença pra não re-aplicar
 * múltiplas vezes a mesma tier.
 */
import { MS_PER_HOUR } from '@/systems/timeCalibration';
import type { ImpactEvent } from '@/systems/consequences/handlers';
import { materializeBatch } from '@/systems/consequences/handlers';
import type {
  AbsencePenaltyEffect,
  AbsenceTier,
  ManagerPresence,
} from './types';
import type { PersistentConsequence } from '@/systems/consequences/types';
import type { InboxItem } from '@/game/inboxTypes';
import { makeInboxItem } from '@/game/inboxItem';

/**
 * Ordem das tiers, da mais leve à mais grave.
 * Usado pra detectar se NOVA aplicação é necessária.
 */
const TIER_ORDER: AbsenceTier[] = [
  'normal',
  'warning_12h',
  'mild_24h',
  'moderate_36h',
  'heavy_48h',
  'crisis_72h',
];

function tierRank(t: AbsenceTier): number {
  return TIER_ORDER.indexOf(t);
}

/**
 * Decide se a nova tier requer aplicação de side-effects ainda não feitos.
 * Considera "escalonamento": se manager passou de moderate→heavy, aplica
 * efeitos NOVOS do heavy (não re-aplica os de moderate).
 */
export function shouldApplyAbsenceEffects(
  prevAppliedTier: AbsenceTier | undefined,
  currentTier: AbsenceTier,
): boolean {
  const prevRank = prevAppliedTier ? tierRank(prevAppliedTier) : -1;
  const currentRank = tierRank(currentTier);
  // Só aplica efeitos a partir de moderate (índice 3)
  if (currentRank < 3) return false;
  // Aplica se escalou (subiu de tier desde a última aplicação)
  return currentRank > prevRank;
}

export interface AbsenceSideEffects {
  /** Consequências persistentes a adicionar ao store. */
  consequences: PersistentConsequence[];
  /** Itens de inbox a adicionar (deixa visível o que aconteceu). */
  inboxItems: InboxItem[];
  /** Texto resumo pra logging/telemetria. */
  summary: string;
}

interface ApplyOpts {
  managerId: string;
  clubId: string;
  /** IDs de jogadores elegíveis para lesão aleatória (não-GK preferencialmente). */
  eligiblePlayerIds: string[];
  /** Tier atingida que ainda não foi aplicada. */
  tier: AbsenceTier;
  effect: AbsencePenaltyEffect;
  /** Horas reais de ausência (pra mensagem). */
  hoursAbsent: number;
  /** Timestamp atual. */
  now: number;
}

/** Picker simples deterministic-ish via timestamp (não precisa cripto). */
function pickRandomIds(ids: string[], count: number, seed: number): string[] {
  if (count <= 0 || ids.length === 0) return [];
  const arr = [...ids];
  const out: string[] = [];
  let s = seed;
  for (let i = 0; i < count && arr.length > 0; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const idx = s % arr.length;
    out.push(arr.splice(idx, 1)[0]!);
  }
  return out;
}

export function buildAbsenceSideEffects(opts: ApplyOpts): AbsenceSideEffects {
  const events: ImpactEvent[] = [];
  const inboxItems: InboxItem[] = [];

  // 1) Lesões automáticas
  const injuredIds = pickRandomIds(
    opts.eligiblePlayerIds,
    opts.effect.randomInjuryCount,
    opts.now,
  );
  for (const pid of injuredIds) {
    events.push({
      kind: 'injury_light',
      managerId: opts.managerId,
      clubId: opts.clubId,
      playerId: pid,
      sourceEventId: `absence_${opts.tier}_${pid}_${opts.now}`,
      at: opts.now,
    });
  }

  // 2) Queda de apoio da torcida (só em moderate+; crisis tem -20% direto)
  let crowdConsequence: PersistentConsequence | undefined;
  if (opts.effect.crowdSupportDelta < 0) {
    crowdConsequence = {
      id: `absence_crowd_${opts.tier}_${opts.now}`,
      managerId: opts.managerId,
      clubId: opts.clubId,
      kind: 'crowd_support_drop',
      dimension: 'psychological',
      scope: 'club',
      magnitude: opts.effect.crowdSupportDelta,
      decayCurve: 'linear',
      startsAt: opts.now,
      // Decai em 24h reais — manager tem 1 dia pra reconquistar
      expiresAt: opts.now + 24 * MS_PER_HOUR,
      sourceEventId: `absence_${opts.tier}_${opts.now}`,
      metadata: { absenceTier: opts.tier, hoursAbsent: opts.hoursAbsent },
    };
  }

  // 3) Inbox — deixa visível
  const tierLabel: Record<AbsenceTier, string> = {
    normal: '',
    warning_12h: '',
    mild_24h: '',
    moderate_36h: 'Clube à deriva',
    heavy_48h: 'Crise instalada',
    crisis_72h: 'CRISE TOTAL',
  };
  if (tierLabel[opts.tier]) {
    const parts: string[] = [];
    if (injuredIds.length > 0) {
      parts.push(`${injuredIds.length} lesão${injuredIds.length > 1 ? 'ões' : ''} leve${injuredIds.length > 1 ? 's' : ''}`);
    }
    if (opts.effect.crowdSupportDelta < 0) {
      parts.push(`apoio torcida ${opts.effect.crowdSupportDelta}%`);
    }
    if (!opts.effect.marketActivityEnabled) {
      parts.push('mercado parou');
    }
    if (opts.effect.starPlayerDepartureRisk) {
      parts.push('estrelas considerando saída');
    }

    const title = `${tierLabel[opts.tier]} — ${Math.floor(opts.hoursAbsent)}h sem comando`;
    inboxItems.push(
      makeInboxItem(
        `absence_${opts.tier}_${opts.now}`,
        'CROWD_MOOD',
        'CLUBE',
        title,
      ),
    );
  }

  const consequences: PersistentConsequence[] = [
    ...materializeBatch(events),
    ...(crowdConsequence ? [crowdConsequence] : []),
  ];

  const summary = `tier=${opts.tier} hours=${opts.hoursAbsent.toFixed(1)} injuries=${injuredIds.length} crowd=${opts.effect.crowdSupportDelta}`;

  return { consequences, inboxItems, summary };
}
