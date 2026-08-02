/**
 * useMarketOffers — sincroniza a negociação P2P entre managers com o estado do
 * jogo e expõe as ações da UI.
 *
 * Fluxo de liquidação cross-user (o pulo do gato):
 *  - EU (vendedor) ACEITO uma proposta recebida → o servidor já moveu o jogador
 *    do meu plantel pro do comprador; aqui despacho APPLY_OFFER_SETTLED_AS_SELLER
 *    pra remover do plantel/escalação local na hora.
 *  - EU (comprador) ACEITO uma contraproposta → o servidor devolve o
 *    player_snapshot; despacho APPLY_OFFER_ACCEPTED_AS_BUYER (entrega o jogador
 *    e seta o OLE = finance.ole - price_exp).
 *  - O OUTRO lado (ex.: vendedor aceitou minha proposta) NÃO precisa ser
 *    espelhado aqui: o jogador já foi movido server-side; o self-heal da
 *    persistência (manager_squad) traz na próxima carga.
 *
 * Refetch no mount, ao focar a janela, e após cada ação bem-sucedida.
 */
import { useCallback, useEffect, useState } from 'react';
import { useGameDispatch, useGameStore, getGameState } from '@/game/store';
import type { PlayerEntity } from '@/entities/types';
import {
  proposeOffer,
  respondToOffer,
  acceptCounter,
  cancelOffer,
  fetchMyOffers,
  type OfferAction,
} from '@/supabase/marketOffers';

/**
 * Fallback ESTÁVEL para as listas de ofertas.
 *
 * POR QUÊ: `useGameStore` é `useSyncExternalStore`, que compara o resultado do
 * seletor por IDENTIDADE. Escrever `?? []` dentro do seletor cria um array novo
 * a cada chamada — o React vê um snapshot diferente toda vez, re-renderiza, o
 * seletor roda de novo, e entra em laço infinito ("The result of getSnapshot
 * should be cached to avoid an infinite loop"). Com a constante, o seletor
 * devolve sempre a MESMA referência quando não há ofertas.
 *
 * Isso derrubava o Transfer inteiro para qualquer manager cujo estado ainda não
 * tivesse `incomingOffers`/`outgoingOffers` — conta nova ou save anterior à
 * migração do P2P.
 */
const SEM_OFERTAS: never[] = [];

export function useMarketOffers() {
  const dispatch = useGameDispatch();
  const clubName = useGameStore((s) => s.club?.name ?? 'Manager');
  const incoming = useGameStore((s) => s.managerProspectMarket.incomingOffers ?? SEM_OFERTAS);
  const outgoing = useGameStore((s) => s.managerProspectMarket.outgoingOffers ?? SEM_OFERTAS);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const { incoming: inc, outgoing: out } = await fetchMyOffers();
      dispatch({ type: 'SET_MARKET_OFFERS', incoming: inc, outgoing: out });
    } catch {
      // silencioso — mercado offline não deve quebrar a tela.
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  // Mount + a cada foco da janela.
  useEffect(() => {
    void refetch();
    const onFocus = () => void refetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch]);

  /** Comprador propõe / atualiza um valor por uma listagem. */
  const propose = useCallback(
    async (listingId: string, offerExp: number) => {
      // Guard de saldo (o servidor não valida EXP — mesma dívida do buy-prospect).
      if (offerExp > getGameState().finance.ole) {
        throw new Error('Saldo EXP insuficiente pra essa proposta.');
      }
      await proposeOffer(listingId, offerExp, clubName);
      await refetch();
    },
    [clubName, refetch],
  );

  /**
   * Vendedor responde a uma proposta recebida.
   * No ACEITE, liquida localmente (remove do plantel) com os dados da oferta.
   */
  const respond = useCallback(
    async (
      offer: { offerId: string; gamePlayerId: string; playerName: string; buyerClubName: string; offerExp: number },
      action: OfferAction,
      counterExp?: number,
    ) => {
      const res = await respondToOffer(offer.offerId, action, counterExp);
      if (action === 'accept' && res.status === 'accepted') {
        dispatch({
          type: 'APPLY_OFFER_SETTLED_AS_SELLER',
          playerId: offer.gamePlayerId,
          playerName: offer.playerName,
          creditExp: res.priceExp ?? offer.offerExp,
          buyerClubName: offer.buyerClubName,
        });
      }
      await refetch();
    },
    [dispatch, refetch],
  );

  /** Comprador aceita a contraproposta — recebe o snapshot e entrega o jogador. */
  const acceptCounterOffer = useCallback(
    async (offerId: string) => {
      // Guard de saldo antes de aceitar (o valor é o counterExp da própria oferta).
      const target = getGameState().managerProspectMarket.outgoingOffers?.find((o) => o.offerId === offerId);
      const cost = target?.counterExp ?? target?.offerExp ?? 0;
      if (cost > getGameState().finance.ole) {
        throw new Error('Saldo EXP insuficiente pra aceitar a contraproposta.');
      }
      const res = await acceptCounter(offerId);
      const player = res.playerSnapshot as unknown as PlayerEntity;
      const currentOle = getGameState().finance.ole;
      dispatch({
        type: 'APPLY_OFFER_ACCEPTED_AS_BUYER',
        player,
        priceExp: res.priceExp,
        ole: currentOle - res.priceExp,
      });
      await refetch();
    },
    [dispatch],
  );

  /** Comprador cancela a própria proposta. */
  const cancel = useCallback(
    async (offerId: string) => {
      await cancelOffer(offerId);
      await refetch();
    },
    [refetch],
  );

  const pendingForListing = useCallback(
    (listingId: string) => outgoing.find((o) => o.listingId === listingId && (o.status === 'pending' || o.status === 'countered')),
    [outgoing],
  );

  return {
    incoming,
    outgoing,
    loading,
    incomingCount: incoming.length,
    refetch,
    propose,
    respond,
    acceptCounterOffer,
    cancel,
    pendingForListing,
  };
}
