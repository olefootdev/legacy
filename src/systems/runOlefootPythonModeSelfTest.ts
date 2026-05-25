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
import {
  shouldApplyAbsenceEffects,
  buildAbsenceSideEffects,
} from './engagement/absenceEffects';
import { getAbsenceEffect } from './engagement/absencePenalty';
import { buildGlobalImpactSummary } from './consequences/fromGlobalFixture';

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

function testAbsenceActiveEffects(): void {
  section('Sistema E — Penalidades ATIVAS por ausência');

  const t0 = Date.UTC(2026, 4, 27, 18, 0);

  // Sem aplicação prévia, tier normal: não aplica
  assert(
    !shouldApplyAbsenceEffects(undefined, 'normal'),
    'Tier normal não dispara efeitos',
  );
  // Tier warning ainda não aplica (só a partir de moderate)
  assert(
    !shouldApplyAbsenceEffects(undefined, 'warning_12h'),
    'Tier warning_12h não dispara side-effects',
  );
  assert(
    !shouldApplyAbsenceEffects(undefined, 'mild_24h'),
    'Tier mild_24h não dispara side-effects',
  );
  // Moderate aplica
  assert(
    shouldApplyAbsenceEffects(undefined, 'moderate_36h'),
    'Tier moderate_36h dispara efeitos pela primeira vez',
  );
  // Já aplicou moderate, não re-aplica
  assert(
    !shouldApplyAbsenceEffects('moderate_36h', 'moderate_36h'),
    'Moderate já aplicada não re-dispara',
  );
  // Escalou pra heavy — aplica de novo
  assert(
    shouldApplyAbsenceEffects('moderate_36h', 'heavy_48h'),
    'Escalação moderate→heavy dispara novamente',
  );
  // Crisis após heavy aplica
  assert(
    shouldApplyAbsenceEffects('heavy_48h', 'crisis_72h'),
    'Escalação heavy→crisis dispara',
  );

  // Side effects: heavy gera 2 lesões + drop torcida + inbox
  const sideHeavy = buildAbsenceSideEffects({
    managerId: 'mgr1',
    clubId: 'club1',
    eligiblePlayerIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
    tier: 'heavy_48h',
    effect: getAbsenceEffect('heavy_48h'),
    hoursAbsent: 52,
    now: t0,
  });
  // Heavy: 2 lesões = 2 ImpactEvents → cada injury_light gera 2 templates
  // (injury_light_out + physical_attr_drop_light) → 4 consequências de lesão
  // + 1 crowd_support_drop = 5 total
  const injuryCons = sideHeavy.consequences.filter((c) => c.kind.startsWith('injury_'));
  assert(injuryCons.length === 2, 'Heavy: 2 lesões "out" geradas');
  const crowdCons = sideHeavy.consequences.find((c) => c.kind === 'crowd_support_drop');
  assert(!!crowdCons, 'Heavy: crowd_support_drop gerada');
  assert(crowdCons!.magnitude === -10, 'Heavy: crowd_support magnitude -10');
  assert(sideHeavy.inboxItems.length === 1, 'Heavy: 1 item de inbox gerado');

  // Crisis: 3 lesões + -20 crowd
  const sideCrisis = buildAbsenceSideEffects({
    managerId: 'mgr1',
    clubId: 'club1',
    eligiblePlayerIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
    tier: 'crisis_72h',
    effect: getAbsenceEffect('crisis_72h'),
    hoursAbsent: 80,
    now: t0,
  });
  const crisisInjuries = sideCrisis.consequences.filter((c) => c.kind.startsWith('injury_'));
  assert(crisisInjuries.length === 3, 'Crisis: 3 lesões "out" geradas');
  const crisisCrowd = sideCrisis.consequences.find((c) => c.kind === 'crowd_support_drop');
  assert(crisisCrowd?.magnitude === -20, 'Crisis: crowd_support -20');

  // Eligibles vazios: nenhuma lesão (sem jogadores disponíveis)
  const sideEmpty = buildAbsenceSideEffects({
    managerId: 'mgr1',
    clubId: 'club1',
    eligiblePlayerIds: [],
    tier: 'heavy_48h',
    effect: getAbsenceEffect('heavy_48h'),
    hoursAbsent: 52,
    now: t0,
  });
  const emptyInjuries = sideEmpty.consequences.filter((c) => c.kind.startsWith('injury_'));
  assert(emptyInjuries.length === 0, 'Sem jogadores elegíveis: zero lesões');
  assert(
    sideEmpty.consequences.some((c) => c.kind === 'crowd_support_drop'),
    'Mas crowd_support segue ativo (independente de jogadores)',
  );

  // Treino: multiplier por tier
  assert(getAbsenceEffect('normal').trainingMultiplier === 1, 'Normal: treino 100%');
  assert(getAbsenceEffect('warning_12h').trainingMultiplier === 0.9, 'Warning: treino 90%');
  assert(getAbsenceEffect('mild_24h').trainingMultiplier === 0, 'Mild: treino zerado');
  assert(getAbsenceEffect('moderate_36h').trainingMultiplier === 0, 'Moderate: treino zerado');

  // Fatigue regen: gate em moderate+
  assert(getAbsenceEffect('warning_12h').fatigueRegenEnabled, 'Warning: fadiga regenera');
  assert(getAbsenceEffect('mild_24h').fatigueRegenEnabled, 'Mild: fadiga ainda regenera');
  assert(!getAbsenceEffect('moderate_36h').fatigueRegenEnabled, 'Moderate: fadiga não regenera');
  assert(!getAbsenceEffect('heavy_48h').fatigueRegenEnabled, 'Heavy: fadiga não regenera');
}

