/**
 * MatchPlan — schema do plano de partida pré-computado pelo Python.
 *
 * O endpoint backend `POST /api/match/quick-plan` invoca o simulador Python
 * (smartfield/match_simulator.py) e devolve este objeto. O TS renderiza ele
 * em ~25s, animando cada evento com timing definido pelo `weightTier`.
 *
 * Determinístico: mesmo `seed` + lineups = mesmo plan (replay coerente).
 */

export type MatchEventKind =
  | 'goal_home' | 'goal_away'
  | 'shot_home' | 'shot_away'
  | 'chance_home' | 'chance_away'       // cara a cara perdido (quase-gol)
  | 'save_home' | 'save_away'           // defensaça do goleiro
  | 'woodwork_home' | 'woodwork_away'   // bola na trave
  | 'counter_home' | 'counter_away'     // contra-ataque perigoso
  | 'corner_home' | 'corner_away'       // escanteio
  | 'buildup_home' | 'buildup_away'     // construção / posse trabalhada
  | 'yellow_home' | 'yellow_away'
  | 'red_home' | 'red_away'
  | 'injury_home' | 'injury_away'
  | 'penalty_home' | 'penalty_away'
  | 'narrative';

export type MatchEventTier = 'epic' | 'big' | 'normal' | 'minor';

export type FieldZone = 'def' | 'mid' | 'att';

export type NarrativeArc =
  | 'underdog_fight'
  | 'dominant_control'
  | 'late_drama'
  | 'collapse'
  | 'balanced';

/** Canais de confronto setorial da Matchup Matrix (Fase A — Quick 2.0). */
export type MatchupChannel =
  | 'ataque_central'
  | 'corredor_esquerdo'
  | 'corredor_direito'
  | 'criacao'
  | 'bola_parada'
  | 'finalizacao_vs_gk'
  | 'pressao';

export interface MatchupChannelEntry {
  att: number;
  def: number;
  /** -1..+1 — positivo = vantagem do atacante nesse canal. */
  edge: number;
  label: string;
}

export interface MatchupMatrix {
  home: Record<MatchupChannel, MatchupChannelEntry>;
  away: Record<MatchupChannel, MatchupChannelEntry>;
}

/** Tier de efeito de uma escolha: 3 sempre presentes (neutro/positivo/negativo). */
export type ChoiceEffect = 'positive' | 'neutral' | 'negative';

export interface AnalystBeatChoice {
  id: string;
  label: string;
  channel: MatchupChannel;
  /** 'home' = mexe no xG do próprio time; 'away' = escolha defensiva (reduz xG deles). */
  target_side: 'home' | 'away';
  /** Peso calculado pelo Python a partir dos edges reais. Negativo = armadilha. */
  weight: number;
  /** Tier do efeito (neutro 0% / positivo +2.5% / negativo −2.5%). A resposta certa
   *  é INFERÍVEL do texto — o tier NÃO é exibido nos botões. */
  effect?: ChoiceEffect;
}

export interface AnalystBeat {
  id: string;
  minute: number;
  half: 1 | 2;
  /** Contexto do momento: ataque (fazer gol), defesa (salvar gol) ou leitura. */
  intent?: 'attack' | 'defend' | 'neutral';
  insight: {
    text: string;
    primary_channel: MatchupChannel;
    threat_channel: MatchupChannel;
    momentum_trend: 'rising' | 'falling' | 'stable';
  };
  choices: AnalystBeatChoice[];
  window_ms: number;
}

/** Decisão tomada pelo manager — ecoa de volta os pesos que o Python calculou. */
export interface QuickPlanDecision {
  beat_id: string;
  choice_id: string;
  channel: MatchupChannel;
  target_side: 'home' | 'away';
  weight: number;
}

/** Estado do 1º tempo enviado no replan (mode: 'second_half'). */
export interface QuickPlanFirstHalfState {
  home_score: number;
  away_score: number;
  momentum_end?: number;
  cards_home?: number;
  cards_away?: number;
  sent_off_home?: number;
  sent_off_away?: number;
}

