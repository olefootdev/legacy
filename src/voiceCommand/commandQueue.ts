/**
 * Fila de comandos de voz por jogador.
 *
 * O manager fala → `VOICE_COMMAND_ISSUED` no reducer injeta em
 * `liveMatch.voiceCommands[playerId]` → `tacticalPositioning` e `TacticalSimLoop`
 * leem antes do brain default, aplicando overrides posicional/decisório.
 *
 * Este módulo só define helpers puros — criação, expiração, overrides.
 * Escrita do estado acontece no reducer.
 */

import type {
  ObedienceTier,
  PendingCommand,
  VoiceIntent,
} from './types';
import { INTENT_DURATION_MS } from './types';

// ─── Criação / expiração ────────────────────────────────────────────────────

export function createPendingCommand(params: {
  intent: VoiceIntent;
  simTimeMs: number;
  effectiveObedience: number;
  tier: ObedienceTier;
  urgency?: 'normal' | 'high';
  payload?: Record<string, unknown>;
}): PendingCommand {
  const duration = INTENT_DURATION_MS[params.intent] ?? 5_000;
  return {
    intent: params.intent,
    issuedAt: params.simTimeMs,
    expiresAt: params.simTimeMs + duration,
    urgency: params.urgency ?? 'normal',
    effectiveObedience: params.effectiveObedience,
    tier: params.tier,
    payload: params.payload,
  };
}

export function isCommandActive(cmd: PendingCommand | undefined, nowMs: number): boolean {
  if (!cmd) return false;
  if (cmd.tier === 'refuse' || cmd.tier === 'protest') return false; // recusou, não executa
  return nowMs < cmd.expiresAt;
}

// ─── Target position override por intent ────────────────────────────────────

/** Ponto alvo preferencial no campo (coords engine 0-100). */
export interface CommandPositionOverride {
  /** Alvo X preferido (0-100). */
  tx: number;
  /** Alvo Y preferido (0-100). */
  ty: number;
  /** Força da sobrescrita: 0 (nada) .. 1 (trava no alvo). */
  strength: number;
}

/**
 * Tradução do intent pra alvo posicional. O jogador recebe esse ponto como
 * destino preferido; `tacticalPositioning` mistura com o alvo base.
 *
 * Só aplica pra intents individuais/coletivos com efeito espacial claro.
 * Comandos abstratos (calm_team, spare_player) retornam null.
 */
export function commandPositionOverride(
  intent: VoiceIntent,
  side: 'home' | 'away',
  self: { x: number; y: number; role?: string; slotId?: string },
): CommandPositionOverride | null {
  const dirX = side === 'home' ? 1 : -1;
  const toSide = (x: number) => (side === 'home' ? x : 100 - x);

  switch (intent) {
    case 'invade_box':
    case 'hold_small_area':
      // Ponta da grande área adversária (ponto de pênalti engine ≈ 89 / y=50).
      return { tx: toSide(89), ty: 50, strength: 0.62 };

    case 'break_line':
    case 'run_behind':
      // Mais à frente que o bloco — quase na linha de fundo adversária.
      return { tx: toSide(96), ty: self.y, strength: 0.55 };

    case 'take_shot':
      // Puxa ligeiramente pra frente; decisão de chute é no brain.
      return { tx: Math.min(100, self.x + dirX * 4), ty: self.y, strength: 0.35 };

    case 'cross_ball':
    case 'laterals_cross': {
      // Empurra pro corredor lateral mais próximo da linha de fundo.
      const isLeft = self.y < 50;
      return { tx: toSide(92), ty: isLeft ? 10 : 90, strength: 0.55 };
    }

    case 'left_back_overlap':
      return { tx: toSide(90), ty: 12, strength: 0.6 };

    case 'stretch_team':
      // Atacantes disparam pra última linha, criando espaço no meio.
      return { tx: toSide(94), ty: self.y, strength: 0.45 };

    case 'team_high_line':
    case 'forwards_press_defenders':
      // Bloco sobe forte.
      return { tx: toSide(Math.min(100, self.x + 14)), ty: self.y, strength: 0.4 };

    case 'team_retreat':
      // Bloco recua forte pro meio-campo defensivo.
      return { tx: toSide(Math.max(0, self.x - 14)), ty: self.y, strength: 0.4 };

    case 'team_press_high':
      // Cada um pressiona a bola onde está — usa centro como aproximação.
      return { tx: toSide(70), ty: self.y, strength: 0.35 };

    case 'mark_player':
    case 'block_advance':
      // Alvo real do marcador é o adversário — posicional aqui só ancora atrás.
      return { tx: Math.max(0, Math.min(100, self.x + dirX * -2)), ty: self.y, strength: 0.25 };

    case 'midfielders_compact':
      return { tx: self.x, ty: 50, strength: 0.3 };

    default:
      return null;
  }
}

// ─── Bias de decisão por intent ─────────────────────────────────────────────

/**
 * Ajustes na decisão do brain quando há comando ativo. Lidos por OnBallDecision
 * através de `ctx.voiceBias` (injetado pelo TacticalSimLoop).
 */
export interface CommandDecisionBias {
  /** Aumenta probabilidade de chute. */
  shootBoost?: number;
  /** Aumenta preferência por drible. */
  dribbleBoost?: number;
  /** Passa mais cruzado / longo. */
  crossBoost?: number;
  /** Prefere passe curto rápido. */
  quickPassBoost?: number;
  /** Reduz ritmo — segura a bola. */
  holdBallBoost?: number;
  /** Aumenta pressão defensiva. */
  pressIntensity?: number;
  /** Aumenta chance de falta deliberada. */
  foulBoost?: number;
  /** Afrouxa restrições táticas (improvisa). */
  freedomBoost?: number;
  /** Passa preferencialmente pra este jogador (intent pass_to_player). */
  preferredReceiverId?: string;
}

export function commandDecisionBias(intent: VoiceIntent, payload?: Record<string, unknown>): CommandDecisionBias {
  const base: CommandDecisionBias = (() => {
  switch (intent) {
    case 'take_shot':
      return { shootBoost: 1.0 };
    case 'dribble_attempt':
      return { dribbleBoost: 0.9 };
    case 'cross_ball':
    case 'laterals_cross':
      return { crossBoost: 0.85 };
    case 'quick_pass':
      return { quickPassBoost: 0.8 };
    case 'hold_ball':
    case 'wait_support':
    case 'team_hold_possession':
      return { holdBallBoost: 0.75 };
    case 'team_press_high':
    case 'forwards_press_defenders':
      return { pressIntensity: 0.8 };
    case 'aggressive_tackle':
    case 'tactical_foul':
      return { foulBoost: 0.85 };
    case 'free_play':
    case 'break_zone':
      return { freedomBoost: 0.9 };
    case 'invade_box':
    case 'break_line':
    case 'run_behind':
    case 'hold_small_area':
      return { shootBoost: 0.3 }; // chega na área, aumenta leve preferência por chute
    case 'pass_to_player':
      return { quickPassBoost: 0.9 };
    default:
      return {};
  }
  })();
  const receiverId = typeof payload?.preferredReceiverId === 'string' ? payload.preferredReceiverId : undefined;
  return receiverId ? { ...base, preferredReceiverId: receiverId } : base;
}