// ─── Run ──────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════');
console.log(' OLEFOOT PYTHON MODE — Self-test');
console.log('═══════════════════════════════════════════════════');

function testGlobalFixtureBridge(): void {
  section('Sistema A — Bridge da Liga Global (FINISH_GLOBAL_ROUND)');

  // Fixture do MEU clube (home), vermelho do nosso lado, hat-trick
  const mineFixture: any = {
    id: 'f1',
    roundId: 'r1',
    division: '1',
    homeTeamId: 'my_club',
    awayTeamId: 'rival',
    homeTeamName: 'My FC',
    awayTeamName: 'Rival FC',
    homeOverall: 80,
    awayOverall: 78,
    scoreHome: 3,
    scoreAway: 0,
    currentMinute: 90,
    status: 'finished',
    events: [
      { id: 'e1', fixtureId: 'f1', type: 'goal', minute: 10, side: 'home', playerId: 'p1', text: '', timestampMs: 1 },
      { id: 'e2', fixtureId: 'f1', type: 'goal', minute: 45, side: 'home', playerId: 'p1', text: '', timestampMs: 2 },
      { id: 'e3', fixtureId: 'f1', type: 'goal', minute: 80, side: 'home', playerId: 'p1', text: '', timestampMs: 3 },
      { id: 'e4', fixtureId: 'f1', type: 'red_card', minute: 85, side: 'home', playerId: 'p2', text: '', timestampMs: 4 },
      { id: 'e5', fixtureId: 'f1', type: 'injury', minute: 88, side: 'home', playerId: 'p3', text: '', timestampMs: 5 },
      // Eventos do rival — devem ser ignorados
      { id: 'e6', fixtureId: 'f1', type: 'red_card', minute: 70, side: 'away', playerId: 'enemy1', text: '', timestampMs: 6 },
    ],
  };

  const summary = buildGlobalImpactSummary({
    fixture: mineFixture,
    managerId: 'mgr1',
    clubId: 'my_club',
    myTeamId: 'my_club',
  });
  assert(summary !== null, 'Fixture do meu clube → summary não-null');
  assert(summary!.redCardPlayerIds.length === 1, 'Apenas 1 vermelho (do nosso lado)');
  assert(summary!.redCardPlayerIds[0] === 'p2', 'Vermelho é do p2');
  assert(summary!.hatTrickPlayerIds.length === 1, 'p1 fez hat-trick');
  assert(summary!.hatTrickPlayerIds[0] === 'p1', 'Hat-trick é do p1');
  assert(summary!.mvpPlayerId === 'p1', 'MVP = top scorer = p1');
  assert(summary!.injuries.length === 1, '1 lesão leve do nosso lado');
  assert(summary!.injuries[0]!.playerId === 'p3', 'Lesionado = p3');
  assert(summary!.scoreFor === 3 && summary!.scoreAgainst === 0, 'Score 3x0 (home)');

  // Fixture onde sou visitante
  const awayFixture: any = {
    ...mineFixture,
    homeTeamId: 'rival',
    awayTeamId: 'my_club',
    scoreHome: 4,
    scoreAway: 1,
    events: [
      { id: 'a1', fixtureId: 'f2', type: 'goal', minute: 30, side: 'away', playerId: 'p1', text: '', timestampMs: 1 },
      { id: 'a2', fixtureId: 'f2', type: 'red_card', minute: 60, side: 'away', playerId: 'p2', text: '', timestampMs: 2 },
    ],
  };
  const awaySummary = buildGlobalImpactSummary({
    fixture: awayFixture,
    managerId: 'mgr1',
    clubId: 'my_club',
    myTeamId: 'my_club',
  });
  assert(awaySummary !== null, 'Fixture como visitante → summary não-null');
  assert(awaySummary!.scoreFor === 1 && awaySummary!.scoreAgainst === 4, 'Score invertido: 1 pro / 4 contra (goleada sofrida)');
  assert(awaySummary!.redCardPlayerIds.length === 1, 'Vermelho do nosso lado mesmo como visitante');

  // Fixture que NÃO envolve meu clube → null
  const otherFixture: any = {
    ...mineFixture,
    homeTeamId: 'team_a',
    awayTeamId: 'team_b',
    events: [],
  };
  const nullSummary = buildGlobalImpactSummary({
    fixture: otherFixture,
    managerId: 'mgr1',
    clubId: 'my_club',
    myTeamId: 'my_club',
  });
  assert(nullSummary === null, 'Fixture sem meu clube → null (defesa contra processar partidas alheias)');
}

testTimeCalibration();
testConsequencesRedCard();
testConsequencesInjuryAndOverlay();
testConsequencesMvpAndDecay();
testCheckInAndAbsence();
testLoginBonus();
testQuickHooks();
testAbsenceActiveEffects();
testGlobalFixtureBridge();

console.log('\n═══════════════════════════════════════════════════');
console.log(` Resultado: ${passed} passou, ${failed} falhou`);
console.log('═══════════════════════════════════════════════════');

if (failed > 0) {
  console.error('\nFalhas:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
