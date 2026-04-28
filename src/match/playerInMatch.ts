import type { PlayerAttributes, PlayerBehavior, PlayerEntity } from '@/entities/types';

/** Pilar 1 (atributos activos no motor): mapa de rastreio em `@/lib/veracityPillarsMap`. */

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

/**
 * Sprint L2 — Personalidade individual do jogador na partida.
 * Quatro eixos que diferenciam jogadores além dos atributos técnicos.
 * Modula comportamentos no engine sem alterar atributos base.
 */
export interface MatchPlayerPersonality {
  /** 0-100 — quão agressivo no duelo. Maior = mais faltas táticas / hard tackles. */
  aggressiveness: number;
  /** 0-100 — respeito à instrução tática. Menor = drift da formação, decisões individuais. */
  loyalty: number;
  /** 0-100 — bonus em jogos decisivos (final, jogo apertado, minutos críticos). */
  bigGameMentality: number;
  /** 0-100 — tendência a finalizar de fora vs passar / driblar mais vs simples. */
  ego: number;
}

/** Sintetiza personalidade a partir dos atributos existentes do PlayerEntity. */
export function derivePersonalityFromAttrs(attrs: MatchPlayerAttributes): MatchPlayerPersonality {
  // aggressiveness: inverso do fair play + bonus de físico
  const aggressiveness = clampAttr(
    (100 - attrs.fairPlay) * 0.7 + (attrs.fisico - 50) * 0.3,
  );
  // loyalty: tático bruto (jogador disciplinado segue instrução)
  const loyalty = clampAttr(attrs.tatico);
  // bigGameMentality: mentalidade pura
  const bigGameMentality = clampAttr(attrs.mentalidade);
  // ego: confiança alta = quer a bola, chuta de fora
  const ego = clampAttr(attrs.confianca * 0.7 + attrs.finalizacao * 0.3);

  return { aggressiveness, loyalty, bigGameMentality, ego };
}

export function defaultPersonality(): MatchPlayerPersonality {
  return { aggressiveness: 50, loyalty: 65, bigGameMentality: 60, ego: 55 };
}

/** Per-subzone memory: tracks success/failure and builds zone confidence. */
export interface ZoneMemoryEntry {
  successes: number;
  failures: number;
  /** 0–1 derived confidence (successes / total, decayed). */
  confidence: number;
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

  /**
   * SMARTFIELD: per-subzone memory for zone-confidence learning.
   * Key = subzone id (e.g. 'creation_center', 'box_left').
   */
  zoneMemory: Record<string, ZoneMemoryEntry>;
  /**
   * SMARTFIELD: 0–1 aggregate tactical discipline score.
   * Increases when player stays within allowed radius; decreases when out of shape.
   */
  tacticalDisciplineScore: number;
}

/** Lightweight per-player memory for short-term and recent stats. */
export interface PlayerMemory {
  lastActions: string[]; // canonical ids
  lastDuels: { outcome: 'won' | 'lost' | 'draw'; opponentId?: string; when: number }[];
  lastPassTargets: { targetId: string; success: boolean; when: number }[];
  recentSuccessRate: number; // 0-1 over recent N events
  recentMistakes: number; // count over short window
}

/** Emotional / psychological runtime fields */
export interface PlayerEmotionalRuntime {
  pressure: number; // 0-100
  confidence: number; // 0-100 mirrors feeling (separate from confidenceRuntime multiplier)
  tiltLevel: number; // 0-100 impulsiveness
}

