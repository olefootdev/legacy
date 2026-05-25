/**
 * Self-test do OLEFOOT PYTHON MODE.
 *
 * Cenários sintéticos validando os 3 sistemas novos:
 *   A — Impacto Persistente (consequências com decay)
 *   B — Ritmo Dia/Noite + Slots
 *   E — Engajamento (check-in, ausência, login bonus)
 *
 * Roda com: npm run test:olefoot-python-mode
 */
import {
  MS_PER_HOUR,
  isWeekendBrt,
  isNightRegenWindow,
  matchesInInterval,
  brtDateString,
} from './timeCalibration';
import {
  getCurrentSlot,
  getNextSlot,
  isCompetitivePauseActive,
} from './daySchedule';
import {
  EMPTY_CONSEQUENCE_STORE,
  addManyConsequences,
  evaluateConsequence,
  isPlayerUnavailable,
  sumEffectiveForTarget,
  tickConsequences,
} from './consequences/store';
import {
  computeClubOverlay,
  computePlayerOverlay,
} from './consequences/applyOverlay';
import {
  eventsFromMatchSummary,
  materializeBatch,
} from './consequences/handlers';
import { recordCheckIn, hoursSinceLastLogin } from './engagement/checkIn';
import {
  evaluateAbsence,
  getAbsenceTier,
} from './engagement/absencePenalty';
import {
  attemptClaim,
  canClaimNow,
  getIntervalHours,
  previewNextReward,
} from './engagement/loginBonus';
import { autoDetectHooks } from './engagement/quickHooks';
import { EMPTY_PRESENCE, type ManagerPresence } from './engagement/types';

// ─── Test runner ───────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, msg: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    failed += 1;
    failures.push(msg);
    console.error(`  ✗ ${msg}`);
  }
}

function section(name: string): void {
  console.log(`\n── ${name} ──`);
}

// ─── Tests ─────────────────────────────────────────────────────────

function testTimeCalibration(): void {
  section('Sistema B — Calibração temporal');

  // Quarta 2026-05-27 09:30 BRT = 12:30 UTC
  const wedMorning = Date.UTC(2026, 4, 27, 12, 30);
  assert(!isWeekendBrt(wedMorning), 'Quarta-feira não é fim de semana');
  assert(getIntervalHours(wedMorning) === 3, 'Intervalo de bonus em dia útil = 3h');

  // Sábado 2026-05-30 14:00 BRT = 17:00 UTC
  const satAfternoon = Date.UTC(2026, 4, 30, 17, 0);
  assert(isWeekendBrt(satAfternoon), 'Sábado é fim de semana');
  assert(getIntervalHours(satAfternoon) === 1, 'Intervalo de bonus no fim de semana = 1h');

  // Noite regen: 2026-05-27 23:30 BRT = 02:30 UTC do dia 28
  const lateNight = Date.UTC(2026, 4, 28, 2, 30);
  assert(isNightRegenWindow(lateNight), '23:30 BRT está na noite regen');
  assert(isCompetitivePauseActive(lateNight), 'Pausa competitiva ativa de madrugada');

  // 05:30 BRT exato = início do dia ativo
  const wakeMs = Date.UTC(2026, 4, 27, 8, 30); // 05:30 BRT
  assert(!isNightRegenWindow(wakeMs), '05:30 BRT NÃO é noite regen (início do dia)');

  // Matches per interval
  const oneHour = matchesInInterval(0, MS_PER_HOUR);
  assert(oneHour === 12, '1h reais = 12 partidas');
  assert(matchesInInterval(0, 2 * MS_PER_HOUR) === 24, '2h = 24 partidas (suspensão vermelho)');

  // Slots
  const morningCoffeeMs = Date.UTC(2026, 4, 27, 12, 35); // 09:35 BRT
  const slot = getCurrentSlot(morningCoffeeMs);
  assert(slot.id === 'morning_coffee', '09:35 BRT cai em morning_coffee');
  assert(slot.kind === 'short', 'Boletim do café é slot curto');

  const lunchMs = Date.UTC(2026, 4, 27, 15, 30); // 12:30 BRT
  const lunchSlot = getCurrentSlot(lunchMs);
  assert(lunchSlot.id === 'lunch', '12:30 BRT cai em lunch');
  assert(lunchSlot.kind === 'long', 'Almoço é slot longo');

  const primeMs = Date.UTC(2026, 4, 28, 1, 0); // 22:00 BRT do dia 27
  const primeSlot = getCurrentSlot(primeMs);
  assert(primeSlot.id === 'prime_time', '22:00 BRT cai em prime_time');
  assert(primeSlot.bigEventTarget === true, 'Prime time é alvo de grandes eventos');

  // Next slot transition
  const nextFromWake = getNextSlot(Date.UTC(2026, 4, 27, 9, 0)); // 06:00 BRT
  assert(nextFromWake.slot.id === 'commute_morning', 'Após wake vem commute_morning');

  // BRT date
  const someMs = Date.UTC(2026, 4, 27, 5, 0); // 02:00 BRT (ainda dia 26)
  assert(brtDateString(someMs) === '2026-05-27', 'BRT date conta corretamente');
}

