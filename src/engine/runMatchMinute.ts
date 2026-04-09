import type { LiveMatchSnapshot, MatchEventEntry, PitchPlayerState, PossessionSide } from './types';
import { buildSpiritContext, gameSpiritTick } from '@/gamespirit/GameSpirit';
import type { PlayerEntity } from '@/entities/types';
import type { TeamTacticalStyle } from '@/tactics/playingStyle';
import { applyMatchMinuteFatigue } from '@/systems/fatigue';
import { rollMatchInjury } from '@/systems/injury';
import { rollMatchDiscipline } from '@/systems/discipline';
import { applyRedCardAutoSub } from './redCardAutoSub';
import {
  appendCausalEntries,
  scoreDeltaFromEvents,
  type CausalMatchEvent,
  type EngineSimPhase,
} from '@/match/causal/matchCausalTypes';
import {
  appendCardHome,
  appendGoalScorerHome,
  appendTeamGoalConcededHome,
  appendTeamGoalScoredHome,
} from '@/match/impactLedger';
import {
  redCardBannerOverlay,
  shouldRunSpiritPlayTick,
  tickBuildupGk,
} from '@/gamespirit/spiritStateMachine';

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function nearestToBall(players: PitchPlayerState[], ball: { x: number; y: number }): PitchPlayerState | undefined {
  if (players.length === 0) return undefined;
  let best = players[0]!;
  let bestD = 1e9;
  for (const p of players) {
    const d = Math.hypot(p.x - ball.x, p.y - ball.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function pickDefender(players: PitchPlayerState[]): PitchPlayerState | undefined {
  const defs = players.filter((p) => p.role === 'def' || p.role === 'gk');
  if (defs.length) return defs[Math.floor(Math.random() * defs.length)];
  return players[Math.floor(Math.random() * players.length)];
}

function jitterPlayers(players: PitchPlayerState[], ball: { x: number; y: number }, possession: PossessionSide): PitchPlayerState[] {
  return players.map((p) => {
    const pull =
      possession === 'home'
        ? { x: (ball.x - p.x) * 0.04, y: (ball.y - p.y) * 0.04 }
        : { x: (ball.x - p.x) * 0.03, y: (ball.y - p.y) * 0.03 };
    return {
      ...p,
      x: Math.min(96, Math.max(4, p.x + pull.x + (Math.random() * 2 - 1))),
      y: Math.min(92, Math.max(8, p.y + pull.y + (Math.random() * 2 - 1))),
    };
  });
}

function lastEnginePhaseFromEntries(entries: CausalMatchEvent[]): EngineSimPhase {
  let p: EngineSimPhase = 'LIVE';
  for (const e of entries) {
    if (e.type === 'phase_change') p = e.payload.to;
  }
  return p;
}

export interface RunMinuteInput {
  snapshot: LiveMatchSnapshot;
  homeRoster: PlayerEntity[];
  /** Elenco completo (titulares + banco) — disciplina / auto-sub após vermelho. */
  allPlayers: Record<string, PlayerEntity>;
  crowdSupport: number;
  tacticalMentality: number;
  tacticalStyle?: TeamTacticalStyle;
  opponentStrength: number;
  awayShort: string;
  /** Id do adversário (partida rápida / metadados); opcional em simulações em massa. */
  opponentId?: string;
  /** Roster visitante sintético — para cartões/golos com playerId real. */
  awayRoster?: { id: string; num: number; name: string; pos: string }[];
  skipEvent?: boolean;
}

export interface RunMinuteOutput {
  snapshot: LiveMatchSnapshot;
  updatedPlayers: Record<string, PlayerEntity>;
}

/**
 * Taxas-alvo por 90 minutos (partida rápida ~56 ticks efetivos):
 * - Golos: 2–4 total (home + away); calibrado via shot weights + pGoalAway.
 * - Cartões amarelos: 3–5 total (~2–3 home, ~1–2 away).
 * - Cartões vermelhos: ~0.15 (raro, 1 a cada ~7 jogos).
 * - Lesões: ~0.3 (raro; fadiga >72 ou fatigue spike em minutos de desarme).
 * - Penáltis: ~0.5 (DANGEROUS_FOUL_PROB × PENALTY_FROM_FOUL_PROB × ticks em att).
 */

/** Avança 1 minuto de jogo: GameSpirit + log causal + fadiga + eventos UI. */
export function runMatchMinute(input: RunMinuteInput): RunMinuteOutput {
  const s = input.snapshot;
  if (s.phase !== 'playing') {
    return { snapshot: s, updatedPlayers: {} };
  }

  const minute = Math.min(90, s.minute + 1);
  const footballElapsedSec = Math.min(5400, (s.footballElapsedSec ?? 0) + 60);
  const possessionAtStart: PossessionSide = s.possession;
  let homeScore = s.homeScore;
  let awayScore = s.awayScore;
  let possession: PossessionSide = s.possession;
  let ball = { ...s.ball };
  const events = [...s.events];
  const homeStats = { ...s.homeStats };
  let causalLog = s.causalLog;
  let impactLedger = [...(s.homeImpactLedger ?? [])];

  let spiritPhase = s.spiritPhase ?? 'open_play';
  let spiritOverlay = s.spiritOverlay ?? null;
  let penalty = s.penalty ?? null;
  let spiritBuildupGkTicksRemaining = s.spiritBuildupGkTicksRemaining ?? 0;
  let spiritMomentumClamp01 = s.spiritMomentumClamp01 ?? null;
  let preGoalHint = s.preGoalHint ?? null;

  if (spiritMomentumClamp01 === 0.5 && !spiritOverlay) {
    spiritMomentumClamp01 = null;
  }

  if (spiritPhase === 'set_piece') {
    spiritPhase = 'open_play';
  }
  const buildupTick = tickBuildupGk(spiritPhase, spiritBuildupGkTicksRemaining);
  spiritPhase = buildupTick.spiritPhase;
  spiritBuildupGkTicksRemaining = buildupTick.spiritBuildupGkTicksRemaining;

  const updatedPlayers: Record<string, PlayerEntity> = {};

  const onBall =
    possession === 'home' ? nearestToBall(s.homePlayers, ball) : undefined;

  let awayRoster = s.awayRoster ?? input.awayRoster;

  const ctx = buildSpiritContext({
    minute,
    homeScore,
    awayScore,
    possession,
    ball,
    onBall,
    crowdSupport: input.crowdSupport,
    tacticalMentality: input.tacticalMentality,
    tacticalStyle: input.tacticalStyle,
    opponentStrength: input.opponentStrength,
    homeRoster: input.homeRoster,
    homePlayers: s.homePlayers,
    homeShort: s.homeShort,
    recentFeedLines: s.events.slice(0, 10).map((e) => e.text),
    awayRoster,
  });

  const canRunSpirit = shouldRunSpiritPlayTick({
    spiritOverlay,
    spiritPhase,
    penalty,
    spiritBuildupGkTicksRemaining,
  });

  const shouldTick = !input.skipEvent && Math.random() < 0.62;
  if (shouldTick && canRunSpirit) {
    const startSeq = s.causalLog?.nextSeq ?? 1;
    const out = gameSpiritTick(ctx, input.awayShort, startSeq, Date.now());
    const delta = scoreDeltaFromEvents(out.causalEvents);
    homeScore = s.homeScore + delta.home;
    awayScore = s.awayScore + delta.away;
    possession = out.nextPossession;
    ball = out.ball;
    causalLog = appendCausalEntries(s.causalLog, out.causalEvents);

    const goalHome = delta.home > 0;
    const goalAway = delta.away > 0;

    const momentumFlash = goalHome || goalAway;
    const goalScorerHomeId = goalHome
      ? (out.goalScorerPlayerId ?? out.statDeltas?.playerId ?? onBall?.playerId ?? s.onBallPlayerId ?? 'unknown-home')
      : undefined;

    if (goalHome) {
      appendTeamGoalScoredHome(impactLedger, minute, s.homePlayers.map((p) => p.playerId));
      if (goalScorerHomeId) {
        appendGoalScorerHome(impactLedger, minute, goalScorerHomeId, s.homeCaptainPlayerId);
      }
    }
    if (goalAway) {
      appendTeamGoalConcededHome(impactLedger, minute, s.homePlayers);
    }

    const ev: MatchEventEntry = {
      id: uid(),
      minute,
      text: out.narrative,
      kind: goalHome ? 'goal_home' : goalAway ? 'goal_away' : 'narrative',
      playerId: goalHome ? goalScorerHomeId : goalAway ? out.goalScorerPlayerId : undefined,
      momentumFlash: momentumFlash || undefined,
      goalBuildUp: (goalHome || goalAway) ? out.goalBuildUp : undefined,
      threatBar01: (goalHome || goalAway) ? out.threatBar01 : undefined,
    };
    events.unshift(ev);
    if (events.length > 40) events.pop();

    if (out.statDeltas) {
      const sid = out.statDeltas.playerId;
      const cur = homeStats[sid] ?? {
        passesOk: 0,
        passesAttempt: 0,
        tackles: 0,
        km: 0,
        rating: 6.4,
      };
      homeStats[sid] = {
        passesOk: cur.passesOk + (out.statDeltas.passesOk ?? 0),
        passesAttempt: cur.passesAttempt + (out.statDeltas.passesAttempt ?? 0),
        tackles: cur.tackles + (out.statDeltas.tackles ?? 0),
        km: cur.km + (out.statDeltas.km ?? 0),
        rating: cur.rating,
      };
    }

    if (out.narrative.includes('Recuperação')) {
      const d = pickDefender(s.homePlayers);
      if (d) {
        const cur = homeStats[d.playerId] ?? {
          passesOk: 0,
          passesAttempt: 0,
          tackles: 0,
          km: 0,
          rating: 6.4,
        };
        homeStats[d.playerId] = { ...cur, tackles: cur.tackles + 1 };
      }
    }

    const sm = out.spiritMeta;
    if (sm) {
      if (sm.spiritPhase !== undefined) spiritPhase = sm.spiritPhase;
      if (sm.spiritOverlay !== undefined) spiritOverlay = sm.spiritOverlay ?? null;
      if (sm.penalty !== undefined) penalty = sm.penalty ?? null;
      if (sm.spiritBuildupGkTicksRemaining !== undefined) {
        spiritBuildupGkTicksRemaining = sm.spiritBuildupGkTicksRemaining;
      }
      if (sm.spiritMomentumClamp01 !== undefined) spiritMomentumClamp01 = sm.spiritMomentumClamp01;
      if (sm.preGoalHint !== undefined) preGoalHint = sm.preGoalHint;
    }
  } else if (shouldTick) {
    ball = {
      x: Math.min(92, Math.max(8, ball.x + (Math.random() * 4 - 2))),
      y: Math.min(88, Math.max(12, ball.y + (Math.random() * 4 - 2))),
    };
  } else {
    ball = {
      x: Math.min(92, Math.max(8, ball.x + (Math.random() * 4 - 2))),
      y: Math.min(88, Math.max(12, ball.y + (Math.random() * 4 - 2))),
    };
  }

  let matchLineupBySlot = { ...s.matchLineupBySlot };
  let substitutionsUsed = s.substitutionsUsed;

  let homePlayers = jitterPlayers(s.homePlayers, ball, possession);
  let injuredThisMinute: { id: string; name: string } | null = null;
  for (const hp of homePlayers) {
    const pl = input.homeRoster.find((p) => p.id === hp.playerId);
    if (pl) {
      const plEnt = updatedPlayers[pl.id] ?? pl;
      const preOut = plEnt.outForMatches;
      let next = applyMatchMinuteFatigue(plEnt, shouldTick ? 1.1 : 0.75);
      const injuryIntensity = shouldTick ? 1.1 : 0.6;
      if (shouldTick && next.fatigue > 72 && Math.random() < 0.06) {
        next = rollMatchInjury(next, injuryIntensity);
      }
      if (next.outForMatches > preOut) {
        injuredThisMinute = { id: hp.playerId, name: hp.name };
      }
      updatedPlayers[pl.id] = next;
      hp.fatigue = Math.round(next.fatigue);
    }
  }

  if (injuredThisMinute) {
    const injEv: MatchEventEntry = {
      id: uid(),
      minute,
      text: `${minute}' — ${injuredThisMinute.name} cai com dores; o staff corre ao relvado.`,
      kind: 'injury_home',
      playerId: injuredThisMinute.id,
    };
    events.unshift(injEv);
    if (events.length > 40) events.pop();
    const mergedPlayers: Record<string, PlayerEntity> = { ...input.allPlayers, ...updatedPlayers };
    const partialSnap: LiveMatchSnapshot = {
      ...s,
      minute,
      footballElapsedSec,
      homeScore,
      awayScore,
      possession,
      ball,
      homePlayers,
      events: [...events],
      homeStats,
      causalLog,
      matchLineupBySlot,
      substitutionsUsed,
      phase: s.phase,
      homeImpactLedger: impactLedger,
      spiritPhase,
      spiritOverlay,
      penalty,
      spiritBuildupGkTicksRemaining,
      spiritMomentumClamp01,
    };
    const injSub = applyRedCardAutoSub({
      snapshot: partialSnap,
      players: mergedPlayers,
      sentOffId: injuredThisMinute.id,
      minute,
    });
    if (injSub.events.length > 0) {
      homePlayers = injSub.snapshot.homePlayers;
      matchLineupBySlot = { ...injSub.snapshot.matchLineupBySlot };
      substitutionsUsed = injSub.snapshot.substitutionsUsed;
      events.length = 0;
      events.push(...injSub.snapshot.events);
      if (events.length > 40) events.length = 40;
    }
  }

  for (const id of Object.keys(homeStats)) {
    const row = homeStats[id];
    if (!row) continue;
    const comp =
      row.passesAttempt > 0 ? row.passesOk / row.passesAttempt : 0.75;
    homeStats[id] = {
      ...row,
      rating: Math.min(9.2, 6 + comp * 2.2 + row.tackles * 0.08 + Math.min(1.2, row.km / 12)),
    };
  }

  // Home card: ~3.5% per tick → ~2 amarelos/90' (0.035 × 56 ticks ≈ 2.0)
  const CARD_PROB_HOME = 0.035;
  // Away card: ~2.5% per tick → ~1.4 amarelos/90'
  const CARD_PROB_AWAY = 0.025;

  if (shouldTick && Math.random() < CARD_PROB_HOME && homePlayers.length > 0) {
    const hp = homePlayers[Math.floor(Math.random() * homePlayers.length)]!;
    const basePl = updatedPlayers[hp.playerId] ?? input.homeRoster.find((p) => p.id === hp.playerId);
    if (basePl && basePl.outForMatches <= 0) {
      const disc = rollMatchDiscipline(basePl);
      if (disc.outcome !== 'none' && disc.narrative) {
        updatedPlayers[basePl.id] = disc.player;
        const cardKind = disc.outcome === 'yellow' ? 'yellow_home' : 'red_home';
        const dev: MatchEventEntry = {
          id: uid(),
          minute,
          text: `${minute}' — ${disc.narrative}`,
          kind: cardKind,
          playerId: basePl.id,
        };
        appendCardHome(impactLedger, minute, basePl.id, disc.outcome === 'yellow', s.homeCaptainPlayerId);
        events.unshift(dev);
        if (events.length > 40) events.pop();
        if (disc.outcome === 'red') {
          const merged: Record<string, PlayerEntity> = { ...input.allPlayers, ...updatedPlayers };
          const partial: LiveMatchSnapshot = {
            ...s,
            minute,
            footballElapsedSec,
            homeScore,
            awayScore,
            possession,
            ball,
            homePlayers,
            events: [...events],
            homeStats,
            causalLog,
            matchLineupBySlot,
            substitutionsUsed,
            phase: s.phase,
            homeImpactLedger: impactLedger,
            spiritPhase,
            spiritOverlay,
            penalty,
            spiritBuildupGkTicksRemaining,
            spiritMomentumClamp01,
          };
          const sub = applyRedCardAutoSub({
            snapshot: partial,
            players: merged,
            sentOffId: basePl.id,
            minute,
          });
          homePlayers = sub.snapshot.homePlayers;
          matchLineupBySlot = { ...sub.snapshot.matchLineupBySlot };
          substitutionsUsed = sub.snapshot.substitutionsUsed;
          events.length = 0;
          events.push(...sub.snapshot.events);
          if (events.length > 40) events.length = 40;
        }
        if (s.mode === 'quick' && disc.outcome === 'red' && !spiritOverlay) {
          spiritOverlay = redCardBannerOverlay({
            minute,
            side: 'home',
            playerName: basePl.name,
            homeShort: s.homeShort,
            awayShort: s.awayShort,
            startedAtMs: Date.now(),
          });
        }
      }
    }
  }

  if (shouldTick && Math.random() < CARD_PROB_AWAY && awayRoster && awayRoster.length > 0) {
    const roster = awayRoster;
    const pick = roster[Math.floor(Math.random() * roster.length)]!;
    const isRed = Math.random() < 0.06;
    const cardKind = isRed ? 'red_away' : 'yellow_away';
    const narrativeText = isRed
      ? `${pick.name} recebe vermelho direto; o visitante fica com menos um.`
      : `${pick.name} entra atrasado; o árbitro mostra amarelo.`;
    events.unshift({
      id: uid(),
      minute,
      text: `${minute}' — ${narrativeText}`,
      kind: cardKind,
      playerId: pick.id,
    });
    if (events.length > 40) events.pop();
    if (isRed && s.mode === 'quick') {
      awayRoster = awayRoster.filter((p) => p.id !== pick.id);
      if (!spiritOverlay) {
        spiritOverlay = redCardBannerOverlay({
          minute,
          side: 'away',
          playerName: pick.name,
          homeShort: s.homeShort,
          awayShort: s.awayShort,
          startedAtMs: Date.now(),
        });
      }
    }
  }

  const engineSimPhase =
    causalLog && causalLog.entries.length > 0
      ? lastEnginePhaseFromEntries(causalLog.entries)
      : s.engineSimPhase ?? 'LIVE';

  const nextSnap: LiveMatchSnapshot = {
    ...s,
    minute,
    footballElapsedSec,
    homeScore,
    awayScore,
    possession,
    ball,
    engineSimPhase,
    onBallPlayerId: possession === 'home' ? nearestToBall(homePlayers, ball)?.playerId : undefined,
    homePlayers,
    events,
    homeStats,
    causalLog,
    matchLineupBySlot,
    substitutionsUsed,
    homeImpactLedger: impactLedger,
    spiritPhase,
    spiritOverlay,
    penalty,
    spiritBuildupGkTicksRemaining,
    spiritMomentumClamp01,
    preGoalHint,
    awayRoster,
  };

  return { snapshot: nextSnap, updatedPlayers };
}