/**
 * PARTIDA VIVA (Fase 2) — como o lance aconteceu, contado pelo servidor
 * (`server/smartfield/cadeia_lances.py`). Pontos em METROS no referencial do
 * campo: x 0–105 (gol da casa → gol visitante), z 0–68; a casa ataca para +x.
 * A cadeia NUNCA muda o resultado: o desfecho visual sai do `kind` do evento.
 */
export type TipoAcaoDeLance =
  | 'passe' | 'lancamento' | 'cruzamento' | 'conducao' | 'drible' | 'desarme'
  | 'falta' | 'desvio' | 'escanteio' | 'cobranca' | 'chute' | 'cabeceio';

export interface AcaoDeLance {
  t: TipoAcaoDeLance;
  /** Quem faz (em `falta`/`desvio`, alguém do time que defende). */
  de: string;
  /** Receptor (passe) ou rival (drible/desarme/falta). */
  para: string | null;
  x: number;
  z: number;
}

export interface CadeiaDeLance {
  inicio: { x: number; z: number };
  acoes: AcaoDeLance[];
  finalizacao: 'chute' | 'cabeceio' | 'cobranca' | null;
}

export interface MatchPlanEvent {
  minute: number;
  kind: MatchEventKind;
  actor_id?: string;
  /** Nome do protagonista (v1.1+) — usado na comemoração de gol. */
  actor_name?: string;
  actor_side: 'home' | 'away';
  xg?: number;
  weight_tier: MatchEventTier;
  zone: FieldZone;
  /** Canal da Matchup Matrix de onde a jogada nasceu (chutes/gols, v1.1+). */
  channel?: MatchupChannel;
  /** Justificativa setorial humana-pronta ("corredor esquerdo dominado"). */
  reason?: string;
  /** Marcado client-side quando uma decisão do manager alterou o desfecho. */
  decision_influenced?: boolean;
  /** Gol: quem o simulador conta como assistência (Partida Viva). */
  assist_id?: string;
  /** Partida Viva (Fase 2): a jogada, toque a toque. */
  cadeia?: CadeiaDeLance;
  text: string;
}

export interface MatchPlanMvp {
  player_id: string;
  name: string;
  rating: number;
  goals: number;
  assists: number;
}

export interface MatchPlan {
  version: '1.0' | '1.1';
  seed: string;
  /** 'full' = 90'; 'second_half' = replan dos minutos 46-90 (v1.1+). */
  mode?: 'full' | 'second_half' | 'from_minute';
  /** Id da custódia no servidor (SMART-PROFILE 2B). Só existe com manager logado. */
  plano_id?: string | null;
  /** 1 no full; 46 no replan de 2º tempo (v1.1+). */
  start_minute?: number;
  home_short: string;
  away_short: string;
  home_score: number;
  away_score: number;
  events: MatchPlanEvent[];
  momentum_curve: number[]; // 0-100 perspectiva home (90 valores full; 45 no second_half)
  /** Cruzamento setorial dos 22 jogadores — fonte dos beats e do gating de gol (v1.1+). */
  matchup_matrix?: MatchupMatrix;
  /** Leituras do Analista com decisões pesadas (v1.1+). */
  analyst_beats?: AnalystBeat[];
  mvp_projection: MatchPlanMvp | null;
  /** Partida Viva (Fase 3): classe do SMART-PROFILE de cada jogador em campo (id → classe). */
  classes?: Record<string, string>;
  /** Posse REAL da casa (% de minutos com a bola) — substitui o proxy de momento. */
  possession_home_pct?: number;
  narrative_arc: NarrativeArc;
  generated_at_ms: number;
  duration_ms: number;
}

/** Duração em ms da animação de cada tier. Ritmo CALMO (~55-60s): o jogo
 *  respira pela barra de momento, cada lance tem espaço. Anti-frenético. */
export const TIER_ANIMATION_MS: Record<MatchEventTier, number> = {
  epic: 3400,
  big: 2300,
  normal: 1500,
  minor: 1000,
};

/** Tempo total estimado de render condensado de um plan completo. */
export function estimateRenderDurationMs(plan: MatchPlan): number {
  return plan.events.reduce((sum, e) => sum + TIER_ANIMATION_MS[e.weight_tier], 0);
}
