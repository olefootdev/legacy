/**
 * Ledger de impacto (casa) + cálculo determinístico visitante a partir do feed.
 * Ver `impactRules.ts` para fórmulas e políticas.
 *
 * Anti-spam (desarmes/saves repetidos): ao emitir `INDIV.tackleRecovery` / saves, respeitar
 * `ANTI_SPAM_MAX_PER_MINUTE` em `impactRules.ts` antes de chamar `appendEntry` (não ligado aqui).
 */

import type { MatchEventEntry, PitchPlayerState } from '@/engine/types';
import { hashStringSeed } from '@/match/seededRng';
import type { ImpactLedgerEntry } from './impactTypes';
import {
  CLEAN_SHEET_MULT,
  IMPACT_FACTOR_FLOOR,
  INDIV,
  TEAM_GOAL_CONCEDED_FIELD,
  TEAM_GOAL_CONCEDED_GK_POLICY_B,
  TEAM_GOAL_SCORED,
  captainAmplifyIndividualFactor,
  qualifiesCleanSheetPlayer,
} from './impactRules';
import { idxFromSeed } from './impactUtils';

export type { ImpactLedgerEntry } from './impactTypes';

export function uidLedger(): string {
  return `il-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function appendEntry(
  ledger: ImpactLedgerEntry[],
  minute: number,
  playerId: string,
  factor: number,
  kind: ImpactLedgerEntry['kind'],
  captainBoost = false,
): void {
  ledger.push({
    id: uidLedger(),
    minute,
    playerId,
    factor,
    kind,
    captainBoost,
  });
}

/** +10% equipa para todos os titulares listados (momento do golo). */
export function appendTeamGoalScoredHome(
  ledger: ImpactLedgerEntry[],
  minute: number,
  onPitchIds: string[],
): void {
  for (const pid of onPitchIds) {
    appendEntry(ledger, minute, pid, TEAM_GOAL_SCORED, 'team_goal_scored', false);
  }
}

/**
 * Golo sofrido (visitante marcou): política B — GR ×0,85; resto ×0,90.
 * Não acumular os dois no GR.
 */
export function appendTeamGoalConcededHome(
  ledger: ImpactLedgerEntry[],
  minute: number,
  homeOnPitch: PitchPlayerState[],
): void {
  for (const p of homeOnPitch) {
    const f = p.role === 'gk' || p.pos === 'GOL' ? TEAM_GOAL_CONCEDED_GK_POLICY_B : TEAM_GOAL_CONCEDED_FIELD;
    appendEntry(ledger, minute, p.playerId, f, 'team_goal_conceded', false);
  }
}

/** Autor do golo: +14% individual (com capitão se aplicável). */
export function appendGoalScorerHome(
  ledger: ImpactLedgerEntry[],
  minute: number,
  scorerId: string,
  captainId: string | undefined,
): void {
  const raw = INDIV.goalAuthor;
  const cap = captainId === scorerId;
  const factor = cap ? captainAmplifyIndividualFactor(raw) : raw;
  appendEntry(ledger, minute, scorerId, factor, 'goal_author', cap);
}

export function appendCardHome(
  ledger: ImpactLedgerEntry[],
  minute: number,
  playerId: string,
  yellow: boolean,
  captainId: string | undefined,
): void {
  const raw = yellow ? INDIV.yellow : INDIV.red;
  const cap = captainId === playerId;
  const factor = cap ? captainAmplifyIndividualFactor(raw) : raw;
  appendEntry(ledger, minute, playerId, factor, yellow ? 'card_yellow' : 'card_red', cap);
}

/** Produto Π fator para um jogador; usa soma de log. */
export function productFactorForPlayer(ledger: ImpactLedgerEntry[] | undefined, playerId: string): number {
  const L = ledger ?? [];
  let logSum = 0;
  for (const e of L) {
    if (e.playerId !== playerId) continue;
    if (e.factor > 0 && Number.isFinite(e.factor)) logSum += Math.log(e.factor);
  }
  return Math.exp(logSum);
}

export function homeImpactBase(
  homeStats: Record<string, { passesOk: number; passesAttempt: number; tackles: number; km: number; rating: number }>,
  playerId: string,
): number {
  const s = homeStats[playerId];
  const rating = s?.rating ?? 6.4;
  const tackles = s?.tackles ?? 0;
  const passesOk = s?.passesOk ?? 0;
  const km = s?.km ?? 0;
  return rating + tackles * 0.15 + passesOk * 0.02 + km * 0.04;
}

export function finalImpactFromBaseAndProduct(
  base: number,
  product: number,
  cleanSheetMult: number,
): number {
  const combined = base * product * cleanSheetMult;
  const floor = base * IMPACT_FACTOR_FLOOR;
  return Math.max(floor, combined);
}

export function cleanSheetMultiplierForPlayer(
  phase: string,
  awayScore: number,
  p: PitchPlayerState,
): number {
  if (phase !== 'postgame') return 1;
  if (awayScore > 0) return 1;
  return qualifiesCleanSheetPlayer(p) ? CLEAN_SHEET_MULT : 1;
}

export interface HomeImpactRow {
  playerId: string;
  impact: number;
  pinLast: boolean;
}

export function computeHomeImpactsFromLedger(
  pitch: PitchPlayerState[],
  homeStats: Record<string, { passesOk: number; passesAttempt: number; tackles: number; km: number; rating: number }>,
  ledger: ImpactLedgerEntry[] | undefined,
  phase: string,
  awayScore: number,
  eventsChrono: MatchEventEntry[],
): HomeImpactRow[] {
  const rows = pitch.map((p) => {
    const base = homeImpactBase(homeStats, p.playerId);
    const prod = productFactorForPlayer(ledger, p.playerId);
    const cs = cleanSheetMultiplierForPlayer(phase, awayScore, p);
    const pinLast = eventsChrono.some((e) => e.kind === 'red_home' && e.playerId === p.playerId);
    return {
      playerId: p.playerId,
      impact: finalImpactFromBaseAndProduct(base, prod, cs),
      pinLast,
    };
  });
  rows.sort((a, b) => {
    if (a.pinLast !== b.pinLast) return a.pinLast ? 1 : -1;
    return b.impact - a.impact;
  });
  return rows;
}

export interface QuickAwayPlayer {
  id: string;
  num: number;
  name: string;
  pos: string;
}

function isAwayGk(p: QuickAwayPlayer): boolean {
  return p.pos === 'GOL';
}

function awayRoleForCleanSheet(p: QuickAwayPlayer): 'gk' | 'def' | 'mid' {
  if (p.pos === 'GOL') return 'gk';
  if (['ZAG', 'LE', 'LD'].includes(p.pos)) return 'def';
  return 'mid';
}

/** Ledger sintético visitante a partir do histórico de eventos (determinístico). */
export function buildAwayVirtualLedger(
  roster: QuickAwayPlayer[],
  eventsChrono: MatchEventEntry[],
  homeScore: number,
  awayScore: number,
): ImpactLedgerEntry[] {
  const ledger: ImpactLedgerEntry[] = [];
  const goalsAway = eventsChrono.filter((e) => e.kind === 'goal_away');
  const goalsHome = eventsChrono.filter((e) => e.kind === 'goal_home');

  for (const ev of goalsAway) {
    for (const p of roster) {
      appendEntry(ledger, ev.minute, p.id, TEAM_GOAL_SCORED, 'team_goal_scored', false);
    }
    const i = idxFromSeed(ev.id + String(ev.minute), roster.length);
    appendEntry(ledger, ev.minute, roster[i]!.id, INDIV.goalAuthor, 'goal_author', false);
  }
  for (const ev of goalsHome) {
    for (const p of roster) {
      const f = isAwayGk(p) ? TEAM_GOAL_CONCEDED_GK_POLICY_B : TEAM_GOAL_CONCEDED_FIELD;
      appendEntry(ledger, ev.minute, p.id, f, 'team_goal_conceded', false);
    }
  }

  for (let k = goalsAway.length; k < awayScore; k++) {
    for (const p of roster) {
      appendEntry(ledger, 90, p.id, TEAM_GOAL_SCORED, 'team_goal_scored_sync', false);
    }
  }
  for (let k = goalsHome.length; k < homeScore; k++) {
    for (const p of roster) {
      const f = isAwayGk(p) ? TEAM_GOAL_CONCEDED_GK_POLICY_B : TEAM_GOAL_CONCEDED_FIELD;
      appendEntry(ledger, 90, p.id, f, 'team_goal_conceded_sync', false);
    }
  }

  const defIds = roster.filter((p) => ['GOL', 'ZAG', 'LE', 'LD'].includes(p.pos)).map((p) => p.id);
  for (const ev of eventsChrono) {
    if (ev.kind === 'goal_home' && defIds.length) {
      const id = defIds[idxFromSeed(ev.id, defIds.length)]!;
      appendEntry(ledger, ev.minute, id, 1.02, 'def_reaction', false);
    }
    if (
      ev.kind === 'yellow_home' ||
      ev.kind === 'red_home' ||
      ev.kind === 'injury_home' ||
      ev.kind === 'goal_away' ||
      ev.kind === 'goal_home' ||
      ev.kind === 'whistle' ||
      ev.kind === 'sub'
    ) {
      continue;
    }
    const i = idxFromSeed(ev.id, roster.length);
    appendEntry(ledger, ev.minute, roster[i]!.id, 1.007, 'narrative_bump', false);
  }

  return ledger;
}

export function computeAwayImpactsFromVirtualLedger(
  roster: QuickAwayPlayer[],
  eventsChrono: MatchEventEntry[],
  homeScore: number,
  awayScore: number,
  phase: string,
): { id: string; impact: number }[] {
  const virtual = buildAwayVirtualLedger(roster, eventsChrono, homeScore, awayScore);

  return roster
    .map((p) => {
      const base = 5.55 + (Math.abs(hashStringSeed(p.id)) % 45) / 100;
      const prod = productFactorForPlayer(virtual, p.id);
      const pseudo: PitchPlayerState = {
        playerId: p.id,
        slotId: '',
        name: p.name,
        num: p.num,
        pos: p.pos,
        x: 0,
        y: 0,
        fatigue: 0,
        role: awayRoleForCleanSheet(p) === 'gk' ? 'gk' : awayRoleForCleanSheet(p) === 'def' ? 'def' : 'mid',
      };
      const cs =
        phase === 'postgame' && homeScore === 0 && qualifiesCleanSheetPlayer(pseudo) ? CLEAN_SHEET_MULT : 1;
      return { id: p.id, impact: finalImpactFromBaseAndProduct(base, prod, cs) };
    })
    .sort((a, b) => b.impact - a.impact);
}
