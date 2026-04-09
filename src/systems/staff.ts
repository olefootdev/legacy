import type { FinanceState, PlayerEntity } from '@/entities/types';
import type { StaffRoleId, StaffState } from '@/game/types';
import { addBroCents, addOle } from './economy';

export const STAFF_LABELS: Record<StaffRoleId, string> = {
  preparador_fisico: 'Preparador físico',
  mental: 'Preparador mental',
  nutricao: 'Nutrição',
  tatico: 'Preparador tático',
  treinador: 'Treinador',
  olheiro: 'Olheiro',
  preparador_goleiros: 'Preparador de goleiros',
};

export const STAFF_ROLE_IDS: StaffRoleId[] = [
  'preparador_fisico',
  'mental',
  'nutricao',
  'tatico',
  'treinador',
  'olheiro',
  'preparador_goleiros',
];

export function createInitialStaffState(): StaffState {
  return {
    roles: {
      preparador_fisico: 1,
      mental: 1,
      nutricao: 1,
      tatico: 1,
      treinador: 1,
      olheiro: 1,
      preparador_goleiros: 1,
    },
    assignedByPlayer: {},
    assignedCollective: { defensivo: [], criativo: [], ataque: [] },
  };
}

export function maxStaffSlotsByLevel(level: number): number {
  if (level >= 3) return 5;
  if (level >= 2) return 3;
  return 1;
}

export function getStaffUpgradeCost(level: number): { currency: 'exp' | 'bro'; amount: number } | null {
  if (level >= 5) return null;
  if (level < 3) return { currency: 'exp', amount: level === 1 ? 350 : 900 };
  return { currency: 'bro', amount: level === 3 ? 799 : 1499 };
}

export function tryUpgradeStaffRole(
  state: StaffState,
  finance: FinanceState,
  roleId: StaffRoleId,
): { ok: true; staff: StaffState; finance: FinanceState } | { ok: false; error: string } {
  const current = state.roles[roleId] ?? 1;
  const cost = getStaffUpgradeCost(current);
  if (!cost) return { ok: false, error: 'Profissional já está no nível máximo.' };
  if (cost.currency === 'exp') {
    if (finance.ole < cost.amount) return { ok: false, error: `EXP insuficiente. Necessário: ${cost.amount}.` };
    return {
      ok: true,
      staff: { ...state, roles: { ...state.roles, [roleId]: current + 1 } },
      finance: addOle(finance, -cost.amount),
    };
  }
  if (finance.broCents < cost.amount) return { ok: false, error: `BRO insuficiente. Necessário: ${(cost.amount / 100).toFixed(2)}.` };
  return {
    ok: true,
    staff: { ...state, roles: { ...state.roles, [roleId]: current + 1 } },
    finance: addBroCents(finance, -cost.amount),
  };
}

export function trainingGainMultiplier(staff: StaffState, roleIds: StaffRoleId[]): number {
  const roleBonus = roleIds.reduce((sum, id) => sum + ((staff.roles[id] ?? 1) - 1) * 0.06, 0);
  const coachBonus = ((staff.roles.treinador ?? 1) - 1) * 0.05;
  return 1 + roleBonus + coachBonus;
}

export function applyNutritionRecovery(player: PlayerEntity, staff: StaffState): PlayerEntity {
  const lvl = staff.roles.nutricao ?? 1;
  if (lvl <= 1) return player;
  return {
    ...player,
    fatigue: Math.max(0, player.fatigue - lvl),
    injuryRisk: Math.max(0, player.injuryRisk - lvl * 0.8),
  };
}

export function scoutExpReward(staff: StaffState): number {
  const lvl = staff.roles.olheiro ?? 1;
  return 25 + (lvl - 1) * 8;
}

export function amplifyTrainingResult(before: PlayerEntity, after: PlayerEntity, multiplier: number): PlayerEntity {
  const out: PlayerEntity = { ...after, attrs: { ...after.attrs } };
  const attrs: (keyof PlayerEntity['attrs'])[] = [
    'passe',
    'marcacao',
    'velocidade',
    'drible',
    'finalizacao',
    'fisico',
    'tatico',
    'mentalidade',
    'confianca',
    'fairPlay',
  ];
  for (const k of attrs) {
    const delta = after.attrs[k] - before.attrs[k];
    if (delta <= 0) continue;
    out.attrs[k] = Math.min(99, Math.round(before.attrs[k] + delta * multiplier));
  }
  const xpDelta = after.evolutionXp - before.evolutionXp;
  if (xpDelta > 0) out.evolutionXp = Math.round(before.evolutionXp + xpDelta * multiplier);
  return out;
}
