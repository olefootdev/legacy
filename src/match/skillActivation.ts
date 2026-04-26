/**
 * Sistema de ativação de skills em tempo real durante partida ao vivo.
 *
 * Gerencia:
 * - Cooldowns de skills por jogador
 * - Ativação via comandos do treinador
 * - Modificação de behaviors em tempo real
 * - Efeitos visuais no campo
 */

import type { PitchPlayerState } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';
import { getPlayerSkills } from '@/skills/index';
import type { CoachSkill, SkillBehavior } from '@/skills/playbookV1';

export interface ActiveSkill {
  skillId: string;
  playerId: string;
  activatedAt: number; // game time in seconds
  duration: number; // seconds
  behaviors: SkillBehavior[];
}

export interface SkillCooldown {
  skillId: string;
  playerId: string;
  endsAt: number; // game time in seconds
}

export class SkillActivationSystem {
  private activeSkills: Map<string, ActiveSkill> = new Map();
  private cooldowns: Map<string, SkillCooldown> = new Map();

  /**
   * Ativa skill em jogador.
   *
   * @returns true se ativou, false se em cooldown ou inválido
   */
  activateSkill(
    playerId: string,
    skillId: string,
    currentGameTime: number,
    playersById: Record<string, PlayerEntity>,
  ): { success: boolean; reason?: string } {
    const cooldownKey = `${playerId}::${skillId}`;

    // Check cooldown
    const cooldown = this.cooldowns.get(cooldownKey);
    if (cooldown && cooldown.endsAt > currentGameTime) {
      const remaining = Math.ceil(cooldown.endsAt - currentGameTime);
      return { success: false, reason: `Cooldown: ${remaining}s restantes` };
    }

    // Check if player has skill equipped
    const entity = playersById[playerId];
    if (!entity?.skills?.includes(skillId)) {
      return { success: false, reason: 'Skill não equipada' };
    }

    // Get skill definition
    const skills = getPlayerSkills([skillId]);
    if (skills.length === 0) {
      return { success: false, reason: 'Skill não encontrada' };
    }

    const skill = skills[0];

    // Activate skill
    const activeKey = `${playerId}::${skillId}`;
    const duration = 30; // Default 30 seconds
    this.activeSkills.set(activeKey, {
      skillId,
      playerId,
      activatedAt: currentGameTime,
      duration,
      behaviors: skill.behaviors,
    });

    // Set cooldown (skill duration + 15s)
    const cooldownDuration = duration + 15;
    this.cooldowns.set(cooldownKey, {
      skillId,
      playerId,
      endsAt: currentGameTime + cooldownDuration,
    });

    return { success: true };
  }

  /**
   * Retorna behaviors ativos para um jogador no momento atual.
   */
  getActiveBehaviors(playerId: string, currentGameTime: number): SkillBehavior[] {
    const behaviors: SkillBehavior[] = [];

    for (const [key, active] of this.activeSkills) {
      if (!key.startsWith(`${playerId}::`)) continue;

      const expiresAt = active.activatedAt + active.duration;
      if (currentGameTime > expiresAt) {
        // Skill expirou, remove
        this.activeSkills.delete(key);
        continue;
      }

      behaviors.push(...active.behaviors);
    }

    return behaviors;
  }

  /**
   * Retorna cooldowns ativos para um jogador.
   */
  getCooldowns(playerId: string, currentGameTime: number): Array<{ skillId: string; remaining: number }> {
    const result: Array<{ skillId: string; remaining: number }> = [];

    for (const [key, cooldown] of this.cooldowns) {
      if (!key.startsWith(`${playerId}::`)) continue;

      if (cooldown.endsAt <= currentGameTime) {
        // Cooldown expirou, remove
        this.cooldowns.delete(key);
        continue;
      }

      result.push({
        skillId: cooldown.skillId,
        remaining: Math.ceil(cooldown.endsAt - currentGameTime),
      });
    }

    return result;
  }

  /**
   * Aplica bias de behaviors ativos a um score de decisão.
   */
  applyBehaviorBias(
    playerId: string,
    currentGameTime: number,
    baseScore: number,
    biasKey: string,
  ): number {
    const behaviors = this.getActiveBehaviors(playerId, currentGameTime);
    let total = baseScore;

    for (const behavior of behaviors) {
      const bias = behavior.bias[biasKey];
      if (bias != null) {
        total += bias;
      }
    }

    return total;
  }

  /**
   * Limpa todos os estados (usado ao reiniciar partida).
   */
  reset(): void {
    this.activeSkills.clear();
    this.cooldowns.clear();
  }

  /**
   * Retorna skills ativas para debug/UI.
   */
  getActiveSkillsForPlayer(playerId: string, currentGameTime: number): ActiveSkill[] {
    const result: ActiveSkill[] = [];

    for (const [key, active] of this.activeSkills) {
      if (!key.startsWith(`${playerId}::`)) continue;

      const expiresAt = active.activatedAt + active.duration;
      if (currentGameTime <= expiresAt) {
        result.push(active);
      }
    }

    return result;
  }
}

/**
 * Sistema de mensagens do treinador que afetam mentalidade/confiança.
 */
export interface CoachMessage {
  playerId: string;
  message: string;
  sentAt: number; // game time
  impact: 'positive' | 'negative' | 'neutral';
}

export class CoachMessageSystem {
  private recentMessages: CoachMessage[] = [];
  private readonly MESSAGE_DURATION = 60; // 1 minuto de efeito

  /**
   * Envia mensagem para jogador.
   */
  sendMessage(
    playerId: string,
    message: string,
    currentGameTime: number,
  ): void {
    // Analisa sentimento da mensagem (simplificado)
    const impact = this.analyzeMessageImpact(message);

    this.recentMessages.push({
      playerId,
      message,
      sentAt: currentGameTime,
      impact,
    });

    // Limpa mensagens antigas
    this.recentMessages = this.recentMessages.filter(
      (m) => currentGameTime - m.sentAt < this.MESSAGE_DURATION
    );
  }

  /**
   * Retorna modificador de mentalidade para jogador baseado em mensagens recentes.
   */
  getMentalityModifier(playerId: string, currentGameTime: number): number {
    const playerMessages = this.recentMessages.filter(
      (m) => m.playerId === playerId && currentGameTime - m.sentAt < this.MESSAGE_DURATION
    );

    let modifier = 0;
    for (const msg of playerMessages) {
      if (msg.impact === 'positive') modifier += 5;
      else if (msg.impact === 'negative') modifier -= 3;
    }

    return Math.max(-15, Math.min(15, modifier)); // Clamp [-15, +15]
  }

  /**
   * Analisa impacto da mensagem (simplificado).
   */
  private analyzeMessageImpact(message: string): 'positive' | 'negative' | 'neutral' {
    const lower = message.toLowerCase();

    // Palavras positivas
    const positive = ['bem', 'ótimo', 'excelente', 'continua', 'bom', 'parabéns', 'isso', 'força'];
    if (positive.some((word) => lower.includes(word))) {
      return 'positive';
    }

    // Palavras negativas
    const negative = ['erro', 'mal', 'ruim', 'péssimo', 'fraco', 'não', 'para'];
    if (negative.some((word) => lower.includes(word))) {
      return 'negative';
    }

    return 'neutral';
  }

  reset(): void {
    this.recentMessages = [];
  }
}
