import type { PossessionSide } from '@/engine/types';
import type { PitchZone, PlayBeat, PlayStoryState } from './types';
import { attackingThirdForSide } from './zones';

export interface StoryTickInput {
  dt: number;
  ballX: number;
  possessionSide: PossessionSide;
  ballZone: PitchZone;
}

/**
 * Mantém a “história” da jogada: fases com continuidade, reset em mudança de posse.
 */
export class PlayStoryTracker {
  private prevPossession: PossessionSide | undefined;
  private beat: PlayBeat = 'organization';
  private timeInBeat = 0;
  private drivingSide: PossessionSide = 'home';

  reset() {
    this.prevPossession = undefined;
    this.beat = 'organization';
    this.timeInBeat = 0;
    this.drivingSide = 'home';
  }

  tick(input: StoryTickInput): PlayStoryState {
    const { dt, ballX, possessionSide, ballZone } = input;

    if (this.prevPossession !== possessionSide) {
      this.prevPossession = possessionSide;
      this.drivingSide = possessionSide;
      this.beat = 'recovery';
      this.timeInBeat = 0;
    }

    this.timeInBeat += dt;

    this.advanceBeat(ballX, ballZone);

    return {
      beat: this.beat,
      timeInBeat: this.timeInBeat,
      drivingSide: this.drivingSide,
    };
  }

  private advanceBeat(ballX: number, ballZone: PitchZone) {
    const inAttThird = attackingThirdForSide(this.drivingSide, ballX);

    if (this.beat === 'recovery') {
      if (this.timeInBeat >= 0.58) {
        this.beat = 'organization';
        this.timeInBeat = 0;
      }
      return;
    }

    if (this.beat === 'organization') {
      if (this.timeInBeat >= 0.75) {
        this.beat = inAttThird ? 'chance_creation' : 'progression';
        this.timeInBeat = 0;
      }
      return;
    }

    if (this.beat === 'progression') {
      if (inAttThird) {
        this.beat = 'chance_creation';
        this.timeInBeat = 0;
      }
      return;
    }

    if (this.beat === 'chance_creation') {
      if (ballZone === 'final_third' && this.timeInBeat >= 0.55) {
        this.beat = 'finishing';
        this.timeInBeat = 0;
      } else if (!inAttThird && this.timeInBeat >= 1.2) {
        this.beat = 'progression';
        this.timeInBeat = 0;
      }
      return;
    }

    if (this.beat === 'finishing') {
      if (this.timeInBeat >= 0.9) {
        this.beat = 'progression';
        this.timeInBeat = 0;
      }
      return;
    }

    if (this.beat === 'turnover') {
      this.beat = 'recovery';
      this.timeInBeat = 0;
    }
  }

  markTurnover() {
    this.beat = 'turnover';
    this.timeInBeat = 0;
  }
}
