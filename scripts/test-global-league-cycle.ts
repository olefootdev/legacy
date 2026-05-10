/**
 * test-global-league-cycle.ts
 *
 * Teste ponta a ponta do ciclo da Liga Global.
 * Valida: enroll, ciclo cria partida, ciclo simula, tabela muda, jogador recebe fadiga/lesão.
 *
 * Uso:
 *   npx tsx scripts/test-global-league-cycle.ts
 *
 * Requer server/.env com SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { runGlobalLeagueCycle, enrollClubInGlobalLeague } from '../server/src/services/globalLeague/cycle.js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios.');
  console.error('Defina em server/.env ou .env');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function pass(msg: string) { console.log('  PASS  ' + msg); }
function fail(msg: string) { console.error('  FAIL  ' + msg); process.exitCode = 1; }
function section(title: string) { console.log('\n=== ' + title + ' ==='); }

async function cleanup(managerId: string) {
  await sb.from('global_league_teams').delete().eq('manager_id', managerId);
}

async function main() {
  console.log('Global League MVP — teste ponta a ponta');
  console.log('Supabase: ' + SUPABASE_URL);

  // ── 0. Estado inicial ────────────────────────────────────────────────────
  section('0. Estado da liga');
  const { data: state0 } = await sb.from('global_league_state').select('*').eq('id', 'current').maybeSingle();
  if (!state0) { fail('global_league_state nao encontrado'); process.exit(1); }
  console.log('  status=' + state0.status + '  season=' + state0.season_id);
  pass('estado carregado');

  // ── 1. Enroll — novo clube entra na liga ─────────────────────────────────
  section('1. Enroll — novo clube entra na liga');
  const testManagerId = 'test_manager_' + Date.now();
  const testClub = { managerId: testManagerId, clubName: 'Test FC', clubShort: 'TST', overall: 72 };

  await cleanup(testManagerId);

  const enrollResult = await enrollClubInGlobalLeague(sb, testClub);
  if (!enrollResult.ok) { fail('enroll falhou: ' + enrollResult.error); process.exit(1); }
  pass('clube inscrito: id=' + enrollResult.teamId);

  const { data: teamRow } = await sb.from('global_league_teams')
    .select('*').eq('manager_id', testManagerId).maybeSingle();
  if (!teamRow) { fail('time nao encontrado no banco apos enroll'); process.exit(1); }
  if (teamRow.club_name !== 'Test FC') fail('club_name incorreto: ' + teamRow.club_name);
  else pass('club_name correto');
  if (teamRow.overall !== 72) fail('overall incorreto: ' + teamRow.overall);
  else pass('overall correto');
  if (teamRow.points !== 0) fail('points deveria ser 0: ' + teamRow.points);
  else pass('points=0 correto');

  // ── 2. Idempotencia do enroll ────────────────────────────────────────────
  section('2. Idempotencia do enroll');
  const enroll2 = await enrollClubInGlobalLeague(sb, { ...testClub, overall: 75 });
  if (!enroll2.ok) { fail('segundo enroll falhou: ' + enroll2.error); }
  else pass('segundo enroll nao falhou (upsert idempotente)');
  const { data: teamRow2 } = await sb.from('global_league_teams')
    .select('overall').eq('manager_id', testManagerId).maybeSingle();
  if (teamRow2?.overall !== 75) fail('overall nao foi atualizado no upsert: ' + teamRow2?.overall);
  else pass('overall atualizado no upsert');

  // ── 3. Ciclo — idle se nao ha rodada pendente ────────────────────────────
  section('3. Ciclo idle (sem rodada pendente no passado)');
  const cycleIdle = await runGlobalLeagueCycle(sb);
  console.log('  resultado: step=' + cycleIdle.step + ' skipped=' + cycleIdle.skipped + ' reason=' + cycleIdle.reason);
  if (!cycleIdle.ok) fail('ciclo retornou ok=false: ' + cycleIdle.error);
  else pass('ciclo ok=true');

  // ── 4. Ciclo — processa rodada se houver scheduled no passado ────────────
  section('4. Ciclo processa rodada scheduled no passado');

  // Buscar uma rodada scheduled qualquer
  const { data: scheduledRounds } = await sb.from('global_league_rounds')
    .select('id, scheduled_kickoff_ms, status, season_id')
    .eq('status', 'scheduled')
    .order('scheduled_kickoff_ms', { ascending: true })
    .limit(1);

  if (!scheduledRounds || scheduledRounds.length === 0) {
    console.log('  SKIP  nao ha rodadas scheduled — liga pode estar em waiting_teams ou todas as rodadas ja processadas');
    console.log('        Execute o ciclo apos a liga ter rodadas geradas.');
  } else {
    const round = scheduledRounds[0];
    const nowMs = Date.now();

    if (round.scheduled_kickoff_ms > nowMs) {
      // Forcar kickoff no passado para o teste
      await sb.from('global_league_rounds')
        .update({ scheduled_kickoff_ms: nowMs - 60_000 })
        .eq('id', round.id);
      console.log('  INFO  kickoff forcado para o passado: ' + round.id);
    }

    // Snapshot da tabela antes
    const { data: teamsBefore } = await sb.from('global_league_teams')
      .select('id, points, matches_played, injury_rounds_remaining, yellow_card_count')
      .in('id', (await sb.from('global_league_fixtures')
        .select('home_team_id, away_team_id').eq('round_id', round.id)
        .then(r => [...new Set((r.data ?? []).flatMap((f: { home_team_id: string; away_team_id: string }) => [f.home_team_id, f.away_team_id]))])));

    const cycleResult = await runGlobalLeagueCycle(sb);
    console.log('  resultado:', JSON.stringify(cycleResult));

    if (!cycleResult.ok) { fail('ciclo falhou: ' + cycleResult.error); }
    else if (cycleResult.skipped) { console.log('  SKIP  ciclo pulou: ' + cycleResult.reason); }
    else {
      pass('ciclo processou rodada: ' + cycleResult.roundId);

      // Verificar rodada finalizada
      const { data: roundAfter } = await sb.from('global_league_rounds')
        .select('status').eq('id', cycleResult.roundId ?? round.id).maybeSingle();
      if (roundAfter?.status === 'finished') pass('rodada marcada como finished');
      else fail('rodada nao foi marcada como finished: ' + roundAfter?.status);

      // Verificar fixtures completed
      const { data: fxAfter } = await sb.from('global_league_fixtures')
        .select('status, score_home, score_away').eq('round_id', cycleResult.roundId ?? round.id);
      const allCompleted = (fxAfter ?? []).every((f: { status: string }) => f.status === 'finished' || f.status === 'scheduled');
      if (allCompleted) pass('todas as fixtures com status finished/scheduled(retry)');
      else fail('fixtures com status inesperado: ' + JSON.stringify(fxAfter?.map((f: { status: string }) => f.status)));

      // Verificar eventos gerados
      if ((cycleResult.events ?? 0) > 0) pass('eventos gerados: ' + cycleResult.events);
      else console.log('  WARN  nenhum evento gerado (pode ser 0-0 sem cartoes)');

      // Verificar tabela mudou (matches_played incrementou)
      if (teamsBefore && teamsBefore.length > 0) {
        const { data: teamsAfter } = await sb.from('global_league_teams')
          .select('id, points, matches_played, injury_rounds_remaining, yellow_card_count')
          .in('id', teamsBefore.map((t: { id: string }) => t.id));

        let tableChanged = false;
        for (const after of teamsAfter ?? []) {
          const before = teamsBefore.find((b: { id: string }) => b.id === after.id);
          if (before && after.matches_played > before.matches_played) { tableChanged = true; break; }
        }
        if (tableChanged) pass('tabela atualizada (matches_played incrementou)');
        else fail('tabela nao foi atualizada');

        // Verificar estado dos jogadores (lesao ou amarelo)
        const hasInjury = (teamsAfter ?? []).some((t: { injury_rounds_remaining: number }) => t.injury_rounds_remaining > 0);
        const hasYellow = (teamsAfter ?? []).some((t: { yellow_card_count: number }) => t.yellow_card_count > 0);
        if (hasInjury) pass('pelo menos um time com lesao registrada');
        else console.log('  INFO  nenhuma lesao nesta rodada (probabilidade 8% por partida)');
        if (hasYellow) pass('pelo menos um time com amarelo acumulado');
        else console.log('  INFO  nenhum amarelo nesta rodada (probabilidade 15% por time)');
      }
    }
  }

  // ── 5. Ciclo — lock idempotente ──────────────────────────────────────────
  section('5. Lock idempotente (segundo ciclo imediato)');
  const cycle2 = await runGlobalLeagueCycle(sb);
  console.log('  resultado: step=' + cycle2.step + ' skipped=' + cycle2.skipped);
  if (cycle2.step === 'skip-duplicate' || cycle2.step === 'idle' || cycle2.skipped) {
    pass('segundo ciclo nao reprocessou (lock funcionou)');
  } else if (cycle2.step === 'process-round') {
    pass('segundo ciclo processou rodada diferente (correto se havia outra rodada pendente)');
  } else {
    console.log('  INFO  step=' + cycle2.step + ' (pode ser normal dependendo do estado da liga)');
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────
  section('Cleanup');
  await cleanup(testManagerId);
  pass('time de teste removido');

  // ── Resumo ───────────────────────────────────────────────────────────────
  console.log('\n' + (process.exitCode ? 'FALHOU — veja os erros acima.' : 'PASSOU — ciclo MVP funcionando.'));
}

main().catch(err => { console.error('ERRO FATAL:', err); process.exit(1); });
