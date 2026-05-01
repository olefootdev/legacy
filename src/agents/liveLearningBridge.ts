/**
 * Live Learning Bridge — subscribes to the match event bus and applies
 * micro-learning to player profiles in real-time.
 *
 * Events captured:
 * - PassCompleted → pass_ok
 * - CausalShotResult → shot_ok/shot_fail based on outcome
 * - Goal → critical_success for scorer
 *
 * Learning impact is ¼ of post-game values (via applyMicroLearning).
 */

import type { MatchSimulationEvent } from '@/match/events/matchSimulationContract';
import type { MatchSimulationEventBus } from '@/match/events/matchSimulationEventBus';
import {
  MatchLearningCapture,
  applyMicroLearning,
  type CapturedLearningEvent,
} from './MatchLearningEngine';
import type { LearningState } from './types';

export class LiveLearningBridge {
  readonly capture = new MatchLearningCapture();
  private driftAccumulator = new Map<string, number>();
  private unsubscribe: (() => void) | null = null;
  private learningStates = new Map<string, LearningState>();

  /** Register initial learning states for all players. */
  registerPlayers(players: Array<{ id: string; learningState: LearningState }>) {
    for (const p of players) {
      this.learningStates.set(p.id, { ...p.learningState });
    }
  }

  /** Subscribe to the event bus. Call once when match starts. */
  attach(eventBus: MatchSimulationEventBus) {
    this.unsubscribe = eventBus.subscribe((event) => this.onEvent(event));
  }

  detach() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** Get the current (micro-adjusted) learning state for a player. */
  getLearningState(playerId: string): LearningState | undefined {
    return this.learningStates.get(playerId);
  }

  private onEvent(event: MatchSimulationEvent) {
    const minute = Math.floor(event.at / 60);

    switch (event.kind) {
      case 'PassCompleted': {
        this.capture.recordPassOk(event.fromPlayerId, minute, false);
        this.applyLatest(event.fromPlayerId);
        break;
      }

      case 'CausalShotResult': {
        const isGoal = event.outcome === 'goal' || event.outcome === 'post_in';
        const isOnTarget = isGoal || event.outcome === 'save';
        const isWide = event.outcome === 'wide' || event.outcome === 'post_out';
        if (isOnTarget) {
          this.capture.recordShotOk(event.shooterId, minute, isGoal);
        } else {
          this.capture.recordShotFail(event.shooterId, minute, isWide);
        }
        this.applyLatest(event.shooterId);
        if (isGoal) {
          this.capture.recordCriticalSuccess(event.shooterId, minute, 'Gol marcado');
          this.applyLatest(event.shooterId);
        }
        break;
      }
    }
  }

  private applyLatest(playerId: string) {
    const events = this.capture.getPlayerEvents(playerId);
    const lastEvent = events[events.length - 1];
    if (!lastEvent) return;
    const currentState = this.learningStates.get(playerId);
    if (!currentState) return;
    const updated = applyMicroLearning(currentState, lastEvent, this.driftAccumulator);
    this.learningStates.set(playerId, updated);
  }

  /** Get all captured events (for post-game report). */
  getAllEvents(): CapturedLearningEvent[] {
    return this.capture.getEvents();
  }

  clear() {
    this.capture.clear();
    this.driftAccumulator.clear();
    this.learningStates.clear();
  }
}
