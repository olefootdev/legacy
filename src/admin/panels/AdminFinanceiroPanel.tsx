import { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Filter,
  Landmark,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useGameStore } from '@/game/store';
import { formatBroFromCents, formatExp } from '@/systems/economy';
import { normalizeWalletState } from '@/wallet/initial';
import { queryLedger } from '@/wallet/ledger';
import type { WalletLedgerEntry, WalletLedgerType, WalletCurrencyExt } from '@/wallet/types';
import { cn } from '@/lib/utils';
import {
  computePlatformAggregate,
  useAdminPlatformDispatch,
  useAdminPlatformStore,
} from '@/admin/platformStore';
import type { FiatPipelineStatus, PlatformLedgerLine } from '@/admin/platformTypes';
import { getSupabase } from '@/supabase/client';

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
  { value: 'SPOT_BRO', label: 'SPOT BRO' },
  { value: 'TRANSFER', label: 'Transferência' },
];

function badgeLedger(type: string | undefined): string {
  if (!type || typeof type !== 'string') return 'bg-white/10 text-gray-300 border-white/15';
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

type Sub = 'visao' | 'depositos_saques' | 'extrato' | 'creditar';

export function AdminFinanceiroPanel() {
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
  const [treasuryEdit, setTreasuryEdit] = useState('');
  const [escrowEdit, setEscrowEdit] = useState('');

  // Creditar BRO e/ou EXP via Supabase (depósito confirmado)
  const [creditUserId, setCreditUserId] = useState('');
  const [creditBro, setCreditBro] = useState('');
  const [creditExp, setCreditExp] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [creditStatus, setCreditStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [creditMsg, setCreditMsg] = useState('');

  const handleCreditBro = async () => {
    const cents = broInputToCents(creditBro);
    const expAmount = Math.round(Number(creditExp.replace(/\s/g, '').replace(',', '.')) || 0);
    if (!creditUserId.trim() || (!cents && !expAmount)) {
      setCreditStatus('err');
      setCreditMsg('user_id e pelo menos um valor (BRO ou EXP) são obrigatórios.');
      return;
    }
    const sb = getSupabase();
    if (!sb) {
      setCreditStatus('err');
      setCreditMsg('Supabase não configurado.');
      return;
    }
    setCreditStatus('loading');
    const { error } = await sb.from('wallet_credits').insert({
      user_id: creditUserId.trim(),
      bro_cents: cents || 0,
      exp_amount: expAmount,
      reason: creditReason.trim() || 'Crédito confirmado pelo admin',
    });
    if (error) {
      setCreditStatus('err');
      setCreditMsg(error.message);
    } else {
      const parts = [];
      if (cents) parts.push(`${formatBroFromCents(cents)} BRO`);
      if (expAmount) parts.push(`${expAmount.toLocaleString('pt-BR')} EXP`);
      setCreditStatus('ok');
      setCreditMsg(`✓ ${parts.join(' + ')} creditados. O jogador receberá ao próximo login.`);
      setCreditUserId('');
      setCreditBro('');
      setCreditExp('');
      setCreditReason('');
    }
  };

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

      <div className="flex flex-wrap gap-2">
        {subNav('visao', 'Visão geral', Banknote)}
        {subNav('depositos_saques', 'Depósitos & saques', Landmark)}
        {subNav('extrato', 'Extrato & filtros', Filter)}
        {subNav('creditar', 'Creditar BRO', Wallet)}
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

      <div className="grid gap-3 sm:grid-cols-2">
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
                <strong className="text-white/85">Próximo passo backend:</strong> substituir{' '}
                <code className="text-neon-yellow/80">olefoot-admin-platform-v1</code> por API e sincronizar com KYC/PSP.
              </li>
            </ul>
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
                        {e.currency === 'BRO' ? (
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

      {sub === 'creditar' && (
        <div className="space-y-4">
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
            <h3 className="font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
              Creditar BRO / EXP — depósito confirmado
            </h3>
            <p className="text-[11px] text-white/45">
              Insere um crédito na tabela <code>wallet_credits</code> do Supabase.
              O jogador recebe o saldo na próxima vez que abrir o jogo.
            </p>

            <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-white/45">
              User ID (UUID do Supabase)
              <input
                type="text"
                value={creditUserId}
                onChange={(e) => setCreditUserId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="rounded-lg border border-white/15 bg-black/50 px-3 py-2 font-mono text-xs text-white placeholder:text-white/20"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-white/45">
                Valor BRO (opcional)
                <input
                  type="text"
                  value={creditBro}
                  onChange={(e) => setCreditBro(e.target.value)}
                  placeholder="ex: 50.00"
                  className="rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/20"
                />
              </label>

              <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-white/45">
                Valor EXP (opcional)
                <input
                  type="text"
                  value={creditExp}
                  onChange={(e) => setCreditExp(e.target.value)}
                  placeholder="ex: 500000"
                  className="rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/20"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-white/45">
              Motivo (opcional)
              <input
                type="text"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder="ex: Depósito PIX R$50 — comprovante #123"
                className="rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/20"
              />
            </label>

            <button
              type="button"
              onClick={() => { void handleCreditBro(); }}
              disabled={creditStatus === 'loading'}
              className="rounded-lg bg-neon-yellow px-4 py-2 text-xs font-bold uppercase text-black hover:bg-yellow-300 disabled:opacity-50"
            >
              {creditStatus === 'loading' ? 'A processar…' : 'Emitir crédito'}
            </button>

            {creditStatus === 'ok' && (
              <p className="text-xs font-bold text-green-400">{creditMsg}</p>
            )}
            {creditStatus === 'err' && (
              <p className="text-xs font-bold text-red-400">{creditMsg}</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
