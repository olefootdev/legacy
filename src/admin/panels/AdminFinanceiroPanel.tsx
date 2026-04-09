import { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Filter,
  Landmark,
  Lock,
  PiggyBank,
  ShieldCheck,
  TrendingUp,
  Vault,
  XCircle,
} from 'lucide-react';
import { useGameDispatch, useGameStore } from '@/game/store';
import { formatBroFromCents, formatExp } from '@/systems/economy';
import { normalizeWalletState } from '@/wallet/initial';
import { queryLedger } from '@/wallet/ledger';
import { olexpPlanLabel } from '@/wallet/financeAdminViews';
import type { WalletLedgerEntry, WalletLedgerType, WalletCurrencyExt, OlexpPlanId } from '@/wallet/types';
import {
  OLEXP_PLANS,
  OLEXP_SWAP_OLEXP_TO_SPOT_MIN_BRO_CENTS,
  DAILY_ACCRUE_HOUR,
  DAILY_ACCRUE_MINUTE,
} from '@/wallet/constants';
import {
  bucketMaturitiesByMonth,
  daysUntilEnd,
  estimateRemainingYieldCents,
  forecastPrincipalPayoutCents,
} from '@/admin/olexpPlatformForecast';
import type { PlatformOlexpCustodyStatus } from '@/admin/platformTypes';
import { cn } from '@/lib/utils';
import {
  computePlatformAggregate,
  useAdminPlatformDispatch,
  useAdminPlatformStore,
} from '@/admin/platformStore';
import type { FiatPipelineStatus, PlatformLedgerLine } from '@/admin/platformTypes';

function broInputToCents(s: string): number | null {
  const t = s.replace(',', '.').trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function fmtIsoDate(iso: string | undefined): string {
  if (iso == null || typeof iso !== 'string') return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso.slice(0, 16);
  }
}

const LEDGER_FILTER_OPTS: { value: WalletLedgerType | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'FIAT_DEPOSIT', label: 'Depósito (simulado)' },
  { value: 'FIAT_WITHDRAWAL', label: 'Saque (simulado)' },
  { value: 'SPOT_BRO', label: 'SPOT BRO' },
  { value: 'SWAP_SPOT_TO_OLEXP', label: '→ OLEXP (custódia)' },
  { value: 'SWAP_OLEXP_TO_SPOT', label: '← OLEXP (saída)' },
  { value: 'OLEXP_PRINCIPAL', label: 'OLEXP principal' },
  { value: 'OLEXP_YIELD', label: 'OLEXP yield' },
  { value: 'GAT_REWARD', label: 'GAT reward' },
  { value: 'TRANSFER', label: 'Transferência' },
];

function badgeLedger(type: string | undefined): string {
  if (!type || typeof type !== 'string') return 'bg-white/10 text-gray-300 border-white/15';
  if (type === 'FIAT_DEPOSIT') return 'bg-emerald-500/20 text-emerald-200 border-emerald-500/35';
  if (type === 'FIAT_WITHDRAWAL') return 'bg-rose-500/20 text-rose-200 border-rose-500/35';
  if (type.startsWith('SWAP')) return 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/35';
  if (type.startsWith('OLEXP')) return 'bg-violet-500/20 text-violet-200 border-violet-500/35';
  return 'bg-white/10 text-gray-300 border-white/15';
}

function badgePlatformKind(k: PlatformLedgerLine['kind']): string {
  if (k === 'fiat_deposit') return 'bg-emerald-500/20 text-emerald-200 border-emerald-500/35';
  if (k === 'fiat_withdrawal') return 'bg-rose-500/20 text-rose-200 border-rose-500/35';
  return 'bg-white/10 text-gray-300 border-white/15';
}

function badgeFlowStatus(st: FiatPipelineStatus | undefined): string {
  if (st === 'processing') return 'bg-amber-500/20 text-amber-200 border-amber-500/40';
  if (st === 'failed') return 'bg-rose-600/25 text-rose-200 border-rose-500/45';
  return 'bg-emerald-600/20 text-emerald-200 border-emerald-500/40';
}

function FiatEsteira({ status }: { status: FiatPipelineStatus | undefined }) {
  const s = status ?? 'completed';
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white/50">
        <CheckCircle2 className="h-3 w-3 text-emerald-500/70" />
        Registo
      </span>
      <ChevronRight className="h-3 w-3 shrink-0 text-white/15" />
      <span
        className={cn(
          'flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wide',
          s === 'processing'
            ? 'border-amber-400/50 bg-amber-500/15 text-amber-100'
            : 'border-white/10 bg-black/30 text-white/35',
        )}
      >
        {s === 'processing' ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" /> : null}
        Processando
      </span>
      <ChevronRight className="h-3 w-3 shrink-0 text-white/15" />
      {s === 'failed' ? (
        <span className="flex items-center gap-1 rounded-md border border-rose-400/50 bg-rose-500/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-rose-100">
          <XCircle className="h-3 w-3" />
          Falha
        </span>
      ) : (
        <span
          className={cn(
            'flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wide',
            s === 'completed'
              ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100'
              : 'border-white/10 bg-black/30 text-white/35',
          )}
        >
          {s === 'completed' ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : null}
          Concluído
        </span>
      )}
    </div>
  );
}

function resolveFiatTargetLabel(target: string, userMap: Map<string, { displayName: string; clubShort: string }>): string {
  if (target === 'treasury') return 'Tesouraria';
  const u = userMap.get(target);
  if (!u) return target;
  return `${u.displayName} (${u.clubShort})`;
}

function custodyStatusLabel(st: PlatformOlexpCustodyStatus): string {
  if (st === 'pending_activation') return 'Aguarda activação';
  if (st === 'active') return 'Activa';
  if (st === 'matured') return 'Vencida (resgate)';
  return 'Encerrada';
}

