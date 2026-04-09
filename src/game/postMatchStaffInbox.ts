import type { LiveMatchSnapshot } from '@/engine/types';
import type { OlefootGameState } from './types';
import type { InboxItem } from './inboxTypes';
import { makeInboxItem } from './inboxItem';

/**
 * Um conselho de staff após jornada (sem placar no título — consequência de gestão).
 * Prioridade: golos sofridos → derrota pesada (mental) → fadiga → aderência tática → resenha do treinador.
 */
export function buildPostMatchStaffInboxItem(
  state: OlefootGameState,
  lm: LiveMatchSnapshot,
): InboxItem {
  const conceded = lm.awayScore;
  const scored = lm.homeScore;
  const diff = conceded - scored;
  const heavyLoss = diff >= 3;
  const homeLoss = scored < conceded;

  const lineupIds = Object.values(lm.matchLineupBySlot ?? {}).filter(Boolean);
  const fats = lineupIds
    .map((pid) => state.players[pid]?.fatigue)
    .filter((x): x is number => typeof x === 'number');
  const avgFat = fats.length ? fats.reduce((a, b) => a + b, 0) / fats.length : 0;

  const gk = lm.homePlayers?.find((p) => p.role === 'gk');
  const gkName = gk?.name ?? 'o guarda-redes';
  const gkId = gk?.playerId;

  if (conceded >= 2) {
    return makeInboxItem(
      `staff-gr-${Date.now()}`,
      'STAFF_ADVICE',
      'STAFF',
      'Preparador de GR: golos evitáveis na última jornada',
      {
        body: `Sugerimos treino mental focado em confiança e reação para **${gkName}** — vamos reforçar a concentração nos próximos dias.`,
        staffRole: 'preparador_goleiros',
        relatedPlayerIds: gkId ? [gkId] : undefined,
        deepLink: '/team',
        hideFromHomeFeed: true,
      },
    );
  }

  if (heavyLoss || (homeLoss && avgFat > 72)) {
    return makeInboxItem(
      `staff-mental-${Date.now()}`,
      'STAFF_ADVICE',
      'STAFF',
      'Equipa técnica de performance mental',
      {
        body:
          'Notamos insegurança no grupo após o desgaste da última jornada. Sugerimos um treino mental em circuito para destravar o bloco.',
        staffRole: 'mental',
        deepLink: '/team',
        hideFromHomeFeed: true,
      },
    );
  }

  if (avgFat > 78) {
    return makeInboxItem(
      `staff-fis-${Date.now()}`,
      'STAFF_ADVICE',
      'STAFF',
      'Preparador físico: bloco pesado',
      {
        body:
          'O ritmo de jogo pode estar a sofrer com a carga acumulada. Proponho treino físico coletivo para recuperar intensidade.',
        staffRole: 'preparador_fisico',
        deepLink: '/team',
        hideFromHomeFeed: true,
      },
    );
  }

  const adh = lm.styleAdherence ?? 72;
  if (adh < 52) {
    return makeInboxItem(
      `staff-tat-${Date.now()}`,
      'STAFF_ADVICE',
      'STAFF',
      'Análise tática: desalinhamento com o plano',
      {
        body:
          'Estamos previsíveis na saída de bola face ao estilo definido. Sugerimos treino tático com o grupo criativo.',
        staffRole: 'tatico',
        deepLink: '/team',
        hideFromHomeFeed: true,
      },
    );
  }

  return makeInboxItem(
    `staff-head-${Date.now()}`,
    'STAFF_ADVICE',
    'STAFF',
    'Treinador: resenha da jornada',
    {
      body:
        'Resumo interno: ajustámos detalhes táticos e estado físico. Reforçar finalização e compactação antes do próximo compromisso.',
      staffRole: 'treinador',
      deepLink: '/team',
      hideFromHomeFeed: true,
    },
  );
}
