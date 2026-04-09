import type { PlayerEntity } from './types';

export const PITCH_SLOT_ORDER: Array<{ id: string; label: string }> = [
  { id: 'pe', label: 'PE' },
  { id: 'ata', label: 'ATA' },
  { id: 'pd', label: 'PD' },
  { id: 'mc1', label: 'MC' },
  { id: 'vol', label: 'VOL' },
  { id: 'mc2', label: 'MC' },
  { id: 'le', label: 'LE' },
  { id: 'zag1', label: 'ZAG' },
  { id: 'zag2', label: 'ZAG' },
  { id: 'ld', label: 'LD' },
  { id: 'gol', label: 'GOL' },
];

/** Preenche titulares com a mesma heurística da tela de Time (posição compatível primeiro). */
export function buildDefaultLineup(playersById: Record<string, PlayerEntity>): Record<string, string> {
  const pool = Object.values(playersById);
  const used = new Set<string>();
  const lineup: Record<string, string> = {};

  for (const slot of PITCH_SLOT_ORDER) {
    const exact = pool.find((p) => !used.has(p.id) && p.pos === slot.label);
    const pick = exact ?? pool.find((p) => !used.has(p.id));
    if (pick) {
      lineup[slot.id] = pick.id;
      used.add(pick.id);
    }
  }
  return lineup;
}

export function mergeLineupWithDefaults(
  saved: Record<string, string>,
  playersById: Record<string, PlayerEntity>,
): Record<string, string> {
  const base = buildDefaultLineup(playersById);
  return { ...base, ...saved };
}