function testConsequencesRedCard(): void {
  section('Sistema A — Cartão vermelho gera consequências calibradas');

  const t0 = Date.UTC(2026, 4, 27, 18, 0); // 15:00 BRT
  const events = eventsFromMatchSummary({
    managerId: 'mgr1',
    clubId: 'club1',
    matchId: 'match1',
    scoreFor: 1,
    scoreAgainst: 1,
    redCardPlayerIds: ['p1'],
    hatTrickPlayerIds: [],
    injuries: [],
    exhaustedPlayerIds: [],
  });
  assert(events.length === 1 && events[0]!.kind === 'red_card_direct', 'Vermelho gera 1 ImpactEvent');

  const consequences = materializeBatch(events);
  assert(consequences.length === 2, 'Vermelho gera 2 consequências (suspensão + moral)');

  // Manualmente garantir startsAt = t0 (substitui Date.now)
  const fixedConsequences = consequences.map((c) => ({
    ...c,
    startsAt: t0,
    expiresAt: t0 + (c.expiresAt - c.startsAt),
  }));

  const store = addManyConsequences(EMPTY_CONSEQUENCE_STORE, fixedConsequences);

  // T+1h: ainda suspenso
  const t1h = t0 + 1 * MS_PER_HOUR;
  assert(isPlayerUnavailable(store, 'p1', t1h), 'Jogador segue suspenso 1h após vermelho');

  // T+2h: NÃO mais suspenso (step decay → 0 ao expirar)
  const t2h = t0 + 2 * MS_PER_HOUR + 1;
  assert(!isPlayerUnavailable(store, 'p1', t2h), 'Suspensão expira em 2h exatas');

  // Moral ainda decaindo aos 2h
  const moralAt2h = sumEffectiveForTarget(
    store,
    { playerId: 'p1', dimension: 'psychological' },
    t2h,
  );
  assert(moralAt2h < 0, 'Moral negativo 2h depois (5d de decay)');
  assert(moralAt2h > -5, 'Moral já decaiu parcialmente (linear)');

  // Tick remove expirados
  const { next, expiredIds } = tickConsequences(store, t2h);
  assert(expiredIds.length === 1, 'Tick remove a suspensão expirada');
  assert(Object.keys(next.active).length === 1, 'Store fica com 1 consequência (moral)');
}

