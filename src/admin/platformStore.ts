import { useCallback, useSyncExternalStore } from 'react';
import type { OlefootGameState } from '@/game/types';
import type {
  AdminPlatformState,
  AdminPlatformUser,
  FiatPipelineStatus,
  PlatformLedgerLine,
  PlatformOlexpCustodyStatus,
  PlatformOlexpPosition,
} from './platformTypes';
import { emptyPlatformState } from './platformTypes';
import { seedPlatformUsers, seedPlatformOlexpPositions } from './platformSeed';
import { normalizeWalletState } from '@/wallet/initial';
import type { OlexpPlanId } from '@/wallet/types';
import { getPlan } from '@/wallet/olexp';

const KEY = 'olefoot-admin-platform-v1';

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type PlatformTarget = 'treasury' | { userId: string };

export type AdminPlatformAction =
  | { type: 'HYDRATE'; state: AdminPlatformState }
  | { type: 'ADD_USER'; user: AdminPlatformUser }
  | { type: 'UPDATE_USER'; id: string; patch: Partial<AdminPlatformUser> }
  | { type: 'REMOVE_USER'; id: string }
  | { type: 'RESET_SEED'; treasuryCents?: number; escrowCents?: number }
  | { type: 'SET_TREASURY'; broCents: number }
  | { type: 'SET_ESCROW'; broCents: number }
  | { type: 'IMPORT_SESSION_USER'; game: OlefootGameState }
  | {
      type: 'APPLY_FIAT_DEPOSIT';
      target: PlatformTarget;
      broCents: number;
      note?: string;
      /** Se true, só cria linha `processing` sem mexer em saldos até `COMPLETE_FIAT_FLOW`. */
      queue?: boolean;
    }
  | {
      type: 'APPLY_FIAT_WITHDRAWAL';
      target: PlatformTarget;
      broCents: number;
      note?: string;
      queue?: boolean;
    }
  | { type: 'COMPLETE_FIAT_FLOW'; lineId: string }
  | { type: 'FAIL_FIAT_FLOW'; lineId: string; reason?: string }
  | {
      type: 'REGISTER_OLEXP_CUSTODY_PENDING';
      userId: string;
      planId: OlexpPlanId;
      principalCents: number;
      note?: string;
    }
  | { type: 'ACTIVATE_OLEXP_CUSTODY'; positionId: string }
  | { type: 'REJECT_OLEXP_CUSTODY'; positionId: string };

let state: AdminPlatformState = loadInitial();

function loadInitial(): AdminPlatformState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const s = emptyPlatformState();
      s.users = seedPlatformUsers();
      s.platformTreasuryBroCents = 125_600;
      s.platformEscrowBroCents = 48_000;
      s.platformOlexpPositions = seedPlatformOlexpPositions();
      return applyOlexpAggregatesToUsers(s);
    }
    const p = JSON.parse(raw) as AdminPlatformState;
    if (p?.version !== 1) return hydrateDefaults(p);
    return hydrateDefaults(p);
  } catch {
    const s = emptyPlatformState();
    s.users = seedPlatformUsers();
    s.platformTreasuryBroCents = 125_600;
    s.platformEscrowBroCents = 48_000;
    s.platformOlexpPositions = seedPlatformOlexpPositions();
    return applyOlexpAggregatesToUsers(s);
  }
}

function normalizeLedgerLine(raw: unknown, fallbackId: string): PlatformLedgerLine {
  const l = raw as Partial<PlatformLedgerLine>;
  const kind = (l.kind as PlatformLedgerLine['kind']) ?? 'fiat_deposit';
  const isFiat = kind === 'fiat_deposit' || kind === 'fiat_withdrawal';
  let flowStatus = l.flowStatus as FiatPipelineStatus | undefined;
  if (isFiat && flowStatus !== 'processing' && flowStatus !== 'completed' && flowStatus !== 'failed') {
    flowStatus = 'completed';
  }
  return {
    id: typeof l.id === 'string' && l.id ? l.id : fallbackId,
    createdAt: typeof l.createdAt === 'string' ? l.createdAt : new Date().toISOString(),
    kind,
    broCentsDelta: Number(l.broCentsDelta) || 0,
    target: typeof l.target === 'string' ? l.target : 'treasury',
    note: typeof l.note === 'string' ? l.note : undefined,
    flowStatus: isFiat ? flowStatus : undefined,
    failureReason: typeof l.failureReason === 'string' ? l.failureReason : undefined,
  };
}

