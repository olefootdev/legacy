/**
 * Visões das consequências persistentes para a página SCOUTS — 100% LOCAL.
 *
 * Até 2026-10-05 estas visões vinham do serviço Python `/insights` (FastAPI no
 * Railway), que só lia `club_consequences` do Supabase e devolvia resumos. O
 * serviço foi APOSENTADO: o jogo já tem as mesmas consequências no store local
 * (`consequenceStore`), então tudo aqui é derivado delas, sem rede.
 *
 * Semântica espelhada de `insights/app/routes/consequences.py`,
 * `insights/app/routes/player.py` e `insights/app/explanations.py`.
 *
 * Os shapes mantêm snake_case (eram o contrato JSON do Python) pra não mexer
 * na UI que já os consome.
 */
import { L } from '@/i18n/L';
import { templateForKind } from '@/systems/impactCatalog';
import type {
  ConsequenceDimension,
  ConsequenceScope,
  DecayCurve as CatalogDecayCurve,
} from '@/systems/impactCatalog';
import type { EvaluatedConsequence } from '@/systems/consequences/types';

// ─── Types ─────────────────────────────────────────────────────────

export type Dimension = ConsequenceDimension;
export type DecayCurve = CatalogDecayCurve;
export type Scope = ConsequenceScope;

export interface ConsequenceView {
  id: string;
  manager_id: string;
  club_id: string;
  player_id: string | null;
  kind: string;
  dimension: Dimension;
  scope: Scope;
  magnitude: number;
  decay_curve: DecayCurve;
  starts_at: string;
  expires_at: string;
  source_event_id: string | null;
  metadata: Record<string, unknown> | null;
}

export interface EvaluatedConsequenceView {
  consequence: ConsequenceView;
  current_value: number;
  life_remaining: number;
  ms_until_expiry: number;
}

export interface ConsequencesByDimension {
  physical: EvaluatedConsequenceView[];
  psychological: EvaluatedConsequenceView[];
  reputational: EvaluatedConsequenceView[];
  financial: EvaluatedConsequenceView[];
}

export interface ClubSummary {
  total_active: number;
  unavailable_players: number;
  alerts: number;
  celebrations: number;
  next_expiry_at: string | null;
  most_impacted_player_id: string | null;
}

export type Severity = 'info' | 'alert' | 'celebration' | 'neutral';
export type TimelineEventKind = 'consequence_applied' | 'consequence_expired';

export interface ExplainedConsequence extends EvaluatedConsequenceView {
  title: string;
  subtitle: string;
  severity: Severity;
}

export interface PlayerTimelineEvent {
  at: string;
  kind: TimelineEventKind;
  consequence_id: string;
  source_event_id: string | null;
  title: string;
  subtitle: string;
  severity: Severity;
  dimension: Dimension;
  magnitude: number;
}

export interface PlayerTransparency {
  player_id: string;
  active: ExplainedConsequence[];
  timeline: PlayerTimelineEvent[];
  total_active: number;
  is_unavailable: boolean;
  most_recent_event_at: string | null;
}

export interface SquadPlayerEntry {
  player_id: string;
  active_count: number;
  alerts: number;
  celebrations: number;
  is_unavailable: boolean;
  next_expiry_at: string | null;
  dominant_dimension: Dimension | null;
}

export interface SquadOverview {
  generated_at: string;
  players: SquadPlayerEntry[];
  total_players_affected: number;
  total_unavailable: number;
}

// ─── Regras ────────────────────────────────────────────────────────

/** Kinds que tiram o jogador da escalação (espelha store.ts / Python). */
export const UNAVAILABILITY_KINDS: ReadonlySet<string> = new Set([
  'red_card_suspension',
  'red_card_suspension_repeat',
  'injury_light_out',
  'injury_medium_out',
  'injury_severe_out',
  'forced_rest',
]);

interface Explanation {
  title: string;
  subtitle: string;
  severity: Severity;
}

