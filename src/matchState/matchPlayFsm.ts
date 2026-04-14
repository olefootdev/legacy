import type { MatchTruthPhase } from '@/bridge/matchTruthSchema';

/** Tunable: walk to formation after goal (ou remate para fora) antes da bola voltar ao vivo. */
export const GOAL_RESTART_REPOSITION_SEC = 3;
/** Após o intervalo: segundos com equipas já trocadas de lado e bola parada no centro antes do pontapé de saída. */
export const SECOND_HALF_KICKOFF_WAIT_SEC = 10;
/** Tunable: brief kickoff phase after ball is given before returning to live play. */
export const KICKOFF_TO_LIVE_SEC = 0.5;
/** Tunable: auto-resume from classic set pieces if user does not press “bola viva”. */
export const SET_PIECE_AUTO_RESUME_SEC = 4.5;

export type PlayFsmState = {
  phase: MatchTruthPhase;
  /** Classic set pieces: time until auto live */
  resumeTimer?: number;
  /** goal_restart → kickoff sequence */
  goalSequenceTimer?: number;
};

export class MatchPlayFsm {
  state: PlayFsmState = { phase: 'live' };

  enterPreset(
    phase: Exclude<
      MatchTruthPhase,
      'live' | 'dead_ball' | 'pregame_visual' | 'goal_restart' | 'kickoff'
    >,
  ) {
    this.state = { phase, resumeTimer: undefined };
  }

  /** After goal: players reposition, then kickoff sub-phase, then live. */
  enterGoalRestart() {
    this.state = { phase: 'goal_restart', goalSequenceTimer: 0 };
  }

  /** Chamar após alguns segundos de bola parada ou manualmente */
  resumeLive() {
    this.state = { phase: 'live' };
  }

  tick(dt: number) {
    if (this.state.phase === 'live') return;

    if (this.state.phase === 'goal_restart') {
      const t = (this.state.goalSequenceTimer ?? 0) + dt;
      if (t >= GOAL_RESTART_REPOSITION_SEC) {
        this.state = { phase: 'kickoff', goalSequenceTimer: 0 };
      } else {
        this.state = { ...this.state, goalSequenceTimer: t };
      }
      return;
    }

    if (this.state.phase === 'kickoff') {
      const t = (this.state.goalSequenceTimer ?? 0) + dt;
      if (t >= KICKOFF_TO_LIVE_SEC) {
        this.state = { phase: 'live' };
      } else {
        this.state = { ...this.state, goalSequenceTimer: t };
      }
      return;
    }

    const resumeT = (this.state.resumeTimer ?? 0) + dt;
    if (resumeT > SET_PIECE_AUTO_RESUME_SEC) {
      this.state = { phase: 'live' };
    } else {
      this.state = { ...this.state, resumeTimer: resumeT };
    }
  }

  isReforming(): boolean {
    return this.state.phase !== 'live' && this.state.phase !== 'pregame_visual';
  }
}
