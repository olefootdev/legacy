import type {
  LiveMatchClockPeriod,
  LiveMatchSnapshot,
  MatchEventEntry,
  PitchPlayerState,
  PossessionSide,
} from './types';
import type { MatchHalf } from '@/match/fieldZones';
import { buildSpiritContext, gameSpiritTick } from '@/gamespirit/GameSpirit';
import { getBestAction } from '@/smartfield/decision';
import type { MatchSituationInput } from '@/gamespirit/situationalIntelligence';
import type { PlayerEntity } from '@/entities/types';
import type { TeamTacticalStyle } from '@/tactics/playingStyle';
import { applyMatchMinuteFatigue } from '@/systems/fatigue';
import { rollMatchInjuryWithSeverity, INJURY_LABEL_PT, type InjurySeverity } from '@/systems/injury';
import type { InboxItem } from '@/game/inboxTypes';
import { makeInboxItem } from '@/game/inboxItem';
import type { StaffRunMatchMinuteEffects } from '@/systems/staffBenefits';
import { rollMatchDiscipline } from '@/systems/discipline';
import { applyRedCardAutoSub } from './redCardAutoSub';
import { findSlotForPlayer } from './substitution';
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
import { pickBallCarrier } from './ballCarrier';
import {
  redCardBannerOverlay,
  shouldRunSpiritPlayTick,
  tickBuildupGk,
} from '@/gamespirit/spiritStateMachine';
import { applyScoutEvent, type ScoutTally } from '@/gamespirit/scoutScoring';
import { synthesizeAwayPitchPlayers, deriveAwayMentality } from '@/match/syntheticAwayAttrs';
import { L } from '@/i18n/L';
function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function liveMatchHalfFromClock(clock: LiveMatchClockPeriod | undefined, minute: number): MatchHalf {
  if (clock === 'second_half') return 2;
  if (clock === 'first_half' || clock === 'halftime') return 1;
  return minute >= 46 ? 2 : 1;
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
      x: Math.min(96, Math.max(4, p.x + pull.x + (Math.random() * 0.6 - 0.3))),
      y: Math.min(92, Math.max(8, p.y + pull.y + (Math.random() * 0.6 - 0.3))),
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
  /** Intensidade tática escolhida pelo jogador (Quick Match). */
  tacticalIntensity?: import('@/match/quickTacticalIntensity').TacticalIntensityLevel;
  /**
   * Probabilidade por minuto de correr um tick GameSpirit.
   * Predefinido 0.62; modo automático usa valor mais baixo via matchBulk.
   */
  spiritTickProb?: number;
  /** Efeitos cumulativos do staff Casa (preparador físico + nutrição) na fadiga/lesão por minuto. */
  staffMatchEffects?: StaffRunMatchMinuteEffects | null;
  /**
   * Fase 3 — Modificadores contextuais (mando, descanso, derby, importância,
   * desfalques). Quando presentes, GameSpirit aplica multiplicadores nos
   * inputs do peso da partida ANTES da resolução. Quando ausentes, motor
   * roda neutro (multiplicadores = 1.0) — comportamento idêntico ao histórico.
   */
  contextModifiers?: import('@/match/contextFactors').MatchContextModifiers;
  /**
   * FABLE — DNA Tático do Clube (-100 pragmático … +100 romântico). Vira viés
   * sutil (±0.05) na decisão de chute dos agentes — identidade pesa em campo.
   */
  clubDnaAxis?: number;
}

export interface RunMinuteOutput {
  snapshot: LiveMatchSnapshot;
  updatedPlayers: Record<string, PlayerEntity>;
  /** Itens a prefixar no inbox do save; hoje só usado pra lesões fortes/gravíssimas. */
  newInboxItems?: InboxItem[];
}

/**
 * Taxas-alvo por 90 minutos (partida rápida ~56 ticks; automática UI ~espírito 0.56/min, ver matchBulk):
 * - Golos: 2–4 total (home + away); calibrado via shot weights + pGoalAway.
 * - Cartões amarelos: 3–5 total (~2–3 home, ~1–2 away).
 * - Cartões vermelhos: ~0.15 (raro, 1 a cada ~7 jogos).
 * - Lesões: ~0.3 (raro; fadiga >72 ou fatigue spike em minutos de desarme).
 * - Penalties: ~0.5 (DANGEROUS_FOUL_PROB × PENALTY_FROM_FOUL_PROB × ticks em att).
 */

