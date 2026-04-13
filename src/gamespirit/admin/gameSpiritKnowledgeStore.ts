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

/** Grelha 4×4 no campo (16 blocos), índice = linha*4+col (0–15), comprimento = eixo x (ataque). */
export const PITCH_BLOCK_COUNT = 16;

export function emptyBlockNotes(): string[] {
  return Array.from({ length: PITCH_BLOCK_COUNT }, () => '');
}

export function normalizeBlockNotes(raw: unknown): string[] {
  const out = emptyBlockNotes();
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < PITCH_BLOCK_COUNT; i++) {
    const v = raw[i];
    out[i] = typeof v === 'string' ? v : '';
  }
  return out;
}

export interface PositionTeaching {
  id: string;
  code: string;
  label: string;
  zone: PitchZoneTag;
  /** 0–1 para desenhar no mini-campo */
  x01: number;
  y01: number;
  /** Comportamento / prioridades quando o contexto cai neste bloco da grelha 4×4 (ensaio para o motor). */
  blockNotes: string[];
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

function normalizePositionTeaching(x: unknown): PositionTeaching | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : '';
  const code = typeof o.code === 'string' ? o.code : '';
  const label = typeof o.label === 'string' ? o.label : '';
  if (!id || !label.trim()) return null;
  const zoneRaw = o.zone;
  const zones: PitchZoneTag[] = ['gk', 'def', 'mid', 'att', 'wide'];
  const zone =
    typeof zoneRaw === 'string' && zones.includes(zoneRaw as PitchZoneTag) ? (zoneRaw as PitchZoneTag) : 'mid';
  const x01 = typeof o.x01 === 'number' && Number.isFinite(o.x01) ? Math.min(1, Math.max(0, o.x01)) : 0.5;
  const y01 = typeof o.y01 === 'number' && Number.isFinite(o.y01) ? Math.min(1, Math.max(0, o.y01)) : 0.5;
  const act = o.mainActivities;
  const mainActivities = Array.isArray(act)
    ? act.filter((a): a is string => typeof a === 'string' && a.trim().length > 0).map((a) => a.trim())
    : [];
  const coachingNotes = typeof o.coachingNotes === 'string' ? o.coachingNotes : '';
  const blockNotes = normalizeBlockNotes(o.blockNotes);
  const updatedAt = typeof o.updatedAt === 'string' ? o.updatedAt : nowIso();
  return { id, code, label, zone, x01, y01, blockNotes, mainActivities, coachingNotes, updatedAt };
}

export function loadKnowledge(): GameSpiritKnowledgeRoot {
  try {
    const raw = localStorage.getItem(GAME_SPIRIT_KNOWLEDGE_KEY);
    if (!raw) return defaultKnowledge();
    const p = JSON.parse(raw) as GameSpiritKnowledgeRoot;
    if (p.v !== 2 || !Array.isArray(p.narrativePacks)) return defaultKnowledge();
    const rawPos = Array.isArray(p.positionTeachings) ? p.positionTeachings : [];
    const positionTeachings = rawPos.map(normalizePositionTeaching).filter((x): x is PositionTeaching => x !== null);
    return {
      v: 2,
      narrativePacks: p.narrativePacks,
      tacticalPatterns: Array.isArray(p.tacticalPatterns) ? p.tacticalPatterns : [],
      positionTeachings,
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
