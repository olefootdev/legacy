import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import {
  fetchListedLegacyPlayerRows,
  fetchLegacyPlayerRowById,
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
import { fetchMyOlefootBalance } from '@/wallet/olefoot';
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
    void fetchMyOlefootBalance().then((b) => setOlefootBalance(b));
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

  // Abre o modal de detalhe quando o destaque global pede (clique num legacy
  // lá) OU quando o deep-link `?legacy=<id>` chega (CTA pós-jogo do Legends
  // Cup). Normaliza o prefixo `legacy-` (o link manda o id do PlayerEntity,
  // sempre prefixado; row.id pode vir sem) e, se a lenda NÃO estiver listada
  // à venda, busca direto no Supabase e abre a ficha em modo "fora de catálogo".
  useEffect(() => {
    if (!openDetailId || loading) return;
    const norm = (s: string) => s.trim().replace(/^(legacy-)+/, '');
    const wanted = norm(openDetailId);
    const row = rows.find((r) => norm(r.id) === wanted);
    if (row) {
      setDetailRow(row);
      onDetailConsumed?.();
      return;
    }
    let cancelled = false;
    void fetchLegacyPlayerRowById(openDetailId).then((fetched) => {
      if (cancelled) return;
      if (fetched) setDetailRow(fetched);
      // Consumido mesmo se não achou — evita loop de refetch do mesmo id.
      onDetailConsumed?.();
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDetailId, rows, loading]);

  const buy = async (row: LegacyPlayerRow) => {
    if (buyingId) return; // trava duplo-clique / compra concorrente
    if (row.listed_on_market === false) {
      // Ficha aberta via deep-link de lenda fora de catálogo — sem compra.
      setBuyError('Esta lenda está fora de catálogo no momento.');
      return;
    }
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
      ovr: overallFromAttributes(entity.attrs, entity.pos),
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
        playerOvr: overallFromAttributes(entity.attrs, entity.pos),
        playerPos: entity.pos,
        priceExp: priceOlefoot,
      });
    })();
  };

  if (loading) {
    return <div className="py-10 text-center text-sm text-gray-500">Carregando legacies…</div>;
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
    const ovr = overallFromAttributes(entity.attrs, entity.pos);
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

  // Ordena a coleção do atleta pela carta de MAIOR VALOR primeiro (destaque).
  // USDT compara por price_unit_cents; OLE por price_bro_cents (dentro de um
  // atleta a moeda é consistente, então a ordenação é estável).
  const priceSort = (r: LegacyPlayerRow) =>
    r.currency === 'USDT' ? r.price_unit_cents ?? 0 : Math.round(Number(r.price_bro_cents) || 0);
  const orderByPriceDesc = (list: LegacyPlayerRow[]): LegacyPlayerRow[] =>
    [...list].sort((a, b) => priceSort(b) - priceSort(a));

  return (
    <div className="space-y-8 px-4 sm:px-5">
      {/* Vazio SEM early-return: o modal de detalhe (deep-link do Legends Cup
          pra lenda fora de catálogo) precisa renderizar mesmo sem listados. */}
      {rows.length === 0 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] py-12 text-center text-sm text-gray-500">
          Nenhum Legacy disponível no momento.
        </div>
      )}

      {/* Toggle de visualização — Grid (card vertical) vs Lista (linha) */}
      {rows.length > 0 && (
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
      )}

      {groups.map((g) => (
        <section key={g.code} className="space-y-3">
          <div className="flex items-baseline justify-between gap-3 border-b border-amber-400/20 pb-1.5">
            <h3 className="font-display text-sm font-black uppercase tracking-wide text-amber-300">{g.title}</h3>
            <span className="text-[11px] text-white/45">
              {g.rows.length} {g.rows.length === 1 ? 'carta' : 'cartas'}
            </span>
          </div>

          {view === 'grid' ? (
            // Carrossel horizontal: arrasta pro lado e vê todas as cartas do atleta.
            // Cards de tamanho ÚNICO; a MAIS CARA vem primeiro (destaque).
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {orderByPriceDesc(g.rows).map((row) => {
                const entity = legacyRowToPlayerEntity(row);
                const o = overallFromAttributes(entity.attrs, entity.pos);
                const sale = fixedSaleFor(row);
                return (
                  <div key={row.id} className="w-[158px] flex-none snap-start sm:w-[186px]">
                    <LegacyMarketCard
                      row={row}
                      ovr={o}
                      portrait={legacyPortraitImageUrl(row)}
                      priceLabel={sale.price}
                      pixReady={pixStateFor(row) === 'ready'}
                      lot={lots.get(row.id)}
                      owned={owned.has(entity.id)}
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
              // Entrega o player no estado local NA HORA (espelha a compra por
              // OLE, linha ~151). O servidor já entregou via confirm_payment_intent;
              // sem isto, o próximo save do cliente (snapshot completo de players[])
              // apagaria o jogador recém-comprado do plantel. `ole` inalterado —
              // PIX paga em R$, não mexe no saldo OLE.
              dispatch({ type: 'CONFIRM_LEGACY_PURCHASE', player: entity, ole: oleBal });
              setReceipt({
                name: entity.name,
                ovr: overallFromAttributes(entity.attrs, entity.pos),
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
        notListed={detailRow ? detailRow.listed_on_market === false : false}
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