export function clampAttr(n: number): number {
  if (Number.isNaN(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Escala atributos de partida para o bónus global do treinador (teto 100). */
export function scaleMatchAttributesForCoach(attrs: MatchPlayerAttributes, coachMul: number): MatchPlayerAttributes {
  if (!Number.isFinite(coachMul) || coachMul <= 1.0001) return attrs;
  const m = Math.min(1.18, coachMul);
  return normalizeMatchAttributes({
    passeCurto: attrs.passeCurto * m,
    passeLongo: attrs.passeLongo * m,
    cruzamento: attrs.cruzamento * m,
    marcacao: attrs.marcacao * m,
    velocidade: attrs.velocidade * m,
    fairPlay: attrs.fairPlay,
    drible: attrs.drible * m,
    finalizacao: attrs.finalizacao * m,
    fisico: attrs.fisico * m,
    tatico: attrs.tatico * m,
    mentalidade: attrs.mentalidade * m,
    confianca: attrs.confianca * m,
  });
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
    zoneMemory: {},
    tacticalDisciplineScore: 0.5,
    // new: basic memory + emotional runtime (kept small)
    // We store these as any on the object surface to minimize type churn elsewhere.
    // Access via helper functions below.
    // @ts-ignore - dynamic extension
    memory: { lastActions: [], lastDuels: [], lastPassTargets: [], recentSuccessRate: 0.5, recentMistakes: 0 } as PlayerMemory,
    // @ts-ignore
    emotional: { pressure: 10, confidence: 72, tiltLevel: 6 } as PlayerEmotionalRuntime,
  };
}

/** Push a canonical action into short-term memory (fixed size). */
export function pushMemoryAction(rt: PlayerMatchRuntime, id: string, when: number): void {
  // @ts-ignore
  const mem: PlayerMemory = rt.memory ?? { lastActions: [], lastDuels: [], lastPassTargets: [], recentSuccessRate: 0.5, recentMistakes: 0 };
  mem.lastActions.unshift(id);
  if (mem.lastActions.length > 8) mem.lastActions.pop();
  // persist back
  // @ts-ignore
  rt.memory = mem;
}

export function pushMemoryDuel(rt: PlayerMatchRuntime, outcome: 'won' | 'lost' | 'draw', opponentId: string | undefined, when: number): void {
  // @ts-ignore
  const mem: PlayerMemory = rt.memory ?? { lastActions: [], lastDuels: [], lastPassTargets: [], recentSuccessRate: 0.5, recentMistakes: 0 };
  mem.lastDuels.unshift({ outcome, opponentId, when });
  if (mem.lastDuels.length > 8) mem.lastDuels.pop();
  // adjust recentSuccessRate and tilt heuristics
  const winCount = mem.lastDuels.filter((d) => d.outcome === 'won').length;
  mem.recentSuccessRate = Math.max(0, Math.min(1, (mem.recentSuccessRate * 0.6) + (winCount / Math.max(1, mem.lastDuels.length)) * 0.4));
  // @ts-ignore
  rt.memory = mem;
}

export function pushMemoryPassTarget(rt: PlayerMatchRuntime, targetId: string, success: boolean, when: number): void {
  // @ts-ignore
  const mem: PlayerMemory = rt.memory ?? { lastActions: [], lastDuels: [], lastPassTargets: [], recentSuccessRate: 0.5, recentMistakes: 0 };
  mem.lastPassTargets.unshift({ targetId, success, when });
  if (mem.lastPassTargets.length > 12) mem.lastPassTargets.pop();
  // update success rate roughly
  const recent = mem.lastPassTargets.slice(0, 8);
  const succ = recent.filter((r) => r.success).length;
  mem.recentSuccessRate = succ / Math.max(1, recent.length);
  if (!success) mem.recentMistakes = (mem.recentMistakes || 0) + 1;
  // @ts-ignore
  rt.memory = mem;
}

export function bumpPlayerPressure(rt: PlayerMatchRuntime, delta: number): void {
  // @ts-ignore
  const emo: PlayerEmotionalRuntime = rt.emotional ?? { pressure: 10, confidence: 72, tiltLevel: 6 };
  emo.pressure = Math.max(0, Math.min(100, emo.pressure + delta));
  // slight inverse on confidenceRuntime scale
  rt.confidenceRuntime = Math.max(0.48, Math.min(1.28, rt.confidenceRuntime * (1 - delta / 400)));
  // @ts-ignore
  rt.emotional = emo;
}

export function bumpPlayerConfidence(rt: PlayerMatchRuntime, delta: number): void {
  // @ts-ignore
  const emo: PlayerEmotionalRuntime = rt.emotional ?? { pressure: 10, confidence: 72, tiltLevel: 6 };
  emo.confidence = Math.max(0, Math.min(100, emo.confidence + delta));
  rt.confidenceRuntime = Math.max(0.48, Math.min(1.28, rt.confidenceRuntime * (1 + delta / 260)));
  // @ts-ignore
  rt.emotional = emo;
}

/** Record a successful or failed action in a subzone. */
export function recordZoneOutcome(rt: PlayerMatchRuntime, subzone: string | null | undefined, success: boolean): void {
  if (!subzone) return;
  let entry = rt.zoneMemory[subzone];
  if (!entry) {
    entry = { successes: 0, failures: 0, confidence: 0.5 };
    rt.zoneMemory[subzone] = entry;
  }
  if (success) entry.successes++;
  else entry.failures++;
  const total = entry.successes + entry.failures;
  entry.confidence = total > 0 ? entry.successes / total : 0.5;
}

/** Update tactical discipline: +tick when in shape, −tick when out. */
export function tickTacticalDiscipline(rt: PlayerMatchRuntime, isOutOfShape: boolean, dt: number): void {
  const rate = 0.02 * dt;
  if (isOutOfShape) {
    rt.tacticalDisciplineScore = Math.max(0, rt.tacticalDisciplineScore - rate);
  } else {
    rt.tacticalDisciplineScore = Math.min(1, rt.tacticalDisciplineScore + rate * 0.5);
  }
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
