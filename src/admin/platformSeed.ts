import type {
  AdminPlatformUser,
  GrowthCommerceLine,
  GrowthDailyPulseRow,
  PlatformLedgerLine,
} from './platformTypes';

function userWithTimeline(
  p: Omit<AdminPlatformUser, 'createdAtIso' | 'updatedAtIso'>,
  createdDaysAgo: number,
  updatedDaysAgo = 0,
): AdminPlatformUser {
  const now = new Date();
  const c = new Date(now);
  c.setUTCDate(c.getUTCDate() - createdDaysAgo);
  const u = new Date(now);
  u.setUTCDate(u.getUTCDate() - updatedDaysAgo);
  return { ...p, createdAtIso: c.toISOString(), updatedAtIso: u.toISOString() };
}

function isoAtUtcNoon(daysFromToday: number): string {
  const x = new Date();
  x.setUTCDate(x.getUTCDate() + daysFromToday);
  return `${x.toISOString().slice(0, 10)}T14:30:00.000Z`;
}

/** Ledger demo: depósitos e alguns saques ao longo de ~90 dias (ids estáveis de utilizadores seed). */
export function seedPlatformLedger(): PlatformLedgerLine[] {
  const rows: PlatformLedgerLine[] = [];
  let i = 0;
  const push = (partial: Omit<PlatformLedgerLine, 'id' | 'createdAt'> & { createdAt?: string }) => {
    rows.push({
      id: `seed_led_${++i}`,
      createdAt: partial.createdAt ?? new Date().toISOString(),
      kind: partial.kind,
      broCentsDelta: partial.broCentsDelta,
      target: partial.target,
      note: partial.note,
      flowStatus: partial.flowStatus,
    });
  };

  // Janela de histórico: últimos 88 dias com alguns buracos
  for (let d = 88; d >= 0; d -= 1) {
    if (d % 11 === 0) continue;
    if (d % 7 === 3) {
      push({
        createdAt: isoAtUtcNoon(-d),
        kind: 'fiat_deposit',
        broCentsDelta: 120_000 + (d % 5) * 15_000,
        target: 'usr_demo_1',
        flowStatus: 'completed',
        note: 'PIX demo',
      });
    }
    if (d % 9 === 2) {
      push({
        createdAt: isoAtUtcNoon(-d + 1),
        kind: 'fiat_deposit',
        broCentsDelta: 80_000,
        target: 'usr_demo_2',
        flowStatus: 'completed',
      });
    }
    if (d % 13 === 1) {
      push({
        createdAt: isoAtUtcNoon(-d),
        kind: 'fiat_deposit',
        broCentsDelta: 55_000 + (d % 4) * 10_000,
        target: 'usr_demo_3',
        flowStatus: 'completed',
      });
    }
    if (d === 40) {
      push({
        createdAt: isoAtUtcNoon(-d),
        kind: 'fiat_deposit',
        broCentsDelta: 500_000,
        target: 'treasury',
        flowStatus: 'completed',
        note: 'Aporte tesouraria',
      });
    }
    if (d === 22) {
      push({
        createdAt: isoAtUtcNoon(-d),
        kind: 'fiat_withdrawal',
        broCentsDelta: -35_000,
        target: 'usr_demo_3',
        flowStatus: 'completed',
      });
    }
  }

  return rows;
}

export function seedGrowthCommerceLines(): GrowthCommerceLine[] {
  const lines: GrowthCommerceLine[] = [];
  let n = 0;
  for (let d = 75; d >= 0; d -= 1) {
    if (d % 4 !== 0) continue;
    lines.push({
      id: `seed_gc_${++n}`,
      createdAt: isoAtUtcNoon(-d),
      kind: d % 12 === 0 ? 'transfer_player' : 'store_item',
      revenueBroCents: 2_500 + (d % 7) * 400,
      grossBroCents: 18_000 + (d % 5) * 5_000,
      userId: d % 3 === 0 ? 'usr_demo_1' : d % 3 === 1 ? 'usr_demo_2' : 'usr_demo_3',
      label: d % 12 === 0 ? 'Taxa mercado' : 'Consumível / boost',
    });
  }
  for (let d = 30; d >= 0; d -= 10) {
    lines.push({
      id: `seed_gc_${++n}`,
      createdAt: isoAtUtcNoon(-d),
      kind: 'bundle',
      revenueBroCents: 15_000,
      grossBroCents: 120_000,
      userId: 'usr_demo_1',
      label: 'Pack temporada',
    });
  }
  return lines;
}

export function seedGrowthDailyPulse(): GrowthDailyPulseRow[] {
  const rows: GrowthDailyPulseRow[] = [];
  for (let d = 89; d >= 0; d -= 1) {
    const x = new Date();
    x.setUTCDate(x.getUTCDate() - d);
    const date = x.toISOString().slice(0, 10);
    const base = 800 + (d % 17) * 120;
    const impressions = base + (d % 5) * 200;
    const ctaClicks = Math.max(12, Math.round(impressions * (0.045 + (d % 10) * 0.002)));
    const attributedSignups = Math.max(0, Math.round(ctaClicks * (0.08 + (d % 7) * 0.01)));
    rows.push({ date, bannerImpressions: impressions, ctaClicks, attributedSignups });
  }
  return rows;
}

/**
 * Utilizadores da plataforma — lista vazia por default.
 * Populado via fetch real do Supabase (`profiles` + `auth.users`) ao montar
 * o painel admin. Histórico com 4 users demo (OLE FC Neo, Phoenix United,
 * Dragões FC, WOLVES) permanece no git.
 */
export function seedPlatformUsers(): AdminPlatformUser[] {
  return [];
}
