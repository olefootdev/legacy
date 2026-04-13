import type { MatchEventEntry } from '@/engine/types';
import type { MatchTruthPhase } from '@/bridge/matchTruthSchema';
import type { MatchSimulationEventBus } from './matchSimulationEventBus';
import {
  truthPhaseToSimulationPhase,
  type SimulationMatchPhase,
} from './matchSimulationContract';
import type { CausalMatchEvent } from '@/match/causal/matchCausalTypes';

/** Emite eventos de simulação a partir do feed do motor (ticks + fila `events`). */
export function emitPhaseIfChanged(
  bus: MatchSimulationEventBus,
  prev: SimulationMatchPhase | null,
  truth: MatchTruthPhase,
  livePhase: 'pregame' | 'playing' | 'postgame' | null,
  simTime: number,
): SimulationMatchPhase {
  const next = truthPhaseToSimulationPhase(truth, livePhase);
  if (prev !== null && prev !== next) {
    bus.emit({ kind: 'PhaseChanged', from: prev, to: next, at: simTime });
  }
  return next;
}

/**
 * Feed legado da UI (`MatchEventEntry`). Golos não emitem `Goal` aqui — vêm do log causal
 * (`emitCausalMatchEvent`) para manter uma única cadeia shot → resultado → placar.
 */
export function emitFromMatchEventEntry(
  bus: MatchSimulationEventBus,
  ev: MatchEventEntry,
  simTime: number,
): void {
  switch (ev.kind) {
    case 'goal_home':
    case 'goal_away':
      bus.emit({
        kind: 'EngineNarrativeLine',
        text: ev.text,
        minute: ev.minute,
        at: simTime,
      });
      break;
    case 'whistle':
      bus.emit({ kind: 'Whistle', reason: ev.text || 'interrupção', at: simTime });
      break;
    case 'narrative':
      bus.emit({
        kind: 'EngineNarrativeLine',
        text: ev.text,
        minute: ev.minute,
        at: simTime,
      });
      break;
    case 'sub':
      bus.emit({
        kind: 'EngineNarrativeLine',
        text: `Sub: ${ev.text}`,
        minute: ev.minute,
        at: simTime,
      });
      break;
    case 'yellow_home':
    case 'yellow_away':
    case 'red_home':
    case 'red_away':
    case 'injury_home':
      bus.emit({
        kind: 'EngineNarrativeLine',
        text: ev.text,
        minute: ev.minute,
        at: simTime,
      });
      break;
    default:
      break;
  }
}

/** Projeção do `MatchEventLog` causal para o bus de simulação (narrativa / tooling). */
export function emitCausalMatchEvent(
  bus: MatchSimulationEventBus,
  ev: CausalMatchEvent,
  simTime: number,
): void {
  switch (ev.type) {
    case 'shot_attempt':
      bus.emit({
        kind: 'CausalShotAttempt',
        side: ev.payload.side,
        shooterId: ev.payload.shooterId,
        zone: ev.payload.zone,
        minute: ev.payload.minute,
        at: simTime,
      });
      break;
    case 'shot_result':
      bus.emit({
        kind: 'CausalShotResult',
        side: ev.payload.side,
        shooterId: ev.payload.shooterId,
        outcome: ev.payload.outcome,
        at: simTime,
      });
      if (ev.payload.outcome === 'goal' || ev.payload.outcome === 'post_in') {
        bus.emit({ kind: 'Goal', side: ev.payload.side, at: simTime });
      }
      break;
    case 'phase_change':
      bus.emit({
        kind: 'CausalEnginePhase',
        from: ev.payload.from,
        to: ev.payload.to,
        reason: ev.payload.reason,
        at: simTime,
      });
      break;
    case 'ball_state':
      bus.emit({
        kind: 'CausalBallState',
        xPercent: ev.payload.x,
        yPercent: ev.payload.y,
        reason: ev.payload.reason,
        at: simTime,
      });
      break;
    case 'possession_change':
      bus.emit({
        kind: 'PossessionChanged',
        side: ev.payload.to,
        at: simTime,
      });
      break;
    case 'foul_committed':
      bus.emit({
        kind: 'EngineNarrativeLine',
        text: ev.payload.dangerous
          ? `${ev.payload.minute}' — Falta dura (${ev.payload.kind}) — tensão no lance.`
          : `${ev.payload.minute}' — Falta (${ev.payload.kind}) — jogo parado.`,
        minute: ev.payload.minute,
        at: simTime,
      });
      break;
    case 'card_shown':
      bus.emit({
        kind: 'EngineNarrativeLine',
        text:
          ev.payload.card === 'red'
            ? `${ev.payload.minute}' — Cartão vermelho.`
            : `${ev.payload.minute}' — Cartão amarelo.`,
        minute: ev.payload.minute,
        at: simTime,
      });
      break;
    default:
      break;
  }
}