const OLEXP_PLAN_IDS: OlexpPlanId[] = ['90d', '180d', '360d'];
const OLEXP_PLATFORM_STATUSES: PlatformOlexpCustodyStatus[] = [
  'pending_activation',
  'active',
  'matured',
  'claimed',
];

function addDaysPlatform(iso: string, days: number): string {
  const x = new Date(`${iso}T12:00:00.000Z`);
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString().slice(0, 10);
}

function normalizePlatformOlexp(raw: unknown, fallbackId: string): PlatformOlexpPosition {
  const r = raw as Partial<PlatformOlexpPosition>;
  const planId = OLEXP_PLAN_IDS.includes(r.planId as OlexpPlanId) ? (r.planId as OlexpPlanId) : '90d';
  const status = OLEXP_PLATFORM_STATUSES.includes(r.status as PlatformOlexpCustodyStatus)
    ? (r.status as PlatformOlexpCustodyStatus)
    : 'active';
  const today = new Date().toISOString().slice(0, 10);
  const startDate =
    typeof r.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.startDate) ? r.startDate : today;
  const endDate =
    typeof r.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.endDate) ? r.endDate : startDate;
  return {
    id: typeof r.id === 'string' && r.id ? r.id : fallbackId,
    userId: typeof r.userId === 'string' ? r.userId : 'unknown',
    planId,
    principalCents: Math.max(0, Math.round(Number(r.principalCents) || 0)),
    startDate,
    endDate,
    yieldAccruedCents: Math.max(0, Math.round(Number(r.yieldAccruedCents) || 0)),
    status,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
    activatedAt: typeof r.activatedAt === 'string' ? r.activatedAt : undefined,
    lastAccrualDate: typeof r.lastAccrualDate === 'string' ? r.lastAccrualDate : undefined,
    note: typeof r.note === 'string' ? r.note : undefined,
  };
}

/** Recalcula `olexpPrincipalLockedCents` / `olexpYieldAccruedCents` só para utilizadores com posições na lista. */
function applyOlexpAggregatesToUsers(s: AdminPlatformState): AdminPlatformState {
  const positions = s.platformOlexpPositions ?? [];
  if (positions.length === 0) return s;
  const byUser = new Map<string, { principal: number; yieldAcc: number }>();
  for (const p of positions) {
    const agg = byUser.get(p.userId) ?? { principal: 0, yieldAcc: 0 };
    if (p.status === 'active' || p.status === 'matured') {
      agg.principal += p.principalCents;
      agg.yieldAcc += p.yieldAccruedCents;
    }
    byUser.set(p.userId, agg);
  }
  const users = s.users.map((u) => {
    const a = byUser.get(u.id);
    if (!a) return u;
    return { ...u, olexpPrincipalLockedCents: a.principal, olexpYieldAccruedCents: a.yieldAcc };
  });
  return { ...s, users };
}

