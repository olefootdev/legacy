import type { AdminPlatformUser, PlatformOlexpPosition } from './platformTypes';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysUtc(iso: string, days: number): string {
  const x = new Date(`${iso}T12:00:00.000Z`);
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString().slice(0, 10);
}

/** Posições de demonstração alinhadas com utilizadores seed (Carlos, Ana pendente, João). */
export function seedPlatformOlexpPositions(): PlatformOlexpPosition[] {
  const today = isoDate(new Date());
  const created = new Date().toISOString();
  return [
    {
      id: 'plat_olexp_demo_carlos',
      userId: 'usr_demo_1',
      planId: '180d',
      principalCents: 500_000,
      startDate: addDaysUtc(today, -45),
      endDate: addDaysUtc(today, 135),
      yieldAccruedCents: 18_200,
      status: 'active',
      createdAt: created,
      activatedAt: created,
      lastAccrualDate: today,
    },
    {
      id: 'plat_olexp_demo_ana_pending',
      userId: 'usr_demo_2',
      planId: '360d',
      principalCents: 350_000,
      startDate: today,
      endDate: addDaysUtc(today, 360),
      yieldAccruedCents: 0,
      status: 'pending_activation',
      createdAt: created,
      note: 'Pendente de confirmação operacional (KYC/compliance simulado).',
    },
    {
      id: 'plat_olexp_demo_joao',
      userId: 'usr_demo_3',
      planId: '90d',
      principalCents: 300_000,
      startDate: addDaysUtc(today, -20),
      endDate: addDaysUtc(today, 70),
      yieldAccruedCents: 4_500,
      status: 'active',
      createdAt: created,
      activatedAt: created,
      lastAccrualDate: today,
    },
  ];
}

function u(p: Omit<AdminPlatformUser, 'createdAtIso' | 'updatedAtIso'>): AdminPlatformUser {
  const now = new Date().toISOString();
  return { ...p, createdAtIso: now, updatedAtIso: now };
}

/** Utilizadores de demonstração para o painel plataforma (valores fictícios). */
export function seedPlatformUsers(): AdminPlatformUser[] {
  return [
    u({
      id: 'usr_demo_1',
      externalId: 'ext_mgr_001',
      displayName: 'Carlos Manager',
      email: 'carlos.manager@exemplo.com',
      country: 'BR',
      clubName: 'OLE FC Neo',
      clubShort: 'OLE',
      broCents: 1_250_000,
      spotBroCents: 890_000,
      spotExpBalance: 12_400,
      ole: 45_200,
      olexpPrincipalLockedCents: 500_000,
      olexpYieldAccruedCents: 18_200,
      gatPositionsCount: 2,
      ledgerEntriesCount: 48,
      status: 'active',
      notes: 'Conta verificada — alto engajamento.',
    }),
    u({
      id: 'usr_demo_2',
      externalId: 'ext_mgr_002',
      displayName: 'Ana Treinadora',
      email: 'ana.t@exemplo.com',
      country: 'BR',
      clubName: 'Phoenix United',
      clubShort: 'PHX',
      broCents: 320_000,
      spotBroCents: 310_000,
      spotExpBalance: 2_100,
      ole: 12_800,
      olexpPrincipalLockedCents: 0,
      olexpYieldAccruedCents: 0,
      gatPositionsCount: 0,
      ledgerEntriesCount: 15,
      status: 'active',
    }),
    u({
      id: 'usr_demo_3',
      displayName: 'João Silva',
      email: 'joao.s@exemplo.com',
      country: 'PT',
      clubName: 'Dragões FC',
      clubShort: 'DRG',
      broCents: 45_500,
      spotBroCents: 45_500,
      spotExpBalance: 0,
      ole: 8_900,
      olexpPrincipalLockedCents: 300_000,
      olexpYieldAccruedCents: 4_500,
      gatPositionsCount: 1,
      ledgerEntriesCount: 22,
      status: 'active',
    }),
    u({
      id: 'usr_demo_4',
      displayName: 'Equipa Wolves (bot)',
      clubName: 'WOLVES',
      clubShort: 'WLF',
      broCents: 10_000,
      spotBroCents: 10_000,
      spotExpBalance: 0,
      ole: 2_000,
      olexpPrincipalLockedCents: 0,
      olexpYieldAccruedCents: 0,
      gatPositionsCount: 0,
      ledgerEntriesCount: 3,
      status: 'suspended',
      notes: 'Conta suspensa — revisão AML simulada.',
    }),
  ];
}
