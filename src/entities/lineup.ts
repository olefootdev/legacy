import type { PlayerEntity } from './types';
import { AWAY_SLOT_ORDER } from '@/engine/test2d/tacticalPositioning';

export const PITCH_SLOT_ORDER: Array<{ id: string; label: string }> = [
  { id: 'pe', label: 'PE' },
  { id: 'ata', label: 'ATA' },
  { id: 'pd', label: 'PD' },
  { id: 'mc1', label: 'MC' },
  { id: 'vol', label: 'VOL' },
  { id: 'mc2', label: 'MC' },
  { id: 'le', label: 'LE' },
  { id: 'zag1', label: 'ZAG' },
  { id: 'zag2', label: 'ZAG' },
  { id: 'ld', label: 'LD' },
  { id: 'gol', label: 'GOL' },
];

/** Patamar acima do qual um jogador é considerado exausto pra escalação automática. */
export const FATIGUE_EXHAUSTED_THRESHOLD = 85;

/** Patamar acima do qual o squad inteiro é considerado em alerta (UX preventiva — FIX D). */
export const FATIGUE_SQUAD_WARNING_COUNT = 5;

export interface LineupBuildOptions {
  /** Fatigue por playerId (vem do SSOT playerHealth quando existe). Fallback: PlayerEntity.fatigue legacy. */
  fatigueById?: Record<string, number>;
  /** Patamar máximo aceito pra escalação primária. Default 85. */
  maxFatigue?: number;
}

export interface LineupBuildResult {
  lineup: Record<string, string>;
  /** Jogadores forçados a entrar com fatigue acima do limite (squad sem alternativa). */
  forcedExhaustedIds: string[];
  /** Squad inteiro está em alerta (>= FATIGUE_SQUAD_WARNING_COUNT exaustos no pool). */
  squadExhaustedWarning: boolean;
}

/** Lê fatigue priorizando o SSOT (fatigueById). */
function fatigueOf(id: string, player: PlayerEntity | undefined, opts?: LineupBuildOptions): number {
  if (opts?.fatigueById && id in opts.fatigueById) return opts.fatigueById[id] ?? 0;
  return player?.fatigue ?? 0;
}

/**
 * Versão estruturada — devolve lineup + metadata.
 * FIX A: prioriza jogadores com fatigue ≤ threshold + filtra lesionados (outForMatches > 0).
 * Cai pra exaustos só se não houver alternativa (squad pequeno / muitos cansados).
 * FIX D: sinaliza quando o squad inteiro está em alerta.
 */
export function buildDefaultLineupWithMeta(
  playersById: Record<string, PlayerEntity>,
  opts?: LineupBuildOptions,
): LineupBuildResult {
  const maxFatigue = opts?.maxFatigue ?? FATIGUE_EXHAUSTED_THRESHOLD;
  const pool = Object.values(playersById).filter((p) => (p.outForMatches ?? 0) === 0);
  const exhaustedInPool = pool.filter((p) => fatigueOf(p.id, p, opts) > maxFatigue).length;

  const used = new Set<string>();
  const lineup: Record<string, string> = {};
  const forcedExhaustedIds: string[] = [];

  const isFresh = (p: PlayerEntity) => fatigueOf(p.id, p, opts) <= maxFatigue;
  const tryPick = (predicate: (p: PlayerEntity) => boolean) =>
    pool.find((p) => !used.has(p.id) && predicate(p));

  for (const slot of PITCH_SLOT_ORDER) {
    let pick =
      // 1) posição certa + fresco
      tryPick((p) => p.pos === slot.label && isFresh(p)) ??
      // 2) qualquer posição + fresco
      tryPick(isFresh) ??
      // 3) posição certa, exausto (último recurso)
      tryPick((p) => p.pos === slot.label) ??
      // 4) qualquer um
      tryPick(() => true);

    if (pick) {
      lineup[slot.id] = pick.id;
      used.add(pick.id);
      if (!isFresh(pick)) forcedExhaustedIds.push(pick.id);
    }
  }

  return {
    lineup,
    forcedExhaustedIds,
    squadExhaustedWarning: exhaustedInPool >= FATIGUE_SQUAD_WARNING_COUNT,
  };
}

/** Compat: chamadores antigos pegam só o lineup. Pra metadata, usar `buildDefaultLineupWithMeta`. */
export function buildDefaultLineup(
  playersById: Record<string, PlayerEntity>,
  opts?: LineupBuildOptions,
): Record<string, string> {
  return buildDefaultLineupWithMeta(playersById, opts).lineup;
}

export function mergeLineupWithDefaults(
  saved: Record<string, string>,
  playersById: Record<string, PlayerEntity>,
  opts?: LineupBuildOptions,
): Record<string, string> {
  const base = buildDefaultLineup(playersById, opts);
  return { ...base, ...saved };
}

/** Ordem dos titulares visitantes alinhada a `buildAwayPitchPlayers` / `AWAY_SLOT_ORDER`. */
export function awayStartingElevenFromSquad(
  squad: PlayerEntity[],
  opts?: LineupBuildOptions,
): PlayerEntity[] {
  const byId = Object.fromEntries(squad.map((p) => [p.id, p]));
  const lu = buildDefaultLineup(byId, opts);
  const out: PlayerEntity[] = [];
  for (const slotId of AWAY_SLOT_ORDER) {
    const pid = lu[slotId];
    const p = pid ? byId[pid] : undefined;
    if (p) out.push(p);
  }
  return out;
}
