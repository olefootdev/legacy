import type { ClubEntity } from '@/entities/types';
import type { AdminLeagueConfig, KnockoutPair, LeagueStandingRow } from '@/match/adminLeagues';
import { rowMatchingClub } from '@/match/adminLeagues';
import { OFFICIAL_MATCH_SLOT_TIMES, officialSlotTimeAt, type OfficialSlotIndex } from '@/match/squadEligibility';

export type ScheduledFixtureStatus = 'scheduled' | 'finished' | 'walkover';

export interface ScheduledLeagueFixture {
  id: string;
  leagueId: string;
  matchdayIndex: number;
  dateIso: string;
  slotIndex: OfficialSlotIndex;
  kickoffHHmm: string;
  homeTeamId: string;
  awayTeamId: string;
  homeName: string;
  awayName: string;
  status: ScheduledFixtureStatus;
  scoreHome?: number;
  scoreAway?: number;
  walkoverWinner?: 'home' | 'away';
  walkoverNote?: string;
  resolvedAtMs?: number;
}

export interface LeagueScheduleBucket {
  fixtures: ScheduledLeagueFixture[];
  updatedAtIso: string;
}

export interface LeagueScheduleState {
  /** Por liga (round-robin); outras fórmulas podem ficar vazias. */
  byLeagueId: Record<string, LeagueScheduleBucket>;
}

export function createEmptyLeagueScheduleState(): LeagueScheduleState {
  return { byLeagueId: {} };
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Round-robin (cada ronda = até 7 jogos/dia nos horários oficiais; rondas grandes partem em vários dias). */
export function roundRobinRounds(teams: LeagueStandingRow[]): KnockoutPair[][] {
  /** Ordem do ficheiro da liga (não ordenar por pontos — senão o calendário “mexe” na tabela). */
  const t = [...teams].filter((row) => row.name && !row.name.startsWith('—'));
  if (t.length < 2) return [];
  const pool = [...t];
  if (pool.length % 2 === 1) {
    pool.push({
      teamId: '__bye__',
      name: '— Livre —',
      played: 0,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    });
  }
  const n = pool.length;
  const rounds: KnockoutPair[][] = [];
  const arr = [...pool];
  for (let r = 0; r < n - 1; r++) {
    const pairs: KnockoutPair[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i]!;
      const b = arr[n - 1 - i]!;
      if (a.teamId !== '__bye__' && b.teamId !== '__bye__') {
        pairs.push({
          homeTeamId: a.teamId,
          awayTeamId: b.teamId,
          homeName: a.name,
          awayName: b.name,
        });
      }
    }
    rounds.push(pairs);
    const fixed = arr[0]!;
    const rest = arr.slice(1);
    const last = rest.pop();
    if (last) rest.unshift(last);
    arr.splice(0, n, fixed, ...rest);
  }
  return rounds;
}

const MAX_OFFICIAL_MATCHES_PER_DAY = 7;

function chunkPairs(pairs: KnockoutPair[], size: number): KnockoutPair[][] {
  const out: KnockoutPair[][] = [];
  for (let i = 0; i < pairs.length; i += size) {
    out.push(pairs.slice(i, i + size));
  }
  return out;
}

let fixtureSeq = 0;
function nextFixtureId(): string {
  fixtureSeq += 1;
  return `fx_${Date.now().toString(36)}_${fixtureSeq.toString(36)}`;
}

/**
 * Gera calendário entre startDate e endDate (avança dia a dia por cada bloco de até 7 jogos).
 */
export function buildRoundRobinSchedule(
  league: AdminLeagueConfig,
  club: ClubEntity,
): LeagueScheduleBucket {
  const start = league.startDate?.trim();
  const end = league.endDate?.trim();
  if (!start || !end || league.format !== 'round_robin') {
    return { fixtures: [], updatedAtIso: new Date().toISOString() };
  }

  const rounds = roundRobinRounds(league.standings);
  const fixtures: ScheduledLeagueFixture[] = [];
  let cursorDate = start;
  let matchdayIndex = 0;

  const endMs = new Date(`${end}T23:59:59`).getTime();

  for (const round of rounds) {
    const dayChunks = chunkPairs(round, MAX_OFFICIAL_MATCHES_PER_DAY);
    for (const chunk of dayChunks) {
      if (new Date(`${cursorDate}T12:00:00`).getTime() > endMs) break;
      chunk.forEach((pair, i) => {
        const slotIndex = Math.min(i, OFFICIAL_MATCH_SLOT_TIMES.length - 1) as OfficialSlotIndex;
        fixtures.push({
          id: nextFixtureId(),
          leagueId: league.id,
          matchdayIndex,
          dateIso: cursorDate,
          slotIndex,
          kickoffHHmm: officialSlotTimeAt(slotIndex),
          homeTeamId: pair.homeTeamId,
          awayTeamId: pair.awayTeamId,
          homeName: pair.homeName,
          awayName: pair.awayName,
          status: 'scheduled',
        });
      });
      matchdayIndex += 1;
      cursorDate = addDaysIso(cursorDate, 1);
    }
  }

  return { fixtures, updatedAtIso: new Date().toISOString() };
}

export function userTeamIdForLeague(league: AdminLeagueConfig, club: ClubEntity): string | undefined {
  return rowMatchingClub(league.standings, club.name, club.shortName)?.teamId;
}

export function fixtureInvolvesUser(fx: ScheduledLeagueFixture, userTeamId: string | undefined): boolean {
  if (!userTeamId) return false;
  return fx.homeTeamId === userTeamId || fx.awayTeamId === userTeamId;
}

export function userIsHomeInFixture(fx: ScheduledLeagueFixture, userTeamId: string | undefined): boolean {
  return Boolean(userTeamId && fx.homeTeamId === userTeamId);
}

/** Ordenação cronológica (data + slot). */
export function fixtureKickoffMs(fx: ScheduledLeagueFixture): number {
  const [hh, mm] = fx.kickoffHHmm.split(':').map(Number);
  const d = new Date(`${fx.dateIso}T00:00:00`);
  d.setHours(hh ?? 12, mm ?? 0, 0, 0);
  return d.getTime();
}

export function nextUserScheduledFixture(
  bucket: LeagueScheduleBucket | undefined,
  userTeamId: string | undefined,
  nowMs: number,
): ScheduledLeagueFixture | undefined {
  if (!bucket?.fixtures.length || !userTeamId) return undefined;
  return bucket.fixtures
    .filter((f) => f.status === 'scheduled' && fixtureInvolvesUser(f, userTeamId))
    .sort((a, b) => fixtureKickoffMs(a) - fixtureKickoffMs(b))
    .find((f) => fixtureKickoffMs(f) > nowMs);
}
