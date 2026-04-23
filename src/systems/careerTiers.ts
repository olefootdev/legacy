/**
 * Plano de carreira do manager baseado em `expLifetimeEarned`.
 * Tiers ordenados do mais baixo (Fraldinha) ao mais alto (Lenda).
 * Usado no perfil, ranking, badge no header e desbloqueio progressivo de features.
 */

export type CareerTier = {
  id: number;
  name: string;
  slug:
    | 'fraldinha'
    | 'juvenil'
    | 'amador'
    | 'profissional'
    | 'campeao'
    | 'internacional'
    | 'raro'
    | 'lenda';
  minExp: number;
  /** Cor CSS do badge (Tailwind class). */
  badgeClass: string;
  /** Cor do texto complementar. */
  textClass: string;
  /** Emoji/ícone curto para UI compacta. */
  glyph: string;
};

export const CAREER_TIERS: CareerTier[] = [
  {
    id: 1,
    name: 'Fraldinha',
    slug: 'fraldinha',
    minExp: 0,
    badgeClass: 'bg-zinc-500/15 border-zinc-400/40',
    textClass: 'text-zinc-300',
    glyph: '🍼',
  },
  {
    id: 2,
    name: 'Juvenil',
    slug: 'juvenil',
    minExp: 10_000,
    badgeClass: 'bg-emerald-500/15 border-emerald-400/40',
    textClass: 'text-emerald-300',
    glyph: '🌱',
  },
  {
    id: 3,
    name: 'Amador',
    slug: 'amador',
    minExp: 50_000,
    badgeClass: 'bg-sky-500/15 border-sky-400/40',
    textClass: 'text-sky-300',
    glyph: '⚽',
  },
  {
    id: 4,
    name: 'Profissional',
    slug: 'profissional',
    minExp: 200_000,
    badgeClass: 'bg-blue-500/20 border-blue-400/50',
    textClass: 'text-blue-200',
    glyph: '🎽',
  },
  {
    id: 5,
    name: 'Campeão',
    slug: 'campeao',
    minExp: 800_000,
    badgeClass: 'bg-amber-500/20 border-amber-400/60',
    textClass: 'text-amber-200',
    glyph: '🏆',
  },
  {
    id: 6,
    name: 'Internacional',
    slug: 'internacional',
    minExp: 2_000_000,
    badgeClass: 'bg-violet-500/20 border-violet-400/60',
    textClass: 'text-violet-200',
    glyph: '🌍',
  },
  {
    id: 7,
    name: 'Raro',
    slug: 'raro',
    minExp: 8_000_000,
    badgeClass: 'bg-fuchsia-500/20 border-fuchsia-400/60',
    textClass: 'text-fuchsia-200',
    glyph: '💎',
  },
  {
    id: 8,
    name: 'Lenda',
    slug: 'lenda',
    minExp: 25_000_000,
    badgeClass: 'bg-gradient-to-r from-neon-yellow/25 to-amber-400/25 border-neon-yellow/70',
    textClass: 'text-neon-yellow',
    glyph: '👑',
  },
];

/** Retorna o tier atual do manager a partir do EXP acumulado. */
export function computeCareerTier(expLifetimeEarned: number): CareerTier {
  const exp = Math.max(0, expLifetimeEarned || 0);
  let current = CAREER_TIERS[0]!;
  for (const t of CAREER_TIERS) {
    if (exp >= t.minExp) current = t;
  }
  return current;
}

/** Próximo tier (null se já for o último). */
export function nextCareerTier(currentTierId: number): CareerTier | null {
  const next = CAREER_TIERS.find((t) => t.id === currentTierId + 1);
  return next ?? null;
}

/** Progresso 0..1 entre o tier atual e o próximo. */
export function tierProgress01(expLifetimeEarned: number): number {
  const cur = computeCareerTier(expLifetimeEarned);
  const next = nextCareerTier(cur.id);
  if (!next) return 1;
  const span = next.minExp - cur.minExp;
  if (span <= 0) return 1;
  const gained = expLifetimeEarned - cur.minExp;
  return Math.max(0, Math.min(1, gained / span));
}

/** Rótulo completo "TIER 5 Campeão". */
export function tierLabel(tier: CareerTier): string {
  return `TIER ${tier.id} ${tier.name}`;
}
