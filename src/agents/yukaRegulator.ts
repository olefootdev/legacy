/**
 * Decision frequency regulator per agent.
 *
 * Prevents re-evaluation at 60fps (causes nervous/jittery behavior).
 * Each agent decides every 250-350ms with randomized jitter so the
 * entire team doesn't re-decide on the same frame.
 *
 * Critical events (receiving ball, losing possession, nearby duel)
 * can force an immediate re-evaluation via `rush()`.
 */
export class AgentRegulator {
  private nextDecisionAt = 0;
  private interval: number;
  private readonly baseMs: number;
  private readonly jitterMs: number;

  constructor(baseMs = 250, jitterMs = 100) {
    this.baseMs = baseMs;
    this.jitterMs = jitterMs;
    this.interval = baseMs + Math.random() * jitterMs;
  }

  ready(nowMs: number): boolean {
    if (nowMs < this.nextDecisionAt) return false;
    this.nextDecisionAt = nowMs + this.baseMs + Math.random() * this.jitterMs;
    return true;
  }

  rush(): void {
    this.nextDecisionAt = 0;
  }

  /** Stretch interval when fatigue is high (tired players think slower). */
  adjustForFatigue(fatigue01: number): void {
    const stretch = 1 + fatigue01 * 0.4;
    this.interval = (this.baseMs + Math.random() * this.jitterMs) * stretch;
  }
}
