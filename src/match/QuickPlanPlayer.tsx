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

import { useEffect, useRef, useState } from 'react';
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
  QUICK_PLAN_FEED_MAX,
  type BeatDecisionRecord,
  type BeatVerdict,
  type QuickPlanFeedItem,
} from './quickBeatDirector';
import { SpiritRng } from '../../shared/gamespirit/SpiritRng';
import { buildClutch, resolveClutch, type ClutchMoment, type ClutchKey } from './quickClutch';
import { AnalystBeatCard } from '@/components/matchquick/AnalystBeatCard';
import { MomentumBar } from '@/components/match/MomentumBar';
import { QuickGoalCelebration } from '@/components/matchquick/QuickGoalCelebration';
import { PenaltyShootout, type ShootoutSetup } from '@/components/matchquick/PenaltyShootout';
import type { ShootoutResult } from '@/match/quickEngaged/penaltyShootout';
import { renderQuickFeedRichText } from '@/match/quickMatchFeed';

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
  stats: { homeShots: number; awayShots: number; possessionHome: number };
  /** Disputa de pênaltis quando o jogo empatou (nenhum jogo termina empatado). */
  shootout?: { winner: 'home' | 'away'; homeTally: number; awayTally: number };
}

interface Props {
  plan: MatchPlan;
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
  /** Titulares em campo — alimentam os 5 cards (3 melhores + 2 piores por OVR). */
  fieldCards?: SquadCard[];
  /** Onze do adversário — pros 5 cards do outro time (só leitura). */
  awayCards?: SquadCard[];
  /** Reservas no banco — pra substituir a qualquer momento (ou em lesão). */
  benchCards?: SquadCard[];
  /** Avisa o pai que houve substituição (atualiza o elenco vivo: out→in). */
  onSubstitution?: (outId: string, inId: string) => void;
  /** Narração IA (Sonnet) pré-buscada — mescla nos beats e na comemoração de gol. */
  narration?: QuickNarrationOverride;
  /** Monta os dados da disputa de pênaltis (elenco vivo + goleiros) no empate.
   *  O pai (MatchQuickEngaged) tem os atributos; retorna null pra pular a disputa. */
  buildShootout?: () => ShootoutSetup | null;
}

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
}

/** Rótulo curto do lance pro eyebrow do banner amarelo. */
function eventKindLabel(e: MatchPlanEvent): string {
  if (e.kind.startsWith('goal_')) return 'Gol';
  const base = e.kind.replace(/_(home|away)$/, '');
  return ({
    save: 'Defesa', chance: 'Chance', woodwork: 'Na trave', counter: 'Contra-ataque',
    penalty: 'Pênalti', red: 'Vermelho', shot: 'Finalização',
  } as Record<string, string>)[base] ?? 'Lance';
}

/** Estado físico em uma palavra com emoção (voz da marca). */
function fatigueWord(f: number): string {
  if (f <= 35) return 'inteiro';
  if (f <= 65) return 'no ritmo';
  if (f <= 85) return 'no limite';
  return 'apagando';
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
  const rail = isTop ? 'var(--color-neon-yellow)' : card.fatigue > 85 ? 'var(--color-warning)' : 'var(--color-border)';
  const tired = card.fatigue > 85;
  const inner = (
    <>
      <span
        className="font-serif italic tabular-nums leading-none w-7 text-center shrink-0"
        style={{ fontFamily: 'var(--font-serif-hero)', fontSize: '20px', letterSpacing: '-0.03em', color: isTop ? 'var(--color-neon-yellow)' : '#fff' }}
      >
        {card.ovr}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-display uppercase font-black text-white truncate" style={{ fontSize: '12px', letterSpacing: '0.04em' }}>
          {shortName(card.name)}
        </span>
        <span className="block uppercase tracking-[0.14em] text-[9px]" style={{ color: tired ? 'var(--color-warning)' : 'rgba(255,255,255,0.45)' }}>
          {card.pos} · {fatigueWord(card.fatigue)}
        </span>
      </span>
      {rating !== undefined && (
        <span
          className="font-serif italic tabular-nums leading-none shrink-0"
          style={{ fontFamily: 'var(--font-serif-hero)', fontSize: '17px', letterSpacing: '-0.02em', color: rating >= 7.5 ? 'var(--color-neon-yellow)' : 'rgba(255,255,255,0.85)' }}
        >
          {rating.toFixed(1)}
        </span>
      )}
      {subbable && <ArrowRightLeft className="w-3.5 h-3.5 text-neon-yellow shrink-0" strokeWidth={2.5} aria-hidden />}
    </>
  );
  const cls = 'flex items-center gap-2.5 px-2.5 py-1.5 border-l-[3px] bg-deep-black/40 w-full text-left';
  const style = { borderLeftColor: rail, borderRadius: 'var(--radius-sm)' };
  return subbable ? (
    <button type="button" onClick={onSub} className={`${cls} transition-all active:scale-[0.98] hover:bg-deep-black/70`} style={style}>{inner}</button>
  ) : (
    <div className={cls} style={style}>{inner}</div>
  );
}

type PlayerPhase = 'playing' | 'beat' | 'halftime' | 'celebration' | 'penalty' | 'forced' | 'clutch' | 'sub' | 'shootout' | 'done';

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

