import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';

/** Slots normalizados (0–1): nx ao longo do campo (0 defesa casa, 1 ataque), nz largura (0–1). */
export interface SlotTarget {
  nx: number;
  nz: number;
}

export type FormationScheme = '4-3-3';

const BASE_433_HOME: Record<string, SlotTarget> = {
  pe: { nx: 0.72, nz: 0.2 },
  ata: { nx: 0.78, nz: 0.5 },
  pd: { nx: 0.72, nz: 0.8 },
  mc1: { nx: 0.55, nz: 0.32 },
  vol: { nx: 0.48, nz: 0.5 },
  mc2: { nx: 0.55, nz: 0.68 },
  le: { nx: 0.32, nz: 0.12 },
  zag1: { nx: 0.26, nz: 0.38 },
  zag2: { nx: 0.26, nz: 0.62 },
  ld: { nx: 0.32, nz: 0.88 },
  gol: { nx: 0.08, nz: 0.5 },
};

export interface FormationContext {
  scheme: FormationScheme;
  side: 'home' | 'away';
  ballX: number;
  ballZ: number;
  mentality: number;
  defensiveLine: number;
  pressing: number;
}

function shiftBlock(ctx: FormationContext, slot: SlotTarget): SlotTarget {
  const mind = (ctx.mentality - 50) / 100;
  const defLine = (ctx.defensiveLine - 50) / 120;
  const press = (ctx.pressing - 50) / 200;
  const bx = ctx.ballX / FIELD_LENGTH;
  const pull = (bx - 0.5) * 0.08 * (1 + press);
  return {
    nx: Math.min(0.92, Math.max(0.06, slot.nx + mind * 0.06 + pull - defLine * 0.05)),
    nz: Math.min(0.94, Math.max(0.06, slot.nz)),
  };
}

/** Converte slot para mundo (metros). Casa ataca +X. Visitante espelha em X. */
export function slotToWorld(side: 'home' | 'away', slot: SlotTarget): { x: number; z: number } {
  const nx = side === 'home' ? slot.nx : 1 - slot.nx;
  return {
    x: nx * FIELD_LENGTH,
    z: slot.nz * FIELD_WIDTH,
  };
}

export function getDynamicTargetsForLineup(
  slotIds: string[],
  ctx: FormationContext,
): Map<string, { x: number; z: number }> {
  const out = new Map<string, { x: number; z: number }>();
  for (const sid of slotIds) {
    const base = BASE_433_HOME[sid];
    if (!base) continue;
    const shifted = shiftBlock(ctx, base);
    const w = slotToWorld(ctx.side, shifted);
    out.set(sid, w);
  }
  return out;
}

export function defaultSlotOrder(): string[] {
  return Object.keys(BASE_433_HOME);
}
