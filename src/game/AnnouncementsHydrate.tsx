import { useEffect, useRef } from 'react';
import { dispatchGame, getGameState } from '@/game/store';
import { makeInboxItem } from '@/game/inboxItem';
import { L, emIngles } from '@/i18n/L';

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
        L('Novidades de hoje no Olefoot', "What's new on Olefoot today"),
        {
          body: L(
            'Atualizámos o ecrã inicial com um novo herói editorial, manchete dinâmica e um ticker de notícias. ' +
              'O botão JOGAR também ficou mais visível no menu central. ' +
              'Explora a home e diz-nos o que achaste.',
            'We updated the home screen with a new editorial hero, a dynamic headline and a news ticker. ' +
              'The PLAY button is also easier to find in the centre menu. ' +
              'Explore the home and tell us what you think.',
          ),
          deepLink: '/',
        },
      );
      dispatchGame({ type: 'INBOX_PREPEND', item: update });
    }

    const claimId = 'announce-claim-pack-2026-04-29';
    if (!inboxIds.has(claimId)) {
      const body = hasSquad
        ? emIngles()
          ? 'We launched the welcome Genesis Pack (11 starters + 9 subs + 500,000 EXP). ' +
            "Since you already have a squad, the pack isn't delivered automatically — if you want to start over and get the pack, " +
            'contact us at contact@olefoot.ai and we will reset your squad.'
          : 'Lançámos o Pack Genesis de boas-vindas (11 titulares + 9 reservas + 500.000 EXP). ' +
          'Como já tens plantel formado, o pack não é entregue automaticamente — se quiseres recomeçar e receber o pack, ' +
          'fala connosco em contact@olefoot.ai e fazemos o reset do teu plantel.'
        : emIngles()
          ? 'The welcome Genesis Pack (11 starters + 9 subs + 500,000 EXP) is available ' +
            'for your first squad. Go to Team to start.'
          : 'O Pack Genesis de boas-vindas (11 titulares + 9 reservas + 500.000 EXP) está disponível ' +
          'para o teu primeiro plantel. Vai a Equipe para começar.';
      const claim = makeInboxItem(claimId, 'SHOP_PACK', 'PLANTEL', L('Pack Genesis disponível', 'Genesis Pack available'), {
        body,
        deepLink: '/team',
      });
      dispatchGame({ type: 'INBOX_PREPEND', item: claim });
    }
  }, []);

  return null;
}
