/**
 * QuickPlanPlayer — renderiza um MatchPlan pré-computado em ~25s por tempo.
 *
 * Fase B (Quick 2.0): scheduler SEQUENCIAL pausável, não mais timeouts
 * absolutos. O jogo roda em dois planos:
 *   • Plano físico — barra de momento + eventos com timing por weight_tier
 *     (epic 3.5s / big 1.8s / normal 0.5s / minor 0.15s)
 *   • Plano mental — analyst beats pausam o relógio, o manager decide, e a
 *     decisão altera deterministicamente os eventos restantes do tempo
 *     (quickBeatDirector). Pesos nunca aparecem na UI.
 *
 * No 45', se `onSecondHalf` for fornecido, o player pausa e pede o replan
 * (Python re-simula 46-90' com o ledger). Sem o hook, segue o plano baseline.
 * Veredito por decisão + Leitura de Jogo aparecem no apito final.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DecisaoNoCampo, QuadroAoVivo } from '@/partidaViva/tipos';
import { motion, AnimatePresence } from 'motion/react';
import { Crosshair, ShieldAlert, Target, Cross, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import type {
  AnalystBeat,
  AnalystBeatChoice,
  MatchEventTier,
  MatchPlan,
  MatchPlanEvent,
} from './quickPlanTypes';
import {
  applyDecisionToRemainingEvents,
  computeBeatVerdicts,
  computeReadingScore,
  toDecisionRecord,
  hashSeed,
  applyManDownPenalty,
  applySubNudge,
  sprinkleDisciplineEvents,
  buildLiveAnalystBeat,
  rollDecisionCrit,
  EFFECT_BUFF_PCT,
  BUFF_WINDOW_MINUTES,
  buffPctToWeight,
  classifyTransition,
  QUICK_PLAN_FEED_MAX,
  type BeatDecisionRecord,
  type BeatVerdict,
  type QuickPlanFeedItem,
  type TransitionLeadIn,
  type ReactionChoice,
} from './quickBeatDirector';
import { SpiritRng } from '../../shared/gamespirit/SpiritRng';
import { buildClutch, resolveClutch, duelo, forcaNoDuelo, type AtributoDoDuelo, type ClutchMoment, type ClutchKey, type Duelo, type Lutador } from './quickClutch';
import { leituraDoIntervalo, type LeituraDoIntervalo } from './auxiliarDoIntervalo';
import { AnalystBeatCard } from '@/components/matchquick/AnalystBeatCard';
import { MomentumBar } from '@/components/match/MomentumBar';
import { QuickGoalCelebration } from '@/components/matchquick/QuickGoalCelebration';
import { PenaltyShootout, type ShootoutSetup } from '@/components/matchquick/PenaltyShootout';
import type { ShootoutResult } from '@/match/quickEngaged/penaltyShootout';
import { renderQuickFeedRichText } from '@/match/quickMatchFeed';
import {
  resolveStyleOnEvent,
  resolveLegacyBoost,
  resolveFormationOnEvent,
  styleMomentumBias,
  nudgeMomentumCurve,
  STYLE_LABEL,
} from '@/match/quickTacticalLive';
import { TACTICAL_INTENSITY_PRESETS, type TacticalIntensityLevel } from '@/match/quickTacticalIntensity';
import { detectLiveArc, getArcDescription } from '@/match/quickNarrativeArcs';
import { QuickNarrativeArcIndicator } from '@/components/matchquick/QuickNarrativeArcIndicator';
import { ResultadoRua } from '@/components/match/ResultadoRua';
import { buildAgentEcho, type AgentEchoTrait } from '@/match/quickAgentEcho';
import { L, emIngles } from '@/i18n/L';

/** Rótulo de posição só pra tela (o valor `pos` não muda). */
const POS_EN: Record<string, string> = {
  GOL: 'GK', ZAG: 'CB', LAT: 'FB', LD: 'RB', LE: 'LB', VOL: 'DM', MEI: 'AM', MC: 'CM', PE: 'LW', PD: 'RW', ATA: 'ST', CA: 'ST',
};
const posLabel = (pos: string): string => L(pos, POS_EN[pos] ?? pos);
/** Rótulo do buff Legacy só pra tela (o valor `label` é comparado em quickPlanClient). */
const LEGACY_LABEL_EN: Record<string, string> = { MORAL: 'MORALE', POSSE: 'POSSESSION', ATAQUE: 'ATTACK', DEFESA: 'DEFENCE' };
const legacyLabel = (label: string): string => L(label, LEGACY_LABEL_EN[label] ?? label);

/** Lance importante ganha o palco central; construção só alimenta o momento.
 *  Fruto de decisão SEMPRE aparece — o manager precisa ver a consequência. */
function isHighSignal(e: MatchPlanEvent): boolean {
  return e.weight_tier === 'epic' || e.weight_tier === 'big'
    || e.kind.startsWith('goal_') || e.decision_influenced === true;
}

export interface QuickPlanHalftimeContext {
  ledger: BeatDecisionRecord[];
  homeScore: number;
  awayScore: number;
  momentumEnd: number;
  cardsHome: number;
  cardsAway: number;
  sentOffHome: number;
  sentOffAway: number;
  /** Substituições já gastas (1º tempo) — pra o intervalo respeitar o teto de 5. */
  subsUsed: number;
  /** Partida Viva, Fase 9: o auxiliar aponta UM problema do 1º tempo (só no intervalo). */
  auxiliar?: LeituraDoIntervalo;
}

export interface QuickPlanPlayResult {
  homeScore: number;
  awayScore: number;
  ledger: BeatDecisionRecord[];
  verdicts: BeatVerdict[];
  reading: { good: number; total: number };
  replanned: boolean;
  /** Tally por jogador (gols/chutes/defesas) — base da nota e do crédito (Fase D). */
  playerStats: Record<string, { goals: number; shots: number; saves: number; side: 'home' | 'away' }>;
  /** Quem terminou em campo (pra minutos/recovery). */
  homeOnPitch: string[];
  /** Agregados pro crédito (bônus de performance). */
  stats: { homeShots: number; awayShots: number; possessionHome: number; wasLosing: boolean };
  /** Disputa de pênaltis quando o jogo empatou (nenhum jogo termina empatado). */
  shootout?: {
    winner: 'home' | 'away';
    homeTally: number;
    awayTally: number;
    /** FABLE/Cicatrizes — cobranças da CASA (quem converteu/errou). */
    homeKicks: { kickerId: string; scored: boolean }[];
  };
  /** FABLE/DNA — estilos ativados no dock ao vivo, na ordem. */
  styleLog: TacticalIntensityLevel[];
  /** FABLE/Cicatrizes — autores de gol da casa aos 85'+ (herói do fim). */
  lateHeroIds: string[];
}

interface Props {
  plan: MatchPlan;
  /** EXP real do bônus de performance (vem do pai depois do crédito) — entra na fita do resultado. */
  resultadoExp?: number | null;
  onComplete?: (plan: MatchPlan, result: QuickPlanPlayResult) => void;
  /** Reduz duração total se o user quiser ainda mais rápido (default 1.0). */
  speedMultiplier?: number;
  /**
   * Seam do intervalo (Fase C pluga a UI real aqui): recebe o estado do 1º
   * tempo + ledger e devolve o plano replanejado do 2º tempo (ou null pra
   * seguir com o baseline).
   */
  onSecondHalf?: (ctx: QuickPlanHalftimeContext) => Promise<MatchPlan | null>;
  /** Resolve a foto do protagonista de um evento (item 8 — conta história). */
  portraitOf?: (actorId: string | undefined, side: 'home' | 'away' | undefined) => string | null;
  /** Brasões reais dos times (placar cinematográfico). */
  homeCrestUrl?: string | null;
  awayCrestUrl?: string | null;
  homeName?: string;
  awayName?: string;
  /** Batedores de pênalti da casa — o manager escolhe quem bate (Elifoot-style). */
  penaltyTakers?: PenaltyTaker[];
  /** Lendas (isLegacy) titulares — ativam um BUFF de time por ~15' (1 uso/jogo). */
  legacyBoosters?: { id: string; name: string; label: string; pct: number }[];
  /** Mapa id→buff de TODAS as lendas do elenco (titular ou banco). Usado pra
   *  derivar os buffs do elenco VIVO em campo — assim a lenda que entra por
   *  substituição também passa a oferecer o buff. */
  legacyLookup?: Record<string, { name: string; label: string; pct: number }>;
  /** Formação inicial (ex.: '4-3-3') — o seletor ao vivo cicla a partir dela. */
  initialFormation?: string;
  /** Titulares em campo — alimentam os 5 cards (3 melhores + 2 piores por OVR). */
  fieldCards?: SquadCard[];
  /** Onze do adversário — pros 5 cards do outro time (só leitura). */
  awayCards?: SquadCard[];
  /** Reservas no banco — pra substituir a qualquer momento (ou em lesão). */
  benchCards?: SquadCard[];
  /** Avisa o pai que houve substituição (atualiza o elenco vivo: out→in). */
  onSubstitution?: (outId: string, inId: string) => void;
  /** Elenco vivo APÓS o intervalo (subs do halftime acontecem no pai). Sincroniza
   *  o field/bench internos pra a lenda que ENTRA no 2º tempo oferecer o buff. */
  secondHalfLineup?: () => { field: SquadCard[]; bench: SquadCard[] } | null;
  /** Narração IA (Sonnet) pré-buscada — mescla nos beats e na comemoração de gol. */
  narration?: QuickNarrationOverride;
  /** Monta os dados da disputa de pênaltis (elenco vivo + goleiros) no empate.
   *  O pai (MatchQuickEngaged) tem os atributos; retorna null pra pular a disputa. */
  buildShootout?: () => ShootoutSetup | null;
  /** FABLE — Eco do agente: traços (agentProfile) por playerId. Ao trocar o
   *  estilo, UM jogador do XI reage no feed coerente com a personalidade. */
  agentTraits?: Record<string, AgentEchoTrait>;
  /** PARTIDA VIVA — o palco em campo assina o que esta tela MOSTRA (lance já
   *  resolvido). Só leitura: o palco nunca devolve nada pro jogo. */
  onAoVivo?: (quadro: QuadroAoVivo) => void;
  /** PARTIDA VIVA — tempo mínimo (ms) que um lance fica na tela, pro campo
   *  conseguir mostrar a jogada inteira. Só apresentação: não muda desfecho. */
  segurarLance?: (ev: MatchPlanEvent) => number;
  /** PARTIDA VIVA — ms de tela por minuto sem lance (modo Completa, velocidade,
   *  pular). Ausente = ritmo normal da Rápida. Só apresentação. */
  relogioMs?: number;
  /** PARTIDA VIVA (Fase 4) — o campo responde decisões/comandos por aqui; as
   *  respostas caem nas MESMAS funções dos botões desta tela. */
  registrarResposta?: (fn: ((id: string) => void) | null) => void;
  /** PARTIDA VIVA (Fase 5) — no gol, espera o campo terminar replay + giz
   *  (resposta 'seguir'); trava de segurança de 20 s. Só ritmo de exibição. */
  golEsperaCampo?: boolean;
  /** LEGACY (Fase 4b) — grito/ordem dado no campo: o pai refaz o plano a partir
   *  de minuto+3 no servidor; o player emenda o futuro (o passado não muda). */
  pedirReplan?: (cmd: ComandoSemMinuto | null, ctx: ContextoDoReplan) => Promise<MatchPlan | null>;
}

/** Contexto de um replan do LEGACY: o do intervalo + o minuto + quando cada reserva entrou. */
export type ContextoDoReplan = QuickPlanHalftimeContext & { minuto: number; entradas: Record<string, number> };

export type ComandoSemMinuto =
  | { tipo: 'incentivar' | 'cobrar' | 'acalmar' }
  | { tipo: 'ordem'; ordem: 'segurar' | 'atacar_espaco' | 'marcar'; jogador: string };
const RECARGA_GRITO_MIN = 15;
/** LEGACY: o momento decisivo tem prazo — sem resposta, o jogador decide sozinho (o jogo nunca fica parado). */
const PRAZO_DECISIVO_MS = 15000;
const DURACAO_GRITO_MIN = 10;

/** Narração rica vinda do backend (Sonnet) — chaves por beat_id e por minuto. */
export interface QuickNarrationOverride {
  beats: Record<string, string>;
  goals: Record<string, string>;
  reading?: string;
}

/** Carta de jogador pros 5 cards + banco (OVR cartola). */
export interface SquadCard {
  id: string;
  name: string;
  pos: string;
  ovr: number;
  fatigue: number;
  portrait: string | null;
  /** Ponte #2: fair play do jogador (risco de cartão). */
  fairPlay?: number;
  /** Partida Viva, Fase 9: atributos do duelo no momento decisivo. */
  attrs?: Partial<Record<AtributoDoDuelo, number>>;
}

/** Posição em família (o duelo escolhe goleiro / zagueiro / meio). */
function familia(pos: string): 'goleiro' | 'zagueiro' | 'meio' | 'ataque' {
  const p = pos.toUpperCase();
  if (p.includes('GOL') || p === 'GK') return 'goleiro';
  if (p.includes('ZAG') || p === 'CB' || p === 'LE' || p === 'LD' || p === 'LB' || p === 'RB') return 'zagueiro';
  if (/(VOL|MC|MEI|CM|DM|AM)/.test(p)) return 'meio';
  return 'ataque';
}
const lutador = (c: SquadCard): Lutador => ({ id: c.id, nome: c.name, attrs: c.attrs ?? {} });

/**
 * Os dois do duelo. Atacando: o nosso autor × quem tenta parar (goleiro ou
 * zagueiro deles). Defendendo: o autor deles × quem dos nossos enfrenta.
 * Sem cartas (visitante sintético), cai no time pelo nome — 60 nos atributos.
 */
function montarDuelo(m: ClutchMoment, autorId: string | undefined, nossos: SquadCard[], deles: SquadCard[]): Duelo | null {
  const porFamilia = (cartas: SquadCard[], f: string) =>
    [...cartas].filter((c) => familia(c.pos) === f).sort((a, b) => b.ovr - a.ovr)[0];
  if (m.intent === 'attack') {
    const n = nossos.find((c) => c.id === autorId) ?? porFamilia(nossos, 'ataque');
    const d = porFamilia(deles, m.rival === 'goleiro' ? 'goleiro' : 'zagueiro') ?? deles[0];
    return n && d ? duelo(m, lutador(n), lutador(d)) : null;
  }
  const d = deles.find((c) => c.id === autorId) ?? porFamilia(deles, 'ataque');
  const n = porFamilia(nossos, m.rival) ?? nossos[0];
  return n && d ? duelo(m, lutador(n), lutador(d)) : null;
}

/** Rótulo curto do lance pro eyebrow do banner amarelo. */
function eventKindLabel(e: MatchPlanEvent): string {
  if (e.kind.startsWith('goal_')) return L('Gol', 'Goal');
  const base = e.kind.replace(/_(home|away)$/, '');
  return ({
    save: L('Defesa', 'Save'), chance: L('Chance', 'Chance'), woodwork: L('Na trave', 'Woodwork'), counter: L('Contra-ataque', 'Counter-attack'),
    penalty: L('Pênalti', 'Penalty'), red: L('Vermelho', 'Red card'), shot: L('Finalização', 'Shot'),
  } as Record<string, string>)[base] ?? L('Lance', 'Play');
}

/** Estado físico em uma palavra com emoção (voz da marca). */
function fatigueWord(f: number): string {
  if (f <= 35) return L('inteiro', 'fresh');
  if (f <= 65) return L('no ritmo', 'in rhythm');
  if (f <= 85) return L('no limite', 'at the limit');
  return L('apagando', 'fading');
}

/** Nome curto pra UI: apelido entre aspas ("Juca") ou corta o sufixo " — fase".
 *  Ex.: 'José Carlos "Juca" de Andrade — Consolidação' → 'Juca'. */