function testConsequencesInjuryAndOverlay(): void {
  section('Sistema A — Lesão grave + overlay no jogador/clube');

  const t0 = Date.UTC(2026, 4, 27, 18, 0);
  const events = eventsFromMatchSummary({
    managerId: 'mgr1',
    clubId: 'club1',
    matchId: 'match2',
    scoreFor: 0,
    scoreAgainst: 4, // goleada sofrida
    redCardPlayerIds: [],
    hatTrickPlayerIds: [],
    injuries: [{ playerId: 'p2', severity: 'severe' }],
    exhaustedPlayerIds: [],
  });
  assert(events.length === 2, 'Lesão grave + goleada sofrida = 2 eventos');

  const cs = materializeBatch(events).map((c) => ({
    ...c,
    startsAt: t0,
    expiresAt: t0 + (c.expiresAt - c.startsAt),
  }));
  const store = addManyConsequences(EMPTY_CONSEQUENCE_STORE, cs);

  const t5h = t0 + 5 * MS_PER_HOUR;
  const playerOv5 = computePlayerOverlay(store, 'p2', t5h);
  assert(playerOv5.unavailable, 'Jogador indisponível em 5h (lesão de 60h)');
  assert(playerOv5.moralDelta < 0, 'Moral abalado');
  assert(playerOv5.marketValueMultiplier < 1, 'Valor mercado reduzido');

  const clubOv5 = computeClubOverlay(store, 'club1', t5h);
  assert(clubOv5.crowdSupportDelta < 0, 'Goleada reduz apoio da torcida (janela 10h)');
  assert(clubOv5.boardPressureActive, 'Goleada ativa pressão da diretoria');

  // T+30h: crowd_support_drop (10h) já expirou, mas lesão (60h) e moral (168h) seguem
  const t30h = t0 + 30 * MS_PER_HOUR;
  const playerOv30 = computePlayerOverlay(store, 'p2', t30h);
  assert(playerOv30.unavailable, 'Jogador segue indisponível em 30h');
  assert(playerOv30.moralDelta < 0, 'Moral ainda decaindo em 30h (5d total)');
  const clubOv30 = computeClubOverlay(store, 'club1', t30h);
  assert(clubOv30.crowdSupportDelta === 0, 'Apoio da torcida volta ao normal em 30h (crowd_support_drop = 10h)');

  // T+61h: lesão expirou (60h step)
  const t61h = t0 + 61 * MS_PER_HOUR;
  const playerOv61 = computePlayerOverlay(store, 'p2', t61h);
  assert(!playerOv61.unavailable, 'Jogador volta após 60h');
}

function testConsequencesMvpAndDecay(): void {
  section('Sistema A — MVP gera bônus com decay linear');

  const t0 = Date.UTC(2026, 4, 27, 18, 0);
  const events = eventsFromMatchSummary({
    managerId: 'mgr1',
    clubId: 'club1',
    matchId: 'match3',
    scoreFor: 3,
    scoreAgainst: 1,
    redCardPlayerIds: [],
    hatTrickPlayerIds: [],
    injuries: [],
    exhaustedPlayerIds: [],
    mvpPlayerId: 'p3',
  });
  const cs = materializeBatch(events).map((c) => ({
    ...c,
    startsAt: t0,
    expiresAt: t0 + (c.expiresAt - c.startsAt),
  }));
  const store = addManyConsequences(EMPTY_CONSEQUENCE_STORE, cs);

  // T+0: magnitude total
  const at0 = evaluateConsequence(cs.find((c) => c.kind === 'morale_boost_mvp')!, t0);
  assert(Math.abs(at0.currentValue - 6) < 0.01, 'MVP moral = +6 em t0');

  // T+36h (metade dos 72h): linear → ~3
  const at36 = evaluateConsequence(cs.find((c) => c.kind === 'morale_boost_mvp')!, t0 + 36 * MS_PER_HOUR);
  assert(at36.currentValue > 2.5 && at36.currentValue < 3.5, 'Linear decay: ~3 em t+36h');

  // T+72h+: zerou
  const at72 = evaluateConsequence(cs.find((c) => c.kind === 'morale_boost_mvp')!, t0 + 73 * MS_PER_HOUR);
  assert(at72.currentValue === 0, 'Bônus zerou após expirar');
}

