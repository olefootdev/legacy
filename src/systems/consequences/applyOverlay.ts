/**
 * OLEFOOT PYTHON MODE — Overlay de consequências sobre estado base.
 *
 * Aplica o efeito agregado das consequências ativas sobre snapshots
 * "vivos" de jogador e clube. UI/engine devem consumir o overlay,
 * não os campos base diretamente, para a fadiga/moral/valor refletirem
 * a realidade temporal.
 */
import type { PlayerAttributes, PlayerEntity } from '@/entities/types';
import { evaluateConsequence } from './store';
import type {
  ConsequenceStoreState,
  PersistentConsequence,
} from './types';

export interface PlayerOverlay {
  unavailable: boolean;
  /** Pontos somados ao moral base. */
  moralDelta: number;
  /** Multiplicador no físico (1.0 = neutro; 0.9 = -10%). */
  physicalMultiplier: number;
  /** Pontos adicionais de injury risk. */
  injuryRiskDelta: number;
  /** Multiplicador no valor de mercado (1.0 = neutro). */
  marketValueMultiplier: number;
  /** Multiplicador no interesse de outros clubes. */
  marketInterestMultiplier: number;
  /** Lista de razões — UI mostra como tags. */
  reasons: string[];
}

export const NEUTRAL_PLAYER_OVERLAY: PlayerOverlay = {
  unavailable: false,
  moralDelta: 0,
  physicalMultiplier: 1,
  injuryRiskDelta: 0,
  marketValueMultiplier: 1,
  marketInterestMultiplier: 1,
  reasons: [],
};

export interface ClubOverlay {
  /** Pontos somados ao moral coletivo. */
  teamMoralDelta: number;
  /** Pontos somados ao apoio da torcida (%). */
  crowdSupportDelta: number;
  /** Multiplicador no fanbase (receita bilheteria). */
  fanbaseMultiplier: number;
  /** Pressão da diretoria (0/1). */
  boardPressureActive: boolean;
  reasons: string[];
}

export const NEUTRAL_CLUB_OVERLAY: ClubOverlay = {
  teamMoralDelta: 0,
  crowdSupportDelta: 0,
  fanbaseMultiplier: 1,
  boardPressureActive: false,
  reasons: [],
};

/** Computa overlay agregado dos jogadores. */
export function computePlayerOverlay(
  store: ConsequenceStoreState,
  playerId: string,
  nowMs: number = Date.now(),
): PlayerOverlay {
  const overlay: PlayerOverlay = {
    unavailable: false,
    moralDelta: 0,
    physicalMultiplier: 1,
    injuryRiskDelta: 0,
    marketValueMultiplier: 1,
    marketInterestMultiplier: 1,
    reasons: [],
  };

  for (const c of Object.values(store.active)) {
    if (c.playerId !== playerId) continue;
    if (c.expiresAt <= nowMs) continue;
    const value = evaluateConsequence(c, nowMs).currentValue;
    if (value === 0) continue;

    applyOneConsequenceToPlayer(c, value, overlay);
  }

  return overlay;
}

/**
 * Kinds que tornam o jogador indisponível pra escalação.
 * Whitelist explícita — NÃO usar `kind.includes('injury')` porque consequências
 * de moral/valor podem ter "injury" no nome (ex: morale_drop_injury_severe).
 */
const UNAVAILABILITY_KINDS = new Set<string>([
  'red_card_suspension',
  'red_card_suspension_repeat',
  'injury_light_out',
  'injury_medium_out',
  'injury_severe_out',
  'forced_rest',
]);

function applyOneConsequenceToPlayer(
  c: PersistentConsequence,
  value: number,
  overlay: PlayerOverlay,
): void {
  const k = c.kind;

  // Disponibilidade — whitelist exata
  if (UNAVAILABILITY_KINDS.has(k)) {
    if (value > 0) {
      overlay.unavailable = true;
      overlay.reasons.push(c.kind);
    }
    return;
  }

  // Físico (atributos)
  if (k.startsWith('physical_attr_drop')) {
    overlay.physicalMultiplier *= 1 + value;
    overlay.reasons.push(c.kind);
    return;
  }
  if (k === 'injury_risk_spike') {
    overlay.injuryRiskDelta += value;
    overlay.reasons.push(c.kind);
    return;
  }

  // Psicológico (moral)
  if (c.dimension === 'psychological') {
    overlay.moralDelta += value;
    overlay.reasons.push(c.kind);
    return;
  }

  // Reputacional (valor + interesse de mercado)
  if (c.dimension === 'reputational') {
    if (k.includes('market_value')) {
      overlay.marketValueMultiplier *= 1 + value;
    } else if (k.includes('market_interest')) {
      overlay.marketInterestMultiplier *= 1 + value;
    }
    overlay.reasons.push(c.kind);
    return;
  }

  // Financial (multa de salário, etc.) — capturado como reason; valor lido direto do store
}

/** Computa overlay agregado do clube. */
export function computeClubOverlay(
  store: ConsequenceStoreState,
  clubId: string,
  nowMs: number = Date.now(),
): ClubOverlay {
  const overlay: ClubOverlay = {
    teamMoralDelta: 0,
    crowdSupportDelta: 0,
    fanbaseMultiplier: 1,
    boardPressureActive: false,
    reasons: [],
  };

  for (const c of Object.values(store.active)) {
    if (c.scope !== 'club') continue;
    if (c.clubId !== clubId) continue;
    if (c.expiresAt <= nowMs) continue;
    const value = evaluateConsequence(c, nowMs).currentValue;
    if (value === 0) continue;

    const k = c.kind;
    if (k.includes('team_morale') || k === 'defense_confidence_drop') {
      overlay.teamMoralDelta += value;
    } else if (k === 'crowd_support_drop') {
      overlay.crowdSupportDelta += value;
    } else if (k.includes('fanbase')) {
      overlay.fanbaseMultiplier *= 1 + value;
    } else if (k === 'board_pressure_increase') {
      overlay.boardPressureActive = true;
    }
    overlay.reasons.push(c.kind);
  }

  return overlay;
}

/** Aplica overlay físico sobre os atributos do jogador (snapshot vivo). */
export function applyOverlayToAttributes(
  base: PlayerAttributes,
  overlay: PlayerOverlay,
): PlayerAttributes {
  if (overlay.physicalMultiplier === 1) return base;
  return {
    ...base,
    fisico: Math.max(0, Math.round(base.fisico * overlay.physicalMultiplier)),
  };
}

/** Snapshot derivado: PlayerEntity com overlay aplicado. */
export function effectivePlayer(
  player: PlayerEntity,
  overlay: PlayerOverlay,
): PlayerEntity {
  if (
    overlay.physicalMultiplier === 1 &&
    !overlay.unavailable
  ) {
    return player;
  }
  return {
    ...player,
    attrs: applyOverlayToAttributes(player.attrs, overlay),
  };
}
