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
import { L } from '@/i18n/L';

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
        label: L('Suspenso', 'Suspended'),
        description: L('Cartão vermelho: 2h fora do clube. Aproximadamente 24 partidas perdidas.', 'Red card: 2h away from the club. Roughly 24 matches missed.'),
      },
      {
        kind: 'morale_drop_card',
        dimension: 'psychological',
        scope: 'player',
        magnitude: -5,
        durationHours: 120, // 5 dias
        decayCurve: 'linear',
        label: L('Moral abalado', 'Morale shaken'),
        description: L('Jogador frustrado pela expulsão. Recupera gradualmente em 5 dias.', 'Player frustrated by the red card. Recovers gradually over 5 days.'),
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
        label: L('Suspenso (reincidente)', 'Suspended (repeat)'),
        description: L('Segundo vermelho em 7 dias: 6h fora.', 'Second red in 7 days: 6h out.'),
      },
      {
        kind: 'salary_fine_5pct',
        dimension: 'financial',
        scope: 'player',
        magnitude: -0.05, // 5% do salário
        durationHours: 168, // 1 semana
        decayCurve: 'step',
        label: L('Multa interna 5%', 'Internal fine 5%'),
        description: L('Indisciplina recorrente — desconto na próxima folha.', 'Repeated indiscipline — deducted from next payroll.'),
      },
      {
        kind: 'market_value_drop_repeat',
        dimension: 'reputational',
        scope: 'player',
        magnitude: -0.02, // -2%
        durationHours: 336, // 14 dias
        decayCurve: 'linear',
        label: L('Valor de mercado -2%', 'Market value -2%'),
        description: L('Imprensa noticia o histórico. Clubes ficam reticentes.', 'The press reports the record. Clubs grow wary.'),
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
        label: L('Linha defensiva insegura', 'Shaky back line'),
        description: L('Defesa joga com receio nas próximas partidas.', 'The defence plays nervously in the next matches.'),
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
        label: L('Lesão leve', 'Minor injury'),
        description: L('Pancada/desconforto. 4h fora.', 'Knock/discomfort. 4h out.'),
      },
      {
        kind: 'physical_attr_drop_light',
        dimension: 'physical',
        scope: 'player',
        magnitude: -0.1, // -10% física
        durationHours: 8,
        decayCurve: 'exponential',
        label: L('Físico reduzido', 'Reduced fitness'),
        description: L('Volta com 10% menos de físico. Recupera em ~8h.', 'Returns with 10% less fitness. Recovers in ~8h.'),
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
        label: L('Lesão moderada', 'Moderate injury'),
        description: L('12h fora. Atravessa a noite regenerativa.', '12h out. Goes through the recovery night.'),
      },
      {
        kind: 'market_value_drop_injury_med',
        dimension: 'reputational',
        scope: 'player',
        magnitude: -0.02,
        durationHours: 336,
        decayCurve: 'linear',
        label: L('Valor de mercado -2%', 'Market value -2%'),
        description: L('Lesão repercute. 14 dias pra recuperar.', 'The injury echoes. 14 days to recover.'),
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
        label: L('Lesão grave', 'Serious injury'),
        description: L('2-3 dias fora. Mais de 500 partidas perdidas.', '2-3 days out. Over 500 matches missed.'),
      },
      {
        kind: 'morale_drop_injury_severe',
        dimension: 'psychological',
        scope: 'player',
        magnitude: -8,
        durationHours: 168,
        decayCurve: 'linear',
        label: L('Moral muito abalado', 'Morale badly shaken'),
        description: L('Jogador desanimado. Recupera em 7 dias.', 'Player downbeat. Recovers in 7 days.'),
      },
      {
        kind: 'team_morale_drop_star_injury',
        dimension: 'psychological',
        scope: 'club',
        magnitude: -2,
        durationHours: 72,
        decayCurve: 'linear',
        label: L('Time abalado', 'Team shaken'),
        description: L('Perda de jogador importante mexe com o vestiário.', 'Losing a key player rattles the dressing room.'),
      },
      {
        kind: 'market_value_drop_injury_severe',
        dimension: 'reputational',
        scope: 'player',
        magnitude: -0.05,
        durationHours: 720, // 30 dias
        decayCurve: 'linear',
        label: L('Valor de mercado -5%', 'Market value -5%'),
        description: L('Histórico de lesão pesa por 30 dias.', 'Injury record weighs for 30 days.'),
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
        label: L('Descanso obrigatório', 'Mandatory rest'),
        description: L('Fadiga ≥95%. Não pode jogar por 2h.', 'Fatigue ≥95%. Can\'t play for 2h.'),
      },
      {
        kind: 'injury_risk_spike',
        dimension: 'physical',
        scope: 'player',
        magnitude: 30, // +30 pontos de injury risk
        durationHours: 4,
        decayCurve: 'exponential',
        label: L('Risco lesão +30', 'Injury risk +30'),
        description: L('Esgotamento eleva risco. Cai pela metade a cada 2h.', 'Exhaustion raises the risk. Halves every 2h.'),
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
        label: L('Moral em alta', 'Morale high'),
        description: L('MVP da rodada. +6 moral por 3 dias.', 'Matchday MVP. +6 morale for 3 days.'),
      },
      {
        kind: 'market_interest_spike',
        dimension: 'reputational',
        scope: 'player',
        magnitude: 0.20, // +20% probabilidade de oferta
        durationHours: 168,
        decayCurve: 'linear',
        label: L('Interesse no mercado +20%', 'Market interest +20%'),
        description: L('Performance chama atenção. Ofertas chegam em 7 dias.', 'Performance draws attention. Offers arrive within 7 days.'),
      },
      {
        kind: 'market_value_boost_mvp',
        dimension: 'reputational',
        scope: 'player',
        magnitude: 0.02,
        durationHours: 168,
        decayCurve: 'linear',
        label: L('Valor +2%', 'Value +2%'),
        description: L('Valor de mercado sobe 2% por uma semana.', 'Market value up 2% for a week.'),
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
        label: L('Moral nas alturas', 'Morale sky-high'),
        description: L('Hat-trick! +10 moral por 5 dias.', 'Hat-trick! +10 morale for 5 days.'),
      },
      {
        kind: 'market_value_boost_hat_trick',
        dimension: 'reputational',
        scope: 'player',
        magnitude: 0.05,
        durationHours: 168,
        decayCurve: 'linear',
        label: L('Valor +5%', 'Value +5%'),
        description: L('Imprensa em peso. 7 dias de hype.', 'The press is all over it. 7 days of hype.'),
      },
      {
        kind: 'team_morale_boost_hat_trick',
        dimension: 'psychological',
        scope: 'club',
        magnitude: 5,
        durationHours: 48,
        decayCurve: 'linear',
        label: L('Time empolgado', 'Team fired up'),
        description: L('Vestiário inspirado. +5 moral coletivo por 2 dias.', 'Inspired dressing room. +5 team morale for 2 days.'),
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
        label: L('Torcida insatisfeita', 'Fans unhappy'),
        description: L('Goleada sofrida. Apoio cai 10% nas próximas partidas.', 'Heavy defeat. Support drops 10% in the next matches.'),
      },
      {
        kind: 'board_pressure_increase',
        dimension: 'reputational',
        scope: 'club',
        magnitude: 1, // pressão da diretoria (boolean-like)
        durationHours: 168,
        decayCurve: 'step',
        label: L('Diretoria pressiona', 'Board applies pressure'),
        description: L('Goleada vexatória. Diretoria observa por 7 dias.', 'Humiliating defeat. The board watches for 7 days.'),
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
        label: L('Time eufórico', 'Team euphoric'),
        description: L('Vitória no clássico! Time inspirado por 5 dias.', 'Derby win! Team inspired for 5 days.'),
      },
      {
        kind: 'fanbase_growth_classic',
        dimension: 'reputational',
        scope: 'club',
        magnitude: 0.03, // +3% fanbase
        durationHours: 720, // 30 dias
        decayCurve: 'linear',
        label: 'Fanbase +3%',
        description: L('Vitória atrai novos torcedores. +3% por 30 dias.', 'The win draws new fans. +3% for 30 days.'),
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

// ─── Busca reversa: kind da consequência → template ─────────────────────
//
// O `PersistentConsequence` guarda só o `kind` do template (ex.: 'red_card_suspension')
// — o `label` e o `description` ("por que isso aconteceu") ficam aqui, no catálogo.
// A UI precisava do caminho de volta pra explicar ao manager o que a partida
// causou, então este índice existe. Montado uma vez, na carga do módulo.

const TEMPLATE_BY_KIND: Record<string, ConsequenceTemplate> = (() => {
  const out: Record<string, ConsequenceTemplate> = {};
  for (const entry of Object.values(IMPACT_CATALOG)) {
    for (const tpl of [...(entry.player ?? []), ...(entry.club ?? [])]) {
      out[tpl.kind] = tpl;
    }
  }
  return out;
})();

/**
 * Devolve o template de um `kind` de consequência — a fonte do rótulo curto e
 * do texto longo de explicação. `undefined` para kinds que não nascem do
 * catálogo (ex.: 'crowd_support_drop' criado à mão por ausência).
 */
export function templateForKind(kind: string): ConsequenceTemplate | undefined {
  return TEMPLATE_BY_KIND[kind];
}
