import type { CausalMatchEvent } from '@/match/causal/matchCausalTypes';

/**
 * Momentum por lado (-1..+1). Cada minuto tem decay 8% + delta por eventos.
 * Time com momentum positivo arrisca mais (shotBias ↑), negativo recolhe (mais recycle).
 *
 * Design explícito: *5-10 min de pressão* é o que o futebol real sente.
 * Decay 0.92 por minuto ≈ metade em ~8 minutos.
 */
export interface MomentumState {
  home: number;
  away: number;
}

export const EMPTY_MOMENTUM: MomentumState = { home: 0, away: 0 };

function clamp(x: number): number {
  return Math.max(-1, Math.min(1, x));
}

/**
 * Recebe momentum atual e eventos causais do último minuto; devolve novo momentum.
 * Não muta entrada.
 */
export function updateMomentum(prev: MomentumState, events: readonly CausalMatchEvent[]): MomentumState {
  let home = prev.home * 0.92;
  let away = prev.away * 0.92;

  for (const ev of events) {
    switch (ev.type) {
      case 'shot_result': {
        const side = ev.payload.side;
        if (ev.payload.outcome === 'goal' || ev.payload.outcome === 'post_in') {
          if (side === 'home') home += 0.45;
          else away += 0.45;
        } else if (ev.payload.outcome === 'save' || ev.payload.outcome === 'post_out' || ev.payload.outcome === 'block') {
          if (side === 'home') home += 0.06;
          else away += 0.06;
        }
        break;
      }
      case 'shot_attempt': {
        if (ev.payload.side === 'home') home += 0.05;
        else away += 0.05;
        break;
      }
      case 'possession_change': {
        if (ev.payload.to === 'home') home += 0.03;
        else away += 0.03;
        break;
      }
      case 'interception': {
        if (ev.payload.defenderSide === 'home') home += 0.04;
        else away += 0.04;
        break;
      }
      case 'dribble_attempt': {
        if (ev.payload.success) {
          if (ev.payload.carrierSide === 'home') home += 0.02;
          else away += 0.02;
        }
        break;
      }
      case 'card_shown': {
        // `side` = time do jogador que tomou o cartão.
        const side = ev.payload.side;
        const loss = ev.payload.card === 'red' ? 0.5 : 0.08;
        if (side === 'home') home -= loss;
        else away -= loss;
        break;
      }
      case 'foul_committed': {
        const side = ev.payload.foulerSide;
        if (side === 'home') home -= 0.02;
        else away -= 0.02;
        break;
      }
      default:
        break;
    }
  }

  return { home: clamp(home), away: clamp(away) };
}

/**
 * Rótulo textual curto pra UI: 'fria' | 'momentum leve' | 'em cima' | 'dominando'.
 */
export function momentumLabel(value: number): string {
  const a = Math.abs(value);
  if (a < 0.12) return 'equilíbrio';
  if (a < 0.3) return value > 0 ? 'leve momentum' : 'leve pressão';
  if (a < 0.6) return value > 0 ? 'em cima' : 'acuado';
  return value > 0 ? 'dominando' : 'sufocado';
}
