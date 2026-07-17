import { useCallback, useSyncExternalStore } from 'react';
import type { OlefootGameState } from '@/game/types';
import type {
  AdminPlatformState,
  AdminPlatformUser,
  CashflowExpenseCategory,
  CashflowExpenseLine,
  FiatPipelineStatus,
  GrowthCommerceLine,
  GrowthCommerceKind,
  GrowthDailyPulseRow,
  PlatformLedgerLine,
} from './platformTypes';
import { emptyPlatformState } from './platformTypes';
import {
  seedGrowthCommerceLines,
  seedGrowthDailyPulse,
  seedPlatformLedger,
  seedPlatformUsers,
} from './platformSeed';

const KEY = 'olefoot-admin-platform-v2'; // bumped v1→v2 pra invalidar caches com dados mockados

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type PlatformTarget = 'treasury' | { userId: string };

export type AdminPlatformAction =
  | { type: 'HYDRATE'; state: AdminPlatformState }
  | { type: 'ADD_USER'; user: AdminPlatformUser }
  | { type: 'UPDATE_USER'; id: string; patch: Partial<AdminPlatformUser> }
  | { type: 'REMOVE_USER'; id: string }
  | { type: 'REPLACE_USERS'; users: AdminPlatformUser[] }
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
      type: 'ADD_CASHFLOW_EXPENSE';
      expense: Omit<CashflowExpenseLine, 'id' | 'createdAt'> & { id?: string };
    }
  | { type: 'REMOVE_CASHFLOW_EXPENSE'; id: string }
  | { type: 'SET_GROWTH_BRO_CENTS_PER_BRL'; value: number | null }
  | {
      type: 'PUSH_GROWTH_COMMERCE_LINE';
      kind: import('./platformTypes').GrowthCommerceKind;
      revenueBroCents: number;
      grossBroCents?: number;
      userId?: string;
      label?: string;
    };

let state: AdminPlatformState = loadInitial();

function loadInitial(): AdminPlatformState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const s = emptyPlatformState();
      // Tudo zerado pro deploy de testes online. Valores sobem organicamente
      // conforme os managers reais usam o jogo (wallet, ledger, etc).
      s.users = [];
      s.platformTreasuryBroCents = 0;
      s.platformEscrowBroCents = 0;
      s.platformLedger = [];
      s.growthCommerceLines = [];
      s.growthDailyPulse = [];
      return s;
    }
    const p = JSON.parse(raw) as AdminPlatformState;
    if (p?.version !== 1) return hydrateDefaults(p);
    return hydrateDefaults(p);
  } catch {
    const s = emptyPlatformState();
    s.users = [];
    s.platformTreasuryBroCents = 0;
    s.platformEscrowBroCents = 0;
    s.platformLedger = [];
    s.growthCommerceLines = [];
    s.growthDailyPulse = [];
    return s;
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

const GROWTH_COMMERCE_KINDS: GrowthCommerceKind[] = ['store_item', 'transfer_player', 'bundle'];

function normalizeGrowthCommerceLine(raw: unknown, fallbackId: string): GrowthCommerceLine {
  const r = raw as Partial<GrowthCommerceLine>;
  const kind = GROWTH_COMMERCE_KINDS.includes(r.kind as GrowthCommerceKind)
    ? (r.kind as GrowthCommerceKind)
    : 'store_item';
  return {
    id: typeof r.id === 'string' && r.id ? r.id : fallbackId,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
    kind,
    revenueBroCents: Math.max(0, Math.round(Number(r.revenueBroCents) || 0)),
    grossBroCents:
      r.grossBroCents != null ? Math.max(0, Math.round(Number(r.grossBroCents) || 0)) : undefined,
    userId: typeof r.userId === 'string' ? r.userId : undefined,
    label: typeof r.label === 'string' ? r.label : undefined,
  };
}

const CASHFLOW_CATEGORIES: CashflowExpenseCategory[] = [
  'pessoas',
  'infra',
  'marketing',
  'legal',
  'ferramentas',
  'impostos',
  'outro',
];

function normalizeCashflowExpense(raw: unknown, fallbackId: string): CashflowExpenseLine {
  const r = raw as Partial<CashflowExpenseLine>;
  const cat = CASHFLOW_CATEGORIES.includes(r.category as CashflowExpenseCategory)
    ? (r.category as CashflowExpenseCategory)
    : 'outro';
  const date =
    typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
      ? r.date
      : new Date().toISOString().slice(0, 10);
  const endDate =
    typeof r.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.endDate)
      ? r.endDate
      : undefined;
  const recurring = r.recurring === true;
  return {
    id: typeof r.id === 'string' && r.id ? r.id : fallbackId,
    date,
    label: typeof r.label === 'string' && r.label.trim() ? r.label.trim() : 'Gasto',
    category: cat,
    amountBrlCents: Math.max(0, Math.round(Number(r.amountBrlCents) || 0)),
    note: typeof r.note === 'string' ? r.note.trim() || undefined : undefined,
    recurring: recurring || undefined,
    endDate: recurring ? endDate : undefined,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
  };
}

function normalizeGrowthDailyPulseRow(raw: unknown, _idx: number): GrowthDailyPulseRow {
  const r = raw as Partial<GrowthDailyPulseRow>;
  const today = new Date().toISOString().slice(0, 10);
  const date =
    typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : today;
  return {
    date: date || today,
    bannerImpressions: Math.max(0, Math.round(Number(r.bannerImpressions) || 0)),
    ctaClicks: Math.max(0, Math.round(Number(r.ctaClicks) || 0)),
    attributedSignups:
      r.attributedSignups != null ? Math.max(0, Math.round(Number(r.attributedSignups) || 0)) : undefined,
  };
}

