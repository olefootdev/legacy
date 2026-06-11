/**
 * Scout — régua de pontos compartilhada (quick-match-revolution.md §9, Fase 1).
 *
 * REUSA `src/gamespirit/scoutScoring.ts` (SCOUT_POINTS estilo Cartola, tallies,
 * MVP) — que hoje só pontua o time da CASA, ao vivo, dentro do runMatchMinute.
 * Este módulo fecha o gap: converte a lista FINAL de `MatchEventEntry` de
 * qualquer partida resolvida (quick/auto/turbo) em pontos por jogador dos DOIS
 * lados, deterministicamente (sem crítico). É a régua comum que alimenta
 * narração (quem marcou), tabela do turbo (artilheiros) e standings de liga.
 *
 * Capitão ×2 (doc §9): o total do capitão é dobrado, estilo Cartola.
 */

import type { MatchEventEntry } from '@/engine/types';
import {
  applyScoutEvent,
  SCOUT_POINTS,
  type ScoutTally,
} from '@/gamespirit/scoutScoring';

export const SCOUT_CAPTAIN_MULT = 2;

export interface ScoutRosterPlayer {
  id: string;
  name: string;
  pos: string;
}

export interface ComputeScoutInput {
  /** Eventos finais da partida (qualquer ordem; o módulo ordena por minuto). */
  events: MatchEventEntry[];
  homeRoster: ScoutRosterPlayer[];
  awayRoster: ScoutRosterPlayer[];
  homeCaptainId?: string;
  awayCaptainId?: string;
  homeScore: number;
  awayScore: number;
}

export interface ScoutBoardRow {
  playerId: string;
  name: string;
  pos: string;
  side: 'home' | 'away';
  /** Pontos finais (capitão já ×2). */
  points: number;
  goals: number;
  isCaptain: boolean;
  hasCleanSheet: boolean;
}

export interface MatchScoutBoard {
  home: ScoutBoardRow[];
  away: ScoutBoardRow[];
  /** Maior pontuador da partida (régua do "craque da rodada"). */
  topScorer: ScoutBoardRow | null;
}

const DEFENSIVE_POS = new Set(['GK', 'GOL', 'ZAG', 'ZAGUEIRO', 'CB', 'SW', 'WB', 'LE', 'LD', 'LB', 'RB']);

function isGk(pos: string): boolean {
  const p = pos.toUpperCase();
  return p === 'GK' || p === 'GOL';
}

function rosterById(roster: ScoutRosterPlayer[]): Map<string, ScoutRosterPlayer> {
  return new Map(roster.map((p) => [p.id, p]));
}

/**
 * Converte os eventos resolvidos de uma partida em pontos de scout por jogador
 * dos dois times. Determinístico: rng fixo em 1 → nunca rola crítico (crítico é
 * tempero do tally AO VIVO da casa; a régua compartilhada precisa ser estável
 * pra ranking/standings).
 */
