import type { PlayerEntity } from '@/entities/types';
import { mergeLineupWithDefaults, PITCH_SLOT_ORDER } from '@/entities/lineup';

/** Início da janela oficial do dia de competição (jogos + treinos entre jogos). */
const OFFICIAL_DAY_START_H = 9;
/** Fim da janela (último treino oficial 22:00). */
const OFFICIAL_DAY_END_H = 22;

/** 7 jogos por dia, de 2 em 2 horas (mais espaço para managers / outras ligas). */
const OFFICIAL_MATCH_HOURS = [9, 11, 13, 15, 17, 19, 21] as const;

function buildOfficialMatchSlotTimes(): readonly string[] {
  return OFFICIAL_MATCH_HOURS.map((h) => `${String(h).padStart(2, '0')}:00`);
}

/** 7 treinos oficiais entre jogos (hora par entre cada par de jogos). */
const OFFICIAL_TRAINING_HOURS = [10, 12, 14, 16, 18, 20, 22] as const;

function buildOfficialTrainingSlotTimes(): readonly string[] {
  return OFFICIAL_TRAINING_HOURS.map((h) => `${String(h).padStart(2, '0')}:00`);
}

/** Horários de pontapé oficiais da liga (7/dia). */
export const OFFICIAL_MATCH_SLOT_TIMES = buildOfficialMatchSlotTimes();

/** Horários oficiais de treino de equipa entre jogos (7/dia). */
export const OFFICIAL_TRAINING_SLOT_TIMES = buildOfficialTrainingSlotTimes();

/** Grelha do dia na UI: 09:00 … 22:00, hora a hora (jogos e treinos intercalados). */
function buildFullCalendarDaySlotTimes(): readonly string[] {
  const out: string[] = [];
  for (let h = OFFICIAL_DAY_START_H; h <= OFFICIAL_DAY_END_H; h++) {
    out.push(`${String(h).padStart(2, '0')}:00`);
  }
  return out;
}

export const FULL_CALENDAR_DAY_SLOT_TIMES = buildFullCalendarDaySlotTimes();

const OFFICIAL_SLOT_TIME_SET = new Set(OFFICIAL_MATCH_SLOT_TIMES);
const OFFICIAL_TRAINING_TIME_SET = new Set(OFFICIAL_TRAINING_SLOT_TIMES);

export function isOfficialMatchSlotTime(hhmm: string): boolean {
  return OFFICIAL_SLOT_TIME_SET.has(hhmm);
}

export function isOfficialTrainingSlotTime(hhmm: string): boolean {
  return OFFICIAL_TRAINING_TIME_SET.has(hhmm);
}

/** Índice 0 = primeiro jogo oficial do dia (09:00). */
export type OfficialSlotIndex = number;

export function officialSlotTimeAt(index: OfficialSlotIndex): string {
  const i = Math.max(0, Math.min(index, OFFICIAL_MATCH_SLOT_TIMES.length - 1));
  return OFFICIAL_MATCH_SLOT_TIMES[i]!;
}

/**
 * Texto de apoio após um horário de jogo oficial (treino oficial até ao próximo jogo).
 * Lesões/suspensões (`outForMatches`) aplicam-se a toda a competição e a outros jogos
 * (amistosos, desafios) — o mesmo estado de jogador é lido em todo o game.
 */
export function trainingWindowLabelAfterSlot(matchSlotIndex: OfficialSlotIndex): string {
  const i = Math.max(0, Math.min(matchSlotIndex, OFFICIAL_MATCH_SLOT_TIMES.length - 1));
  const thisMatch = OFFICIAL_MATCH_SLOT_TIMES[i]!;
  const train = OFFICIAL_TRAINING_SLOT_TIMES[i];
  const nextMatch = OFFICIAL_MATCH_SLOT_TIMES[i + 1];
  if (train && nextMatch) {
    return `Treino oficial às ${train}, antes do jogo das ${nextMatch}. Indisponibilidades contam em todo o calendário.`;
  }
  if (train) {
    return `Último jogo oficial ${thisMatch}; treino oficial às ${train}. Depois, tempo livre para outras ligas ou amistosos.`;
  }
  return `Horário oficial de jogo ${thisMatch}.`;
}