function testCheckInAndAbsence(): void {
  section('Sistema E — Check-in + ausência');

  const t0 = Date.UTC(2026, 4, 27, 18, 0);
  let presence: ManagerPresence | undefined = undefined;
  presence = recordCheckIn(presence, 'mgr1', t0);
  assert(presence.totalSessions === 1, 'Primeira sessão registrada');
  assert(hoursSinceLastLogin(presence, t0) === 0, '0h desde login agora');

  // 13h depois: tier warning
  const t13h = t0 + 13 * MS_PER_HOUR;
  const eval13 = evaluateAbsence(presence, t13h);
  assert(eval13.tier === 'warning_12h', '13h sem login → warning_12h');
  assert(eval13.effect.trainingMultiplier === 0.9, 'Treino -10% no warning');

  // 25h: mild
  const t25h = t0 + 25 * MS_PER_HOUR;
  const eval25 = evaluateAbsence(presence, t25h);
  assert(eval25.tier === 'mild_24h', '25h → mild_24h');
  assert(eval25.effect.trainingMultiplier === 0, 'Treino parado em mild');

  // 50h: heavy
  const eval50 = evaluateAbsence(presence, t0 + 50 * MS_PER_HOUR);
  assert(eval50.tier === 'heavy_48h', '50h → heavy_48h');
  assert(eval50.effect.randomInjuryCount === 2, 'Heavy: 2 lesões automáticas');

  // 100h: crise
  const eval100 = evaluateAbsence(presence, t0 + 100 * MS_PER_HOUR);
  assert(eval100.tier === 'crisis_72h', '100h → crisis_72h');
  assert(eval100.effect.starPlayerDepartureRisk, 'Estrelas considerando sair em crise');
  assert(eval100.effect.crowdSupportDelta === -20, 'Apoio torcida -20% em crise');

  // Helper boundary 0h
  const at0 = getAbsenceTier(0);
  assert(at0 === 'normal', '0h ausente → normal');
}

function testLoginBonus(): void {
  section('Sistema E — Login bonus 3h/1h');

  // Quarta 09:00 BRT = 12:00 UTC
  const wedMorning = Date.UTC(2026, 4, 27, 12, 0);
  let presence: ManagerPresence = recordCheckIn(undefined, 'mgr1', wedMorning);

  // Primeira tentativa: pode reivindicar
  assert(canClaimNow(presence, wedMorning), 'Sem claim prévio → pode reivindicar');
  const first = attemptClaim(presence, wedMorning);
  assert(first.result.claimed, 'Primeiro claim bem-sucedido');
  assert(first.result.reward!.kind === 'exp_small', 'Primeiro slot → exp_small');
  presence = first.nextPresence;

  // Imediatamente: bloqueado
  const second = attemptClaim(presence, wedMorning + 60 * 1000);
  assert(!second.result.claimed, 'Claim 1min depois é bloqueado');
  assert(second.result.blockedReason === 'too_soon', 'Razão = too_soon');

  // 3h depois (semana): liberado
  const third = attemptClaim(presence, wedMorning + 3 * MS_PER_HOUR + 1000);
  assert(third.result.claimed, 'Claim 3h depois (semana) ok');
  assert(third.result.slotIndex === 2, 'Slot 2 (streak crescendo)');
  presence = third.nextPresence;

  // Slot 4: pack basic
  let t = wedMorning + 3 * MS_PER_HOUR + 1000;
  for (let i = 0; i < 2; i++) {
    t += 3 * MS_PER_HOUR + 1000;
    const claim = attemptClaim(presence, t);
    presence = claim.nextPresence;
  }
  // Agora estamos no slot 4 (3 + 1 = 4 claims feitos, próximo é slot 4)
  // Próximo claim será slot 5? Verifica preview no slot 4
  const previewAt4 = previewNextReward(presence, t + 3 * MS_PER_HOUR + 1000);
  assert(
    previewAt4.kind === 'pack_basic' || previewAt4.kind.startsWith('exp_'),
    'Preview retorna recompensa válida',
  );

  // Fim de semana: intervalo 1h
  const satMorning = Date.UTC(2026, 4, 30, 12, 0); // sábado 09:00 BRT
  const weekendPresence: ManagerPresence = {
    ...EMPTY_PRESENCE('mgr2'),
    lastLoginAt: satMorning,
  };
  assert(getIntervalHours(satMorning) === 1, 'Fim de semana: intervalo 1h');
  const wkClaim = attemptClaim(weekendPresence, satMorning);
  assert(wkClaim.result.claimed, 'Primeiro claim fim de semana ok');
  assert(wkClaim.result.isWeekend, 'Resultado marca como fim de semana');

  // 30min depois (fim de semana): ainda bloqueado
  const wkBlocked = attemptClaim(wkClaim.nextPresence, satMorning + 30 * 60 * 1000);
  assert(!wkBlocked.result.claimed, 'Fim de semana: 30min ainda bloqueia');

  // 1h depois: liberado
  const wkOk = attemptClaim(wkClaim.nextPresence, satMorning + 60 * 60 * 1000 + 1000);
  assert(wkOk.result.claimed, 'Fim de semana: 1h libera próximo claim');
}