/** Catálogo `kind` → frase humana (porte de insights/app/explanations.py). */
function catalogExplanation(kind: string): Explanation | null {
  switch (kind) {
    // Física: lesões e fadiga
    case 'injury_light_out':
      return {
        title: L('Lesão muscular leve', 'Minor muscle injury'),
        subtitle: L('Afastado por algumas partidas; treinos limitados.', 'Out for a few matches; limited training.'),
        severity: 'alert',
      };
    case 'injury_medium_out':
      return {
        title: L('Lesão de média gravidade', 'Moderate injury'),
        subtitle: L(
          'Afastado por várias partidas; reabilitação no Departamento Médico.',
          'Out for several matches; rehab with the medical staff.',
        ),
        severity: 'alert',
      };
    case 'injury_severe_out':
      return {
        title: L('Lesão grave', 'Serious injury'),
        subtitle: L(
          'Longo período de recuperação; perda significativa de forma física.',
          'Long recovery period; significant loss of fitness.',
        ),
        severity: 'alert',
      };
    case 'exhaustion':
      return {
        title: L('Exaustão pós-partida', 'Post-match exhaustion'),
        subtitle: L(
          'Mais de 12km percorridos — fadiga acumulada exige descanso.',
          'Over 12km covered — accumulated fatigue calls for rest.',
        ),
        severity: 'alert',
      };
    case 'forced_rest':
      return {
        title: L('Descanso forçado', 'Forced rest'),
        subtitle: L('Fadiga crítica; treinador determinou pausa.', 'Critical fatigue; the coach ordered a break.'),
        severity: 'neutral',
      };
    // Disciplina: cartões
    case 'red_card_suspension':
      return {
        title: L('Suspenso por cartão vermelho', 'Suspended for a red card'),
        subtitle: L(
          'Expulso na última partida; fica fora da próxima rodada.',
          'Sent off in the last match; misses the next round.',
        ),
        severity: 'alert',
      };
    case 'red_card_suspension_repeat':
      return {
        title: L('Reincidência de vermelho', 'Repeat red card'),
        subtitle: L(
          'Segundo vermelho em 7 dias; suspensão estendida + multa do clube.',
          'Second red in 7 days; extended suspension + club fine.',
        ),
        severity: 'alert',
      };
    // Psicológica: moral
    case 'morale_boost_mvp':
      return {
        title: L('Moral elevada (MVP)', 'Morale up (MVP)'),
        subtitle: L(
          'Eleito o melhor em campo; confiança aumentada nas próximas partidas.',
          'Named man of the match; extra confidence for the next matches.',
        ),
        severity: 'celebration',
      };
    case 'morale_boost_hat_trick':
      return {
        title: L('Moral elevada (hat-trick)', 'Morale up (hat-trick)'),
        subtitle: L(
          'Três gols marcados; confiança nas finalizações disparou.',
          'Three goals scored; finishing confidence soared.',
        ),
        severity: 'celebration',
      };
    case 'morale_drop_card':
      return {
        title: L('Moral abalada (cartão)', 'Morale shaken (card)'),
        subtitle: L(
          'Punição visível afetou a concentração nos próximos jogos.',
          'A visible punishment hurt focus for the next matches.',
        ),
        severity: 'alert',
      };
    case 'morale_drop_heavy_defeat':
      return {
        title: L('Moral abalada (goleada)', 'Morale shaken (heavy defeat)'),
        subtitle: L(
          'Derrota pesada com saldo desfavorável; todo o grupo afetado.',
          'Heavy defeat; the whole squad is affected.',
        ),
        severity: 'alert',
      };
    case 'morale_boost_classic_win':
      return {
        title: L('Moral elevada (vitória em clássico)', 'Morale up (derby win)'),
        subtitle: L(
          'Vitória em clássico carrega o elenco — bônus de confiança no grupo.',
          'A derby win lifts the squad — confidence boost for the group.',
        ),
        severity: 'celebration',
      };
    // Reputacional: mercado e imagem
    case 'market_interest_spike':
      return {
        title: L('Interesse do mercado disparou', 'Market interest spiked'),
        subtitle: L(
          'Atuação chamativa atraiu olhares de outros clubes.',
          'A standout display caught the eye of other clubs.',
        ),
        severity: 'celebration',
      };
    case 'market_value_boost_mvp':
      return {
        title: L('Valor de mercado em alta', 'Market value rising'),
        subtitle: L(
          'Performance MVP refletiu no preço; valorização registrada.',
          'The MVP performance showed in the price; value went up.',
        ),
        severity: 'celebration',
      };
    // Financeira
    case 'fine_red_card':
      return {
        title: L('Multa por expulsão', 'Fine for a sending-off'),
        subtitle: L(
          'Clube aplicou multa contratual pelo cartão vermelho.',
          'The club applied a contractual fine for the red card.',
        ),
        severity: 'alert',
      };
    default:
      return null;
  }
}

