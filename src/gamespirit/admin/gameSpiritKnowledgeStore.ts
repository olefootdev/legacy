/**
 * Conhecimento editável pelo Admin — persistido em localStorage.
 * Honesto: até haver ingestão no motor, isto é fonte de verdade para ti + export JSON para o repo.
 */

export const GAME_SPIRIT_KNOWLEDGE_KEY = 'olefoot-gamespirit-knowledge-v2';

export interface NarrativePack {
  id: string;
  title: string;
  /** Alinhar mentalmente a storyNarrativeCatalog / beat */
  bucket: string;
  lines: string[];
  notes: string;
  updatedAt: string;
}

export interface TacticalPattern {
  id: string;
  name: string;
  notes: string;
  /** Texto livre ou um TacticalIntent */
  intentTag: string;
  updatedAt: string;
}

export type PitchZoneTag = 'gk' | 'def' | 'mid' | 'att' | 'wide';

export interface PositionTeaching {
  id: string;
  code: string;
  label: string;
  zone: PitchZoneTag;
  /** 0–1 para desenhar no mini-campo */
  x01: number;
  y01: number;
  mainActivities: string[];
  coachingNotes: string;
  updatedAt: string;
}

export interface GameSpiritKnowledgeRoot {
  v: 2;
  narrativePacks: NarrativePack[];
  tacticalPatterns: TacticalPattern[];
  positionTeachings: PositionTeaching[];
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultKnowledge(): GameSpiritKnowledgeRoot {
  return {
    v: 2,
    narrativePacks: [],
    tacticalPatterns: [],
    positionTeachings: [],
  };
}

export function loadKnowledge(): GameSpiritKnowledgeRoot {
  try {
    const raw = localStorage.getItem(GAME_SPIRIT_KNOWLEDGE_KEY);
    if (!raw) return defaultKnowledge();
    const p = JSON.parse(raw) as GameSpiritKnowledgeRoot;
    if (p.v !== 2 || !Array.isArray(p.narrativePacks)) return defaultKnowledge();
    return {
      v: 2,
      narrativePacks: p.narrativePacks,
      tacticalPatterns: Array.isArray(p.tacticalPatterns) ? p.tacticalPatterns : [],
      positionTeachings: Array.isArray(p.positionTeachings) ? p.positionTeachings : [],
    };
  } catch {
    return defaultKnowledge();
  }
}

export function saveKnowledge(root: GameSpiritKnowledgeRoot): void {
  localStorage.setItem(GAME_SPIRIT_KNOWLEDGE_KEY, JSON.stringify(root));
}

export function exportKnowledgeJson(root: GameSpiritKnowledgeRoot): string {
  return JSON.stringify(root, null, 2);
}
