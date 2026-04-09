import { loadKnowledge, type PositionTeaching } from '@/gamespirit/admin/gameSpiritKnowledgeStore';

/** Alinha com `PlayerEntity.pos` (ATA, MC, GOL, PE…). */
export function normalizePositionCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Constrói mapa código → coordenadas em escala 0–100 (igual ao motor: x ataque +x, y largura).
 * Várias entradas com o mesmo código: prevalece a mais recente por `updatedAt`.
 */
export function buildPositionOverridePercentMap(teachings: PositionTeaching[]): Record<string, { x: number; y: number }> {
  const sorted = [...teachings].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const out: Record<string, { x: number; y: number }> = {};
  for (const t of sorted) {
    const k = normalizePositionCode(t.code);
    if (!k || k === '—') continue;
    out[k] = {
      x: Math.round(Math.min(100, Math.max(0, t.x01 * 100))),
      y: Math.round(Math.min(100, Math.max(0, t.y01 * 100))),
    };
  }
  return out;
}

/** Lê `localStorage` (mesma chave do Admin Game Spirit). Só no cliente. */
export function loadGameSpiritPositionOverrideMap(): Record<string, { x: number; y: number }> | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const kb = loadKnowledge();
    if (!kb.positionTeachings.length) return null;
    return buildPositionOverridePercentMap(kb.positionTeachings);
  } catch {
    return null;
  }
}
