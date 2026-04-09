import type { FormLetter } from '@/entities/types';

/** Linha da classificação (persistida; a UI ordena por pontos/SG). */
export interface LeagueStandingRow {
  teamId: string;
  name: string;
  played: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

export type LeagueFormat = 'round_robin' | 'knockout' | 'hybrid';

export const KNOCKOUT_BRACKET_SIZES = [8, 16, 32, 64, 128, 256] as const;
export type KnockoutBracketSize = (typeof KNOCKOUT_BRACKET_SIZES)[number];

export interface KnockoutPair {
  homeTeamId: string;
  awayTeamId: string;
  homeName: string;
  awayName: string;
}

export interface KnockoutRound {
  name: string;
  pairs: KnockoutPair[];
}

export interface AdminLeagueConfig {
  id: string;
  name: string;
  division: string;
  /** Se true, a linha do clube do jogador recebe jogos/pontos/GF/GA de `leagueSeason`. */
  syncStatsFromSeason: boolean;
  /** Forma exibida no cartão da competição (W/D/L). */
  form: FormLetter[];
  standings: LeagueStandingRow[];

  /** Formato da competição (default: pontos corridos). */
  format: LeagueFormat;
  /** Datas ISO `YYYY-MM-DD` (input type=date). */
  startDate: string;
  endDate: string;
  /** Texto livre: prémios, OLE, troféu, etc. */
  prizeSummary: string;
  /** Híbrido: fim da fase de qualificação (tabela). */
  hybridQualificationEndDate?: string;
  /** Início agendado do mata-mata (híbrido ou só KO). */
  knockoutStartDate?: string;
  /** Tamanho do quadro eliminatório (8…256). */
  knockoutBracketSize?: KnockoutBracketSize;
  /** Chaveamento após sorteio + placeholders das rondas seguintes. */
  knockoutRounds?: KnockoutRound[];
}

export const LEAGUE_FORMAT_LABELS: Record<LeagueFormat, string> = {
  round_robin: 'Pontos corridos',
  knockout: 'Mata-mata',
  hybrid: 'Híbrida (tabela + mata-mata)',
};

export function goalDiff(row: LeagueStandingRow): number {
  return row.goalsFor - row.goalsAgainst;
}

/** Ordenação tipo tabela: pontos, saldo, golos marcados. */
export function sortStandings(rows: LeagueStandingRow[]): LeagueStandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const d = goalDiff(b) - goalDiff(a);
    if (d !== 0) return d;
    return b.goalsFor - a.goalsFor;
  });
}

export function positionOfClub(sorted: LeagueStandingRow[], clubName: string, clubShort: string): number {
  const u = clubName.trim().toUpperCase();
  const s = clubShort.trim().toUpperCase();
  const idx = sorted.findIndex(
    (r) =>
      r.name.trim().toUpperCase() === u ||
      r.name.trim().toUpperCase() === s ||
      r.name.includes(clubShort) ||
      (clubName.length > 0 && r.name.includes(clubName)),
  );
  return idx < 0 ? Math.min(3, sorted.length) : idx + 1;
}

export function rowMatchingClub(
  rows: LeagueStandingRow[],
  clubName: string,
  clubShort: string,
): LeagueStandingRow | undefined {
  const u = clubName.trim().toUpperCase();
  const s = clubShort.trim().toUpperCase();
  return rows.find(
    (r) =>
      r.name.trim().toUpperCase() === u ||
      r.name.trim().toUpperCase() === s ||
      r.name.trim().toUpperCase().includes(s) ||
      (u.length > 0 && r.name.toUpperCase().includes(u)),
  );
}

/** Nome da ronda eliminatória pelo nº de jogos nessa ronda. */
function eliminationRoundLabel(matchCount: number): string {
  if (matchCount === 1) return 'Final';
  if (matchCount === 2) return 'Meias-finais';
  if (matchCount === 4) return 'Quartos de final';
  if (matchCount === 8) return 'Oitavas de final';
  if (matchCount === 16) return 'Ronda de 32';
  if (matchCount === 32) return 'Ronda de 64';
  if (matchCount === 64) return 'Ronda de 128';
  if (matchCount >= 128) return 'Ronda inicial';
  return `${matchCount} jogos`;
}

/**
 * Sorteia o 1.º escalão a partir da ordem atual da tabela (ou lista).
 * Completa com linhas “— Livre —” até `bracketSize` equipas.
 * Gera todas as rondas com placeholders (Vencedor jogo n) a partir da 2.ª.
 */
