// deno-lint-ignore-file no-explicit-any
// Olefoot — global-league-tick v7: competição longa (carry-over de pontos).
//
// Acionada pelo pg_cron a cada 1 min. Faz o ciclo completo da Liga Global
// sem depender do servidor Railway (autoritativa).
//
// Fluxo:
//   0. Fim da competição (passou competition_duration_days) → hard reset, novo competition_id
//   1. waiting_teams + ≥ min teams → gera playoff rounds (auto-start) — em slots
//   2. playoffs com todas rodadas 'finished' → distribui em divisões + gera league
//   3. active com todas rodadas 'finished' → SOFT promo/rele (carry-over) + nova season
//   4. Processa próxima rodada 'scheduled' que já passou do kickoff (dentro de slot)
//
// Etapas implementadas:
//   - all-time stats (não zeram nunca)
//   - slots fixos por dia (default ['05:30','11:00','15:00','19:00','21:30'])
//   - competição longa (default 7 dias) com carry-over entre seasons

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ROUND_INTERVAL_MS = 5 * 60 * 1000;
const SIM_DURATION_MS = 90_000;
const STALE_LIVE_ROUND_MS = 10 * 60 * 1000;
const NEW_ID = () => `gf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ── Notificações ao manager (best-effort, nunca quebra o motor) ─────────────
// Chama a RPC `notify_manager_by_email` que resolve auth.users.id internamente
// (manager_id é o email — TEXT — em global_league_teams).
async function notifyManager(
  supabase: any, email: string | null | undefined, category: string,
  title: string, message?: string, link?: string, payload?: Record<string, unknown>,
): Promise<void> {
  if (!email) return;
  try {
    await supabase.rpc('notify_manager_by_email', {
      p_email: email, p_category: category, p_title: title,
      p_message: message ?? null, p_link: link ?? null,
      p_payload: (payload ?? {}) as any,
    });
  } catch (err) {
    console.warn('[notify] failed', email, title, (err as Error).message);
  }
}

function dailyPhaseLabel(size: number): string {
  switch (size) {
    case 2: return 'Final';
    case 4: return 'Semifinal';
    case 8: return 'Quartas';
    case 16: return 'Oitavas';
    case 32: return 'Fase de 32';
    default: return `Fase de ${size}`;
  }
}

function slotStartMs(dayDate: Date, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(dayDate);
  d.setUTCHours(h, m, 0, 0);
  return d.getTime();
}

function nextSlotAlignedKickoff(fromMs: number, _slots: string[], _durationMin: number): number {
  // NONSTOP MODE: ignora slots e roda 5 em 5 minutos, sem pausa.
  // Para reativar slots horários, restaurar versão anterior desta função.
  return fromMs + ROUND_INTERVAL_MS;
}

// (Mantido para referência caso slots voltem)
function _legacySlotAlignedKickoff(fromMs: number, slots: string[], durationMin: number): number {
  if (!slots || slots.length === 0) {
    return Math.ceil((fromMs + 1000) / ROUND_INTERVAL_MS) * ROUND_INTERVAL_MS;
  }
  const durationMs = durationMin * 60_000;
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const day = new Date(fromMs);
    day.setUTCDate(day.getUTCDate() + dayOffset);
    day.setUTCHours(0, 0, 0, 0);
    const sortedSlots = [...slots].sort();
    for (const slot of sortedSlots) {
      const start = slotStartMs(day, slot);
      const end = start + durationMs;
      if (fromMs >= end) continue;
      const candidate = Math.max(fromMs, start);
      const aligned = Math.ceil((candidate + 1000) / ROUND_INTERVAL_MS) * ROUND_INTERVAL_MS;
      if (aligned < end) return aligned;
    }
  }
  return fromMs + ROUND_INTERVAL_MS;
}

function utcDateString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// ── Ciclo Híbrido (BRT) ────────────────────────────────────────────────────
// Liga roda 05:30 → 19:00. Daily KO 19:00 → ~21:30. REST 21:30 → 05:30.
// Em REST: zero processamento de rodada Liga; daily rollover, abertura de KO
// e progressão de KO ainda funcionam (preservam o ciclo da Coroa do Dia).
const CYCLE_ACTIVE_START_MIN_BRT = 5 * 60 + 30;   // 05:30
const CYCLE_REST_START_MIN_BRT = 21 * 60 + 30;    // 21:30

function brtMinutesOfDay(nowMs: number): number {
  const d = new Date(nowMs);
  // BRT é UTC-3, sem DST efetivo desde 2019.
  const totalUtcMin = d.getUTCHours() * 60 + d.getUTCMinutes();
  return (totalUtcMin - 180 + 1440) % 1440;
}

function isLeagueRestWindow(nowMs: number): boolean {
  const t = brtMinutesOfDay(nowMs);
  // REST: 21:30 ≤ t < 24:00  OU  0 ≤ t < 05:30
  return t >= CYCLE_REST_START_MIN_BRT || t < CYCLE_ACTIVE_START_MIN_BRT;
}

interface FixtureRow {
  id: string; round_id: string; division: string;
  home_team_id: string; away_team_id: string;
  home_team_name: string; away_team_name: string;
  home_overall: number; away_overall: number;
  score_home: number; score_away: number;
  current_minute?: number; status: string;
  kickoff_ms?: number | null; finished_at_ms?: number | null;
  wo_home?: boolean; wo_away?: boolean;
}
interface RoundRow {
  id: string; season_id: string;
  round_number: number; round_type: 'playoff' | 'league';
  phase?: string | null; status: string;
  scheduled_kickoff_ms: number;
  actual_kickoff_ms: number | null; finished_at_ms: number | null;
}
interface TeamRow {
  id: string; manager_id: string;
  club_name: string; club_short: string;
  overall: number; division: number | null;
  position: number | null; previous_position: number | null;
  playoff_points: number; playoff_matches_played: number;
  playoff_wins: number; playoff_draws: number; playoff_losses: number;
  playoff_goals_for: number; playoff_goals_against: number;
  points: number; matches_played: number;
  wins: number; draws: number; losses: number;
  goals_for: number; goals_against: number; goal_difference: number;
  recent_form: ('W' | 'D' | 'L')[];
  injury_modifier: number; injury_rounds_remaining: number;
  yellow_card_count: number; // acúmulo de amarelos — zera após suspensão
  suspension_rounds_remaining: number; // rodadas de suspensão pendentes
  available_player_count: number; // jogadores disponíveis (synced pelo cliente)
  available_player_count_updated_at?: string; // timestamp do último sync
  engagement_score?: number; // 0-100 — buff de engajamento do manager
  rivalry_encounters?: Record<string, number>; // teamId → nº de confrontos na temporada
  all_time_points?: number; all_time_matches_played?: number;
  all_time_wins?: number; all_time_draws?: number; all_time_losses?: number;
  all_time_goals_for?: number; all_time_goals_against?: number;
  all_time_seasons_played?: number;
  // Ciclo diário (Coroa do Dia)
  daily_points?: number; daily_matches_played?: number;
  daily_wins?: number; daily_draws?: number; daily_losses?: number;
  daily_goals_for?: number; daily_goals_against?: number; daily_goal_difference?: number;
  season_crowns?: number; all_time_crowns?: number;
}
interface StateRow {
  id: string; season_id: string; season_name: string;
  status: 'waiting_teams' | 'playoffs' | 'active' | 'season_ended';
  current_playoff_round: number | null; current_league_round: number | null;
  min_teams_required: number; teams_per_division: number;
  promotion_percentage: number; relegation_percentage: number;
  match_slots: string[];
  slot_duration_min: number;
  current_olefoot_day: string;
  competition_started_at: string;
  competition_duration_days: number;
  competition_id: string;
  // Ciclo diário (Coroa do Dia)
  daily_date?: string | null;
  daily_phase?: 'qualifying' | 'knockout' | 'crowned';
  daily_ko_season_id?: string | null;
  daily_ko_size?: number | null;
  daily_qualify_hour?: number;
  daily_ko_max_size?: number;
}

// Spread de prestígio por divisão: Div 1 = elite, Div 3 = base. Cria favoritos
// claros no mata-mata diário (que MISTURA divisões). Intra-divisão cancela
// (todos no mesmo nível) — a diferenciação dentro da divisão vem do overall real.
const DIVISION_OVR_SPREAD = 6; // Div1 +6, Div2 0, Div3 -6 (gap de 12 entre extremos)
function divisionOvrModifier(division: number | null | undefined): number {
  if (!division) return 0;
  return (2 - division) * DIVISION_OVR_SPREAD;
}
// Poder do Clube: evolução do TIME por mérito (all-time, persiste entre temporadas).
// Quem JOGA mais + VENCE mais fica mais forte — sem inflar o OVR dos jogadores
// (Genesis segue capado). Diferencia o veterano ativo do recém-chegado.
const CLUB_POWER_CAP = 12;
function clubPowerModifier(team: TeamRow): number {
  const fromMatches = Math.floor((team.all_time_matches_played ?? 0) / 150); // joga mais
  const fromWins = Math.floor((team.all_time_wins ?? 0) / 60);               // vence mais
  return Math.min(CLUB_POWER_CAP, fromMatches + fromWins);
}
function effectiveOverall(team: TeamRow): number {
  const suspMod = (team.suspension_rounds_remaining ?? 0) > 0 ? -5 : 0;
  const injMod = team.injury_rounds_remaining > 0 ? team.injury_modifier : 0;
  const base = Math.max(40, team.overall + injMod + suspMod + divisionOvrModifier(team.division) + clubPowerModifier(team));
  // Engagement buff: score 0-100 → +0 to +20 OVR
  const engBuff = Math.min(20, Math.floor((team.engagement_score ?? 0) / 5));
  return Math.round(base + engBuff);
}
function poissonGoals(expected: number): number {
  const L = Math.exp(-expected);
  let k = 0; let p = 1;
  do { k++; p *= Math.random(); } while (p > L && k < 8);
  return k - 1;
}

// ═══════════════════════════════════════════════════════════════════════════
// CICLO DIÁRIO — Mata-Mata + Coroa do Dia
// Espelho de server/src/services/globalLeague/dailyKnockout.ts (validado por
// `npm run test:daily-knockout`, 91 checks). Manter os dois em sincronia.
// ═══════════════════════════════════════════════════════════════════════════
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000; // horário de Brasília (UTC-3)
const KO_PHASE_INTERVAL_MS = 30 * 60 * 1000; // 30 min entre fases do mata-mata

function brtDayString(nowMs: number): string {
  return new Date(nowMs - BRT_OFFSET_MS).toISOString().slice(0, 10);
}
function brtHour(nowMs: number): number {
  return new Date(nowMs - BRT_OFFSET_MS).getUTCHours();
}
function isDayRollover(dailyDate: string | null | undefined, nowMs: number): boolean {
  return brtDayString(nowMs) !== (dailyDate ?? '');
}
function shouldOpenKnockout(phase: string, qualifyHour: number, nowMs: number): boolean {
  return phase === 'qualifying' && brtHour(nowMs) >= qualifyHour;
}
function largestPowerOfTwoAtMost(n: number): number {
  if (n < 2) return 0;
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}
function dailyBracketSize(qualifiersCount: number, maxSize: number): number {
  return largestPowerOfTwoAtMost(Math.min(qualifiersCount, maxSize));
}
function rankDailyTeams(teams: TeamRow[]): TeamRow[] {
  return [...teams].sort((a, b) => {
    const ap = a.daily_points ?? 0, bp = b.daily_points ?? 0;
    if (bp !== ap) return bp - ap;
    const ad = a.daily_goal_difference ?? 0, bd = b.daily_goal_difference ?? 0;
    if (bd !== ad) return bd - ad;
    const af = a.daily_goals_for ?? 0, bf = b.daily_goals_for ?? 0;
    if (bf !== af) return bf - af;
    if (b.overall !== a.overall) return b.overall - a.overall;
    return a.club_name.localeCompare(b.club_name);
  });
}
function selectDailyQualifiers(teams: TeamRow[], maxSize: number): { size: number; qualifiers: TeamRow[] } {
  const played = teams.filter((t) => (t.daily_matches_played ?? 0) > 0);
  const ranked = rankDailyTeams(played);
  const size = dailyBracketSize(ranked.length, maxSize);
  return { size, qualifiers: ranked.slice(0, size) };
}
function standardSeedOrder(n: number): number[] {
  if (n < 2) return n === 1 ? [1] : [];
  let seeds = [1, 2];
  while (seeds.length < n) {
    const sum = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const s of seeds) { next.push(s); next.push(sum - s); }
    seeds = next;
  }
  return seeds;
}
function pairAdjacent<T>(items: T[]): Array<[T, T]> {
  const pairs: Array<[T, T]> = [];
  for (let i = 0; i + 1 < items.length; i += 2) pairs.push([items[i], items[i + 1]]);
  return pairs;
}
function seedFirstRound<T>(rankedQualifiers: T[]): Array<[T, T]> {
  const order = standardSeedOrder(rankedQualifiers.length);
  const arranged = order.map((seed) => rankedQualifiers[seed - 1]);
  return pairAdjacent(arranged);
}
function roundNameFromSize(size: number): string {
  switch (size) {
    case 2: return 'Final';
    case 4: return 'Semifinal';
    case 8: return 'Quartas de final';
    case 16: return 'Oitavas de final';
    case 32: return 'Fase de 32';
    default: return `Fase de ${size}`;
  }
}
function phaseTagFromSize(size: number): string { return `ko_${size}`; }
function penaltyConversion(ovr: number): number {
  return Math.min(0.92, Math.max(0.4, 0.5 + (ovr - 50) * 0.0075));
}
function simulateShootout(effHome: number, effAway: number): { home: number; away: number } {
  const pHome = penaltyConversion(effHome);
  const pAway = penaltyConversion(effAway);
  let h = 0; let a = 0;
  for (let i = 0; i < 5; i++) { if (Math.random() < pHome) h++; if (Math.random() < pAway) a++; }
  let guard = 0;
  while (h === a && guard < 100) { if (Math.random() < pHome) h++; if (Math.random() < pAway) a++; guard++; }
  if (h === a) h++;
  return { home: h, away: a };
}
interface KnockoutMatchResult {
  scoreHome: number; scoreAway: number;
  penHome: number | null; penAway: number | null;
  wentToPens: boolean; winner: 'home' | 'away';
}
function simulateKnockoutMatch(effHome: number, effAway: number): KnockoutMatchResult {
  const diff = (effHome + 3) - effAway;
  const scoreHome = poissonGoals(Math.max(0.2, 1.4 + diff / 22));
  const scoreAway = poissonGoals(Math.max(0.2, 1.4 - diff / 22));
  if (scoreHome !== scoreAway) {
    return { scoreHome, scoreAway, penHome: null, penAway: null, wentToPens: false, winner: scoreHome > scoreAway ? 'home' : 'away' };
  }
  const pens = simulateShootout(effHome, effAway);
  return { scoreHome, scoreAway, penHome: pens.home, penAway: pens.away, wentToPens: true, winner: pens.home > pens.away ? 'home' : 'away' };
}

// Monta um round de mata-mata diário (round + fixtures) a partir dos confrontos.
// IDs determinísticos: o índice do confronto fica no id da fixture para que a
// ordem do bracket seja recuperável (winners → pairAdjacent → próxima fase).
function buildDailyKnockoutRound(
  pairs: Array<[TeamRow, TeamRow]>,
  dkoSeasonId: string,
  roundNumber: number,
  kickoffMs: number,
) {
  const size = pairs.length * 2;
  const roundId = `dko_${dkoSeasonId}_r${roundNumber}`;
  const round = {
    id: roundId, season_id: dkoSeasonId, round_number: roundNumber,
    round_type: 'daily_ko', phase: phaseTagFromSize(size), is_returning: false,
    status: 'scheduled', scheduled_kickoff_ms: kickoffMs,
    actual_kickoff_ms: null, finished_at_ms: null,
  };
  const fixtures = pairs.map(([home, away], i) => ({
    id: `dkofx_${dkoSeasonId}_r${roundNumber}_${i}`,
    round_id: roundId, division: 'daily_ko',
    home_team_id: home.id, away_team_id: away.id,
    home_team_name: home.club_name, away_team_name: away.club_name,
    home_overall: home.overall, away_overall: away.overall,
    score_home: 0, score_away: 0, current_minute: 0,
    status: 'scheduled', kickoff_ms: null, finished_at_ms: null,
  }));
  return { round, fixtures, size, roundId };
}

// Índice do confronto a partir do id da fixture (sufixo numérico). Usado para
// ordenar os vencedores na ordem do bracket antes de gerar a próxima fase.
function dailyFixtureMatchIndex(fixtureId: string): number {
  const n = Number(fixtureId.split('_').pop());
  return Number.isFinite(n) ? n : 0;
}

// Vencedor de uma fixture daily_ko JÁ FINALIZADA (gols, depois pênaltis).
function dailyWinnerSide(fx: FixtureRow): 'home' | 'away' | null {
  if (fx.score_home !== fx.score_away) return fx.score_home > fx.score_away ? 'home' : 'away';
  const ph = (fx as any).penalty_score_home;
  const pa = (fx as any).penalty_score_away;
  const w = (fx as any).went_to_penalties;
  if (w && ph != null && pa != null) return ph > pa ? 'home' : 'away';
  return null;
}

// Avança o bracket ou coroa o campeão a partir das fixtures JÁ FINALIZADAS.
// Idempotente e à prova de crash: derivar dos placares (não re-simula); a
// próxima fase usa ids determinísticos (upsert no-op se já existe); a coroa
// só incrementa season_crowns quando a linha de daily_crowns é nova (a unique
// por dia barra dupla coroação). Chamada pelo processamento normal E pela
// recuperação de rounds travados.
async function advanceOrCrownDailyKo(
  supabase: any, round: RoundRow, finishedFx: FixtureRow[],
  teamById: Map<string, TeamRow>, now: number, state: StateRow,
): Promise<{ step: string; detail?: any }> {
  const brtDay = brtDayString(now);
  const ordered = [...finishedFx].sort((a, b) => dailyFixtureMatchIndex(a.id) - dailyFixtureMatchIndex(b.id));
  const winners: TeamRow[] = [];
  for (const fx of ordered) {
    const side = dailyWinnerSide(fx);
    if (!side) return { step: 'daily-ko-incomplete' }; // sem vencedor → não avança
    const wid = side === 'home' ? fx.home_team_id : fx.away_team_id;
    const wt = teamById.get(wid);
    if (wt) winners.push(wt);
  }
  if (winners.length === 0) return { step: 'daily-ko-no-winners' };

  // PRÊMIO POR VENCER A FASE — todos os vencedores da rodada que terminou. A
  // fase vem do nº de times na rodada (2*fixtures): 16=oitavas, 8=quartas,
  // 4=semi, 2=final. Idempotente (id determinístico). O campeão (final) cai aqui.
  const stagePrize = KO_STAGE_PRIZE[finishedFx.length * 2];
  if (stagePrize) {
    const prizeCtx = { brtDay, competitionId: state.competition_id, seasonId: round.season_id, now };
    for (const w of winners) {
      await writeKoPrize(supabase, w, stagePrize.stage, stagePrize.exp, prizeCtx);
    }
  }

  if (winners.length > 1) {
    const nextPairs = pairAdjacent(winners);
    const built = buildDailyKnockoutRound(nextPairs, round.season_id, round.round_number + 1, now + KO_PHASE_INTERVAL_MS);
    await supabase.from('global_league_rounds').upsert([built.round] as any, { onConflict: 'id' });
    await supabase.from('global_league_fixtures').upsert(built.fixtures as any, { onConflict: 'id' });
    return { step: 'daily-ko-advance', detail: { to: phaseTagFromSize(built.size) } };
  }

  // 1 vencedor → CAMPEÃO DO DIA. Insert (não upsert) para detectar se é novo.
  const champion = winners[0];
  const finalFx = ordered[0];
  const runnerUpId = finalFx.home_team_id === champion.id ? finalFx.away_team_id : finalFx.home_team_id;
  const runnerUp = teamById.get(runnerUpId);
  const { error: crownErr } = await supabase.from('daily_crowns').insert({
    id: `crown_${brtDay}`,
    team_id: champion.id, manager_id: champion.manager_id,
    club_name: champion.club_name, club_short: champion.club_short,
    daily_date: brtDay, season_id: state.season_id, competition_id: state.competition_id,
    bracket_size: state.daily_ko_size ?? winners.length,
    final_round_id: round.id,
    runner_up_team_id: runnerUp?.id ?? null,
    runner_up_club_name: runnerUp?.club_name ?? null,
    final_score_home: finalFx.score_home, final_score_away: finalFx.score_away,
    final_went_to_pens: (finalFx as any).went_to_penalties ?? false,
    crowned_at_ms: now,
  });
  if (!crownErr) {
    // Recém-coroado: incrementa coroas UMA vez e publica o evento.
    await supabase.from('global_league_teams').update({
      season_crowns: (champion.season_crowns ?? 0) + 1,
      all_time_crowns: (champion.all_time_crowns ?? 0) + 1,
    }).eq('id', champion.id);
    await supabase.from('global_league_events').upsert([{
      id: `evt_crown_${brtDay}`, fixture_id: finalFx.id, event_type: 'crown',
      minute: 90, side: 'home',
      text: `👑 ${champion.club_name} é o Campeão do Dia!`, highlight: true,
      timestamp_ms: now + 92 * 1000,
    }] as any, { onConflict: 'id' });
    // Notifica o campeão (modal de coroação aciona via Realtime no daily_crowns).
    const wentToPens = (finalFx as any).went_to_penalties ?? false;
    const finalLine = wentToPens
      ? `${finalFx.score_home}–${finalFx.score_away} (pênaltis) vs ${runnerUp?.club_name ?? 'finalista'}`
      : `${finalFx.score_home}–${finalFx.score_away} vs ${runnerUp?.club_name ?? 'finalista'}`;
    notifyManager(
      supabase, champion.manager_id, 'COMPETIÇÃO',
      `👑 CAMPEÃO DO DIA OLEFOOT!`,
      `${champion.club_name} venceu a final ${finalLine}. Sua Coroa foi adicionada ao acervo.`,
      '/match/global',
      { kind: 'daily_crown', daily_date: brtDay, crown_id: `crown_${brtDay}` },
    ).catch(() => { /* swallow */ });
  }
  await supabase.from('global_league_state').update({ daily_phase: 'crowned' }).eq('id', 'current');
  return { step: 'daily-ko-crowned', detail: { champion: champion.club_name, fresh: !crownErr } };
}

function generatePlayoffRoundsAndFixtures(
  teams: TeamRow[], seasonId: string, nowMs: number,
  slots: string[], slotDurationMin: number,
) {
  const rounds: any[] = [];
  const fixtures: any[] = [];
  const n = teams.length;
  if (n < 2) return { rounds, fixtures };
  let lastKickoff = nowMs;
  for (let roundNumber = 1; roundNumber <= 6; roundNumber++) {
    const isReturning = roundNumber > 3;
    const phase = roundNumber <= 2 ? 'round_1' : roundNumber <= 4 ? 'round_2' : 'round_3';
    const half = Math.floor(n / 2);
    const turnRound = isReturning ? roundNumber - 3 : roundNumber;
    const rotated = [...teams];
    for (let r = 1; r < turnRound; r++) {
      const last = rotated.pop()!;
      rotated.splice(1, 0, last);
    }
    const kickoffMs = nextSlotAlignedKickoff(lastKickoff + (roundNumber === 1 ? 0 : 60_000), slots, slotDurationMin);
    lastKickoff = kickoffMs;
    const roundId = `playoff_${seasonId}_${roundNumber}`;
    rounds.push({
      id: roundId, season_id: seasonId, round_number: roundNumber, round_type: 'playoff',
      phase, is_returning: isReturning, status: 'scheduled', scheduled_kickoff_ms: kickoffMs,
      actual_kickoff_ms: null, finished_at_ms: null,
    });
    for (let i = 0; i < half; i++) {
      let home = rotated[i]; let away = rotated[n - 1 - i];
      if (isReturning) [home, away] = [away, home];
      fixtures.push({
        id: NEW_ID(), round_id: roundId, division: 'playoff',
        home_team_id: home.id, away_team_id: away.id,
        home_team_name: home.club_name, away_team_name: away.club_name,
        home_overall: home.overall, away_overall: away.overall,
        score_home: 0, score_away: 0, current_minute: 0,
        status: 'scheduled', kickoff_ms: null, finished_at_ms: null,
      });
    }
  }
  return { rounds, fixtures };
}

function distributeIntoDivisions(teams: TeamRow[], totalDivisions = 3): TeamRow[] {
  // Primário: overall (mais alto = divisão 1) — funciona para 1ª distribuição
  // quando todos os playoff_* são 0 (modo "só liga, sem playoffs").
  // Secundário: playoff_points/wins/gd para preservar critério antigo se algum dia
  // os playoffs voltarem.
  const sorted = [...teams].sort((a, b) => {
    if (b.overall !== a.overall) return b.overall - a.overall;
    if (b.playoff_points !== a.playoff_points) return b.playoff_points - a.playoff_points;
    if (b.playoff_wins !== a.playoff_wins) return b.playoff_wins - a.playoff_wins;
    const aDiff = a.playoff_goals_for - a.playoff_goals_against;
    const bDiff = b.playoff_goals_for - b.playoff_goals_against;
    if (bDiff !== aDiff) return bDiff - aDiff;
    if (b.playoff_goals_for !== a.playoff_goals_for) return b.playoff_goals_for - a.playoff_goals_for;
    return a.club_name.localeCompare(b.club_name);
  });
  const teamsPerDivision = Math.ceil(teams.length / totalDivisions);
  return sorted.map((team, index) => ({
    ...team,
    division: Math.min(Math.floor(index / teamsPerDivision) + 1, totalDivisions),
    position: (index % teamsPerDivision) + 1,
  }));
}

function generateLeagueRoundsAndFixtures(
  teams: TeamRow[], seasonId: string, nowMs: number,
  slots: string[], slotDurationMin: number,
) {
  const rounds: any[] = [];
  const fixtures: any[] = [];
  const byDivision = new Map<number, TeamRow[]>();
  for (const team of teams) {
    if (!team.division) continue;
    if (!byDivision.has(team.division)) byDivision.set(team.division, []);
    byDivision.get(team.division)!.push(team);
  }
  const divsWithMatches = Array.from(byDivision.values()).filter(t => t.length >= 2);
  if (divsWithMatches.length === 0) return { rounds, fixtures };
  const maxTeamsInDiv = Math.max(...divsWithMatches.map(t => t.length));
  const totalRounds = (maxTeamsInDiv - 1) * 2;
  let lastKickoff = nowMs;
  for (let roundNumber = 1; roundNumber <= totalRounds; roundNumber++) {
    const isReturning = roundNumber > (maxTeamsInDiv - 1);
    const kickoffMs = nextSlotAlignedKickoff(lastKickoff + (roundNumber === 1 ? 0 : 60_000), slots, slotDurationMin);
    lastKickoff = kickoffMs;
    const roundId = `league_${seasonId}_${roundNumber}`;
    rounds.push({
      id: roundId, season_id: seasonId, round_number: roundNumber, round_type: 'league',
      phase: null, is_returning: isReturning, status: 'scheduled', scheduled_kickoff_ms: kickoffMs,
      actual_kickoff_ms: null, finished_at_ms: null,
    });
    for (const [, divTeams] of byDivision) {
      const n = divTeams.length;
      if (n < 2) continue;
      const half = Math.floor(n / 2);
      const turnRound = isReturning ? roundNumber - (maxTeamsInDiv - 1) : roundNumber;
      const rotated = [...divTeams];
      for (let r = 1; r < turnRound; r++) {
        const last = rotated.pop()!;
        rotated.splice(1, 0, last);
      }
      for (let i = 0; i < half; i++) {
        let home = rotated[i]; let away = rotated[n - 1 - i];
        if (isReturning) [home, away] = [away, home];
        fixtures.push({
          id: NEW_ID(), round_id: roundId, division: String(home.division),
          home_team_id: home.id, away_team_id: away.id,
          home_team_name: home.club_name, away_team_name: away.club_name,
          home_overall: home.overall, away_overall: away.overall,
          score_home: 0, score_away: 0, current_minute: 0,
          status: 'scheduled', kickoff_ms: null, finished_at_ms: null,
        });
      }
    }
  }
  return { rounds, fixtures };
}

// SOFT promo/rele — reorganiza divisões MAS PRESERVA pontos da competição
function applyPromotionRelegationSoft(
  teams: TeamRow[], promoPct: number, relePct: number, totalDivisions = 3,
): TeamRow[] {
  const byDivision = new Map<number, TeamRow[]>();
  for (const team of teams) {
    if (!team.division) continue;
    if (!byDivision.has(team.division)) byDivision.set(team.division, []);
    byDivision.get(team.division)!.push(team);
  }
  for (const [, divTeams] of byDivision) {
    divTeams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
      if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
      return a.club_name.localeCompare(b.club_name);
    });
  }
  const result: TeamRow[] = [];
  for (let division = 1; division <= totalDivisions; division++) {
    const divTeams = byDivision.get(division) ?? [];
    const promoCount = Math.ceil(divTeams.length * promoPct);
    const releCount = Math.ceil(divTeams.length * relePct);
    divTeams.forEach((team, index) => {
      let newDivision = division;
      if (division > 1 && index < promoCount) newDivision = division - 1;
      else if (division < totalDivisions && index >= divTeams.length - releCount) newDivision = division + 1;
      result.push({
        ...team,
        division: newDivision,
        playoff_points: 0, playoff_matches_played: 0, playoff_wins: 0, playoff_draws: 0,
        playoff_losses: 0, playoff_goals_for: 0, playoff_goals_against: 0,
        position: null,
        previous_position: team.position ?? null,
        all_time_seasons_played: (team.all_time_seasons_played ?? 0) + 1,
      });
    });
  }
  for (const team of teams) {
    if (!team.division) result.push({ ...team });
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPORADA SAZONAL — linha de chegada de 1000 pts + Campeão por divisão
// ═══════════════════════════════════════════════════════════════════════════
const SEASON_POINT_TARGET = 1000; // ~2,5 dias no ritmo nonstop → fim da temporada
// O reset da temporada só acontece de MADRUGADA (0–6h BRT) — depois do mata-mata
// da noite e da virada de meia-noite, nunca durante o dia. A liga continua
// estendendo (acumulando pontos) até a janela da madrugada chegar.
const SEASON_RESET_HOUR = 6;
// Prêmio do campeão por divisão (D1 > D2 > D3). Creditado client-side via tabela
// global_league_season_champions (claimed). Constantes — fáceis de tunar.
const SEASON_PRIZES: Record<number, { ole: number; exp: number }> = {
  1: { ole: 500_000, exp: 250_000 },
  2: { ole: 250_000, exp: 125_000 },
  3: { ole: 100_000, exp: 50_000 },
};

// ── Prêmio EXP do MATA-MATA DIÁRIO (Coroa do Dia) ────────────────────────────
// Creditado client-side via a tabela global_league_ko_prizes (claimed). Pago ao
// CLASSIFICAR e ao VENCER cada fase. Chave de fase = nº de times NA rodada que
// terminou (16=oitavas, 8=quartas, 4=semi, 2=final). Rodadas antes das oitavas
// (32+) não pagam — o prêmio começa "das oitavas". Total do campeão: 3.450.000.
const KO_QUALIFY_PRIZE = 100_000;
const KO_STAGE_PRIZE: Record<number, { stage: string; exp: number }> = {
  16: { stage: 'r16', exp: 100_000 },
  8: { stage: 'qf', exp: 250_000 },
  4: { stage: 'sf', exp: 500_000 },
  2: { stage: 'final', exp: 2_500_000 },
};

// Insere uma linha de prêmio (idempotente por id determinístico). O cliente lê
// os não-reclamados do seu manager_id, credita EXP e marca claimed=true.
async function writeKoPrize(
  supabase: any, team: TeamRow, stage: string, exp: number,
  ctx: { brtDay: string; competitionId: string; seasonId: string; now: number },
): Promise<void> {
  if (exp <= 0 || !team?.id) return;
  await supabase.from('global_league_ko_prizes').insert({
    id: `koprize_${ctx.brtDay}_${stage}_${team.id}`,
    competition_id: ctx.competitionId,
    season_id: ctx.seasonId,
    daily_date: ctx.brtDay,
    team_id: team.id,
    manager_id: team.manager_id,
    club_name: team.club_name,
    stage,
    prize_exp: exp,
    claimed: false,
    crowned_at_ms: ctx.now,
  });
  // insert idempotente: conflito de PK = no-op (erro engolido — não credita 2×).
}

function divisionLeader(teams: TeamRow[], division: number): TeamRow | null {
  const divTeams = teams.filter((t) => t.division === division);
  if (divTeams.length === 0) return null;
  divTeams.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
    return a.club_name.localeCompare(b.club_name);
  });
  return divTeams[0];
}

// Coroa o líder de cada divisão. Insert idempotente (id determinístico) — não
// re-coroa nem re-notifica se o tick repetir. O crédito do prêmio é client-side
// (cliente lê os champions não-reclamados do seu manager_id).
async function crownDivisionChampions(
  supabase: any, teams: TeamRow[], state: StateRow, now: number,
): Promise<string[]> {
  const crowned: string[] = [];
  for (let division = 1; division <= 3; division++) {
    const champ = divisionLeader(teams, division);
    if (!champ) continue;
    const prize = SEASON_PRIZES[division] ?? { ole: 0, exp: 0 };
    const id = `champ_${state.competition_id}_${state.season_id}_d${division}`;
    const { error } = await supabase.from('global_league_season_champions').insert({
      id,
      competition_id: state.competition_id,
      season_id: state.season_id,
      division,
      team_id: champ.id,
      manager_id: champ.manager_id,
      club_name: champ.club_name,
      points: champ.points,
      prize_ole: prize.ole,
      prize_exp: prize.exp,
      claimed: false,
      crowned_at_ms: now,
    });
    if (error) continue; // já existe (idempotente) → não duplica notificação
    crowned.push(`D${division}:${champ.club_name}`);
    await notifyManager(
      supabase, champ.manager_id, 'COMPETIÇÃO',
      `🏆 CAMPEÃO DA DIVISÃO ${division}!`,
      `${champ.club_name} venceu a temporada da Div ${division} com ${champ.points} pts. Prêmio de ${prize.ole.toLocaleString('pt-BR')} OLE + ${prize.exp.toLocaleString('pt-BR')} EXP no seu próximo login.`,
      '/match/global',
      { kind: 'season_champion', champion_id: id, division },
    );
  }
  return crowned;
}

// Notifica quem subiu/desceu de divisão na virada de temporada.
async function notifyPromotions(
  supabase: any, reorganized: TeamRow[], oldDivById: Map<string, number | null>,
): Promise<void> {
  for (const t of reorganized) {
    const oldDiv = oldDivById.get(t.id);
    if (!oldDiv || !t.division || t.division === oldDiv) continue;
    if (t.division < oldDiv) {
      await notifyManager(
        supabase, t.manager_id, 'COMPETIÇÃO',
        `⬆️ ACESSO À DIVISÃO ${t.division}!`,
        `${t.club_name} subiu para a Divisão ${t.division}. Nova temporada começando — segure a vaga.`,
        '/match/global', { kind: 'promotion', division: t.division },
      );
    } else {
      await notifyManager(
        supabase, t.manager_id, 'COMPETIÇÃO',
        `⬇️ Rebaixado para a Divisão ${t.division}`,
        `${t.club_name} caiu para a Divisão ${t.division}. Hora de reagir na nova temporada.`,
        '/match/global', { kind: 'relegation', division: t.division },
      );
    }
  }
}

// HARD reset — fim da competição (zera tudo de season, all-time intacto)
function applyCompetitionReset(teams: TeamRow[]): TeamRow[] {
  return teams.map((team) => ({
    ...team,
    playoff_points: 0, playoff_matches_played: 0, playoff_wins: 0, playoff_draws: 0,
    playoff_losses: 0, playoff_goals_for: 0, playoff_goals_against: 0,
    points: 0, matches_played: 0, wins: 0, draws: 0, losses: 0,
    goals_for: 0, goals_against: 0, goal_difference: 0,
    recent_form: [], position: null, previous_position: null,
    rivalry_encounters: {},
  }));
}

function simulateFixture(fx: FixtureRow, effHome: number, effAway: number, kickoffMs: number, opts?: { isRivalry?: boolean }) {
  const isRivalry = opts?.isRivalry ?? false;
  // Rivalidade: probabilidades aumentadas
  const yellowProb = isRivalry ? 0.25 : 0.15;
  const redProb = isRivalry ? 0.08 : 0.03;
  const injuryProb = isRivalry ? 0.15 : 0.08;

  const homeAdvantage = 3;
  const diff = (effHome + homeAdvantage) - effAway;
  // Sensibilidade /16 (antes /22): quando há gap REAL de overall, o favorito
  // aparece no placar — menos "cara-ou-coroa". Times iguais (diff≈3) seguem
  // ~25% de empate; o efeito cresce só quando a diferença é genuína.
  const OVR_GOAL_SENSITIVITY = 16;
  // FABLE — DERBY: rivalidade (3º+ confronto) esquenta o PLACAR também, não só
  // a disciplina. Simétrico (×1.12 nos dois lambdas) — clássico não favorece
  // ninguém, ele AMPLIFICA. Espelha o derby do client (contextFactors 1.15×
  // e o derby_mult 1.12 do quick plan Python).
  const derbyGoalMult = isRivalry ? 1.12 : 1.0;
  const homeExpected = Math.max(0.2, 1.4 + diff / OVR_GOAL_SENSITIVITY) * derbyGoalMult;
  const awayExpected = Math.max(0.2, 1.4 - diff / OVR_GOAL_SENSITIVITY) * derbyGoalMult;
  const homeGoals = poissonGoals(homeExpected);
  const awayGoals = poissonGoals(awayExpected);
  const events: any[] = [];
  // Clássico ganha a manchete de abertura no feed do fixture.
  if (isRivalry) {
    events.push({
      id: `evt_${fx.id}_derby_${kickoffMs}`,
      fixture_id: fx.id, event_type: 'pressure', minute: 1, side: 'home',
      text: `🔥 CLÁSSICO! ${fx.home_team_name} × ${fx.away_team_name} — a rivalidade ferve.`,
      highlight: true,
      timestamp_ms: kickoffMs + 1000,
    });
  }
  const placeGoal = (side: 'home' | 'away', i: number, total: number) => {
    const minute = Math.max(1, Math.min(90, Math.floor((90 / (total + 1)) * (i + 1) + (Math.random() - 0.5) * 8)));
    const teamName = side === 'home' ? fx.home_team_name : fx.away_team_name;
    events.push({
      id: `evt_${fx.id}_${side}_g${i}_${kickoffMs}`,
      fixture_id: fx.id, event_type: 'goal', minute, side,
      text: `⚽ GOL! ${teamName} marca!`, highlight: true,
      timestamp_ms: kickoffMs + minute * 1000,
    });
  };
  for (let i = 0; i < homeGoals; i++) placeGoal('home', i, homeGoals);
  for (let i = 0; i < awayGoals; i++) placeGoal('away', i, awayGoals);

  // Cartões amarelos
  let home_yellow = false;
  let away_yellow = false;
  if (Math.random() < yellowProb) {
    home_yellow = true;
    const minute = Math.floor(10 + Math.random() * 80);
    events.push({
      id: `evt_${fx.id}_home_yc_${kickoffMs}`,
      fixture_id: fx.id, event_type: 'yellow_card', minute, side: 'home',
      text: `🟡 Cartão amarelo — ${fx.home_team_name}`, highlight: false,
      timestamp_ms: kickoffMs + minute * 1000,
    });
  }
  if (Math.random() < yellowProb) {
    away_yellow = true;
    const minute = Math.floor(10 + Math.random() * 80);
    events.push({
      id: `evt_${fx.id}_away_yc_${kickoffMs}`,
      fixture_id: fx.id, event_type: 'yellow_card', minute, side: 'away',
      text: `🟡 Cartão amarelo — ${fx.away_team_name}`, highlight: false,
      timestamp_ms: kickoffMs + minute * 1000,
    });
  }

  // Cartões vermelhos
  let home_red = false;
  let away_red = false;
  if (Math.random() < redProb) {
    home_red = true;
    const minute = Math.floor(20 + Math.random() * 70);
    events.push({
      id: `evt_${fx.id}_home_rc_${kickoffMs}`,
      fixture_id: fx.id, event_type: 'red_card', minute, side: 'home',
      text: `🟥 Cartão vermelho — ${fx.home_team_name}`, highlight: true,
      timestamp_ms: kickoffMs + minute * 1000,
    });
  }
  if (Math.random() < redProb) {
    away_red = true;
    const minute = Math.floor(20 + Math.random() * 70);
    events.push({
      id: `evt_${fx.id}_away_rc_${kickoffMs}`,
      fixture_id: fx.id, event_type: 'red_card', minute, side: 'away',
      text: `🟥 Cartão vermelho — ${fx.away_team_name}`, highlight: true,
      timestamp_ms: kickoffMs + minute * 1000,
    });
  }

  // Lesões
  let injured_side: 'home' | 'away' | null = null;
  if (Math.random() < injuryProb) {
    injured_side = Math.random() < 0.5 ? 'home' : 'away';
    const minute = Math.floor(10 + Math.random() * 80);
    events.push({
      id: `evt_${fx.id}_${injured_side}_inj_${kickoffMs}`,
      fixture_id: fx.id, event_type: 'injury', minute, side: injured_side,
      text: '🚑 Jogador lesionado', highlight: false,
      timestamp_ms: kickoffMs + minute * 1000,
    });
  }
  events.sort((a, b) => (a.minute as number) - (b.minute as number));
  return { score_home: homeGoals, score_away: awayGoals, events, injured_side, home_yellow, away_yellow, home_red, away_red };
}

function updateTeamRow(team: TeamRow, gf: number, ga: number, isPlayoff: boolean, accrueDaily = false): TeamRow {
  const isWin = gf > ga;
  const isDraw = gf === ga;
  const points = isWin ? 3 : isDraw ? 1 : 0;
  const result: 'W' | 'D' | 'L' = isWin ? 'W' : isDraw ? 'D' : 'L';
  const allTimeBase = {
    all_time_points: (team.all_time_points ?? 0) + points,
    all_time_matches_played: (team.all_time_matches_played ?? 0) + 1,
    all_time_wins: (team.all_time_wins ?? 0) + (isWin ? 1 : 0),
    all_time_draws: (team.all_time_draws ?? 0) + (isDraw ? 1 : 0),
    all_time_losses: (team.all_time_losses ?? 0) + (!isWin && !isDraw ? 1 : 0),
    all_time_goals_for: (team.all_time_goals_for ?? 0) + gf,
    all_time_goals_against: (team.all_time_goals_against ?? 0) + ga,
  };
  // Corrida do Dia Olefoot: só partidas de LIGA somam (mata-mata/playoff não).
  const dailyBase = accrueDaily ? {
    daily_points: (team.daily_points ?? 0) + points,
    daily_matches_played: (team.daily_matches_played ?? 0) + 1,
    daily_wins: (team.daily_wins ?? 0) + (isWin ? 1 : 0),
    daily_draws: (team.daily_draws ?? 0) + (isDraw ? 1 : 0),
    daily_losses: (team.daily_losses ?? 0) + (!isWin && !isDraw ? 1 : 0),
    daily_goals_for: (team.daily_goals_for ?? 0) + gf,
    daily_goals_against: (team.daily_goals_against ?? 0) + ga,
    daily_goal_difference: (team.daily_goal_difference ?? 0) + (gf - ga),
  } : {};
  if (isPlayoff) {
    return {
      ...team, ...allTimeBase,
      playoff_points: team.playoff_points + points,
      playoff_matches_played: team.playoff_matches_played + 1,
      playoff_wins: team.playoff_wins + (isWin ? 1 : 0),
      playoff_draws: team.playoff_draws + (isDraw ? 1 : 0),
      playoff_losses: team.playoff_losses + (!isWin && !isDraw ? 1 : 0),
      playoff_goals_for: team.playoff_goals_for + gf,
      playoff_goals_against: team.playoff_goals_against + ga,
    };
  }
  const newForm = [...(team.recent_form ?? []), result].slice(-5);
  return {
    ...team, ...allTimeBase, ...dailyBase,
    points: team.points + points, matches_played: team.matches_played + 1,
    wins: team.wins + (isWin ? 1 : 0), draws: team.draws + (isDraw ? 1 : 0),
    losses: team.losses + (!isWin && !isDraw ? 1 : 0),
    goals_for: team.goals_for + gf, goals_against: team.goals_against + ga,
    goal_difference: team.goal_difference + (gf - ga),
    recent_form: newForm,
  };
}

async function recoverStaleLiveRound(supabase: any, now: number, state: StateRow) {
  const staleBefore = now - STALE_LIVE_ROUND_MS;
  const { data: staleRounds, error } = await supabase
    .from('global_league_rounds')
    .select('*')
    .eq('status', 'live')
    .lte('actual_kickoff_ms', staleBefore)
    .order('actual_kickoff_ms', { ascending: true })
    .limit(1);

  if (error) return { ok: false, step: 'recover-stale-live', error: error.message };
  if (!staleRounds || staleRounds.length === 0) return null;

  const round = staleRounds[0] as RoundRow;
  const { data: fixtures, error: fxErr } = await supabase
    .from('global_league_fixtures')
    .select('id,status')
    .eq('round_id', round.id);

  if (fxErr) return { ok: false, step: 'recover-stale-live', roundId: round.id, error: fxErr.message };

  const fixtureRows = (fixtures ?? []) as Array<{ id: string; status: string }>;
  const finishedCount = fixtureRows.filter(f => f.status === 'finished').length;
  const liveCount = fixtureRows.filter(f => f.status === 'live').length;

  if (fixtureRows.length > 0 && finishedCount === fixtureRows.length) {
    // Mata-mata diário travado em 'live' com tudo finalizado: refaz o
    // avanço/coroa a partir das fixtures (idempotente) antes de marcar finished.
    if (round.round_type === 'daily_ko') {
      const { data: fullFx } = await supabase
        .from('global_league_fixtures').select('*').eq('round_id', round.id);
      const ffx = (fullFx as FixtureRow[] | null) ?? [];
      const ids = new Set<string>();
      for (const fx of ffx) { ids.add(fx.home_team_id); ids.add(fx.away_team_id); }
      const { data: teamsData } = await supabase.from('global_league_teams').select('*').in('id', Array.from(ids));
      const tById = new Map<string, TeamRow>();
      for (const t of (teamsData as TeamRow[] | null) ?? []) tById.set(t.id, t);
      const outcome = await advanceOrCrownDailyKo(supabase, round, ffx, tById, now, state);
      await supabase
        .from('global_league_rounds')
        .update({ status: 'finished', finished_at_ms: now })
        .eq('id', round.id)
        .eq('status', 'live');
      return {
        ok: true, step: 'recover-stale-daily-ko', roundId: round.id,
        fixtures: ffx.length, reason: outcome.step,
      };
    }

    await supabase
      .from('global_league_rounds')
      .update({ status: 'finished', finished_at_ms: now })
      .eq('id', round.id)
      .eq('status', 'live');

    const stateUpdate: Record<string, unknown> = {};
    if (round.round_type === 'playoff') stateUpdate.current_playoff_round = round.round_number + 1;
    else stateUpdate.current_league_round = round.round_number + 1;
    await supabase.from('global_league_state').update(stateUpdate).eq('id', 'current');

    return {
      ok: true,
      step: 'recover-stale-live',
      roundId: round.id,
      fixtures: fixtureRows.length,
      reason: 'round was live but all fixtures were already finished',
    };
  }

  if (finishedCount === 0) {
    if (liveCount > 0) {
      await supabase
        .from('global_league_fixtures')
        .update({ status: 'scheduled', kickoff_ms: null })
        .eq('round_id', round.id)
        .neq('status', 'finished');
    }

    await supabase
      .from('global_league_rounds')
      .update({ status: 'scheduled', actual_kickoff_ms: null })
      .eq('id', round.id)
      .eq('status', 'live');

    return {
      ok: true,
      step: 'recover-stale-live',
      roundId: round.id,
      fixtures: fixtureRows.length,
      reason: 'round lock was stale before any fixture finished; reset for retry',
    };
  }

  return {
    ok: true,
    step: 'recover-stale-live',
    skipped: true,
    roundId: round.id,
    fixtures: fixtureRows.length,
    reason: `mixed fixture state (${finishedCount}/${fixtureRows.length} finished); manual audit required`,
  };
}

// Sequência COMPLETA de fim de temporada — coroa campeões por divisão →
// promoção/rebaixamento → zera pontos/estatísticas da temporada → regenera as
// rodadas pro próximo slot. Reutilizada pelo fim natural (alvo de pontos) e
// pelo reset manual do admin. all_time_* é PRESERVADO (só season stats zeram).
async function runSeasonReset(
  supabase: any, state: StateRow, now: number,
  cfg: { promoPct: number; relePct: number; slots: string[]; slotDurationMin: number },
): Promise<Record<string, unknown>> {
  const { data: tData } = await supabase.from('global_league_teams').select('*');
  const teams = (tData as TeamRow[]) ?? [];
  if (teams.length < 2) return { ok: false, step: 'season-reset', reason: 'not-enough-teams', count: teams.length };
  const seasonId = `season_${now}`;
  await crownDivisionChampions(supabase, teams, state, now);
  const oldDivById = new Map(teams.map((t) => [t.id, t.division]));
  const promoted = applyPromotionRelegationSoft(teams, cfg.promoPct, cfg.relePct);
  await notifyPromotions(supabase, promoted, oldDivById);
  const reorganized = promoted.map((t) => ({
    ...t, points: 0, matches_played: 0, wins: 0, draws: 0, losses: 0,
    goals_for: 0, goals_against: 0, goal_difference: 0, recent_form: [], position: null,
  }));
  for (const t of reorganized) {
    if (!t.division) {
      t.division = 3; t.points = 0; t.matches_played = 0; t.wins = 0; t.draws = 0;
      t.losses = 0; t.goals_for = 0; t.goals_against = 0; t.goal_difference = 0; t.recent_form = [];
    }
  }
  await supabase.from('global_league_events').delete().neq('id', '');
  await supabase.from('global_league_fixtures').delete().neq('id', '');
  await supabase.from('global_league_rounds').delete().neq('id', '');
  await supabase.from('global_league_teams').upsert(reorganized as any, { onConflict: 'id' });
  const { data: after } = await supabase.from('global_league_teams').select('*');
  const withDiv = (after as TeamRow[]) ?? [];
  const { rounds, fixtures } = generateLeagueRoundsAndFixtures(withDiv, seasonId, now, cfg.slots, cfg.slotDurationMin);
  if (rounds.length > 0) await supabase.from('global_league_rounds').upsert(rounds as any, { onConflict: 'id' });
  if (fixtures.length > 0) await supabase.from('global_league_fixtures').upsert(fixtures as any, { onConflict: 'id' });
  await supabase.from('global_league_state').update({
    status: 'active', season_id: seasonId, season_name: `OLEFOOT LIGA — ${seasonId}`,
    current_playoff_round: null, current_league_round: 1,
  }).eq('id', 'current');
  return {
    ok: true, step: 'season-reset', seasonId,
    teams: reorganized.length, rounds: rounds.length, fixtures: fixtures.length,
    firstKickoffUtc: rounds[0] ? new Date(rounds[0].scheduled_kickoff_ms).toISOString() : null,
  };
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const now = Date.now();

  const { data: stateData, error: stateErr } = await supabase
    .from('global_league_state').select('*').eq('id', 'current').maybeSingle();
  if (stateErr || !stateData) {
    return new Response(JSON.stringify({ ok: false, step: 'load-state', error: stateErr?.message }), { status: 500 });
  }
  const state = stateData as StateRow;
  const slots: string[] = Array.isArray(state.match_slots) ? state.match_slots : ['05:30','11:00','15:00','19:00','21:30'];
  const slotDurationMin = state.slot_duration_min ?? 30;
  const promoPct = Number(state.promotion_percentage);
  const relePct = Number(state.relegation_percentage);
  // Alvo de pontos da temporada — TUNÁVEL via global_league_state.season_point_target
  // (fallback pra constante). O admin controla a cadência sem redeploy.
  const seasonTarget = Number(state.season_point_target) || SEASON_POINT_TARGET;

  // ── RESET MANUAL DE TEMPORADA (admin) ──────────────────────────────────────
  // Seguro e persistente: SÓ a SERVICE ROLE key dispara (o fundador, via
  // dashboard/CLI). Roda a MESMA sequência do fim natural — pra anunciar uma
  // temporada nova on-demand sem esperar o alvo de pontos.
  //   curl -X POST <fn-url> -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  //        -H "x-admin-action: force-season-reset"
  if (
    req.headers.get('x-admin-action') === 'force-season-reset' &&
    req.headers.get('Authorization') === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
  ) {
    const result = await runSeasonReset(supabase, state, now, { promoPct, relePct, slots, slotDurationMin });
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  }
  const competitionStartedMs = state.competition_started_at ? new Date(state.competition_started_at).getTime() : now;
  const competitionDurationMs = (state.competition_duration_days ?? 7) * 86_400_000;
  const competitionEndsMs = competitionStartedMs + competitionDurationMs;
  const competitionEnded = now >= competitionEndsMs;

  const today = utcDateString(now);
  if (state.current_olefoot_day !== today) {
    await supabase.from('global_league_state').update({ current_olefoot_day: today }).eq('id', 'current');
  }

  const recovered = await recoverStaleLiveRound(supabase, now, state);
  if (recovered) {
    return new Response(JSON.stringify(recovered), { headers: { 'Content-Type': 'application/json' } });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CICLO DIÁRIO — rollover (meia-noite BRT) + abertura do mata-mata (19h BRT)
  // Roda ANTES do auto-start/processamento. Cada ação retorna (1 por tick).
  // ══════════════════════════════════════════════════════════════════════════
  const qualifyHour = state.daily_qualify_hour ?? 19;
  const koMaxSize = state.daily_ko_max_size ?? 32;
  const dailyPhase = state.daily_phase ?? 'qualifying';
  const brtDay = brtDayString(now);

  // (a) Virou o Dia Olefoot → limpa o mata-mata anterior, zera daily_*, qualifying
  if (isDayRollover(state.daily_date, now)) {
    if (state.daily_ko_season_id) {
      const { data: oldRounds } = await supabase
        .from('global_league_rounds').select('id').eq('season_id', state.daily_ko_season_id);
      const oldIds = (oldRounds ?? []).map((r: any) => r.id);
      if (oldIds.length > 0) {
        const { data: oldFx } = await supabase
          .from('global_league_fixtures').select('id').in('round_id', oldIds);
        const oldFxIds = (oldFx ?? []).map((f: any) => f.id);
        if (oldFxIds.length > 0) {
          await supabase.from('global_league_events').delete().in('fixture_id', oldFxIds);
          await supabase.from('global_league_fixtures').delete().in('id', oldFxIds);
        }
        await supabase.from('global_league_rounds').delete().in('id', oldIds);
      }
    }
    await supabase.from('global_league_teams').update({
      daily_points: 0, daily_matches_played: 0, daily_wins: 0, daily_draws: 0,
      daily_losses: 0, daily_goals_for: 0, daily_goals_against: 0, daily_goal_difference: 0,
    }).neq('id', '');
    await supabase.from('global_league_state').update({
      daily_date: brtDay, daily_phase: 'qualifying',
      daily_ko_season_id: null, daily_ko_size: null,
    }).eq('id', 'current');
    return new Response(JSON.stringify({
      ok: true, step: 'daily-rollover', day: brtDay,
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // (b) Hora do corte (19h BRT) → seleciona top N e abre o mata-mata
  if (shouldOpenKnockout(dailyPhase, qualifyHour, now)) {
    const { data: allTeams } = await supabase.from('global_league_teams').select('*');
    const teams = (allTeams as TeamRow[]) ?? [];
    const { size, qualifiers } = selectDailyQualifiers(teams, koMaxSize);
    if (size < 2) {
      await supabase.from('global_league_state').update({
        daily_phase: 'crowned', daily_ko_size: 0,
      }).eq('id', 'current');
      return new Response(JSON.stringify({
        ok: true, step: 'daily-knockout-skip', reason: 'not-enough-qualifiers',
        qualified: qualifiers.length,
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    const dkoSeasonId = `dko_${brtDay}`;
    const pairs = seedFirstRound(qualifiers);
    const built = buildDailyKnockoutRound(pairs, dkoSeasonId, 1, now);
    await supabase.from('global_league_rounds').upsert([built.round] as any, { onConflict: 'id' });
    await supabase.from('global_league_fixtures').upsert(built.fixtures as any, { onConflict: 'id' });
    await supabase.from('global_league_state').update({
      daily_phase: 'knockout', daily_ko_season_id: dkoSeasonId, daily_ko_size: size,
    }).eq('id', 'current');
    // PRÊMIO DE CLASSIFICAÇÃO — todo time que entrou no bracket ganha (idempotente).
    const qualifyCtx = { brtDay, competitionId: state.competition_id, seasonId: dkoSeasonId, now };
    await Promise.all(qualifiers.map((t) => writeKoPrize(supabase, t, 'qualified', KO_QUALIFY_PRIZE, qualifyCtx)));
    // Notifica os classificados — fire-and-forget, não bloqueia o motor
    const phaseName = dailyPhaseLabel(size);
    Promise.all(qualifiers.map((t, i) => notifyManager(
      supabase, t.manager_id, 'COMPETIÇÃO',
      `🏆 Você está no Mata-Mata do Dia!`,
      `Classificado em ${i + 1}º para a ${phaseName}. Próxima rodada em instantes em /match/global.`,
      '/match/global',
      { kind: 'daily_ko_qualified', daily_date: brtDay, rank: i + 1, bracket_size: size },
    ))).catch(() => { /* swallow */ });
    return new Response(JSON.stringify({
      ok: true, step: 'daily-knockout-open', size, fixtures: built.fixtures.length,
      phase: phaseTagFromSize(size),
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // NONSTOP MODE — competition_duration_days é IGNORADO.
  // (variável competitionEnded calculada acima fica intencionalmente não-usada)
  void competitionEnded;

  // ── Ciclo Híbrido: janela REST (21:30 → 05:30 BRT) ────────────────────────
  // Em REST a Liga DORME — pausa pra descanso/treinamento/relâmpago. Daily
  // rollover e KO acima já rodaram normalmente; só blindamos o motor da Liga
  // (auto-start, regen, processamento de rodada league).
  const inLeagueRest = isLeagueRestWindow(now);

  // 1. AUTO-START LIGA (modo "só liga, sem playoffs")
  // waiting_teams ou season_ended → distribui times em divisões e gera rodadas de liga
  if (!inLeagueRest && (state.status === 'waiting_teams' || state.status === 'season_ended')) {
    // GUARDA: o restart deleta TODOS os rounds/fixtures. Não pode rodar enquanto
    // há mata-mata diário vivo (knockout) nem antes da coroação ser exibida
    // (crowned) — espera a meia-noite BRT (rollover volta a 'qualifying').
    if (state.status === 'season_ended' && dailyPhase !== 'qualifying') {
      return new Response(JSON.stringify({
        ok: true, step: 'restart-deferred', reason: 'daily-knockout-in-progress',
        dailyPhase,
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    const { data: teamsData } = await supabase.from('global_league_teams').select('*');
    const teams = (teamsData as TeamRow[]) ?? [];
    if (teams.length < Math.max(2, state.min_teams_required ?? 2)) {
      return new Response(JSON.stringify({
        ok: true, step: 'auto-start', reason: 'not-enough-teams',
        teamCount: teams.length, min: state.min_teams_required,
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    // Se for restart (vinha de season_ended/active), abre nova season_id limpa
    const isRestart = state.status === 'season_ended';
    const seasonId = isRestart ? `season_${now}` : state.season_id;

    if (isRestart) {
      // Linha de chegada: a TEMPORADA INTEIRA acaba quando o LÍDER DA DIVISÃO 1
      // crava 1000 pts. As outras divisões encerram junto (cada uma coroa seu
      // líder atual, mesmo com <1000). Antes disso, cada fim de round-robin só
      // REGENERA rodadas mantendo pontos/divisões — a maratona continua.
      const div1Max = teams.reduce((m, t) => (t.division === 1 ? Math.max(m, t.points ?? 0) : m), 0);
      // #3 timing: só encerra DE MADRUGADA (após o mata-mata da noite + virada de
      // meia-noite). De dia, mesmo com Div 1 ≥ 1000, a liga só ESTENDE — o reset
      // espera a janela noturna. Round-robins completam a cada ~3,7h, então a
      // janela 0–6h sempre pega uma conclusão → reset garantido na madrugada.
      const seasonOver = div1Max >= seasonTarget && brtHour(now) < SEASON_RESET_HOUR;
      let reorganized: TeamRow[];
      if (seasonOver) {
        // FIM REAL DA TEMPORADA: coroa campeões → promo/rele → reseta pontos
        await crownDivisionChampions(supabase, teams, state, now);
        const oldDivById = new Map(teams.map((t) => [t.id, t.division]));
        const promoted = applyPromotionRelegationSoft(teams, promoPct, relePct);
        await notifyPromotions(supabase, promoted, oldDivById);
        reorganized = promoted.map((t) => ({
          ...t,
          points: 0, matches_played: 0, wins: 0, draws: 0, losses: 0,
          goals_for: 0, goals_against: 0, goal_difference: 0,
          recent_form: [], position: null,
        }));
      } else {
        // EXTEND: mantém pontos e divisões intactos (sem promo/rele/coroa)
        reorganized = teams;
      }
      // Incluir times órfãos (registrados mid-season) na 3ª divisão
      for (const team of reorganized) {
        if (!team.division) {
          team.division = 3;
          team.points = 0;
          team.matches_played = 0;
          team.wins = 0;
          team.draws = 0;
          team.losses = 0;
          team.goals_for = 0;
          team.goals_against = 0;
          team.goal_difference = 0;
          team.recent_form = [];
        }
      }
      await supabase.from('global_league_events').delete().neq('id', '');
      await supabase.from('global_league_fixtures').delete().neq('id', '');
      await supabase.from('global_league_rounds').delete().neq('id', '');
      await supabase.from('global_league_teams').upsert(reorganized as any, { onConflict: 'id' });
    } else {
      // Primeira vez: distribuir por overall em divisões
      const distributed = distributeIntoDivisions(teams);
      await supabase.from('global_league_teams').upsert(distributed as any, { onConflict: 'id' });
    }

    // Recarrega times com a divisão atualizada
    const { data: teamsAfter } = await supabase.from('global_league_teams').select('*');
    const teamsWithDiv = (teamsAfter as TeamRow[]) ?? [];

    const { rounds, fixtures } = generateLeagueRoundsAndFixtures(teamsWithDiv, seasonId, now, slots, slotDurationMin);
    if (rounds.length === 0) {
      return new Response(JSON.stringify({
        ok: true, step: 'auto-start', reason: 'gen-empty',
        teamCount: teamsWithDiv.length,
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    await supabase.from('global_league_rounds').upsert(rounds as any, { onConflict: 'id' });
    if (fixtures.length > 0) await supabase.from('global_league_fixtures').upsert(fixtures as any, { onConflict: 'id' });
    await supabase.from('global_league_state').update({
      status: 'active',
      season_id: seasonId,
      season_name: `OLEFOOT LIGA — ${seasonId}`,
      current_playoff_round: null,
      current_league_round: 1,
    }).eq('id', 'current');
    return new Response(JSON.stringify({
      ok: true, step: 'auto-start', action: isRestart ? 'restarted-league' : 'created-league',
      seasonId, rounds: rounds.length, fixtures: fixtures.length,
      firstKickoffUtc: new Date(rounds[0].scheduled_kickoff_ms).toISOString(),
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // 2. (PLAYOFFS DESATIVADO em modo nonstop "só liga")
  // Se por algum motivo state.status === 'playoffs', força flip para 'active'
  // e deixa o próximo tick processar as rodadas existentes.
  if (state.status === 'playoffs') {
    await supabase.from('global_league_state').update({
      status: 'active', current_playoff_round: null,
    }).eq('id', 'current');
    return new Response(JSON.stringify({
      ok: true, step: 'force-active', reason: 'nonstop-mode-skips-playoffs',
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // 3. TODAS RODADAS DA LIGA FINALIZADAS → REGENERA (loop sem pausa)
  // Skip em REST: não vira season_ended durante a noite, evita restart e
  // mantém o estado limpo pro tick das 05:30 reiniciar a Liga.
  if (!inLeagueRest && state.status === 'active') {
    const { data: lRounds } = await supabase
      .from('global_league_rounds').select('id, status, round_type')
      .eq('season_id', state.season_id).eq('round_type', 'league');
    const allFinished = (lRounds ?? []).length > 0 && (lRounds ?? []).every(r => r.status === 'finished');
    // Não vira season_ended durante o mata-mata diário: o restart deletaria o
    // bracket vivo. Fica 'active' (idle) até a meia-noite BRT zerar a fase.
    if (allFinished && dailyPhase === 'qualifying') {
      // Não pausa — vira season_ended e o próximo bloco de auto-start (acima)
      // já trata o restart na MESMA invocação? Não: já saímos do bloco 1.
      // Setamos season_ended e devolvemos — próximo tick (em 1 min) reinicia.
      await supabase.from('global_league_state').update({
        status: 'season_ended',
      }).eq('id', 'current');
      return new Response(JSON.stringify({
        ok: true, step: 'season-finished-will-restart',
        reason: 'all league rounds finished — next tick will restart the league',
        seasonId: state.season_id,
      }), { headers: { 'Content-Type': 'application/json' } });
    }
  }

  // 3.5 Incluir times órfãos na 3ª divisão + gerar fixtures mid-season
  // Skip em REST: igual blocos 1 e 3, evita carga DB desnecessária à noite.
  if (!inLeagueRest && state.status === 'active') {
    // (a) Setar division=3 para times sem divisão
    await supabase.from('global_league_teams').update({ division: 3 }).is('division', null);

    // (b) Detectar times na Div 3 sem fixtures nas rodadas futuras e gerar confrontos
    const [{ data: div3Teams }, { data: scheduledRounds }] = await Promise.all([
      supabase.from('global_league_teams').select('*').eq('division', 3),
      supabase.from('global_league_rounds').select('id,round_number,is_returning')
        .eq('season_id', state.season_id).eq('round_type', 'league').eq('status', 'scheduled')
        .order('round_number', { ascending: true }),
    ]);
    const d3teams = (div3Teams as TeamRow[] | null) ?? [];
    const futureRounds = (scheduledRounds as Array<{ id: string; round_number: number; is_returning: boolean }>) ?? [];
    if (d3teams.length >= 2 && futureRounds.length > 0) {
      const futureRoundIds = futureRounds.map(r => r.id);
      const { data: existingFx } = await supabase
        .from('global_league_fixtures').select('home_team_id,away_team_id')
        .in('round_id', futureRoundIds).eq('division', '3');
      const teamsWithFx = new Set<string>();
      for (const fx of (existingFx ?? []) as Array<{ home_team_id: string; away_team_id: string }>) {
        teamsWithFx.add(fx.home_team_id); teamsWithFx.add(fx.away_team_id);
      }
      const newTeams = d3teams.filter(t => !teamsWithFx.has(t.id));
      const existingDiv3 = d3teams.filter(t => teamsWithFx.has(t.id));
      if (newTeams.length > 0 && existingDiv3.length > 0) {
        const fxToInsert: any[] = [];
        for (const nt of newTeams) {
          let oppIdx = 0;
          for (const rd of futureRounds) {
            if (oppIdx >= existingDiv3.length) oppIdx = 0;
            const opp = existingDiv3[oppIdx];
            const [h, a] = rd.is_returning ? [opp, nt] : [nt, opp];
            fxToInsert.push({
              id: NEW_ID(), round_id: rd.id, division: '3',
              home_team_id: h.id, away_team_id: a.id,
              home_team_name: h.club_name, away_team_name: a.club_name,
              home_overall: h.overall, away_overall: a.overall,
              score_home: 0, score_away: 0, current_minute: 0, status: 'scheduled',
            });
            oppIdx++;
          }
        }
        if (fxToInsert.length > 0) {
          await supabase.from('global_league_fixtures').upsert(fxToInsert as any, { onConflict: 'id' });
          console.log(`[tick] integrateNewTeams: ${fxToInsert.length} fixtures for ${newTeams.map(t => t.club_name).join(', ')}`);
        }
      }
    }
  }

  // 4. PROCESSA RODADA PENDENTE
  // Em REST: ignora rodadas 'league' (Liga dorme), mas processa 'daily_ko'
  // pra garantir que uma final atrasada ainda fecha.
  const pendingQuery = supabase
    .from('global_league_rounds').select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_kickoff_ms', now)
    .order('scheduled_kickoff_ms', { ascending: true })
    .limit(1);
  const { data: pending, error: pendingErr } = await (inLeagueRest
    ? pendingQuery.neq('round_type', 'league')
    : pendingQuery);
  if (pendingErr) {
    return new Response(JSON.stringify({ ok: false, step: 'fetch-pending', error: pendingErr.message }), { status: 500 });
  }
  if (!pending || pending.length === 0) {
    const nextKickoff = nextSlotAlignedKickoff(now, slots, slotDurationMin);
    return new Response(JSON.stringify({
      ok: true, step: 'idle',
      reason: inLeagueRest ? 'league-rest-window' : 'no-pending-rounds',
      cyclePhase: inLeagueRest ? 'rest' : 'active',
      status: state.status, currentDay: today,
      nextSlotKickoffUtc: new Date(nextKickoff).toISOString(),
      msUntilNext: nextKickoff - now,
      slots, slotDurationMin,
      competitionId: state.competition_id,
      competitionEndsAtUtc: new Date(competitionEndsMs).toISOString(),
      competitionEndsInMs: competitionEndsMs - now,
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const round = pending[0] as RoundRow;
  const isPlayoff = round.round_type === 'playoff';

  // Lock idempotente: tenta mover status scheduled → live atomicamente.
  // .select('id') depois de .update() retorna as linhas afetadas. Não usar
  // { count, head } aqui — o PostgrestTransformBuilder ignora o 2º argumento
  // após um .update() e count volta null, fazendo a função abandonar a
  // rodada que ela mesma acabou de pôr em 'live' (loop infinito).
  const { data: lockedRows, error: lockErr } = await supabase
    .from('global_league_rounds')
    .update({ status: 'live', actual_kickoff_ms: now })
    .eq('id', round.id)
    .eq('status', 'scheduled') // só atualiza se ainda 'scheduled'
    .select('id');
  if (lockErr) {
    return new Response(JSON.stringify({
      ok: false, step: 'lock-round', roundId: round.id, error: lockErr.message,
    }), { status: 500 });
  }
  if (!lockedRows || lockedRows.length === 0) {
    return new Response(JSON.stringify({
      ok: true, step: 'skip-duplicate', roundId: round.id,
      reason: 'round already processed by concurrent tick',
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // ── 4a. MATA-MATA DIÁRIO: pênaltis no empate, avança o bracket ou coroa ────
  if (round.round_type === 'daily_ko') {
    const { data: koFx, error: koFxErr } = await supabase
      .from('global_league_fixtures').select('*').eq('round_id', round.id);
    if (koFxErr || !koFx) {
      await supabase.from('global_league_rounds').update({ status: 'scheduled', actual_kickoff_ms: null }).eq('id', round.id);
      return new Response(JSON.stringify({ ok: false, step: 'daily-ko-fetch-fixtures', error: koFxErr?.message }), { status: 500 });
    }
    const koTeamIds = new Set<string>();
    for (const fx of koFx as FixtureRow[]) { koTeamIds.add(fx.home_team_id); koTeamIds.add(fx.away_team_id); }
    const { data: koTeamsData } = await supabase.from('global_league_teams').select('*').in('id', Array.from(koTeamIds));
    const koTeamById = new Map<string, TeamRow>();
    for (const t of (koTeamsData as TeamRow[] | null) ?? []) koTeamById.set(t.id, t);

    const koFxUpdated: any[] = [];
    const koEvents: any[] = [];
    // ordena por índice do confronto p/ preservar a ordem do bracket nos avanços
    const orderedFx = [...(koFx as FixtureRow[])].sort((a, b) => dailyFixtureMatchIndex(a.id) - dailyFixtureMatchIndex(b.id));
    for (const fx of orderedFx) {
      const home = koTeamById.get(fx.home_team_id);
      const away = koTeamById.get(fx.away_team_id);
      const effH = home ? effectiveOverall(home) : fx.home_overall;
      const effA = away ? effectiveOverall(away) : fx.away_overall;
      const m = simulateKnockoutMatch(effH, effA);
      koFxUpdated.push({
        ...fx, score_home: m.scoreHome, score_away: m.scoreAway,
        penalty_score_home: m.penHome, penalty_score_away: m.penAway, went_to_penalties: m.wentToPens,
        status: 'finished', kickoff_ms: now, finished_at_ms: now + SIM_DURATION_MS,
      });
      const placeGoals = (side: 'home' | 'away', total: number) => {
        for (let i = 0; i < total; i++) {
          const minute = Math.max(1, Math.min(90, Math.floor((90 / (total + 1)) * (i + 1))));
          const teamName = side === 'home' ? fx.home_team_name : fx.away_team_name;
          koEvents.push({
            id: `evt_${fx.id}_${side}_g${i}_${now}`, fixture_id: fx.id, event_type: 'goal',
            minute, side, text: `⚽ GOL! ${teamName} marca!`, highlight: true,
            timestamp_ms: now + minute * 1000,
          });
        }
      };
      placeGoals('home', m.scoreHome);
      placeGoals('away', m.scoreAway);
      if (m.wentToPens) {
        koEvents.push({
          id: `evt_${fx.id}_pens_${now}`, fixture_id: fx.id, event_type: 'penalty',
          minute: 90, side: m.winner,
          text: `🥅 Pênaltis: ${fx.home_team_name} ${m.penHome} x ${m.penAway} ${fx.away_team_name}`,
          highlight: true, timestamp_ms: now + 91 * 1000,
        });
      }
    }

    if (koFxUpdated.length > 0) await supabase.from('global_league_fixtures').upsert(koFxUpdated as any, { onConflict: 'id' });
    if (koEvents.length > 0) await supabase.from('global_league_events').upsert(koEvents as any, { onConflict: 'id' });

    // Notifica winner/loser de cada fixture (exceto a final — coroação é tratada
    // pelo advanceOrCrownDailyKo). Fire-and-forget, não bloqueia o motor.
    const currentSize = koFxUpdated.length * 2;
    const nextSize = Math.max(2, currentSize / 2);
    const isFinal = currentSize === 2;
    const phaseName = dailyPhaseLabel(currentSize);
    const nextPhaseName = dailyPhaseLabel(nextSize);
    const notifPromises: Promise<void>[] = [];
    for (const fx of koFxUpdated as FixtureRow[]) {
      const side = dailyWinnerSide(fx);
      if (!side) continue;
      const winnerId = side === 'home' ? fx.home_team_id : fx.away_team_id;
      const loserId = side === 'home' ? fx.away_team_id : fx.home_team_id;
      const winner = koTeamById.get(winnerId);
      const loser = koTeamById.get(loserId);
      const scoreLine = (fx as any).went_to_penalties
        ? `${fx.score_home}–${fx.score_away} (P ${(fx as any).penalty_score_home}–${(fx as any).penalty_score_away})`
        : `${fx.score_home}–${fx.score_away}`;
      if (loser && loser.manager_id) {
        notifPromises.push(notifyManager(
          supabase, loser.manager_id, 'COMPETIÇÃO',
          `Eliminado nas ${phaseName}`,
          `${loser.club_name} ${scoreLine} ${winner?.club_name ?? ''}. Volte amanhã pra disputar a próxima Coroa.`,
          '/match/global',
          { kind: 'daily_ko_eliminated', daily_date: brtDay, phase: phaseName },
        ));
      }
      if (!isFinal && winner && winner.manager_id) {
        notifPromises.push(notifyManager(
          supabase, winner.manager_id, 'COMPETIÇÃO',
          `🎯 Você passou às ${nextPhaseName}!`,
          `${winner.club_name} venceu ${scoreLine} e segue vivo no Mata-Mata do Dia.`,
          '/match/global',
          { kind: 'daily_ko_advanced', daily_date: brtDay, to_phase: nextPhaseName },
        ));
      }
    }
    Promise.all(notifPromises).catch(() => { /* swallow */ });

    // Avança/coroa a partir das fixtures finalizadas (helper idempotente) e SÓ
    // ENTÃO marca o round finished. Se um crash interromper antes desta última
    // linha, o round fica 'live' e a recuperação refaz o avanço/coroa sem dano.
    const outcome = await advanceOrCrownDailyKo(supabase, round, koFxUpdated as FixtureRow[], koTeamById, now, state);
    await supabase.from('global_league_rounds').update({ status: 'finished', finished_at_ms: now + SIM_DURATION_MS }).eq('id', round.id);
    return new Response(JSON.stringify({
      ok: true, step: outcome.step, ...(outcome.detail ?? {}), day: brtDay, matches: koFxUpdated.length,
    }), { headers: { 'Content-Type': 'application/json' } });

  }

  const { data: fixtures, error: fxErr } = await supabase
    .from('global_league_fixtures').select('*').eq('round_id', round.id);
  if (fxErr || !fixtures) {
    return new Response(JSON.stringify({ ok: false, step: 'fetch-fixtures', error: fxErr?.message }), { status: 500 });
  }
  const teamIds = new Set<string>();
  for (const fx of fixtures as FixtureRow[]) { teamIds.add(fx.home_team_id); teamIds.add(fx.away_team_id); }
  const { data: preTeams } = await supabase.from('global_league_teams').select('*').in('id', Array.from(teamIds));
  const teamById = new Map<string, TeamRow>();
  for (const t of (preTeams as TeamRow[] | null) ?? []) teamById.set(t.id, t);

  const fixturesUpdated: FixtureRow[] = [];
  const eventsToInsert: any[] = [];
  const teamDelta = new Map<string, { gf: number; ga: number }>();
  const newInjuries = new Map<string, { modifier: number; rounds: number }>();
  const yellowsThisRound = new Map<string, number>(); // teamId → amarelos nesta rodada
  const redsThisRound = new Map<string, number>(); // teamId → vermelhos nesta rodada

  for (const fx of fixtures as FixtureRow[]) {
    const home = teamById.get(fx.home_team_id);
    const away = teamById.get(fx.away_team_id);

    // Ponto 4: WO — elenco incompleto (<11 disponíveis) = derrota 3x0.
    // REGRA: inatividade NUNCA causa WO. O WO só dispara com evidência REAL e
    // recente de elenco curto (sync nas últimas 72h mostrando <11). Sem sync
    // recente, presumimos elenco cheio descontando só desfalques conhecidos
    // (suspensão/lesão) e nunca caímos abaixo de 11 — senão times de managers
    // passivos forfeitariam toda rodada e a liga viraria uma epidemia de 0×0.
    const estimateAvailable = (t: TeamRow | undefined): number => {
      if (!t) return 25;
      const updatedAt = t.available_player_count_updated_at ? new Date(t.available_player_count_updated_at).getTime() : 0;
      const staleHours = updatedAt > 0 ? (now - updatedAt) / (60 * 60 * 1000) : Infinity;
      // Sync recente (<72h) → é a única fonte em que confiamos pra declarar WO.
      if (updatedAt > 0 && staleHours < 72) return t.available_player_count;
      // Fallback (sem sync recente): elenco cheio menos desfalques conhecidos,
      // com piso em 11 pra que a ausência de sync jamais vire forfeit.
      const suspPenalty = (t.suspension_rounds_remaining ?? 0) > 0 ? 3 : 0;
      const injPenalty = (t.injury_rounds_remaining ?? 0) > 0 ? 2 : 0;
      return Math.max(11, 25 - suspPenalty - injPenalty);
    };
    const homeAvailable = estimateAvailable(home);
    const awayAvailable = estimateAvailable(away);
    const homeWO = homeAvailable < 11;
    const awayWO = awayAvailable < 11;

    if (homeWO || awayWO) {
      // WO: time com elenco incompleto perde 0x3
      const woScoreHome = homeWO ? 0 : 3;
      const woScoreAway = awayWO ? 0 : 3;
      const woEvents: any[] = [];
      if (homeWO) {
        woEvents.push({
          id: `evt_${fx.id}_home_wo_${now}`,
          fixture_id: fx.id, event_type: 'walkover', minute: 0, side: 'home',
          text: `⚠️ WO — ${fx.home_team_name} sem elenco mínimo (${homeAvailable}/11)`, highlight: true,
          timestamp_ms: now,
        });
      }
      if (awayWO) {
        woEvents.push({
          id: `evt_${fx.id}_away_wo_${now}`,
          fixture_id: fx.id, event_type: 'walkover', minute: 0, side: 'away',
          text: `⚠️ WO — ${fx.away_team_name} sem elenco mínimo (${awayAvailable}/11)`, highlight: true,
          timestamp_ms: now,
        });
      }
      fixturesUpdated.push({ ...fx, score_home: woScoreHome, score_away: woScoreAway, status: 'finished', kickoff_ms: now, finished_at_ms: now + SIM_DURATION_MS, wo_home: homeWO, wo_away: awayWO });
      for (const ev of woEvents) eventsToInsert.push(ev);
      const ha = teamDelta.get(fx.home_team_id) ?? { gf: 0, ga: 0 }; ha.gf += woScoreHome; ha.ga += woScoreAway; teamDelta.set(fx.home_team_id, ha);
      const aa = teamDelta.get(fx.away_team_id) ?? { gf: 0, ga: 0 }; aa.gf += woScoreAway; aa.ga += woScoreHome; teamDelta.set(fx.away_team_id, aa);
      continue;
    }

    // Ponto 10: Rivalidade — 3+ confrontos na temporada = clássico
    const homeEncounters = home?.rivalry_encounters ?? {};
    const awayEncounters = away?.rivalry_encounters ?? {};
    const encounterCount = (homeEncounters[fx.away_team_id] ?? 0);
    const isRivalry = encounterCount >= 2; // 3º+ confronto (0-indexed: 0,1,2...)

    const effH = home ? effectiveOverall(home) : fx.home_overall;
    const effA = away ? effectiveOverall(away) : fx.away_overall;
    const sim = simulateFixture(fx, effH, effA, now, { isRivalry });
    fixturesUpdated.push({ ...fx, score_home: sim.score_home, score_away: sim.score_away, status: 'finished', kickoff_ms: now, finished_at_ms: now + SIM_DURATION_MS, wo_home: false, wo_away: false });
    for (const ev of sim.events) eventsToInsert.push(ev);
    const ha = teamDelta.get(fx.home_team_id) ?? { gf: 0, ga: 0 }; ha.gf += sim.score_home; ha.ga += sim.score_away; teamDelta.set(fx.home_team_id, ha);
    const aa = teamDelta.get(fx.away_team_id) ?? { gf: 0, ga: 0 }; aa.gf += sim.score_away; aa.ga += sim.score_home; teamDelta.set(fx.away_team_id, aa);
    if (sim.injured_side) {
      const injuredId = sim.injured_side === 'home' ? fx.home_team_id : fx.away_team_id;
      const modifier = -(2 + Math.floor(Math.random() * 3));
      const rounds = 1 + Math.floor(Math.random() * 2);
      const existing = newInjuries.get(injuredId);
      newInjuries.set(injuredId, {
        modifier: existing && existing.modifier < modifier ? existing.modifier : modifier,
        rounds: existing && existing.rounds > rounds ? existing.rounds : rounds,
      });
    }
    // Acumular amarelos por time nesta rodada
    if (sim.home_yellow) yellowsThisRound.set(fx.home_team_id, (yellowsThisRound.get(fx.home_team_id) ?? 0) + 1);
    if (sim.away_yellow) yellowsThisRound.set(fx.away_team_id, (yellowsThisRound.get(fx.away_team_id) ?? 0) + 1);
    // Acumular vermelhos
    if (sim.home_red) redsThisRound.set(fx.home_team_id, (redsThisRound.get(fx.home_team_id) ?? 0) + 1);
    if (sim.away_red) redsThisRound.set(fx.away_team_id, (redsThisRound.get(fx.away_team_id) ?? 0) + 1);
  }
  if (fixturesUpdated.length > 0) await supabase.from('global_league_fixtures').upsert(fixturesUpdated as any, { onConflict: 'id' });
  if (eventsToInsert.length > 0) await supabase.from('global_league_events').upsert(eventsToInsert as any, { onConflict: 'id' });
  if (teamById.size > 0) {
    // Construir mapa de confrontos desta rodada para atualizar rivalry_encounters
    const encountersThisRound = new Map<string, string[]>(); // teamId → [opponentIds]
    for (const fx of fixtures as FixtureRow[]) {
      const homeOpps = encountersThisRound.get(fx.home_team_id) ?? [];
      homeOpps.push(fx.away_team_id);
      encountersThisRound.set(fx.home_team_id, homeOpps);
      const awayOpps = encountersThisRound.get(fx.away_team_id) ?? [];
      awayOpps.push(fx.home_team_id);
      encountersThisRound.set(fx.away_team_id, awayOpps);
    }

    // Corrida do Dia Olefoot: só rodadas de LIGA somam daily_* (playoff/WO não).
    const accrueDaily = round.round_type === 'league';
    const updated = Array.from(teamById.values()).map((t) => {
      const d = teamDelta.get(t.id);
      let next = d ? updateTeamRow(t, d.gf, d.ga, isPlayoff, accrueDaily) : t;
      // Decrementar suspensão pendente
      if (next.suspension_rounds_remaining > 0) {
        next = { ...next, suspension_rounds_remaining: next.suspension_rounds_remaining - 1 };
      }
      // Aplicar amarelos desta rodada e verificar acúmulo (3 = 1 rodada suspensão)
      const newYellows = yellowsThisRound.get(next.id) ?? 0;
      if (newYellows > 0) {
        const totalYellows = (next.yellow_card_count ?? 0) + newYellows;
        if (totalYellows >= 3) {
          next = { ...next, yellow_card_count: 0, suspension_rounds_remaining: (next.suspension_rounds_remaining ?? 0) + 1 };
        } else {
          next = { ...next, yellow_card_count: totalYellows };
        }
      }
      // Aplicar vermelhos desta rodada (cada vermelho = +1 rodada suspensão)
      const newReds = redsThisRound.get(next.id) ?? 0;
      if (newReds > 0) {
        next = { ...next, suspension_rounds_remaining: (next.suspension_rounds_remaining ?? 0) + newReds };
      }
      // Decrementar lesão pendente
      if (next.injury_rounds_remaining > 0) {
        const remaining = next.injury_rounds_remaining - 1;
        next = { ...next, injury_rounds_remaining: remaining, injury_modifier: remaining === 0 ? 0 : next.injury_modifier };
      }
      const fresh = newInjuries.get(next.id);
      if (fresh) {
        next = {
          ...next,
          injury_modifier: next.injury_modifier < fresh.modifier ? next.injury_modifier : fresh.modifier,
          injury_rounds_remaining: next.injury_rounds_remaining > fresh.rounds ? next.injury_rounds_remaining : fresh.rounds,
        };
      }
      // Atualizar rivalry_encounters
      const opponents = encountersThisRound.get(next.id) ?? [];
      if (opponents.length > 0) {
        const encounters = { ...(next.rivalry_encounters ?? {}) };
        for (const oppId of opponents) {
          encounters[oppId] = (encounters[oppId] ?? 0) + 1;
        }
        next = { ...next, rivalry_encounters: encounters };
      }
      return next;
    });
    await supabase.from('global_league_teams').upsert(updated as any, { onConflict: 'id' });
  }
  await supabase.from('global_league_rounds').update({ status: 'finished', finished_at_ms: now + SIM_DURATION_MS }).eq('id', round.id);
  const stateUpdate: Record<string, unknown> = {};
  if (isPlayoff) stateUpdate.current_playoff_round = round.round_number + 1;
  else stateUpdate.current_league_round = round.round_number + 1;
  await supabase.from('global_league_state').update(stateUpdate).eq('id', 'current');

  return new Response(JSON.stringify({
    ok: true, step: 'process-round',
    roundId: round.id, type: round.round_type,
    fixtures: fixturesUpdated.length, events: eventsToInsert.length,
    nextRound: round.round_number + 1, currentDay: today,
    competitionEndsInMs: competitionEndsMs - now,
  }), { headers: { 'Content-Type': 'application/json' } });
});