function shortName(name: string | undefined): string {
  const raw = (name ?? '').trim();
  const nick = raw.match(/"([^"]+)"/);
  if (nick) return nick[1]!.trim();
  return raw.split(' — ')[0]!.trim();
}

/** Papel do jogador inferido da posição (pt-BR) — pondera a nota por função. */
function inferRatingRole(pos: string): 'gk' | 'def' | 'mid' | 'att' {
  const p = pos.toUpperCase();
  if (p.includes('GOL') || p === 'GK') return 'gk';
  if (/(ZAG|LD|LE|LAT|DEF)/.test(p)) return 'def';
  if (/(VOL|MC|MEI|MED|MD|ME)/.test(p)) return 'mid';
  return 'att';
}

/** Contexto vivo da partida pra nota respirar (placar, momento, minuto). */
export interface RatingCtx {
  pos: string;
  side: 'home' | 'away';
  /** Gols do time do jogador / gols sofridos. */
  teamGoals: number;
  oppGoals: number;
  /** Momento atual 0–100 na perspectiva da casa. */
  momentumHome: number;
  /** Minuto corrido — rampa o peso do contexto (começa neutro, diverge). */
  minute: number;
}

/**
 * Nota da partida (cartola) — VIVA. Sem ctx, cai na fórmula simples (compat).
 * Com ctx, a nota respira: atacante sobe com o time dominando, zagueiro/goleiro
 * pune gol sofrido e premia jogo limpo, goleiro cresce nas defesas. O OVR só
 * dá um empurrão suave — o protagonista é o que acontece em campo.
 */
export function matchRating(
  ovr: number,
  t?: { goals: number; shots: number; saves?: number },
  ctx?: RatingCtx,
): number {
  const goals = t?.goals ?? 0;
  const shots = t?.shots ?? 0;
  const saves = t?.saves ?? 0;

  if (!ctx) {
    const base = 6.0 + (ovr - 60) / 50;
    return Math.max(5.0, Math.min(9.9, base + goals * 0.9 + shots * 0.12));
  }

  const role = inferRatingRole(ctx.pos);
  let r = 6.2 + (ovr - 70) / 45;          // âncora ~6.2, OVR nudge ±~0.4
  r += goals * 1.05 + shots * 0.14 + saves * 0.22;

  const ramp = Math.min(1, ctx.minute / 30); // contexto entra ao longo do jogo
  const sideMom = ctx.side === 'home' ? ctx.momentumHome : 100 - ctx.momentumHome;
  const momTilt = (sideMom - 50) / 100;       // -0.5..+0.5

  if (role === 'att') {
    r += (ctx.teamGoals * 0.16 + momTilt * 0.9) * ramp;
  } else if (role === 'mid') {
    r += (ctx.teamGoals * 0.12 - ctx.oppGoals * 0.08 + momTilt * 0.7) * ramp;
  } else if (role === 'def') {
    r += (ctx.oppGoals === 0 ? 0.35 : -ctx.oppGoals * 0.34) * ramp + momTilt * 0.45 * ramp;
  } else {
    r += (ctx.oppGoals === 0 ? 0.45 : -ctx.oppGoals * 0.30) * ramp + saves * 0.05;
  }

  return Math.max(5.0, Math.min(9.9, r));
}

