/**
 * quickBeatDirector — lógica pura da Fase B do Quick Match 2.0.
 *
 * O Python entrega o plano com analyst_beats (leituras + decisões pesadas).
 * Este módulo aplica a decisão do manager nos eventos AINDA NÃO exibidos do
 * tempo corrente, de forma 100% determinística (SpiritRng seedado por
 * plan.seed + choice.id): mesma partida + mesma escolha = mesmo desfecho.
 *
 * Divisão de autoridade com o Python (docs/QUICK-ENGAGEMENT-REDESIGN.md):
 *   - Decisões do 1º tempo: efeito local só até o 45' (este módulo) e depois
 *     ecoadas no replan, onde o Python aplica nos 45' finais. Sem dupla conta.
 *   - Decisões do 2º tempo: efeito local até o 90' (não há outro replan).
 *
 * Também computa os VEREDITOS pós-jogo ("Sua leitura estava certa — o gol
 * saiu pelo corredor esquerdo") e a nota de Leitura de Jogo.
 */

import { SpiritRng } from '../../shared/gamespirit/SpiritRng';
import type {
  AnalystBeat,
  AnalystBeatChoice,
  MatchPlanEvent,
  MatchupChannel,
} from './quickPlanTypes';

/** Decisão registrada no ledger local (ecoada no replan via QuickPlanDecision). */
export interface BeatDecisionRecord {
  beat_id: string;
  choice_id: string;
  minute: number;
  half: 1 | 2;
  label: string;
  channel: MatchupChannel;
  target_side: 'home' | 'away';
  weight: number;
}

export interface BeatVerdict {
  beatId: string;
  minute: number;
  choiceLabel: string;
  kind: 'hit' | 'neutral' | 'miss';
  text: string;
}

export type QuickFeedKind =
  | 'insight' | 'decision' | 'halftime'
  | 'goal_home' | 'goal_away'
  | 'save' | 'chance' | 'woodwork' | 'counter' | 'penalty' | 'red';

export interface QuickPlanFeedItem {
  id: string;
  minute: number;
  kind: QuickFeedKind;
  text: string;
  /** Lado do protagonista — pra foto/realce no feed (item 8). */
  side?: 'home' | 'away';
  /** actor_id do evento, quando houver — usado pra puxar a foto do jogador. */
  actorId?: string;
}

/** Feed enxuto: itens de alto sinal apenas (tese "dois planos" da spec). */
export const QUICK_PLAN_FEED_MAX = 10;

/** Quase-gols que uma boa leitura pode CONVERTER em gol (ou que punem). */
const NEAR_MISS_HOME = new Set<MatchPlanEvent['kind']>(['shot_home', 'chance_home', 'save_home', 'woodwork_home']);
const NEAR_MISS_AWAY = new Set<MatchPlanEvent['kind']>(['shot_away', 'chance_away', 'save_away', 'woodwork_away']);
/** Ameaças REAIS do adversário que o escudo neutraliza (chute fraco fica de fora). */
const THREAT_AWAY = new Set<MatchPlanEvent['kind']>(['goal_away', 'chance_away', 'save_away', 'woodwork_away']);

/** Concordância PT-BR por canal — espelha CHANNEL_GENDER do analyst_beats.py. */
const CHANNEL_PT: Record<MatchupChannel, { label: string; em: string; por: string }> = {
  ataque_central: { label: 'ataque central', em: 'no', por: 'pelo' },
  corredor_esquerdo: { label: 'corredor esquerdo', em: 'no', por: 'pelo' },
  corredor_direito: { label: 'corredor direito', em: 'no', por: 'pelo' },
  criacao: { label: 'criação de jogo', em: 'na', por: 'pela' },
  bola_parada: { label: 'bola parada', em: 'na', por: 'pela' },
  finalizacao_vs_gk: { label: 'finalização', em: 'na', por: 'pela' },
  pressao: { label: 'pressão alta', em: 'na', por: 'pela' },
};

export function channelPt(ch: MatchupChannel) {
  return CHANNEL_PT[ch] ?? { label: ch, em: 'no', por: 'pelo' };
}

