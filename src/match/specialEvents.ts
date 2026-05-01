/**
 * Eventos Especiais Raros — Fase 2 Core Gameplay #3
 * Eventos únicos que criam histórias memoráveis (~5% chance).
 */

import type { PitchPlayerState } from '@/engine/types';
import type { SpiritContext } from '@/gamespirit/types';

export type SpecialEventType =
  | 'bicycle_kick'
  | 'thunderstrike'
  | 'goalkeeper_assist'
  | 'injury_scare'
  | 'crowd_roar_boost'
  | 'miraculous_save';

export interface SpecialEvent {
  type: SpecialEventType;
  playerId: string;
  playerName: string;
  minute: number;
  narrative: string;
  effect?: {
    xGBonus?: number;
    fatigueIncrease?: number;
    accuracyBoost?: number;
    durationMinutes?: number;
  };
}

/** Bicicleta espetacular */
export function tryBicycleKick(
  shooter: PitchPlayerState,
  ctx: SpiritContext,
): SpecialEvent | null {
  const fisico = shooter.attributes?.fisico ?? 50;
  const acrobacia = shooter.attributes?.fisico ?? 50; // proxy: fisico

  // Só em zona de ataque, 5% chance, requer físico 70+ e acrobacia 65+
  if (ctx.ballZone !== 'att') return null;
  if (fisico < 70 || acrobacia < 65) return null;
  if (Math.random() > 0.05) return null;

  return {
    type: 'bicycle_kick',
    playerId: shooter.playerId,
    playerName: shooter.name,
    minute: ctx.minute,
    narrative: `${ctx.minute}' — BICICLETA ESPETACULAR DE ${shooter.name.toUpperCase()}! O estádio está em pé!`,
    effect: {
      xGBonus: 1.5, // +50% chance de gol
    },
  };
}

/** Bomba de fora da área */
export function tryThunderstrike(
  shooter: PitchPlayerState,
  ctx: SpiritContext,
): SpecialEvent | null {
  const finalizacao = shooter.attributes?.finalizacao ?? 50;
  const chuteLongo = shooter.attributes?.finalizacao ?? 50; // proxy: finalizacao

  // Só fora da área (mid zone), 8% chance, requer finalização 75+ e chute longo 70+
  if (ctx.ballZone !== 'mid') return null;
  if (finalizacao < 75 || chuteLongo < 70) return null;
  if (Math.random() > 0.08) return null;

  return {
    type: 'thunderstrike',
    playerId: shooter.playerId,
    playerName: shooter.name,
    minute: ctx.minute,
    narrative: `${ctx.minute}' — BOMBA DE FORA DA ÁREA! ${shooter.name.toUpperCase()} solta o pé!`,
    effect: {
      xGBonus: 2.0, // dobra chance de gol
    },
  };
}

/** Assistência do goleiro */
export function tryGoalkeeperAssist(
  ctx: SpiritContext,
): SpecialEvent | null {
  // Só em goal kick, 6% chance
  if (ctx.ballZone !== 'def') return null;
  if (Math.random() > 0.06) return null;

  // Pega goleiro (primeiro defensor)
  const gk = ctx.homePlayers?.find(p => p.role === 'def');
  if (!gk) return null;

  const gkPassing = (gk.attributes as any)?.passe ?? 50;
  if (gkPassing < 65) return null;

  return {
    type: 'goalkeeper_assist',
    playerId: gk.playerId,
    playerName: gk.name,
    minute: ctx.minute,
    narrative: `${ctx.minute}' — Lançamento cirúrgico do goleiro ${gk.name}! Atacante livre!`,
    effect: {
      xGBonus: 1.3,
    },
  };
}

/** Susto de lesão (jogador fica mancando 2-3 min) */
export function tryInjuryScare(
  victim: PitchPlayerState,
  ctx: SpiritContext,
): SpecialEvent | null {
  // 5% chance em faltas duras
  if (Math.random() > 0.05) return null;

  return {
    type: 'injury_scare',
    playerId: victim.playerId,
    playerName: victim.name,
    minute: ctx.minute,
    narrative: `${ctx.minute}' — ${victim.name} levou uma pancada feia... consegue continuar, mas está sentindo.`,
    effect: {
      fatigueIncrease: 15,
      durationMinutes: 3,
    },
  };
}

/** Torcida empurra o time (boost quando perdendo em casa) */
export function tryCrowdRoarBoost(
  ctx: SpiritContext,
): SpecialEvent | null {
  const scoreDiff = ctx.homeScore - ctx.awayScore;

  // 7% chance quando perdendo em casa, crowdSupport alto
  if (scoreDiff >= 0) return null;
  if (ctx.crowdSupport < 70) return null;
  if (Math.random() > 0.07) return null;

  return {
    type: 'crowd_roar_boost',
    playerId: 'team',
    playerName: ctx.homeShort ?? 'Casa',
    minute: ctx.minute,
    narrative: `${ctx.minute}' — A TORCIDA EMPURRA O TIME! ${ctx.homeShort?.toUpperCase()} sente a energia do estádio!`,
    effect: {
      accuracyBoost: 0.20, // +20% shot accuracy
      durationMinutes: 5,
    },
  };
}

/** Defesa milagrosa do goleiro */
export function tryMiraculousSave(
  ctx: SpiritContext,
  gkSkill: number,
): SpecialEvent | null {
  // 10% chance em shots perigosos (zona att), requer GK skill 75+
  if (ctx.ballZone !== 'att') return null;
  if (gkSkill < 75) return null;
  if (Math.random() > 0.10) return null;

  return {
    type: 'miraculous_save',
    playerId: 'away_gk',
    playerName: 'Goleiro',
    minute: ctx.minute,
    narrative: `${ctx.minute}' — DEFESA MILAGROSA! O goleiro voa e salva o impossível!`,
    effect: {
      xGBonus: 0.3, // reduz xG do próximo chute
      durationMinutes: 2,
    },
  };
}

/** Tenta detectar evento especial baseado no contexto */
export function detectSpecialEvent(
  action: 'shot' | 'progress' | 'press' | 'foul',
  shooter: PitchPlayerState | undefined,
  ctx: SpiritContext,
  gkSkill?: number,
): SpecialEvent | null {
  if (!shooter && action !== 'press') return null;

  switch (action) {
    case 'shot':
      // Tenta bicicleta, bomba ou defesa milagrosa
      return (
        tryBicycleKick(shooter!, ctx) ||
        tryThunderstrike(shooter!, ctx) ||
        (gkSkill ? tryMiraculousSave(ctx, gkSkill) : null)
      );

    case 'progress':
      // Tenta assistência do goleiro
      return tryGoalkeeperAssist(ctx);

    case 'foul':
      // Tenta susto de lesão
      return tryInjuryScare(shooter!, ctx);

    case 'press':
      // Tenta boost da torcida
      return tryCrowdRoarBoost(ctx);

    default:
      return null;
  }
}

/** Aplica efeito do evento especial no xG ou stats */
export function applySpecialEventEffect(
  event: SpecialEvent,
  baseXG: number,
): number {
  if (!event.effect?.xGBonus) return baseXG;
  return baseXG * event.effect.xGBonus;
}
