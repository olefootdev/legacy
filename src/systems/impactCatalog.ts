/**
 * OLEFOOT PYTHON MODE — Catálogo de impactos calibrado em HORAS REAIS.
 *
 * Cada evento de partida (cartão vermelho, lesão, MVP, etc.) gera N
 * consequências persistentes, cada uma com sua dimensão, magnitude e decay.
 * A duração é em HORAS REAIS — não em rodadas — pra manter peso real
 * mesmo com cadência de 12 partidas/hora.
 *
 * Calibração travada na conversa de design (2026-05-25):
 *   - Vermelho:       2h fora  (~24 partidas perdidas)
 *   - Lesão grave:    2-3 dias (~500+ partidas)
 *   - Manager precisa SENTIR a consequência, não só ler texto.
 */

export type ConsequenceDimension =
  | 'physical'      // fadiga, lesão, suspensão
  | 'psychological' // moral, confiança individual/coletiva
  | 'reputational'  // valor de mercado, headlines, interesse de clubes
  | 'financial';    // bilheteria, multa, patrocínio

export type DecayCurve =
  | 'step'        // valor constante até expirar, então some
  | 'linear'      // lerp linear de magnitude → 0
  | 'exponential' // half-life: ~50% em metade do tempo
  ;

export type ConsequenceScope = 'player' | 'club';

export type ImpactEventKind =
  | 'red_card_direct'
  | 'red_card_repeat_7d'
  | 'injury_light'
  | 'injury_medium'
  | 'injury_severe'
  | 'exhaustion'
  | 'mvp_of_round'
  | 'hat_trick'
  | 'heavy_defeat'
  | 'classic_win';

export interface ConsequenceTemplate {
  /** Identificador estável (ex.: 'red_card_suspension'). UI usa para agrupar. */
  kind: string;
  dimension: ConsequenceDimension;
  scope: ConsequenceScope;
  /** Valor base aplicado em t=0. Positivo = bônus; negativo = penalidade. */
  magnitude: number;
  durationHours: number;
  decayCurve: DecayCurve;
  /** Label curto pt-BR pra UI / digest cards. */
  label: string;
  /** Texto longo pra "Por que isso aconteceu?" tooltip. */
  description: string;
}

export interface ImpactCatalogEntry {
  event: ImpactEventKind;
  /** Consequências aplicadas no jogador-alvo do evento. */
  player?: ConsequenceTemplate[];
  /** Consequências aplicadas no clube. */
  club?: ConsequenceTemplate[];
}

// ─── Catálogo ──────────────────────────────────────────────────────

