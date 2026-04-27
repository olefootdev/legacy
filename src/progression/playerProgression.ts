/**
 * Sistema de Meta-Progressão
 * XP por jogador, desbloqueio de signature moves, árvore de habilidades
 */

import type { PlayerEntity } from '@/entities/types';

export type SignatureMoveType =
  | 'bicycle_kick'
  | 'thunderstrike'
  | 'chip_shot'
  | 'rabona'
  | 'elastico'
  | 'rainbow_flick'
  | 'scorpion_kick'
  | 'trivela'
  | 'knuckleball'
  | 'panenka';

export interface SignatureMove {
  id: SignatureMoveType;
  name: string;
  description: string;
  requiredXP: number;
  requiredAttributes: Partial<Record<string, number>>;
  unlockCost: number; // OLE
  xGBoost: number;
  cooldownMinutes: number;
  icon: string;
}

export interface PlayerProgression {
  playerId: string;
  totalXP: number;
  level: number;
  matchesPlayed: number;
  goalsScored: number;
  assistsMade: number;
  unlockedMoves: SignatureMoveType[];
  moveUsageCount: Record<SignatureMoveType, number>;
  lastMatchXP: number;
}

export const SIGNATURE_MOVES: Record<SignatureMoveType, SignatureMove> = {
  bicycle_kick: {
    id: 'bicycle_kick',
    name: 'Bicicleta',
    description: 'Chute acrobático espetacular',
    requiredXP: 500,
    requiredAttributes: { fisico: 70, acrobacia: 65 },
    unlockCost: 1000,
    xGBoost: 1.5,
    cooldownMinutes: 15,
    icon: '🚴',
  },
  thunderstrike: {
    id: 'thunderstrike',
    name: 'Bomba',
    description: 'Chute potente de fora da área',
    requiredXP: 800,
    requiredAttributes: { finalizacao: 75, chuteLongo: 70 },
    unlockCost: 1500,
    xGBoost: 2.0,
    cooldownMinutes: 20,
    icon: '⚡',
  },
  chip_shot: {
    id: 'chip_shot',
    name: 'Cavadinha',
    description: 'Toque sutil por cima do goleiro',
    requiredXP: 600,
    requiredAttributes: { finalizacao: 70, tecnica: 75 },
    unlockCost: 1200,
    xGBoost: 1.4,
    cooldownMinutes: 12,
    icon: '🌙',
  },
  rabona: {
    id: 'rabona',
    name: 'Rabona',
    description: 'Cruzamento ou chute com perna cruzada',
    requiredXP: 1000,
    requiredAttributes: { tecnica: 80, drible: 75 },
    unlockCost: 2000,
    xGBoost: 1.3,
    cooldownMinutes: 18,
    icon: '🎭',
  },
  elastico: {
    id: 'elastico',
    name: 'Elástico',
    description: 'Drible rápido que engana o defensor',
    requiredXP: 700,
    requiredAttributes: { drible: 80, velocidade: 70 },
    unlockCost: 1400,
    xGBoost: 1.2,
    cooldownMinutes: 10,
    icon: '🌀',
  },
  rainbow_flick: {
    id: 'rainbow_flick',
    name: 'Arco-íris',
    description: 'Levanta a bola por cima do adversário',
    requiredXP: 1200,
    requiredAttributes: { drible: 85, tecnica: 80 },
    unlockCost: 2500,
    xGBoost: 1.6,
    cooldownMinutes: 25,
    icon: '🌈',
  },
  scorpion_kick: {
    id: 'scorpion_kick',
    name: 'Escorpião',
    description: 'Defesa ou finalização com calcanhar',
    requiredXP: 1500,
    requiredAttributes: { acrobacia: 85, fisico: 75 },
    unlockCost: 3000,
    xGBoost: 1.8,
    cooldownMinutes: 30,
    icon: '🦂',
  },
  trivela: {
    id: 'trivela',
    name: 'Trivela',
    description: 'Chute ou passe com efeito externo',
    requiredXP: 900,
    requiredAttributes: { tecnica: 78, passe: 75 },
    unlockCost: 1800,
    xGBoost: 1.4,
    cooldownMinutes: 15,
    icon: '🎯',
  },
  knuckleball: {
    id: 'knuckleball',
    name: 'Folha Seca',
    description: 'Chute sem rotação que oscila no ar',
    requiredXP: 1100,
    requiredAttributes: { finalizacao: 80, chuteLongo: 78 },
    unlockCost: 2200,
    xGBoost: 1.7,
    cooldownMinutes: 22,
    icon: '🍃',
  },
  panenka: {
    id: 'panenka',
    name: 'Panenka',
    description: 'Pênalti cavado no centro',
    requiredXP: 1300,
    requiredAttributes: { compostura: 85, tecnica: 75 },
    unlockCost: 2800,
    xGBoost: 1.5,
    cooldownMinutes: 0, // Só em pênaltis
    icon: '🎩',
  },
};

const PROGRESSION_STORAGE_KEY = 'olefoot_player_progression';

