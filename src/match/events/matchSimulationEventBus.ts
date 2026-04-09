import type { MatchSimulationEvent } from './matchSimulationContract';

export type MatchSimulationSubscriber = (event: MatchSimulationEvent) => void;

/** Bus síncrono leve (mobile-safe): mesma ordem de emissão para todos os subscritores. */
export class MatchSimulationEventBus {
  private subs: MatchSimulationSubscriber[] = [];

  subscribe(fn: MatchSimulationSubscriber): () => void {
    this.subs.push(fn);
    return () => {
      this.subs = this.subs.filter((s) => s !== fn);
    };
  }

  emit(event: MatchSimulationEvent) {
    for (const s of this.subs) {
      s(event);
    }
  }

  clearSubscribers() {
    this.subs = [];
  }
}
