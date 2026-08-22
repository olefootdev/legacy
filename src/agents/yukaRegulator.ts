/**
 * Decision frequency regulator per agent.
 *
 * Prevents re-evaluation at 60fps (causes nervous/jittery behavior).
 * Each agent decides on a fixed cadence with a jitter so the entire team
 * doesn't re-decide on the same frame.
 *
 * Critical events (receiving ball, losing possession, nearby duel)
 * can force an immediate re-evaluation via `rush()`.
 *
 * ── Determinismo ──────────────────────────────────────────────────────────────
 * O jitter usava `Math.random()`, o que tornava a partida irreproduzível mesmo
 * com seed fixa: cada agente redecidia em instantes diferentes a cada execução,
 * e a divergência se acumulava. Duas rodadas da régua de realismo com os MESMOS
 * seeds davam números diferentes, o que torna impossível saber se uma mudança de
 * motor melhorou ou piorou a partida.
 *
 * O jitter agora vem de uma sequência determinística por agente (`phase01`), que
 * cumpre a mesma função — desencontrar as decisões do time — sem sortear nada.
 */
export class AgentRegulator {
  private nextDecisionAt = 0;
  private interval: number;
  private readonly baseMs: number;
  private readonly jitterMs: number;
  /** Fase determinística deste agente em [0,1). Substitui o sorteio. */
  private phase: number;

  /**
   * @param phase01 fase inicial em [0,1) — use algo estável e distinto por agente
   *                (índice do slot, hash do id). O default 0.5 mantém o
   *                comportamento previsível para chamadores que não se importam.
   */
  constructor(baseMs = 250, jitterMs = 100, phase01 = 0.5) {
    this.baseMs = baseMs;
    this.jitterMs = jitterMs;
    this.phase = ((phase01 % 1) + 1) % 1;
    this.interval = baseMs + this.phase * jitterMs;
  }

  /**
   * Avança a fase por um passo irracional (parte fracionária da razão áurea).
   * Distribui as decisões de forma uniforme e sem repetir ciclo curto — é a
   * sequência de baixa discrepância padrão para este uso.
   */
  private nextPhase(): number {
    this.phase = (this.phase + 0.618_033_988_749_895) % 1;
    return this.phase;
  }

  ready(nowMs: number): boolean {
    if (nowMs < this.nextDecisionAt) return false;
    this.nextDecisionAt = nowMs + this.baseMs + this.nextPhase() * this.jitterMs;
    return true;
  }

  rush(): void {
    this.nextDecisionAt = 0;
  }

  /** Stretch interval when fatigue is high (tired players think slower). */
  adjustForFatigue(fatigue01: number): void {
    const stretch = 1 + fatigue01 * 0.4;
    this.interval = (this.baseMs + this.nextPhase() * this.jitterMs) * stretch;
  }
}
