/**
 * runQuickMatchClockSelfTest
 * --------------------------
 * Reproduz o fluxo de tick da Partida Rápida em terminal:
 *   1. Loop temporal — minute / footballElapsedSec NUNCA podem decrescer
 *   2. Finalização aos 90' — phase tem que virar 'postgame' sem necessidade de FORFEIT
 *
 * Estratégia: chama `runMatchMinute` direto (em vez do reducer completo, que
 * depende de Vite via `import.meta.env`). Replica a checagem do reducer:
 *   if (lm.minute >= 90 && lm.phase === 'playing') promoteToPostgame(lm).
 *
 * npx tsx src/simulation/runQuickMatchClockSelfTest.ts
 */
import type { LiveMatchSnapshot, PitchPlayerState, MatchEventEntry } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';
import type { MatchPlayerAttributes } from '@/match/playerInMatch';
import { defaultSlotOrder } from '@/formation/layout433';
import { runMatchMinute } from '@/engine/runMatchMinute';

const baseAttrs: MatchPlayerAttributes = {
  passeCurto: 72,
  passeLongo: 68,
  cruzamento: 62,
  marcacao: 70,
  velocidade: 74,
  fairPlay: 68,
  drible: 70,
  finalizacao: 72,
  fisico: 72,
  tatico: 70,
  mentalidade: 70,
  confianca: 70,
};

function makePitchPlayer(slotId: string, i: number): PitchPlayerState {
  const role =
    slotId === 'gol'
      ? 'gk'
      : ['zag1', 'zag2', 'le', 'ld', 'vol'].includes(slotId)
        ? 'def'
        : slotId.startsWith('mc')
          ? 'mid'
          : 'attack';
  return {
    playerId: `home-${slotId}`,
    slotId,
    name: slotId.toUpperCase(),
    num: i + 1,
    pos: slotId,
    x: 50,
    y: 48,
    fatigue: 14,
    role,
    attributes: { ...baseAttrs },
  } as PitchPlayerState;
}

function makePlayerEntity(slotId: string, i: number): PlayerEntity {
  return {
    id: `home-${slotId}`,
    name: slotId.toUpperCase(),
    num: i + 1,
    pos: slotId,
    attrs: { ...baseAttrs },
    fatigue: 14,
    outForMatches: 0,
    nivel: 50,
    moral: 50,
    forma: 50,
  } as unknown as PlayerEntity;
}

function makeLive(): { snapshot: LiveMatchSnapshot; roster: PlayerEntity[]; allPlayers: Record<string, PlayerEntity> } {
  const order = defaultSlotOrder();
  const matchLineupBySlot: Record<string, string> = {};
  const homePlayers: PitchPlayerState[] = order.map((slotId, i) => {
    matchLineupBySlot[slotId] = `home-${slotId}`;
    return makePitchPlayer(slotId, i);
  });
  const roster: PlayerEntity[] = order.map((slotId, i) => makePlayerEntity(slotId, i));
  const allPlayers: Record<string, PlayerEntity> = {};
  for (const p of roster) allPlayers[p.id] = p;

  const awayRoster = [
    { id: 'away-1', num: 1, name: 'GK', pos: 'GOL' },
    { id: 'away-2', num: 2, name: 'LD', pos: 'LD' },
    { id: 'away-3', num: 3, name: 'LE', pos: 'LE' },
    { id: 'away-4', num: 4, name: 'ZAG1', pos: 'ZAG' },
    { id: 'away-5', num: 5, name: 'ZAG2', pos: 'ZAG' },
    { id: 'away-6', num: 6, name: 'VOL', pos: 'VOL' },
    { id: 'away-7', num: 7, name: 'MC1', pos: 'MC' },
    { id: 'away-8', num: 8, name: 'MC2', pos: 'MC' },
    { id: 'away-9', num: 9, name: 'PE', pos: 'PE' },
    { id: 'away-10', num: 10, name: 'PD', pos: 'PD' },
    { id: 'away-11', num: 11, name: 'ATA', pos: 'ATA' },
  ];

  const initialEvent: MatchEventEntry = {
    id: 'init-whistle',
    minute: 0,
    text: "0' — Bola rolando.",
    kind: 'whistle',
  };

  const snapshot: LiveMatchSnapshot = {
    mode: 'quick',
    phase: 'playing',
    minute: 0,
    homeScore: 0,
    awayScore: 0,
    homeShort: 'HOM',
    awayShort: 'AWY',
    possession: 'home',
    ball: { x: 52, y: 48 },
    homeFormationScheme: '4-3-3',
    awayFormationScheme: '4-3-3',
    homePlayers,
    events: [initialEvent],
    homeStats: {},
    matchLineupBySlot,
    substitutionsUsed: 0,
    awaySubstitutionsUsed: 0,
    travelKm: 0,
    engineSimPhase: 'LIVE',
    causalLog: { nextSeq: 1, entries: [] },
    homeImpactLedger: [],
    homeCaptainPlayerId: homePlayers[0]?.playerId,
    footballElapsedSec: 0,
    spiritPhase: 'open_play',
    spiritOverlay: null,
    penalty: null,
    spiritBuildupGkTicksRemaining: 0,
    spiritMomentumClamp01: null,
    preGoalHint: null,
    isCompetitive: false,
    opponentType: 'bot',
    awayRoster,
    awayRosterAtKickoff: awayRoster.map((p) => ({ ...p })),
  } as unknown as LiveMatchSnapshot;

  return { snapshot, roster, allPlayers };
}