function custodyStatusBadge(st: PlatformOlexpCustodyStatus): string {
  if (st === 'pending_activation') return 'bg-amber-500/20 text-amber-200 border-amber-400/40';
  if (st === 'active') return 'bg-violet-500/20 text-violet-200 border-violet-400/35';
  if (st === 'matured') return 'bg-sky-500/20 text-sky-200 border-sky-400/35';
  return 'bg-white/10 text-white/45 border-white/15';
}

function canCompleteWithdrawalLine(
  line: PlatformLedgerLine,
  s: { platformTreasuryBroCents: number; users: { id: string; spotBroCents: number }[] },
): boolean {
  if (line.kind !== 'fiat_withdrawal') return true;
  const c = Math.abs(Math.round(line.broCentsDelta));
  if (c <= 0) return false;
  if (line.target === 'treasury') return s.platformTreasuryBroCents >= c;
  const u = s.users.find((x) => x.id === line.target);
  return u != null && u.spotBroCents >= c;
}

type Sub = 'visao' | 'depositos_saques' | 'olexp' | 'extrato';

export function AdminFinanceiroPanel() {
  const gameDispatch = useGameDispatch();
  const platformDispatch = useAdminPlatformDispatch();
  const platform = useAdminPlatformStore((s) => s);
  const ag = useMemo(() => computePlatformAggregate(platform), [platform]);

  const platformLedgerSafe = useMemo(
    () => (Array.isArray(platform.platformLedger) ? platform.platformLedger : []),
    [platform.platformLedger],
  );

  const platFiatDep = useMemo(
    () =>
      platformLedgerSafe
        .filter((l) => l && l.kind === 'fiat_deposit')
        .reduce((s, l) => s + (Number(l.broCentsDelta) || 0), 0),
    [platformLedgerSafe],
  );
  const platFiatWd = useMemo(
    () =>
      platformLedgerSafe
        .filter((l) => l && l.kind === 'fiat_withdrawal')
        .reduce((s, l) => s + Math.abs(Number(l.broCentsDelta) || 0), 0),
    [platformLedgerSafe],
  );

  const finance = useGameStore((s) => s.finance);
  const wallet = normalizeWalletState(finance.wallet);
  const [sub, setSub] = useState<Sub>('visao');

  const [fiatTarget, setFiatTarget] = useState<string>('treasury');
  const [depBro, setDepBro] = useState('');
  const [depNote, setDepNote] = useState('');
  const [depQueue, setDepQueue] = useState(false);
  const [wdBro, setWdBro] = useState('');
  const [wdNote, setWdNote] = useState('');
  const [wdQueue, setWdQueue] = useState(false);
  const [custodyUserId, setCustodyUserId] = useState('');
  const [custodyPlanId, setCustodyPlanId] = useState<OlexpPlanId>('90d');
  const [custodyBro, setCustodyBro] = useState('');
  const [custodyNote, setCustodyNote] = useState('');
  const [treasuryEdit, setTreasuryEdit] = useState('');
  const [escrowEdit, setEscrowEdit] = useState('');

  const [accrualDate, setAccrualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ledgerType, setLedgerType] = useState<WalletLedgerType | ''>('');
  const [ledgerCur, setLedgerCur] = useState<WalletCurrencyExt | ''>('');

  const ledgerFiltered: WalletLedgerEntry[] = useMemo(() => {
    return queryLedger(wallet, {
      ...(ledgerType ? { type: ledgerType } : {}),
      ...(ledgerCur ? { currency: ledgerCur } : {}),
    });
  }, [wallet, ledgerType, ledgerCur]);
  const ledgerSorted = useMemo(
    () => [...ledgerFiltered].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)).slice(0, 100),
    [ledgerFiltered],
  );

  const platformLedgerSorted = useMemo(
    () =>
      [...platformLedgerSafe]
        .filter((l) => l && typeof l === 'object' && l.id)
        .sort((a, b) => ((b.createdAt ?? '') > (a.createdAt ?? '') ? 1 : -1))
        .slice(0, 120),
    [platformLedgerSafe],
  );

  const userLabelMap = useMemo(() => {
    const m = new Map<string, { displayName: string; clubShort: string }>();
    for (const u of Array.isArray(platform.users) ? platform.users : []) {
      m.set(u.id, { displayName: u.displayName, clubShort: u.clubShort });
    }
    return m;
  }, [platform.users]);

  const recentFiatDeposits = useMemo(
    () =>
      [...platformLedgerSafe]
        .filter((l) => l?.kind === 'fiat_deposit')
        .sort((a, b) => ((b.createdAt ?? '') > (a.createdAt ?? '') ? 1 : -1))
        .slice(0, 40),
    [platformLedgerSafe],
  );

  const recentFiatWithdrawals = useMemo(
    () =>
      [...platformLedgerSafe]
        .filter((l) => l?.kind === 'fiat_withdrawal')
        .sort((a, b) => ((b.createdAt ?? '') > (a.createdAt ?? '') ? 1 : -1))
        .slice(0, 40),
    [platformLedgerSafe],
  );

  const platformOlexpSafe = useMemo(
    () => (Array.isArray(platform.platformOlexpPositions) ? platform.platformOlexpPositions : []),
    [platform.platformOlexpPositions],
  );
  const forecastToday = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const maturityBuckets = useMemo(
    () => bucketMaturitiesByMonth(platformOlexpSafe, forecastToday),
    [platformOlexpSafe, forecastToday],
  );
  const olexpSorted = useMemo(
    () => [...platformOlexpSafe].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1)),
    [platformOlexpSafe],
  );
  const custodyPlanMeta = OLEXP_PLANS.find((x) => x.id === custodyPlanId) ?? OLEXP_PLANS[0]!;

  const applyDeposit = () => {
    const cents = broInputToCents(depBro);
    if (cents == null) {
      alert('Indica um valor BRO válido (ex.: 50 ou 10,5).');
      return;
    }
    const target = fiatTarget === 'treasury' ? 'treasury' : { userId: fiatTarget };
    platformDispatch({
      type: 'APPLY_FIAT_DEPOSIT',
      target,
      broCents: cents,
      note: depNote.trim() || undefined,
      queue: depQueue,
    });
    setDepBro('');
    setDepNote('');
  };

  const applyWithdraw = () => {
    const cents = broInputToCents(wdBro);
    if (cents == null) {
      alert('Indica um valor BRO válido.');
      return;
    }
    const target = fiatTarget === 'treasury' ? 'treasury' : { userId: fiatTarget };
    platformDispatch({
      type: 'APPLY_FIAT_WITHDRAWAL',
      target,
      broCents: cents,
      note: wdNote.trim() || undefined,
      queue: wdQueue,
    });
    setWdBro('');
    setWdNote('');
  };

  const completeFiatLine = (lineId: string) => {
    const line = platformLedgerSafe.find((l) => l.id === lineId);
    if (line?.kind === 'fiat_withdrawal' && line.flowStatus === 'processing') {
      if (!canCompleteWithdrawalLine(line, platform)) {
        alert('Saldo insuficiente (SPOT do utilizador ou tesouraria) para concluir este saque.');
        return;
      }
    }
    platformDispatch({ type: 'COMPLETE_FIAT_FLOW', lineId });
  };

  const failFiatLine = (lineId: string) => {
    const reason = window.prompt('Motivo da falha (opcional):') ?? '';
    platformDispatch({ type: 'FAIL_FIAT_FLOW', lineId, reason: reason.trim() || undefined });
  };

  const registerCustodyPending = () => {
    const cents = broInputToCents(custodyBro);
    const uid = custodyUserId || platform.users[0]?.id;
    if (!uid) {
      alert('Não há utilizadores na plataforma.');
      return;
    }
    if (cents == null) {
      alert('Indica um valor BRO válido (mínimo do plano em Hold).');
      return;
    }
    platformDispatch({
      type: 'REGISTER_OLEXP_CUSTODY_PENDING',
      userId: uid,
      planId: custodyPlanId,
      principalCents: cents,
      note: custodyNote.trim() || undefined,
    });
    setCustodyBro('');
    setCustodyNote('');
  };

  const copyPlatformLedger = () => {
    void navigator.clipboard.writeText(JSON.stringify(platformLedgerSorted, null, 2));
  };

  const copySessionLedger = () => {
    void navigator.clipboard.writeText(JSON.stringify(ledgerSorted, null, 2));
  };

  const applyTreasury = () => {
    const c = broInputToCents(treasuryEdit);
    if (c == null) {
      alert('Tesouraria: valor BRO inválido.');
      return;
    }
    platformDispatch({ type: 'SET_TREASURY', broCents: c });
    setTreasuryEdit('');
  };

  const applyEscrow = () => {
    const c = broInputToCents(escrowEdit);
    if (c == null) {
      alert('Escrow: valor BRO inválido.');
      return;
    }
    platformDispatch({ type: 'SET_ESCROW', broCents: c });
    setEscrowEdit('');
  };

  const subNav = (id: Sub, label: string, icon: typeof Banknote) => {
    const Icon = icon;
    const on = sub === id;
    return (
      <button
        type="button"
        onClick={() => setSub(id)}
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold uppercase tracking-wide',
          on ? 'bg-neon-yellow text-black' : 'bg-white/5 text-white/55 hover:bg-white/10 hover:text-white',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100/90">
        <strong className="text-white">Visão plataforma:</strong> os cartões abaixo somam{' '}
        <span className="font-bold text-white">{ag.userCount}</span> conta(s) registada(s) em{' '}
        <code className="text-neon-yellow/90">Usuários</code> + tesouraria global. Isto é independente do save único da
        sessão do browser.
      </div>

      <p className="max-w-3xl text-sm text-white/50">
        Para operar <strong className="text-white/75">custódia OLEXP real</strong> (posições no reducer) continua a usar
        a secção &quot;Sessão local&quot; mais abaixo ou o separador <strong className="text-white/75">Sessão local</strong> no
        menu.
      </p>

      <div className="flex flex-wrap gap-2">
        {subNav('visao', 'Visão geral', Banknote)}
        {subNav('depositos_saques', 'Depósitos & saques', Landmark)}
        {subNav('olexp', 'Custódia OLEXP', Vault)}
        {subNav('extrato', 'Extrato & filtros', Filter)}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Σ BRO (utilizadores)</p>
          <p className="mt-1 font-display text-xl font-black text-white">{formatBroFromCents(ag.sumBroCents)}</p>
          <p className="text-[10px] text-white/35">Soma carteiras · {ag.activeUsers} ativos</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Σ SPOT BRO</p>
          <p className="mt-1 font-display text-xl font-black text-neon-yellow">
            {formatBroFromCents(ag.sumSpotBroCents)}
          </p>
          <p className="text-[10px] text-white/35">Σ EXP ranking: {formatExp(ag.sumOle)}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200/70">Depósitos Admin (plataforma)</p>
          <p className="mt-1 font-display text-xl font-black text-emerald-200">{formatBroFromCents(platFiatDep)}</p>
          <p className="text-[10px] text-white/35">Ledger plataforma · fiats simulados</p>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-rose-200/70">Saques Admin (plataforma)</p>
          <p className="mt-1 font-display text-xl font-black text-rose-200">{formatBroFromCents(platFiatWd)}</p>
          <p className="text-[10px] text-white/35">Totais simulados registados no painel</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
          <div className="flex items-center gap-2 text-violet-200">
            <Lock className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">OLEXP trancado (Σ users)</span>
          </div>
          <p className="mt-2 font-display text-lg font-black text-white">
            {formatBroFromCents(ag.sumOlexpLockedCents)}
          </p>
          <p className="text-[10px] text-white/40">
            Yield acc. Σ {formatBroFromCents(ag.sumOlexpYieldAccruedCents)}
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-amber-200">
            <PiggyBank className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">GAT (contagem)</span>
          </div>
          <p className="mt-2 font-display text-lg font-black text-white">{ag.sumGatPositions} posições</p>
          <p className="text-[10px] text-white/40">Agregado por utilizador (MVP)</p>
        </div>
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4">
          <div className="flex items-center gap-2 text-cyan-200">
            <Landmark className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Tesouraria OLEFOOT</span>
          </div>
          <p className="mt-2 font-mono text-lg font-black text-white">
            {formatBroFromCents(ag.treasuryBroCents)}
          </p>
          <p className="text-[10px] text-white/40">Ecosystem BRO ≈ {formatBroFromCents(ag.totalBroInEcosystemCents)}</p>
        </div>
        <div className="rounded-xl border border-orange-500/25 bg-orange-500/5 p-4">
          <div className="flex items-center gap-2 text-orange-200">
            <Landmark className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Escrow plataforma (Admin)</span>
          </div>
          <p className="mt-2 font-mono text-lg font-black text-white">
            {formatBroFromCents(ag.escrowBroCents)}
          </p>
          <p className="text-[10px] text-white/40">
            Sessão: escrow amistosos {formatBroFromCents(finance.friendlyChallengeEscrowBroCents ?? 0)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] font-bold uppercase text-white/40">
            Ajustar tesouraria (BRO)
            <input
              value={treasuryEdit}
              onChange={(e) => setTreasuryEdit(e.target.value)}
              placeholder="ex: 5000"
              className="mt-1 block w-36 rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
            />
          </label>
          <button
            type="button"
            onClick={applyTreasury}
            className="rounded-lg bg-white/15 px-3 py-2 text-xs font-bold uppercase text-white hover:bg-white/25"
          >
            Definir
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] font-bold uppercase text-white/40">
            Escrow agregado (BRO)
            <input
              value={escrowEdit}
              onChange={(e) => setEscrowEdit(e.target.value)}
              placeholder="ex: 100"
              className="mt-1 block w-36 rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
            />
          </label>
          <button
            type="button"
            onClick={applyEscrow}
            className="rounded-lg bg-white/15 px-3 py-2 text-xs font-bold uppercase text-white hover:bg-white/25"
          >
            Definir
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-white/15 bg-black/20 px-3 py-2 text-[10px] text-white/40">
        Referência sessão local (não entra no Σ plataforma): BRO {formatBroFromCents(finance.broCents)} · SPOT{' '}
        {formatBroFromCents(wallet.spotBroCents)}
      </div>

      <label className="flex max-w-md flex-col gap-1 text-[10px] font-bold uppercase text-white/45">
        Destino depósito / saque simulado
        <select
          value={fiatTarget}
          onChange={(e) => setFiatTarget(e.target.value)}
          className="rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
        >
          <option value="treasury">Tesouraria da plataforma</option>
          {(Array.isArray(platform.users) ? platform.users : []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName} — {u.clubShort}
            </option>
          ))}
        </select>
      </label>

      {sub === 'visao' && (
        <div className="space-y-4">
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="mb-3 font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
              Mapa financeiro (produto)
            </h3>
            <ul className="space-y-2 text-sm text-white/65">
              <li>
                <strong className="text-white/85">Depósitos / saques:</strong> neste MVP, o Admin regista movimentos na
                ledger da <em>plataforma</em> e ajusta tesouraria ou o utilizador escolhido.
              </li>
              <li>
                <strong className="text-white/85">Custódia OLEXP:</strong> visão agregada por utilizador na tabela em
                Custódia; pormenor de posições no cliente real continua na sessão local.
              </li>
              <li>
                <strong className="text-white/85">Próximo passo backend:</strong> substituir{' '}
                <code className="text-neon-yellow/80">olefoot-admin-platform-v1</code> por API e sincronizar com KYC/PSP.
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
              Planos OLEXP (constantes)
            </h3>
            <div className="flex flex-wrap gap-2">
              {OLEXP_PLANS.map((p) => (
                <span
                  key={p.id}
                  className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] text-white/70"
                >
                  {p.label}
                </span>
              ))}
            </div>
          </section>
        </div>
      )}

      {sub === 'depositos_saques' && (
        <div className="space-y-6">
          <p className="max-w-3xl text-sm text-white/45">
            Os pedidos aparecem por utilizador (ou tesouraria). Com <strong className="text-white/70">fila</strong>, o
            registo fica em <strong className="text-amber-200/90">processando</strong> até concluíres ou marcares falha —
            útil para espelhar PSP/KYC antes de mexer em saldos.
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
              <h3 className="mb-3 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-emerald-200">
                <ArrowDownToLine className="h-4 w-4" />
                Simular depósito (plataforma)
              </h3>
              <label className="block text-[10px] font-bold uppercase text-white/40">
                Valor (BRO)
                <input
                  value={depBro}
                  onChange={(e) => setDepBro(e.target.value)}
                  placeholder="ex: 100 ou 50,5"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="mt-2 block text-[10px] font-bold uppercase text-white/40">
                Nota
                <input
                  value={depNote}
                  onChange={(e) => setDepNote(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-white/65">
                <input
                  type="checkbox"
                  checked={depQueue}
                  onChange={(e) => setDepQueue(e.target.checked)}
                  className="rounded border-white/30"
                />
                Apenas fila (processando) — não creditar até &quot;Concluir&quot;
              </label>
              <button
                type="button"
                onClick={applyDeposit}
                className="mt-4 w-full rounded-lg bg-emerald-600 py-2.5 text-xs font-black uppercase text-white hover:bg-emerald-500"
              >
                Registrar depósito
              </button>
            </section>

            <section className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4">
              <h3 className="mb-3 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-rose-200">
                <ArrowUpFromLine className="h-4 w-4" />
                Simular saque (plataforma)
              </h3>
              <label className="block text-[10px] font-bold uppercase text-white/40">
                Valor (BRO)
                <input
                  value={wdBro}
                  onChange={(e) => setWdBro(e.target.value)}
                  placeholder="ex: 25"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="mt-2 block text-[10px] font-bold uppercase text-white/40">
                Nota
                <input
                  value={wdNote}
                  onChange={(e) => setWdNote(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-white/65">
                <input
                  type="checkbox"
                  checked={wdQueue}
                  onChange={(e) => setWdQueue(e.target.checked)}
                  className="rounded border-white/30"
                />
                Apenas fila (processando) — não debitar até &quot;Concluir&quot;
              </label>
              <button
                type="button"
                onClick={applyWithdraw}
                className="mt-4 w-full rounded-lg bg-rose-600 py-2.5 text-xs font-black uppercase text-white hover:bg-rose-500"
              >
                Registrar saque
              </button>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-emerald-500/20 bg-black/25 p-4">
              <h4 className="mb-3 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-emerald-200/90">
                <ArrowDownToLine className="h-4 w-4" />
                Últimos depósitos
              </h4>
              <div className="max-h-[min(70vh,520px)] space-y-3 overflow-y-auto pr-1">
                {recentFiatDeposits.map((l) => (
                  <div
                    key={l.id}
                    className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[11px] text-white/75"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-[10px] text-white/40">{fmtIsoDate(l.createdAt)}</p>
                        <p className="mt-0.5 font-semibold text-white/90">
                          {resolveFiatTargetLabel(l.target, userLabelMap)}
                        </p>
                        <p className="mt-1 font-mono text-emerald-200">
                          +{formatBroFromCents(l.broCentsDelta)}
                        </p>
                        {l.note ? <p className="mt-1 text-white/45">{l.note}</p> : null}
                        {l.flowStatus === 'failed' && l.failureReason ? (
                          <p className="mt-1 text-rose-300/90">{l.failureReason}</p>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded border px-2 py-0.5 text-[9px] font-bold uppercase',
                          badgeFlowStatus(l.flowStatus),
                        )}
                      >
                        {l.flowStatus === 'processing'
                          ? 'Processando'
                          : l.flowStatus === 'failed'
                            ? 'Falha'
                            : 'Concluído'}
                      </span>
                    </div>
                    <div className="mt-3 border-t border-white/5 pt-3">
                      <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-white/35">Esteira</p>
                      <FiatEsteira status={l.flowStatus} />
                    </div>
                    {l.flowStatus === 'processing' ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => completeFiatLine(l.id)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-bold uppercase text-white hover:bg-emerald-500"
                        >
                          Concluir (creditar)
                        </button>
                        <button
                          type="button"
                          onClick={() => failFiatLine(l.id)}
                          className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-[10px] font-bold uppercase text-rose-200 hover:bg-rose-500/10"
                        >
                          Marcar falha
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
                {recentFiatDeposits.length === 0 && (
                  <p className="py-8 text-center text-sm text-white/35">Sem depósitos registados.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-rose-500/20 bg-black/25 p-4">
              <h4 className="mb-3 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-rose-200/90">
                <ArrowUpFromLine className="h-4 w-4" />
                Últimos saques
              </h4>
              <div className="max-h-[min(70vh,520px)] space-y-3 overflow-y-auto pr-1">
                {recentFiatWithdrawals.map((l) => (
                  <div
                    key={l.id}
                    className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[11px] text-white/75"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-[10px] text-white/40">{fmtIsoDate(l.createdAt)}</p>
                        <p className="mt-0.5 font-semibold text-white/90">
                          {resolveFiatTargetLabel(l.target, userLabelMap)}
                        </p>
                        <p className="mt-1 font-mono text-rose-200">{formatBroFromCents(l.broCentsDelta)}</p>
                        {l.note ? <p className="mt-1 text-white/45">{l.note}</p> : null}
                        {l.flowStatus === 'failed' && l.failureReason ? (
                          <p className="mt-1 text-rose-300/90">{l.failureReason}</p>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded border px-2 py-0.5 text-[9px] font-bold uppercase',
                          badgeFlowStatus(l.flowStatus),
                        )}
                      >
                        {l.flowStatus === 'processing'
                          ? 'Processando'
                          : l.flowStatus === 'failed'
                            ? 'Falha'
                            : 'Concluído'}
                      </span>
                    </div>
                    <div className="mt-3 border-t border-white/5 pt-3">
                      <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-white/35">Esteira</p>
                      <FiatEsteira status={l.flowStatus} />
                    </div>
                    {l.flowStatus === 'processing' ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => completeFiatLine(l.id)}
                          disabled={!canCompleteWithdrawalLine(l, platform)}
                          className={cn(
                            'rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase',
                            canCompleteWithdrawalLine(l, platform)
                              ? 'bg-rose-600 text-white hover:bg-rose-500'
                              : 'cursor-not-allowed border border-white/10 bg-white/5 text-white/30',
                          )}
                        >
                          Concluir (debitar)
                        </button>
                        <button
                          type="button"
                          onClick={() => failFiatLine(l.id)}
                          className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-[10px] font-bold uppercase text-rose-200 hover:bg-rose-500/10"
                        >
                          Marcar falha
                        </button>
                        {!canCompleteWithdrawalLine(l, platform) ? (
                          <span className="text-[10px] text-amber-200/80">Saldo insuficiente para debitar.</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
                {recentFiatWithdrawals.length === 0 && (
                  <p className="py-8 text-center text-sm text-white/35">Sem saques registados.</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 p-3">
            <h4 className="mb-2 text-[10px] font-bold uppercase text-white/45">Todos os movimentos plataforma (30)</h4>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-[11px] font-mono text-white/70">
              {platformLedgerSorted.slice(0, 30).map((l) => (
                <li key={l.id} className="flex flex-wrap justify-between gap-2 border-b border-white/5 py-1">
                  <span className="text-white/45">{fmtIsoDate(l.createdAt)}</span>
                  <span className="truncate">{l.target}</span>
                  <span className={l.broCentsDelta < 0 ? 'text-rose-300' : 'text-emerald-300'}>
                    {l.broCentsDelta > 0 ? '+' : ''}
                    {formatBroFromCents(l.broCentsDelta)}
                  </span>
                </li>
              ))}
              {platformLedgerSorted.length === 0 && <li className="text-white/35">Sem movimentos.</li>}
            </ul>
          </div>
        </div>
      )}

      {sub === 'olexp' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-violet-500/25 bg-violet-950/20 p-4 text-sm text-white/70">
            <h3 className="mb-2 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-violet-200">
              <Lock className="h-4 w-4" />
              Regras operacionais OLEXP
            </h3>
            <ul className="list-inside list-disc space-y-1 text-xs text-white/60">
              <li>
                O <strong className="text-white/80">yield</strong> é creditado <strong className="text-white/80">diariamente</strong>{' '}
                (dias úteis, após 24h da adesão) na lógica da sessão — usar &quot;Accrual na sessão&quot; abaixo para simular o job (
                UTC {String(DAILY_ACCRUE_HOUR).padStart(2, '0')}:{String(DAILY_ACCRUE_MINUTE).padStart(2, '0')}).
              </li>
              <li>
                O utilizador pode <strong className="text-white/80">SWAP OLEXP → SPOT</strong> (antecipado) ou resgatar no vencimento; o
                yield já creditado permanece no SPOT.
              </li>
              <li>
                <strong className="text-white/80">Mínimo SWAP OLEXP → SPOT:</strong>{' '}
                {OLEXP_SWAP_OLEXP_TO_SPOT_MIN_BRO_CENTS / 100} BRO de principal por posição (produto).
              </li>
            </ul>
          </div>

          <section className="rounded-xl border border-cyan-500/25 bg-cyan-950/15 p-4">
            <h3 className="mb-2 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-cyan-200">
              <CalendarRange className="h-4 w-4" />
              Previsão de vencimentos (principal a liquidar)
            </h3>
            <p className="mb-3 text-xs text-white/45">
              Referência <span className="font-mono text-white/60">{forecastToday}</span> — agrupa posições{' '}
              <strong className="text-white/70">activas</strong> e <strong className="text-white/70">vencidas não resgatadas</strong> por
              mês de fim de prazo. Estimativas de yield restante usam a mesma taxa diária do plano (ordem de grandeza).
            </p>
            {maturityBuckets.length === 0 ? (
              <p className="text-sm text-white/35">Sem vencimentos futuros na lista actual.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] uppercase text-white/40">
                      <th className="py-2 pr-2">Mês (vencimento)</th>
                      <th className="py-2 pr-2">Posições</th>
                      <th className="py-2">Σ principal (BRO)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maturityBuckets.map((b) => (
                      <tr key={b.monthKey} className="border-b border-white/5">
                        <td className="py-2 pr-2 font-medium text-white/85">{b.label}</td>
                        <td className="py-2 pr-2 text-white/55">{b.positionCount}</td>
                        <td className="py-2 font-mono text-cyan-200">{formatBroFromCents(b.principalCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
            <h3 className="mb-2 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-violet-200">
              <TrendingUp className="h-4 w-4" />
              Posições de custódia (detalhe)
            </h3>
            <p className="mb-3 text-xs text-white/45">
              Cada linha é uma custódia na visão plataforma. <strong className="text-white/70">Aguarda activação</strong> não entra no
              saldo trancado até confirmares. Importar sessão local sincroniza o utilizador <code className="text-neon-yellow/80">save-local</code>.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-[11px]">
                <thead>
                  <tr className="border-b border-white/10 text-[9px] uppercase text-white/40">
                    <th className="px-2 py-2">Cliente</th>
                    <th className="px-2 py-2">Principal</th>
                    <th className="px-2 py-2">Plano</th>
                    <th className="px-2 py-2">Estado custódia</th>
                    <th className="px-2 py-2">Vencimento</th>
                    <th className="px-2 py-2">Dias</th>
                    <th className="px-2 py-2">Yield acc.</th>
                    <th className="px-2 py-2">Est. yield rest.</th>
                    <th className="px-2 py-2">Pag. principal</th>
                    <th className="px-2 py-2">Acções</th>
                  </tr>
                </thead>
                <tbody>
                  {olexpSorted.map((p) => {
                    const estRem = estimateRemainingYieldCents(p, forecastToday);
                    const dLeft = daysUntilEnd(p, forecastToday);
                    const payPr = forecastPrincipalPayoutCents(p);
                    return (
                      <tr key={p.id} className="border-b border-white/5">
                        <td className="px-2 py-2 text-white/85">
                          {resolveFiatTargetLabel(p.userId, userLabelMap)}
                          <span className="block font-mono text-[9px] text-white/30">{p.id.slice(0, 14)}…</span>
                        </td>
                        <td className="px-2 py-2 font-mono text-neon-yellow">{formatBroFromCents(p.principalCents)}</td>
                        <td className="px-2 py-2 text-white/70">{olexpPlanLabel(p.planId)}</td>
                        <td className="px-2 py-2">
                          <span
                            className={cn(
                              'rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase',
                              custodyStatusBadge(p.status),
                            )}
                          >
                            {custodyStatusLabel(p.status)}
                          </span>
                        </td>
                        <td className="px-2 py-2 font-mono text-white/55">{p.status === 'pending_activation' ? '—' : p.endDate}</td>
                        <td className="px-2 py-2 text-white/50">{dLeft == null ? '—' : `${dLeft}d`}</td>
                        <td className="px-2 py-2 font-mono">{formatBroFromCents(p.yieldAccruedCents)}</td>
                        <td className="px-2 py-2 font-mono text-white/55">
                          {estRem == null ? '—' : formatBroFromCents(estRem)}
                        </td>
                        <td className="px-2 py-2 font-mono text-cyan-200/90">
                          {payPr > 0 ? formatBroFromCents(payPr) : '—'}
                        </td>
                        <td className="px-2 py-2">
                          {p.status === 'pending_activation' ? (
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                onClick={() => platformDispatch({ type: 'ACTIVATE_OLEXP_CUSTODY', positionId: p.id })}
                                className="rounded bg-neon-yellow px-2 py-1 text-[9px] font-black uppercase text-black hover:bg-white"
                              >
                                Activar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm('Rejeitar e remover este pedido de custódia?')) {
                                    platformDispatch({ type: 'REJECT_OLEXP_CUSTODY', positionId: p.id });
                                  }
                                }}
                                className="rounded border border-white/20 px-2 py-1 text-[9px] font-bold uppercase text-white/70 hover:bg-white/10"
                              >
                                Rejeitar
                              </button>
                            </div>
                          ) : (
                            <span className="text-white/25">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {olexpSorted.length === 0 && (
                <p className="p-6 text-center text-sm text-white/40">Sem posições na plataforma. Importa a sessão ou regista um pedido.</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="mb-3 font-display text-xs font-bold uppercase tracking-widest text-white/70">
              Novo pedido (pendente de activação)
            </h3>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-[10px] font-bold uppercase text-white/40">
                Utilizador
                <select
                  value={custodyUserId || platform.users[0]?.id || ''}
                  onChange={(e) => setCustodyUserId(e.target.value)}
                  className="mt-1 block min-w-[12rem] rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                >
                  {(Array.isArray(platform.users) ? platform.users : []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName} — {u.clubShort}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] font-bold uppercase text-white/40">
                Plano
                <select
                  value={custodyPlanId}
                  onChange={(e) => setCustodyPlanId(e.target.value as OlexpPlanId)}
                  className="mt-1 block rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                >
                  {OLEXP_PLANS.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] font-bold uppercase text-white/40">
                Principal (BRO)
                <input
                  value={custodyBro}
                  onChange={(e) => setCustodyBro(e.target.value)}
                  placeholder={`mín. ${custodyPlanMeta.minBroCents / 100} BRO`}
                  className="mt-1 block w-32 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="min-w-[8rem] flex-1 text-[10px] font-bold uppercase text-white/40">
                Nota
                <input
                  value={custodyNote}
                  onChange={(e) => setCustodyNote(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <button
                type="button"
                onClick={registerCustodyPending}
                className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-black uppercase text-white hover:bg-violet-500"
              >
                Registar pendente
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
            <h3 className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-violet-200">
              Resumo por utilizador
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase text-white/40">
                    <th className="py-2 pr-2">Utilizador</th>
                    <th className="py-2 pr-2">Principal</th>
                    <th className="py-2 pr-2">Yield acc.</th>
                    <th className="py-2">Conta</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(platform.users) ? platform.users : []).map((u) => (
                    <tr key={u.id} className="border-b border-white/5">
                      <td className="py-2 pr-2 text-white/85">
                        {u.displayName}
                        <span className="block text-[10px] text-white/35">{u.clubShort}</span>
                      </td>
                      <td className="py-2 pr-2 font-mono text-neon-yellow">
                        {formatBroFromCents(u.olexpPrincipalLockedCents)}
                      </td>
                      <td className="py-2 pr-2 font-mono">{formatBroFromCents(u.olexpYieldAccruedCents)}</td>
                      <td className="py-2 uppercase text-white/50">{u.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="rounded-xl border border-dashed border-white/20 bg-black/30 p-4">
            <h3 className="mb-3 font-display text-xs font-bold uppercase tracking-widest text-white/60">
              Sessão local — operações técnicas
            </h3>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-neon-yellow" />
                <span className="text-sm text-white/80">KYC OLEXP</span>
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-[10px] font-bold uppercase',
                    wallet.kycOlexpDone ? 'bg-neon-green/20 text-neon-green' : 'bg-red-500/20 text-red-300',
                  )}
                >
                  {wallet.kycOlexpDone ? 'OK' : 'Pendente'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => gameDispatch({ type: 'ADMIN_SET_WALLET_KYC', kycOlexpDone: true })}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold uppercase text-white hover:bg-white/20"
              >
                Forçar KYC
              </button>
              <button
                type="button"
                onClick={() => gameDispatch({ type: 'ADMIN_SET_WALLET_KYC', kycOlexpDone: false })}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold uppercase text-white/60 hover:bg-white/10"
              >
                Repor pendente
              </button>
            </div>

            <div className="mb-4 flex flex-wrap items-end gap-3">
              <label className="text-[10px] font-bold uppercase text-white/40">
                Data accrual
                <input
                  type="date"
                  value={accrualDate}
                  onChange={(e) => setAccrualDate(e.target.value)}
                  className="mt-1 block rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <button
                type="button"
                onClick={() => gameDispatch({ type: 'WALLET_ACCRUE_DAILY', dateIso: accrualDate })}
                className="flex items-center gap-2 rounded-lg bg-neon-yellow px-4 py-2 text-xs font-black uppercase text-black hover:bg-white"
              >
                <CalendarClock className="h-4 w-4" />
                Accrual na sessão
              </button>
              <span className="text-[10px] text-white/35">
                UTC {String(DAILY_ACCRUE_HOUR).padStart(2, '0')}:{String(DAILY_ACCRUE_MINUTE).padStart(2, '0')} — job
                referência
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase text-white/40">
                    <th className="px-2 py-2">Plano</th>
                    <th className="px-2 py-2">Principal</th>
                    <th className="px-2 py-2">Yield acc.</th>
                    <th className="px-2 py-2">Estado</th>
                    <th className="px-2 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {wallet.olexpPositions.map((p) => (
                    <tr key={p.id} className="border-b border-white/5">
                      <td className="px-2 py-2 text-white/80">{olexpPlanLabel(p.planId)}</td>
                      <td className="px-2 py-2 font-mono text-neon-yellow">{formatBroFromCents(p.principalCents)}</td>
                      <td className="px-2 py-2 font-mono">{formatBroFromCents(p.yieldAccruedCents)}</td>
                      <td className="px-2 py-2 uppercase">{p.status}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          {p.status === 'matured' && (
                            <button
                              type="button"
                              onClick={() => gameDispatch({ type: 'WALLET_CLAIM_OLEXP', positionId: p.id })}
                              className="rounded bg-violet-600 px-2 py-1 text-[10px] font-bold uppercase text-white hover:bg-violet-500"
                            >
                              Resgatar
                            </button>
                          )}
                          {p.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => gameDispatch({ type: 'WALLET_OLEXP_EARLY_TO_SPOT', positionId: p.id })}
                              className="rounded border border-white/20 px-2 py-1 text-[10px] font-bold uppercase text-white/80 hover:bg-white/10"
                            >
                              Early
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {wallet.olexpPositions.length === 0 && (
                <p className="p-6 text-center text-sm text-white/40">Sem posições na sessão local.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {sub === 'extrato' && (
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-sky-300">
              Ledger plataforma (Admin)
            </h3>
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={copyPlatformLedger}
                className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-bold uppercase text-white/70 hover:bg-white/10"
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
                Copiar JSON
              </button>
            </div>
            <div className="max-h-[320px] overflow-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-black/90">
                  <tr className="border-b border-white/10 text-[9px] uppercase text-white/45">
                    <th className="px-2 py-2">Data</th>
                    <th className="px-2 py-2">Tipo</th>
                    <th className="px-2 py-2">Alvo</th>
                    <th className="px-2 py-2">Δ BRO</th>
                    <th className="px-2 py-2">Esteira</th>
                  </tr>
                </thead>
                <tbody>
                  {platformLedgerSorted.map((l) => (
                    <tr key={l.id} className="border-b border-white/5">
                      <td className="px-2 py-1.5 text-white/55">{fmtIsoDate(l.createdAt)}</td>
                      <td className="px-2 py-1.5">
                        <span className={cn('rounded border px-1.5 py-0.5 text-[9px] font-bold', badgePlatformKind(l.kind))}>
                          {l.kind}
                        </span>
                      </td>
                      <td className="max-w-[120px] truncate px-2 py-1.5 text-white/45" title={l.target}>
                        {l.target}
                      </td>
                      <td
                        className={cn(
                          'px-2 py-1.5 font-mono',
                          l.broCentsDelta < 0 ? 'text-rose-300' : 'text-emerald-300',
                        )}
                      >
                        {l.broCentsDelta > 0 ? '+' : ''}
                        {formatBroFromCents(l.broCentsDelta)}
                      </td>
                      <td className="px-2 py-1.5">
                        {l.kind === 'fiat_deposit' || l.kind === 'fiat_withdrawal' ? (
                          <span
                            className={cn(
                              'rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase',
                              badgeFlowStatus(l.flowStatus),
                            )}
                          >
                            {l.flowStatus === 'processing' ? 'Proc.' : l.flowStatus === 'failed' ? 'Falha' : 'OK'}
                          </span>
                        ) : (
                          <span className="text-white/25">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {platformLedgerSorted.length === 0 && (
                <p className="p-8 text-center text-sm text-white/40">Sem linhas na ledger da plataforma.</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-white/50">
              Extrato técnico — sessão local (wallet reducer)
            </h3>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <select
                value={ledgerType}
                onChange={(e) => setLedgerType(e.target.value as WalletLedgerType | '')}
                className="rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-xs text-white"
              >
                {LEDGER_FILTER_OPTS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                value={ledgerCur}
                onChange={(e) => setLedgerCur(e.target.value as WalletCurrencyExt | '')}
                className="rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-xs text-white"
              >
                <option value="">Todas moedas</option>
                <option value="BRO">BRO</option>
                <option value="EXP">EXP</option>
                <option value="OLEXP">OLEXP</option>
                <option value="GAT">GAT</option>
              </select>
              <button
                type="button"
                onClick={copySessionLedger}
                className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-bold uppercase text-white/70 hover:bg-white/10"
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
                Copiar JSON
              </button>
              <span className="text-[10px] text-white/35">{ledgerSorted.length} linhas</span>
            </div>

            <div className="mt-2 max-h-[360px] overflow-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-black/90">
                  <tr className="border-b border-white/10 text-[9px] uppercase text-white/45">
                    <th className="px-2 py-2">Data</th>
                    <th className="px-2 py-2">Tipo</th>
                    <th className="px-2 py-2">Moeda</th>
                    <th className="px-2 py-2">Montante</th>
                    <th className="px-2 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerSorted.map((e) => (
                    <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-2 py-1.5 whitespace-nowrap text-white/55">{fmtIsoDate(e.createdAt)}</td>
                      <td className="px-2 py-1.5">
                        <span className={cn('rounded border px-1.5 py-0.5 text-[9px] font-bold', badgeLedger(e.type))}>
                          {e.type}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 font-mono">{e.currency}</td>
                      <td className={cn('px-2 py-1.5 font-mono', e.amount < 0 ? 'text-rose-300' : 'text-emerald-300')}>
                        {e.currency === 'BRO' || e.currency === 'GAT' ? (
                          <>
                            {e.amount > 0 ? '+' : ''}
                            {formatBroFromCents(e.amount)}
                          </>
                        ) : e.currency === 'EXP' ? (
                          <>
                            {e.amount < 0 ? '−' : e.amount > 0 ? '+' : ''}
                            {formatExp(Math.abs(e.amount))} EXP
                          </>
                        ) : (
                          e.amount
                        )}
                      </td>
                      <td className="px-2 py-1.5">{e.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ledgerSorted.length === 0 && (
                <p className="p-8 text-center text-sm text-white/40">Nenhum movimento com estes filtros.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
