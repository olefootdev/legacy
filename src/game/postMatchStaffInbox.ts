import type { LiveMatchSnapshot } from '@/engine/types';
import type { OlefootGameState } from './types';
import type { InboxItem } from './inboxTypes';
import { makeInboxItem } from './inboxItem';
import { L } from '@/i18n/L';

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
  const gkName = gk?.name ?? L('o guarda-redes', 'the goalkeeper');
  const gkId = gk?.playerId;

  if (conceded >= 2) {
    return makeInboxItem(
      `staff-gr-${Date.now()}`,
      'STAFF_ADVICE',
      'STAFF',
      L('Preparador de GR: golos evitáveis na última jornada', 'GK coach: avoidable goals last matchday'),
      {
        body: L(`Sugerimos treino mental focado em confiança e reação para **${gkName}** — vamos reforçar a concentração nos próximos dias.`, `We suggest mental training focused on confidence and reactions for **${gkName}** — we'll sharpen concentration over the next few days.`),
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
      L('Equipe técnica de performance mental', 'Mental performance staff'),
      {
        body:
          L('Notamos insegurança no grupo após o desgaste da última jornada. Sugerimos um treino mental em circuito para destravar o bloco.', 'We noticed insecurity in the group after last matchday\'s toll. We suggest a mental circuit session to unlock the team.'),
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
      L('Preparador físico: bloco pesado', 'Fitness coach: heavy legs'),
      {
        body:
          L('O ritmo de jogo pode estar a sofrer com a carga acumulada. Proponho treino físico coletivo para recuperar intensidade.', 'The match tempo may be suffering from accumulated load. I propose team fitness training to recover intensity.'),
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
      L('Análise tática: desalinhamento com o plano', 'Tactical analysis: off the game plan'),
      {
        body:
          L('Estamos previsíveis na saída de bola face ao estilo definido. Sugerimos treino tático com o grupo criativo.', 'We\'re predictable building from the back for our chosen style. We suggest tactical training with the creative group.'),
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
    L('Treinador: resenha da jornada', 'Coach: matchday review'),
    {
      body:
        L('Resumo interno: ajustámos detalhes táticos e estado físico. Reforçar finalização e compactação antes do próximo compromisso.', 'Internal summary: we adjusted tactical details and fitness. Work on finishing and compactness before the next fixture.'),
      staffRole: 'treinador',
      deepLink: '/team',
      hideFromHomeFeed: true,
    },
  );
}