export function computeScoutFromEvents(input: ComputeScoutInput): MatchScoutBoard {
  const homeById = rosterById(input.homeRoster);
  const awayById = rosterById(input.awayRoster);
  const homeTallies: Record<string, ScoutTally> = {};
  const awayTallies: Record<string, ScoutTally> = {};

  // Ordena cronologicamente pra rastrear o placar corrente (gol decisivo).
  const chrono = [...input.events].sort((a, b) => a.minute - b.minute);
  let h = 0;
  let a = 0;

  for (const ev of chrono) {
    switch (ev.kind) {
      case 'goal_home': {
        const pl = ev.playerId ? homeById.get(ev.playerId) : undefined;
        const decisive = ev.minute >= 70 && Math.abs(h - a) <= 1;
        h++;
        if (pl) {
          applyScoutEvent({
            tallies: homeTallies, playerId: pl.id, name: pl.name, pos: pl.pos,
            kind: 'goal', minute: ev.minute, rng: 1,
            context: { homeScore: h, awayScore: a, isDecisiveGoal: decisive },
          });
        }
        const gk = input.awayRoster.find((p) => isGk(p.pos));
        if (gk) {
          applyScoutEvent({
            tallies: awayTallies, playerId: gk.id, name: gk.name, pos: gk.pos,
            kind: 'goalConceded', minute: ev.minute, rng: 1,
          });
        }
        break;
      }
      case 'goal_away': {
        const pl = ev.playerId ? awayById.get(ev.playerId) : undefined;
        const decisive = ev.minute >= 70 && Math.abs(h - a) <= 1;
        a++;
        if (pl) {
          applyScoutEvent({
            tallies: awayTallies, playerId: pl.id, name: pl.name, pos: pl.pos,
            kind: 'goal', minute: ev.minute, rng: 1,
            context: { homeScore: h, awayScore: a, isDecisiveGoal: decisive },
          });
        }
        const gk = input.homeRoster.find((p) => isGk(p.pos));
        if (gk) {
          applyScoutEvent({
            tallies: homeTallies, playerId: gk.id, name: gk.name, pos: gk.pos,
            kind: 'goalConceded', minute: ev.minute, rng: 1,
          });
        }
        break;
      }
      case 'yellow_home':
      case 'yellow_away':
      case 'red_home':
      case 'red_away': {
        const side = ev.kind.endsWith('_home') ? 'home' : 'away';
        const byId = side === 'home' ? homeById : awayById;
        const tallies = side === 'home' ? homeTallies : awayTallies;
        const pl = ev.playerId ? byId.get(ev.playerId) : undefined;
        if (pl) {
          applyScoutEvent({
            tallies, playerId: pl.id, name: pl.name, pos: pl.pos,
            kind: ev.kind.startsWith('yellow') ? 'yellowCard' : 'redCard',
            minute: ev.minute, rng: 1,
          });
        }
        break;
      }
      case 'shot_home':
      case 'shot_away': {
        // Sem desfecho no evento → pontua como chute pra fora (piso positivo).
        const side = ev.kind === 'shot_home' ? 'home' : 'away';
        const byId = side === 'home' ? homeById : awayById;
        const tallies = side === 'home' ? homeTallies : awayTallies;
        const pl = ev.playerId ? byId.get(ev.playerId) : undefined;
        if (pl) {
          applyScoutEvent({
            tallies, playerId: pl.id, name: pl.name, pos: pl.pos,
            kind: 'shotWide', minute: ev.minute, rng: 1,
          });
        }
        break;
      }
      default:
        // narrative / whistle / sub / penalty_* / injury: sem pontuação direta.
        break;
    }
  }

  // Clean sheet (mesma regra do finalizeScoutTallies, aplicada aos dois lados).
  applyCleanSheet(homeTallies, input.homeRoster, input.awayScore === 0);
  applyCleanSheet(awayTallies, input.awayRoster, input.homeScore === 0);

  const home = boardRows(homeTallies, 'home', input.homeCaptainId);
  const away = boardRows(awayTallies, 'away', input.awayCaptainId);
  const all = [...home, ...away].sort((x, y) => y.points - x.points);

  return { home, away, topScorer: all[0] ?? null };
}

function applyCleanSheet(
  tallies: Record<string, ScoutTally>,
  roster: ScoutRosterPlayer[],
  cleanSheet: boolean,
): void {
  if (!cleanSheet) return;
  for (const p of roster) {
    if (!DEFENSIVE_POS.has(p.pos.toUpperCase())) continue;
    if (!tallies[p.id]) {
      tallies[p.id] = {
        playerId: p.id, name: p.name, pos: p.pos,
        totalPoints: 0, events: [], goals: 0, assists: 0,
        difficultSaves: 0, tackles: 0, penaltiesSaved: 0, hasCleanSheet: false,
      };
    }
    const t = tallies[p.id]!;
    t.totalPoints += SCOUT_POINTS.cleanSheet;
    t.hasCleanSheet = true;
    t.events.push({ kind: 'cleanSheet', minute: 90, points: SCOUT_POINTS.cleanSheet, wasCrit: false, contextMult: 1 });
  }
}

function boardRows(
  tallies: Record<string, ScoutTally>,
  side: 'home' | 'away',
  captainId: string | undefined,
): ScoutBoardRow[] {
  return Object.values(tallies)
    .map((t) => {
      const isCaptain = !!captainId && t.playerId === captainId;
      const points = t.totalPoints * (isCaptain ? SCOUT_CAPTAIN_MULT : 1);
      return {
        playerId: t.playerId,
        name: t.name,
        pos: t.pos,
        side,
        points: parseFloat(points.toFixed(2)),
        goals: t.goals,
        isCaptain,
        hasCleanSheet: t.hasCleanSheet,
      };
    })
    .sort((x, y) => y.points - x.points);
}

/**
 * Ponte com o tally AO VIVO da casa (snapshot.scoutTallies, já populado pelo
 * runMatchMinute): aplica capitão ×2 e devolve linhas no mesmo formato do
 * board — pro consumidor (UI/turbo/liga) não precisar conhecer os dois mundos.
 */
export function scoutBoardFromLiveTallies(
  tallies: Record<string, ScoutTally> | undefined,
  captainId: string | undefined,
): ScoutBoardRow[] {
  if (!tallies) return [];
  return boardRows(tallies, 'home', captainId);
}