export function trainingWindowLabelForCalendarSlot(hhmm: string): string {
  const matchIdx = OFFICIAL_MATCH_SLOT_TIMES.indexOf(hhmm);
  if (matchIdx >= 0) return trainingWindowLabelAfterSlot(matchIdx);
  const trainIdx = OFFICIAL_TRAINING_SLOT_TIMES.indexOf(hhmm);
  if (trainIdx >= 0) {
    const prevM = OFFICIAL_MATCH_SLOT_TIMES[trainIdx]!;
    const nextM = OFFICIAL_MATCH_SLOT_TIMES[trainIdx + 1];
    if (nextM) {
      return `Entre o jogo das ${prevM} e o das ${nextM}. Lesão ou suspensão aqui ou noutro jogo bloqueia titulares em toda a parte.`;
    }
    return `Após o jogo das ${prevM} — treino oficial; o GameSpirit mantém o mesmo estado de lesão para a liga e para outros jogos.`;
  }
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr) || 0;
  const mins = h * 60 + m;
  if (mins < OFFICIAL_DAY_START_H * 60) {
    return 'Antes da janela oficial (09:00–22:00). Espaço livre para treinos leves ou explorar ligas.';
  }
  if (mins > OFFICIAL_DAY_END_H * 60) {
    return 'Após a janela oficial. Tempo livre para outras competições ou descanso.';
  }
  return 'Janela livre.';
}

function isAvailableForOfficialMatch(p: PlayerEntity | undefined): boolean {
  if (!p) return false;
  return (p.outForMatches ?? 0) <= 0;
}

/**
 * Regras comerciais: 11 em campo + pelo menos 5 no banco (disponíveis).
 * Lesões / suspensões (`outForMatches`) retiram o jogador do elenco útil em qualquer jogo
 * (liga, amistoso, desafio) — uma única fonte de verdade.
 */
export function evaluateOfficialSquad(
  lineup: Record<string, string>,
  playersById: Record<string, PlayerEntity>,
): {
  ok: boolean;
  startersFilled: number;
  startersAvailable: number;
  benchAvailable: number;
  reason?: string;
} {
  const merged = mergeLineupWithDefaults(lineup, playersById);
  const starterIds = PITCH_SLOT_ORDER.map((s) => merged[s.id]).filter(Boolean);

  const startersAvailable = starterIds.filter((id) => isAvailableForOfficialMatch(playersById[id])).length;
  const startersFilled = starterIds.length;

  const starterSet = new Set(starterIds);
  const benchPool = Object.values(playersById).filter((p) => !starterSet.has(p.id) && isAvailableForOfficialMatch(p));
  const benchAvailable = benchPool.length;

  if (startersAvailable < 11) {
    return {
      ok: false,
      startersFilled,
      startersAvailable,
      benchAvailable,
      reason: `Titulares disponíveis: ${startersAvailable}/11 (lesões/suspensões).`,
    };
  }
  if (benchAvailable < 5) {
    return {
      ok: false,
      startersFilled,
      startersAvailable,
      benchAvailable,
      reason: `Banco disponível: ${benchAvailable}/5 (mínimo exigido).`,
    };
  }

  return { ok: true, startersFilled, startersAvailable, benchAvailable };
}

/**
 * Em `vite dev` ou com `VITE_RELAX_SQUAD_FOR_TEST=1`, partidas rápidas / TESTE 2D não bloqueiam por
 * plantel oficial (11+5) — útil para QA sem preencher o Time.
 * Builds de produção mantêm a regra salvo a variável estar definida no deploy.
 */
export function isOfficialSquadGateRelaxedForTests(): boolean {
  if (import.meta.env.DEV) return true;
  const v = import.meta.env.VITE_RELAX_SQUAD_FOR_TEST;
  if (v === undefined || String(v).trim() === '') return false;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}
