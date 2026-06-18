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
import { useOlefootUsdBrlQuote } from '@/wallet/useOlefootUsdBrlQuote';
import { PixCheckoutModal } from '@/components/PixCheckoutModal';
import { LegacyPlayerDetailModal } from '@/components/legacy/LegacyPlayerDetailModal';

export function TransferLegaciesTab() {
  const dispatch = useGameDispatch();
  const oleBal = useGameStore((s) => s.finance.ole);
  const playersById = useGameStore((s) => s.players);
  const clubName = useGameStore((s) => s.club?.name ?? 'Manager');
  const [rows, setRows] = useState<LegacyPlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'detalhe' | 'galeria'>('detalhe');
  const [pixRow, setPixRow] = useState<LegacyPlayerRow | null>(null);
  const [detailRow, setDetailRow] = useState<LegacyPlayerRow | null>(null);
  const quote = useOlefootUsdBrlQuote(true);

  // Preço em R$ (centavos) do card a partir do preço de lançamento USDT × cotação.
  const brlCentsFor = (row: LegacyPlayerRow): number | null => {
    if (quote.status !== 'ok') return null;
    if (row.currency !== 'USDT' || !row.price_unit_cents) return null;
    return Math.round(row.price_unit_cents * quote.olefootVenda);
  };

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
      {/* Toggle de visualização — Detalhe (cards grandes) vs Galeria (grid compacto) */}
      <div className="flex items-center justify-end gap-1.5">
        {([['detalhe', 'Detalhe'], ['galeria', 'Galeria']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition',
              view === key ? 'bg-amber-400 text-black' : 'border border-white/10 text-white/55 hover:text-white',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'galeria' ? (
        /* Galeria = álbum: TODOS os legacies num grid denso (coleção vira tag no card). */
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {rows.map((row) => (
            <CompactLegacyCard
              key={row.id}
              row={row}
              owned={owned}
              onView={() => setDetailRow(row)}
            />
          ))}
        </div>
      ) : (
        groups.map((g) => (
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
                <LegacyCard
                  key={row.id}
                  row={row}
                  oleBal={oleBal}
                  owned={owned}
                  onBuy={buy}
                  brlCents={brlCentsFor(row)}
                  onPixBuy={() => setPixRow(row)}
                  onView={() => setDetailRow(row)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {pixRow && brlCentsFor(pixRow) != null && (
        <PixCheckoutModal
          open={!!pixRow}
          productKind="card"
          productRef={pixRow.id}
          amountCents={brlCentsFor(pixRow)!}
          metadata={{ player: legacyRowToPlayerEntity(pixRow) }}
          title={`Comprar ${pixRow.name}`}
          description="Pague via PIX e o jogador entra no teu time automaticamente."
          onClose={() => setPixRow(null)}
          onSuccess={() => {
            setPixRow(null);
            window.alert('Pagamento confirmado! O jogador chega no teu time em instantes.');
          }}
        />
      )}

      <LegacyPlayerDetailModal
        row={detailRow}
        open={!!detailRow}
        onClose={() => setDetailRow(null)}
        brlCents={detailRow ? brlCentsFor(detailRow) : null}
        isOwned={detailRow ? owned.has(legacyRowToPlayerEntity(detailRow).id) : false}
        canAffordOle={detailRow ? oleBal >= Math.max(1, Math.round(detailRow.price_bro_cents)) : false}
        onBuy={() => {
          const r = detailRow;
          setDetailRow(null);
          if (r) void buy(r);
        }}
        onPixBuy={() => {
          const r = detailRow;
          setDetailRow(null);
          if (r) setPixRow(r);
        }}
      />
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

// ── CARD COMPACTO (Galeria / álbum) ─────────────────────────────────────────
function CompactLegacyCard({
  row,
  owned,
  onView,
}: {
  row: LegacyPlayerRow;
  owned: Set<string>;
  onView: () => void;
}) {
  const entity = legacyRowToPlayerEntity(row);
  const ovr = overallFromAttributes(entity.attrs);
  const portrait = legacyPortraitImageUrl(row);
  const isOwned = owned.has(entity.id);

  return (
    <button
      type="button"
      onClick={onView}
      className="group relative aspect-[11/15.6] w-full overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-950/30 to-black text-left transition hover:border-amber-400/70 hover:shadow-[0_0_22px_-6px_rgba(245,158,11,0.55)]"
    >
      {portrait ? (
        <img
          src={portrait}
          alt={entity.name}
          style={legacyPortraitFocusStyle(row)}
          className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
          loading="lazy"
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-amber-400/40">
          <Crown className="h-8 w-8" />
        </div>
      )}

      {/* OVR */}
      <div className="absolute left-1.5 top-1.5 rounded-md border border-amber-400/40 bg-black/70 px-1.5 py-0.5 backdrop-blur">
        <p className="italic leading-none tabular-nums text-amber-300" style={{ fontFamily: 'var(--font-serif-hero)', fontWeight: 700, fontSize: '15px' }}>
          {ovr}
        </p>
      </div>

      {isOwned && (
        <div className="absolute right-1.5 top-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-black">
          Seu
        </div>
      )}

      {/* Nome + posição */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent px-2 pb-1.5 pt-6">
        <p className="truncate font-display text-[11px] font-black uppercase tracking-tight text-white">{entity.name}</p>
        <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-amber-200/75">{entity.pos}</p>
      </div>
    </button>
  );
}

// ── CARD NORMAL ────────────────────────────────────────────────────────────
function LegacyCard({
  row,
  oleBal,
  owned,
  onBuy,
  brlCents,
  onPixBuy,
  onView,
}: {
  row: LegacyPlayerRow;
  oleBal: number;
  owned: Set<string>;
  onBuy: (row: LegacyPlayerRow) => void;
  brlCents: number | null;
  onPixBuy: () => void;
  onView: () => void;
}) {
  const entity = legacyRowToPlayerEntity(row);
  const ovr = overallFromAttributes(entity.attrs);
  const portrait = legacyPortraitImageUrl(row);
  const priceExp = Math.max(1, Math.round(row.price_bro_cents));
  const isOwned = owned.has(entity.id);
  const canAfford = oleBal >= priceExp;
  const boosterEntries = Object.entries(row.team_booster ?? {});
  const taught = row.taught_attributes ?? [];
  const fmtBrl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
  const stats: Array<[string, number]> = [
    ['PAC', entity.attrs.velocidade],
    ['SHO', entity.attrs.finalizacao],
    ['PAS', entity.attrs.passe],
  ];

  return (
    <div
      onClick={onView}
      role="button"
      tabIndex={0}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border-2 border-amber-500/30 bg-gradient-to-b from-amber-950/30 to-black transition hover:border-amber-400/70 hover:shadow-[0_0_36px_-6px_rgba(245,158,11,0.55)]"
    >
      {/* HERO — arte do card colecionável no formato real (clipada: o zoom de
          enquadramento NÃO transborda mais sobre o texto). */}
      <div className="relative aspect-[11/15.6] w-full overflow-hidden bg-gradient-to-br from-amber-900/25 to-black">
        {portrait ? (
          <img
            src={portrait}
            alt={entity.name}
            style={legacyPortraitFocusStyle(row)}
            className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-amber-400/40">
            <Crown className="h-14 w-14" />
          </div>
        )}

        {/* OVR — Moret italic dourado */}
        <div className="absolute left-2.5 top-2.5 rounded-lg border border-amber-400/40 bg-black/70 px-2.5 py-1 backdrop-blur">
          <p
            className="italic leading-none tabular-nums text-amber-300"
            style={{ fontFamily: 'var(--font-serif-hero)', fontWeight: 700, fontSize: '22px' }}
          >
            {ovr}
          </p>
        </div>

        {/* Selo Legacy DNA */}
        <div className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-black/65 px-2 py-1 backdrop-blur">
          <Crown className="h-3 w-3 text-amber-300" strokeWidth={2.5} />
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-300">Legacy DNA</span>
        </div>

        {/* Faixa inferior: nome + posição/país sobre gradiente */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-3 pb-2.5 pt-8">
          <p className="truncate font-display text-base font-black uppercase tracking-tight text-white">
            {entity.name}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200/80">
            {entity.pos}{row.country ? ` · ${row.country}` : ''}
          </p>
        </div>
      </div>

      {/* INFO */}
      <div className="flex flex-1 flex-col gap-3 p-3">
        {/* Stats PAC / SHO / PAS */}
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-white/5 bg-white/5">
          {stats.map(([label, val]) => (
            <div key={label} className="bg-black/40 px-1 py-1.5 text-center">
              <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/40">{label}</p>
              <p
                className="italic leading-none tabular-nums text-white"
                style={{ fontFamily: 'var(--font-serif-hero)', fontWeight: 700, fontSize: '15px' }}
              >
                {val}
              </p>
            </div>
          ))}
        </div>

        {/* Ensina + Booster (diferenciais do Legacy) */}
        {(taught.length > 0 || boosterEntries.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {taught.map((a) => (
              <span key={a} className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">
                {a}
              </span>
            ))}
            {boosterEntries.map(([k, v]) => (
              <span key={k} className="rounded-full bg-green-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-green-300">
                {k} +{v}
              </span>
            ))}
          </div>
        )}

        {/* Preço + CTA */}
        <div className="mt-auto space-y-2 pt-1">
          {isOwned ? (
            <div className="rounded-lg bg-white/5 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Adquirido
            </div>
          ) : (
            <>
              {brlCents != null && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onPixBuy(); }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] py-2.5 text-[12px] font-black uppercase tracking-wide text-black transition hover:brightness-110"
                >
                  Comprar com PIX · {fmtBrl(brlCents)}
                </button>
              )}
              {row.currency !== 'USDT' && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onBuy(row); }}
                  disabled={!canAfford}
                  className={cn(
                    'flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-[11px] font-black uppercase tracking-wider transition-colors',
                    canAfford ? 'bg-amber-400 text-black hover:bg-white' : 'bg-white/5 text-gray-500',
                  )}
                >
                  <Coins className="h-3.5 w-3.5" />
                  {canAfford ? `Comprar · ${priceExp.toLocaleString('pt-BR')} OLE` : 'Sem saldo OLE'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