function testQuickHooks(): void {
  section('Sistema E — Quick hooks');

  const t0 = Date.UTC(2026, 4, 27, 12, 0);

  // Hooks com lesão grave recente
  const hooks = autoDetectHooks(
    {
      recentResults: [],
      activeConsequences: [
        {
          id: 'c1',
          managerId: 'mgr1',
          clubId: 'club1',
          playerId: 'p1',
          kind: 'injury_severe_out',
          dimension: 'physical',
          scope: 'player',
          magnitude: 1,
          decayCurve: 'step',
          startsAt: t0 - 10 * 60 * 1000, // 10min atrás
          expiresAt: t0 + 60 * MS_PER_HOUR,
        },
      ],
      streakDays: 5,
    },
    t0,
  );
  assert(hooks.length > 0, 'Detectou pelo menos 1 hook');
  assert(
    hooks.some((h) => h.kind === 'cliffhanger'),
    'Lesão grave gera cliffhanger',
  );
  assert(
    hooks.some((h) => h.kind === 'streak_preservation'),
    'Streak ativa gera preservation hook',
  );

  // Limite 3 hooks
  const many = autoDetectHooks(
    {
      recentResults: [],
      activeConsequences: [],
      streakDays: 5,
      nextMatchOpponent: 'Rival FC',
      nextMatchAtMs: t0 + 5 * 60 * 1000,
      pendingTransferOffers: [
        { playerName: 'P1', expiresAtMs: t0 + 10 * 60 * 1000 },
        { playerName: 'P2', expiresAtMs: t0 + 20 * 60 * 1000 },
      ],
    },
    t0,
  );
  assert(many.length <= 3, 'Máximo 3 hooks simultâneos');
  // Prioridade: match_starting (95) > time_limited_offer (90) > streak (85)
  assert(many[0]!.kind === 'match_starting', 'Primeiro hook é o mais prioritário');
}

// ─── Run ──────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════');
console.log(' OLEFOOT PYTHON MODE — Self-test');
console.log('═══════════════════════════════════════════════════');

testTimeCalibration();
testConsequencesRedCard();
testConsequencesInjuryAndOverlay();
testConsequencesMvpAndDecay();
testCheckInAndAbsence();
testLoginBonus();
testQuickHooks();

console.log('\n═══════════════════════════════════════════════════');
console.log(` Resultado: ${passed} passou, ${failed} falhou`);
console.log('═══════════════════════════════════════════════════');

if (failed > 0) {
  console.error('\nFalhas:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