/** FNV-1a — string → seed uint32 pro SpiritRng. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function toDecisionRecord(beat: AnalystBeat, choice: AnalystBeatChoice): BeatDecisionRecord {
  return {
    beat_id: beat.id,
    choice_id: choice.id,
    minute: beat.minute,
    half: beat.half,
    label: choice.label,
    channel: choice.channel,
    target_side: choice.target_side,
    weight: choice.weight,
  };
}

function upgradeToHomeGoal(e: MatchPlanEvent, ch: MatchupChannel): MatchPlanEvent {
  const { por, label } = channelPt(ch);
  return {
    ...e,
    kind: 'goal_home',
    weight_tier: 'epic',
    text: `${e.minute}' — GOOOL! Você mandou atacar ${por} ${label} e deu certo — bola na rede!`,
    reason: 'sua leitura abriu o caminho',
    decision_influenced: true,
  };
}

function downgradeHomeGoal(e: MatchPlanEvent, ch: MatchupChannel): MatchPlanEvent {
  const { em, label } = channelPt(ch);
  return {
    ...e,
    kind: 'shot_home',
    weight_tier: 'normal',
    text: `${e.minute}' — Bateu na trave da insistência ${em} ${label}: a marcação já esperava. Faltou ler melhor.`,
    reason: 'canal fechado — a teimosia custou',
    decision_influenced: true,
  };
}

function downgradeAwayGoal(e: MatchPlanEvent, ch: MatchupChannel): MatchPlanEvent {
  const { label } = channelPt(ch);
  return {
    ...e,
    kind: 'shot_away',
    weight_tier: 'big',
    text: `${e.minute}' — Travou! Você fechou a ${label} deles e o perigo morreu na marcação. Leitura cirúrgica.`,
    reason: 'sua decisão defensiva segurou o canal',
    decision_influenced: true,
  };
}

function upgradeToAwayGoal(e: MatchPlanEvent): MatchPlanEvent {
  return {
    ...e,
    kind: 'goal_away',
    weight_tier: 'big',
    text: `${e.minute}' — Deu ruim: o adversário achou o buraco que a sua aposta deixou e não perdoou.`,
    reason: 'escolha errada cobrou o preço',
    decision_influenced: true,
  };
}

/**
 * Aplica a decisão nos eventos ainda não exibidos do tempo do beat.
 * Determinístico: SpiritRng(plan.seed + choice.id). Retorna novo array.
 */
export function applyDecisionToRemainingEvents(opts: {
  events: MatchPlanEvent[];
  fromIndex: number;
  beat: AnalystBeat;
  choice: AnalystBeatChoice;
  seed: string;
}): { events: MatchPlanEvent[]; flips: number } {
  const { events, fromIndex, beat, choice, seed } = opts;
  const rng = new SpiritRng(hashSeed(`${seed}:${choice.id}`));
  const halfEnd = beat.half === 1 ? 45 : 90;
  const w = choice.weight;
  let flips = 0;

  const out = events.map((e, i) => {
    if (i < fromIndex || e.minute < beat.minute || e.minute > halfEnd) return e;

    if (choice.target_side === 'home' && w > 0) {
      // Explorar canal com vantagem: quase-gols do home no canal podem virar gol
      // (cara a cara, defensaça e chute de fora — todos "quase" que a leitura converte)
      if (NEAR_MISS_HOME.has(e.kind) && e.channel === choice.channel) {
        const p = Math.min(0.5, (e.xg ?? 0.12) * w * 3.2 + 0.05);
        if (rng.next() < p) {
          flips += 1;
          return upgradeToHomeGoal(e, choice.channel);
        }
      }
    } else if (choice.target_side === 'home' && w < 0) {
      // Armadilha: gols do home no canal podem morrer; o away ganha fôlego
      if (e.kind === 'goal_home' && e.channel === choice.channel) {
        if (rng.next() < Math.min(0.6, Math.abs(w) * 1.8)) {
          flips += 1;
          return downgradeHomeGoal(e, choice.channel);
        }
      }
      if (NEAR_MISS_AWAY.has(e.kind)) {
        const p = Math.min(0.35, (e.xg ?? 0.1) * Math.abs(w) * 1.6 + 0.03);
        if (rng.next() < p) {
          flips += 1;
          return upgradeToAwayGoal(e);
        }
      }
    } else if (choice.target_side === 'away' && w > 0) {
      // Escudo: ameaças REAIS do away naquele canal (gol/cara a cara/defensaça/
      // trave) são neutralizadas. Chute fraco não precisa de escudo.
      if (THREAT_AWAY.has(e.kind) && e.channel === choice.channel) {
        if (rng.next() < Math.min(0.6, w * 2.5)) {
          flips += 1;
          return downgradeAwayGoal(e, choice.channel);
        }
      }
    }
    return e;
  });

  return { events: out, flips };
}

/**
 * Jogar com um a menos (vermelho) PESA no resto do jogo: parte dos gols da casa
 * vira só chute e parte dos quase-gols do adversário vira gol. Determinístico.
 */
