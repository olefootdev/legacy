import type { DecisionContext } from '@/playerDecision/types';
import type { GameSpiritDecisionRequest } from '@/gamespirit/gameSpiritDecisionClient';
import { requestGameSpiritDecision } from '@/gamespirit/gameSpiritDecisionClient';
import { buildContextReading, identifyFieldZone } from '@/playerDecision/ContextScanner';
import type { GameSpiritPhase1Hint } from '@/playerDecision/types';

export type GameSpiritPhase1Trigger = 'receive_ball' | 'gain_possession';

const HINT_WALL_MS = 4200;
const MIN_REPEAT_SIM_SEC = 1.85;
const NARRATION_MIN_GAP_MS = 4500;

const hints = new Map<string, GameSpiritPhase1Hint>();
const inFlight = new Set<string>();
const lastRequestSimTime = new Map<string, number>();
const prevEdge = new Map<string, { wasReceiver: boolean; wasCarrier: boolean }>();

let lastNarrationWallMs = 0;

function envFlag(v: string | undefined): boolean {
  const x = (v ?? '').trim().toLowerCase();
  return x === '1' || x === 'true' || x === 'yes';
}

/** Opt-in explícito: evita tráfego OpenAI em todos os builds. */
export function isGameSpiritPhase1ClientEnabled(): boolean {
  try {
    return envFlag(import.meta.env.VITE_OLEFOOT_GAMESPIRIT_PHASE1);
  } catch {
    return false;
  }
}

export function resetGameSpiritPhase1Orchestrator(): void {
  hints.clear();
  inFlight.clear();
  lastRequestSimTime.clear();
  prevEdge.clear();
  lastNarrationWallMs = 0;
}

function slotLabel(ctx: DecisionContext): string {
  const s = ctx.self.slotId ?? ctx.self.role ?? '?';
  return String(s).toUpperCase();
}

function nearbyLabels(ctx: DecisionContext, max = 4): string[] {
  const self = ctx.self;
  const scored = ctx.teammates
    .map((t) => ({
      t,
      d: Math.hypot(t.x - self.x, t.z - self.z),
    }))
    .sort((a, b) => a.d - b.d)
    .slice(0, max);
  return scored.map(({ t }) => (t.slotId ?? t.role ?? '?').toString().toUpperCase());
}

function objectiveFor(ctx: DecisionContext, trigger: GameSpiritPhase1Trigger): string {
  if (trigger === 'receive_ball') return 'first_touch';
  if (ctx.isCarrier) {
    const z = identifyFieldZone(ctx.self.x, ctx.attackDir);
    if (z === 'opp_box' || z === 'att_third') return 'finish_or_progress';
    return 'build_play';
  }
  if (ctx.possession === ctx.self.side) return 'support_attack';
  return 'defend_and_press';
}

export function buildGameSpiritPhase1Request(
  ctx: DecisionContext,
  trigger: GameSpiritPhase1Trigger,
  shirtNumber: number | undefined,
): GameSpiritDecisionRequest {
  const reading = buildContextReading(ctx);
  const zone = identifyFieldZone(ctx.self.x, ctx.attackDir);
  const pr = reading.pressure.intensity;
  const pressureLevel =
    pr === 'none' || pr === 'low' ? 'low' : pr === 'medium' ? 'medium' : pr === 'high' ? 'high' : 'high';

  const num = shirtNumber != null ? String(shirtNumber) : '';
  const player = `${slotLabel(ctx)}${num ? ` ${num}` : ''}`.trim();

  return {
    player,
    position: zone,
    ballOwner: ctx.isCarrier,
    pressureLevel,
    nearbyPlayers: nearbyLabels(ctx),
    objective: objectiveFor(ctx, trigger),
  };
}

export function attachGameSpiritPhase1Hint(
  ctx: DecisionContext,
  playerId: string,
): void {
  const h = hints.get(playerId);
  if (h && Date.now() < h.expiresAtMs) {
    ctx.gameSpiritPhase1Hint = h;
  }
}

export function detectGameSpiritPhase1Trigger(
  playerId: string,
  isReceiver: boolean,
  isCarrier: boolean,
  ballFlightProgress: number,
): GameSpiritPhase1Trigger | null {
  const prev = prevEdge.get(playerId) ?? { wasReceiver: false, wasCarrier: false };
  prevEdge.set(playerId, { wasReceiver: isReceiver, wasCarrier: isCarrier });

  const receiveEdge =
    isReceiver
    && !prev.wasReceiver
    && ballFlightProgress > 0.05
    && ballFlightProgress < 0.52;
  if (receiveEdge) return 'receive_ball';

  if (isCarrier && !prev.wasCarrier) return 'gain_possession';

  return null;
}

export function scheduleGameSpiritPhase1Request(opts: {
  playerId: string;
  decCtx: DecisionContext;
  simTime: number;
  trigger: GameSpiritPhase1Trigger;
  shirtNumber: number | undefined;
  onNarration: (text: string) => void;
}): void {
  if (!isGameSpiritPhase1ClientEnabled()) return;

  const { playerId, decCtx, simTime, trigger, shirtNumber, onNarration } = opts;
  if (decCtx.self.role === 'gk' || decCtx.self.slotId === 'gol') return;
  const flightKey = `${playerId}:${trigger}`;
  if (inFlight.has(flightKey)) return;

  const last = lastRequestSimTime.get(playerId) ?? -1e9;
  if (simTime - last < MIN_REPEAT_SIM_SEC) return;

  const body = buildGameSpiritPhase1Request(decCtx, trigger, shirtNumber);

  inFlight.add(flightKey);

  void requestGameSpiritDecision(body).then((res) => {
    inFlight.delete(flightKey);
    if ('error' in res) return;

    lastRequestSimTime.set(playerId, simTime);

    hints.set(playerId, {
      decision: res.decision,
      narration: res.narration,
      confidence: res.confidence,
      expiresAtMs: Date.now() + HINT_WALL_MS,
    });

    if (Date.now() - lastNarrationWallMs >= NARRATION_MIN_GAP_MS) {
      lastNarrationWallMs = Date.now();
      onNarration(res.narration);
    }
  });
}