/** Replica a promoção do reducer (runTick em src/game/reducer.ts:422). */
function promoteToPostgame(lm: LiveMatchSnapshot): LiveMatchSnapshot {
  const minute = Math.max(lm.minute, 90);
  const whistle: MatchEventEntry = {
    id: `final-${Date.now()}-${Math.random()}`,
    minute,
    text: `${minute}' — Apito final.`,
    kind: 'whistle',
  };
  return {
    ...lm,
    phase: 'postgame',
    events: [whistle, ...lm.events],
    spiritOverlay: null,
    penalty: null,
    activeInteractiveMoment: null,
    quickInjurySub: null,
    preGoalHint: null,
    pendingCornerForSide: null,
    pendingFreeKickForSide: null,
  };
}

interface Sample {
  step: number;
  minute: number;
  footballElapsedSec: number;
  phase: string;
  hasPenalty: boolean;
  hasInteractive: boolean;
  hasInjurySub: boolean;
  spiritOverlayKind: string | undefined;
}

function snap(step: number, lm: LiveMatchSnapshot): Sample {
  return {
    step,
    minute: lm.minute,
    footballElapsedSec: lm.footballElapsedSec ?? 0,
    phase: lm.phase,
    hasPenalty: !!lm.penalty,
    hasInteractive: !!lm.activeInteractiveMoment,
    hasInjurySub: !!lm.quickInjurySub,
    spiritOverlayKind: lm.spiritOverlay?.kind,
  };
}

function dumpAnomaly(prev: Sample, cur: Sample): string | null {
  if (cur.minute < prev.minute) {
    return `minute regrediu: ${prev.minute} -> ${cur.minute}`;
  }
  if (cur.footballElapsedSec < prev.footballElapsedSec) {
    return `footballElapsedSec regrediu: ${prev.footballElapsedSec} -> ${cur.footballElapsedSec}`;
  }
  if (prev.phase === 'postgame' && cur.phase === 'playing') {
    return `phase voltou de postgame -> playing`;
  }
  return null;
}