export function generateKnockoutRounds(
  standingsOrdered: LeagueStandingRow[],
  bracketSize: KnockoutBracketSize,
): KnockoutRound[] {
  const slots: LeagueStandingRow[] = standingsOrdered.slice(0, bracketSize).map((r) => ({ ...r }));
  let byeIdx = 0;
  while (slots.length < bracketSize) {
    slots.push({
      teamId: `bye_${byeIdx++}`,
      name: '— Livre —',
      played: 0,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    });
  }
  const shuffled = [...slots].sort(() => Math.random() - 0.5);

  const rounds: KnockoutRound[] = [];
  const firstPairs: KnockoutPair[] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    const a = shuffled[i]!;
    const b = shuffled[i + 1]!;
    firstPairs.push({
      homeTeamId: a.teamId,
      awayTeamId: b.teamId,
      homeName: a.name,
      awayName: b.name,
    });
  }

  rounds.push({
    name: eliminationRoundLabel(firstPairs.length),
    pairs: firstPairs,
  });

  let matchCount = firstPairs.length;
  let roundIndex = 1;
  while (matchCount > 1) {
    matchCount /= 2;
    const pairs: KnockoutPair[] = [];
    for (let j = 0; j < matchCount; j++) {
      const left = j * 2 + 1;
      const right = j * 2 + 2;
      pairs.push({
        homeTeamId: '',
        awayTeamId: '',
        homeName: `Vencedor jogo ${left}`,
        awayName: `Vencedor jogo ${right}`,
      });
    }
    rounds.push({
      name: eliminationRoundLabel(matchCount),
      pairs,
    });
    roundIndex++;
  }

  return rounds;
}

export function createDefaultAdminLeagues(): AdminLeagueConfig[] {
  const oleSerieA: AdminLeagueConfig = {
    id: 'lg_ole_serie_a',
    name: 'Liga OLE — Série A',
    division: '1ª Divisão',
    syncStatsFromSeason: true,
    form: ['W', 'W', 'D', 'W'],
    format: 'round_robin',
    startDate: '2026-01-01',
    endDate: '2026-06-30',
    prizeSummary: 'Título nacional + vaga continental.',
    standings: [
      { teamId: 't1', name: 'TITANS FC', played: 6, points: 12, goalsFor: 14, goalsAgainst: 6 },
      { teamId: 't2', name: 'SPARTANS', played: 6, points: 11, goalsFor: 12, goalsAgainst: 6 },
      { teamId: 't3', name: 'OLE FC', played: 4, points: 10, goalsFor: 10, goalsAgainst: 5 },
      { teamId: 't4', name: 'DRAGONS', played: 6, points: 8, goalsFor: 9, goalsAgainst: 7 },
      { teamId: 't5', name: 'WOLVES', played: 6, points: 7, goalsFor: 8, goalsAgainst: 7 },
      { teamId: 't6', name: 'PHOENIX', played: 6, points: 6, goalsFor: 7, goalsAgainst: 8 },
    ],
  };

  const copaStandings: LeagueStandingRow[] = [
    { teamId: 'c1', name: 'OLE FC', played: 2, points: 6, goalsFor: 5, goalsAgainst: 1 },
    { teamId: 'c2', name: 'RIVER NORTH', played: 2, points: 3, goalsFor: 2, goalsAgainst: 3 },
    { teamId: 'c3', name: 'STEEL CITY', played: 2, points: 0, goalsFor: 1, goalsAgainst: 4 },
    { teamId: 'c4', name: 'COAST UNITED', played: 2, points: 3, goalsFor: 3, goalsAgainst: 3 },
  ];

  const copaSorted = sortStandings(copaStandings);
  const copaNeo: AdminLeagueConfig = {
    id: 'lg_copa_neo',
    name: 'Copa Neo Arena',
    division: 'Mata-mata',
    syncStatsFromSeason: false,
    form: ['W', 'W'],
    format: 'knockout',
    startDate: '2026-03-01',
    endDate: '2026-05-15',
    prizeSummary: 'Taça + 500 EXP ao campeão (sintético).',
    knockoutBracketSize: 8,
    standings: copaStandings,
    knockoutRounds: [
      {
        name: 'Quartos de final',
        pairs: [
          { homeTeamId: 'c1', awayTeamId: 'bye_0', homeName: copaSorted[0]!.name, awayName: '— Livre —' },
          { homeTeamId: 'c2', awayTeamId: 'bye_1', homeName: copaSorted[1]!.name, awayName: '— Livre —' },
          { homeTeamId: 'c3', awayTeamId: 'bye_2', homeName: copaSorted[2]!.name, awayName: '— Livre —' },
          { homeTeamId: 'c4', awayTeamId: 'bye_3', homeName: copaSorted[3]!.name, awayName: '— Livre —' },
        ],
      },
      {
        name: 'Meias-finais',
        pairs: [
          { homeTeamId: '', awayTeamId: '', homeName: 'Vencedor jogo 1', awayName: 'Vencedor jogo 2' },
          { homeTeamId: '', awayTeamId: '', homeName: 'Vencedor jogo 3', awayName: 'Vencedor jogo 4' },
        ],
      },
      {
        name: 'Final',
        pairs: [{ homeTeamId: '', awayTeamId: '', homeName: 'Vencedor jogo 1', awayName: 'Vencedor jogo 2' }],
      },
    ],
  };

  return [oleSerieA, copaNeo];
}