function hydrateDefaults(raw: Partial<AdminPlatformState>): AdminPlatformState {
  const base = emptyPlatformState();
  const ledgerRaw = Array.isArray(raw.platformLedger) ? raw.platformLedger : [];
  const platformLedger = ledgerRaw.map((row, i) => normalizeLedgerLine(row, `legacy-${i}`));
  const posRaw = Array.isArray(raw.platformOlexpPositions) ? raw.platformOlexpPositions : [];
  const platformOlexpPositions = posRaw.map((row, i) => normalizePlatformOlexp(row, `olexp-legacy-${i}`));
  let merged: AdminPlatformState = {
    ...base,
    ...raw,
    version: 1,
    users: Array.isArray(raw.users) ? raw.users : base.users,
    platformLedger,
    platformOlexpPositions,
    platformTreasuryBroCents: Number(raw.platformTreasuryBroCents) || 0,
    platformEscrowBroCents: Number(raw.platformEscrowBroCents) || 0,
  };
  if (platformOlexpPositions.length > 0) {
    merged = applyOlexpAggregatesToUsers(merged);
  }
  return merged;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getAdminPlatformState(): AdminPlatformState {
  return state;
}

export function subscribeAdminPlatform(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function dispatchAdminPlatform(action: AdminPlatformAction): void {
  state = platformReducer(state, action);
  persist();
  emit();
}

function pushLedger(
  s: AdminPlatformState,
  line: Omit<PlatformLedgerLine, 'id' | 'createdAt'> & { id?: string },
): AdminPlatformState {
  const full: PlatformLedgerLine = normalizeLedgerLine(
    {
      id: line.id ?? uid(),
      createdAt: new Date().toISOString(),
      kind: line.kind,
      broCentsDelta: line.broCentsDelta,
      target: line.target,
      note: line.note,
      flowStatus: line.flowStatus,
      failureReason: line.failureReason,
    },
    uid(),
  );
  return { ...s, platformLedger: [full, ...s.platformLedger].slice(0, 400) };
}

function replaceLedgerLine(
  s: AdminPlatformState,
  lineId: string,
  patch: Partial<Pick<PlatformLedgerLine, 'flowStatus' | 'failureReason' | 'note'>>,
): AdminPlatformState {
  return {
    ...s,
    platformLedger: s.platformLedger.map((l) => (l.id === lineId ? normalizeLedgerLine({ ...l, ...patch }, l.id) : l)),
  };
}

/** Aplica efeito de depósito fiat já validado (saldos). */
function applyDepositBalances(s: AdminPlatformState, c: number, depTarget: PlatformTarget, now: string): AdminPlatformState {
  if (depTarget === 'treasury') {
    return { ...s, platformTreasuryBroCents: s.platformTreasuryBroCents + c };
  }
  const depUserId = depTarget.userId;
  const users = s.users.map((u) =>
    u.id === depUserId
      ? {
          ...u,
          spotBroCents: u.spotBroCents + c,
          broCents: u.broCents + c,
          ledgerEntriesCount: u.ledgerEntriesCount + 1,
          updatedAtIso: now,
        }
      : u,
  );
  return { ...s, users };
}

/** Aplica efeito de saque fiat já validado (saldos). */
function applyWithdrawalBalances(s: AdminPlatformState, c: number, wdTarget: PlatformTarget, now: string): AdminPlatformState | null {
  if (wdTarget === 'treasury') {
    if (s.platformTreasuryBroCents < c) return null;
    return { ...s, platformTreasuryBroCents: s.platformTreasuryBroCents - c };
  }
  const wdUserId = wdTarget.userId;
  const user = s.users.find((u) => u.id === wdUserId);
  if (!user || user.spotBroCents < c) return null;
  const users = s.users.map((u) => {
    if (u.id !== wdUserId) return u;
    const spot = Math.max(0, u.spotBroCents - c);
    const bro = Math.max(0, u.broCents - c);
    return {
      ...u,
      spotBroCents: spot,
      broCents: bro,
      ledgerEntriesCount: u.ledgerEntriesCount + 1,
      updatedAtIso: now,
    };
  });
  return { ...s, users };
}

function platformReducer(s: AdminPlatformState, action: AdminPlatformAction): AdminPlatformState {
  const now = new Date().toISOString();
  switch (action.type) {
    case 'HYDRATE':
      return hydrateDefaults(action.state);
    case 'RESET_SEED': {
      const next = emptyPlatformState();
      next.users = seedPlatformUsers();
      next.platformTreasuryBroCents = action.treasuryCents ?? 125_600;
      next.platformEscrowBroCents = action.escrowCents ?? 48_000;
      next.platformOlexpPositions = seedPlatformOlexpPositions();
      return applyOlexpAggregatesToUsers(next);
    }
    case 'SET_TREASURY':
      return { ...s, platformTreasuryBroCents: Math.max(0, Math.round(action.broCents)) };
    case 'SET_ESCROW':
      return { ...s, platformEscrowBroCents: Math.max(0, Math.round(action.broCents)) };
    case 'ADD_USER':
      return { ...s, users: [...s.users, { ...action.user, updatedAtIso: now }] };
    case 'UPDATE_USER': {
      const users = s.users.map((u) =>
        u.id === action.id ? { ...u, ...action.patch, updatedAtIso: now } : u,
      );
      return { ...s, users };
    }
    case 'REMOVE_USER':
      return { ...s, users: s.users.filter((u) => u.id !== action.id) };
    case 'IMPORT_SESSION_USER': {
      const g = action.game;
      const w = normalizeWalletState(g.finance.wallet);
      const mapped: PlatformOlexpPosition[] = (w.olexpPositions ?? []).map((p) => {
        let st: PlatformOlexpCustodyStatus = 'active';
        if (p.status === 'matured') st = 'matured';
        if (p.status === 'claimed') st = 'claimed';
        return {
          id: p.id,
          userId: 'save-local',
          planId: p.planId,
          principalCents: p.principalCents,
          startDate: p.startDate,
          endDate: p.endDate,
          yieldAccruedCents: p.yieldAccruedCents,
          status: st,
          createdAt: `${p.startDate}T15:00:00.000Z`,
          activatedAt: `${p.startDate}T15:00:00.000Z`,
          lastAccrualDate: p.lastAccrualDate,
        };
      });
      const rest = s.platformOlexpPositions.filter((x) => x.userId !== 'save-local');
      let next: AdminPlatformState = {
        ...s,
        platformOlexpPositions: [...mapped, ...rest].slice(0, 200),
      };
      next = applyOlexpAggregatesToUsers(next);
      const row = snapshotUserFromGame('save-local', g);
      const idx = next.users.findIndex((u) => u.id === 'save-local');
      const users =
        idx >= 0
          ? next.users.map((u, i) => (i === idx ? { ...row, updatedAtIso: now } : u))
          : [...next.users, { ...row, updatedAtIso: now }];
      return { ...next, users };
    }
    case 'APPLY_FIAT_DEPOSIT': {
      const c = Math.round(action.broCents);
      if (c <= 0) return s;
      const depTarget = action.target;
      if (action.queue) {
        const targetStr = depTarget === 'treasury' ? 'treasury' : depTarget.userId;
        return pushLedger(s, {
          kind: 'fiat_deposit',
          broCentsDelta: c,
          target: targetStr,
          note: action.note,
          flowStatus: 'processing',
        });
      }
      let next = applyDepositBalances(s, c, depTarget, now);
      next = pushLedger(next, {
        kind: 'fiat_deposit',
        broCentsDelta: c,
        target: depTarget === 'treasury' ? 'treasury' : depTarget.userId,
        note: action.note,
        flowStatus: 'completed',
      });
      return next;
    }
    case 'APPLY_FIAT_WITHDRAWAL': {
      const c = Math.round(action.broCents);
      if (c <= 0) return s;
      const wdTarget = action.target;
      if (action.queue) {
        const targetStr = wdTarget === 'treasury' ? 'treasury' : wdTarget.userId;
        return pushLedger(s, {
          kind: 'fiat_withdrawal',
          broCentsDelta: -c,
          target: targetStr,
          note: action.note,
          flowStatus: 'processing',
        });
      }
      const applied = applyWithdrawalBalances(s, c, wdTarget, now);
      if (applied == null) return s;
      let next = applied;
      next = pushLedger(next, {
        kind: 'fiat_withdrawal',
        broCentsDelta: -c,
        target: wdTarget === 'treasury' ? 'treasury' : wdTarget.userId,
        note: action.note,
        flowStatus: 'completed',
      });
      return next;
    }
    case 'COMPLETE_FIAT_FLOW': {
      const line = s.platformLedger.find((l) => l.id === action.lineId);
      if (!line || line.flowStatus !== 'processing') return s;
      if (line.kind !== 'fiat_deposit' && line.kind !== 'fiat_withdrawal') return s;
      const c = Math.abs(Math.round(line.broCentsDelta));
      if (c <= 0) return s;
      if (line.target !== 'treasury' && !s.users.some((u) => u.id === line.target)) return s;
      const target: PlatformTarget = line.target === 'treasury' ? 'treasury' : { userId: line.target };
      if (line.kind === 'fiat_deposit') {
        let next = applyDepositBalances(s, c, target, now);
        next = replaceLedgerLine(next, line.id, { flowStatus: 'completed', failureReason: undefined });
        return next;
      }
      const nextWd = applyWithdrawalBalances(s, c, target, now);
      if (nextWd == null) return s;
      return replaceLedgerLine(nextWd, line.id, { flowStatus: 'completed', failureReason: undefined });
    }
    case 'FAIL_FIAT_FLOW': {
      const line = s.platformLedger.find((l) => l.id === action.lineId);
      if (!line || line.flowStatus !== 'processing') return s;
      return replaceLedgerLine(s, line.id, {
        flowStatus: 'failed',
        failureReason: action.reason?.trim() || undefined,
      });
    }
    case 'REGISTER_OLEXP_CUSTODY_PENDING': {
      const plan = getPlan(action.planId);
      const pc = Math.round(action.principalCents);
      if (!plan || pc < plan.minBroCents) return s;
      if (!s.users.some((u) => u.id === action.userId)) return s;
      const today = now.slice(0, 10);
      const pos: PlatformOlexpPosition = {
        id: `plat_olexp_${uid()}`,
        userId: action.userId,
        planId: action.planId,
        principalCents: pc,
        startDate: today,
        endDate: addDaysPlatform(today, plan.days),
        yieldAccruedCents: 0,
        status: 'pending_activation',
        createdAt: now,
        note: action.note?.trim() || undefined,
      };
      const next: AdminPlatformState = {
        ...s,
        platformOlexpPositions: [pos, ...s.platformOlexpPositions].slice(0, 200),
      };
      return applyOlexpAggregatesToUsers(next);
    }
    case 'ACTIVATE_OLEXP_CUSTODY': {
      const positions = s.platformOlexpPositions.map((p) => {
        if (p.id !== action.positionId || p.status !== 'pending_activation') return p;
        const plan = getPlan(p.planId);
        if (!plan) return p;
        const today = now.slice(0, 10);
        return {
          ...p,
          status: 'active' as const,
          startDate: today,
          endDate: addDaysPlatform(today, plan.days),
          lastAccrualDate: today,
          activatedAt: now,
        };
      });
      return applyOlexpAggregatesToUsers({ ...s, platformOlexpPositions: positions });
    }
    case 'REJECT_OLEXP_CUSTODY': {
      const platformOlexpPositions = s.platformOlexpPositions.filter((p) => p.id !== action.positionId);
      return applyOlexpAggregatesToUsers({ ...s, platformOlexpPositions });
    }
    default:
      return s;
  }
}

export function snapshotUserFromGame(id: string, g: OlefootGameState): AdminPlatformUser {
  const w = g.finance.wallet;
  const now = new Date().toISOString();
  const olexp = w?.olexpPositions ?? [];
  const principal = olexp.filter((p) => p.status === 'active').reduce((s, p) => s + p.principalCents, 0);
  const yieldAcc = olexp.reduce((s, p) => s + p.yieldAccruedCents, 0);
  return {
    id,
    displayName: 'Sessão local (navegador)',
    email: undefined,
    country: '—',
    clubName: g.club.name,
    clubShort: g.club.shortName,
    broCents: g.finance.broCents,
    spotBroCents: w?.spotBroCents ?? g.finance.broCents,
    spotExpBalance: w?.spotExpBalance ?? 0,
    ole: g.finance.ole,
    olexpPrincipalLockedCents: principal,
    olexpYieldAccruedCents: yieldAcc,
    gatPositionsCount: w?.gatPositions?.length ?? 0,
    ledgerEntriesCount: w?.ledger?.length ?? 0,
    createdAtIso: now,
    updatedAtIso: now,
    status: 'active',
    notes: 'Importado do save local deste dispositivo.',
  };
}

export interface PlatformFinancialAggregate {
  userCount: number;
  activeUsers: number;
  sumBroCents: number;
  sumSpotBroCents: number;
  sumSpotExp: number;
  sumOle: number;
  sumOlexpLockedCents: number;
  sumOlexpYieldAccruedCents: number;
  sumGatPositions: number;
  sumLedgerEntries: number;
  treasuryBroCents: number;
  escrowBroCents: number;
  /** Soma users + tesouraria (visão de passivo + caixa operacional) */
  totalBroInEcosystemCents: number;
}

export function computePlatformAggregate(s: AdminPlatformState): PlatformFinancialAggregate {
  const users = Array.isArray(s.users) ? s.users : [];
  const activeUsers = users.filter((u) => u.status === 'active').length;
  const sumBroCents = users.reduce((a, u) => a + (Number(u.broCents) || 0), 0);
  const sumSpotBroCents = users.reduce((a, u) => a + (Number(u.spotBroCents) || 0), 0);
  const sumSpotExp = users.reduce((a, u) => a + (Number(u.spotExpBalance) || 0), 0);
  const sumOle = users.reduce((a, u) => a + (Number(u.ole) || 0), 0);
  const sumOlexpLockedCents = users.reduce((a, u) => a + (Number(u.olexpPrincipalLockedCents) || 0), 0);
  const sumOlexpYieldAccruedCents = users.reduce((a, u) => a + (Number(u.olexpYieldAccruedCents) || 0), 0);
  const sumGatPositions = users.reduce((a, u) => a + (Number(u.gatPositionsCount) || 0), 0);
  const sumLedgerEntries = users.reduce((a, u) => a + (Number(u.ledgerEntriesCount) || 0), 0);
  const totalBroInEcosystemCents = sumBroCents + (Number(s.platformTreasuryBroCents) || 0);
  return {
    userCount: users.length,
    activeUsers,
    sumBroCents,
    sumSpotBroCents,
    sumSpotExp,
    sumOle,
    sumOlexpLockedCents,
    sumOlexpYieldAccruedCents,
    sumGatPositions,
    sumLedgerEntries,
    treasuryBroCents: Number(s.platformTreasuryBroCents) || 0,
    escrowBroCents: Number(s.platformEscrowBroCents) || 0,
    totalBroInEcosystemCents,
  };
}

/**
 * Subscreve o estado da plataforma (useSyncExternalStore).
 * O snapshot é comparado com `Object.is`: selectors que devolvem **objeto/array novo** a cada leitura
 * (ex.: `(s) => ({ ...s })` ou `(s) => computeAggregate(s)` sem memoização) causam **loop infinito** de renders.
 */
export function useAdminPlatformStore<T>(selector: (s: AdminPlatformState) => T): T {
  return useSyncExternalStore(
    subscribeAdminPlatform,
    () => selector(state),
    () => selector(state),
  );
}

export function useAdminPlatformDispatch() {
  return useCallback((a: AdminPlatformAction) => dispatchAdminPlatform(a), []);
}