export const IMPACT_CATALOG: Record<ImpactEventKind, ImpactCatalogEntry> = {
  red_card_direct: {
    event: 'red_card_direct',
    player: [
      {
        kind: 'red_card_suspension',
        dimension: 'physical',
        scope: 'player',
        magnitude: 1, // boolean-like: 1 = indisponível
        durationHours: 2,
        decayCurve: 'step',
        label: 'Suspenso',
        description: 'Cartão vermelho: 2h fora do clube. Aproximadamente 24 partidas perdidas.',
      },
      {
        kind: 'morale_drop_card',
        dimension: 'psychological',
        scope: 'player',
        magnitude: -5,
        durationHours: 120, // 5 dias
        decayCurve: 'linear',
        label: 'Moral abalado',
        description: 'Jogador frustrado pela expulsão. Recupera gradualmente em 5 dias.',
      },
    ],
  },

  red_card_repeat_7d: {
    event: 'red_card_repeat_7d',
    player: [
      {
        kind: 'red_card_suspension_repeat',
        dimension: 'physical',
        scope: 'player',
        magnitude: 1,
        durationHours: 6,
        decayCurve: 'step',
        label: 'Suspenso (reincidente)',
        description: 'Segundo vermelho em 7 dias: 6h fora.',
      },
      {
        kind: 'salary_fine_5pct',
        dimension: 'financial',
        scope: 'player',
        magnitude: -0.05, // 5% do salário
        durationHours: 168, // 1 semana
        decayCurve: 'step',
        label: 'Multa interna 5%',
        description: 'Indisciplina recorrente — desconto na próxima folha.',
      },
      {
        kind: 'market_value_drop_repeat',
        dimension: 'reputational',
        scope: 'player',
        magnitude: -0.02, // -2%
        durationHours: 336, // 14 dias
        decayCurve: 'linear',
        label: 'Valor de mercado -2%',
        description: 'Imprensa noticia o histórico. Clubes ficam reticentes.',
      },
    ],
    club: [
      {
        kind: 'defense_confidence_drop',
        dimension: 'psychological',
        scope: 'club',
        magnitude: -3,
        durationHours: 10, // ~2 partidas (com cadência atual: 120 partidas, mas decay mais curto)
        decayCurve: 'step',
        label: 'Linha defensiva insegura',
        description: 'Defesa joga com receio nas próximas partidas.',
      },
    ],
  },

  injury_light: {
    event: 'injury_light',
    player: [
      {
        kind: 'injury_light_out',
        dimension: 'physical',
        scope: 'player',
        magnitude: 1,
        durationHours: 4,
        decayCurve: 'step',
        label: 'Lesão leve',
        description: 'Pancada/desconforto. 4h fora.',
      },
      {
        kind: 'physical_attr_drop_light',
        dimension: 'physical',
        scope: 'player',
        magnitude: -0.1, // -10% física
        durationHours: 8,
        decayCurve: 'exponential',
        label: 'Físico reduzido',
        description: 'Volta com 10% menos de físico. Recupera em ~8h.',
      },
    ],
  },

  injury_medium: {
    event: 'injury_medium',
    player: [
      {
        kind: 'injury_medium_out',
        dimension: 'physical',
        scope: 'player',
        magnitude: 1,
        durationHours: 12,
        decayCurve: 'step',
        label: 'Lesão moderada',
        description: '12h fora. Atravessa a noite regenerativa.',
      },
      {
        kind: 'market_value_drop_injury_med',
        dimension: 'reputational',
        scope: 'player',
        magnitude: -0.02,
        durationHours: 336,
        decayCurve: 'linear',
        label: 'Valor de mercado -2%',
        description: 'Lesão repercute. 14 dias pra recuperar.',
      },
    ],
  },

  injury_severe: {
    event: 'injury_severe',
    player: [
      {
        kind: 'injury_severe_out',
        dimension: 'physical',
        scope: 'player',
        magnitude: 1,
        durationHours: 60, // 2.5 dias
        decayCurve: 'step',
        label: 'Lesão grave',
        description: '2-3 dias fora. Mais de 500 partidas perdidas.',
      },
      {
        kind: 'morale_drop_injury_severe',
        dimension: 'psychological',
        scope: 'player',
        magnitude: -8,
        durationHours: 168,
        decayCurve: 'linear',
        label: 'Moral muito abalado',
        description: 'Jogador desanimado. Recupera em 7 dias.',
      },
      {
        kind: 'team_morale_drop_star_injury',
        dimension: 'psychological',
        scope: 'club',
        magnitude: -2,
        durationHours: 72,
        decayCurve: 'linear',
        label: 'Time abalado',
        description: 'Perda de jogador importante mexe com o vestiário.',
      },
      {
        kind: 'market_value_drop_injury_severe',
        dimension: 'reputational',
        scope: 'player',
        magnitude: -0.05,
        durationHours: 720, // 30 dias
        decayCurve: 'linear',
        label: 'Valor de mercado -5%',
        description: 'Histórico de lesão pesa por 30 dias.',
      },
    ],
  },

  exhaustion: {
    event: 'exhaustion',
    player: [
      {
        kind: 'forced_rest',
        dimension: 'physical',
        scope: 'player',
        magnitude: 1,
        durationHours: 2,
        decayCurve: 'step',
        label: 'Descanso obrigatório',
        description: 'Fadiga ≥95%. Não pode jogar por 2h.',
      },
      {
        kind: 'injury_risk_spike',
        dimension: 'physical',
        scope: 'player',
        magnitude: 30, // +30 pontos de injury risk
        durationHours: 4,
        decayCurve: 'exponential',
        label: 'Risco lesão +30',
        description: 'Esgotamento eleva risco. Cai pela metade a cada 2h.',
      },
    ],
  },

  mvp_of_round: {
    event: 'mvp_of_round',
    player: [
      {
        kind: 'morale_boost_mvp',
        dimension: 'psychological',
        scope: 'player',
        magnitude: 6,
        durationHours: 72,
        decayCurve: 'linear',
        label: 'Moral em alta',
        description: 'MVP da rodada. +6 moral por 3 dias.',
      },
      {
        kind: 'market_interest_spike',
        dimension: 'reputational',
        scope: 'player',
        magnitude: 0.20, // +20% probabilidade de oferta
        durationHours: 168,
        decayCurve: 'linear',
        label: 'Interesse no mercado +20%',
        description: 'Performance chama atenção. Ofertas chegam em 7 dias.',
      },
      {
        kind: 'market_value_boost_mvp',
        dimension: 'reputational',
        scope: 'player',
        magnitude: 0.02,
        durationHours: 168,
        decayCurve: 'linear',
        label: 'Valor +2%',
        description: 'Valor de mercado sobe 2% por uma semana.',
      },
    ],
  },

  hat_trick: {
    event: 'hat_trick',
    player: [
      {
        kind: 'morale_boost_hat_trick',
        dimension: 'psychological',
        scope: 'player',
        magnitude: 10,
        durationHours: 120,
        decayCurve: 'linear',
        label: 'Moral nas alturas',
        description: 'Hat-trick! +10 moral por 5 dias.',
      },
      {
        kind: 'market_value_boost_hat_trick',
        dimension: 'reputational',
        scope: 'player',
        magnitude: 0.05,
        durationHours: 168,
        decayCurve: 'linear',
        label: 'Valor +5%',
        description: 'Imprensa em peso. 7 dias de hype.',
      },
      {
        kind: 'team_morale_boost_hat_trick',
        dimension: 'psychological',
        scope: 'club',
        magnitude: 5,
        durationHours: 48,
        decayCurve: 'linear',
        label: 'Time empolgado',
        description: 'Vestiário inspirado. +5 moral coletivo por 2 dias.',
      },
    ],
  },

  heavy_defeat: {
    event: 'heavy_defeat',
    club: [
      {
        kind: 'crowd_support_drop',
        dimension: 'psychological',
        scope: 'club',
        magnitude: -10, // -10% apoio torcida
        durationHours: 10, // ~2 partidas em cadência alta, mas decay temporal
        decayCurve: 'step',
        label: 'Torcida insatisfeita',
        description: 'Goleada sofrida. Apoio cai 10% nas próximas partidas.',
      },
      {
        kind: 'board_pressure_increase',
        dimension: 'reputational',
        scope: 'club',
        magnitude: 1, // pressão da diretoria (boolean-like)
        durationHours: 168,
        decayCurve: 'step',
        label: 'Diretoria pressiona',
        description: 'Goleada vexatória. Diretoria observa por 7 dias.',
      },
    ],
  },

  classic_win: {
    event: 'classic_win',
    club: [
      {
        kind: 'team_morale_classic_win',
        dimension: 'psychological',
        scope: 'club',
        magnitude: 10,
        durationHours: 120,
        decayCurve: 'linear',
        label: 'Time eufórico',
        description: 'Vitória no clássico! Time inspirado por 5 dias.',
      },
      {
        kind: 'fanbase_growth_classic',
        dimension: 'reputational',
        scope: 'club',
        magnitude: 0.03, // +3% fanbase
        durationHours: 720, // 30 dias
        decayCurve: 'linear',
        label: 'Fanbase +3%',
        description: 'Vitória atrai novos torcedores. +3% por 30 dias.',
      },
    ],
  },
};

/** Helper: pega templates de um evento. */
export function getCatalogEntry(event: ImpactEventKind): ImpactCatalogEntry {
  return IMPACT_CATALOG[event];
}

/** Lista todos os kinds conhecidos. */
export function listImpactKinds(): ImpactEventKind[] {
  return Object.keys(IMPACT_CATALOG) as ImpactEventKind[];
}