function hydrateDefaults(raw: Partial<AdminPlatformState>): AdminPlatformState {
  const base = emptyPlatformState();
  const ledgerRaw = Array.isArray(raw.platformLedger) ? raw.platformLedger : [];
  const platformLedger = ledgerRaw.map((row, i) => normalizeLedgerLine(row, `legacy-${i}`));
  const gcRaw = Array.isArray(raw.growthCommerceLines) ? raw.growthCommerceLines : [];
  const growthCommerceLines = gcRaw.map((row, i) => normalizeGrowthCommerceLine(row, `gc-legacy-${i}`));
  const pulseRaw = Array.isArray(raw.growthDailyPulse) ? raw.growthDailyPulse : [];
  const growthDailyPulse = pulseRaw.map((row, i) => normalizeGrowthDailyPulseRow(row, i));
  const cfRaw = Array.isArray(raw.growthCashflowExpenses) ? raw.growthCashflowExpenses : [];
  const growthCashflowExpenses = cfRaw.map((row, i) => normalizeCashflowExpense(row, `cf-legacy-${i}`));
  const growthBroCentsPerBrlRaw = raw.growthBroCentsPerBrl;
  const parsedFx = Number(growthBroCentsPerBrlRaw);
  const growthBroCentsPerBrl =
    growthBroCentsPerBrlRaw != null && Number.isFinite(parsedFx) && parsedFx > 0
      ? Math.round(parsedFx)
      : undefined;
  const merged: AdminPlatformState = {
    ...base,
    ...raw,
    version: 1,
    users: Array.isArray(raw.users) ? raw.users : base.users,
    platformLedger,
    growthCommerceLines,
    growthDailyPulse,
    growthCashflowExpenses,
    growthBroCentsPerBrl,
    platformTreasuryBroCents: Number(raw.platformTreasuryBroCents) || 0,
    platformEscrowBroCents: Number(raw.platformEscrowBroCents) || 0,
  };
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

/** Registra compra/transação de jogo no Growth da plataforma (fire-and-forget). */
export function trackGrowthCommerce(
  kind: import('./platformTypes').GrowthCommerceKind,
  revenueBroCents: number,
  opts?: { grossBroCents?: number; userId?: string; label?: string },
): void {
  dispatchAdminPlatform({
    type: 'PUSH_GROWTH_COMMERCE_LINE',
    kind,
    revenueBroCents,
    grossBroCents: opts?.grossBroCents,
    userId: opts?.userId,
    label: opts?.label,
  });
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
      next.users = [];
      next.platformTreasuryBroCents = action.treasuryCents ?? 0;
      next.platformEscrowBroCents = action.escrowCents ?? 0;
      next.platformLedger = [];
      next.growthCommerceLines = [];
      next.growthDailyPulse = [];
      return next;
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
    case 'REPLACE_USERS':
      return { ...s, users: action.users };
    case 'IMPORT_SESSION_USER': {
      const row = snapshotUserFromGame('save-local', action.game);
      const idx = s.users.findIndex((u) => u.id === 'save-local');
      const users =
        idx >= 0
          ? s.users.map((u, i) => (i === idx ? { ...row, updatedAtIso: now } : u))
          : [...s.users, { ...row, updatedAtIso: now }];
      return { ...s, users };
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
    case 'ADD_CASHFLOW_EXPENSE': {
      const id = action.expense.id ?? uid();
      const row = normalizeCashflowExpense(
        { ...action.expense, id, createdAt: new Date().toISOString() },
        id,
      );
      return {
        ...s,
        growthCashflowExpenses: [row, ...(s.growthCashflowExpenses ?? [])].slice(0, 500),
      };
    }
    case 'REMOVE_CASHFLOW_EXPENSE':
      return {
        ...s,
        growthCashflowExpenses: (s.growthCashflowExpenses ?? []).filter((x) => x.id !== action.id),
      };
    case 'SET_GROWTH_BRO_CENTS_PER_BRL': {
      if (action.value == null || action.value <= 0) {
        const next = { ...s };
        delete next.growthBroCentsPerBrl;
        return next;
      }
      return { ...s, growthBroCentsPerBrl: Math.round(action.value) };
    }
    case 'PUSH_GROWTH_COMMERCE_LINE': {
      const line: import('./platformTypes').GrowthCommerceLine = {
        id: uid(),
        createdAt: new Date().toISOString(),
        kind: action.kind,
        revenueBroCents: action.revenueBroCents,
        grossBroCents: action.grossBroCents,
        userId: action.userId,
        label: action.label,
      };
      return { ...s, growthCommerceLines: [line, ...s.growthCommerceLines].slice(0, 1000) };
    }
    default:
      return s;
  }
}

export function snapshotUserFromGame(id: string, g: OlefootGameState): AdminPlatformUser {
  const w = g.finance.wallet;
  const now = new Date().toISOString();
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
  const sumLedgerEntries = users.reduce((a, u) => a + (Number(u.ledgerEntriesCount) || 0), 0);
  const totalBroInEcosystemCents = sumBroCents + (Number(s.platformTreasuryBroCents) || 0);
  return {
    userCount: users.length,
    activeUsers,
    sumBroCents,
    sumSpotBroCents,
    sumSpotExp,
    sumOle,
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
