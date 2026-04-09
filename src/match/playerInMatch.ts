import type { PlayerAttributes, PlayerBehavior, PlayerEntity } from '@/entities/types';

/** Papel tático em partida (coletivo) */
export type MatchTacticalRole =
  | 'goleiro'
  | 'zagueiro'
  | 'lateral'
  | 'volante'
  | 'meia'
  | 'ponta'
  | 'atacante';

/** Perfil cognitivo opcional (individual + tendência de decisão) */
export type MatchCognitiveArchetype =
  | 'executor'
  | 'criador'
  | 'destruidor'
  | 'construtor'
  | 'finalizador';

/** Grupos de atributos 0–100 exigidos para o sim em tempo real */
export interface MatchPlayerAttributes {
  passeCurto: number;
  passeLongo: number;
  cruzamento: number;
  marcacao: number;
  velocidade: number;
  fairPlay: number;
  drible: number;
  finalizacao: number;
  fisico: number;
  tatico: number;
  mentalidade: number;
  confianca: number;
}

export interface PlayerMatchRuntime {
  stamina: number;
  /** 0.5–1.2 aprox.; multiplica qualidade de execução */
  confidenceRuntime: number;
  /** -1 a +1 humor de momento */
  moraleRuntime: number;
  /** Últimas ações canônicas (evita alocação: array fixo + count) */
  lastActions: string[];
  lastActionsCount: number;
}

export function clampAttr(n: number): number {
  if (Number.isNaN(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function normalizeMatchAttributes(partial?: Partial<MatchPlayerAttributes>): MatchPlayerAttributes {
  const d: MatchPlayerAttributes = {
    passeCurto: 68,
    passeLongo: 65,
    cruzamento: 62,
    marcacao: 65,
    velocidade: 72,
    fairPlay: 78,
    drible: 66,
    finalizacao: 64,
    fisico: 70,
    tatico: 70,
    mentalidade: 72,
    confianca: 74,
  };
  if (!partial) return d;
  return {
    passeCurto: clampAttr(partial.passeCurto ?? d.passeCurto),
    passeLongo: clampAttr(partial.passeLongo ?? d.passeLongo),
    cruzamento: clampAttr(partial.cruzamento ?? d.cruzamento),
    marcacao: clampAttr(partial.marcacao ?? d.marcacao),
    velocidade: clampAttr(partial.velocidade ?? d.velocidade),
    fairPlay: clampAttr(partial.fairPlay ?? d.fairPlay),
    drible: clampAttr(partial.drible ?? d.drible),
    finalizacao: clampAttr(partial.finalizacao ?? d.finalizacao),
    fisico: clampAttr(partial.fisico ?? d.fisico),
    tatico: clampAttr(partial.tatico ?? d.tatico),
    mentalidade: clampAttr(partial.mentalidade ?? d.mentalidade),
    confianca: clampAttr(partial.confianca ?? d.confianca),
  };
}

/**
 * Deriva atributos de partida a partir do modelo de entidade (passe único → curto/longo).
 */
export function matchAttributesFromPlayerEntity(p: Pick<PlayerEntity, 'attrs'>): MatchPlayerAttributes {
  const a = p.attrs;
  const passe = clampAttr(a.passe);
  return normalizeMatchAttributes({
    passeCurto: passe,
    passeLongo: clampAttr(passe * 0.92 + 4),
    cruzamento: clampAttr(a.drible * 0.45 + passe * 0.45 + 6),
    marcacao: clampAttr(a.marcacao),
    velocidade: clampAttr(a.velocidade),
    fairPlay: clampAttr(a.fairPlay),
    drible: clampAttr(a.drible),
    finalizacao: clampAttr(a.finalizacao),
    fisico: clampAttr(a.fisico),
    tatico: clampAttr(a.tatico),
    mentalidade: clampAttr(a.mentalidade),
    confianca: clampAttr(a.confianca),
  });
}

export function defaultAwayMatchAttributes(seed: number): MatchPlayerAttributes {
  const j = seed % 7;
  return normalizeMatchAttributes({
    passeCurto: 62 + j,
    passeLongo: 58 + j,
    cruzamento: 55 + j,
    marcacao: 60 + j,
    velocidade: 64 + j,
    fairPlay: 75,
    drible: 58 + j,
    finalizacao: 56 + j,
    fisico: 62 + j,
    tatico: 63 + j,
    mentalidade: 65 + j,
    confianca: 66 + j,
  });
}

export function behaviorToCognitiveArchetype(b: PlayerBehavior): MatchCognitiveArchetype {
  switch (b) {
    case 'ofensivo':
      return 'finalizador';
    case 'defensivo':
      return 'executor';
    case 'criativo':
      return 'criador';
    default:
      return 'construtor';
  }
}

export function createPlayerMatchRuntimeFromPitch(fatigue: number, attrs: MatchPlayerAttributes): PlayerMatchRuntime {
  const st = Math.max(35, Math.min(100, 100 - fatigue * 0.85));
  const baseConf = 0.82 + attrs.confianca / 900;
  return {
    stamina: st,
    confidenceRuntime: Math.max(0.52, Math.min(1.2, baseConf)),
    moraleRuntime: 0,
    lastActions: ['', '', '', '', ''],
    lastActionsCount: 0,
  };
}

export function createPlayerMatchRuntime(entity: Pick<PlayerEntity, 'fatigue' | 'attrs'>): PlayerMatchRuntime {
  return createPlayerMatchRuntimeFromPitch(entity.fatigue, matchAttributesFromPlayerEntity(entity));
}

export function pushLastAction(rt: PlayerMatchRuntime, id: string): void {
  const i = rt.lastActionsCount % rt.lastActions.length;
  rt.lastActions[i] = id;
  rt.lastActionsCount++;
}

/** IA visitante: perfil cognitivo por slot quando não há entidade de jogador */
export function awayCognitiveArchetypeForSlot(slotId: string): MatchCognitiveArchetype {
  if (slotId === 'vol') return 'destruidor';
  if (slotId === 'pe' || slotId === 'pd') return 'finalizador';
  if (slotId.startsWith('zag') || slotId === 'gol') return 'executor';
  if (slotId === 'ca' || slotId.startsWith('ata')) return 'finalizador';
  if (slotId === 'le' || slotId === 'ld') return 'construtor';
  return 'construtor';
}

/** Passe legado usado por fórmulas antigas: média ponderada curto/longo */
export function compositePasse(m: MatchPlayerAttributes): number {
  return clampAttr(m.passeCurto * 0.55 + m.passeLongo * 0.45);
}
