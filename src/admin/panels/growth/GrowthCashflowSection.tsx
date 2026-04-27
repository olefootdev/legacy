import { useMemo, useState } from 'react';
import { Repeat, Trash2, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CashflowExpenseCategory } from '@/admin/platformTypes';
import { useAdminPlatformDispatch, useAdminPlatformStore } from '@/admin/platformStore';
import {
  cashflowBrlToBroCentsApprox,
  cashflowTotalsByCategory,
  commerceTotals,
  filterLedgerCompletedFiat,
  formatBrlFromCents,
  growthTimeRange,
  sumCashflowBrlCents,
  sumFiatDepositsCents,
  type GrowthRangePreset,
} from '@/admin/growthMetrics';
import { formatBroFromCents } from '@/systems/economy';

const CAT_LABEL: Record<CashflowExpenseCategory, string> = {
  pessoas: 'Pessoas',
  infra: 'Infra / cloud',
  marketing: 'Marketing',
  legal: 'Legal / contabilidade',
  ferramentas: 'Ferramentas / SaaS',
  impostos: 'Impostos / taxas',
  outro: 'Outro',
};

function brlInputToCents(s: string): number | null {
  const t = s.replace(/\s/g, '').replace(',', '.').trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function GrowthCashflowSection({
  preset,
}: {
  preset: GrowthRangePreset;
}) {
  const platform = useAdminPlatformStore((s) => s);
  const dispatch = useAdminPlatformDispatch();
  const range = useMemo(() => growthTimeRange(preset), [preset]);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<CashflowExpenseCategory>('outro');
  const [amountBrl, setAmountBrl] = useState('');
  const [note, setNote] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [fxInput, setFxInput] = useState(() =>
    platform.growthBroCentsPerBrl != null ? String(platform.growthBroCentsPerBrl / 100) : '',
  );

  const expenses = platform.growthCashflowExpenses ?? [];
  const fx = platform.growthBroCentsPerBrl;

  const periodExpensesBrl = useMemo(
    () => sumCashflowBrlCents(expenses, range.start, range.end),
    [expenses, range.start, range.end],
  );
  const byCat = useMemo(
    () => cashflowTotalsByCategory(expenses, range.start, range.end),
    [expenses, range.start, range.end],
  );

  const revenueProxy = useMemo(() => {
    const fiat = filterLedgerCompletedFiat(platform.platformLedger, range.start, range.end);
    const dep = sumFiatDepositsCents(fiat);
    const com = commerceTotals(platform.growthCommerceLines, range.start, range.end);
    return dep + com.revenueCents;
  }, [platform, range.start, range.end]);

  const opexBroApprox = cashflowBrlToBroCentsApprox(periodExpensesBrl, fx);
  const netApprox = opexBroApprox != null ? revenueProxy - opexBroApprox : null;

  const sorted = useMemo(
    () => [...expenses].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [expenses],
  );

  const addExpense = () => {
    const cents = brlInputToCents(amountBrl);
    if (cents == null || cents <= 0 || !label.trim()) return;
    dispatch({
      type: 'ADD_CASHFLOW_EXPENSE',
      expense: {
        date,
        label: label.trim(),
        category,
        amountBrlCents: cents,
        note: note.trim() || undefined,
        recurring: recurring || undefined,
        endDate: recurring && endDate ? endDate : undefined,
      },
    });
    setLabel('');
    setAmountBrl('');
    setNote('');
    setRecurring(false);
    setEndDate('');
  };

  const saveFx = () => {
    const t = fxInput.replace(',', '.').trim();
    if (!t) {
      dispatch({ type: 'SET_GROWTH_BRO_CENTS_PER_BRL', value: null });
      return;
    }
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0) return;
    dispatch({ type: 'SET_GROWTH_BRO_CENTS_PER_BRL', value: Math.round(n * 100) });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100/90">
        <div className="flex items-start gap-2">
          <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          <div>
            <strong className="text-white">Cashflow (R$)</strong>
            <p className="mt-1 text-xs text-white/50">
              Regista os gastos operacionais reais da empresa. A receita do painel continua em <strong>BRO</strong>{' '}
              (proxy do ecossistema). Opcionalmente define uma taxa de referência para um cruzamento **indicativo**.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/30 p-4 lg:col-span-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40">Novo gasto</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-xs">
              <span className="text-white/45">Data</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="text-white/45">Categoria</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CashflowExpenseCategory)}
                className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
              >
                {(Object.keys(CAT_LABEL) as CashflowExpenseCategory[]).map((k) => (
                  <option key={k} value={k}>
                    {CAT_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-xs sm:col-span-2">
              <span className="text-white/45">Descrição</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex.: Hetzner, Google Ads, contador…"
                className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/25"
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="text-white/45">Valor (R$)</span>
              <input
                value={amountBrl}
                onChange={(e) => setAmountBrl(e.target.value)}
                placeholder="120,50"
                className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/25"
              />
            </label>
            <label className="block space-y-1 text-xs sm:col-span-2">
              <span className="text-white/45">Nota (opcional)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/25"
              />
            </label>
            <div className="flex items-center gap-3 sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-black/50 text-neon-yellow accent-[#EAFF00]"
                />
                <span className="flex items-center gap-1 text-white/60">
                  <Repeat className="h-3.5 w-3.5" />
                  Recorrente mensal
                </span>
              </label>
              {recurring && (
                <label className="flex items-center gap-2 text-xs">
                  <span className="text-white/45">Até</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-sm text-white"
                    placeholder="Sem fim"
                  />
                  <span className="text-[10px] text-white/30">(vazio = indefinido)</span>
                </label>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={addExpense}
            className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-white/15"
          >
            Adicionar despesa
          </button>
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40">Taxa referência</h3>
          <p className="text-[11px] text-white/40">
            Quantos <strong className="text-white/60">BRO</strong> (unidade do jogo) equivalem a <strong>1,00 BRL</strong>.
            Ex.: <strong>0,5</strong> → guardamos 50 centavos de BRO por cada real (valor interno).
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={fxInput}
              onChange={(e) => setFxInput(e.target.value)}
              placeholder="ex.: 0,5"
              className="min-w-[120px] flex-1 rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              onClick={saveFx}
              className="rounded-lg border border-neon-yellow/40 px-3 py-2 text-xs font-bold text-neon-yellow hover:bg-neon-yellow/10"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                setFxInput('');
                dispatch({ type: 'SET_GROWTH_BRO_CENTS_PER_BRL', value: null });
              }}
              className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/50 hover:bg-white/10"
            >
              Limpar
            </button>
          </div>
          {fx != null ? (
            <p className="text-[11px] text-white/45">
              Activo: <span className="font-mono text-neon-yellow/80">{fx}</span> cBRO / 1 BRL
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Despesas (período)</p>
          <p className="mt-1 font-display text-xl font-black text-white">{formatBrlFromCents(periodExpensesBrl)}</p>
          <p className="text-[11px] text-white/40">{range.label} · UTC</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Receita proxy (BRO)</p>
          <p className="mt-1 font-display text-xl font-black text-neon-yellow/90">
            {formatBroFromCents(revenueProxy)}
          </p>
          <p className="text-[11px] text-white/40">Depósitos + comércio</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Opex aprox. (BRO)</p>
          <p className="mt-1 font-display text-xl font-black text-white">
            {opexBroApprox != null ? formatBroFromCents(opexBroApprox) : '—'}
          </p>
          <p className="text-[11px] text-white/40">Só com taxa referência</p>
        </div>
        <div
          className={cn(
            'rounded-xl border p-4',
            netApprox != null && netApprox < 0
              ? 'border-rose-500/35 bg-rose-500/10'
              : 'border-emerald-500/35 bg-emerald-500/10',
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Saldo indicativo</p>
          <p className="mt-1 font-display text-xl font-black text-white">
            {netApprox != null ? formatBroFromCents(netApprox) : '—'}
          </p>
          <p className="text-[11px] text-white/40">Receita proxy − opex (aprox.)</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40">Por categoria (período)</h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(byCat) as CashflowExpenseCategory[]).map((k) =>
            byCat[k] > 0 ? (
              <li
                key={k}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80"
              >
                {CAT_LABEL[k]}: <strong>{formatBrlFromCents(byCat[k])}</strong>
              </li>
            ) : null,
          )}
        </ul>
      </div>

      <div className="ole-scroll-x rounded-xl border border-white/10">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/40">
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Descrição</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Valor</th>
              <th className="px-3 py-2 w-24" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-white/40">
                  Sem despesas registadas. Adiciona acima para cruzar com a receita.
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr key={row.id} className="border-b border-white/5 text-white/80">
                  <td className="px-3 py-2 font-mono text-white/60">{row.date}</td>
                  <td className="px-3 py-2">
                    {row.label}
                    {row.note ? <span className="mt-0.5 block text-[10px] text-white/35">{row.note}</span> : null}
                  </td>
                  <td className="px-3 py-2">{CAT_LABEL[row.category]}</td>
                  <td className="px-3 py-2">
                    {row.recurring ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-sky-400/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                        <Repeat className="h-3 w-3" />
                        Mensal
                        {row.endDate ? (
                          <span className="text-sky-300/60"> até {row.endDate}</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/30">Avulso</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono">{formatBrlFromCents(row.amountBrlCents)}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'REMOVE_CASHFLOW_EXPENSE', id: row.id })}
                      className="rounded p-1 text-rose-300/80 hover:bg-rose-500/20"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