export function newLeagueId(): string {
  return `lg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function newTeamId(): string {
  return `tm_${Math.random().toString(36).slice(2, 10)}`;
}

function parseFormat(x: unknown): LeagueFormat {
  if (x === 'knockout' || x === 'hybrid' || x === 'round_robin') return x;
  return 'round_robin';
}

function parseBracketSize(x: unknown): KnockoutBracketSize | undefined {
  const n = Number(x);
  return KNOCKOUT_BRACKET_SIZES.includes(n as KnockoutBracketSize) ? (n as KnockoutBracketSize) : undefined;
}

/** Garante objeto completo após import / save antigo. */
export function normalizeAdminLeague(r: Partial<AdminLeagueConfig> & { id: string }): AdminLeagueConfig {
  const standingsRaw = r.standings;
  const standings: LeagueStandingRow[] = Array.isArray(standingsRaw)
    ? standingsRaw.map((row) => {
        const x = row as Partial<LeagueStandingRow>;
        return {
          teamId: typeof x.teamId === 'string' ? x.teamId : newTeamId(),
          name: typeof x.name === 'string' ? x.name : '?',
          played: Number(x.played) || 0,
          points: Number(x.points) || 0,
          goalsFor: Number(x.goalsFor) || 0,
          goalsAgainst: Number(x.goalsAgainst) || 0,
        };
      })
    : [];
  const formRaw = r.form;
  const form: FormLetter[] = Array.isArray(formRaw)
    ? (formRaw.filter((x) => x === 'W' || x === 'D' || x === 'L') as FormLetter[])
    : [];

  const format = parseFormat(r.format);
  const knockoutBracketSize = parseBracketSize(r.knockoutBracketSize);

  let knockoutRounds = r.knockoutRounds;
  if (Array.isArray(knockoutRounds)) {
    knockoutRounds = knockoutRounds.map((round) => {
      const rr = round as Partial<KnockoutRound>;
      const pairsRaw = rr.pairs;
      const pairs: KnockoutPair[] = Array.isArray(pairsRaw)
        ? pairsRaw.map((p) => {
            const q = p as Partial<KnockoutPair>;
            return {
              homeTeamId: typeof q.homeTeamId === 'string' ? q.homeTeamId : '',
              awayTeamId: typeof q.awayTeamId === 'string' ? q.awayTeamId : '',
              homeName: typeof q.homeName === 'string' ? q.homeName : '?',
              awayName: typeof q.awayName === 'string' ? q.awayName : '?',
            };
          })
        : [];
      return { name: typeof rr.name === 'string' ? rr.name : 'Ronda', pairs };
    });
  } else {
    knockoutRounds = undefined;
  }

  return {
    id: r.id,
    name: typeof r.name === 'string' ? r.name : 'Sem nome',
    division: typeof r.division === 'string' ? r.division : '—',
    syncStatsFromSeason: Boolean(r.syncStatsFromSeason),
    form,
    standings,
    format,
    startDate: typeof r.startDate === 'string' ? r.startDate : '',
    endDate: typeof r.endDate === 'string' ? r.endDate : '',
    prizeSummary: typeof r.prizeSummary === 'string' ? r.prizeSummary : '',
    hybridQualificationEndDate:
      typeof r.hybridQualificationEndDate === 'string' ? r.hybridQualificationEndDate : undefined,
    knockoutStartDate: typeof r.knockoutStartDate === 'string' ? r.knockoutStartDate : undefined,
    knockoutBracketSize,
    knockoutRounds,
  };
}

/** Hidrata saves antigos sem `adminLeagues`. */
export function hydrateAdminLeagues(raw: unknown, fallback: AdminLeagueConfig[]): AdminLeagueConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallback;
  return raw.map((item) => {
    const r = item as Partial<AdminLeagueConfig>;
    const id = typeof r.id === 'string' ? r.id : newLeagueId();
    return normalizeAdminLeague({ ...r, id });
  });
}