/** Kinds cuja magnitude positiva é MÁ notícia (risco, pressão). */
const POSITIVE_BUT_BAD = /(risk|pressure)/;

/**
 * Severidade de uma consequência — usada pra contar alertas e celebrações.
 * Catálogo primeiro; senão pelo kind/sinal da magnitude.
 */
export function severityOf(kind: string, magnitude: number): Severity {
  const cat = catalogExplanation(kind);
  if (cat) return cat.severity;
  if (UNAVAILABILITY_KINDS.has(kind)) return 'alert';
  if (magnitude < 0) return 'alert';
  if (magnitude > 0) return POSITIVE_BUT_BAD.test(kind) ? 'alert' : 'celebration';
  return 'neutral';
}

/**
 * Explicação humana de um `kind`. Ordem: catálogo portado do Python →
 * rótulo/descrição do `IMPACT_CATALOG` → kind formatado (sem inventar frase).
 */
export function explainConsequence(kind: string, magnitude: number): Explanation {
  const cat = catalogExplanation(kind);
  if (cat) return cat;
  const severity = severityOf(kind, magnitude);
  const tpl = templateForKind(kind);
  if (tpl) return { title: tpl.label, subtitle: tpl.description, severity };
  const pretty = kind.replace(/_/g, ' ');
  return {
    title: pretty.charAt(0).toUpperCase() + pretty.slice(1),
    subtitle: L('Efeito ativo.', 'Active effect.'),
    severity,
  };
}

// ─── Builders ──────────────────────────────────────────────────────

export function toConsequenceView(e: EvaluatedConsequence): EvaluatedConsequenceView {
  const c = e.consequence;
  return {
    consequence: {
      id: c.id,
      manager_id: c.managerId,
      club_id: c.clubId,
      player_id: c.playerId ?? null,
      kind: c.kind,
      dimension: c.dimension,
      scope: c.scope,
      magnitude: c.magnitude,
      decay_curve: c.decayCurve,
      starts_at: new Date(c.startsAt).toISOString(),
      expires_at: new Date(c.expiresAt).toISOString(),
      source_event_id: c.sourceEventId ?? null,
      metadata: c.metadata ?? null,
    },
    current_value: e.currentValue,
    life_remaining: e.lifeRemaining,
    ms_until_expiry: e.msUntilExpiry,
  };
}

/** Agrupa por dimensão; descarta as que já decaíram a zero (exceto 'step'). */
export function groupByDimension(list: EvaluatedConsequence[]): ConsequencesByDimension {
  const out: ConsequencesByDimension = { physical: [], psychological: [], reputational: [], financial: [] };
  for (const e of list) {
    if (e.currentValue === 0 && e.consequence.decayCurve !== 'step') continue;
    out[e.consequence.dimension].push(toConsequenceView(e));
  }
  return out;
}

/** Resumo do clube: ativas, indisponíveis, alertas, celebrações. */
export function buildClubSummary(list: EvaluatedConsequence[]): ClubSummary {
  const unavailable = new Set<string>();
  const impact = new Map<string, number>();
  let alerts = 0;
  let celebrations = 0;
  let nextExpiry: number | null = null;

  for (const e of list) {
    const c = e.consequence;
    if (c.playerId && UNAVAILABILITY_KINDS.has(c.kind)) unavailable.add(c.playerId);
    const sev = severityOf(c.kind, c.magnitude);
    if (sev === 'alert') alerts += 1;
    else if (sev === 'celebration') celebrations += 1;
    if (nextExpiry === null || c.expiresAt < nextExpiry) nextExpiry = c.expiresAt;
    if (c.playerId) impact.set(c.playerId, (impact.get(c.playerId) ?? 0) + 1);
  }

  let mostImpacted: string | null = null;
  let best = 0;
  for (const [id, n] of impact) {
    if (n > best) {
      best = n;
      mostImpacted = id;
    }
  }

  return {
    total_active: list.length,
    unavailable_players: unavailable.size,
    alerts,
    celebrations,
    next_expiry_at: nextExpiry === null ? null : new Date(nextExpiry).toISOString(),
    most_impacted_player_id: mostImpacted,
  };
}