/** Linha de elenco no padrão editorial "Today's roster" (rail por estado). */
function RosterRow({ card, isTop, rating, subbable, onSub }: {
  card: SquadCard;
  isTop: boolean;
  rating?: number;
  subbable?: boolean;
  onSub?: () => void;
}) {
  // DS 2027: rail rua pro destaque, atenção pro cansado, linha pro resto.
  const rail = isTop ? 'border-l-rua' : card.fatigue > 85 ? 'border-l-atencao' : 'border-l-linha';
  const tired = card.fatigue > 85;
  const inner = (
    <>
      {/* Foto do jogador — destaque (anel rua) pra quem brilha, cinza pros demais. */}
      {card.portrait ? (
        <img
          src={card.portrait}
          alt=""
          className={`h-9 w-9 shrink-0 rounded-full object-cover object-top ${isTop ? 'border-2 border-rua' : 'grayscale opacity-90'}`}
        />
      ) : (
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-concreto font-impact text-[14px] text-suave ${isTop ? 'border-2 border-rua' : ''}`}
          aria-hidden
        >
          {card.name.trim().charAt(0).toUpperCase() || '?'}
        </span>
      )}
      <span className={`w-8 shrink-0 text-center font-impact text-[18px] leading-none tabular-nums ${isTop ? 'text-rua' : 'text-papel'}`}>
        {card.ovr}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-voz text-[19px] leading-none text-papel">
          {shortName(card.name)}
        </span>
        <span className={`mt-1 block font-prova text-[9.5px] font-bold uppercase tracking-[0.1em] ${tired ? 'text-atencao' : 'text-mudo'}`}>
          {posLabel(card.pos)} · {fatigueWord(card.fatigue)}
        </span>
      </span>
      {rating !== undefined && (
        <span className={`shrink-0 font-spray font-black text-[20px] leading-none tabular-nums ${rating >= 7.5 ? 'text-rua' : 'text-suave'}`}>
          {rating.toFixed(1)}
        </span>
      )}
      {subbable && <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-rua" strokeWidth={2.5} aria-hidden />}
    </>
  );
  const cls = `flex min-h-[50px] w-full min-w-0 items-center gap-2.5 border-l-[3px] bg-concreto px-2.5 py-1.5 text-left ${rail}`;
  return subbable ? (
    <button type="button" onClick={onSub} className={`${cls} transition-colors hover:bg-linha active:translate-y-px`}>{inner}</button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

type PlayerPhase = 'playing' | 'beat' | 'halftime' | 'celebration' | 'penalty' | 'forced' | 'clutch' | 'sub' | 'shootout' | 'done' | 'leadin';

/** Momento forçado: lesão (escolhe quem entra) ou vermelho (banner + 10 em campo). */
interface ForcedMoment {
  kind: 'injury' | 'red';
  idx: number;
  minute: number;
  outName: string;
  outId?: string;
}

/** Batedor disponível pra cobrar pênalti (item: escolha no feed, sem modal). */
export interface PenaltyTaker {
  id: string;
  name: string;
  finalizacao: number;
  portrait: string | null;
}

interface GoalCelebration {
  key: string;
  name: string;
  portrait: string | null;
  narrative: string;
  side: 'home' | 'away';
}

/** Chips do dock de estilo (ordem defesa → ataque, como o eixo do fit). */
const STYLE_CHIPS: { id: TacticalIntensityLevel; label: string }[] = [
  { id: 'defend', label: L('Retranca', 'Park the bus') },
  { id: 'counter', label: L('Contra', 'Counter') },
  { id: 'possession', label: L('Posse', 'Possession') },
  { id: 'press', label: L('Pressão', 'Press') },
  { id: 'attack', label: L('Ataque', 'Attack') },
];

/** Formações que o seletor ao vivo cicla + viés territorial (afeta o momento). */
const FORMATIONS = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2', '3-4-3'];
const FORMATION_TILT: Record<string, number> = {
  '3-4-3': 5, '4-3-3': 2, '4-2-3-1': 1, '4-4-2': 0, '3-5-2': 0, '5-3-2': -5,
};

const FEED_STYLE: Record<QuickPlanFeedItem['kind'], string> = {
  insight: 'text-suave',
  decision: 'text-rua',
  goal_home: 'text-rua font-bold',
  goal_away: 'text-papel font-bold',
  save: 'text-papel',
  chance: 'text-papel',
  woodwork: 'text-atencao font-semibold',
  counter: 'text-papel',
  penalty: 'text-rua font-bold',
  red: 'text-[var(--color-event-card-red)] font-semibold',
  yellow: 'text-[var(--color-event-card-yellow)] font-semibold',
  injury: 'text-atencao font-semibold',
  halftime: 'font-prova text-mudo uppercase tracking-[0.2em] text-[10px]',
};

/** Tempo real por minuto de jogo CORRIDO (relógio 1,2,3…). 90 min ≈ 22s. */
const CLOCK_MS = 240;
/** Duração da CHAMADA de transição antes de um lance de alto sinal (contexto). */
const LEADIN_MS = 1300;
/** Janela maior quando a chamada tem 3 opções de reação (ler + escolher). */
const LEADIN_REACT_MS = 2800;
/** Quanto o relógio "segura" num lance pra dar tempo de ler. */
const HOLD_MS: Record<MatchEventTier, number> = { epic: 2400, big: 1700, normal: 950, minor: 600 };

export function QuickPlanPlayer({ plan, resultadoExp, onComplete, speedMultiplier = 1.0, onSecondHalf, portraitOf, homeCrestUrl, awayCrestUrl, homeName, awayName, penaltyTakers, legacyBoosters, legacyLookup, initialFormation, fieldCards, awayCards, benchCards, onSubstitution, secondHalfLineup, narration, buildShootout, agentTraits, onAoVivo, segurarLance, relogioMs, registrarResposta, golEsperaCampo, pedirReplan }: Props) {
  void speedMultiplier;
  const [phase, setPhase] = useState<PlayerPhase>('playing');
  const [minute, setMinute] = useState(0);
  const [highlight, setHighlight] = useState<MatchPlanEvent | null>(null);
  // Elenco vivo (subs a qualquer momento mexem aqui).
  const [field, setField] = useState<SquadCard[]>(fieldCards ?? []);
  const [benchPool, setBenchPool] = useState<SquadCard[]>(benchCards ?? []);
  // Teto de 5 substituições (intervalo + durante o jogo, budget compartilhado).
  // Lesão NÃO conta (é forçada). Atacante pode entrar no gol — sem filtro de
  // posição; ele joga com os atributos dele, então "pesa" naturalmente no time.
  const MAX_SUBS = 5;
  const [subsUsed, setSubsUsed] = useState(0);
  const subsUsedRef = useRef(0);
  const pausadoRef = useRef(false);
  const bumpSubs = (n: number) => { if (n <= 0) return; subsUsedRef.current += n; setSubsUsed(subsUsedRef.current); };
  const [subOut, setSubOut] = useState<string | null>(null); // id do titular escolhido pra sair
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [activeBeat, setActiveBeat] = useState<AnalystBeat | null>(null);
  // FX flutuante do impacto da decisão (sobe da barra de momento e some).
  const [floatFx, setFloatFx] = useState<{ key: number; text: string; tier: 'pos' | 'neg' | 'neutral' | 'crit' } | null>(null);
  // Chamada de transição ("Olha o contra-ataque!") antes de um lance de alto sinal.
  const [leadIn, setLeadIn] = useState<TransitionLeadIn | null>(null);
  // Buff de ACERTO: a chamada vira reação opcional (1 toque). Acertar = buff.
  const [leadInReactable, setLeadInReactable] = useState(false);
  // Buff ATIVO (#3): janela de ~10s mostrada como chip com contagem regressiva.
  const [activeBuff, setActiveBuff] = useState<{ pct: number; tier: 'pos' | 'neg' | 'crit'; untilMinute: number } | null>(null);
  const [feed, setFeed] = useState<QuickPlanFeedItem[]>([]);
  // Estilo de jogo AO VIVO — escolha certa converte gol, errada custa caro.
  const [style, setStyle] = useState<TacticalIntensityLevel>('possession');
  // LEGACY — cada lenda em campo dá um buff de time (1 uso CADA, dura ~15').
  // O manager escolhe QUAL ativar e QUANDO (defesa sob pressão, ataque pra pressionar).
  const [legacyActive, setLegacyActive] = useState(false);
  const [legacyUsedIds, setLegacyUsedIds] = useState<Set<string>>(() => new Set());
  const [legacyPickerOpen, setLegacyPickerOpen] = useState(false);
  // Formação ao vivo — cicla a partir da inicial. Afeta o momento E o jogo (resolveFormationOnEvent).
  const [formation, setFormation] = useState<string>(initialFormation ?? '4-3-3');
  const formationRef = useRef<string>(initialFormation ?? '4-3-3'); // lido no tick
  const [celebration, setCelebration] = useState<GoalCelebration | null>(null);
  const [penalty, setPenalty] = useState<{ idx: number; minute: number } | null>(null);
  const [forced, setForced] = useState<ForcedMoment | null>(null);
  const [clutch, setClutch] = useState<{ moment: ClutchMoment; idx: number; duelo: Duelo | null } | null>(null);
  const [shootoutSetup, setShootoutSetup] = useState<ShootoutSetup | null>(null);
  const [shootoutResult, setShootoutResult] = useState<ShootoutResult | null>(null);
  const [doneInfo, setDoneInfo] = useState<{
    verdicts: BeatVerdict[];
    reading: { good: number; total: number };
    skipped: number;
    stats: { homeShots: number; awayShots: number; homeSaves: number; awaySaves: number; possessionHome: number };
  } | null>(null);

  const eventsRef = useRef<MatchPlanEvent[]>(
    sprinkleDisciplineEvents({
      events: plan.events,
      home: (fieldCards ?? []).map((c) => ({ id: c.id, name: c.name, fatigue: c.fatigue, fairPlay: c.fairPlay })),
      away: (awayCards ?? []).map((c) => ({ id: c.id, name: c.name, fatigue: c.fatigue, fairPlay: c.fairPlay })),
      seed: plan.seed,
    }),
  );
  const beatsQueueRef = useRef<AnalystBeat[]>([...(plan.analyst_beats ?? [])]);
  const momentumRef = useRef<number[]>([...plan.momentum_curve]);
  const styleRef = useRef<TacticalIntensityLevel>('possession'); // lido no tick (closure sempre fresca)
  // FABLE/DNA — log dos estilos ativados ao vivo (alimenta o eixo do clube).
  const styleLogRef = useRef<TacticalIntensityLevel[]>([]);
  const legacyActiveRef = useRef(false);
  const legacyUntilRef = useRef(0);
  const legacyPctRef = useRef(0);
  const legacyNameRef = useRef('');
  const ledgerRef = useRef<BeatDecisionRecord[]>([]);
  const minuteRef = useRef(0);          // relógio corrido
  const eventIdxRef = useRef(0);        // ponteiro no próximo evento (lista ordenada por minuto)
  const timerRef = useRef<number | null>(null);
  const scoreRef = useRef({ home: 0, away: 0 });
  // Ponte #1: a casa esteve atrás em algum momento? Habilita o bônus "Virada Épica".
  const wasLosingRef = useRef(false);
  const cardsRef = useRef({ cardsHome: 0, cardsAway: 0, sentOffHome: 0, sentOffAway: 0 });
  const offeredRef = useRef(0);
  const offeredBeatsRef = useRef<AnalystBeat[]>([]);
  const htDoneRef = useRef(false);
  const replannedRef = useRef(false);
  const completedRef = useRef(false);
  const fxSeqRef = useRef(0); // chave única do FX flutuante (retrigger AnimatePresence)
  const prevEventKindRef = useRef<MatchPlanEvent['kind'] | undefined>(undefined); // p/ detectar rebote
  const leadInPendingRef = useRef<{ ev: MatchPlanEvent; idx: number } | null>(null); // lance aguardando a reação
  const leadInResolvedRef = useRef(false); // evita reação + timeout dispararem 2×
  // Tally por jogador (gols/chutes/defesas) → nota da partida + crédito (Fase D).
  const statsRef = useRef<Record<string, { goals: number; shots: number; saves: number; side: 'home' | 'away' }>>({});

  const tally = (id: string | undefined, side: 'home' | 'away', field: 'goals' | 'shots' | 'saves') => {
    if (!id) return;
    const cur = statsRef.current[id] ?? { goals: 0, shots: 0, saves: 0, side };
    cur[field] += 1;
    statsRef.current[id] = cur;
  };

  const feedSeqRef = useRef(0);
  const pushFeed = (item: QuickPlanFeedItem) => {
    feedSeqRef.current += 1;
    const unique = { ...item, id: `${item.id}#${feedSeqRef.current}` }; // key sempre única
    setFeed((prev) => [...prev, unique].slice(-QUICK_PLAN_FEED_MAX));
  };

  /** Troca de estilo AO VIVO: empurra o momento (viés territorial) e anuncia. O
   *  efeito no PLACAR vem evento a evento via resolveStyleOnEvent (no tick). */
  const changeStyle = (next: TacticalIntensityLevel) => {
    if (next === styleRef.current) return;
    styleRef.current = next;
    setStyle(next);
    styleLogRef.current.push(next); // FABLE/DNA — cada escolha marca o eixo do clube
    const m = minuteRef.current;
    momentumRef.current = nudgeMomentumCurve(momentumRef.current, m, styleMomentumBias(next));
    pushFeed({ id: `style-${m}`, minute: m, kind: 'decision', text: L(`Estilo: ${STYLE_LABEL[next]} — ${TACTICAL_INTENSITY_PRESETS[next].description}`, `Style: ${STYLE_LABEL[next]} — ${TACTICAL_INTENSITY_PRESETS[next].description}`) });
    // FABLE — ECO DO AGENTE: um jogador do XI responde ao comando no feed,
    // coerente com o agentProfile dele (abraça / resmunga / cumpre). O comando
    // deixa de ser toggle mudo e vira conversa com o elenco.
    const echo = buildAgentEcho({
      style: next,
      field: field.map((c) => ({ id: c.id, name: c.name, pos: c.pos })),
      traits: agentTraits ?? {},
      seed: plan.seed,
      minute: m,
    });
    if (echo) {
      window.setTimeout(() => {
        pushFeed({ id: `echo-${m}`, minute: m, kind: 'insight', text: echo.text, side: 'home', actorId: echo.playerId });
      }, 900);
    }
  };

  // Buffs de legacy DISPONÍVEIS agora — derivados do elenco VIVO em campo (field),
  // então uma lenda que ENTRA por substituição também passa a oferecer o buff.
  // Fallback pro prop legacyBoosters (kickoff) quando não há lookup.
  const liveBoosters = useMemo<{ id: string; name: string; label: string; pct: number }[]>(() => {
    if (legacyLookup && Object.keys(legacyLookup).length) {
      const out: { id: string; name: string; label: string; pct: number }[] = [];
      for (const c of field) {
        const lg = legacyLookup[c.id];
        if (lg) out.push({ id: c.id, name: lg.name, label: lg.label, pct: lg.pct });
      }
      return out.slice(0, 3);
    }
    return legacyBoosters ?? [];
  }, [field, legacyLookup, legacyBoosters]);
  const availableBoosters = liveBoosters.filter((b) => !legacyUsedIds.has(b.id));

  /** LEGACY: ativa UM buff escolhido (1 uso por lenda, ~15'). Empurra o momento
   *  na hora e dá chance extra de gol enquanto a janela está aberta (no tick). */
  const activateLegacy = (buff: { id: string; name: string; label: string; pct: number }) => {
    if (legacyActiveRef.current || legacyUsedIds.has(buff.id)) return;
    const m = minuteRef.current;
    legacyPctRef.current = buff.pct;
    legacyNameRef.current = buff.name;
    legacyActiveRef.current = true;
    legacyUntilRef.current = m + 15;
    setLegacyActive(true);
    setLegacyUsedIds((prev) => new Set(prev).add(buff.id));
    setLegacyPickerOpen(false);
    momentumRef.current = nudgeMomentumCurve(momentumRef.current, m, Math.min(18, buff.pct * 2 + 4));
    pushFeed({ id: `legacy-${buff.id}-${m}`, minute: m, kind: 'decision', text: `Legacy: @${buff.name} +${buff.pct}% ${legacyLabel(buff.label)}` });
  };

  /** Cicla a formação ao vivo: muda a forma do time e empurra o momento conforme
   *  o quão ofensiva ela é (3-4-3 sobe, 5-3-2 recua). Não re-planeja o jogo. */
  const cycleFormation = () => {
    const idx = FORMATIONS.indexOf(formation);
    const next = FORMATIONS[(idx + 1) % FORMATIONS.length] ?? '4-3-3';
    formationRef.current = next;
    setFormation(next);
    const m = minuteRef.current;
    momentumRef.current = nudgeMomentumCurve(momentumRef.current, m, FORMATION_TILT[next] ?? 0);
    pushFeed({ id: `form-${m}-${next}`, minute: m, kind: 'decision', text: L(`Formação: ${next}`, `Formation: ${next}`) });
  };

  /** Agenda o próximo passo do relógio (pausa quando uma decisão está aberta). */
  const scheduleNext = (delay: number) => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    if (pausadoRef.current) return; // prancheta do LEGACY: o relógio espera o manager voltar ao jogo
    timerRef.current = window.setTimeout(() => { tickRef.current(); }, delay);
  };
  const tickRef = useRef<() => void>(() => {});

  const processEvent = (e: MatchPlanEvent, idx: number) => {
    const base = e.kind.replace(/_(home|away)$/, '');
    // Tally por jogador (nota): gol/chute do autor; defesa creditada ao GK adversário.
    if (base === 'goal') { tally(e.actor_id, e.actor_side, 'goals'); tally(e.actor_id, e.actor_side, 'shots'); }
    else if (base === 'shot' || base === 'chance' || base === 'woodwork') tally(e.actor_id, e.actor_side, 'shots');
    if (e.kind === 'goal_home') {
      scoreRef.current.home += 1;
      setHomeScore((v) => v + 1);
      pushFeed({ id: `g-${idx}`, minute: e.minute, kind: 'goal_home', text: e.text, side: 'home', actorId: e.actor_id });
    } else if (e.kind === 'goal_away') {
      scoreRef.current.away += 1;
      setAwayScore((v) => v + 1);
      if (scoreRef.current.away > scoreRef.current.home) wasLosingRef.current = true;
      pushFeed({ id: `g-${idx}`, minute: e.minute, kind: 'goal_away', text: e.text, side: 'away', actorId: e.actor_id });
    } else if (e.kind === 'yellow_home') {
      cardsRef.current.cardsHome += 1;
      pushFeed({ id: `y-${idx}`, minute: e.minute, kind: 'yellow', text: e.text, side: 'home', actorId: e.actor_id });
    } else if (e.kind === 'yellow_away') {
      cardsRef.current.cardsAway += 1;
      pushFeed({ id: `y-${idx}`, minute: e.minute, kind: 'yellow', text: e.text, side: 'away', actorId: e.actor_id });
    } else if (e.kind === 'injury_away') {
      pushFeed({ id: `inj-${idx}`, minute: e.minute, kind: 'injury', text: e.text, side: 'away', actorId: e.actor_id });
    } else if (e.kind === 'red_home') {
      cardsRef.current.sentOffHome += 1;
      pushFeed({ id: `r-${idx}`, minute: e.minute, kind: 'red', text: e.text, side: 'home', actorId: e.actor_id });
    } else if (e.kind === 'red_away') {
      cardsRef.current.sentOffAway += 1;
      pushFeed({ id: `r-${idx}`, minute: e.minute, kind: 'red', text: e.text, side: 'away', actorId: e.actor_id });
    } else if (base === 'save' || base === 'chance' || base === 'woodwork' || base === 'counter') {
      // Momentos dramáticos de construção entram no feed (contam a história).
      pushFeed({ id: `m-${idx}`, minute: e.minute, kind: base as 'save' | 'chance' | 'woodwork' | 'counter', text: e.text, side: e.actor_side, actorId: e.actor_id });
    }
    // FEEDBACK DO NARRADOR: quando o lance é fruto de uma decisão sua, o Analista
    // comenta a consequência (fecha o loop decisão → efeito).
    if (e.decision_influenced && e.reason) {
      pushFeed({ id: `nf-${idx}`, minute: e.minute, kind: 'insight', text: L(`Analista — ${e.reason}.`, `Analyst — ${e.reason}.`) });
    }
    // buildup/corner/shot ficam só no palco principal (ritmo, sem poluir o feed)
  };

  const finalize = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    const verdicts = computeBeatVerdicts(eventsRef.current, ledgerRef.current);
    const reading = computeReadingScore(ledgerRef.current, offeredRef.current);
    // Estatísticas pro pós-jogo (a partir dos eventos do plano).
    const isShotKind = (k: string) => /^(shot|chance|goal|save|woodwork)_/.test(k);
    const evs = eventsRef.current;
    const stats = {
      homeShots: evs.filter((e) => isShotKind(e.kind) && e.actor_side === 'home').length,
      awayShots: evs.filter((e) => isShotKind(e.kind) && e.actor_side === 'away').length,
      // "Defesaça do nosso goleiro" = finalização do adversário que foi defendida.
      homeSaves: evs.filter((e) => e.kind === 'save_away').length,
      awaySaves: evs.filter((e) => e.kind === 'save_home').length,
      // Posse REAL do motor (minutos de bola) quando disponível; senão, o velho
      // proxy de média de momento (compat com planos antigos).
      possessionHome: plan.possession_home_pct != null
        ? Math.round(plan.possession_home_pct)
        : momentumRef.current.length
          ? Math.round(momentumRef.current.reduce((s, m) => s + m, 0) / momentumRef.current.length)
          : 50,
    };
    const skipped = Math.max(0, offeredBeatsRef.current.length - ledgerRef.current.length);
    setDoneInfo({ verdicts, reading, skipped, stats });

    const emitComplete = (shootout?: ShootoutResult) => {
      // FABLE/Cicatrizes — herói do fim: gol da casa aos 85'+ no tempo normal.
      const lateHeroIds = [...new Set(
        eventsRef.current
          .filter((e) => e.kind === 'goal_home' && e.minute >= 85 && e.actor_id)
          .map((e) => e.actor_id as string),
      )];
      onComplete?.(plan, {
        homeScore: scoreRef.current.home,
        awayScore: scoreRef.current.away,
        ledger: [...ledgerRef.current],
        verdicts,
        reading,
        replanned: replannedRef.current,
        playerStats: { ...statsRef.current },
        homeOnPitch: field.map((p) => p.id),
        stats: { homeShots: stats.homeShots, awayShots: stats.awayShots, possessionHome: stats.possessionHome, wasLosing: wasLosingRef.current },
        shootout: shootout
          ? {
              winner: shootout.winner,
              homeTally: shootout.homeTally,
              awayTally: shootout.awayTally,
              // FABLE/Cicatrizes — cobranças da casa (erro marca; conversão cura).
              homeKicks: shootout.kicks
                .filter((k) => k.side === 'home')
                .map((k) => ({ kickerId: k.kickerId, scored: k.scored })),
            }
          : undefined,
        styleLog: [...styleLogRef.current],
        lateHeroIds,
      });
    };
    completeMatchRef.current = emitComplete;

    // EMPATE → DISPUTA DE PÊNALTIS (nenhum jogo termina empatado).
    if (scoreRef.current.home === scoreRef.current.away && buildShootout) {
      const setup = buildShootout();
      if (setup && setup.homeKickers.length >= 5 && setup.awayKickers.length >= 1) {
        setShootoutSetup(setup);
        setPhase('shootout');
        return; // emitComplete dispara quando a disputa terminar
      }
    }
    setPhase('done');
    emitComplete();
  };
  const completeMatchRef = useRef<(s?: ShootoutResult) => void>(() => {});

  const runHalftime = async () => {
    htDoneRef.current = true;
    const ctx: QuickPlanHalftimeContext = {
      ledger: [...ledgerRef.current],
      homeScore: scoreRef.current.home,
      awayScore: scoreRef.current.away,
      momentumEnd: momentumRef.current[44] ?? 50,
      ...cardsRef.current,
      subsUsed: subsUsedRef.current,
      auxiliar: leituraDoIntervalo(eventsRef.current.slice(0, eventIdxRef.current), { casa: scoreRef.current.home, fora: scoreRef.current.away }),
    };
    pushFeed({
      id: 'ht',
      minute: 45,
      kind: 'halftime',
      text: L(`Intervalo — ${ctx.homeScore} x ${ctx.awayScore}`, `Half-time — ${ctx.homeScore} x ${ctx.awayScore}`),
    });
    try {
      const h2 = await onSecondHalf?.(ctx);
      if (h2 && Array.isArray(h2.events)) {
        replannedRef.current = true;
        const played = eventsRef.current.slice(0, eventIdxRef.current); // já exibidos
        eventsRef.current = [...played, ...h2.events];
        eventIdxRef.current = played.length; // aponta pro 1º evento do 2º tempo
        beatsQueueRef.current = (h2.analyst_beats ?? []).filter((b) => b.minute > 45);
        momentumRef.current = [...momentumRef.current.slice(0, 45), ...h2.momentum_curve];
      }
    } catch {
      // Replan falhou: segue o 2º tempo baseline do plano original
    }
    // Sincroniza o elenco vivo com as substituições feitas no INTERVALO (no pai):
    // sem isso, a lenda que ENTRA no 2º tempo não entraria em `field` e o buff dela
    // nunca apareceria no seletor de Legacy. Agora aparece (request #2).
    const ll = secondHalfLineup?.();
    if (ll) {
      // Conta no teto de 5 as trocas feitas no INTERVALO (quem entrou e não
      // estava em campo antes).
      bumpSubs(ll.field.filter((nf) => !field.some((of) => of.id === nf.id)).length);
      setField(ll.field);
      setBenchPool(ll.bench);
    }
    // minuteRef segue em 45 → ao retomar, o relógio avança pro 46 e roda o 2º tempo.
    setPhase('playing');
    scheduleNext(600);
  };

  /** Entrada do evento: ANTES de mostrar um lance de alto sinal (gol, contra-ataque,
   *  chance grande), anuncia a CHAMADA de contexto ("Olha o contra-ataque!") por um
   *  instante — assim o desfecho nunca sai "do nada". Depois processa o lance. */
  const handleEvent = (next: MatchPlanEvent, idx: number) => {
    const lead = classifyTransition({
      event: next,
      momentumHome: momentumRef.current[Math.max(0, Math.min(89, next.minute - 1))] ?? 50,
      prevKind: prevEventKindRef.current,
    });
    prevEventKindRef.current = next.kind;
    if (lead) {
      const isGoalEv = next.kind === 'goal_home' || next.kind === 'goal_away';
      // Gol já tem o "momento decisivo" (clutch) como interação. As demais
      // situações viram ESCOLHA de 3 opções (neg/neutro/pos): a certa dá buff.
      const reactable = !isGoalEv && lead.reactions.length === 3;
      setLeadIn(lead);
      setLeadInReactable(reactable);
      setPhase('leadin');
      leadInPendingRef.current = reactable ? { ev: next, idx } : null;
      leadInResolvedRef.current = false;
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        if (leadInResolvedRef.current) return; // não escolheu → neutro, sem buff
        leadInResolvedRef.current = true;
        leadInPendingRef.current = null;
        setLeadIn(null);
        setLeadInReactable(false);
        processSignalEvent(next, idx);
      }, reactable ? LEADIN_REACT_MS : LEADIN_MS);
      return;
    }
    processSignalEvent(next, idx);
  };

  /** REAÇÃO À CHAMADA: 3 opções (neg/neutro/pos). A certa (positiva) dá buff ao
   *  lance iminente + janela (~10s); a errada (negativa) PUNE; neutra não mexe.
   *  Crítico ×2/×3 vale nos dois sentidos. Não escolher = neutro (sem punição). */
  const reactToLeadIn = (choice: ReactionChoice) => {
    const pend = leadInPendingRef.current;
    const lead = leadIn;
    if (!pend || !lead || leadInResolvedRef.current) return;
    leadInResolvedRef.current = true;
    leadInPendingRef.current = null;
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    const { ev, idx } = pend;
    const attack = lead.intent === 'attack';
    const effect = choice.effect;

    if (effect !== 'neutral') {
      const crit = rollDecisionCrit(plan.seed, `reac-${ev.minute}-${ev.kind}`);
      const pct = EFFECT_BUFF_PCT[effect] * crit.mult; // +2.5%/−2.5% × crit
      const decisionChoice = {
        id: `reac-${ev.minute}-${ev.kind}-${effect}`,
        label: choice.label,
        channel: ev.channel ?? 'ataque_central',
        target_side: (attack ? 'home' : 'away') as 'home' | 'away',
        weight: buffPctToWeight(EFFECT_BUFF_PCT[effect]) * crit.mult, // sinal embutido
        effect,
      };
      eventsRef.current = applyDecisionToRemainingEvents({
        events: eventsRef.current,
        fromIndex: idx, // inclui o lance iminente
        atMinute: ev.minute,
        half: ev.minute <= 45 ? 1 : 2,
        choice: decisionChoice,
        seed: plan.seed,
        windowMinutes: BUFF_WINDOW_MINUTES,
      }).events;
      const side = attack ? L('ATAQUE', 'ATTACK') : L('DEFESA', 'DEFENCE');
      const positive = effect === 'positive';
      const fxKey = (fxSeqRef.current += 1);
      setFloatFx({
        key: fxKey,
        text: crit.isCrit
          ? L(`⚡ ${positive ? 'ACERTO' : 'ERRO'} CRÍTICO ×${crit.mult} · ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, `⚡ CRITICAL ${positive ? 'HIT' : 'MISS'} ×${crit.mult} · ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`)
          : `${positive ? L('ACERTO!', 'NAILED IT!') : L('ERROU!', 'MISSED!')} ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% ${side}`,
        tier: crit.isCrit ? 'crit' : positive ? 'pos' : 'neg',
      });
      window.setTimeout(() => setFloatFx((f) => (f && f.key === fxKey ? null : f)), 1500);
      setActiveBuff({ pct, tier: crit.isCrit ? 'crit' : positive ? 'pos' : 'neg', untilMinute: ev.minute + BUFF_WINDOW_MINUTES });
      pushFeed({ id: `reac-${ev.minute}`, minute: ev.minute, kind: 'decision', text: `${positive ? L('Leu bem', 'Good read') : L('Leu errado', 'Wrong read')}: ${choice.label}` });
    } else {
      const fxKey = (fxSeqRef.current += 1);
      setFloatFx({ key: fxKey, text: L('Plano mantido', 'Plan kept'), tier: 'neutral' });
      window.setTimeout(() => setFloatFx((f) => (f && f.key === fxKey ? null : f)), 1500);
      pushFeed({ id: `reac-${ev.minute}`, minute: ev.minute, kind: 'decision', text: L(`Manteve: ${choice.label}`, `Kept: ${choice.label}`) });
    }

    setLeadIn(null);
    setLeadInReactable(false);
    processSignalEvent(eventsRef.current[idx] ?? ev, idx);
  };

  /** Processa UM evento que caiu no minuto atual. Decisões pausam; lances
   *  comuns destacam no palco e seguram o relógio por HOLD_MS. */
  const processSignalEvent = (next: MatchPlanEvent, idx: number) => {
    if (next.kind === 'penalty_home') {
      pushFeed({ id: `pen-${idx}`, minute: next.minute, kind: 'penalty', text: L('Pênalti pra gente!', 'Penalty to us!'), side: 'home' });
      setPenalty({ idx, minute: next.minute });
      setPhase('penalty');
      return;
    }
    if (next.kind === 'penalty_away') {
      const rng = new SpiritRng(hashSeed(`${plan.seed}:penA:${next.minute}`));
      if (rng.next() < 0.74) {
        scoreRef.current.away += 1;
        setAwayScore((v) => v + 1);
        if (scoreRef.current.away > scoreRef.current.home) wasLosingRef.current = true;
        momentumRef.current = nudgeMomentumCurve(momentumRef.current, next.minute, -15); // gol deles puxa o momento
        setCelebration({ key: `pen-away-${idx}`, name: plan.away_short, portrait: null, narrative: goalLine(next.minute, L('Pênalti convertido pelo adversário. Dói, mas segue.', 'Penalty converted by the opponent. It hurts, but we go on.')), side: 'away' });
        setPhase('celebration');
      } else {
        momentumRef.current = nudgeMomentumCurve(momentumRef.current, next.minute, 16); // paredão! a torcida vira o jogo
        pushFeed({ id: `pen-${idx}`, minute: next.minute, kind: 'save', text: L('PEGOU! Pênalti defendido — que paredão!', 'SAVED! Penalty stopped — what a wall!'), side: 'home' });
        scheduleNext(HOLD_MS.big);
      }
      return;
    }
    if (next.kind === 'injury_home') {
      pushFeed({ id: `inj-${idx}`, minute: next.minute, kind: 'chance', text: next.text, side: 'home', actorId: next.actor_id });
      // O lance de lesão pode vir sem nome: busca no elenco (antes saía "starter is hurt").
      const lesionado = next.actor_name ?? field.find((c) => c.id === next.actor_id)?.name ?? L('um titular', 'a starter');
      setForced({ kind: 'injury', idx, minute: next.minute, outName: lesionado, outId: next.actor_id });
      setPhase('forced');
      return;
    }
    if (next.kind === 'red_home') {
      cardsRef.current.sentOffHome += 1;
      pushFeed({ id: `red-${idx}`, minute: next.minute, kind: 'red', text: next.text, side: 'home', actorId: next.actor_id });
      setForced({ kind: 'red', idx, minute: next.minute, outName: next.actor_name ?? L('jogador', 'player') });
      setPhase('forced');
      return;
    }
    // MOMENTO DECISIVO: gol natural vira escolha de última fração (faz/salva).
    if ((next.kind === 'goal_home' || next.kind === 'goal_away') && !next.decision_influenced) {
      const intent = next.kind === 'goal_home' ? 'attack' : 'defend';
      const moment = buildClutch({ intent, minute: next.minute, seed: plan.seed, actorName: next.actor_name ?? (intent === 'attack' ? plan.home_short : plan.away_short) });
      setClutch({ idx, moment, duelo: montarDuelo(moment, next.actor_id, field, awayCards ?? []) });
      setPhase('clutch');
      return;
    }

    processEvent(next, idx);

    // Gol fruto de DECISÃO tática → comemora direto.
    if (next.kind === 'goal_home' || next.kind === 'goal_away') {
      const side = next.actor_side;
      // Gol sacode o momento (a barra reage ao placar).
      momentumRef.current = nudgeMomentumCurve(momentumRef.current, next.minute, side === 'home' ? 14 : -14);
      setCelebration({
        key: `goal-${idx}`,
        name: next.actor_name ?? (side === 'home' ? plan.home_short : plan.away_short),
        portrait: portraitOf?.(next.actor_id, side) ?? null,
        narrative: goalLine(next.minute, next.text.replace(/^\d+'\s*—\s*/, '')),
        side,
      });
      setPhase('celebration');
      return;
    }

    // Lance comum: destaca no palco e segura o relógio um instante.
    setHighlight(next);
    scheduleNext(Math.max(HOLD_MS[next.weight_tier], segurarLance?.(next) ?? 0));
  };

  /** Sobrepõe a leitura do beat pela narração rica (Sonnet), se houver. */
  function narrateBeat(beat: AnalystBeat): AnalystBeat {
    const rich = narration?.beats[beat.id];
    return rich ? { ...beat, insight: { ...beat.insight, text: rich } } : beat;
  }
  /** Narração rica do gol por minuto (Sonnet), com fallback pro texto do Python. */
  function goalLine(minute: number, fallback: string): string {
    return narration?.goals[String(minute)] ?? fallback;
  }

  /** RELÓGIO CORRIDO: roda minuto a minuto; eventos/decisões caem no seu minuto. */
  const tick = () => {
    const m = minuteRef.current;

    // 1) Há decisão/evento AINDA no minuto atual? (colisões no mesmo minuto)
    const beat = beatsQueueRef.current[0];
    if (m > 0 && beat && beat.minute === m) {
      beatsQueueRef.current = beatsQueueRef.current.slice(1);
      offeredRef.current += 1;
      offeredBeatsRef.current.push(beat);
      // Analista REAL ≤5 palavras: gera o beat com o estado vivo da partida
      // (3 tipos rotativos: @setor cansado / @teu destaque / @time), a escolha
      // "fazer" favorece o próximo lance via applyDecisionToRemainingEvents.
      const liveBeat = buildLiveAnalystBeat({
        beatId: beat.id,
        minute: beat.minute,
        index: offeredRef.current - 1,
        homeScore: scoreRef.current.home,
        awayScore: scoreRef.current.away,
        momentum: momentumRef.current[Math.max(0, m - 1)] ?? 50,
        homeStats: Object.entries(statsRef.current).map(([id, s]) => ({ id, side: s.side, goals: s.goals, shots: s.shots })),
        homeNameById: Object.fromEntries(field.map((c) => [c.id, c.name])),
        awayPlayers: (awayCards ?? []).map((c) => ({ pos: c.pos, fatigue: c.fatigue })),
      });
      offeredBeatsRef.current[offeredBeatsRef.current.length - 1] = liveBeat;
      pushFeed({ id: `i-${beat.id}`, minute: beat.minute, kind: 'insight', text: liveBeat.insight.text });
      setActiveBeat(liveBeat);
      setPhase('beat');
      return;
    }
    const ev = eventsRef.current[eventIdxRef.current];
    if (m > 0 && ev && ev.minute === m) {
      const idx = eventIdxRef.current;
      eventIdxRef.current = idx + 1;
      // ESTILO AO VIVO: o estilo certo pro momento CONVERTE (gol/blindagem); o
      // errado CUSTA (gol perdido / leva gol). Não re-mexe em lances já moldados
      // por uma decisão (beat/clutch), pra não contar duas vezes.
      let shown = ev;
      if (!ev.decision_influenced) {
        const res = resolveStyleOnEvent({
          event: ev,
          chosen: styleRef.current,
          state: {
            scoreDiff: scoreRef.current.home - scoreRef.current.away,
            minute: m,
            momentum: momentumRef.current[Math.max(0, Math.min(89, m - 1))] ?? 50,
          },
          seed: plan.seed,
          index: idx,
        });
        if (res.flip) {
          shown = res.event;
          eventsRef.current = eventsRef.current.map((e, i) => (i === idx ? res.event : e));
          // FABLE — SELO DE CONSEQUÊNCIA: o flip era invisível; agora o jogo
          // CONFESSA que a sua escolha causou o lance ("SUA LEITURA") ou o
          // castigo ("O PREÇO"). Fecha o loop escolha → efeito, ao vivo.
          const good = res.flip === 'home_goal' || res.flip === 'shield';
          const fxKey = (fxSeqRef.current += 1);
          setFloatFx({
            key: fxKey,
            text: good ? L(`✓ SUA LEITURA — ${STYLE_LABEL[styleRef.current]}`, `✓ YOUR READ — ${STYLE_LABEL[styleRef.current]}`) : L(`✕ O PREÇO — ${STYLE_LABEL[styleRef.current]}`, `✕ THE PRICE — ${STYLE_LABEL[styleRef.current]}`),
            tier: good ? 'pos' : 'neg',
          });
          window.setTimeout(() => setFloatFx((f) => (f && f.key === fxKey ? null : f)), 1600);
        }
      }
      // LEGACY ATIVO: a lenda puxa o time — chance extra de converter quase-gol.
      if (legacyActiveRef.current && m <= legacyUntilRef.current && !shown.decision_influenced) {
        const boosted = resolveLegacyBoost({ event: shown, totalPct: legacyPctRef.current, seed: plan.seed, index: idx, legendName: legacyNameRef.current });
        if (boosted) {
          shown = boosted;
          eventsRef.current = eventsRef.current.map((e, i) => (i === idx ? boosted : e));
        }
      }
      // FORMAÇÃO: a forma do time muda o jogo de verdade (ofensiva = mais gol e
      // mais risco; defensiva = blinda). Só se o lance ainda não foi moldado.
      if (!shown.decision_influenced) {
        const ff = resolveFormationOnEvent({ event: shown, formation: formationRef.current, seed: plan.seed, index: idx });
        if (ff) {
          shown = ff;
          eventsRef.current = eventsRef.current.map((e, i) => (i === idx ? ff : e));
        }
      }
      handleEvent(shown, idx);
      return;
    }

    // 2) Nada mais neste minuto → o relógio anda.
    if (m >= 90) { finalize(); return; }
    const nm = m + 1;
    // INTERVALO ao cruzar o 45'.
    if (nm === 46 && !htDoneRef.current && onSecondHalf) {
      setPhase('halftime');
      void runHalftime();
      return;
    }
    minuteRef.current = nm;
    setMinute(nm);
    setHighlight(null);
    scheduleNext(relogioMs ?? CLOCK_MS);
  };
  tickRef.current = tick;

  /** Resolve o momento decisivo: faz/salva o gol conforme a leitura + feedback. */
  const resolveClutchChoice = (key: ClutchKey) => {
    const c = clutch;
    setClutch(null);
    if (!c) return;
    const ev = eventsRef.current[c.idx];
    // Fase 9: o duelo pesa de verdade — a vantagem de atributo entra no resultado.
    const res = resolveClutch(c.moment, key, plan.seed, forcaNoDuelo(c.duelo, key));
    // O gol planejado foi "consumido" pelo momento decisivo: neutraliza o evento
    // original pra ele não reaparecer como card de gol ao retomar o jogo.
    eventsRef.current = eventsRef.current.map((e, i) =>
      i === c.idx ? { ...e, kind: 'narrative', weight_tier: 'minor', text: res.headline, decision_influenced: false } : e,
    );
    pushFeed({
      id: `clutch-${c.idx}`,
      minute: c.moment.minute,
      kind: c.moment.intent === 'attack' ? (res.success ? 'goal_home' : 'chance') : (res.success ? 'save' : 'goal_away'),
      text: `${res.headline} ${res.feedback}`,
      side: c.moment.intent === 'attack' ? 'home' : 'away',
      actorId: ev?.actor_id,
    });

    const homeScores = c.moment.intent === 'attack' ? res.success : false;
    const awayScores = c.moment.intent === 'defend' ? !res.success : false;

    if (homeScores || awayScores) {
      if (homeScores) { scoreRef.current.home += 1; setHomeScore((v) => v + 1); tally(ev?.actor_id, 'home', 'goals'); tally(ev?.actor_id, 'home', 'shots'); }
      else { scoreRef.current.away += 1; setAwayScore((v) => v + 1); if (scoreRef.current.away > scoreRef.current.home) wasLosingRef.current = true; }
      // O gol SACODE o momento: a barra reage ao placar (o % deixa de parecer ilusório).
      momentumRef.current = nudgeMomentumCurve(momentumRef.current, c.moment.minute, homeScores ? 14 : -14);
      setCelebration({
        key: `clutch-${c.idx}`,
        name: homeScores ? c.moment.actorName : plan.away_short,
        portrait: homeScores ? (portraitOf?.(ev?.actor_id, 'home') ?? null) : null,
        narrative: goalLine(c.moment.minute, res.feedback),
        side: homeScores ? 'home' : 'away',
      });
      setPhase('celebration');
    } else {
      setHighlight(null);
      setPhase('playing');
      scheduleNext(1100);
    }
  };

  // LEGACY: prazo do momento decisivo. Sem resposta, o jogador escolhe sozinho —
  // pela maior vantagem no duelo (a leitura dele, não a do técnico).
  const resolverClutchRef = useRef(resolveClutchChoice);
  resolverClutchRef.current = resolveClutchChoice;
  const clutchChave = phase === 'clutch' && clutch ? clutch.idx : null;
  useEffect(() => {
    if (clutchChave === null || !pedirReplan) return undefined;
    const t = window.setTimeout(() => {
      const c = clutch;
      if (!c) return;
      const vantagem = (k: ClutchKey) => { const d = c.duelo?.porOpcao[k]; return d ? d.nosso - d.deles : 0; };
      const escolha = [...c.moment.options].sort((a, b) => vantagem(b.key) - vantagem(a.key))[0];
      if (!escolha) return;
      pushFeed({ id: `clutch-auto-${c.idx}`, minute: c.moment.minute, kind: 'insight', text: L(`Sem ordem do técnico: ${c.moment.actorName} decidiu sozinho — ${escolha.label}.`, `No call from the bench: ${c.moment.actorName} decided alone — ${escolha.label}.`) });
      resolverClutchRef.current(escolha.key);
    }, PRAZO_DECISIVO_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clutchChave, pedirReplan]);

  const dismissCelebration = () => {
    setCelebration(null);
    setHighlight(null);
    setPhase('playing');
    scheduleNext(320);
  };

  /** Aplica uma troca no elenco vivo + no banco + avisa o pai. */
  const swapInField = (outId: string | undefined, inCard: SquadCard) => {
    setField((prev) => (outId ? prev.map((p) => (p.id === outId ? inCard : p)) : prev));
    setBenchPool((prev) => prev.filter((b) => b.id !== inCard.id));
    if (outId) onSubstitution?.(outId, inCard.id);
  };

  /** Lesão: o reserva escolhido entra; o jogo segue. */
  const resolveInjury = (inCard: SquadCard) => {
    const f = forced;
    setForced(null);
    if (f) {
      pushFeed({ id: `subin-${f.idx}`, minute: f.minute, kind: 'insight', text: L(`Entra ${inCard.name} no lugar de ${f.outName}.`, `${inCard.name} comes on for ${f.outName}.`) });
      swapInField(f.outId, inCard);
    }
    setPhase('playing');
    scheduleNext(500);
  };

  /** Substituição A QUALQUER MOMENTO: pausa o relógio pra escolher o reserva. */
  const openSub = (outId: string) => {
    if (phase !== 'playing' || benchPool.length === 0 || subsUsedRef.current >= MAX_SUBS) return;
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    setSubOut(outId);
    setPhase('sub');
  };

  /** Confirma a troca no meio do jogo: mexe no elenco + pesa no resto. */
  const applyAnytimeSub = (inCard: SquadCard) => {
    const outId = subOut;
    setSubOut(null);
    if (outId) efetivarTroca(outId, inCard);
    setPhase('playing');
    scheduleNext(450);
  };

  /** A troca em si (botão da Rápida ou arrastando do banco no LEGACY). */
  const efetivarTroca = (outId: string, inCard: SquadCard) => {
    {
      const outCard = field.find((p) => p.id === outId);
      pushFeed({ id: `sub-${minute}-${outId}`, minute, kind: 'insight', text: L(`Substituição: entra ${inCard.name}${outCard ? `, sai ${outCard.name}` : ''}.`, `Substitution: ${inCard.name} on${outCard ? `, ${outCard.name} off` : ''}.`) });
      swapInField(outId, inCard);
      bumpSubs(1); // conta no teto de 5
      // Efeito real no resto do jogo (sem replan): OVR + pernas frescas + encaixe.
      // posMatch=false (ex.: atacante no gol) já entra como "não encaixou" no
      // applySubNudge — o peso do fora-de-posição é embutido aqui.
      const delta = inCard.ovr - (outCard?.ovr ?? inCard.ovr);
      eventsRef.current = applySubNudge({
        events: eventsRef.current, fromIndex: eventIdxRef.current, ovrDelta: delta, seed: plan.seed, outId,
        freshnessDelta: (outCard?.fatigue ?? 0) - inCard.fatigue,
        posMatch: outCard?.pos === inCard.pos,
      });
      entradasRef.current[inCard.id] = minuteRef.current;
    }
  };

  /** Vermelho: segue com 10 — aplica o peso do desfalque no resto do jogo. */
  const resolveRedCard = () => {
    const f = forced;
    setForced(null);
    if (f) {
      eventsRef.current = applyManDownPenalty({ events: eventsRef.current, fromIndex: f.idx + 1, seed: plan.seed });
      pushFeed({ id: `red10-${f.idx}`, minute: f.minute, kind: 'insight', text: L('Analista — com um a menos, vai ser na raça.', 'Analyst — a man down, it\'s all heart now.') });
    }
    setPhase('playing');
    scheduleNext(500);
  };

  /** Resolve o pênalti da casa com o batedor escolhido (determinístico). */
  const takePenalty = (taker: PenaltyTaker) => {
    const pen = penalty;
    setPenalty(null);
    if (!pen) return;
    const rng = new SpiritRng(hashSeed(`${plan.seed}:penH:${pen.minute}:${taker.id}`));
    // Chance de gol cresce com a finalização do batedor (0.55–0.92).
    const goalProb = Math.max(0.5, Math.min(0.92, 0.55 + (taker.finalizacao - 50) / 100 * 0.5));
    const scored = rng.next() < goalProb;
    if (scored) {
      scoreRef.current.home += 1;
      setHomeScore((v) => v + 1);
      tally(taker.id, 'home', 'goals');
      tally(taker.id, 'home', 'shots');
      momentumRef.current = nudgeMomentumCurve(momentumRef.current, pen.minute, 15); // pênalti convertido empurra o momento
      setCelebration({
        key: `pen-${pen.idx}`,
        name: taker.name,
        portrait: taker.portrait,
        narrative: L(`Pênalti! ${taker.name} bate com categoria e marca!`, `Penalty! ${taker.name} strikes with class and scores!`),
        side: 'home',
      });
      setPhase('celebration');
    } else {
      // PÊNALTI PERDIDO: choque psicológico — o momento pende pro adversário (#2).
      momentumRef.current = nudgeMomentumCurve(momentumRef.current, pen.minute, -16);
      pushFeed({ id: `penm-${pen.idx}`, minute: pen.minute, kind: 'chance', text: L(`${taker.name} bateu o pênalti e o goleiro pegou! Que azar.`, `${taker.name} took the penalty and the keeper saved it! Unlucky.`), side: 'home', actorId: taker.id });
      setPhase('playing');
      scheduleNext(900);
    }
  };

  // Inicia o relógio corrido no mount; limpa o timer ao desmontar.
  useEffect(() => {
    scheduleNext(relogioMs ?? CLOCK_MS);
    return () => { if (timerRef.current != null) window.clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Encerra a janela do Legacy quando o relógio passa dos ~15'.
  useEffect(() => {
    if (legacyActiveRef.current && minute > legacyUntilRef.current) {
      legacyActiveRef.current = false;
      setLegacyActive(false);
    }
    // Encerra o buff de decisão quando a janela (~10s) expira.
    setActiveBuff((b) => (b && minute > b.untilMinute ? null : b));
  }, [minute]);

  const handleBeatChoice = (choice: AnalystBeatChoice | null) => {
    const beat = activeBeat;
    if (beat && choice) {
      const effect = choice.effect ?? (choice.weight > 0 ? 'positive' : choice.weight < 0 ? 'negative' : 'neutral');
      // CRÍTICO: 5% de chance → multiplica o buff por 2× ou 3× (determinístico).
      const crit = rollDecisionCrit(plan.seed, beat.id);
      const effectivePct = EFFECT_BUFF_PCT[effect] * crit.mult; // ex.: +2.5% × 2 = +5%
      const buffedChoice = { ...choice, weight: choice.weight * crit.mult };
      ledgerRef.current.push(toDecisionRecord(beat, buffedChoice));
      const res = applyDecisionToRemainingEvents({
        events: eventsRef.current,
        fromIndex: eventIdxRef.current, // afeta os eventos ainda não exibidos
        beat,
        choice: buffedChoice,
        seed: plan.seed,
        windowMinutes: BUFF_WINDOW_MINUTES, // buff dura ~10s (janela de minutos)
      });
      eventsRef.current = res.events;
      pushFeed({ id: `d-${beat.id}`, minute: beat.minute, kind: 'decision', text: L(`Você: ${choice.label}`, `You: ${choice.label}`) });

      // FX flutuante do impacto (sobe da barra de momento e some) + chip de buff ativo.
      const side = choice.target_side === 'away' ? L('DEFESA', 'DEFENCE') : L('ATAQUE', 'ATTACK');
      const sign = effectivePct > 0 ? '+' : '';
      const fxTier: 'pos' | 'neg' | 'neutral' | 'crit' =
        crit.isCrit ? 'crit' : effect === 'positive' ? 'pos' : effect === 'negative' ? 'neg' : 'neutral';
      const fxText = effect === 'neutral'
        ? L('Plano mantido', 'Plan kept')
        : crit.isCrit
          ? `⚡ ${L('CRÍTICO', 'CRITICAL')} ×${crit.mult} · ${sign}${effectivePct.toFixed(1)}% ${side}`
          : `${sign}${effectivePct.toFixed(1)}% ${side}`;
      const key = (fxSeqRef.current += 1);
      setFloatFx({ key, text: fxText, tier: fxTier });
      window.setTimeout(() => setFloatFx((f) => (f && f.key === key ? null : f)), 1500);
      if (effect !== 'neutral') {
        setActiveBuff({
          pct: effectivePct,
          tier: crit.isCrit ? 'crit' : effect === 'positive' ? 'pos' : 'neg',
          untilMinute: beat.minute + BUFF_WINDOW_MINUTES,
        });
      }
    }
    setActiveBeat(null);
    setPhase('playing');
    scheduleNext(350);
  };

  // LEGACY (Fase 4b) — gritos e ordens do manager no campo.
  const [gritoAtivo, setGritoAtivo] = useState<{ tipo: string; ate: number } | null>(null);
  const gritoLivreEmRef = useRef(0);
  const [ordens, setOrdens] = useState<Record<string, string>>({});
  /** LEGACY (Fase 4c): minuto em que cada reserva entrou (o servidor não cobra fôlego de quem estava no banco). */
  const entradasRef = useRef<Record<string, number>>({});
  const [pausado, setPausado] = useState(false);
  /** Emenda o futuro de um replan de comando: o que já passou (e o que falta até
   *  o minuto inicial dele) fica; daí em diante vale o plano novo. */
  const replanSeqRef = useRef(0);
  const emendarReplan = (novo: MatchPlan) => {
    // Replan do 1º tempo que chegou depois do intervalo: o do intervalo já manda.
    if ((novo.start_minute ?? 0) <= 45 && minuteRef.current >= 45) return;
    const inicio = Math.max(novo.start_minute ?? 0, minuteRef.current + 1);
    const jaVistos = eventsRef.current.slice(0, eventIdxRef.current);
    const ateInicio = eventsRef.current.slice(eventIdxRef.current).filter((e) => e.minute < inicio);
    eventsRef.current = [...jaVistos, ...ateInicio, ...novo.events.filter((e) => e.minute >= inicio)];
    eventIdxRef.current = jaVistos.length;
    beatsQueueRef.current = [
      ...beatsQueueRef.current.filter((b) => b.minute < inicio),
      ...(novo.analyst_beats ?? []).filter((b) => b.minute >= inicio),
    ];
    const ini = novo.start_minute ?? inicio;
    momentumRef.current = [...momentumRef.current.slice(0, ini - 1), ...novo.momentum_curve];
  };
  const replanAoVivo = (cmd: ComandoSemMinuto | null) => {
    if (!pedirReplan) return;
    const m = minuteRef.current;
    const ctx: ContextoDoReplan = {
      ledger: [...ledgerRef.current], homeScore: scoreRef.current.home, awayScore: scoreRef.current.away,
      momentumEnd: momentumRef.current[Math.max(0, m - 1)] ?? 50, ...cardsRef.current, subsUsed: subsUsedRef.current,
      minuto: m, entradas: { ...entradasRef.current },
    };
    const seq = ++replanSeqRef.current; // só vale a resposta do comando mais recente
    void pedirReplan(cmd, ctx)
      .then((novo) => { if (novo && Array.isArray(novo.events) && seq === replanSeqRef.current) emendarReplan(novo); })
      .catch(() => undefined);
  };
  /** LEGACY (Fase 4c): substituição arrastada do banco — sem sair do campo, sem pausar. */
  const trocarNoCampo = (outId: string, inId: string) => {
    if (phase !== 'playing' || subsUsedRef.current >= MAX_SUBS) return;
    const inCard = benchPool.find((b) => b.id === inId);
    if (!inCard || !field.some((p) => p.id === outId)) return;
    efetivarTroca(outId, inCard);
    replanAoVivo(null); // a verdade refaz o futuro com quem entrou
  };
  const comandar = (cmd: ComandoSemMinuto) => {
    const m = minuteRef.current;
    if (cmd.tipo !== 'ordem') {
      if (m < gritoLivreEmRef.current) return; // recarga (o servidor também confere)
      gritoLivreEmRef.current = m + RECARGA_GRITO_MIN;
      setGritoAtivo({ tipo: cmd.tipo, ate: m + DURACAO_GRITO_MIN });
      const frase = { incentivar: L('incentiva o time — "VAMO!"', 'fires the team up — "COME ON!"'),
        cobrar: L('cobra o time — "APERTA A SAÍDA DELES!"', 'demands more — "PRESS THEM!"'),
        acalmar: L('acalma o time — "CALMA, TOCA A BOLA!"', 'calms the team — "EASY, KEEP IT!"') }[cmd.tipo];
      pushFeed({ id: `grito-${m}`, minute: m, kind: 'decision', text: L(`📣 O técnico ${frase}`, `📣 The coach ${frase}`) });
    } else {
      setOrdens((o) => ({ ...o, [cmd.jogador]: cmd.ordem }));
      const nome = [...field, ...benchPool].find((c) => c.id === cmd.jogador)?.name ?? '';
      const o = { segurar: L('segura a posição', 'holds position'), atacar_espaco: L('ataca o espaço', 'attacks the space'), marcar: L('marca de perto', 'marks tight') }[cmd.ordem];
      pushFeed({ id: `ordem-${m}-${cmd.jogador}`, minute: m, kind: 'decision', text: L(`🗣️ Ordem: ${nome} ${o}.`, `🗣️ Order: ${nome} ${o}.`) });
    }
    replanAoVivo(cmd);
  };
  useEffect(() => { if (gritoAtivo && minute >= gritoAtivo.ate) setGritoAtivo(null); }, [minute, gritoAtivo]);

  // PARTIDA VIVA — emite o quadro pro palco em campo (só quando alguém assina).
  const onAoVivoRef = useRef(onAoVivo);
  onAoVivoRef.current = onAoVivo;
  useEffect(() => {
    const emitir = onAoVivoRef.current;
    if (!emitir) return;
    const golDoFeed = celebration ? [...feed].reverse().find((f) => f.kind === 'goal_home' || f.kind === 'goal_away') : undefined;
    // A chave da comemoração termina no índice do evento (goal-7, clutch-7…): a jogada vem dele.
    const idxDoGol = celebration ? Number(/-(\d+)$/.exec(celebration.key)?.[1]) : NaN;
    const eventoDoGol = Number.isFinite(idxDoGol) ? eventsRef.current[idxDoGol] : undefined;
    const cadeiaDoGol = eventoDoGol?.cadeia;
    // Decisão em aberto, pros trilhos do campo (Fase 4).
    let decisao: DecisaoNoCampo | null = null;
    if (phase === 'beat' && activeBeat) {
      decisao = {
        tipo: 'analista', chave: `beat-${activeBeat.id}`, titulo: L('Leitura do Analista', 'Analyst read'),
        texto: activeBeat.insight.text, opcoes: activeBeat.choices.map((c) => ({ id: c.id, rotulo: c.label })),
        corredores: { nosso: activeBeat.insight.primary_channel, perigo: activeBeat.insight.threat_channel },
      };
    } else if (phase === 'leadin' && leadIn && leadInReactable) {
      decisao = {
        tipo: 'reacao', chave: `leadin-${minute}-${leadIn.kind}`, titulo: L('Reação', 'React'), texto: leadIn.text,
        opcoes: leadIn.reactions.map((r, i) => ({ id: String(i), rotulo: r.label })), prazoMs: LEADIN_REACT_MS,
      };
    } else if (phase === 'clutch' && clutch) {
      decisao = {
        tipo: 'decisivo', chave: `clutch-${clutch.idx}`,
        titulo: clutch.moment.intent === 'attack' ? L('Momento decisivo', 'Decisive moment') : L('Segura o gol', 'Save it'),
        texto: clutch.moment.context, protagonista: clutch.moment.actorName,
        prazoMs: pedirReplan ? PRAZO_DECISIVO_MS : undefined,
        opcoes: clutch.moment.options.map((o) => {
          const c = clutch.duelo?.porOpcao[o.key];
          return { id: o.key, rotulo: o.label, detalhe: c ? `${c.rotuloNosso} ${c.nosso} × ${c.deles} ${c.rotuloDeles}` : undefined };
        }),
        duelo: clutch.duelo ? { nosso: { id: clutch.duelo.nosso.id, nome: clutch.duelo.nosso.nome }, deles: { id: clutch.duelo.deles.id, nome: clutch.duelo.deles.nome } } : undefined,
      };
    } else if (phase === 'forced' && forced) {
      decisao = forced.kind === 'red'
        ? { tipo: 'expulsao', chave: `red-${forced.idx}`, titulo: L('Expulso', 'Sent off'), texto: L(`${forced.outName} foi expulso.`, `${forced.outName} was sent off.`), protagonista: forced.outName, opcoes: [{ id: 'ok', rotulo: L('Seguir com 10', 'Play on with 10') }] }
        : { tipo: 'lesao', chave: `inj-${forced.idx}`, titulo: L('Lesão', 'Injury'), texto: L(`${forced.outName} sentiu. Quem entra?`, `${forced.outName} is hurt. Who comes on?`), protagonista: forced.outName,
            opcoes: benchPool.slice(0, 6).map((b) => ({ id: b.id, rotulo: b.name, detalhe: `${b.pos} · ${b.ovr}` })) };
    }
    emitir({
      minuto: minute,
      estilo: style,
      grito: gritoAtivo,
      gritoLivreEm: pedirReplan ? gritoLivreEmRef.current : undefined,
      ordens: pedirReplan ? ordens : undefined,
      emCampo: field.map((c) => c.id),
      banco: pedirReplan ? benchPool.map((b) => ({ id: b.id, nome: b.name, pos: b.pos, ovr: b.ovr, fadiga: b.fatigue })) : undefined,
      subsRestantes: pedirReplan ? Math.max(0, MAX_SUBS - subsUsed) : undefined,
      pausado: pedirReplan ? pausado : undefined,
      decisao,
      fase: phase,
      placarCasa: homeScore,
      placarFora: awayScore,
      momento: momentumRef.current[Math.max(0, Math.min(momentumRef.current.length - 1, minute - 1))] ?? 50,
      lance: highlight,
      gol: celebration ? { chave: celebration.key, nome: celebration.name, lado: celebration.side, actorId: golDoFeed?.actorId, cadeia: cadeiaDoGol, xg: eventoDoGol?.xg } : null,
      narracao: [...feed].reverse().slice(0, 6).map((f) => ({ id: f.id, minuto: f.minute, texto: f.text })),
    });
  }, [minute, phase, homeScore, awayScore, highlight, celebration, feed, style, activeBeat, leadIn, leadInReactable, clutch, forced, benchPool, gritoAtivo, ordens, field, subsUsed, pausado]);

  // PARTIDA VIVA (Fase 4) — respostas vindas do campo caem nas mesmas funções dos botões.
  const responderRef = useRef<(id: string) => void>(() => {});
  responderRef.current = (id: string) => {
    if (id === 'seguir') { if (phase === 'celebration') dismissCelebration(); return; }
    // LEGACY (Fase 4b): 'grito:cobrar' · 'ordem:<jogador>:<ordem>'
    if (id.startsWith('grito:')) {
      const g = id.slice('grito:'.length);
      if (g === 'incentivar' || g === 'cobrar' || g === 'acalmar') comandar({ tipo: g });
      return;
    }
    if (id.startsWith('ordem:')) {
      const resto = id.slice('ordem:'.length), k = resto.lastIndexOf(':');
      const jogador = resto.slice(0, k), ordem = resto.slice(k + 1);
      if (jogador && (ordem === 'segurar' || ordem === 'atacar_espaco' || ordem === 'marcar')) comandar({ tipo: 'ordem', ordem, jogador });
      return;
    }
    // LEGACY (Fase 4c): prancheta (pausa) e troca arrastada do banco ('sub:<sai>|<entra>').
    if (id === 'pausar') {
      if (phase !== 'playing' || !pedirReplan) return;
      pausadoRef.current = true;
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      setPausado(true);
      return;
    }
    if (id === 'retomar') {
      if (!pausadoRef.current) return;
      pausadoRef.current = false;
      setPausado(false);
      scheduleNext(250);
      return;
    }
    if (id.startsWith('sub:')) {
      const [sai, entra] = id.slice('sub:'.length).split('|');
      if (sai && entra) trocarNoCampo(sai, entra);
      return;
    }
    if (id.startsWith('estilo:')) {
      const nivel = id.slice('estilo:'.length) as TacticalIntensityLevel;
      if (nivel in TACTICAL_INTENSITY_PRESETS) changeStyle(nivel);
      return;
    }
    if (phase === 'beat' && activeBeat) { const c = activeBeat.choices.find((x) => x.id === id); if (c) handleBeatChoice(c); return; }
    if (phase === 'leadin' && leadIn && leadInReactable) { const r = leadIn.reactions[Number(id)]; if (r) reactToLeadIn(r); return; }
    if (phase === 'clutch' && clutch) { const o = clutch.moment.options.find((x) => x.key === id); if (o) resolveClutchChoice(o.key); return; }
    if (phase === 'forced' && forced) {
      if (forced.kind === 'red') { resolveRedCard(); return; }
      const b = benchPool.find((x) => x.id === id);
      if (b) resolveInjury(b);
    }
  };
  // Trava de segurança: com o campo segurando o gol, nunca mais que 20 s.
  const celebracaoChave = celebration?.key;
  useEffect(() => {
    if (!golEsperaCampo || !celebracaoChave) return undefined;
    const t = window.setTimeout(() => dismissCelebration(), 20000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [golEsperaCampo, celebracaoChave]);

  useEffect(() => {
    if (!registrarResposta) return undefined;
    registrarResposta((id) => responderRef.current(id));
    return () => registrarResposta(null);
  }, [registrarResposta]);

  const currentEvent = highlight;
  const currentMinute = minute;
  const progress = Math.min(1, currentMinute / 90);

  // 5 cards por time: 3 melhores (OVR) + 2 piores (candidatos a sair no nosso).
  const pickFive = (cards: SquadCard[]) => {
    const ranked = [...cards].sort((a, b) => b.ovr - a.ovr);
    return [...ranked.slice(0, 3), ...ranked.slice(-2).filter((p) => !ranked.slice(0, 3).includes(p))];
  };
  const homeFive = pickFive(field);
  const homeTopId = homeFive.length ? homeFive[0]!.id : '';
  const canSubNow = phase === 'playing' && benchPool.length > 0 && subsUsed < MAX_SUBS;
  // Momento atual (perspectiva casa) — alimenta a nota VIVA por jogador.
  const liveMomentum = momentumRef.current[Math.max(0, Math.min(89, currentMinute - 1))] ?? 50;
  const ratingCtx = (card: SquadCard, side: 'home' | 'away'): RatingCtx => ({
    pos: card.pos,
    side,
    teamGoals: side === 'home' ? homeScore : awayScore,
    oppGoals: side === 'home' ? awayScore : homeScore,
    momentumHome: liveMomentum,
    minute: currentMinute,
  });

  // PAINEL AO VIVO (preenche o palco quando não há lance): dados REAIS.
  const liveRead = (() => {
    const press = momentumRef.current[Math.max(0, Math.min(89, currentMinute - 1))] ?? 50;
    const processed = eventsRef.current.slice(0, eventIdxRef.current);
    const isShot = (k: string) => /^(shot|chance|goal|save|woodwork)_/.test(k);
    const hShots = processed.filter((e) => isShot(e.kind) && e.actor_side === 'home').length;
    const aShots = processed.filter((e) => isShot(e.kind) && e.actor_side === 'away').length;
    const pick = (m?: Record<string, { edge: number; label: string }>) => {
      if (!m) return null;
      return Object.entries(m)
        .filter(([k]) => k !== 'finalizacao_vs_gk' && k !== 'pressao')
        .sort((a, b) => b[1].edge - a[1].edge)[0]?.[1] ?? null;
    };
    const bestHome = pick(plan.matchup_matrix?.home);
    const threat = pick(plan.matchup_matrix?.away);
    const homeShort = homeName ?? plan.home_short;
    const awayShort = awayName ?? plan.away_short;
    // Neutro NUNCA repete "Jogo equilibrado" (a barra de momento já diz isso):
    // aponta o que vai TIPAR o jogo, girando por minuto pra não repetir a linha.
    const balancedReads = [
      bestHome ? L(`Pode abrir ${bestHome.label}`, `Can open up ${bestHome.label}`) : L('Quem marcar primeiro decide', 'First goal decides it'),
      threat ? L(`Olho ${threat.label} deles`, `Watch their ${threat.label}`) : L('Jogo de detalhes', 'Game of fine margins'),
      L('Quem marcar primeiro decide', 'First goal decides it'),
    ];
    const headline = press >= 58
      ? L(`${homeShort} no ataque`, `${homeShort} on the attack`)
      : press <= 42
      ? L(`${awayShort} pressiona`, `${awayShort} pressing`)
      : balancedReads[Math.floor(currentMinute / 6) % balancedReads.length]!;
    // Detalhe gira por minuto pra não ficar estático (3 leituras reais).
    const beat = Math.floor(currentMinute / 7) % 3;
    let detail: string;
    if (beat === 0 && bestHome) detail = L(`Tua força: ${bestHome.label}`, `Your edge: ${bestHome.label}`);
    else if (beat === 1 && threat) detail = L(`O perigo deles: ${threat.label}`, `Their threat: ${threat.label}`);
    else detail = L(`Finalizações ${hShots} – ${aShots}`, `Shots ${hShots} – ${aShots}`);
    return { headline, detail, press };
  })();

  // Nomes pra destacar em Moret (jogador/clube): casa = amarelo, fora = branco.
  const homeNames = [...field.map((c) => c.name), ...benchPool.map((c) => c.name), homeName ?? ''].filter(Boolean);
  const awayNames = [...(awayCards ?? []).map((c) => c.name), awayName ?? ''].filter(Boolean);
  const richText = (text: string, fontSize: string) => renderQuickFeedRichText(text, {
    homeShort: plan.home_short,
    awayShort: plan.away_short,
    homeNames,
    awayNames,
    homeClassName: 'text-rua',
    awayClassName: 'text-papel',
    fontSize,
  });
  const momentumNow = momentumRef.current[Math.max(0, Math.min(89, currentMinute - 1))] ?? 50;

  return (
    <div className="relative mx-auto w-full max-w-2xl overflow-hidden bg-asfalto-27">
      {/* PLACAR AO VIVO (DS 2027): spray em rua, times em Anton, minuto em spray.
          No fim de jogo some — o RESULTADO (spray gigante) assume o palco. */}
      {phase !== 'done' && (
        <div className="rua-grao bg-concreto px-4 pb-4 pt-3">
          <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
            {phase === 'halftime' ? (
              <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">{L('Intervalo', 'Half-time')}</span>
            ) : phase === 'shootout' ? (
              <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-rua">{L('Pênaltis', 'Penalties')}</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-rua px-2 py-0.5 font-prova text-[11px] font-bold uppercase tracking-[0.1em] text-asfalto-27">
                <span aria-hidden className="animate-pulse">●</span> {L('Ao vivo', 'Live')}
              </span>
            )}
            <span className="flex items-baseline gap-1 font-spray font-black leading-none tabular-nums text-papel" aria-label={L(`Minuto ${currentMinute}`, `Minute ${currentMinute}`)}>
              {phase === 'beat' || phase === 'clutch' || phase === 'penalty' || phase === 'forced' || phase === 'leadin' ? (
                <span className="font-prova text-[11px] font-bold text-mudo">{L('PAUSA', 'PAUSED')}</span>
              ) : null}
              <span className="text-[28px]">{currentMinute}</span>
              <span className="text-[18px] text-mudo">&prime;</span>
            </span>
          </div>

          <div className="flex items-center justify-center gap-2.5 sm:gap-5">
            {/* Casa */}
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <p className="min-w-0 truncate text-right font-impact text-[15px] uppercase leading-none text-papel sm:text-[18px]">
                {homeName ?? plan.home_short}
              </p>
              {homeCrestUrl ? (
                <img src={homeCrestUrl} alt="" referrerPolicy="no-referrer" draggable={false}
                  className="h-9 w-9 shrink-0 object-contain sm:h-11 sm:w-11" />
              ) : (
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-rua sm:h-11 sm:w-11">
                  <span className="font-impact text-[10px] text-rua">{plan.home_short}</span>
                </div>
              )}
            </div>

            {/* Placar em spray */}
            <div className="flex shrink-0 items-center font-spray font-black leading-[0.85] tabular-nums text-rua" style={{ fontSize: 'clamp(52px, 15vw, 76px)' }}>
              <span>{homeScore}</span>
              <span className="mx-[0.08em] text-[0.55em]">×</span>
              <span>{awayScore}</span>
            </div>

            {/* Visitante */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {awayCrestUrl ? (
                <img src={awayCrestUrl} alt="" referrerPolicy="no-referrer" draggable={false}
                  className="h-9 w-9 shrink-0 object-contain sm:h-11 sm:w-11" />
              ) : (
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-fio sm:h-11 sm:w-11">
                  <span className="font-impact text-[10px] text-suave">{plan.away_short}</span>
                </div>
              )}
              <p className="min-w-0 truncate font-impact text-[15px] uppercase leading-none text-suave sm:text-[18px]">
                {awayName ?? plan.away_short}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Progress bar do tempo de jogo */}
      {phase !== 'done' && (
        <div className="h-1 bg-linha">
          <motion.div
            className="h-full bg-rua"
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ ease: 'linear', duration: 0.3 }}
          />
        </div>
      )}

      {/* Barra de MOMENTO — persistente durante o jogo (nunca desmonta até o apito
          final): narra o jogo o tempo todo, inclusive durante decisões. */}
      <div className={phase === 'done' ? 'hidden' : 'relative px-5 pt-4'}>
        <MomentumBar
          momentum={momentumNow / 100}
          homeShort={plan.home_short}
          awayShort={plan.away_short}
        />

        {/* FX FLUTUANTE do impacto da decisão (#1): sobe da barra e some — sem
            empilhar texto sobre texto (some sozinho em ~1.5s). */}
        <AnimatePresence>
          {floatFx && (
            <motion.div
              key={floatFx.key}
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: -26, scale: 1 }}
              exit={{ opacity: 0, y: -44 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={`pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 font-impact tabular-nums ${
                floatFx.tier === 'crit' ? 'bg-ouro-27 text-asfalto-27' : 'bg-asfalto-27'
              } ${floatFx.tier === 'pos' ? 'text-alta' : floatFx.tier === 'neg' ? 'text-baixa' : floatFx.tier === 'crit' ? '' : 'text-suave'}`}
              style={{ fontSize: floatFx.tier === 'crit' ? '17px' : '15px' }}
            >
              {floatFx.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chip de BUFF ATIVO (#3): mostra o buff vigente + contagem da janela. */}
        {activeBuff && (
          <div
            className={`absolute -bottom-1 right-5 z-10 inline-flex items-center gap-1 bg-asfalto-27 px-2 py-0.5 font-prova text-[10px] font-bold tabular-nums border-2 ${
              activeBuff.tier === 'crit' ? 'border-ouro-27 text-ouro-27' : activeBuff.tier === 'pos' ? 'border-alta text-alta' : 'border-baixa text-baixa'
            }`}
          >
            {activeBuff.tier === 'crit' ? '⚡' : '●'} {activeBuff.pct > 0 ? '+' : ''}{activeBuff.pct.toFixed(1)}% · {Math.max(0, activeBuff.untilMinute - currentMinute)}&prime;
          </div>
        )}
      </div>

      {/* Ponte #3 — ARCO NARRATIVO ao vivo: lê o drama do jogo (virada, domínio,
          luta do azarão) e dá nome ao momento. Só durante o jogo e quando há
          tensão real (arc !== 'balanced' some sozinho). */}
      {phase === 'playing' && (() => {
        const isShot = (k: string) => /^(shot|chance|goal|save|woodwork)_/.test(k);
        const processed = eventsRef.current.slice(0, eventIdxRef.current);
        const shotsHome = processed.filter((e) => isShot(e.kind) && e.actor_side === 'home').length;
        const shotsAway = processed.filter((e) => isShot(e.kind) && e.actor_side === 'away').length;
        const live = detectLiveArc({ minute: currentMinute, homeScore, awayScore, momentum: momentumNow, shotsHome, shotsAway });
        if (live.arc === 'balanced') return null;
        return (
          <div className="px-5 pt-3">
            <QuickNarrativeArcIndicator arc={live.arc} intensity={live.intensity} />
          </div>
        );
      })()}

      {/* DOCK DE ESTILO — controle tático AO VIVO. O estilo certo pro momento
          converte chance em gol e blinda o perigo; o errado custa caro. Faixa
          fina, sempre à mão (não some durante o jogo). */}
      <div className={phase === 'done' ? 'hidden' : 'px-5 pt-4'}>
        {/* Header do dock: rótulo + RISCO do estilo atual (trade-off legível). */}
        <div className="mb-2 flex items-center justify-between px-0.5">
          <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">— {L('Estilo', 'Style')}</span>
          {(() => {
            const d = TACTICAL_INTENSITY_PRESETS[style].defensiveBonus;
            const r = d <= -0.08
              ? { t: L('Risco alto', 'High risk'), c: 'var(--color-baixa)' }
              : d <= 0.05
              ? { t: L('Risco médio', 'Medium risk'), c: 'var(--color-atencao)' }
              : { t: L('Risco baixo', 'Low risk'), c: 'var(--color-alta)' };
            return <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ color: r.c }}>{r.t}</span>;
          })()}
        </div>
        <div className="grid grid-cols-5 gap-1.5 pb-1 pr-1">
          {STYLE_CHIPS.map((c) => {
            const on = style === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => changeStyle(c.id)}
                aria-pressed={on}
                className={`min-h-[46px] min-w-0 px-0.5 font-impact text-[12px] uppercase leading-[1.05] transition-[transform,box-shadow,background-color,color] [overflow-wrap:anywhere] sm:text-[14px] ${
                  on
                    ? 'bg-rua text-asfalto-27 shadow-[3px_3px_0_var(--color-papel)]'
                    : 'border-2 border-linha text-suave hover:border-papel hover:text-papel active:translate-y-px'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Área principal: o palco muda por fase; a barra acima permanece. */}
      <div className="min-h-[160px] sm:min-h-[200px] px-5 pb-4 pt-3 flex items-center justify-center">
        {phase === 'playing' && (() => {
          // UM banner persistente, duas variações:
          //   • AMARELA — lance destaque (gol/defesa/chance/trave…)
          //   • CINZA — jogo normal (painel ao vivo com info real)
          // As frases de construção NÃO viram linha solta: somem no ritmo.
          const hl = currentEvent && isHighSignal(currentEvent) ? currentEvent : null;
          const yellow = !!hl;
          // Ideia viral #2 — FRASE LENDÁRIA colecionável: gol épico tem chance rara
          // (~8%, determinística por seed) de virar um lance "lendário" com brilho.
          // Reforço de razão variável (slot machine): o raro dá vontade de mostrar.
          const legendary = !!hl && hl.kind.startsWith('goal_')
            && new SpiritRng(hashSeed(`${plan.seed}:legend:${hl.minute}:${hl.kind}`)).next() < 0.08;
          const eyebrow = legendary
            ? `✦ ${L('Frase Lendária', 'Legendary Line')} · ${currentMinute}'`
            : hl ? `${eventKindLabel(hl)} · ${currentMinute}'` : `${L('Ao vivo', 'Live')} · ${currentMinute}'`;
          const headline = hl ? hl.text : liveRead.headline;
          const detail = hl ? hl.reason : liveRead.detail;
          // VOLT2: lance épico vira placa volt chapada (impacto pela cor, sem brilho).
          const solidVolt = yellow && !legendary && hl!.weight_tier === 'epic';
          return (
            <AnimatePresence mode="wait">
              <motion.div
                key={yellow ? `hl-${minute}-${hl!.kind}` : `live-${Math.floor(currentMinute / 7)}-${liveRead.headline}`}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.22 }}
                className={`relative w-full overflow-hidden px-4 py-4 ${
                  legendary
                    ? '-rotate-1 bg-ouro-27 text-asfalto-27'
                    : solidVolt
                    ? 'bg-rua text-asfalto-27'
                    : yellow
                    ? 'border-l-[4px] border-rua bg-concreto text-papel'
                    : 'border-l-[4px] border-linha bg-concreto text-papel'
                }`}
              >
                {solidVolt && (
                  <span aria-hidden className="rua-alambrado pointer-events-none absolute inset-x-0 top-0 h-16 [--alambrado:rgba(13,13,12,0.22)]" />
                )}
                <p
                  className={`relative mb-1.5 font-prova text-[10.5px] font-bold uppercase tracking-[0.2em] ${
                    legendary || solidVolt ? 'text-asfalto-27/75' : yellow ? 'text-rua' : 'text-mudo'
                  }`}
                >
                  {eyebrow}
                </p>
                <p
                  className={`relative mb-1.5 leading-[1.05] ${yellow || legendary ? 'font-impact uppercase' : 'font-voz'}`}
                  style={{ fontSize: yellow || legendary ? 'clamp(22px, 5.4vw, 30px)' : 'clamp(24px, 6vw, 32px)' }}
                >
                  {headline}
                </p>
                {detail && (
                  <p className={`relative text-[13px] leading-snug ${legendary || solidVolt ? 'text-asfalto-27/80' : 'text-suave'}`}>
                    {detail}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          );
        })()}

        <AnimatePresence mode="wait">
          {phase === 'leadin' && leadIn && (() => {
            const tone = leadIn.intent === 'attack'
              ? 'var(--color-rua)'
              : leadIn.intent === 'defend'
              ? 'var(--color-baixa)'
              : 'var(--color-papel)';
            return (
              <motion.div
                key={`leadin-${leadIn.kind}-${currentMinute}`}
                initial={{ opacity: 0, scale: 0.92, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.06 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                className="w-full border-l-[4px] bg-concreto px-4 py-5 text-center"
                style={{ borderLeftColor: tone }}
              >
                <motion.p
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                  className="mb-2 font-prova text-[11px] font-bold uppercase tracking-[0.24em]"
                  style={{ color: tone }}
                >
                  — {L('Atenção', 'Heads up')}
                </motion.p>
                <p
                  className="font-voz leading-[1.02] text-papel"
                  style={{ fontSize: 'clamp(28px, 7.5vw, 38px)' }}
                >
                  {leadIn.text}
                </p>

                {/* REAÇÃO — 3 opções (neg/neutro/pos). A certa é inferível do texto;
                    o tier NÃO é revelado. Acertar dá buff; errar pune; ignorar = neutro. */}
                {leadInReactable && (
                  <>
                    <div className="mt-4 flex flex-col gap-2.5">
                      {leadIn.reactions.map((c) => (
                        <button
                          key={`${c.effect}-${c.label}`}
                          type="button"
                          onClick={() => reactToLeadIn(c)}
                          className="flex min-h-[50px] items-center justify-between gap-3 border-2 border-papel px-4 text-left font-impact text-[17px] uppercase leading-[1.05] text-papel transition-[transform,box-shadow,background-color,color,border-color] hover:border-rua hover:bg-rua hover:text-asfalto-27 hover:shadow-[4px_4px_0_var(--color-papel)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                        >
                          <span className="min-w-0">{c.label}</span>
                          <span aria-hidden className="shrink-0">→</span>
                        </button>
                      ))}
                    </div>
                    <div className="mx-auto mt-3 h-1 w-32 overflow-hidden bg-linha">
                      <motion.div
                        className="h-full"
                        style={{ backgroundColor: tone }}
                        initial={{ width: '100%' }}
                        animate={{ width: '0%' }}
                        transition={{ ease: 'linear', duration: LEADIN_REACT_MS / 1000 }}
                      />
                    </div>
                  </>
                )}
              </motion.div>
            );
          })()}

          {phase === 'beat' && activeBeat && (
            <AnalystBeatCard key={activeBeat.id} beat={activeBeat} onChoose={handleBeatChoice} />
          )}

          {phase === 'halftime' && (
            <motion.div
              key="halftime"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <p className="mb-2 font-prova text-[11px] font-bold uppercase tracking-[0.24em] text-rua">
                — {L('Intervalo', 'Half-time')}
              </p>
              <p className="font-voz text-[26px] leading-[1.05] text-papel">
                {L('Recalculando o jogo com as suas decisões…', 'Recalculating the match with your decisions…')}
              </p>
            </motion.div>
          )}

          {phase === 'penalty' && penalty && (
            <motion.div
              key={`penalty-${penalty.idx}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="relative w-full overflow-hidden bg-rua text-asfalto-27"
            >
              <span aria-hidden className="rua-alambrado pointer-events-none absolute inset-x-0 top-0 h-20 [--alambrado:rgba(13,13,12,0.24)]" />
              <p className="relative flex items-center gap-2 px-4 pt-3 font-prova text-[11px] font-bold uppercase tracking-[0.2em]">
                <Target className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> {L('Pênalti', 'Penalty')} · {penalty.minute}&prime;
              </p>
              <p className="relative px-4 pb-3 pt-1 font-impact text-[30px] uppercase leading-none">{L('Quem vai bater?', 'Who takes it?')}</p>
              <div className="relative flex flex-col gap-2 px-4 pb-4">
                {(penaltyTakers && penaltyTakers.length > 0
                  ? penaltyTakers
                  : [{ id: 'def', name: eventsRef.current[penalty.idx]?.actor_name ?? L('Capitão', 'Captain'), finalizacao: 75, portrait: null }]
                ).slice(0, 4).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => takePenalty(t)}
                    className="flex min-h-[54px] min-w-0 items-center gap-3 bg-asfalto-27 px-3 py-2 text-left text-papel transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-papel)] active:translate-x-0 active:translate-y-0 active:shadow-none"
                  >
                    {t.portrait ? (
                      <img src={t.portrait} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover object-top" />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-rua text-rua"><Target className="h-4 w-4" strokeWidth={2.5} aria-hidden /></span>
                    )}
                    <span className="min-w-0 flex-1 truncate font-voz text-[20px] leading-none">{t.name}</span>
                    <span className="shrink-0 font-impact text-[20px] leading-none tabular-nums text-rua">
                      {t.finalizacao}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {phase === 'clutch' && clutch && (
            <motion.div
              key={`clutch-${clutch.idx}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              className={`w-full border-l-[4px] bg-concreto ${clutch.moment.intent === 'attack' ? 'border-rua' : 'border-baixa'}`}
            >
              {(() => {
                const atk = clutch.moment.intent === 'attack';
                const Icon = atk ? Crosshair : ShieldAlert;
                return (
                  <>
                    <div className="flex min-w-0 items-center justify-between gap-3 px-4 pt-3">
                      <p className={`flex min-w-0 items-center gap-2 font-prova text-[11px] font-bold uppercase tracking-[0.2em] ${atk ? 'text-rua' : 'text-baixa'}`}>
                        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                        <span className="truncate">— {atk ? L('Chance de gol', 'Goal chance') : L('Perigo na área', 'Danger in the box')}</span>
                      </p>
                      <span className={`shrink-0 font-spray font-black text-[26px] leading-none tabular-nums ${atk ? 'text-rua' : 'text-baixa'}`}>{clutch.moment.minute}&prime;</span>
                    </div>
                    <p className="px-4 pb-1 pt-2 font-voz text-[26px] leading-[1.04] text-papel">{clutch.moment.context}</p>
                    <p className="px-4 pb-3 text-[13px] text-suave">
                      {atk ? L(`${clutch.moment.actorName} na bola — o que fazer?`, `${clutch.moment.actorName} on the ball — what now?`) : L('Decisão na hora — como parar?', 'Split-second call — how to stop it?')}
                    </p>
                    <div className="grid grid-cols-3 gap-2 px-4 pb-4">
                      {clutch.moment.options.map((o) => (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => resolveClutchChoice(o.key)}
                          className="min-h-[54px] min-w-0 border-2 border-papel px-1 font-impact text-[15px] uppercase leading-[1.05] text-papel transition-[transform,box-shadow,background-color,color,border-color] [overflow-wrap:anywhere] hover:border-rua hover:bg-rua hover:text-asfalto-27 hover:shadow-[4px_4px_0_var(--color-papel)] active:translate-x-0.5 active:translate-y-0.5 active:bg-rua active:text-asfalto-27 active:shadow-[2px_2px_0_var(--color-papel)]"
                        >
                          {o.label}
                          {/* Fase 9: o duelo — o número é o que o resultado sente. */}
                          {clutch.duelo?.porOpcao[o.key] && (
                            <span className="mt-1 block font-prova text-[10px] normal-case tracking-normal opacity-75">
                              {clutch.duelo.porOpcao[o.key]!.nosso} × {clutch.duelo.porOpcao[o.key]!.deles}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    {clutch.duelo && (
                      <p className="px-4 pb-3 -mt-2 font-prova text-[11px] text-mudo">
                        {clutch.duelo.nosso.nome} × {clutch.duelo.deles.nome}
                      </p>
                    )}
                  </>
                );
              })()}
            </motion.div>
          )}

          {phase === 'forced' && forced?.kind === 'injury' && (
            <motion.div
              key={`inj-${forced.idx}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full border-l-[4px] border-atencao bg-concreto"
            >
              <p className="flex items-center gap-2 px-4 pb-1 pt-3 font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-atencao">
                <Cross className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> {L('Lesão', 'Injury')} · {forced.minute}&prime;
              </p>
              <p className="px-4 pb-3 text-[14px] text-suave">
                <span className="font-voz text-[24px] leading-none text-papel">{forced.outName}</span> {L('caiu. Quem entra?', 'is down. Who comes on?')}
              </p>
              <div className="flex flex-col gap-2 px-4 pb-4">
                {(benchPool.length > 0
                  ? benchPool
                  : [{ id: 'res', name: L('Reserva', 'Sub'), pos: '—', ovr: 70, fatigue: 0, portrait: null }]
                ).slice(0, 4).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => resolveInjury(b)}
                    className="flex min-h-[52px] min-w-0 items-center gap-3 border-2 border-linha bg-asfalto-27 px-3 py-2 text-left transition-colors hover:border-rua"
                  >
                    <span className="w-8 shrink-0 text-center font-impact text-[19px] leading-none tabular-nums text-papel">{b.ovr}</span>
                    <span className="min-w-0 flex-1 truncate font-voz text-[20px] leading-none text-papel">{b.name}</span>
                    <span className="shrink-0 font-prova text-[10px] font-bold uppercase tracking-[0.1em] text-mudo">{posLabel(b.pos)}</span>
                    <span aria-hidden className="shrink-0 font-impact text-[17px] text-rua">→</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {phase === 'sub' && (
            <motion.div
              key="sub-picker"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full border-l-[4px] border-rua bg-concreto"
            >
              <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-3">
                <span className="flex min-w-0 items-center gap-2 font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-rua">
                  <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden /> <span className="truncate">{L('Substituição', 'Substitution')} · {minute}&prime;</span>
                </span>
                <button type="button" onClick={() => { setSubOut(null); setPhase('playing'); scheduleNext(300); }} className="min-h-[40px] shrink-0 font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo hover:text-papel">{L('Cancelar', 'Cancel')}</button>
              </div>
              <p className="px-4 pb-3 text-[13px] text-suave">
                {emIngles()
                  ? <>Off: <span className="font-voz text-[22px] leading-none text-papel">{field.find((p) => p.id === subOut)?.name}</span> — who comes on? <span className="text-mudo">(any position)</span></>
                  : <>Sai <span className="font-voz text-[22px] leading-none text-papel">{field.find((p) => p.id === subOut)?.name}</span> — quem entra? <span className="text-mudo">(qualquer posição)</span></>}
              </p>
              <div className="flex flex-col gap-2 px-4 pb-4">
                {benchPool.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => applyAnytimeSub(b)}
                    className="flex min-h-[52px] min-w-0 items-center gap-3 border-2 border-linha bg-asfalto-27 px-3 py-2 text-left transition-colors hover:border-rua"
                  >
                    <span className="w-8 shrink-0 text-center font-impact text-[19px] leading-none tabular-nums text-papel">{b.ovr}</span>
                    <span className="min-w-0 flex-1 truncate font-voz text-[20px] leading-none text-papel">{b.name}</span>
                    <span className="shrink-0 font-prova text-[10px] font-bold uppercase tracking-[0.08em] text-mudo">{posLabel(b.pos)} · {L('fad', 'fat')} {Math.round(b.fatigue)}%</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {phase === 'forced' && forced?.kind === 'red' && (
            <motion.div
              key={`red-${forced.idx}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="rua-grao w-full bg-concreto px-4 pb-4 pt-4 text-center"
            >
              {/* O cartão em si: retângulo do token de evento, levantado torto. */}
              <span aria-hidden className="mx-auto mb-3 block h-14 w-10 rotate-[8deg] bg-[var(--color-event-card-red)] shadow-[3px_3px_0_var(--color-asfalto-27)]" />
              <p className="flex items-center justify-center gap-2 font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-event-card-red)]">
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> {L('Cartão vermelho', 'Red card')} · {forced.minute}&prime;
              </p>
              <p className="mt-2 font-voz text-[30px] leading-none text-papel">{forced.outName}</p>
              <p className="mb-4 mt-1.5 text-[14px] text-suave">
                {L('Foi expulso. Vai ter que segurar com 10.', 'Sent off. Hold on with 10.')}
              </p>
              <div>
                <button
                  type="button"
                  onClick={resolveRedCard}
                  className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 bg-rua font-impact text-[19px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--color-papel)]"
                >
                  {L('Segurar com 10', 'Hold with 10')} <span aria-hidden>→</span>
                </button>
              </div>
            </motion.div>
          )}

          {phase === 'shootout' && shootoutSetup && (
            <motion.div
              key="shootout"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full"
            >
              <PenaltyShootout
                setup={shootoutSetup}
                seed={`${plan.seed}|so`}
                homeName={homeName ?? plan.home_short}
                awayName={awayName ?? plan.away_short}
                onDone={(res) => {
                  setShootoutResult(res);
                  setPhase('done');
                  completeMatchRef.current(res);
                }}
              />
            </motion.div>
          )}

          {phase === 'done' && doneInfo && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full text-left"
            >
              {/* O RESULTADO (DS 2027, PDF pág. 6) — placar em spray, frase na voz,
                  MVP em post-it de ouro, fita com o EXP real. Funde o antigo
                  "Vitória · arco" + card amarelo de MVP numa peça só. #9: assists
                  reais + fallback quando ninguém marcou (0-0): premia o goleiro/
                  destaque por defesas/finalizações (statsRef) pra NUNCA ficar sem craque. */}
              {(() => {
                // No empate, a disputa de pênaltis decide o vencedor.
                const decided = shootoutResult ? shootoutResult.winner : homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : null;
                const res = decided === 'home' ? 'win' : decided === 'away' ? 'loss' : 'draw';
                const detail = shootoutResult
                  ? L(`nos pênaltis ${shootoutResult.homeTally}–${shootoutResult.awayTally}`, `on penalties ${shootoutResult.homeTally}–${shootoutResult.awayTally}`)
                  : getArcDescription(plan.narrative_arc); // #14: arco em PT legível
                const proj = plan.mvp_projection;
                const fallback = (() => {
                  if (proj) return null;
                  const best = Object.entries(statsRef.current)
                    .filter(([, s]) => s.side === 'home')
                    .map(([id, s]) => ({ id, s, score: s.saves * 2 + s.shots + s.goals * 3 }))
                    .filter((x) => x.score > 0)
                    .sort((a, b) => b.score - a.score)[0];
                  if (!best) return null;
                  const card = field.find((c) => c.id === best.id);
                  if (!card) return null;
                  return { name: card.name, goals: best.s.goals, assists: 0, rating: matchRating(card.ovr, best.s) };
                })();
                const mvp = proj ?? fallback;
                return (
                  <ResultadoRua
                    className="-mx-5 mb-5"
                    homeName={homeName ?? plan.home_short}
                    awayName={awayName ?? plan.away_short}
                    homeScore={homeScore}
                    awayScore={awayScore}
                    resultado={res}
                    rotuloDir={L('Partida rápida', 'Quick match')}
                    detalhe={detail}
                    mvp={mvp ? { name: shortName(mvp.name), goals: mvp.goals, assists: mvp.assists, rating: mvp.rating } : null}
                    exp={resultadoExp ?? null}
                  />
                );
              })()}

              {/* Estatísticas do jogo */}
              <p className="mb-2 font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">— {L('Números do jogo', 'Match numbers')}</p>
              <div className="mb-5 grid grid-cols-3 gap-px bg-linha text-center">
                {[
                  { l: L('Posse', 'Possession'), h: `${doneInfo.stats.possessionHome}%`, a: `${100 - doneInfo.stats.possessionHome}%` },
                  { l: L('Finalizações', 'Shots'), h: doneInfo.stats.homeShots, a: doneInfo.stats.awayShots },
                  { l: L('Defesas', 'Saves'), h: doneInfo.stats.homeSaves, a: doneInfo.stats.awaySaves },
                ].map((s) => (
                  <div key={s.l} className="bg-concreto px-1 py-3">
                    <p className="font-spray font-black text-[30px] leading-none tabular-nums text-rua">{s.h}</p>
                    <p className="my-1.5 font-prova text-[9.5px] font-bold uppercase tracking-[0.12em] text-mudo">{s.l}</p>
                    <p className="font-spray font-black text-[24px] leading-none tabular-nums text-suave">{s.a}</p>
                  </div>
                ))}
              </div>

              {/* Leitura de Jogo — o placar da inteligência do manager */}
              <div className="bg-concreto px-4 py-4">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <p className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">— {L('Leitura de jogo', 'Game reading')}</p>
                  <p className="shrink-0 font-spray font-black text-[30px] leading-none tabular-nums text-rua">
                    {doneInfo.reading.good}<span className="text-[0.6em] text-mudo">/{doneInfo.reading.total}</span>
                  </p>
                </div>
                {narration?.reading && (
                  <p className="mb-3 font-voz text-[22px] leading-[1.08] text-papel">
                    {narration.reading}
                  </p>
                )}
                {doneInfo.verdicts.length === 0 ? (
                  <p className="text-[13px] text-mudo">
                    {L('Você não decidiu nada — o Analista falou sozinho.', 'You decided nothing — the Analyst talked to himself.')}
                  </p>
                ) : (
                  <ul className="flex flex-col">
                    {doneInfo.verdicts.map((v) => (
                      <li key={v.beatId} className="flex items-start gap-2.5 border-b border-linha py-2.5 text-[13px] leading-snug last:border-b-0">
                        <span className={`shrink-0 font-impact text-[16px] leading-none ${v.kind === 'hit' ? 'text-alta' : v.kind === 'neutral' ? 'text-mudo' : 'text-baixa'}`}>
                          {v.kind === 'hit' ? '✓' : v.kind === 'neutral' ? '•' : '✗'}
                        </span>
                        <span className="text-suave">
                          <span className="font-prova text-[11px] font-bold uppercase text-mudo">{v.minute}&prime; {v.choiceLabel} — </span>
                          {richText(v.text, '13px')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {doneInfo.skipped > 0 && (
                  <p className="mt-3 font-prova text-[11px] text-mudo">
                    {emIngles()
                      ? `You let ${doneInfo.skipped} decision${doneInfo.skipped === 1 ? '' : 's'} slip — the Analyst called and nobody answered.`
                      : <>Você deixou passar {doneInfo.skipped} decisã{doneInfo.skipped === 1 ? 'o' : 'ões'} — o Analista chamou e ninguém respondeu.</>}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* NARRAÇÃO — linha atual em destaque cinematográfico + histórico legível. */}
      {feed.length > 0 && phase !== 'done' && (() => {
        // Narração AO VIVO: só o lance atual. O feed não arquiva o que já passou —
        // é um ticker, não um log (pedido do produto: layout menos carregado).
        const latest = feed[feed.length - 1]!;
        const portrait = portraitOf?.(latest.actorId, latest.side) ?? null;
        return (
          <div className="px-4 pb-3">
            <div className="flex items-start gap-3 border-l-[3px] border-rua py-1 pl-3">
              {portrait ? (
                <img src={portrait} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover object-top" />
              ) : (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-concreto font-spray font-black text-[17px] text-rua" aria-hidden>{latest.minute}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="mb-1 font-prova text-[10.5px] font-bold uppercase tracking-[0.2em] text-mudo">
                  {latest.minute}&prime; · {L('Narração', 'Commentary')}
                </p>
                <p className={`text-[14px] leading-snug ${FEED_STYLE[latest.kind]}`}>
                  {richText(latest.text, '15px')}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CONTROLES — Formação (só o número) | Legacy. Entre a narração e os jogadores.
          Legacy ganha um contorno volt chapado quando há buff disponível pra usar. */}
      {phase !== 'done' && (() => {
        const noLegend = liveBoosters.length === 0;
        const allUsed = !noLegend && availableBoosters.length === 0;
        const canPick = !legacyActive && availableBoosters.length > 0;
        return (
          <div className="px-3 pt-1 pb-2">

            <div className="grid grid-cols-2 gap-2">
              {/* Formação — só o número, cicla ao toque */}
              <button
                type="button"
                onClick={cycleFormation}
                aria-label={L(`Formação ${formation} — tocar pra trocar`, `Formation ${formation} — tap to change`)}
                className="flex min-h-[48px] items-center justify-center gap-2 border-2 border-linha transition-colors hover:border-papel active:translate-y-px"
              >
                <span className="font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo">{L('Formação', 'Formation')}</span>
                <span className="font-impact text-[18px] leading-none tabular-nums text-papel">{formation}</span>
              </button>

              {/* Legacy — mostra a CONTAGEM de buffs; toque abre a lista pra escolher */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { if (canPick) setLegacyPickerOpen((v) => !v); }}
                  disabled={!canPick}
                className={`relative flex min-h-[48px] w-full items-center justify-center gap-1.5 truncate px-2 font-impact text-[16px] uppercase leading-none transition-colors disabled:cursor-default ${
                    legacyActive
                      ? 'bg-ouro-27 text-asfalto-27'
                      : canPick
                      ? 'border-[3px] border-ouro-27 bg-asfalto-27 text-ouro-27 active:translate-y-px'
                      : 'border-2 border-dashed border-fio text-fio'
                  }`}
                >
                  {legacyActive ? L('★ Legacy ativo', '★ Legacy active') : allUsed ? L('★ Legacy usado', '★ Legacy used') : noLegend ? L('★ Sem lenda', '★ No legend') : `★ Legacy (${availableBoosters.length})`}
                </button>
              </div>
            </div>

            {/* Lista de buffs disponíveis — escolha contextual (defesa sob pressão, ataque pra pressionar) */}
            {legacyPickerOpen && canPick && (
              <div className="mt-2 flex flex-col gap-2">
                <p className="px-0.5 font-prova text-[10.5px] font-bold uppercase tracking-[0.12em] text-mudo">
                  {L('Ativar buff — defesa sob pressão · ataque pra pressionar', 'Activate buff — defence under pressure · attack to push')}
                </p>
                {availableBoosters.map((b) => {
                  const def = b.label === 'DEFESA';
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => activateLegacy(b)}
                      className="flex min-h-[50px] w-full min-w-0 items-center justify-between gap-2 border-l-[3px] border-ouro-27 bg-concreto px-3 py-2 text-left transition-colors hover:bg-linha active:translate-y-px"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="text-[14px] text-ouro-27" aria-hidden>★</span>
                        <span className="truncate font-voz text-[20px] leading-none text-papel">{b.name}</span>
                      </span>
                      <span className={`shrink-0 px-2 py-0.5 font-prova text-[10.5px] font-bold uppercase tracking-[0.08em] ${def ? 'border-2 border-papel text-papel' : 'bg-ouro-27 text-asfalto-27'}`}>
                        +{b.pct}% {legacyLabel(b.label)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* MEU ELENCO EM CAMPO — só o nosso time (o adversário não interessa ver).
          Toca num dos teus pra trocar a qualquer momento. */}
      {homeFive.length >= 5 && phase !== 'done' && (
        <div className="flex flex-col gap-1.5 border-t border-linha px-3 pb-4 pt-3">
          <div className="mb-1 flex min-w-0 items-center gap-2">
            {homeCrestUrl && <img src={homeCrestUrl} alt="" className="h-4 w-4 object-contain" referrerPolicy="no-referrer" />}
            <span className="truncate font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
              — {homeName ?? plan.home_short} · {L('em campo', 'on the pitch')}
            </span>
            {/* Teto de substituições — toque num jogador pra trocar. */}
            <span
              className={`ml-auto flex shrink-0 items-center gap-1 font-prova text-[11px] font-bold tabular-nums ${subsUsed >= MAX_SUBS ? 'text-atencao' : 'text-mudo'}`}
              title={L('Substituições usadas (intervalo + jogo)', 'Substitutions used (half-time + match)')}
            >
              <ArrowRightLeft className="w-3 h-3" strokeWidth={2.5} aria-hidden />
              {subsUsed}/{MAX_SUBS}
            </span>
          </div>
          {homeFive.map((p) => (
            <RosterRow
              key={p.id}
              card={p}
              isTop={p.id === homeTopId}
              rating={matchRating(p.ovr, statsRef.current[p.id], ratingCtx(p, 'home'))}
              subbable={canSubNow}
              onSub={() => openSub(p.id)}
            />
          ))}
        </div>
      )}

      {/* Comemoração de gol — overlay cinematográfico, pausa o jogo */}
      <QuickGoalCelebration
        triggerKey={celebration?.key ?? null}
        scorerName={shortName(celebration?.name)}
        scorerPortrait={celebration?.portrait ?? null}
        narrative={celebration?.narrative}
        onDismiss={golEsperaCampo ? () => { /* o campo manda seguir */ } : dismissCelebration}
      />
    </div>
  );
}
