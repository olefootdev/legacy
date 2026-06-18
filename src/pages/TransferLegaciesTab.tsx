import { useEffect, useMemo, useState } from 'react';
import { Crown, Coins, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import {
  fetchListedLegacyPlayerRows,
  legacyPortraitImageUrl,
  legacyPortraitFocusStyle,
  legacyRowToPlayerEntity,
  type LegacyPlayerRow,
} from '@/supabase/legacyPlayers';
import { recordMarketActivity } from '@/supabase/marketActivities';
import { getSupabase } from '@/supabase/client';

export function TransferLegaciesTab() {
  const dispatch = useGameDispatch();
  const oleBal = useGameStore((s) => s.finance.ole);
  const playersById = useGameStore((s) => s.players);
  const clubName = useGameStore((s) => s.club?.name ?? 'Manager');
  const [rows, setRows] = useState<LegacyPlayerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchListedLegacyPlayerRows().then((data) => {
      if (cancelled) return;
      setRows(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const owned = useMemo(() => {
    const set = new Set<string>();
    for (const pid of Object.keys(playersById)) if (pid.startsWith('legacy-')) set.add(pid);
    return set;
  }, [playersById]);

  const buy = async (row: LegacyPlayerRow) => {
    const entity = legacyRowToPlayerEntity(row);
    // price_bro_cents guarda o preço em OLEFOOT (=OLE, a moeda dos legacies).
    const priceOlefoot = Math.max(1, Math.round(row.price_bro_cents));
    if (owned.has(entity.id)) { window.alert('Você já possui esse legacy.'); return; }

    const apiBase = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_OLEFOOT_API_URL || 'http://localhost:4000';
    const serverUrl = apiBase !== 'http://localhost:4000' ? apiBase : null;
    const sb = getSupabase();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;

    if (serverUrl && token) {
      // Compra ATÔMICA no servidor: debita OLEFOOT (legacy_olefoot_credits) +
      // entrega o player (sem corrida). NÃO toca EXP (finance.ole).
      try {
        const r = await fetch(`${serverUrl}/api/market/buy-legacy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ legacy_id: row.id, player: entity }),
        });
        const data = await r.json().catch(() => null);
        if (!r.ok || !data?.ok) {
          window.alert(data?.error ?? 'Não foi possível comprar agora.');
          return;
        }
        // Servidor debitou o OLEFOOT — só entregamos o player no estado local
        // (ole = saldo atual, INALTERADO: a moeda do legacy é OLEFOOT, não EXP).
        dispatch({ type: 'CONFIRM_LEGACY_PURCHASE', player: entity, ole: oleBal });
      } catch {
        window.alert('Falha de conexão ao comprar. Tente de novo.');
        return;
      }
    } else {
      // Fallback (dev local sem server): mantém o fluxo client-side.
      dispatch({ type: 'BUY_LEGACY_PLAYER', player: entity, priceExp: priceOlefoot });
    }

    // Registra atividade pública no feed do mercado
    void (async () => {
      const userId = sb ? (await sb.auth.getSession()).data.session?.user.id : undefined;
      void recordMarketActivity({
        type: 'purchase',
        managerId: userId ?? null,
        managerName: clubName,
        clubName,
        playerName: entity.name,
        playerOvr: overallFromAttributes(entity.attrs),
        playerPos: entity.pos,
        priceExp: priceOlefoot,
      });
    })();
  };

  if (loading) {
    return <div className="py-10 text-center text-sm text-gray-500">Carregando legacies…</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-white/[0.02] py-12 text-center text-sm text-gray-500">
        Nenhum Legacy disponível no momento.
      </div>
    );
  }

  // Agrupa por COLEÇÃO (time/temporada). Vários jogadores da mesma coleção
  // (ex: FOGAO95 = Botafogo 1995) aparecem juntos sob um cabeçalho.
  const groups: Array<{ code: string; title: string; rows: LegacyPlayerRow[] }> = [];
  const groupIndex = new Map<string, number>();
  for (const row of rows) {
    const code = row.collection_code?.trim() || row.collection_id?.trim() || 'OUTROS';
    const title = row.collection_title?.trim() || code;
    let idx = groupIndex.get(code);
    if (idx === undefined) {
      idx = groups.length;
      groupIndex.set(code, idx);
      groups.push({ code, title, rows: [] });
    }
    groups[idx]!.rows.push(row);
  }

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.code} className="space-y-3">
          <div className="flex items-baseline justify-between gap-3 border-b border-amber-400/20 pb-1.5">
            <h3 className="font-display text-sm font-black uppercase tracking-wide text-amber-300">
              {g.title}
            </h3>
            <span className="text-[11px] text-white/45">
              {g.rows.length} {g.rows.length === 1 ? 'jogador' : 'jogadores'}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.rows.map((row) => (
              <LegacyCard key={row.id} row={row} oleBal={oleBal} owned={owned} onBuy={buy} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ── HERO CARD ──────────────────────────────────────────────────────────────
function HeroLegacyCard({
  row,
  oleBal,
  owned,
  onBuy,
}: {
  row: LegacyPlayerRow;
  oleBal: number;
  owned: Set<string>;
  onBuy: (row: LegacyPlayerRow) => void;
}) {
  const entity = legacyRowToPlayerEntity(row);
  const ovr = overallFromAttributes(entity.attrs);
  const portrait = legacyPortraitImageUrl(row);
  const priceExp = Math.max(1, Math.round(row.price_bro_cents));
  const isOwned = owned.has(entity.id);
  const canAfford = oleBal >= priceExp;
  const boosterEntries = Object.entries(row.team_booster ?? {});

  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-amber-400/50 bg-gradient-to-br from-amber-500/20 via-amber-600/[0.08] to-black p-5 sm:p-6 shadow-[0_0_40px_rgba(251,191,36,0.18)]">
      {/* Badge "Primeira lenda" */}
      <div className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-black">
        <Sparkles className="h-3 w-3" strokeWidth={2.5} />
        <span className="font-display text-[10px] font-black uppercase tracking-[0.18em]">
          Primeira lenda tokenizada
        </span>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {/* Card retangular (proporção do card colecionável Olefoot) */}
        <div className="shrink-0">
          {portrait ? (
            <img
              src={portrait}
              alt={entity.name}
              style={legacyPortraitFocusStyle(row)}
              className="aspect-[11/15.6] w-36 rounded-xl object-cover ring-2 ring-amber-400/60 sm:w-44"
            />
          ) : (
            <div className="grid aspect-[11/15.6] w-36 place-items-center rounded-xl bg-amber-500/20 text-amber-400 sm:w-44">
              <Crown className="h-12 w-12" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="mb-2 inline-flex items-center gap-1.5">
            <Crown className="h-3.5 w-3.5 text-amber-300" />
            <span className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
              Legacy DNA
            </span>
          </div>

          <h3 className="font-display text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
            {entity.name}
          </h3>

          <p className="mt-1 text-xs text-gray-400">
            {entity.pos} · OVR <span className="font-display font-black text-amber-300">{ovr}</span>
            {row.country ? ` · ${row.country}` : ''}
          </p>

          {row.bio && (
            <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-gray-300 sm:text-sm">
              {row.bio}
            </p>
          )}

          {/* Atributos ensinados */}
          {(row.taught_attributes?.length ?? 0) > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                Ensina
              </p>
              <div className="flex flex-wrap gap-1.5">
                {row.taught_attributes.map((a) => (
                  <span
                    key={a}
                    className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase text-amber-200"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Booster */}
          {boosterEntries.length > 0 && (
            <div className="mt-2.5">
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                Booster (titular)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {boosterEntries.map(([k, v]) => (
                  <span
                    key={k}
                    className="rounded-full bg-green-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase text-green-300"
                  >
                    {k} +{v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Preço + CTA */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-1.5 text-lg font-black text-neon-yellow sm:text-xl">
              <Coins className="h-5 w-5" />
              <span className="tabular-nums">{priceExp.toLocaleString('pt-BR')}</span>
              <span className="text-xs text-neon-yellow/70">OLE</span>
            </div>
            <button
              type="button"
              onClick={() => onBuy(row)}
              disabled={isOwned || !canAfford}
              className={cn(
                'rounded-xl px-6 py-3 font-display text-xs font-black uppercase tracking-[0.18em] transition-colors',
                isOwned
                  ? 'bg-white/5 text-gray-500'
                  : canAfford
                    ? 'bg-amber-400 text-black hover:bg-white'
                    : 'bg-white/5 text-gray-500',
              )}
            >
              {isOwned ? 'Adquirido' : canAfford ? 'Comprar lenda' : 'Sem saldo OLE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CARD NORMAL ────────────────────────────────────────────────────────────
function LegacyCard({
  row,
  oleBal,
  owned,
  onBuy,
}: {
  row: LegacyPlayerRow;
  oleBal: number;
  owned: Set<string>;
  onBuy: (row: LegacyPlayerRow) => void;
}) {
  const entity = legacyRowToPlayerEntity(row);
  const ovr = overallFromAttributes(entity.attrs);
  const portrait = legacyPortraitImageUrl(row);
  const priceExp = Math.max(1, Math.round(row.price_bro_cents));
  const isOwned = owned.has(entity.id);
  const canAfford = oleBal >= priceExp;
  const boosterEntries = Object.entries(row.team_booster ?? {});

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.06] to-black p-4">
      <div className="flex items-start gap-3">
        {portrait ? (
          <img
            src={portrait}
            alt={entity.name}
            style={legacyPortraitFocusStyle(row)}
            className="aspect-[11/15.6] w-20 shrink-0 rounded-lg object-cover ring-2 ring-amber-500/40"
          />
        ) : (
          <div className="grid aspect-[11/15.6] w-20 shrink-0 place-items-center rounded-lg bg-amber-500/20 text-amber-400">
            <Crown className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Crown className="h-3 w-3 text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Legacy DNA</span>
          </div>
          <p className="truncate text-sm font-black text-white">{entity.name}</p>
          <p className="text-[11px] text-gray-400">
            {entity.pos} · OVR {ovr}
            {row.country ? ` · ${row.country}` : ''}
          </p>
        </div>
      </div>

      {row.bio && <p className="mt-3 line-clamp-2 text-[11px] leading-snug text-gray-400">{row.bio}</p>}

      {(row.taught_attributes?.length ?? 0) > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-gray-500">Ensina</p>
          <div className="flex flex-wrap gap-1">
            {row.taught_attributes.map((a) => (
              <span key={a} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase text-amber-300">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {boosterEntries.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-gray-500">Booster (titular)</p>
          <div className="flex flex-wrap gap-1">
            {boosterEntries.map(([k, v]) => (
              <span key={k} className="rounded-full bg-green-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase text-green-300">
                {k} +{v}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-sm font-black text-neon-yellow">
          <Coins className="h-3.5 w-3.5" />
          {priceExp.toLocaleString('pt-BR')} OLE
        </div>
        <button
          type="button"
          onClick={() => onBuy(row)}
          disabled={isOwned || !canAfford}
          className={cn(
            'rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors',
            isOwned
              ? 'bg-white/5 text-gray-500'
              : canAfford
                ? 'bg-amber-500 text-black hover:bg-amber-400'
                : 'bg-white/5 text-gray-500',
          )}
        >
          {isOwned ? 'Adquirido' : canAfford ? 'Comprar' : 'Sem saldo'}
        </button>
      </div>
    </div>
  );
}