/** Avança 1 minuto de jogo: GameSpirit + log causal + fadiga + eventos UI. */
export function runMatchMinute(input: RunMinuteInput): RunMinuteOutput {
  const s = input.snapshot;
  if (s.phase !== 'playing') {
    return { snapshot: s, updatedPlayers: {} };
  }

  /** Partida rápida: relógio parado até o manager resolver a substituição por lesão. */
  if (s.mode === 'quick' && s.quickInjurySub) {
    return { snapshot: s, updatedPlayers: {} };
  }

  /**
   * Engine pausa sempre que há UI bloqueante de decisão do manager:
   *   • Pênalti em cobrança (modal aberto)
   *   • Momento interativo (escolha de jogada)
   * Sem essa pausa, o reducer gera cartões/lesões/gols POR TRÁS do modal,
   * que pipocam quando o modal fecha — quebra a sensação de controle.
   */
  if (s.mode === 'quick' && s.penalty) {
    return { snapshot: s, updatedPlayers: {} };
  }
  if (s.mode === 'quick' && s.activeInteractiveMoment) {
    return { snapshot: s, updatedPlayers: {} };
  }

  let quickInjurySub: LiveMatchSnapshot['quickInjurySub'] = s.quickInjurySub ?? null;

  /** Partida automática: corta cartões/lesões sintéticos por minuto (GameSpirit mantém-se). */
  const autoSimSlim = s.mode === 'auto';

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
  const scoutTallies: Record<string, ScoutTally> = { ...(s.scoutTallies ?? {}) };

  let spiritPhase = s.spiritPhase ?? 'open_play';
  let spiritOverlay = s.spiritOverlay ?? null;
  let penalty = s.penalty ?? null;
  let spiritBuildupGkTicksRemaining = s.spiritBuildupGkTicksRemaining ?? 0;
  let spiritPenaltyCooldownTicks = Math.max(0, (s.spiritPenaltyCooldownTicks ?? 0) - 1);
  let spiritMomentumClamp01 = s.spiritMomentumClamp01 ?? null;
  let spiritMomentum: { home: number; away: number } = s.spiritMomentum ?? { home: 0, away: 0 };
  let pendingCornerForSide: 'home' | 'away' | null = s.pendingCornerForSide ?? null;
  let pendingFreeKickForSide: 'home' | 'away' | null = s.pendingFreeKickForSide ?? null;
  let lastShotPreview = s.lastShotPreview ?? null;
  let preGoalHint = s.preGoalHint ?? null;

  // Expira preview antigo (> 3.5s desde o tiro) para desaparecer na UI.
  if (lastShotPreview && Date.now() - lastShotPreview.ts > 3500) {
    lastShotPreview = null;
  }

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

  // BUG 1 fix: pickBallCarrier substitui nearestToBall — antes o mesmo
  // atacante "perto da bola" virava portador fixo e chutava 3x seguido.
  // Agora: zona×role + atributos individuais + proximidade + anti-repeat.
  const prevOnBallId = s.onBallPlayerId;
  const onBall =
    possession === 'home'
      ? pickBallCarrier({ players: s.homePlayers, ball, side: 'home', prevCarrierId: prevOnBallId })
      : undefined;

  // ── SmartField: pré-decide a ação do portador antes de invocar o Spirit ───
  // `getBestAction` consulta a hierarquia de zonas (goalmouth>six_yard>box>...).
  // Quando a confiança é alta (≥0.7), o `Decision.action` vira um hint que o
  // pickAction do Spirit prefere sobre o seu fallback heurístico. Não-destrutivo:
  // se confiança baixa ou faltar dado, o Spirit segue seu fluxo normal.
  let spiritActionHint: import('@/smartfield/decision').ActionKind | null = null;
  if (possession === 'home' && onBall && s.homePlayers.length > 0) {
    const tagged = s.homePlayers.map((p) => ({ ...p, team: 'home' as const }));
    const carrierAware = { ...onBall, team: 'home' as const };
    const decision = getBestAction(carrierAware, tagged, 'home', {
      hasBall: true,
      isFreeKick: false,
    });
    if (decision.confidence >= 0.7) {
      spiritActionHint = decision.action;
    }
  }

  let awayRoster = s.awayRoster ?? input.awayRoster;


  const canRunSpirit = shouldRunSpiritPlayTick({
    spiritOverlay,
    spiritPhase,
    penalty,
    spiritBuildupGkTicksRemaining,
  });

  // FANTASY V2 (2026-05-27): 0.88 → 0.94. Quase todo minuto tem ação. Combinado
  // com goal weight 0.24, alvo 8-12 gols por partida.
  const spiritTickP = input.spiritTickProb ?? 0.94;
  const shouldTick = !input.skipEvent && Math.random() < spiritTickP;
  const autoSimBoost =
    s.mode === 'auto' && input.spiritTickProb != null && input.spiritTickProb > 0 && input.spiritTickProb < 0.62
      ? 0.62 / input.spiritTickProb
      : 1;

  if (shouldTick && canRunSpirit) {
    // ── Inteligência Situacional: arcos narrativos + pressão acumulada ──
    const goalEvents = s.events.filter(e => e.kind === 'goal_home' || e.kind === 'goal_away');
    const lastGoalEv = goalEvents[0];
    const lastGoalMinute = lastGoalEv?.minute ?? null;
    const lastGoalSide: 'home' | 'away' | null = lastGoalEv
      ? (lastGoalEv.kind === 'goal_home' ? 'home' : 'away')
      : null;
    const minutesSinceLastGoal = lastGoalMinute != null ? minute - lastGoalMinute : null;

    // Contar chutes sem gol consecutivos (desde último gol de cada lado)
    let homeShotsWithoutGoal = 0;
    let awayShotsWithoutGoal = 0;
    for (const ev of s.events) {
      if (ev.kind === 'goal_home') break;
      if (ev.kind === 'shot_home' || (ev.kind === 'narrative' && /chut|shot|shoot/i.test(ev.text ?? ''))) homeShotsWithoutGoal++;
    }
    for (const ev of s.events) {
      if (ev.kind === 'goal_away') break;
      if (ev.kind === 'shot_away') awayShotsWithoutGoal++;
    }

    const situational: MatchSituationInput = {
      minute,
      homeScore,
      awayScore,
      minutesSinceLastGoal,
      homeShotsWithoutGoal,
      awayShotsWithoutGoal,
      lastGoalSide,
      lastGoalMinute,
    };

    // FANTASY V6 (2026-06-02): visitante com atributos individuais sintéticos,
    // derivados de (OVR clube × posição), para habilitar awareness: defensor
    // adversário bloqueia, GK individualizado, artilheiro pesa em pGoalAway.
    // Custo: ~0.1ms por tick (≤11 jogadores).
    const synthAwayPitch = synthesizeAwayPitchPlayers(awayRoster, input.opponentStrength);
    // Mentalidade do visitante (0-100) — base por OVR + ajuste situacional.
    const awayMentality = deriveAwayMentality({
      opponentStrength: input.opponentStrength,
      homeScore,
      awayScore,
      minute,
    });

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
      awayMentality,
      homeRoster: input.homeRoster,
      homePlayers: s.homePlayers,
      homeShort: s.homeShort,
      recentFeedLines:
        s.mode === 'auto' ? [] : s.events.slice(0, 10).map((e) => e.text),
      awayRoster,
      awayPlayers: synthAwayPitch,
      penaltyCooldownTicks: s.spiritPenaltyCooldownTicks ?? 0,
      momentum: s.spiritMomentum ?? { home: 0, away: 0 },
      pendingCornerForSide: s.pendingCornerForSide ?? null,
      pendingFreeKickForSide: s.pendingFreeKickForSide ?? null,
      smartfieldActionHint: spiritActionHint,
      clubDnaAxis: input.clubDnaAxis,
      tacticalIntensity: input.tacticalIntensity,
      situational,
      contextModifiers: input.contextModifiers,
    });
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
        const scorer = s.homePlayers.find(p => p.playerId === goalScorerHomeId);
        if (scorer) {
          const isDecisive = minute >= 70 && Math.abs(homeScore - 1 - awayScore) <= 1;
          applyScoutEvent({
            tallies: scoutTallies, playerId: goalScorerHomeId,
            name: scorer.name, pos: scorer.role ?? 'FWD',
            kind: 'goal', minute, rng: Math.random(),
            context: { homeScore, awayScore, isDecisiveGoal: isDecisive },
          });
        }
      }
    }
    if (goalAway) {
      appendTeamGoalConcededHome(impactLedger, minute, s.homePlayers);
      // GK da casa sofre gol
      const gk = s.homePlayers.find(p => p.role === 'gk');
      if (gk) {
        applyScoutEvent({
          tallies: scoutTallies, playerId: gk.playerId,
          name: gk.name, pos: 'GK',
          kind: 'goalConceded', minute, rng: Math.random(),
        });
      }
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
        shotsOn: 0,
        shotsOff: 0,
        saves: 0,
        dribblesOk: 0,
      };
      homeStats[sid] = {
        passesOk: cur.passesOk + (out.statDeltas.passesOk ?? 0),
        passesAttempt: cur.passesAttempt + (out.statDeltas.passesAttempt ?? 0),
        tackles: cur.tackles + (out.statDeltas.tackles ?? 0),
        km: cur.km + (out.statDeltas.km ?? 0),
        rating: cur.rating,
        shotsOn: cur.shotsOn ?? 0,
        shotsOff: cur.shotsOff ?? 0,
        saves: cur.saves ?? 0,
        dribblesOk: cur.dribblesOk ?? 0,
      };
      // Scout: passe incompleto
      if ((out.statDeltas.passesAttempt ?? 0) > (out.statDeltas.passesOk ?? 0)) {
        const incomplete = (out.statDeltas.passesAttempt ?? 0) - (out.statDeltas.passesOk ?? 0);
        const pl = s.homePlayers.find(p => p.playerId === sid);
        if (pl) {
          for (let i = 0; i < incomplete; i++) {
            applyScoutEvent({ tallies: scoutTallies, playerId: sid, name: pl.name, pos: pl.role ?? 'MID', kind: 'incompletePass', minute, rng: Math.random() });
          }
        }
      }
      // Scout: desarme
      if ((out.statDeltas.tackles ?? 0) > 0) {
        const pl = s.homePlayers.find(p => p.playerId === sid);
        if (pl) {
          for (let i = 0; i < (out.statDeltas.tackles ?? 0); i++) {
            applyScoutEvent({ tallies: scoutTallies, playerId: sid, name: pl.name, pos: pl.role ?? 'DEF', kind: 'tackle', minute, rng: Math.random() });
          }
        }
      }
    }

    // Scout + homeStats: eventos de remate pelo log causal (casa atacando)
    for (const ce of out.causalEvents) {
      if (ce.type !== 'shot_result' || !('payload' in ce)) continue;
      const p = (ce as any).payload;
      const shooterId: string | undefined = p?.shooterId;
      const outcome: string | undefined = p?.outcome;
      const side: 'home' | 'away' | undefined = p?.side;
      if (!shooterId || !outcome) continue;

      // HOME atacando: contabiliza chutes do jogador da casa.
      if (side === 'home') {
        const pl = s.homePlayers.find(q => q.playerId === shooterId);
        if (pl) {
          const cur = homeStats[shooterId] ?? {
            passesOk: 0, passesAttempt: 0, tackles: 0, km: 0, rating: 6.4,
            shotsOn: 0, shotsOff: 0, saves: 0, dribblesOk: 0,
          };
          const onTarget = outcome === 'goal' || outcome === 'save' || outcome === 'post_in' || outcome === 'block';
          homeStats[shooterId] = {
            ...cur,
            shotsOn: (cur.shotsOn ?? 0) + (onTarget ? 1 : 0),
            shotsOff: (cur.shotsOff ?? 0) + (onTarget ? 0 : 1),
          };
          if (!goalHome) {
            let kind: Parameters<typeof applyScoutEvent>[0]['kind'] | null = null;
            if (outcome === 'save' || outcome === 'block') kind = 'shotSaved';
            else if (outcome === 'post_in' || outcome === 'post_out') kind = 'shotPost';
            else if (outcome === 'wide' || outcome === 'miss') kind = 'shotWide';
            if (kind) applyScoutEvent({ tallies: scoutTallies, playerId: shooterId, name: pl.name, pos: pl.role ?? 'FWD', kind, minute, rng: Math.random() });
          }
        }
      }

      // AWAY atacando + save/block: goleiro da casa fez defesa.
      if (side === 'away' && (outcome === 'save' || outcome === 'block')) {
        const gk = s.homePlayers.find(q => q.role === 'gk');
        if (gk) {
          const cur = homeStats[gk.playerId] ?? {
            passesOk: 0, passesAttempt: 0, tackles: 0, km: 0, rating: 6.4,
            shotsOn: 0, shotsOff: 0, saves: 0, dribblesOk: 0,
          };
          homeStats[gk.playerId] = { ...cur, saves: (cur.saves ?? 0) + 1 };
          const isClutch = minute >= 75 && Math.abs(homeScore - awayScore) <= 1;
          applyScoutEvent({ tallies: scoutTallies, playerId: gk.playerId, name: gk.name, pos: 'GK', kind: 'difficultSave', minute, rng: Math.random(), context: { homeScore, awayScore, isClutchSave: isClutch } });
        }
      }
    }

    if (out.narrative.includes('Recuperação') || /\brecover/i.test(out.narrative)) {
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
      if (sm.momentum !== undefined) spiritMomentum = sm.momentum;
      if (sm.pendingCornerForSide !== undefined) pendingCornerForSide = sm.pendingCornerForSide;
      if (sm.pendingFreeKickForSide !== undefined) pendingFreeKickForSide = sm.pendingFreeKickForSide;
      if (sm.lastShotPreview !== undefined) lastShotPreview = sm.lastShotPreview;
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

  let homePlayers: PitchPlayerState[] = jitterPlayers(s.homePlayers, ball, possession);
  const staffFx = input.staffMatchEffects;
  const fatigueGainMul = staffFx?.fatigueGainMul ?? 1;
  const injStressMul = staffFx?.injuryStressMul ?? 1;
  const injGrowthMul = staffFx?.injuryRiskGrowthMul ?? 1;

  let injuredThisMinute: { id: string; name: string; severity?: InjurySeverity } | null = null;
  const injuryInboxItems: InboxItem[] = [];
  for (const hp of homePlayers) {
    const pl = input.homeRoster.find((p) => p.id === hp.playerId);
    if (pl) {
      const plEnt = updatedPlayers[pl.id] ?? pl;
      const preOut = plEnt.outForMatches;
      let next = applyMatchMinuteFatigue(plEnt, shouldTick ? 1.1 : 0.75, fatigueGainMul);
      const injuryIntensity = shouldTick ? 1.1 : 0.6;
      // Lesões por fadiga só após minuto 20 — jogadores não se machucam logo de início por causa de fadiga acumulada
      let injuredSeverity: InjurySeverity | undefined;
      // FANTASY MODE: 0.06 → 0.09. ~0.45 lesão/jogo (era ~0.3).
      if (!autoSimSlim && shouldTick && minute > 20 && next.fatigue > 72 && Math.random() < 0.12 * autoSimBoost) {
        const res = rollMatchInjuryWithSeverity(next, injuryIntensity, { stressMul: injStressMul, riskGrowthMul: injGrowthMul });
        next = res.player;
        if (res.injured) injuredSeverity = res.severity;
      }
      if (next.outForMatches > preOut) {
        injuredThisMinute = { id: hp.playerId, name: hp.name, severity: injuredSeverity };
        // Inbox: só notifica lesões forte/gravíssima (leve é ruído demais).
        if (injuredSeverity === 'forte' || injuredSeverity === 'gravissima') {
          const games = next.outForMatches;
          injuryInboxItems.push(
            makeInboxItem(
              `injury-${hp.playerId}-${minute}-${Date.now().toString(36)}`,
              'PLAYER_INJURY',
              'PLANTEL',
              `${INJURY_LABEL_PT[injuredSeverity]} — ${hp.name}`,
              {
                body: L(`${hp.name} cai com dores aos ${minute}' e fica ${games} jogos fora (amistosos + liga). Departamento médico pode acelerar a recuperação.`, `${hp.name} goes down in pain at ${minute}' and is out for ${games} matches (friendlies + league). The medical department can speed up recovery.`),
                deepLink: '/team',
                timeLabel: `${minute}'`,
              },
            ),
          );
        }
      }
      updatedPlayers[pl.id] = next;
      hp.fatigue = Math.round(next.fatigue);
    }
  }

  if (injuredThisMinute) {
    const injEv: MatchEventEntry = {
      id: uid(),
      minute,
      text: L(`${minute}' — ${injuredThisMinute.name} cai com dores; o staff corre ao relvado.`, `${minute}' — ${injuredThisMinute.name} goes down in pain; the staff rush onto the pitch.`),
      kind: 'injury_home',
      playerId: injuredThisMinute.id,
    };
    events.unshift(injEv);
    if (events.length > 40) events.pop();

    const mergedPlayers: Record<string, PlayerEntity> = { ...input.allPlayers, ...updatedPlayers };
    const outPs = homePlayers.find((p) => p.playerId === injuredThisMinute.id);
    const injuredSlot = findSlotForPlayer(matchLineupBySlot, injuredThisMinute.id);

    if (s.mode === 'quick' && outPs && injuredSlot) {
      // remove injured player from pitch and create quick-injury substitution prompt
      homePlayers = homePlayers.filter((p) => p.playerId !== injuredThisMinute.id);
      quickInjurySub = {
        outPlayerId: injuredThisMinute.id,
        slotId: outPs.slotId,
        x: outPs.x,
        y: outPs.y,
        name: injuredThisMinute.name,
      };

      // If the injury was caused by a recent foul, find the fouler in the causal log and
      // apply a red card to them (quick match => immediate expulsion, no auto-sub for away).
      if (causalLog && causalLog.entries && causalLog.entries.length > 0) {
        for (let i = causalLog.entries.length - 1; i >= 0; i--) {
          const e = causalLog.entries[i] as any;
          if (e.type === 'foul_committed' && e.payload && e.payload.victimId === injuredThisMinute.id) {
            const foulerId: string | undefined = e.payload.foulerId;
            const foulerSide: any = e.payload.foulerSide;
            if (foulerId) {
              // create red event for the fouler
              const redKind = foulerSide === 'home' ? 'red_home' : 'red_away';
              const redEv: MatchEventEntry = {
                id: uid(),
                minute,
                text: L(`${minute}' — ${mergedPlayers[foulerId]?.name ?? 'Jogador'} expulso por falta que causou lesão.`, `${minute}' — ${mergedPlayers[foulerId]?.name ?? 'Player'} sent off for a foul that caused an injury.`),
                kind: redKind,
                playerId: foulerId,
              };
              events.unshift(redEv);
              if (events.length > 40) events.pop();

              // apply removal depending on side
              if (foulerSide === 'home') {
                // remove fouler from homePlayers and matchLineupBySlot
                homePlayers = homePlayers.filter((p) => p.playerId !== foulerId);
                const slotForFouler = findSlotForPlayer(matchLineupBySlot, foulerId);
                if (slotForFouler) {
                  const newLineup = { ...matchLineupBySlot };
                  delete newLineup[slotForFouler];
                  matchLineupBySlot = newLineup;
                }
                const sentOff = [...(s.sentOffPlayerIds ?? []), foulerId];
                // persist sentOffPlayerIds on snapshot via spiritOverlay below
                // set visual overlay for red card
                if (!spiritOverlay) {
                  spiritOverlay = redCardBannerOverlay({
                    minute,
                    side: 'home',
                    playerName: mergedPlayers[foulerId]?.name,
                    homeShort: s.homeShort,
                    awayShort: s.awayShort,
                    startedAtMs: Date.now(),
                  });
                }
              } else {
                // away: remove from awayRoster (quick mode has no auto-sub for away)
                if (awayRoster && awayRoster.length > 0) {
                  awayRoster = awayRoster.filter((p) => p.id !== foulerId);
                }
                if (!spiritOverlay) {
                  spiritOverlay = redCardBannerOverlay({
                    minute,
                    side: 'away',
                    playerName: mergedPlayers[foulerId]?.name,
                    homeShort: s.homeShort,
                    awayShort: s.awayShort,
                    startedAtMs: Date.now(),
                  });
                }
              }
            }
            break;
          }
        }
      }

      const engineSimPhaseNow =
        causalLog && causalLog.entries.length > 0
          ? lastEnginePhaseFromEntries(causalLog.entries)
          : s.engineSimPhase ?? 'LIVE';
      return {
        snapshot: {
          ...s,
          minute,
          footballElapsedSec,
          homeScore,
          awayScore,
          possession,
          ball,
          engineSimPhase: engineSimPhaseNow,
          onBallPlayerId: possession === 'home' ? onBall?.playerId : undefined,
          homePlayers,
          events: [...events],
          homeStats,
          causalLog,
          matchLineupBySlot,
          substitutionsUsed,
          homeImpactLedger: impactLedger,
          scoutTallies,
          spiritPhase,
          spiritOverlay,
          penalty,
          spiritBuildupGkTicksRemaining,
          spiritPenaltyCooldownTicks,
          spiritMomentumClamp01,
          preGoalHint,
          awayRoster,
          quickInjurySub,
        },
        updatedPlayers,
      };
    }

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
      scoutTallies,
      spiritPhase,
      spiritOverlay,
      penalty,
      spiritBuildupGkTicksRemaining,
      spiritPenaltyCooldownTicks,
      spiritMomentumClamp01,
    };
    const injSub = applyRedCardAutoSub({
      snapshot: partialSnap,
      players: mergedPlayers,
      sentOffId: injuredThisMinute.id,
      minute,
    });
    quickInjurySub = null;
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

  if (!autoSimSlim && shouldTick && Math.random() < CARD_PROB_HOME * autoSimBoost && homePlayers.length > 0) {
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
        applyScoutEvent({
          tallies: scoutTallies, playerId: basePl.id,
          name: basePl.name, pos: basePl.pos ?? 'MID',
          kind: disc.outcome === 'yellow' ? 'yellowCard' : 'redCard',
          minute, rng: Math.random(),
        });
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
            scoutTallies,
            spiritPhase,
            spiritOverlay,
            penalty,
            spiritBuildupGkTicksRemaining,
            spiritPenaltyCooldownTicks,
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

  if (!autoSimSlim && shouldTick && Math.random() < CARD_PROB_AWAY * autoSimBoost && awayRoster && awayRoster.length > 0) {
    const roster = awayRoster;
    const pick = roster[Math.floor(Math.random() * roster.length)]!;
    const isRed = Math.random() < 0.06;
    const cardKind = isRed ? 'red_away' : 'yellow_away';
    const narrativeText = isRed
      ? L(`${pick.name} recebe vermelho direto; o visitante fica com menos um.`, `${pick.name} gets a straight red; the away side are down to ten.`)
      : L(`${pick.name} entra atrasado; o árbitro mostra amarelo.`, `${pick.name} goes in late; the referee shows yellow.`);
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
    onBallPlayerId: possession === 'home' ? onBall?.playerId : undefined,
    homePlayers,
    events,
    homeStats,
    causalLog,
    matchLineupBySlot,
    substitutionsUsed,
    homeImpactLedger: impactLedger,
    scoutTallies,
    spiritPhase,
    spiritOverlay,
    penalty,
    spiritBuildupGkTicksRemaining,
    spiritPenaltyCooldownTicks,
    spiritMomentumClamp01,
    spiritMomentum,
    pendingCornerForSide,
    pendingFreeKickForSide,
    lastShotPreview,
    preGoalHint,
    awayRoster,
    quickInjurySub,
  };

  return { snapshot: nextSnap, updatedPlayers, newInboxItems: injuryInboxItems.length > 0 ? injuryInboxItems : undefined };
}