function runOnce(label: string): {
  ok: boolean;
  reason: string;
  samples: Sample[];
  steps: number;
  endPhase: string;
  endMinute: number;
  stalledOnModal: boolean;
} {
  const { snapshot: initial, roster, allPlayers } = makeLive();
  let lm: LiveMatchSnapshot = initial;
  const samples: Sample[] = [snap(0, lm)];
  let prev = samples[0];
  let anomaly: string | null = null;
  let stalledOnModal = false;
  let consecutiveStalled = 0;

  const MAX_STEPS = 400;
  // Watchdog: imita o WATCHDOG_MS=240s da UI. Em ticks (1 tick = ~1s real),
  // 240 ticks é o cap. Acima disso, simulamos o `END_MATCH_TO_POST` do UI.
  const WATCHDOG_TICKS = 240;
  let modalStallTicks = 0;

  for (let i = 1; i <= MAX_STEPS; i++) {
    if (lm.phase !== 'playing') break;
    if (lm.minute >= 90) {
      // Espelha fix do UI: force promote se chegou a 90 ainda em 'playing'.
      lm = promoteToPostgame(lm);
      const cur = snap(i, lm);
      samples.push(cur);
      break;
    }
    if (i >= WATCHDOG_TICKS) {
      // Watchdog do UI dispara — força fim.
      lm = promoteToPostgame(lm);
      const cur = snap(i, lm);
      samples.push(cur);
      break;
    }

    // Espelha o loop UI: pula tick sob modal aberto e auto-resolve.
    if (lm.penalty) {
      modalStallTicks++;
      // UI auto-advance via spiritOverlay effect (~2s por estágio).
      // Aqui resolvemos imediatamente pra acelerar.
      if (lm.penalty.stage === 'kick') {
        // Resolução determinística (rng=0.5 ≈ goal)
        // Mas precisamos chamar via reducer — sem isso só limpamos o flag.
        // Workaround: marca penalty=null direto (motor headless não precisa
        // do efeito de gol, só queremos sair do estado bloqueante).
        lm = { ...lm, penalty: null, spiritOverlay: null };
      } else {
        // Avança pra próxima fase ou limpa
        lm = { ...lm, penalty: null, spiritOverlay: null };
      }
      if (modalStallTicks > 20) {
        stalledOnModal = true;
        break;
      }
      const cur = snap(i, lm);
      samples.push(cur);
      prev = cur;
      continue;
    }
    if (lm.activeInteractiveMoment) {
      // UI auto-resolve em 5s. Aqui resolvemos imediato.
      lm = { ...lm, activeInteractiveMoment: null };
      const cur = snap(i, lm);
      samples.push(cur);
      prev = cur;
      continue;
    }
    if (lm.quickInjurySub) {
      // UI auto-close em 5s. Aqui resolvemos imediato.
      lm = { ...lm, quickInjurySub: null };
      const cur = snap(i, lm);
      samples.push(cur);
      prev = cur;
      continue;
    }
    modalStallTicks = 0;

    const out = runMatchMinute({
      snapshot: lm,
      homeRoster: roster,
      allPlayers,
      crowdSupport: 50,
      tacticalMentality: 75,
      tacticalStyle: undefined as any,
      opponentStrength: 70,
      awayShort: 'AWY',
    });
    lm = out.snapshot;
    if (lm.minute >= 90 && lm.phase === 'playing') {
      lm = promoteToPostgame(lm);
    }
    const cur = snap(i, lm);
    const an = dumpAnomaly(prev, cur);
    if (an && !anomaly) anomaly = an;
    samples.push(cur);
    prev = cur;
  }

  const reachedFullTime = lm.minute >= 90;
  const endedPostgame = lm.phase === 'postgame';
  if (anomaly) {
    return { ok: false, reason: `[${label}] anomalia: ${anomaly}`, samples, steps: samples.length - 1, endPhase: lm.phase, endMinute: lm.minute, stalledOnModal };
  }
  if (stalledOnModal) {
    return { ok: false, reason: `[${label}] travou em modal (UI sem callback)`, samples, steps: samples.length - 1, endPhase: lm.phase, endMinute: lm.minute, stalledOnModal };
  }
  if (!reachedFullTime) {
    return { ok: false, reason: `[${label}] não chegou aos 90' (parou em ${lm.minute}', phase=${lm.phase})`, samples, steps: samples.length - 1, endPhase: lm.phase, endMinute: lm.minute, stalledOnModal };
  }
  if (!endedPostgame) {
    return { ok: false, reason: `[${label}] chegou aos 90' mas phase=${lm.phase}`, samples, steps: samples.length - 1, endPhase: lm.phase, endMinute: lm.minute, stalledOnModal };
  }
  return { ok: true, reason: `[${label}] OK`, samples, steps: samples.length - 1, endPhase: lm.phase, endMinute: lm.minute, stalledOnModal };
}

function main() {
  console.log('▶ Quick Match Clock Self-Test\n');
  const RUNS = 8;
  let passed = 0;
  let failed = 0;
  for (let r = 1; r <= RUNS; r++) {
    const result = runOnce(`run-${r}`);
    console.log(
      `  ${result.ok ? '✓' : '✗'} run ${r} — steps=${result.steps} endPhase=${result.endPhase} endMinute=${result.endMinute}${result.stalledOnModal ? ' (modalStall)' : ''} ${result.reason}`,
    );
    if (!result.ok) {
      failed++;
      const tail = result.samples.slice(-6);
      console.log('     últimas amostras:');
      for (const s of tail) {
        console.log(
          `       step=${s.step} min=${s.minute} sec=${s.footballElapsedSec} phase=${s.phase} pen=${s.hasPenalty} im=${s.hasInteractive} inj=${s.hasInjurySub} ov=${s.spiritOverlayKind ?? '-'}`,
        );
      }
    } else {
      passed++;
    }
  }
  console.log(`\n▶ Resultado: ${passed} pass, ${failed} fail`);
  if (failed > 0) process.exit(1);
}

main();