const FEED_STYLE: Record<QuickPlanFeedItem['kind'], string> = {
  insight: 'text-white/70 italic',
  decision: 'text-neon-yellow',
  goal_home: 'text-neon-yellow font-bold',
  goal_away: 'text-white/90 font-bold',
  save: 'text-[var(--color-success)]',
  chance: 'text-white/80',
  woodwork: 'text-[var(--color-warning)] font-semibold',
  counter: 'text-[var(--color-success)]',
  penalty: 'text-neon-yellow font-bold',
  red: 'text-[var(--color-danger)]',
  halftime: 'text-white/50 uppercase tracking-[0.2em] text-[10px]',
};

/** Tempo real por minuto de jogo CORRIDO (relógio 1,2,3…). 90 min ≈ 22s. */
const CLOCK_MS = 240;
/** Quanto o relógio "segura" num lance pra dar tempo de ler. */
const HOLD_MS: Record<MatchEventTier, number> = { epic: 2400, big: 1700, normal: 950, minor: 600 };

export function QuickPlanPlayer({ plan, onComplete, speedMultiplier = 1.0, onSecondHalf, portraitOf, homeCrestUrl, awayCrestUrl, homeName, awayName, penaltyTakers, fieldCards, awayCards, benchCards, onSubstitution, narration, buildShootout }: Props) {
  void speedMultiplier;
  const [phase, setPhase] = useState<PlayerPhase>('playing');
  const [minute, setMinute] = useState(0);
  const [highlight, setHighlight] = useState<MatchPlanEvent | null>(null);
  // Elenco vivo (subs a qualquer momento mexem aqui).
  const [field, setField] = useState<SquadCard[]>(fieldCards ?? []);
  const [benchPool, setBenchPool] = useState<SquadCard[]>(benchCards ?? []);
  const [subOut, setSubOut] = useState<string | null>(null); // id do titular escolhido pra sair
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [activeBeat, setActiveBeat] = useState<AnalystBeat | null>(null);
  const [feed, setFeed] = useState<QuickPlanFeedItem[]>([]);
  const [celebration, setCelebration] = useState<GoalCelebration | null>(null);
  const [penalty, setPenalty] = useState<{ idx: number; minute: number } | null>(null);
  const [forced, setForced] = useState<ForcedMoment | null>(null);
  const [clutch, setClutch] = useState<{ moment: ClutchMoment; idx: number } | null>(null);
  const [shootoutSetup, setShootoutSetup] = useState<ShootoutSetup | null>(null);
  const [shootoutResult, setShootoutResult] = useState<ShootoutResult | null>(null);
  const [doneInfo, setDoneInfo] = useState<{
    verdicts: BeatVerdict[];
    reading: { good: number; total: number };
    skipped: number;
    stats: { homeShots: number; awayShots: number; homeSaves: number; awaySaves: number; possessionHome: number };
  } | null>(null);

  const eventsRef = useRef<MatchPlanEvent[]>(plan.events);
  const beatsQueueRef = useRef<AnalystBeat[]>([...(plan.analyst_beats ?? [])]);
  const momentumRef = useRef<number[]>([...plan.momentum_curve]);
  const ledgerRef = useRef<BeatDecisionRecord[]>([]);
  const minuteRef = useRef(0);          // relógio corrido
  const eventIdxRef = useRef(0);        // ponteiro no próximo evento (lista ordenada por minuto)
  const timerRef = useRef<number | null>(null);
  const scoreRef = useRef({ home: 0, away: 0 });
  const cardsRef = useRef({ cardsHome: 0, cardsAway: 0, sentOffHome: 0, sentOffAway: 0 });
  const offeredRef = useRef(0);
  const offeredBeatsRef = useRef<AnalystBeat[]>([]);
  const htDoneRef = useRef(false);
  const replannedRef = useRef(false);
  const completedRef = useRef(false);
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

  /** Agenda o próximo passo do relógio (pausa quando uma decisão está aberta). */
  const scheduleNext = (delay: number) => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
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
      pushFeed({ id: `g-${idx}`, minute: e.minute, kind: 'goal_away', text: e.text, side: 'away', actorId: e.actor_id });
    } else if (e.kind === 'yellow_home') {
      cardsRef.current.cardsHome += 1;
    } else if (e.kind === 'yellow_away') {
      cardsRef.current.cardsAway += 1;
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
      pushFeed({ id: `nf-${idx}`, minute: e.minute, kind: 'insight', text: `Analista — ${e.reason}.` });
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
      possessionHome: momentumRef.current.length
        ? Math.round(momentumRef.current.reduce((s, m) => s + m, 0) / momentumRef.current.length)
        : 50,
    };
    const skipped = Math.max(0, offeredBeatsRef.current.length - ledgerRef.current.length);
    setDoneInfo({ verdicts, reading, skipped, stats });

    const emitComplete = (shootout?: ShootoutResult) => {
      onComplete?.(plan, {
        homeScore: scoreRef.current.home,
        awayScore: scoreRef.current.away,
        ledger: [...ledgerRef.current],
        verdicts,
        reading,
        replanned: replannedRef.current,
        playerStats: { ...statsRef.current },
        homeOnPitch: field.map((p) => p.id),
        stats: { homeShots: stats.homeShots, awayShots: stats.awayShots, possessionHome: stats.possessionHome },
        shootout: shootout
          ? { winner: shootout.winner, homeTally: shootout.homeTally, awayTally: shootout.awayTally }
          : undefined,
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
    };
    pushFeed({
      id: 'ht',
      minute: 45,
      kind: 'halftime',
      text: `Intervalo — ${ctx.homeScore} x ${ctx.awayScore}`,
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
    // minuteRef segue em 45 → ao retomar, o relógio avança pro 46 e roda o 2º tempo.
    setPhase('playing');
    scheduleNext(600);
  };

  /** Processa UM evento que caiu no minuto atual. Decisões pausam; lances
   *  comuns destacam no palco e seguram o relógio por HOLD_MS. */
  const handleEvent = (next: MatchPlanEvent, idx: number) => {
    if (next.kind === 'penalty_home') {
      pushFeed({ id: `pen-${idx}`, minute: next.minute, kind: 'penalty', text: 'Pênalti pra gente!', side: 'home' });
      setPenalty({ idx, minute: next.minute });
      setPhase('penalty');
      return;
    }
    if (next.kind === 'penalty_away') {
      const rng = new SpiritRng(hashSeed(`${plan.seed}:penA:${next.minute}`));
      if (rng.next() < 0.74) {
        scoreRef.current.away += 1;
        setAwayScore((v) => v + 1);
        setCelebration({ key: `pen-away-${idx}`, name: plan.away_short, portrait: null, narrative: goalLine(next.minute, 'Pênalti convertido pelo adversário. Dói, mas segue.'), side: 'away' });
        setPhase('celebration');
      } else {
        pushFeed({ id: `pen-${idx}`, minute: next.minute, kind: 'save', text: 'PEGOU! Pênalti defendido — que paredão!', side: 'home' });
        scheduleNext(HOLD_MS.big);
      }
      return;
    }
    if (next.kind === 'injury_home') {
      pushFeed({ id: `inj-${idx}`, minute: next.minute, kind: 'chance', text: next.text, side: 'home', actorId: next.actor_id });
      setForced({ kind: 'injury', idx, minute: next.minute, outName: next.actor_name ?? 'titular', outId: next.actor_id });
      setPhase('forced');
      return;
    }
    if (next.kind === 'red_home') {
      cardsRef.current.sentOffHome += 1;
      pushFeed({ id: `red-${idx}`, minute: next.minute, kind: 'red', text: next.text, side: 'home', actorId: next.actor_id });
      setForced({ kind: 'red', idx, minute: next.minute, outName: next.actor_name ?? 'jogador' });
      setPhase('forced');
      return;
    }
    // MOMENTO DECISIVO: gol natural vira escolha de última fração (faz/salva).
    if ((next.kind === 'goal_home' || next.kind === 'goal_away') && !next.decision_influenced) {
      const intent = next.kind === 'goal_home' ? 'attack' : 'defend';
      setClutch({
        idx,
        moment: buildClutch({ intent, minute: next.minute, seed: plan.seed, actorName: next.actor_name ?? (intent === 'attack' ? plan.home_short : plan.away_short) }),
      });
      setPhase('clutch');
      return;
    }

    processEvent(next, idx);

    // Gol fruto de DECISÃO tática → comemora direto.
    if (next.kind === 'goal_home' || next.kind === 'goal_away') {
      const side = next.actor_side;
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
    scheduleNext(HOLD_MS[next.weight_tier]);
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
      const shownBeat = narrateBeat(beat);
      pushFeed({ id: `i-${beat.id}`, minute: beat.minute, kind: 'insight', text: shownBeat.insight.text });
      setActiveBeat(shownBeat);
      setPhase('beat');
      return;
    }
    const ev = eventsRef.current[eventIdxRef.current];
    if (m > 0 && ev && ev.minute === m) {
      const idx = eventIdxRef.current;
      eventIdxRef.current = idx + 1;
      handleEvent(ev, idx);
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
    scheduleNext(CLOCK_MS);
  };
  tickRef.current = tick;

  /** Resolve o momento decisivo: faz/salva o gol conforme a leitura + feedback. */
  const resolveClutchChoice = (key: ClutchKey) => {
    const c = clutch;
    setClutch(null);
    if (!c) return;
    const ev = eventsRef.current[c.idx];
    const res = resolveClutch(c.moment, key, plan.seed);
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
      else { scoreRef.current.away += 1; setAwayScore((v) => v + 1); }
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
      pushFeed({ id: `subin-${f.idx}`, minute: f.minute, kind: 'insight', text: `Entra ${inCard.name} no lugar de ${f.outName}.` });
      swapInField(f.outId, inCard);
    }
    setPhase('playing');
    scheduleNext(500);
  };

  /** Substituição A QUALQUER MOMENTO: pausa o relógio pra escolher o reserva. */
  const openSub = (outId: string) => {
    if (phase !== 'playing' || benchPool.length === 0) return;
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    setSubOut(outId);
    setPhase('sub');
  };

  /** Confirma a troca no meio do jogo: mexe no elenco + pesa no resto. */
  const applyAnytimeSub = (inCard: SquadCard) => {
    const outId = subOut;
    setSubOut(null);
    if (outId) {
      const outCard = field.find((p) => p.id === outId);
      pushFeed({ id: `sub-${minute}-${outId}`, minute, kind: 'insight', text: `Substituição: entra ${inCard.name}${outCard ? `, sai ${outCard.name}` : ''}.` });
      swapInField(outId, inCard);
      // Efeito real no resto do jogo (sem replan): saldo de OVR pesa.
      const delta = inCard.ovr - (outCard?.ovr ?? inCard.ovr);
      eventsRef.current = applySubNudge({ events: eventsRef.current, fromIndex: eventIdxRef.current, ovrDelta: delta, seed: plan.seed, outId });
    }
    setPhase('playing');
    scheduleNext(450);
  };

  /** Vermelho: segue com 10 — aplica o peso do desfalque no resto do jogo. */
  const resolveRedCard = () => {
    const f = forced;
    setForced(null);
    if (f) {
      eventsRef.current = applyManDownPenalty({ events: eventsRef.current, fromIndex: f.idx + 1, seed: plan.seed });
      pushFeed({ id: `red10-${f.idx}`, minute: f.minute, kind: 'insight', text: 'Analista — com um a menos, vai ser na raça.' });
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
      setCelebration({
        key: `pen-${pen.idx}`,
        name: taker.name,
        portrait: taker.portrait,
        narrative: `Pênalti! ${taker.name} bate com categoria e marca!`,
        side: 'home',
      });
      setPhase('celebration');
    } else {
      pushFeed({ id: `penm-${pen.idx}`, minute: pen.minute, kind: 'chance', text: `${taker.name} bateu o pênalti e o goleiro pegou! Que azar.`, side: 'home', actorId: taker.id });
      setPhase('playing');
      scheduleNext(900);
    }
  };

  // Inicia o relógio corrido no mount; limpa o timer ao desmontar.
  useEffect(() => {
    scheduleNext(CLOCK_MS);
    return () => { if (timerRef.current != null) window.clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBeatChoice = (choice: AnalystBeatChoice | null) => {
    const beat = activeBeat;
    if (beat && choice) {
      ledgerRef.current.push(toDecisionRecord(beat, choice));
      const res = applyDecisionToRemainingEvents({
        events: eventsRef.current,
        fromIndex: eventIdxRef.current, // afeta os eventos ainda não exibidos
        beat,
        choice,
        seed: plan.seed,
      });
      eventsRef.current = res.events;
      pushFeed({ id: `d-${beat.id}`, minute: beat.minute, kind: 'decision', text: `Você: ${choice.label}` });
    }
    setActiveBeat(null);
    setPhase('playing');
    scheduleNext(350);
  };

  const currentEvent = highlight;
  const currentMinute = minute;
  const progress = Math.min(1, currentMinute / 90);

  // 5 cards por time: 3 melhores (OVR) + 2 piores (candidatos a sair no nosso).
  const pickFive = (cards: SquadCard[]) => {
    const ranked = [...cards].sort((a, b) => b.ovr - a.ovr);
    return [...ranked.slice(0, 3), ...ranked.slice(-2).filter((p) => !ranked.slice(0, 3).includes(p))];
  };
  const homeFive = pickFive(field);
  const awayFive = pickFive(awayCards ?? []);
  const homeTopId = homeFive.length ? homeFive[0]!.id : '';
  const awayTopId = awayFive.length ? awayFive[0]!.id : '';
  const subCandidateIds = new Set([...field].sort((a, b) => a.ovr - b.ovr).slice(0, 2).map((p) => p.id));
  const canSubNow = phase === 'playing' && benchPool.length > 0;
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
    const headline = press >= 58
      ? `${homeShort} no ataque`
      : press <= 42
      ? `${awayShort} pressiona`
      : 'Jogo equilibrado';
    // Detalhe gira por minuto pra não ficar estático (3 leituras reais).
    const beat = Math.floor(currentMinute / 7) % 3;
    let detail: string;
    if (beat === 0 && bestHome) detail = `Tua força: ${bestHome.label}`;
    else if (beat === 1 && threat) detail = `O perigo deles: ${threat.label}`;
    else detail = `Finalizações ${hShots} – ${aShots}`;
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
    homeClassName: 'text-neon-yellow',
    awayClassName: 'text-white',
    fontSize,
  });
  const momentumNow = momentumRef.current[Math.max(0, Math.min(89, currentMinute - 1))] ?? 50;

  return (
    <div
      className="relative w-full max-w-2xl mx-auto bg-deep-black border border-l-[3px] overflow-hidden"
      style={{ borderColor: 'var(--color-border)', borderLeftColor: 'var(--color-neon-yellow)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
    >
      {/* Placar cinematográfico: escudos + Moret gigante + minuto (design system) */}
      <div className="px-4 pt-5 pb-4 bg-gradient-to-b from-zinc-950 to-deep-black border-b border-zinc-800">
        <div className="flex items-center justify-center gap-3 sm:gap-5">
          {/* Casa */}
          <div className="flex items-center gap-2.5 flex-1 justify-end min-w-0">
            <div className="text-right min-w-0">
              <p className="font-display uppercase tracking-[0.14em] text-[10px] sm:text-[11px] font-black text-neon-yellow truncate">
                {homeName ?? plan.home_short}
              </p>
            </div>
            {homeCrestUrl ? (
              <img src={homeCrestUrl} alt="" referrerPolicy="no-referrer" draggable={false}
                className="w-9 h-9 sm:w-11 sm:h-11 object-contain shrink-0" />
            ) : (
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 border-neon-yellow grid place-items-center shrink-0">
                <span className="font-display font-black text-[9px] text-neon-yellow">{plan.home_short}</span>
              </div>
            )}
          </div>

          {/* Placar Moret */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-serif italic text-neon-yellow tabular-nums leading-none"
              style={{ fontFamily: 'var(--font-serif-hero)', fontSize: 'clamp(40px, 11vw, 64px)' }}>
              {homeScore}
            </span>
            <span className="text-white/25 text-2xl sm:text-3xl">–</span>
            <span className="font-serif italic text-white tabular-nums leading-none"
              style={{ fontFamily: 'var(--font-serif-hero)', fontSize: 'clamp(40px, 11vw, 64px)' }}>
              {awayScore}
            </span>
          </div>

          {/* Visitante */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {awayCrestUrl ? (
              <img src={awayCrestUrl} alt="" referrerPolicy="no-referrer" draggable={false}
                className="w-9 h-9 sm:w-11 sm:h-11 object-contain shrink-0" />
            ) : (
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 border-white/40 grid place-items-center shrink-0">
                <span className="font-display font-black text-[9px] text-white">{plan.away_short}</span>
              </div>
            )}
            <p className="font-display uppercase tracking-[0.14em] text-[10px] sm:text-[11px] font-black text-white/80 truncate">
              {awayName ?? plan.away_short}
            </p>
          </div>
        </div>

        {/* Minuto */}
        <div className="flex justify-center mt-2">
          <span className="font-display tabular-nums text-neon-yellow text-[13px] font-bold tracking-[0.1em]">
            {phase === 'beat' || phase === 'clutch' || phase === 'penalty' || phase === 'forced' ? '⏸ ' : phase === 'halftime' ? 'INTERVALO · ' : ''}{currentMinute}&prime;
          </span>
        </div>
      </div>

      {/* Progress bar do tempo de jogo */}
      <div className="h-0.5 bg-zinc-900">
        <motion.div
          className="h-full bg-neon-yellow"
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ ease: 'linear', duration: 0.3 }}
        />
      </div>

      {/* Barra de MOMENTO — PERSISTENTE (nunca desmonta): narra o jogo o tempo
          todo, inclusive durante decisões. Não volta mais ao meio. */}
      <div className="px-5 pt-4">
        <MomentumBar
          momentum={momentumNow / 100}
          homeShort={plan.home_short}
          awayShort={plan.away_short}
        />
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
          const eyebrow = hl ? `${eventKindLabel(hl)} · ${currentMinute}'` : `Ao vivo · ${currentMinute}'`;
          const headline = hl ? hl.text : liveRead.headline;
          const detail = hl ? hl.reason : liveRead.detail;
          return (
            <AnimatePresence mode="wait">
              <motion.div
                key={yellow ? `hl-${minute}-${hl!.kind}` : `live-${Math.floor(currentMinute / 7)}-${liveRead.headline}`}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.22 }}
                className="w-full border border-l-[3px] px-4 py-4"
                style={{
                  borderColor: 'var(--color-border)',
                  borderLeftColor: 'var(--color-neon-yellow)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: yellow ? 'rgba(253,225,0,0.10)' : 'var(--color-dark-gray)',
                  boxShadow: yellow && hl!.weight_tier === 'epic' ? '0 0 24px rgba(253,225,0,0.30)' : undefined,
                }}
              >
                <p className="font-display uppercase tracking-[0.3em] text-[9px] font-black text-neon-yellow mb-1.5">
                  {eyebrow}
                </p>
                <p
                  className="text-white leading-tight mb-1.5"
                  style={{ fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic', fontSize: yellow ? 'clamp(19px, 4.4vw, 26px)' : 'clamp(22px, 5vw, 30px)', letterSpacing: '-0.02em' }}
                >
                  {headline}
                </p>
                {detail && (
                  <p className="text-[12px] text-white/65" style={{ fontFamily: 'var(--font-sans)' }}>
                    {detail}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          );
        })()}

        <AnimatePresence mode="wait">
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
              <p className="font-display uppercase tracking-[0.3em] text-[10px] font-black text-neon-yellow mb-2">
                Intervalo
              </p>
              <p className="text-[12px] text-white/60">
                Recalculando o jogo com as suas decisões…
              </p>
            </motion.div>
          )}

          {phase === 'penalty' && penalty && (
            <motion.div
              key={`penalty-${penalty.idx}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full border border-l-[3px] bg-dark-gray"
              style={{ borderColor: 'var(--color-border)', borderLeftColor: 'var(--color-neon-yellow)', borderRadius: 'var(--radius-md)' }}
            >
              <p className="px-4 pt-3 pb-1 flex items-center gap-2 font-display uppercase tracking-[0.28em] text-[10px] font-black text-neon-yellow">
                <Target className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden /> Pênalti · {penalty.minute}&prime;
              </p>
              <p className="px-4 pb-3 text-sm text-white font-semibold">Quem vai bater?</p>
              <div className="px-3 pb-3 flex flex-col gap-1.5">
                {(penaltyTakers && penaltyTakers.length > 0
                  ? penaltyTakers
                  : [{ id: 'def', name: eventsRef.current[penalty.idx]?.actor_name ?? 'Capitão', finalizacao: 75, portrait: null }]
                ).slice(0, 4).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => takePenalty(t)}
                    className="flex items-center gap-2.5 px-3 py-2 border text-left transition-all active:scale-[0.98] group"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-neon-yellow) 40%, transparent)', borderRadius: 'var(--radius-sm)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-neon-yellow)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                  >
                    {t.portrait ? (
                      <img src={t.portrait} alt="" className="h-7 w-7 rounded-full object-cover object-top border border-neon-yellow/50" />
                    ) : (
                      <span className="h-7 w-7 rounded-full border border-neon-yellow/40 grid place-items-center text-neon-yellow"><Target className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden /></span>
                    )}
                    <span className="flex-1 text-[13px] font-bold text-white group-hover:text-black">{t.name}</span>
                    <span className="font-serif italic text-base text-neon-yellow group-hover:text-black tabular-nums" style={{ fontFamily: 'var(--font-serif-hero)' }}>
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
              className="w-full border border-l-[3px] bg-dark-gray"
              style={(() => { const tk = clutch.moment.intent === 'attack' ? 'var(--color-success)' : 'var(--color-danger)'; return { borderColor: 'var(--color-border)', borderLeftColor: tk, borderRadius: 'var(--radius-md)' }; })()}
            >
              {(() => {
                const atk = clutch.moment.intent === 'attack';
                const tk = atk ? 'var(--color-success)' : 'var(--color-danger)';
                const Icon = atk ? Crosshair : ShieldAlert;
                return (
                  <>
                    <p className="px-4 pt-3 flex items-center gap-2 font-display uppercase tracking-[0.28em] text-[10px] font-black" style={{ color: tk }}>
                      <Icon className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />
                      {atk ? 'Chance de gol' : 'Perigo na área'} · {clutch.moment.minute}&prime;
                    </p>
                    <p className="px-4 pt-1.5 pb-1 text-sm text-white font-bold">{clutch.moment.context}</p>
                    <p className="px-4 pb-3 text-[11px] text-white/55">
                      {atk ? `${clutch.moment.actorName} na bola — o que fazer?` : 'Decisão na hora — como parar?'}
                    </p>
                    <div className="px-3 pb-3 grid grid-cols-3 gap-1.5">
                      {clutch.moment.options.map((o) => (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => resolveClutchChoice(o.key)}
                          className="py-3 font-display uppercase tracking-[0.1em] text-[12px] font-black border text-white/90 transition-all active:scale-[0.97]"
                          style={{ borderColor: 'color-mix(in srgb, ' + tk + ' 40%, transparent)', borderRadius: 'var(--radius-sm)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tk; e.currentTarget.style.color = '#000'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = ''; }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
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
              className="w-full border border-l-[3px] bg-dark-gray"
              style={{ borderColor: 'var(--color-border)', borderLeftColor: 'var(--color-warning)', borderRadius: 'var(--radius-md)' }}
            >
              <p className="px-4 pt-3 pb-1 flex items-center gap-2 font-display uppercase tracking-[0.28em] text-[10px] font-black" style={{ color: 'var(--color-warning)' }}>
                <Cross className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden /> Lesão · {forced.minute}&prime;
              </p>
              <p className="px-4 pb-3 text-sm text-white font-semibold">
                {forced.outName} caiu. Quem entra?
              </p>
              <div className="px-3 pb-3 flex flex-col gap-1.5">
                {(benchPool.length > 0
                  ? benchPool
                  : [{ id: 'res', name: 'Reserva', pos: '—', ovr: 70, fatigue: 0, portrait: null }]
                ).slice(0, 4).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => resolveInjury(b)}
                    className="flex items-center gap-2.5 px-3 py-2 border text-left transition-all active:scale-[0.98] group"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-warning) 40%, transparent)', borderRadius: 'var(--radius-sm)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-warning)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                  >
                    <span className="font-serif italic text-base tabular-nums w-7 text-center" style={{ fontFamily: 'var(--font-serif-hero)', color: 'var(--color-warning)' }}>{b.ovr}</span>
                    <span className="flex-1 text-[13px] font-bold text-white group-hover:text-black">{b.name}</span>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-white/45 group-hover:text-black/60">{b.pos}</span>
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
              className="w-full border border-l-[3px] bg-dark-gray"
              style={{ borderColor: 'var(--color-border)', borderLeftColor: 'var(--color-neon-yellow)', borderRadius: 'var(--radius-md)' }}
            >
              <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                <span className="flex items-center gap-2 font-display uppercase tracking-[0.28em] text-[10px] font-black text-neon-yellow">
                  <ArrowRightLeft className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden /> Substituição · {minute}&prime;
                </span>
                <button type="button" onClick={() => { setSubOut(null); setPhase('playing'); scheduleNext(300); }} className="text-[10px] text-white/40 hover:text-white uppercase tracking-[0.14em]">Cancelar</button>
              </div>
              <p className="px-4 pb-3 text-[12px] text-white/70">
                Sai <span className="text-white font-bold">{field.find((p) => p.id === subOut)?.name}</span> — quem entra?
              </p>
              <div className="px-3 pb-3 flex flex-col gap-1.5">
                {benchPool.slice(0, 6).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => applyAnytimeSub(b)}
                    className="flex items-center gap-2.5 px-3 py-2 border text-left transition-all active:scale-[0.98] group"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-neon-yellow) 40%, transparent)', borderRadius: 'var(--radius-sm)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-neon-yellow)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                  >
                    <span className="font-serif italic text-base text-neon-yellow group-hover:text-black tabular-nums w-7 text-center" style={{ fontFamily: 'var(--font-serif-hero)' }}>{b.ovr}</span>
                    <span className="flex-1 text-[13px] font-bold text-white group-hover:text-black">{b.name}</span>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-white/45 group-hover:text-black/60">{b.pos} · fad {Math.round(b.fatigue)}%</span>
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
              className="w-full border border-l-[3px] bg-dark-gray text-center"
              style={{ borderColor: 'var(--color-border)', borderLeftColor: 'var(--color-danger)', borderRadius: 'var(--radius-md)' }}
            >
              <p className="px-4 pt-4 flex items-center justify-center gap-2 font-display uppercase tracking-[0.28em] text-[10px] font-black" style={{ color: 'var(--color-danger)' }}>
                <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden /> Cartão Vermelho · {forced.minute}&prime;
              </p>
              <p className="px-4 pt-1 pb-3 text-sm text-white font-semibold">
                {forced.outName} foi expulso. Vai ter que segurar com 10!
              </p>
              <div className="px-4 pb-4">
                <button
                  type="button"
                  onClick={resolveRedCard}
                  className="w-full py-2.5 text-black font-display uppercase tracking-[0.16em] text-[12px] font-black transition-all active:scale-[0.99] hover:bg-white"
                  style={{ backgroundColor: 'var(--color-danger)', borderRadius: 'var(--radius-sm)' }}
                >
                  Segurar com 10
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
              {(() => {
                // No empate, a disputa de pênaltis decide o vencedor.
                const decided = shootoutResult ? shootoutResult.winner : homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : null;
                const res = decided === 'home' ? 'win' : decided === 'away' ? 'loss' : 'draw';
                const resWord = res === 'win' ? 'Vitória' : res === 'loss' ? 'Não foi dessa vez' : 'Empate';
                const resColor = res === 'win' ? 'var(--color-success)' : res === 'loss' ? 'var(--color-danger)' : 'var(--color-neon-yellow)';
                const detail = shootoutResult
                  ? `nos pênaltis ${shootoutResult.homeTally}–${shootoutResult.awayTally}`
                  : plan.narrative_arc.replace('_', ' ');
                return (
                  <p className="font-display uppercase tracking-[0.3em] text-[10px] font-black mb-4 text-center" style={{ color: resColor }}>
                    {resWord} · {detail}
                  </p>
                );
              })()}

              {/* CARD DE MVP — padrão Crown Jewel (hero amarelo). */}
              {plan.mvp_projection && (
                <div className="mb-4 px-5 py-5 bg-neon-yellow" style={{ borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(253,225,0,0.18)' }}>
                  <p className="font-display uppercase tracking-[0.32em] text-[10px] font-black text-black/70 mb-2">
                    Craque do jogo · MVP
                  </p>
                  <p
                    className="text-black leading-[0.95]"
                    style={{ fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(34px, 9vw, 52px)', letterSpacing: '-0.03em' }}
                  >
                    {shortName(plan.mvp_projection.name)}
                  </p>
                  <span aria-hidden className="block w-12 h-[3px] bg-black/80 mt-2 mb-3" />
                  <p className="font-display uppercase tracking-[0.2em] text-[12px] font-black text-black/85">
                    {plan.mvp_projection.goals > 0 && `${plan.mvp_projection.goals} ${plan.mvp_projection.goals === 1 ? 'gol' : 'gols'} · `}
                    Nota {plan.mvp_projection.rating.toFixed(1)}
                  </p>
                </div>
              )}

              {/* Estatísticas do jogo */}
              <div className="grid grid-cols-3 gap-px bg-white/8 border border-white/8 text-center mb-4" style={{ borderRadius: 'var(--radius-sm)' }}>
                {[
                  { l: 'Posse', h: `${doneInfo.stats.possessionHome}%`, a: `${100 - doneInfo.stats.possessionHome}%` },
                  { l: 'Finalizações', h: doneInfo.stats.homeShots, a: doneInfo.stats.awayShots },
                  { l: 'Defesas', h: doneInfo.stats.homeSaves, a: doneInfo.stats.awaySaves },
                ].map((s) => (
                  <div key={s.l} className="bg-deep-black py-3">
                    <p className="font-serif italic text-neon-yellow text-xl tabular-nums leading-none" style={{ fontFamily: 'var(--font-serif-hero)' }}>{s.h}</p>
                    <p className="text-[8px] uppercase tracking-[0.18em] text-white/45 my-1">{s.l}</p>
                    <p className="font-serif italic text-white/80 text-xl tabular-nums leading-none" style={{ fontFamily: 'var(--font-serif-hero)' }}>{s.a}</p>
                  </div>
                ))}
              </div>

              {/* Leitura de Jogo — o placar da inteligência do manager */}
              <div className="border-t border-white/8 pt-3">
                <p className="font-display uppercase tracking-[0.26em] text-[10px] font-black text-neon-yellow mb-2 text-center">
                  Leitura de Jogo · {doneInfo.reading.good}/{doneInfo.reading.total}
                </p>
                {narration?.reading && (
                  <p className="font-serif italic text-white/85 text-[15px] leading-snug text-center mb-3 px-2" style={{ fontFamily: 'var(--font-serif-hero)' }}>
                    {narration.reading}
                  </p>
                )}
                {doneInfo.verdicts.length === 0 ? (
                  <p className="text-[11px] text-white/50 text-center">
                    Você não decidiu nada — o Analista falou sozinho.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {doneInfo.verdicts.map((v) => (
                      <li key={v.beatId} className="flex items-start gap-2 text-[12px] leading-snug">
                        <span style={{ color: v.kind === 'hit' ? 'var(--color-success)' : v.kind === 'neutral' ? 'var(--color-neon-yellow)' : 'var(--color-danger)' }}>
                          {v.kind === 'hit' ? '✓' : v.kind === 'neutral' ? '•' : '✗'}
                        </span>
                        <span className="text-white/80">
                          <span className="text-white/45">{v.minute}&prime; {v.choiceLabel} — </span>
                          {richText(v.text, '13px')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {doneInfo.skipped > 0 && (
                  <p className="text-[11px] text-white/40 mt-2 text-center">
                    Você deixou passar {doneInfo.skipped} decisã{doneInfo.skipped === 1 ? 'o' : 'ões'} — o Analista chamou e ninguém respondeu.
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
            <div className="flex items-start gap-3 border-l-[3px] pl-3 py-1" style={{ borderLeftColor: 'var(--color-neon-yellow)' }}>
              {portrait ? (
                <img src={portrait} alt="" className="h-9 w-9 rounded-full object-cover object-top shrink-0 border border-neon-yellow/60" />
              ) : (
                <span className="h-9 w-9 rounded-full shrink-0 border border-neon-yellow/40 bg-dark-gray grid place-items-center font-serif italic text-neon-yellow text-sm" style={{ fontFamily: 'var(--font-serif-hero)' }} aria-hidden>{latest.minute}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-display uppercase tracking-[0.24em] text-[9px] font-black text-neon-yellow mb-0.5">
                  {latest.minute}&prime; · Narração
                </p>
                <p className={`text-[14px] leading-snug ${FEED_STYLE[latest.kind]}`} style={{ fontFamily: 'var(--font-sans)' }}>
                  {richText(latest.text, '15px')}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ELENCOS EM CAMPO — 5 de cada lado, padrão editorial roster. Toca num
          dos teus pra trocar a qualquer momento. */}
      {homeFive.length >= 5 && phase !== 'done' && (
        <div className="px-3 pb-3 pt-2 border-t border-white/8 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
          {/* Meu time */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-0.5">
              {homeCrestUrl && <img src={homeCrestUrl} alt="" className="w-4 h-4 object-contain" referrerPolicy="no-referrer" />}
              <span className="font-display uppercase tracking-[0.24em] text-[9px] font-black text-neon-yellow truncate">
                {homeName ?? plan.home_short} · em campo
              </span>
            </div>
            {homeFive.map((p) => (
              <RosterRow
                key={p.id}
                card={p}
                isTop={p.id === homeTopId}
                rating={matchRating(p.ovr, statsRef.current[p.id], ratingCtx(p, 'home'))}
                subbable={canSubNow && subCandidateIds.has(p.id)}
                onSub={() => openSub(p.id)}
              />
            ))}
          </div>

          {/* Adversário */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-0.5">
              {awayCrestUrl && <img src={awayCrestUrl} alt="" className="w-4 h-4 object-contain" referrerPolicy="no-referrer" />}
              <span className="font-display uppercase tracking-[0.24em] text-[9px] font-black text-white/70 truncate">
                {awayName ?? plan.away_short} · o perigo
              </span>
            </div>
            {awayFive.map((p) => (
              <RosterRow key={p.id} card={p} isTop={p.id === awayTopId} rating={matchRating(p.ovr, statsRef.current[p.id], ratingCtx(p, 'away'))} />
            ))}
          </div>
        </div>
      )}

      {/* Comemoração de gol — overlay cinematográfico, pausa o jogo */}
      <QuickGoalCelebration
        triggerKey={celebration?.key ?? null}
        scorerName={shortName(celebration?.name)}
        scorerPortrait={celebration?.portrait ?? null}
        narrative={celebration?.narrative}
        onDismiss={dismissCelebration}
      />
    </div>
  );
}
