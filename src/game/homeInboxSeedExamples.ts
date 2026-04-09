import { makeInboxItem } from './inboxItem';
import type { InboxItem } from './inboxTypes';

/**
 * Exemplos de notificações para a HOME (painel Notificações).
 * Foco em gestão do clube — sem placares nem resultados de partida (isso fica noutras áreas).
 */
export function createHomeInboxSeedExamples(): InboxItem[] {
  return [
    makeInboxItem('demo-conta-1', 'SOCIAL_FRIEND_INVITE', 'CONTA', 'WOLVES quer entrar na sua rede de managers', {
      kind: 'friend_invite',
      friendRequestId: 'fr-seed-wolves',
      tag: 'CONTA',
      colorClass: 'text-fuchsia-400',
      timeLabel: 'Agora',
    }),

    makeInboxItem(
      'demo-fin-1',
      'FINANCE_BRO_MOVEMENT',
      'FINANCEIRO',
      'Tesouraria: previsão de fluxo BRO atualizada.',
      {
        timeLabel: '16:10',
        body: 'Reforço de saldo após operações internas; conferir extrato na carteira.',
        deepLink: '/wallet',
      },
    ),

    makeInboxItem(
      'demo-clube-1',
      'STRUCTURE_UPGRADED',
      'CLUBE',
      'Clube: melhoria na Megaloja concluída.',
      {
        timeLabel: '15:40',
        body: 'Equipa comercial reporta maior capacidade de merchandising — revisão de preços sugerida.',
        deepLink: '/city',
      },
    ),

    makeInboxItem(
      'demo-missao-1',
      'MISSION_NEW',
      'MISSÃO',
      'Missão: elevar o centro de treino um nível.',
      {
        timeLabel: '15:00',
        body: 'Objetivo de longo prazo; recompensas em EXP ao concluir.',
        deepLink: '/missions',
      },
    ),

    makeInboxItem(
      'demo-staff-1',
      'STAFF_ADVICE',
      'STAFF',
      'Fisioterapia: revisão de carga do grupo.',
      {
        timeLabel: '14:25',
        body: 'Alguns titulares com fadiga acima do alvo — ajustar microciclos antes da próxima deslocação.',
        advisorLabel: 'Staff médico',
        deepLink: '/team/staff',
      },
    ),

    makeInboxItem(
      'demo-staff-2',
      'STAFF_LEVEL_UP',
      'STAFF',
      'Departamento: analista de desempenho promovido.',
      {
        timeLabel: '13:50',
        body: 'Novos relatórios de métricas disponíveis para o corpo técnico.',
        deepLink: '/team/staff',
      },
    ),

    makeInboxItem(
      'demo-torcida-1',
      'CROWD_MOOD',
      'TORCIDA',
      'Torcida: apoio estável nas últimas semanas.',
      {
        timeLabel: '12:30',
        body: 'Comunicação com grupos de apoio positiva; manter campanhas de sócio ativo.',
        deepLink: '/city',
      },
    ),

    makeInboxItem(
      'demo-torcida-2',
      'REPUTATION',
      'TORCIDA',
      'Relação com adeptos: inscrições para o programa de sócios.',
      {
        timeLabel: '11:00',
        body: 'Janela de renovação antecipada aberta; bilhética alinhada com marketing.',
        deepLink: '/city',
      },
    ),

    makeInboxItem(
      'demo-pl-1',
      'PLAYER_BOUGHT',
      'PLANTEL',
      'Plantel: contratação homologada pelo departamento jurídico.',
      {
        timeLabel: '10:20',
        body: 'Novo avançado integrado às opções de convocatória e treinos.',
        deepLink: '/team',
      },
    ),

    makeInboxItem(
      'demo-pl-2',
      'PLAYER_CONTRACT',
      'PLANTEL',
      'Plantel: médio renova vínculo até 2028.',
      {
        timeLabel: '09:45',
        body: 'Cláusulas de desempenho atualizadas; documentação arquivada.',
        deepLink: '/team',
      },
    ),

    makeInboxItem(
      'demo-tr-1',
      'TRAINING_COMPLETED',
      'TREINO',
      'Treino: relatório de recuperação do grupo.',
      {
        timeLabel: '09:10',
        body: 'Nutrição destaca boa adesão ao plano de hidratação; manter vigilância nos deslocamentos.',
        advisorLabel: 'Equipa de bem-estar',
        staffRole: 'nutricao',
        deepLink: '/team/treino',
      },
    ),

    makeInboxItem(
      'demo-tr-2',
      'TRAINING_PLAN_STARTED',
      'TREINO',
      'Treino: plano coletivo de resistência iniciado.',
      {
        timeLabel: 'Ontem',
        body: 'Duração e carga definidas pelo preparador físico; acompanhar no separador de treino.',
        deepLink: '/team/treino',
      },
    ),

    makeInboxItem(
      'demo-comp-1',
      'CUP_DRAW',
      'COMPETIÇÃO',
      'Taça: sorteio da fase seguinte publicado.',
      {
        timeLabel: 'Ontem',
        body: 'Confronto e datas administrativas na página da competição — preparar logística e inscrições.',
        deepLink: '/leagues',
      },
    ),

    makeInboxItem(
      'demo-comp-2',
      'FIXTURE_REMINDER',
      'COMPETIÇÃO',
      'Competição: prazo para boletim de jogadores.',
      {
        timeLabel: 'Ontem',
        body: 'Envio de lista elegível ao regulamento; sem informação de resultado aqui — só calendário e requisitos.',
        deepLink: '/leagues',
      },
    ),

    makeInboxItem(
      'demo-comp-3',
      'LEAGUE_POSITION',
      'COMPETIÇÃO',
      'Liga: classificação geral atualizada.',
      {
        timeLabel: '2d',
        body: 'Tabela e próximos compromissos na área de competição. Placares e resumos de partida ficam no histórico de jogos.',
        deepLink: '/leagues',
      },
    ),

    makeInboxItem(
      'demo-empresa-1',
      'COMPANY_ANNOUNCEMENT',
      'EMPRESA',
      'Empresa: manutenção programada da plataforma.',
      {
        timeLabel: '3d',
        body: 'Janela curta fora do horário de pico; wallet e loja podem ficar em só leitura.',
        deepLink: '/config',
      },
    ),
  ];
}