/** Visão por jogador (aba Plantel): agrega por player_id. */
export function buildSquadOverview(list: EvaluatedConsequence[], nowMs: number = Date.now()): SquadOverview {
  const byPlayer = new Map<string, EvaluatedConsequence[]>();
  for (const e of list) {
    const pid = e.consequence.playerId;
    if (!pid) continue;
    const arr = byPlayer.get(pid);
    if (arr) arr.push(e);
    else byPlayer.set(pid, [e]);
  }

  const players: SquadPlayerEntry[] = [];
  let totalUnavailable = 0;

  for (const [playerId, items] of byPlayer) {
    let alerts = 0;
    let celebrations = 0;
    let isUnavailable = false;
    let nextExpiry: number | null = null;
    const dimCount = new Map<Dimension, number>();

    for (const { consequence: c } of items) {
      dimCount.set(c.dimension, (dimCount.get(c.dimension) ?? 0) + 1);
      const sev = severityOf(c.kind, c.magnitude);
      if (UNAVAILABILITY_KINDS.has(c.kind) || sev === 'alert') alerts += 1;
      else if (sev === 'celebration') celebrations += 1;
      if (UNAVAILABILITY_KINDS.has(c.kind)) isUnavailable = true;
      if (nextExpiry === null || c.expiresAt < nextExpiry) nextExpiry = c.expiresAt;
    }
    if (isUnavailable) totalUnavailable += 1;

    let dominant: Dimension | null = null;
    let best = 0;
    for (const [dim, n] of dimCount) {
      if (n > best) {
        best = n;
        dominant = dim;
      }
    }

    players.push({
      player_id: playerId,
      active_count: items.length,
      alerts,
      celebrations,
      is_unavailable: isUnavailable,
      next_expiry_at: nextExpiry === null ? null : new Date(nextExpiry).toISOString(),
      dominant_dimension: dominant,
    });
  }

  // Indisponíveis primeiro, depois mais alertas, depois mais ativos.
  players.sort(
    (a, b) =>
      Number(b.is_unavailable) - Number(a.is_unavailable) ||
      b.alerts - a.alerts ||
      b.active_count - a.active_count,
  );

  return {
    generated_at: new Date(nowMs).toISOString(),
    players,
    total_players_affected: players.length,
    total_unavailable: totalUnavailable,
  };
}

const TIMELINE_WINDOW_MS = 7 * 24 * 60 * 60_000;

/**
 * Transparência de um jogador: consequências ativas explicadas + timeline.
 *
 * O store local só guarda as ATIVAS (expiradas são colhidas pelo tick), então
 * a timeline traz só os eventos de aplicação delas nos últimos 7 dias — não há
 * histórico de expiração pra mostrar, e não inventamos.
 */
export function buildPlayerTransparency(
  playerId: string,
  list: EvaluatedConsequence[],
  nowMs: number = Date.now(),
): PlayerTransparency {
  const active: ExplainedConsequence[] = [];
  const timeline: PlayerTimelineEvent[] = [];
  let isUnavailable = false;

  for (const e of list) {
    const c = e.consequence;
    if (c.playerId !== playerId) continue;
    const ex = explainConsequence(c.kind, c.magnitude);
    active.push({ ...toConsequenceView(e), ...ex });
    if (UNAVAILABILITY_KINDS.has(c.kind)) isUnavailable = true;
    if (nowMs - c.startsAt <= TIMELINE_WINDOW_MS) {
      timeline.push({
        at: new Date(c.startsAt).toISOString(),
        kind: 'consequence_applied',
        consequence_id: c.id,
        source_event_id: c.sourceEventId ?? null,
        title: ex.title,
        subtitle: ex.subtitle,
        severity: ex.severity,
        dimension: c.dimension,
        magnitude: c.magnitude,
      });
    }
  }

  active.sort((a, b) => b.consequence.starts_at.localeCompare(a.consequence.starts_at));
  timeline.sort((a, b) => b.at.localeCompare(a.at));

  return {
    player_id: playerId,
    active,
    timeline,
    total_active: active.length,
    is_unavailable: isUnavailable,
    most_recent_event_at: timeline[0]?.at ?? null,
  };
}
