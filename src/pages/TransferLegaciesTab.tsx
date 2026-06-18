import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import {
  fetchListedLegacyPlayerRows,
  legacyPortraitImageUrl,
  legacyRowToPlayerEntity,
  type LegacyPlayerRow,
} from '@/supabase/legacyPlayers';
import { recordMarketActivity } from '@/supabase/marketActivities';
import { getSupabase } from '@/supabase/client';
import { useOlefootUsdBrlQuote } from '@/wallet/useOlefootUsdBrlQuote';
import { PixCheckoutModal } from '@/components/PixCheckoutModal';
import { LegacyPlayerDetailModal } from '@/components/legacy/LegacyPlayerDetailModal';
import { PlayerCard, TransferRowCard } from '@/pages/Transfer';
import type { MockAuctionPlayer } from '@/transfer/mockAuctionPlayer';

export function TransferLegaciesTab() {
  const dispatch = useGameDispatch();
  const oleBal = useGameStore((s) => s.finance.ole);
  const playersById = useGameStore((s) => s.players);
  const clubName = useGameStore((s) => s.club?.name ?? 'Manager');
  const [rows, setRows] = useState<LegacyPlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
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

  const fmtBrl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

  // Legacy → MockAuctionPlayer (reusa o card Genesis: PlayerCard / TransferRowCard).
  const toAuction = (row: LegacyPlayerRow, idx: number): MockAuctionPlayer => {
    const entity = legacyRowToPlayerEntity(row);
    const ovr = overallFromAttributes(entity.attrs);
    return {
      id: idx + 1,
      name: entity.name,
      pos: entity.pos,
      nat: row.country ?? '—',
      ovr,
      style: ovr >= 80 ? 'neon-yellow' : ovr >= 70 ? 'white' : 'gray-400',
      pac: entity.attrs.velocidade,
      sho: entity.attrs.finalizacao,
      pas: entity.attrs.passe,
      dri: entity.attrs.drible,
      def: entity.attrs.marcacao,
      phy: entity.attrs.fisico,
      auctionCurrency: 'EXP',
      currentBid: 0,
      buyNow: 0,
      timeLeft: '',
      history: [],
      category: ovr >= 80 ? 'gold' : undefined,
      bio: row.bio ?? undefined,
      portraitSrc: legacyPortraitImageUrl(row),
      marketKind: 'mock',
    };
  };

  // Venda de preço fixo (PIX se USDT, senão OLE) — troca o rodapé de leilão.
  const fixedSaleFor = (row: LegacyPlayerRow): { price: string; cta: string; badge: string } => {
    const isOwned = owned.has(legacyRowToPlayerEntity(row).id);
    const brl = brlCentsFor(row);
    const oleTxt = `${Math.max(1, Math.round(row.price_bro_cents)).toLocaleString('pt-BR')} OLE`;
    const price = brl != null ? fmtBrl(brl) : oleTxt;
    if (isOwned) return { price, cta: 'Adquirido', badge: 'Legacy' };
    return { price, cta: 'Comprar', badge: brl != null ? 'PIX' : 'OLE' };
  };

  return (
    <div className="space-y-8">
      {/* Toggle de visualização — Grid (card vertical) vs Lista (linha) */}
      <div className="flex items-center justify-end gap-1.5">
        {(['grid', 'list'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setView(m)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition',
              view === m ? 'bg-amber-400 text-black' : 'border border-white/10 text-white/55 hover:text-white',
            )}
          >
            {m === 'grid' ? 'Grid' : 'Lista'}
          </button>
        ))}
      </div>

      {groups.map((g) => (
        <section key={g.code} className="space-y-3">
          <div className="flex items-baseline justify-between gap-3 border-b border-amber-400/20 pb-1.5">
            <h3 className="font-display text-sm font-black uppercase tracking-wide text-amber-300">{g.title}</h3>
            <span className="text-[11px] text-white/45">
              {g.rows.length} {g.rows.length === 1 ? 'jogador' : 'jogadores'}
            </span>
          </div>

          {view === 'grid' ? (
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
              {g.rows.map((row, i) => (
                <div key={row.id} className="min-w-0 cursor-pointer" onClick={() => setDetailRow(row)}>
                  <PlayerCard
                    player={toAuction(row, i)}
                    fixedSale={fixedSaleFor(row)}
                    portraitClassName=""
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {g.rows.map((row, i) => (
                <TransferRowCard
                  key={row.id}
                  player={toAuction(row, i)}
                  onSelect={() => setDetailRow(row)}
                  fixedSale={fixedSaleFor(row)}
                  portraitClassName=""
                  delay={i * 0.04}
                />
              ))}
            </div>
          )}
        </section>
      ))}

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
