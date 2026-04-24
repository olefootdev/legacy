import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, UserSearch, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  DEFAULT_SPLIT,
  isSplitValid,
  splitTotal,
  type PaymentSplitEntry,
} from '@/admin/playerLinking';
import { adminListProfiles, type AdminProfileRow } from '@/supabase/adminCore';
import { cn } from '@/lib/utils';

export interface PlayerLinkEditorValue {
  beneficiaryUserId: string | null;
  beneficiaryLabel: string | null;
  split: PaymentSplitEntry[];
}

export const DEFAULT_LINK_VALUE: PlayerLinkEditorValue = {
  beneficiaryUserId: null,
  beneficiaryLabel: null,
  split: DEFAULT_SPLIT,
};

/** Editor visual de beneficiário + split. Não persiste — devolve estado pro caller. */
export function PlayerLinkEditor({
  value,
  onChange,
}: {
  value: PlayerLinkEditorValue;
  onChange: (next: PlayerLinkEditorValue) => void;
}) {
  const total = splitTotal(value.split);
  const valid = isSplitValid(value.split);
  const playerEntry = value.split.find((e) => e.kind === 'player');
  const facilitatorEntries = value.split.filter((e) => e.kind === 'facilitator');
  const olefootEntry = value.split.find((e) => e.kind === 'olefoot');
  const facilitatorTotal = facilitatorEntries.reduce((a, e) => a + (Number(e.percent) || 0), 0);

  const setPlayerUser = (userId: string | null, label: string | null) => {
    const next = value.split.map((e) =>
      e.kind === 'player' ? { ...e, user_id: userId, label: label ? `Jogador · ${label}` : 'Jogador' } : e,
    );
    onChange({ ...value, beneficiaryUserId: userId, beneficiaryLabel: label, split: next });
  };

  const setFacilitatorUser = (idx: number, userId: string | null, label: string | null) => {
    let i = -1;
    const next = value.split.map((e) => {
      if (e.kind !== 'facilitator') return e;
      i += 1;
      return i === idx ? { ...e, user_id: userId, label: label ? `Facilitador · ${label}` : 'Facilitador' } : e;
    });
    onChange({ ...value, split: next });
  };

  const setFacilitatorPct = (idx: number, pct: number) => {
    // Dentro dos 10% facilitador, redistribuir os pcts entre os facilitadores.
    const total10 = 10;
    const bounded = Math.max(0, Math.min(total10, pct));
    let i = -1;
    const current = facilitatorEntries.length;
    const next = value.split.map((e) => {
      if (e.kind !== 'facilitator') return e;
      i += 1;
      if (i === idx) return { ...e, percent: bounded };
      return e;
    });
    // Recalcula pro lower index ajustar: se soma > 10, ajusta proporcional os outros; se < 10 e houver 1 só, força 10.
    const others = next.filter((e) => e.kind === 'facilitator' && next.indexOf(e) !== next.findIndex((x) => x === next.find((_, ii) => ii === idx)));
    // Simpler: keep user-entered values, show warning if doesn't sum to 10. We validate in save.
    void others;
    void current;
    onChange({ ...value, split: next });
  };

  const addFacilitator = () => {
    // Reduz split do primeiro facilitador pela metade, e cria um novo com o resto.
    const fac0 = facilitatorEntries[0];
    if (!fac0) return;
    const half = Math.round((fac0.percent / 2) * 100) / 100;
    const rest = Math.round((fac0.percent - half) * 100) / 100;
    let replaced = false;
    const next: PaymentSplitEntry[] = [];
    for (const e of value.split) {
      if (!replaced && e.kind === 'facilitator') {
        next.push({ ...e, percent: half });
        replaced = true;
        next.push({ kind: 'facilitator', user_id: null, label: 'Facilitador', percent: rest });
      } else {
        next.push(e);
      }
    }
    onChange({ ...value, split: next });
  };

  const removeFacilitator = (idx: number) => {
    if (facilitatorEntries.length <= 1) return;
    let i = -1;
    const target = facilitatorEntries[idx];
    const others = value.split.filter((e) => {
      if (e.kind !== 'facilitator') return true;
      i += 1;
      return i !== idx;
    });
    // Distribui a % do removido entre os facilitadores restantes.
    const remainingFacilitators = others.filter((e) => e.kind === 'facilitator');
    const addEach = target ? target.percent / remainingFacilitators.length : 0;
    const next = others.map((e) =>
      e.kind === 'facilitator' ? { ...e, percent: Math.round((e.percent + addEach) * 100) / 100 } : e,
    );
    onChange({ ...value, split: next });
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="font-display text-[10px] font-black uppercase tracking-widest text-neon-yellow/90">
          Vinculação & Split de pagamento
        </p>
        <p className="mt-0.5 text-[11px] text-white/55">
          50% vai pro jogador · 10% pra facilitadores · 40% sempre pra Olefoot. Os 10% dos facilitadores podem ser
          divididos entre várias pessoas.
        </p>
      </div>

      {/* Jogador beneficiário */}
      <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-display text-[10px] font-bold uppercase tracking-wider text-white/70">
              Jogador (beneficiário principal)
            </p>
            <p className="text-[10px] text-white/40">50% de cada venda</p>
          </div>
          <SplitPctField value={playerEntry?.percent ?? 50} disabled />
        </div>
        <UserPicker
          label="Buscar jogador"
          selectedId={value.beneficiaryUserId}
          selectedLabel={value.beneficiaryLabel}
          onPick={(u) => setPlayerUser(u?.id ?? null, u?.display_name ?? u?.club_name ?? null)}
        />
      </div>

      {/* Facilitadores (10%) */}
      <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-display text-[10px] font-bold uppercase tracking-wider text-white/70">
              Facilitador(es)
            </p>
            <p className="text-[10px] text-white/40">
              Total alocado: {Math.round(facilitatorTotal * 100) / 100}% de 10%
            </p>
          </div>
          <button
            type="button"
            onClick={addFacilitator}
            className="inline-flex items-center gap-1 rounded border border-neon-yellow/40 bg-neon-yellow/10 px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wider text-neon-yellow hover:bg-neon-yellow/20"
          >
            <Plus className="h-3 w-3" /> Adicionar
          </button>
        </div>
        <div className="space-y-2">
          {facilitatorEntries.map((entry, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded border border-white/5 bg-black/20 p-2">
              <div className="min-w-0 flex-1">
                <UserPicker
                  label="Facilitador"
                  selectedId={entry.user_id}
                  selectedLabel={entry.label.replace(/^Facilitador · /, '') || null}
                  onPick={(u) => setFacilitatorUser(idx, u?.id ?? null, u?.display_name ?? u?.club_name ?? null)}
                />
              </div>
              <SplitPctField value={entry.percent} onChange={(v) => setFacilitatorPct(idx, v)} />
              {facilitatorEntries.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeFacilitator(idx)}
                  className="shrink-0 rounded border border-rose-500/35 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20"
                  aria-label="Remover facilitador"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {Math.abs(facilitatorTotal - 10) > 0.01 ? (
          <p className="text-[10px] text-rose-300">
            ⚠ Soma dos facilitadores deve ser 10% (atual: {Math.round(facilitatorTotal * 100) / 100}%).
          </p>
        ) : null}
      </div>

      {/* Olefoot (40% fixo) */}
      <div className="rounded-lg border border-cyan-500/15 bg-cyan-500/[0.04] p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-display text-[10px] font-bold uppercase tracking-wider text-cyan-200/85">
              Olefoot (caixa)
            </p>
            <p className="text-[10px] text-white/40">Fixo — não alteável</p>
          </div>
          <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-xs font-bold text-cyan-200">
            {olefootEntry?.percent ?? 40}%
          </span>
        </div>
      </div>

      {/* Status total */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px]',
          valid ? 'border-neon-green/35 bg-neon-green/[0.06] text-neon-green' : 'border-rose-500/35 bg-rose-500/[0.06] text-rose-200',
        )}
      >
        {valid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
        Total: <strong>{Math.round(total * 100) / 100}%</strong> {valid ? '· ok' : '— deve ser 100%'}
      </div>
    </div>
  );
}

function SplitPctField({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange?: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={100}
        step={0.1}
        value={value}
        disabled={disabled || !onChange}
        onChange={(e) => onChange?.(Number(e.target.value))}
        className="w-16 rounded border border-white/15 bg-black/50 px-2 py-1 text-right font-mono text-xs text-white disabled:opacity-50"
      />
      <span className="font-mono text-[10px] text-white/50">%</span>
    </div>
  );
}

function UserPicker({
  label,
  selectedId,
  selectedLabel,
  onPick,
}: {
  label: string;
  selectedId: string | null;
  selectedLabel: string | null;
  onPick: (user: AdminProfileRow | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [profiles, setProfiles] = useState<AdminProfileRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (profiles.length > 0) return;
    setLoading(true);
    adminListProfiles()
      .then((list) => setProfiles(list))
      .finally(() => setLoading(false));
  }, [open, profiles.length]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return profiles.slice(0, 30);
    return profiles
      .filter(
        (p) =>
          (p.display_name ?? '').toLowerCase().includes(qq) ||
          (p.club_name ?? '').toLowerCase().includes(qq) ||
          p.id.toLowerCase().includes(qq),
      )
      .slice(0, 30);
  }, [q, profiles]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded border border-white/15 bg-black/40 px-2.5 py-1.5 text-left text-[11px] text-white hover:bg-white/5"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <UserSearch className="h-3 w-3 shrink-0 text-white/50" />
          <span className="truncate">{selectedLabel ?? <span className="text-white/40">{label} — nenhum</span>}</span>
        </span>
        {selectedId ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onPick(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onPick(null);
              }
            }}
            className="shrink-0 text-[9px] uppercase tracking-wider text-rose-300 hover:text-rose-100"
          >
            remover
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-white/15 bg-[#0a0a0a] shadow-2xl">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome, clube ou ID..."
            className="w-full border-b border-white/10 bg-black/50 px-3 py-2 text-xs text-white focus:outline-none"
          />
          <ul className="max-h-56 overflow-y-auto">
            {loading ? (
              <li className="px-3 py-4 text-center text-[11px] text-white/50">Carregando…</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-[11px] text-white/40">Nenhum usuário.</li>
            ) : (
              filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(p);
                      setOpen(false);
                    }}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-xs hover:bg-white/5"
                  >
                    <span className="font-bold text-white">{p.display_name ?? '(sem nome)'}</span>
                    <span className="text-[9px] text-white/50">
                      {p.club_name ?? '—'} · {p.id.slice(0, 8)}…
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
