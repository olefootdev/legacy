import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import {
  fetchListedLegacyPlayerRows,
  fetchLegacyOpenLots,
  legacyPortraitImageUrl,
  legacyRowToPlayerEntity,
  type LegacyPlayerRow,
  type LegacyLotInfo,
} from '@/supabase/legacyPlayers';
import { LegacyMarketCard } from '@/components/legacy/LegacyMarketCard';
import { recordMarketActivity } from '@/supabase/marketActivities';
import { getSupabase } from '@/supabase/client';
import { useOlefootUsdBrlQuote } from '@/wallet/useOlefootUsdBrlQuote';
import { fetchMyOlexpBalance } from '@/wallet/olexpSync';
import { PixCheckoutModal } from '@/components/PixCheckoutModal';
import { LegacyPlayerDetailModal } from '@/components/legacy/LegacyPlayerDetailModal';
import { PurchaseReceiptModal } from '@/components/legacy/PurchaseReceiptModal';
import { TransferRowCard } from '@/pages/Transfer';
import type { MockAuctionPlayer } from '@/transfer/mockAuctionPlayer';

export function TransferLegaciesTab({
  openDetailId,
  onDetailConsumed,
}: {
  /** id de um legacy a abrir no modal de detalhe (vindo do destaque global). */
  openDetailId?: string | null;
  onDetailConsumed?: () => void;
} = {}) {
  const dispatch = useGameDispatch();
  const oleBal = useGameStore((s) => s.finance.ole);
  const playersById = useGameStore((s) => s.players);
  const clubName = useGameStore((s) => s.club?.name ?? 'Manager');
  const [rows, setRows] = useState<LegacyPlayerRow[]>([]);
  const [lots, setLots] = useState<Map<string, LegacyLotInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [pixRow, setPixRow] = useState<LegacyPlayerRow | null>(null);
  const [detailRow, setDetailRow] = useState<LegacyPlayerRow | null>(null);
  // Saldo OLEFOOT real (server-authoritative) — é a moeda que paga os legacies.
  // null = ainda carregando (a UI mostra "Verificando saldo…").
  const [olefootBalance, setOlefootBalance] = useState<number | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<
    { name: string; ovr: number; pos: string; portrait: string | null; balance: number | null; paidWith: 'olefoot' | 'pix' } | null
  >(null);
  const [sessionEmail, setSessionEmail] = useState('');
  const quote = useOlefootUsdBrlQuote(true);

  const refreshOlefootBalance = () => {
    void fetchMyOlexpBalance().then((b) => setOlefootBalance(b));
  };
  useEffect(() => {
    refreshOlefootBalance();
    // E-mail da sessão pra pré-preencher o checkout PIX.
    void (async () => {
      const sb = getSupabase();
      const email = sb ? (await sb.auth.getSession()).data.session?.user.email : undefined;
      if (email) setSessionEmail(email);
    })();
  }, []);

  // Preço em R$ (centavos) do card a partir do preço de lançamento USDT × cotação.
  const brlCentsFor = (row: LegacyPlayerRow): number | null => {
    if (quote.status !== 'ok') return null;
    if (row.currency !== 'USDT' || !row.price_unit_cents) return null;
    return Math.round(row.price_unit_cents * quote.olefootVenda);
  };

  // Estado do PIX por card: ready = tem R$; loading = card USDT mas cotação
  // ainda não chegou; none = card só OLEFOOT (sem PIX).
  const pixStateFor = (row: LegacyPlayerRow): 'ready' | 'loading' | 'none' => {
    if (row.currency !== 'USDT' || !row.price_unit_cents) return 'none';
    return quote.status === 'ok' ? 'ready' : 'loading';
  };

  useEffect(() => {
    let cancelled = false;
    fetchListedLegacyPlayerRows().then((data) => {
      if (cancelled) return;
      setRows(data);
      setLoading(false);
    });
    // Escassez REAL: lê os lotes abertos (supply/sold). Degrada em silêncio se vazio.
    fetchLegacyOpenLots().then((m) => {
      if (!cancelled) setLots(m);
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

  // Erro de compra é por-tentativa: some ao trocar/fechar o detalhe.
  useEffect(() => {
    setBuyError(null);
  }, [detailRow?.id]);

  // Abre o modal de detalhe quando o destaque global pede (clique num legacy lá).
  useEffect(() => {
    if (!openDetailId || rows.length === 0) return;
    const row = rows.find((r) => r.id === openDetailId);
    if (row) {
      setDetailRow(row);
      onDetailConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDetailId, rows]);

  const buy = async (row: LegacyPlayerRow) => {
    if (buyingId) return; // trava duplo-clique / compra concorrente
    const entity = legacyRowToPlayerEntity(row);
    // price_bro_cents guarda o preço em OLEFOOT (=OLE, a moeda dos legacies).
    const priceOlefoot = Math.max(1, Math.round(row.price_bro_cents));
    if (owned.has(entity.id)) { setBuyError('Você já possui esse legacy.'); return; }

    setBuyError(null);
    setBuyingId(row.id);

    const apiBase = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_OLEFOOT_API_URL || 'http://localhost:4000';
    const serverUrl = apiBase !== 'http://localhost:4000' ? apiBase : null;
    const sb = getSupabase();
    let newBalance: number | null = null;

    try {
      const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;

      if (serverUrl && token) {
        // Compra ATÔMICA no servidor: debita OLEFOOT (legacy_olefoot_credits) +
        // entrega o player (sem corrida). NÃO toca EXP (finance.ole).
        const r = await fetch(`${serverUrl}/api/market/buy-legacy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ legacy_id: row.id, player: entity, clubName }),
        });
        const data = await r.json().catch(() => null);
        if (!r.ok || !data?.ok) {
          setBuyError(data?.error ?? 'Não foi possível comprar agora.');
          return;
        }
        // Servidor debitou o OLEFOOT — só entregamos o player no estado local
        // (ole = saldo atual, INALTERADO: a moeda do legacy é OLEFOOT, não EXP).
        dispatch({ type: 'CONFIRM_LEGACY_PURCHASE', player: entity, ole: oleBal });
        // O servidor já devolve o novo saldo OLEFOOT — usa direto (sem refetch).
        if (data.olefoot != null) {
          newBalance = Number(data.olefoot);
          setOlefootBalance(newBalance);
        } else {
          refreshOlefootBalance();
        }
      } else {
        // Fallback (dev local sem server): mantém o fluxo client-side.
        dispatch({ type: 'BUY_LEGACY_PLAYER', player: entity, priceExp: priceOlefoot });
        refreshOlefootBalance();
      }
    } catch {
      setBuyError('Falha de conexão ao comprar. Tente de novo.');
      return;
    } finally {
      setBuyingId(null);
    }

    // Sucesso: fecha o detalhe e mostra o recibo.
    setDetailRow(null);
    setReceipt({
      name: entity.name,
      ovr: overallFromAttributes(entity.attrs),
      pos: entity.pos,
      portrait: legacyPortraitImageUrl(row),
      balance: newBalance,
      paidWith: 'olefoot',
    });

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

  // Agrupa por ATLETA (não por coleção): todas as cartas do mesmo jogador
  // (ex: as 3 fases do Gonçalves) aparecem lado a lado sob um cabeçalho, mesmo
  // sendo de coleções/temporadas diferentes. Escala melhor com muitos jogadores.
  const athleteKey = (r: LegacyPlayerRow) =>
    r.collection_id?.trim() || r.id.replace(/-(revelacao|consolidacao|expansao)$/i, '');
  const athleteTitle = (r: LegacyPlayerRow) => {
    const cid = r.collection_id?.trim();
    if (cid) {
      const base = cid.replace(/^mem-/i, '').replace(/-\d{4}$/, '').replace(/-/g, ' ').trim();
      if (base) return base.replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return r.name.replace(/\s*\d+$/, '').trim() || r.name;
  };
  const groups: Array<{ code: string; title: string; rows: LegacyPlayerRow[] }> = [];
  const groupIndex = new Map<string, number>();
  for (const row of rows) {
    const code = athleteKey(row) || 'OUTROS';
    let idx = groupIndex.get(code);
    if (idx === undefined) {
      idx = groups.length;
      groupIndex.set(code, idx);
      groups.push({ code, title: athleteTitle(row), rows: [] });
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

  // Destaque da manchete = maior OVR do grupo, movido pra primeira posição.
  const orderFeaturedFirst = (list: LegacyPlayerRow[]): LegacyPlayerRow[] => {
    if (list.length <= 1) return list;
    const ovrOf = (r: LegacyPlayerRow) => overallFromAttributes(legacyRowToPlayerEntity(r).attrs);
    let best = 0;
    for (let i = 1; i < list.length; i++) if (ovrOf(list[i]!) > ovrOf(list[best]!)) best = i;
    const copy = [...list];
    const [hero] = copy.splice(best, 1);
    return hero ? [hero, ...copy] : copy;
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
              {g.rows.length} {g.rows.length === 1 ? 'carta' : 'cartas'}
            </span>
          </div>

          {view === 'grid' ? (
            // Manchete (upgrade 01): a lenda de maior OVR do grupo vira card-destaque 2×2.
            <div className="grid min-w-0 auto-rows-fr grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
              {orderFeaturedFirst(g.rows).map((row, i) => {
                const entity = legacyRowToPlayerEntity(row);
                const o = overallFromAttributes(entity.attrs);
                const sale = fixedSaleFor(row);
                const isHero = i === 0 && g.rows.length >= 3;
                return (
                  <div key={row.id} className={cn('min-w-0', isHero && 'sm:col-span-2 sm:row-span-2')}>
                    <LegacyMarketCard
                      row={row}
                      ovr={o}
                      portrait={legacyPortraitImageUrl(row)}
                      priceLabel={sale.price}
                      pixReady={pixStateFor(row) === 'ready'}
                      lot={lots.get(row.id)}
                      owned={owned.has(entity.id)}
                      size={isHero ? 'hero' : 'grid'}
                      onOpen={() => setDetailRow(row)}
                    />
                  </div>
                );
              })}
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
          metadata={{ player: legacyRowToPlayerEntity(pixRow), clubName }}
          title={`Comprar ${pixRow.name}`}
          description="Pague via PIX e o jogador entra no teu time automaticamente."
          defaultName={clubName}
          defaultEmail={sessionEmail}
          onClose={() => setPixRow(null)}
          onSuccess={() => {
            const r = pixRow;
            setPixRow(null);
            refreshOlefootBalance();
            if (r) {
              const entity = legacyRowToPlayerEntity(r);
              setReceipt({
                name: entity.name,
                ovr: overallFromAttributes(entity.attrs),
                pos: entity.pos,
                portrait: legacyPortraitImageUrl(r),
                balance: null,
                paidWith: 'pix',
              });
            }
          }}
        />
      )}

      <LegacyPlayerDetailModal
        row={detailRow}
        open={!!detailRow}
        onClose={() => setDetailRow(null)}
        brlCents={detailRow ? brlCentsFor(detailRow) : null}
        isOwned={detailRow ? owned.has(legacyRowToPlayerEntity(detailRow).id) : false}
        canAfford={
          !detailRow
            ? false
            : olefootBalance == null
              ? null
              : olefootBalance >= Math.max(1, Math.round(detailRow.price_bro_cents))
        }
        balanceLabel={olefootBalance == null ? null : `${olefootBalance.toLocaleString('pt-BR')} OLEFOOT`}
        buying={!!detailRow && buyingId === detailRow.id}
        errorMsg={buyError}
        pixState={detailRow ? pixStateFor(detailRow) : 'none'}
        onBuy={() => {
          if (detailRow) void buy(detailRow);
        }}
        onPixBuy={() => {
          const r = detailRow;
          setDetailRow(null);
          if (r) setPixRow(r);
        }}
      />

      <PurchaseReceiptModal
        open={!!receipt}
        playerName={receipt?.name ?? ''}
        playerOvr={receipt?.ovr ?? 0}
        playerPos={receipt?.pos ?? ''}
        portrait={receipt?.portrait ?? null}
        newBalanceLabel={receipt?.balance != null ? `${receipt.balance.toLocaleString('pt-BR')} OLEFOOT` : null}
        paidWith={receipt?.paidWith ?? 'olefoot'}
        onClose={() => setReceipt(null)}
      />
    </div>
  );
}
