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

export interface QuickPlanFeedItem {
  id: string;
  minute: number;
  kind: 'insight' | 'decision' | 'goal_home' | 'goal_away' | 'red' | 'halftime';
  text: string;
}

/** Feed enxuto: itens de alto sinal apenas (tese "dois planos" da spec). */
export const QUICK_PLAN_FEED_MAX = 10;

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
    text: `${e.minute}' — GOL! A aposta ${por} ${label} paga — jogada desenhada no banco termina na rede!`,
    reason: 'sua leitura abriu o canal',
    decision_influenced: true,
  };
}

function downgradeHomeGoal(e: MatchPlanEvent, ch: MatchupChannel): MatchPlanEvent {
  const { em, label } = channelPt(ch);
  return {
    ...e,
    kind: 'shot_home',
    weight_tier: 'normal',
    text: `${e.minute}' — Quase! A insistência ${em} ${label} esbarra na marcação que já esperava.`,
    reason: 'canal fechado — a leitura custou a chance',
    decision_influenced: true,
  };
}

function downgradeAwayGoal(e: MatchPlanEvent, ch: MatchupChannel): MatchPlanEvent {
  const { label } = channelPt(ch);
  return {
    ...e,
    kind: 'shot_away',
    weight_tier: 'big',
    text: `${e.minute}' — A trava funciona! O perigo deles ${CHANNEL_PT[ch]?.em ?? 'no'} ${label} morre na sua marcação ajustada.`,
    reason: 'sua decisão defensiva segurou o canal',
    decision_influenced: true,
  };
}

function upgradeToAwayGoal(e: MatchPlanEvent): MatchPlanEvent {
  return {
    ...e,
    kind: 'goal_away',
    weight_tier: 'big',
    text: `${e.minute}' — Punição imediata: o adversário acha o espaço que a sua aposta abriu e marca.`,
    reason: 'escolha ruim cobrou o preço',
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
      // Explorar canal com vantagem: chutes no canal podem virar gol
      if (e.kind === 'shot_home' && e.channel === choice.channel) {
        const p = Math.min(0.45, (e.xg ?? 0.1) * w * 3.0);
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
      if (e.kind === 'shot_away') {
        const p = Math.min(0.35, (e.xg ?? 0.1) * Math.abs(w) * 1.5);
        if (rng.next() < p) {
          flips += 1;
          return upgradeToAwayGoal(e);
        }
      }
    } else if (choice.target_side === 'away' && w > 0) {
      // Escudo: gols do away naquele canal podem ser travados
      if (e.kind === 'goal_away' && e.channel === choice.channel) {
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
          text: `Sua leitura estava certa — o gol saiu ${por} ${label}.`,
        };
      }
      if (after.some((e) => e.kind === 'shot_home' && e.channel === d.channel)) {
        return {
          ...base,
          kind: 'neutral' as const,
          text: `A ideia era boa: o time chegou ${por} ${label}, faltou capricho na finalização.`,
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
