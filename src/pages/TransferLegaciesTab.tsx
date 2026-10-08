import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { moedaDoJogo } from '@/wallet/constants';
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
import { SecaoRua } from '@/components/ui/Rua';
import { TORTO, VazioRua } from '@/components/market/rua/escada';
import { recordMarketActivity } from '@/supabase/marketActivities';
import { getSupabase } from '@/supabase/client';
import { useOlefootUsdBrlQuote } from '@/wallet/useOlefootUsdBrlQuote';
import { fetchMyOlefootBalance } from '@/wallet/olefoot';
import { PixCheckoutModal } from '@/components/PixCheckoutModal';
import { LegacyPlayerDetailModal } from '@/components/legacy/LegacyPlayerDetailModal';
import { PurchaseReceiptModal } from '@/components/legacy/PurchaseReceiptModal';
import { TransferRowCard } from '@/pages/Transfer';
import type { MockAuctionPlayer } from '@/transfer/mockAuctionPlayer';
import type { SortKey } from '@/transfer/marketFilters';
import { L, LOCALE } from '@/i18n/L';

export function TransferLegaciesTab({
  openDetailId,
  onDetailConsumed,
  busca = '',
  pos = '',
  sort = 'relevance',
}: {
  /** id de um legacy a abrir no modal de detalhe (vindo do destaque global). */
  openDetailId?: string | null;
  onDetailConsumed?: () => void;
  /** Busca/posição/ordem vêm do hero do Mercado — aqui só se obedece. */
  busca?: string;
  pos?: string;
  sort?: SortKey;
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
      setBuyError(L('Esta lenda está fora de catálogo no momento.', 'This legend is not on sale right now.'));
      return;
    }
    const entity = legacyRowToPlayerEntity(row);
    // price_bro_cents guarda o preço em OLEFOOT (=OLE, a moeda dos legacies).
    const priceOlefoot = Math.max(1, Math.round(row.price_bro_cents));
    if (owned.has(entity.id)) { setBuyError(L('Você já possui esse legacy.', 'You already own this Legacy.')); return; }

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
          setBuyError(data?.error ?? L('Não foi possível comprar agora.', "Couldn't buy right now."));
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
      setBuyError(L('Falha de conexão ao comprar. Tente de novo.', 'Connection failed while buying. Try again.'));
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

  // Ordenação da grade. Preço mistura moedas (PIX em R$ e carta em OLE), então
  // as de dinheiro real vêm primeiro e cada bloco é ordenado pelo próprio preço
  // — comparar R$ com OLE direto seria inventar uma equivalência que não existe.
  const precoReal = (r: LegacyPlayerRow): number | null => brlCentsFor(r);
  const precoOle = (r: LegacyPlayerRow) => Math.max(1, Math.round(Number(r.price_bro_cents) || 0));
  const ovrDe = (r: LegacyPlayerRow) => {
    const e = legacyRowToPlayerEntity(r);
    return overallFromAttributes(e.attrs, e.pos);
  };
  const porPreco = (dir: 1 | -1) => (a: LegacyPlayerRow, b: LegacyPlayerRow) => {
    const ra = precoReal(a);
    const rb = precoReal(b);
    if ((ra == null) !== (rb == null)) return ra == null ? 1 : -1;
    const va = ra ?? precoOle(a);
    const vb = rb ?? precoOle(b);
    return (va - vb) * dir;
  };
  const buscaNorm = busca.trim().toLowerCase();
  const ordenada = useMemo(() => {
    const list = rows.filter((r) => {
      const e = legacyRowToPlayerEntity(r);
      if (pos && e.pos !== pos) return false;
      if (buscaNorm && !e.name.toLowerCase().includes(buscaNorm)) return false;
      return true;
    });
    if (sort === 'price_asc') return list.sort(porPreco(1));
    if (sort === 'value_desc') return list.sort(porPreco(-1));
    if (sort === 'relevance') return list.sort((a, b) => ovrDe(b) - ovrDe(a));
    if (sort === 'name_asc') {
      return list.sort((a, b) =>
        legacyRowToPlayerEntity(a).name.localeCompare(legacyRowToPlayerEntity(b).name, 'pt', {
          sensitivity: 'base',
        }),
      );
    }
    return list.sort(
      (a, b) => (b.created_at ? Date.parse(b.created_at) : 0) - (a.created_at ? Date.parse(a.created_at) : 0),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort, pos, buscaNorm, quote]);

  if (loading) {
    return (
      <div className="py-12 text-center font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
        — {L('Colando as lendas no muro…', 'Pasting the legends up…')}
      </div>
    );
  }

  // GRADE ÚNICA (2026-09-19). Antes: uma seção com carrossel POR ATLETA — com
  // 100 jogadores seriam 100 faixas e a página não terminava mais. Agora é uma
  // grade só, como num marketplace de cartas: cada card é uma oferta, a
  // rolagem é vertical e a ordenação é escolhida pelo manager. A fase da carta
  // (o que antes era o título da seção) foi pra dentro do card.
  const faseDaCarta = (r: LegacyPlayerRow): string | null => {
    const m = /-(revelacao|consolidacao|expansao)$/i.exec(r.id);
    if (m) {
      const f = m[1]!.toLowerCase();
      return f === 'revelacao' ? L('#revelação', '#breakout') : f === 'consolidacao' ? L('#consolidação', '#consolidation') : L('#expansão', '#expansion');
    }
    const code = r.collection_code?.trim();
    return code ? `#${code.toLowerCase().replace(/\s+/g, '')}` : null;
  };

  // Conta o que está na tela agora (com filtro do hero aplicado), não o catálogo.
  const atletas = new Set(
    ordenada.map((r) => r.collection_id?.trim() || r.id.replace(/-(revelacao|consolidacao|expansao)$/i, '')),
  ).size;

  const fmtBrl = (cents: number) =>
    `R$ ${(cents / 100).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
    // Sem o sufixo da moeda: o selo ao lado do preço já diz OLE (ou PIX), e
    // repetir cortava o número em 320px.
    const oleTxt = Math.max(1, Math.round(row.price_bro_cents)).toLocaleString(LOCALE);
    const price = brl != null ? fmtBrl(brl) : oleTxt;
    if (isOwned) return { price, cta: L('Adquirido', 'Owned'), badge: 'Legacy' };
    return { price, cta: L('Comprar', 'Buy'), badge: brl != null ? 'PIX' : 'OLE' };
  };


  return (
    <div className="space-y-5">
      {/* Vazio SEM early-return: o modal de detalhe (deep-link do Legends Cup
          pra lenda fora de catálogo) precisa renderizar mesmo sem listados. */}
      {rows.length === 0 && (
        <VazioRua
          titulo={L('Muro vazio por enquanto.', 'Empty wall for now.')}
          linha={L('Nenhum Legacy à venda agora', 'No Legacy for sale right now')}
        />
      )}

      {/* Cabeçalho da parede: quantas cartas e como ver. Ordenar/buscar é no hero. */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <SecaoRua
              label={L('Lendas à venda', 'Legends for sale')}
              aside={L(
                `${ordenada.length} ${ordenada.length === 1 ? 'carta' : 'cartas'} · ${atletas} ${atletas === 1 ? 'atleta' : 'atletas'}`,
                `${ordenada.length} ${ordenada.length === 1 ? 'card' : 'cards'} · ${atletas} ${atletas === 1 ? 'athlete' : 'athletes'}`,
              )}
            />
            <h2 className="flex flex-col font-impact uppercase leading-[0.92]" style={{ fontSize: 'clamp(30px, 8.4vw, 50px)' }}>
              <span className="font-voz text-[1.2em] normal-case leading-[0.9] text-papel">{L('Lenda', 'Legends')}</span>
              <span className="text-ouro-27">{L('tem história.', 'carry history.')}</span>
            </h2>
          </div>
          <div className="flex items-center gap-1 border-2 border-linha p-1">
            {(['grid', 'list'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setView(m)}
                aria-pressed={view === m}
                className={cn(
                  'inline-flex min-h-9 items-center px-4 font-impact text-[15px] uppercase leading-none transition-colors',
                  view === m ? 'bg-rua text-asfalto-27' : 'text-mudo hover:text-papel',
                )}
              >
                {m === 'grid' ? L('Grade', 'Grid') : L('Lista', 'List')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Busca sem resultado: diz o que aconteceu, não some com a tela. */}
      {rows.length > 0 && ordenada.length === 0 && (
        <VazioRua
          titulo={L('Nenhuma lenda com esse filtro.', 'No legend with that filter.')}
          linha={L('Afrouxa a busca ali em cima', 'Loosen the search above')}
        />
      )}

      {view === 'grid' ? (
        /* A parede de lambes: cartas coladas tortas (até 2,5°), o hover endireita. */
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 py-2 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-7 lg:grid-cols-4">
          {ordenada.map((row, i) => {
            const entity = legacyRowToPlayerEntity(row);
            const sale = fixedSaleFor(row);
            return (
              <LegacyMarketCard
                key={row.id}
                row={row}
                ovr={ovrDe(row)}
                portrait={legacyPortraitImageUrl(row)}
                priceLabel={sale.price}
                pixReady={pixStateFor(row) === 'ready'}
                lot={lots.get(row.id)}
                owned={owned.has(entity.id)}
                tag={faseDaCarta(row)}
                torto={(TORTO[i % TORTO.length] ?? 0) * 0.6}
                onOpen={() => setDetailRow(row)}
              />
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {ordenada.map((row, i) => (
            <TransferRowCard
              key={row.id}
              player={toAuction(row, i)}
              onSelect={() => setDetailRow(row)}
              fixedSale={fixedSaleFor(row)}
              portraitClassName=""
              delay={Math.min(i, 8) * 0.03}
            />
          ))}
        </div>
      )}

      {pixRow && brlCentsFor(pixRow) != null && (
        <PixCheckoutModal
          open={!!pixRow}
          productKind="card"
          productRef={pixRow.id}
          amountCents={brlCentsFor(pixRow)!}
          metadata={{ player: legacyRowToPlayerEntity(pixRow), clubName }}
          title={L(`Comprar ${pixRow.name}`, `Buy ${pixRow.name}`)}
          description={L('Pague via PIX e o jogador entra no seu time automaticamente.', 'Pay with Pix and the player joins your team automatically.')}
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
        balanceLabel={olefootBalance == null ? null : `${olefootBalance.toLocaleString(LOCALE)} ${moedaDoJogo()}`}
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
        newBalanceLabel={receipt?.balance != null ? `${receipt.balance.toLocaleString(LOCALE)} ${moedaDoJogo()}` : null}
        paidWith={receipt?.paidWith ?? 'olefoot'}
        onClose={() => setReceipt(null)}
      />
    </div>
  );
}