export class PlayerProgressionManager {
  /**
   * Carrega progressão de um jogador
   */
  static getProgression(playerId: string): PlayerProgression {
    const all = this.getAllProgressions();
    return (
      all[playerId] || {
        playerId,
        totalXP: 0,
        level: 1,
        matchesPlayed: 0,
        goalsScored: 0,
        assistsMade: 0,
        unlockedMoves: [],
        moveUsageCount: {},
        lastMatchXP: 0,
      }
    );
  }

  /**
   * Carrega todas as progressões
   */
  static getAllProgressions(): Record<string, PlayerProgression> {
    try {
      const raw = localStorage.getItem(PROGRESSION_STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  /**
   * Salva progressão de um jogador
   */
  static saveProgression(progression: PlayerProgression): void {
    try {
      const all = this.getAllProgressions();
      all[progression.playerId] = progression;
      localStorage.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(all));
    } catch (error) {
      console.error('Failed to save progression:', error);
    }
  }

  /**
   * Adiciona XP a um jogador
   */
  static addXP(playerId: string, xp: number): PlayerProgression {
    const prog = this.getProgression(playerId);
    prog.totalXP += xp;
    prog.lastMatchXP = xp;
    prog.level = this.calculateLevel(prog.totalXP);
    this.saveProgression(prog);
    return prog;
  }

  /**
   * Registra estatísticas de partida
   */
  static recordMatchStats(
    playerId: string,
    stats: { goals?: number; assists?: number; xp: number },
  ): PlayerProgression {
    const prog = this.getProgression(playerId);
    prog.matchesPlayed++;
    prog.goalsScored += stats.goals || 0;
    prog.assistsMade += stats.assists || 0;
    prog.totalXP += stats.xp;
    prog.lastMatchXP = stats.xp;
    prog.level = this.calculateLevel(prog.totalXP);
    this.saveProgression(prog);
    return prog;
  }

  /**
   * Desbloqueia signature move
   */
  static unlockMove(playerId: string, moveId: SignatureMoveType): boolean {
    const prog = this.getProgression(playerId);
    const move = SIGNATURE_MOVES[moveId];

    if (!move) return false;
    if (prog.unlockedMoves.includes(moveId)) return false;
    if (prog.totalXP < move.requiredXP) return false;

    prog.unlockedMoves.push(moveId);
    this.saveProgression(prog);
    return true;
  }

  /**
   * Registra uso de signature move
   */
  static recordMoveUsage(playerId: string, moveId: SignatureMoveType): void {
    const prog = this.getProgression(playerId);
    if (!prog.unlockedMoves.includes(moveId)) return;

    prog.moveUsageCount[moveId] = (prog.moveUsageCount[moveId] || 0) + 1;
    this.saveProgression(prog);
  }

  /**
   * Calcula nível baseado em XP total
   */
  static calculateLevel(totalXP: number): number {
    // Fórmula: level = floor(sqrt(totalXP / 100)) + 1
    return Math.floor(Math.sqrt(totalXP / 100)) + 1;
  }

  /**
   * XP necessário para próximo nível
   */
  static xpForNextLevel(currentLevel: number): number {
    return (currentLevel * currentLevel) * 100;
  }

  /**
   * Verifica se jogador pode usar signature move
   */
  static canUseMove(
    playerId: string,
    moveId: SignatureMoveType,
    player: PlayerEntity,
  ): { can: boolean; reason?: string } {
    const prog = this.getProgression(playerId);
    const move = SIGNATURE_MOVES[moveId];

    if (!move) return { can: false, reason: 'Move não existe' };
    if (!prog.unlockedMoves.includes(moveId)) return { can: false, reason: 'Move não desbloqueado' };

    // Verifica atributos
    for (const [attr, required] of Object.entries(move.requiredAttributes)) {
      const playerAttr = (player.attrs as any)[attr] || 0;
      if (playerAttr < required) {
        return { can: false, reason: `${attr} insuficiente (${playerAttr}/${required})` };
      }
    }

    return { can: true };
  }

  /**
   * Lista moves disponíveis para desbloquear
   */
  static getAvailableMoves(playerId: string, player: PlayerEntity): SignatureMove[] {
    const prog = this.getProgression(playerId);

    return Object.values(SIGNATURE_MOVES).filter((move) => {
      if (prog.unlockedMoves.includes(move.id)) return false;
      if (prog.totalXP < move.requiredXP) return false;

      // Verifica atributos
      for (const [attr, required] of Object.entries(move.requiredAttributes)) {
        const playerAttr = (player.attrs as any)[attr] || 0;
        if (playerAttr < required) return false;
      }

      return true;
    });
  }
}

/**
 * Calcula XP ganho em uma partida
 */
export function calculateMatchXP(stats: {
  minutesPlayed: number;
  goals: number;
  assists: number;
  shots: number;
  passes: number;
  tackles: number;
  won: boolean;
  draw: boolean;
}): number {
  let xp = 0;

  // Base por minutos jogados
  xp += stats.minutesPlayed * 2;

  // Gols e assistências
  xp += stats.goals * 50;
  xp += stats.assists * 30;

  // Participação
  xp += stats.shots * 5;
  xp += stats.passes * 1;
  xp += stats.tackles * 8;

  // Resultado
  if (stats.won) xp += 100;
  else if (stats.draw) xp += 50;

  return Math.floor(xp);
}