export function applyManDownPenalty(opts: {
  events: MatchPlanEvent[];
  fromIndex: number;
  seed: string;
}): MatchPlanEvent[] {
  const { events, fromIndex, seed } = opts;
  const rng = new SpiritRng(hashSeed(`${seed}:mandown`));
  return events.map((e, i) => {
    if (i < fromIndex) return e;
    if (e.kind === 'goal_home' && rng.next() < 0.35) {
      return { ...e, kind: 'shot_home', weight_tier: 'normal', text: `${e.minute}' — Com um a menos, o time não chega: a finalização sai fraca.`, reason: 'desfalque numérico pesou' };
    }
    if ((e.kind === 'shot_away' || e.kind === 'chance_away') && rng.next() < 0.3) {
      return { ...e, kind: 'goal_away', weight_tier: 'big', text: `${e.minute}' — O espaço deixado pelo expulso vira gol do adversário.`, reason: 'um a menos cobrou o preço' };
    }
    return e;
  });
}

/**
 * Efeito de uma SUBSTITUIÇÃO no meio do jogo (sem replan): o saldo de OVR entre
 * quem entra e quem sai pesa no resto. Sub melhor pode transformar um quase-gol
 * da casa em gol; sub pior pode esfriar um gol. Determinístico por seed+outId.
 */
export function applySubNudge(opts: {
  events: MatchPlanEvent[];
  fromIndex: number;
  ovrDelta: number; // inOvr - outOvr (efetivo)
  seed: string;
  outId: string;
}): MatchPlanEvent[] {
  const { events, fromIndex, ovrDelta, seed, outId } = opts;
  if (Math.abs(ovrDelta) < 3) return events; // troca neutra, sem efeito
  const rng = new SpiritRng(hashSeed(`${seed}:sub:${outId}`));
  const better = ovrDelta > 0;
  const strength = Math.min(0.5, Math.abs(ovrDelta) / 30); // 3→0.1 … 15+→0.5
  let used = false;
  return events.map((e, i) => {
    if (used || i < fromIndex) return e;
    if (better && (e.kind === 'shot_home' || e.kind === 'chance_home') && rng.next() < strength) {
      used = true;
      return { ...e, kind: 'goal_home', weight_tier: 'big', text: `${e.minute}' — O reforço que entrou resolve — bola na rede!`, reason: 'sangue novo decidiu', decision_influenced: true };
    }
    if (!better && e.kind === 'goal_home' && rng.next() < strength) {
      used = true;
      return { ...e, kind: 'shot_home', weight_tier: 'normal', text: `${e.minute}' — A troca não encaixou: a jogada esfria e a finalização sai fraca.`, reason: 'substituição custou ritmo', decision_influenced: true };
    }
    return e;
  });
}

/** Veredito por decisão, computado sobre os eventos REALMENTE exibidos. */
export function computeBeatVerdicts(
  events: MatchPlanEvent[],
  ledger: BeatDecisionRecord[],
): BeatVerdict[] {
  return ledger.map((d) => {
    const { por, label } = channelPt(d.channel);
    const after = events.filter((e) => e.minute > d.minute);
    const base = { beatId: d.beat_id, minute: d.minute, choiceLabel: d.label };

    if (d.weight < 0) {
      return {
        ...base,
        kind: 'miss' as const,
        text: `O canal estava fechado — insistir ${por.replace('pelo', 'no').replace('pela', 'na')} ${label} custou caro.`,
      };
    }
    if (d.target_side === 'home') {
      if (after.some((e) => e.kind === 'goal_home' && e.channel === d.channel)) {
        return {
          ...base,
          kind: 'hit' as const,
          text: `Mandou bem — o gol saiu ${por} ${label}, exatamente onde você apontou.`,
        };
      }
      if (after.some((e) => NEAR_MISS_HOME.has(e.kind) && e.channel === d.channel)) {
        return {
          ...base,
          kind: 'neutral' as const,
          text: `Quase! O time chegou ${por} ${label} — faltou o capricho na hora H.`,
        };
      }
      return {
        ...base,
        kind: 'miss' as const,
        text: `O plano não saiu do papel — nada nasceu ${por} ${label} depois da decisão.`,
      };
    }
    // Escudo defensivo
    if (after.some((e) => e.kind === 'goal_away' && e.channel === d.channel)) {
      return {
        ...base,
        kind: 'miss' as const,
        text: `A trava não segurou: o gol deles saiu justamente ${por} ${label}.`,
      };
    }
    return {
      ...base,
      kind: 'hit' as const,
      text: `Trava perfeita — a ${label} deles não produziu nada depois da sua decisão.`,
    };
  });
}

/** Nota de Leitura de Jogo: escolhas com peso positivo / beats oferecidos. */
export function computeReadingScore(
  ledger: BeatDecisionRecord[],
  beatsOffered: number,
): { good: number; total: number } {
  return {
    good: ledger.filter((d) => d.weight > 0).length,
    total: Math.max(beatsOffered, ledger.length),
  };
}
