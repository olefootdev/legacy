import { useEffect, useRef } from 'react';
import { dispatchGame, getGameState } from '@/game/store';
import { makeInboxItem } from '@/game/inboxItem';

/**
 * Entrega anúncios da plataforma uma única vez por manager.
 * Idempotente: se o item com o mesmo `id` já existir no inbox, não re-dispatcha.
 *
 * Cada anúncio tem um id estável; o reducer já dedup'a por id em `INBOX_PREPEND`,
 * mas para evitar resetar o `read: false` checamos a presença antes do dispatch.
 */
export function AnnouncementsHydrate() {
  const triedRef = useRef(false);

  useEffect(() => {
    if (triedRef.current) return;
    const st = getGameState();
    if (!st.userSettings?.managerProfile) return;
    triedRef.current = true;

    const inboxIds = new Set(st.inbox.map((i) => i.id));
    const hasSquad = Object.keys(st.players).length > 0;

    const updateId = 'announce-update-2026-04-29-hero';
    if (!inboxIds.has(updateId)) {
      const update = makeInboxItem(
        updateId,
        'COMPANY_ANNOUNCEMENT',
        'CLUBE',
        'Novidades de hoje no Olefoot',
        {
          body:
            'Atualizámos o ecrã inicial com um novo herói editorial, manchete dinâmica e um ticker de notícias. ' +
            'O botão JOGAR também ficou mais visível no menu central. ' +
            'Explora a home e diz-nos o que achaste.',
          deepLink: '/',
        },
      );
      dispatchGame({ type: 'INBOX_PREPEND', item: update });
    }

    const claimId = 'announce-claim-pack-2026-04-29';
    if (!inboxIds.has(claimId)) {
      const body = hasSquad
        ? 'Lançámos o Pack Genesis de boas-vindas (11 titulares + 9 reservas + 500.000 EXP). ' +
          'Como já tens plantel formado, o pack não é entregue automaticamente — se quiseres recomeçar e receber o pack, ' +
          'fala connosco em ajuda@olefoot.com e fazemos o reset do teu plantel.'
        : 'O Pack Genesis de boas-vindas (11 titulares + 9 reservas + 500.000 EXP) está disponível ' +
          'para o teu primeiro plantel. Vai a Equipe para começar.';
      const claim = makeInboxItem(claimId, 'SHOP_PACK', 'PLANTEL', 'Pack Genesis disponível', {
        body,
        deepLink: '/team',
      });
      dispatchGame({ type: 'INBOX_PREPEND', item: claim });
    }
  }, []);

  return null;
}
