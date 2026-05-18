import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Brain, Sparkles, LayoutGrid,
  Star, Shield,
  Zap, Target, Crosshair,
  ChevronRight, ChevronDown, X,
  Wifi, AlertTriangle, Goal as GoalIcon, Swords, Repeat, Footprints,
  Flame, ArrowUpRight,
} from 'lucide-react';
import type {
  ClassicPlayer, MatchEvent, MatchStats, MatchScore,
  BallState, TrailPoint, SkillEntry,
  ClassicMatchConfig, ManagerSkillId, EventChainContext,
} from '@/engine/classic/types';
import { emptyPlayerMatchStats, deriveMentalState } from '@/engine/classic/types';
import { getHomePlayers, getAwayPlayers, FIELD_W_LOGIC, FIELD_H_LOGIC, repositionForFormation } from '@/engine/classic/formations';
import { generateEvent, applyEventToPlayers, deriveStatsDelta } from '@/engine/classic/eventGenerator';
import { computeTeamPhase } from '@/engine/classic/decisionEngine';
import { createMatchStory, updateMatchStory, storyBeatsForCoach } from '@/engine/classic/matchStory';
import type { MatchStory } from '@/engine/classic/matchStory';
import { computeEventBasedEvolution } from '@/engine/classic/postMatchEvolution';
import { useGameDispatch } from '@/game/store';
import { HeatmapEngine } from '@/engine/classic/heatmapEngine';
import {
  tickAllAgents,
  extractBasePositions,
  resetPlayersToBase,
} from '@/engine/classic/playerAgent';

// ─── Design tokens scoped to Classic mode ─────────────────────────────────────
// Fonts: Agency FB (display) · Moret italic (numbers/score) · Inter (body)
// Colors: all referencing the global Legacy Tech token set
const CSS_VARS = `
.classic-mode {
  --c-bg-primary:    var(--color-deep-black, #0D0D0D);
  --c-bg-surface:    #111111;
  --c-bg-elevated:   var(--color-dark-gray, #1A1A1A);
  --c-bg-field:      #1A2E1A;
  --c-bg-field-alt:  #162614;
  --c-accent:        var(--color-neon-yellow, #FDE100);
  --c-accent-glow:   rgba(253,225,0,0.15);
  --c-text-primary:  rgba(255,255,255,0.90);
  --c-text-sec:      rgba(255,255,255,0.55);
  --c-text-muted:    rgba(255,255,255,0.25);
  --c-team-home:     var(--color-neon-yellow, #FDE100);
  --c-team-away:     #FFFFFF;
  --c-ok:            var(--color-success, #22C55E);
  --c-danger:        var(--color-danger, #EF4444);
  --c-warning:       var(--color-warning, #F59E0B);
  --c-border:        var(--color-border, rgba(255,255,255,0.08));
  --c-border-accent: rgba(253,225,0,0.40);
  --cf-display: var(--font-display,  "Agency FB", Impact, sans-serif);
  --cf-hero:    var(--font-serif-hero, "Moret", Georgia, serif);
  --cf-body:    var(--font-sans, Inter, ui-sans-serif, sans-serif);
}
@keyframes c-pulse        { 0%,100%{opacity:1}      50%{opacity:0.3} }
@keyframes c-fadeInDown   { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
@keyframes c-slideUp      { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:translateY(0)} }
@keyframes c-goalFlash    { 0%,100%{background:var(--color-deep-black,#0D0D0D)} 33%,66%{background:rgba(253,225,0,0.07)} }
@keyframes c-dangerPulse  { 0%,100%{box-shadow:none} 50%{box-shadow:0 0 22px rgba(239,68,68,0.32) inset} }
@keyframes c-legacyRadius {
  0%   { transform: translate(-50%,-50%) scale(0.4); opacity: 0.85; }
  100% { transform: translate(-50%,-50%) scale(4.5); opacity: 0;    }
}
@keyframes c-legacyCore {
  0%,100% { box-shadow: 0 0 0 3px rgba(253,225,0,0.55), 0 0 24px rgba(253,225,0,0.45); }
  50%     { box-shadow: 0 0 0 5px rgba(253,225,0,0.85), 0 0 36px rgba(253,225,0,0.75); }
}
@keyframes c-onFire {
  0%,100% { border-color: rgba(251,146,60,0.9); }
  50%     { border-color: rgba(253,225,0,0.9); }
}
@keyframes c-confidence-aura {
  0%,100% { box-shadow: 0 0 0 0 rgba(253,225,0,0.55), 0 0 18px rgba(253,225,0,0.55); }
  50%     { box-shadow: 0 0 0 4px rgba(253,225,0,0.15), 0 0 26px rgba(253,225,0,0.85); }
}
@keyframes c-fatigue-pulse {
  0%,100% { border-color: rgba(239,68,68,0.55); transform: translate(-50%,-50%) translateX(0); }
  25%     { border-color: rgba(239,68,68,0.20); transform: translate(-50%,-50%) translateX(0.6px); }
  50%     { border-color: rgba(239,68,68,0.55); transform: translate(-50%,-50%) translateX(0); }
  75%     { border-color: rgba(239,68,68,0.20); transform: translate(-50%,-50%) translateX(-0.6px); }
}
@keyframes c-pass-line {
  0%   { stroke-dashoffset: 24; opacity: 0.95; }
  100% { stroke-dashoffset: 0;  opacity: 0.30; }
}
@keyframes c-shot-vignette {
  0%   { opacity: 0; }
  30%  { opacity: 1; }
  80%  { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes c-shot-pulse {
  0%,100% { box-shadow: inset 0 0 30px rgba(255,200,50,0); }
  50%     { box-shadow: inset 0 0 30px rgba(255,200,50,0.12); }
}
@keyframes c-reposition {
  from { opacity: 0.4; }
  to   { opacity: 1; }
}
@keyframes c-coach-ping {
  0%,100% { opacity: 1; transform: scale(1); }
  50%     { opacity: 0.4; transform: scale(0.7); }
}
@keyframes c-terminal-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes c-tempo-tick {
  0%,100% { transform: scaleX(0.15); opacity: 0.4; }
  50%     { transform: scaleX(1);    opacity: 1;   }
}
@keyframes c-card-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

// ─── Constants ────────────────────────────────────────────────────────────────
// Clock: 1 real second = 1 match minute
const CLOCK_TICK_MS        = 1000;
// Pacing arcade: jogadores pensam rápido, jogo flui — 2x mais ágil
const EVENT_INTERVAL_MIN   = 1500;  // 4000 → 1500 (nova sequência)
const EVENT_INTERVAL_RANGE = 1200;  // 3000 → 1200 (variação randômica)
const TRAIL_MAX  = 8;
const BALL_LERP  = 0.12;
const FEED_MAX   = 4;
const TIMELINE_MAX = 10;

// Match structure: 45+3 first half, 45+5 second half
const HALF1_END   = 45;
const HALF1_EXTRA = 3;   // acréscimos 1º tempo
const HALF2_END   = 90;
const HALF2_EXTRA = 5;   // acréscimos 2º tempo
const MATCH_END   = HALF2_END + HALF2_EXTRA; // 95 real minutes total

function timelinePriority(evt: MatchEvent): number {
  if (evt.type === 'goal') return 100;
  if (evt.type === 'save' || evt.type === 'post') return 86;
  if (evt.type === 'blocked' || evt.type === 'wide') return 76;
  if (evt.skillActivated) return 72;
  if (evt.type === 'duel' || evt.type === 'interception' || evt.type === 'tackle') return 64;
  if (evt.chanceCreated || evt.type === 'danger' || evt.type === 'cross' || evt.type === 'shot') return 56;
  return 20;
}

function shouldEnterTimeline(evt: MatchEvent): boolean {
  return timelinePriority(evt) >= 50;
}

function addTimelineSlot(prev: MatchEvent[], evt: MatchEvent): MatchEvent[] {
  if (!shouldEnterTimeline(evt)) return prev;
  if (prev.some(slot => slot.id === evt.id)) return prev;

  const next = [...prev, evt].sort((a, b) => {
    const periodA = Math.floor(Math.min(a.minute, 90) / 15);
    const periodB = Math.floor(Math.min(b.minute, 90) / 15);
    if (periodA !== periodB && prev.length < TIMELINE_MAX) return periodA - periodB;
    const priorityDelta = timelinePriority(b) - timelinePriority(a);
    return priorityDelta || a.minute - b.minute;
  });

  if (next.length <= TIMELINE_MAX) {
    return next.sort((a, b) => a.minute - b.minute);
  }

  const keep = next
    .slice(0, TIMELINE_MAX)
    .sort((a, b) => a.minute - b.minute);
  return keep;
}

function formatSkillTag(evt: MatchEvent): string | null {
  if (evt.skillActivated) return `${evt.skillActivated} activated`;
  if (evt.tacticalTrigger === 'forced_shot') return 'Box Striker attacked the box';
  if (evt.tacticalTrigger === 'false9') return 'False 9 created space';
  if (evt.tacticalTrigger === 'tiktak') return 'Creative Passer activated';
  if (evt.tacticalTrigger === 'duel_win') return 'Defensive Duel won';
  return null;
}

const SKILLS_INIT: SkillEntry[] = [
  { id:'counter', label:'CONTRA ATAQUE',   icon:'zap',        cooldown:10, active:false, remaining:0 },
  { id:'press',   label:'PRESSÃO ALTA',    icon:'shield',     cooldown:15, active:false, remaining:0 },
  { id:'offens',  label:'FOCO OFENSIVO',   icon:'target',     cooldown:20, active:false, remaining:0 },
  { id:'cross',   label:'BOLA NA ÁREA',    icon:'crosshair',  cooldown:15, active:false, remaining:0 },
  { id:'hold',    label:'SEGURAR JOGO',    icon:'footprints', cooldown:12, active:false, remaining:0 },
  { id:'wing',    label:'EXPLORAR ALAS',   icon:'arrowup',    cooldown:12, active:false, remaining:0 },
];

const FORMATIONS = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '4-5-1', '5-3-2', '3-4-3'] as const;
type FormationId = typeof FORMATIONS[number];

// 4 estilos de passe — baseados nos princípios do AP-FOOTBALL-KNOWLEDGE
const PASS_STYLES = [
  {
    id: 'TIKTAK' as const,
    label: 'TIK-TAK',
    desc: 'Circulação curta zona a zona',
    icon: 'repeat',
  },
  {
    id: 'LONGO' as const,
    label: 'LONGO',
    desc: 'Lançamento direto em profundidade',
    icon: 'send',
  },
  {
    id: 'LATERAL' as const,
    label: 'LATERAL',
    desc: 'Amplitude nos corredores',
    icon: 'chevron-right',
  },
  {
    id: 'COUNTER' as const,
    label: 'COUNTER',
    desc: 'Transição ofensiva rápida',
    icon: 'zap',
  },
] as const;

// ─── Field drawing ─────────────────────────────────────────────────────────────
function drawField(ctx: CanvasRenderingContext2D, W = FIELD_W_LOGIC, H = FIELD_H_LOGIC) {
  ctx.fillStyle = '#1A2E1A';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i * 50 < W; i++) {
    if (i % 2 === 0) { ctx.fillStyle = '#162614'; ctx.fillRect(i * 50, 0, 50, H); }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.beginPath(); ctx.moveTo(W / 2, 20); ctx.lineTo(W / 2, H - 20); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 40, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeRect(20, H / 2 - 60, 80, 120);
  ctx.strokeRect(W - 100, H / 2 - 60, 80, 120);
  ctx.strokeRect(20, H / 2 - 30, 30, 60);
  ctx.strokeRect(W - 50, H / 2 - 30, 30, 60);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(6, H / 2 - 20, 14, 40);
  ctx.fillRect(W - 20, H / 2 - 20, 14, 40);
}

function drawBall(ctx: CanvasRenderingContext2D, _ball: BallState, trail: TrailPoint[]) {
  // Apenas o rastro fica no canvas (atrás dos tokens, OK).
  // A bola em si é renderizada num div separado com zIndex alto (ver JSX).
  for (const p of trail) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${p.opacity * 0.45})`;
    ctx.fill();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function EventIcon({ type, size = 14 }: { type: string; size?: number }) {
  switch (type) {
    case 'goal':         return <GoalIcon       size={size} />;
    case 'shot':         return <Target         size={size} />;
    case 'danger':       return <AlertTriangle  size={size} />;
    case 'cross':        return <Footprints     size={size} />;
    case 'tackle':       return <Swords         size={size} />;
    case 'interception': return <Shield         size={size} />;
    case 'foul':         return <AlertTriangle  size={size} />;
    case 'corner':       return <Repeat         size={size} />;
    case 'pressure':     return <Zap            size={size} />;
    default:             return <Repeat         size={size} />;
  }
}
function SkillIcon({ icon, size = 12 }: { icon: string; size?: number }) {
  switch (icon) {
    case 'zap':        return <Zap          size={size} />;
    case 'shield':     return <Shield       size={size} />;
    case 'target':     return <Target       size={size} />;
    case 'crosshair':  return <Crosshair    size={size} />;
    case 'footprints': return <Footprints   size={size} />;
    case 'arrowup':    return <ArrowUpRight size={size} />;
    default:           return <Zap          size={size} />;
  }
}

function padTime(n: number): string { return String(n).padStart(2, '0'); }
function shortInitials(name: string, len = 3): string {
  return name.replace(/\s+FC$/i,'').slice(0, len).toUpperCase();
}

// ─── Shared style fragments ────────────────────────────────────────────────────
const T_DISPLAY: React.CSSProperties = { fontFamily: 'var(--cf-display)', textTransform: 'uppercase', letterSpacing: '0.22em' };
const T_HERO: React.CSSProperties    = { fontFamily: 'var(--cf-hero)', fontStyle: 'italic', fontVariantNumeric: 'tabular-nums' };
const T_BODY: React.CSSProperties    = { fontFamily: 'var(--cf-body)' };

// ─── Crest component (no emoji — Legacy Tech style) ───────────────────────────
function ClubCrest({ color, initials, crestUrl, size = 56 }: {
  color: string;
  initials: string;
  crestUrl?: string | null;
  size?: number;
}) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, minWidth:size }}>
      <div style={{
        width: size, height: size,
        display:'flex', alignItems:'center', justifyContent:'center',
        position:'relative',
      }}>
        {crestUrl ? (
          <img
            src={crestUrl}
            alt={initials}
            loading="lazy"
            style={{ width:'100%', height:'100%', objectFit:'contain', filter:'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' }}
          />
        ) : (
          <>
            <Shield size={size * 0.85} color={color} strokeWidth={1.8} fill="none" />
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', ...T_DISPLAY, fontSize: Math.round(size * 0.28), fontWeight:900, color, letterSpacing:'0.04em' }}>
              {initials.charAt(0)}
            </div>
          </>
        )}
      </div>
      <span style={{ ...T_DISPLAY, fontSize:10, fontWeight:800, color:'var(--c-text-primary)', letterSpacing:'0.22em' }}>
        {initials}
      </span>
    </div>
  );
}

// ─── ModuleCard ───────────────────────────────────────────────────────────────
// Card modular Legacy Tech: rail amarelo 3px à esquerda, borda fina, cantos
// suaves, eyebrow Agency uppercase tracking-wide. Cada seção é uma "vitrine"
// do museu vivo do futebol.
type ModuleCardTone = 'accent' | 'neutral' | 'danger';
function ModuleCard({
  eyebrow,
  meta,
  tone = 'accent',
  noPadding = false,
  children,
  style,
}: {
  eyebrow?: string;
  meta?: React.ReactNode;
  tone?: ModuleCardTone;
  noPadding?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const railColor = tone === 'danger' ? 'var(--c-danger)' : tone === 'neutral' ? 'rgba(255,255,255,0.18)' : 'var(--c-accent)';
  return (
    <div style={{
      background:'var(--c-bg-surface)',
      border:'1px solid var(--c-border)',
      borderLeft:`3px solid ${railColor}`,
      borderRadius:8,
      animation:'c-card-in 0.32s ease',
      overflow:'hidden',
      ...style,
    }}>
      {(eyebrow || meta) && (
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
          padding:'10px 14px 8px',
          borderBottom:'1px solid var(--c-border)',
        }}>
          {eyebrow && (
            <span style={{ ...T_DISPLAY, fontSize:9, fontWeight:900, color: tone === 'danger' ? 'var(--c-danger)' : 'var(--c-accent)', letterSpacing:'0.26em' }}>
              {eyebrow}
            </span>
          )}
          {meta && <div>{meta}</div>}
        </div>
      )}
      <div style={{ padding: noPadding ? 0 : '12px 14px' }}>
        {children}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
interface Props {
  config?: Partial<ClassicMatchConfig>;
  /** 11 titulares casa pré-construídos (manager real). Fallback = TIGRES demo. */
  homePlayers?: ClassicPlayer[];
  /** 11 titulares visitantes pré-construídos (oponente real / sintético). */
  awayPlayers?: ClassicPlayer[];
  /** Perfis narrativos dos jogadores da casa — enriquece frases do motor. */
  homeNarrativeProfiles?: Map<number, import('@/gamespirit/playerNarrativeProfile').PlayerNarrativeProfile>;
  onExit?: () => void;
}

export function ClassicMatchScreen({ config, homePlayers, awayPlayers, homeNarrativeProfiles, onExit }: Props) {
  const homeTeam    = config?.homeTeam    ?? 'TIGRES';
  const awayTeam    = config?.awayTeam    ?? 'ALVORADA FC';
  const round       = config?.round       ?? 12;
  const competition = config?.competition ?? 'CLASSIC LEAGUE';
  const homeShort   = config?.homeShort   ?? shortInitials(homeTeam);
  const awayShort   = config?.awayShort   ?? shortInitials(awayTeam);

  // ── State ──────────────────────────────────────────────────────────────────
  const initialPlayers = (homePlayers && awayPlayers && homePlayers.length === 11 && awayPlayers.length === 11)
    ? [...homePlayers, ...awayPlayers].map(p => ({ ...p, matchStats: emptyPlayerMatchStats() }))
    : [...getHomePlayers(), ...getAwayPlayers()].map(p => ({ ...p, matchStats: emptyPlayerMatchStats() }));
  const [players, setPlayers] = useState<ClassicPlayer[]>(initialPlayers);
  const [latestEvent, setLatestEvent] = useState<MatchEvent | null>(null);
  const [eventFeed, setEventFeed] = useState<MatchEvent[]>([]);
  const matchEventsRef = useRef<MatchEvent[]>([]);
  const [score, setScore]     = useState<MatchScore>({ home: 0, away: 0 });
  const [minute, setMinute]   = useState(0);
  const [extraMinute, setExtraMinute] = useState(0); // acréscimos exibidos
  const [period, setPeriod]   = useState<string>('1º TEMPO');
  const [running, setRunning] = useState(true);
  const [matchOver, setMatchOver] = useState(false);
  const [mvp, setMvp] = useState<ClassicPlayer | null>(null);
  const [coachPing, setCoachPing] = useState(false);
  const [coachReading, setCoachReading] = useState<import('@/lib/classicCoachClient').CoachReading | null>(null);
  const [coachReadingFresh, setCoachReadingFresh] = useState(false); // dot + glow ativo
  const [lastPassPair, setLastPassPair] = useState<[number,number] | null>(null);
  const matchStoryRef = useRef<MatchStory>(createMatchStory());
  const dispatch = useGameDispatch();
  const leaguePointsAppliedRef = useRef(false); // evita aplicar 2x se matchOver mudar
  // Quando true, próximo evento dispara após 3s (gol, bola fora — jogadores
  // "pensam" e se reposicionam). Setado dentro do fireEvent.
  const pendingPauseRef = useRef<number>(0); // ms de pausa até próximo evento (0 = sem pausa)
  // Pausa REAL — fireEvent checa antes de disparar. Usado no intervalo
  // (jogadores ficam parados no campo durante o countdown 3-2-1).
  const pausedRef = useRef(false);
  // Zoom sutil quando vai sair chute — campo "se aproxima" por ~900ms.
  // Só CSS scale do container do campo. Jogadores continuam fixos em % —
  // a regra de ouro é preservada porque é o VIEWPORT que zoom-in, não a
  // câmera de jogo (que não existe).
  const [cameraZoom, setCameraZoom] = useState(false);
  const [showZones, setShowZones] = useState(false);
  // Goleiro reinicia o jogo após wide/save/corner — força próximo evento
  // ser o GK do time que defendeu/tomou bola decidindo distribuição.
  const goalkeeperRestartRef = useRef<{ team: 'home' | 'away' } | null>(null);
  // Primeiro evento da partida é SEMPRE kickoff: HOME atacante → meio-campo.
  // Identidade da bola sair pelo centro do campo, não roleta.
  const kickoffPendingRef = useRef(true);
  /** Time que faz o próximo kickoff (quem sofreu gol ou início de tempo). */
  const kickoffTeamRef = useRef<'home' | 'away'>('home');
  const [stats, setStats] = useState<MatchStats>({
    possession:    { home: 50, away: 50 },
    shots:         { home: 0,  away: 0  },
    shotsOnTarget: { home: 0,  away: 0  },
    passes:        { home: 0,  away: 0  },
    fouls:         { home: 0,  away: 0  },
    corners:       { home: 0,  away: 0  },
  });
  const [possession, setPossession] = useState<'home' | 'away'>('home');
  const [passStyle, setPassStyle] = useState<import('@/engine/classic/types').PassStyle>('TIKTAK');
  const [skills, setSkills]   = useState<SkillEntry[]>(SKILLS_INIT);

  // Refs pra estado quente lido pelo fireEvent — evita que o useCallback
  // rebuilde a cada tick do clock (minute), o que clobberava o setTimeout.
  const runningRef = useRef(running);
  const minuteRef = useRef(minute);
  const scoreRef = useRef(score);
  const possessionRef = useRef(possession);
  const skillsRef = useRef(skills);
  const passStyleRef = useRef(passStyle);
  const statsRef = useRef(stats);
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { minuteRef.current = minute; }, [minute]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { possessionRef.current = possession; }, [possession]);
  useEffect(() => { skillsRef.current = skills; }, [skills]);
  useEffect(() => { passStyleRef.current = passStyle; }, [passStyle]);
  useEffect(() => { statsRef.current = stats; }, [stats]);
  const [highlightPlayer, setHighlightPlayer] = useState<ClassicPlayer | null>(null);
  const [coachModal, setCoachModal]     = useState(false);
  const [formationModal, setFormationModal] = useState(false);
  const [activeFormation, setActiveFormation] = useState<FormationId>('4-3-3');
  const [repositioning, setRepositioning] = useState(false);
  const [legacyPulse, setLegacyPulse] = useState<{ key: number; player: ClassicPlayer } | null>(null);
  const [goalFlash, setGoalFlash]   = useState(false);
  const [goalOverlay, setGoalOverlay] = useState<{ type: 'goal' | 'wide' | 'save'; playerName: string } | null>(null);
  const [dangerFlash, setDangerFlash] = useState(false);
  // Overlay de intervalo/início de 2º tempo
  const [periodOverlay, setPeriodOverlay] = useState<{ label: string; sub: string; countdown?: number } | null>(null);
  // Último gatilho tático — exibido brevemente no campo
  const [lastTacticalTrigger, setLastTacticalTrigger] = useState<import('@/engine/classic/types').TacticalTrigger>(null);
  const [lastSkillActivated, setLastSkillActivated] = useState<string | null>(null);
  const [timelineSlots, setTimelineSlots] = useState<MatchEvent[]>([]);
  const chainRef    = useRef<EventChainContext | null>(null);
  const sequenceRef = useRef<{ zones: string[]; index: number } | null>(null);

  // ── Shot Sequence State Machine ────────────────────────────────────────────
  // Fases: idle → shot_flight → shot_slowmo → shot_resolved → idle
  // Resultado só aparece DEPOIS do chute visualmente completar.
  type ShotSequencePhase = 'idle' | 'shot_flight' | 'shot_slowmo' | 'shot_resolved';
  const [shotSequencePhase, setShotSequencePhase] = useState<ShotSequencePhase>('idle');
  const shotSequenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shotSequencePhaseRef = useRef<ShotSequencePhase>('idle');
  useEffect(() => { shotSequencePhaseRef.current = shotSequencePhase; }, [shotSequencePhase]);

  // ── Canvas / animation refs ────────────────────────────────────────────────
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const miniCanvasRef = useRef<HTMLCanvasElement>(null);
  const ballDivRef    = useRef<HTMLDivElement>(null);
  const ballRef    = useRef<BallState>({ x: 300, y: 200, targetX: 300, targetY: 200 });
  const trailRef   = useRef<TrailPoint[]>([]);
  const heatRef    = useRef(new HeatmapEngine());
  const rafRef     = useRef<number>(0);
  const loopRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clockRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Ball Carrier: quem tem a bola agora ────────────────────────────────────
  const carrierIdRef = useRef<number | null>(null);
  /** Quando a bola está em trânsito (pass/cross), não seguir o carrier até chegar. */
  const ballInTransitRef = useRef(false);

  // ── Agent Base Positions (âncora da formação) ───────────────────────────────
  const basePositionsRef = useRef<Map<number, { x: number; y: number }> | null>(null);

  // ── Movement Loop: agentes se movem continuamente a 15fps ──────────────────
  const agentLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenRefsMap = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!running || matchOver) return;

    // Inicializa base positions na primeira vez
    if (!basePositionsRef.current) {
      basePositionsRef.current = extractBasePositions(players);
      // Carrier inicial: striker do home (quem faz o kickoff)
      const striker = players.find(p => p.team === 'home' && p.role === 'ST')
        ?? players.find(p => p.team === 'home' && p.role === 'CM');
      if (striker) carrierIdRef.current = striker.id;
    }

    agentLoopRef.current = setInterval(() => {
      setPlayers(prev => {
        const base = basePositionsRef.current;
        if (!base) return prev;

        const moved = tickAllAgents(prev, {
          ball: { x: ballRef.current.targetX, y: ballRef.current.targetY },
          possession: possessionRef.current,
          minute: minuteRef.current,
          carrierId: carrierIdRef.current,
        }, base);

        // Bola segue o portador entre eventos (não durante passes em trânsito)
        if (!ballInTransitRef.current) {
          const carrier = carrierIdRef.current != null
            ? moved.find(p => p.id === carrierIdRef.current)
            : null;
          if (carrier) {
            ballRef.current.targetX = carrier.position.x;
            ballRef.current.targetY = carrier.position.y;
          }
        }

        return moved;
      });
    }, 66); // ~15fps

    return () => {
      if (agentLoopRef.current) clearInterval(agentLoopRef.current);
    };
  }, [running, matchOver]);

  // Modulação do passe — lerp factor + arco do cruzamento
  // curto=0.12, rapido=0.22, planejado=0.10, cruzamento=0.10 com Y-arc
  const passAnimRef = useRef<{
    kind: 'curto' | 'rapido' | 'planejado' | 'cruzamento' | 'shot' | 'default';
    startX: number;
    startY: number;
    startedAt: number;
    durationEst: number;
  }>({ kind: 'default', startX: 300, startY: 200, startedAt: 0, durationEst: 600 });

  // Fase tática de cada time — usado pro micro-movimento do bloco
  const [homePhase, setHomePhase] = useState<'BUILDUP'|'CONSOLIDATION'|'ATTACKING'|'DEFENDING'|'TRANSITION'>('CONSOLIDATION');
  const [awayPhase, setAwayPhase] = useState<'BUILDUP'|'CONSOLIDATION'|'ATTACKING'|'DEFENDING'|'TRANSITION'>('CONSOLIDATION');

  // ── Clock: 1 real second = 1 match minute ─────────────────────────────────
  useEffect(() => {
    if (!running || matchOver) return;
    clockRef.current = setInterval(() => {
      setMinute(m => {
        const next = m + 1;

        // Transições de período
        if (next === HALF1_END + 1) {
          setPeriod('INTERVALO');
          setExtraMinute(0);
          // Pausa real: jogo congela, jogadores voltam às posições.
          pausedRef.current = true;
          // Jogadores voltam para formação no intervalo
          const base = basePositionsRef.current;
          if (base) {
            setPlayers(prev => resetPlayersToBase(prev, base));
          }
          ballRef.current.targetX = FIELD_W_LOGIC / 2;
          ballRef.current.targetY = FIELD_H_LOGIC / 2;
          ballRef.current.x = FIELD_W_LOGIC / 2;
          ballRef.current.y = FIELD_H_LOGIC / 2;
          carrierIdRef.current = null;
          ballInTransitRef.current = false;
          setPeriodOverlay({ label: 'INTERVALO', sub: '2º TEMPO EM 3', countdown: 3 });
          // Countdown 3, 2, 1 — atualiza o overlay
          let cd = 3;
          const tick = setInterval(() => {
            cd -= 1;
            if (cd > 0) setPeriodOverlay({ label: 'INTERVALO', sub: `2º TEMPO EM ${cd}`, countdown: cd });
            else {
              clearInterval(tick);
              setPeriodOverlay(null);
              setPeriod('2º TEMPO');
              kickoffPendingRef.current = true;
              kickoffTeamRef.current = 'away'; // 2º tempo: away faz o kickoff
              pausedRef.current = false;
            }
          }, 1000);
        }
        // (Removido: o setPeriodOverlay 2º TEMPO agora é gerado dentro do
        // tick acima, ao final do countdown. Não precisa mais de trigger
        // separado em HALF1_END + HALF1_EXTRA + 1.)
        // Acréscimos 1º tempo: 46, 47, 48 → exibe 45+1, 45+2, 45+3
        if (next > HALF1_END && next <= HALF1_END + HALF1_EXTRA) {
          setExtraMinute(next - HALF1_END);
        }
        // 2º tempo normal: 49-90 → reseta acréscimos do 1º tempo
        if (next > HALF1_END + HALF1_EXTRA && next <= HALF2_END) {
          setExtraMinute(0);
        }
        // Acréscimos 2º tempo: 91..95 → exibe 90+1..90+5
        if (next > HALF2_END && next <= MATCH_END) {
          setExtraMinute(next - HALF2_END);
          setPeriod('2º TEMPO');
        }
        // Fim da partida
        if (next > MATCH_END) {
          setMatchOver(true);
          setRunning(false);
          // Calcula MVP: jogador home com maior confiança acumulada
          setMvp(prev2 => prev2); // será calculado abaixo via setPlayers snapshot
          return MATCH_END;
        }
        return next;
      });
    }, CLOCK_TICK_MS);
    return () => clearInterval(clockRef.current ?? undefined);
  }, [running, matchOver]);

  // ── MVP + pontos da liga + evolução pós-partida ────────────────────────
  useEffect(() => {
    if (!matchOver) return;
    setPlayers(prev => {
      // MVP = jogador com maior confiança de qualquer time
      const best = [...prev].sort((a, b) => b.confidence - a.confidence)[0];
      setMvp(best ?? null);
      return prev;
    });

    // Evolução pós-partida baseada em eventos (Prioridade 2)
    const result: 'win' | 'draw' | 'loss' =
      score.home > score.away ? 'win' :
      score.home < score.away ? 'loss' : 'draw';

    setPlayers(prev => {
      const gains = computeEventBasedEvolution(matchEventsRef.current, prev, result);
      // Log para debug — visível no DevTools
      if (import.meta.env.DEV && gains.length > 0) {
        console.info('[EVOLUTION] Match result:', result, '| Players evolved:', gains.length);
      }
      return prev; // ganhos são aplicados via reducer (FINALIZE_MATCH)
    });

    // Aplica pontos da liga olefoot (Fase 4) — vitórias 3pt, empate 1pt,
    // derrota 0pt. Manager vê os pontos crescerem nas partidas casuais.
    if (!leaguePointsAppliedRef.current) {
      leaguePointsAppliedRef.current = true;
      dispatch({
        type: 'APPLY_CASUAL_RESULT_TO_LEAGUE',
        result: { scoreHome: score.home, scoreAway: score.away, result },
      });
      // LIGA CLASSIC — placar conta nessa league dedicada (separada do
      // tracking da leagueSeason histórica).
      dispatch({
        type: 'RECORD_LOCAL_LEAGUE_RESULT',
        league: 'classic',
        result,
        goalsFor: score.home,
        goalsAgainst: score.away,
      });
    }
  }, [matchOver, score, dispatch]);

  // ── Skill cooldown ─────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      setSkills(prev => prev.map(s => s.remaining > 0 ? { ...s, remaining: s.remaining - 1 } : { ...s, active: false }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // ── Mini-heatmap ───────────────────────────────────────────────────────────
  // Re-runs quando matchOver flipa de true→false ("Jogar Novamente" recria
  // o canvas). Mesma lógica do rAF abaixo.
  useEffect(() => {
    if (matchOver) return;
    const t = setInterval(() => {
      const mini = miniCanvasRef.current;
      if (!mini) return;
      const mCtx = mini.getContext('2d');
      if (!mCtx) return;
      mCtx.clearRect(0, 0, mini.width, mini.height);
      mCtx.fillStyle = 'rgba(10,20,10,0.85)';
      mCtx.fillRect(0, 0, mini.width, mini.height);
      heatRef.current.renderMini(mCtx, mini.width / FIELD_W_LOGIC, mini.height / FIELD_H_LOGIC);
    }, 3000);
    return () => clearInterval(t);
  }, [matchOver]);

  // ── rAF loop — ball + canvas (NO camera, static field) ────────────────────
  // Quando matchOver flipa true→false ("Jogar Novamente"), o canvas é
  // recriado pelo conditional render. ctx capturado no closure morre. Por
  // isso esse effect depende de matchOver — re-roda pra capturar o NOVO ctx.
  useEffect(() => {
    if (matchOver) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function frame() {
      const ball = ballRef.current;
      const prevX = ball.x, prevY = ball.y;

      // Lerp factor varia por tipo de passe — mais lento para parecer real
      const anim = passAnimRef.current;
      // Distância restante: passes longos desaceleram naturalmente com lerp
      const remaining = Math.hypot(ball.targetX - ball.x, ball.targetY - ball.y);
      // Base lerp por tipo
      const baseLerp = anim.kind === 'rapido'     ? 0.14
                     : anim.kind === 'planejado'  ? 0.06
                     : anim.kind === 'shot'       ? 0.08  // chute lento e dramático
                     : anim.kind === 'cruzamento' ? 0.07
                     : 0.08;
      // Desacelera quando perto (bola "morre" no pé do receptor)
      let lerp = remaining > 100 ? baseLerp : baseLerp * 0.7;
      // Shot sequence slow-mo: bola desacelera durante suspense
      if (shotSequencePhaseRef.current === 'shot_slowmo') {
        lerp *= 0.35;
      } else if (shotSequencePhaseRef.current === 'shot_flight') {
        lerp *= 0.75;
      }

      ball.x += (ball.targetX - ball.x) * lerp;
      ball.y += (ball.targetY - ball.y) * lerp;

      // Arco do cruzamento: aplica offset Y parabólico durante a viagem
      let renderY = ball.y;
      if (anim.kind === 'cruzamento') {
        const totalDx = anim.startX === ball.targetX ? 1 : Math.abs(ball.targetX - anim.startX);
        const traveled = Math.abs(ball.x - anim.startX);
        const t = Math.max(0, Math.min(1, traveled / totalDx)); // 0..1
        const arcHeight = 28; // px de "altura" da parábola
        const arc = -arcHeight * 4 * t * (1 - t); // parábola invertida
        renderY = ball.y + arc;
      }

      if (Math.abs(ball.x - prevX) > 0.5 || Math.abs(ball.y - prevY) > 0.5) {
        trailRef.current.push({ x: prevX, y: prevY, opacity: 0.8 });
        if (trailRef.current.length > TRAIL_MAX) trailRef.current.shift();
      }
      trailRef.current.forEach(p => { p.opacity *= 0.88; });

      ctx.clearRect(0, 0, FIELD_W_LOGIC, FIELD_H_LOGIC);
      drawField(ctx);
      drawBall(ctx, { ...ball, y: renderY }, trailRef.current);

      // Ball div — % do tamanho do campo, atualizado direto via DOM (sem re-render)
      const bd = ballDivRef.current;
      if (bd) {
        const leftPct = (ball.x / FIELD_W_LOGIC) * 100;
        const topPct  = (renderY / FIELD_H_LOGIC) * 100;
        bd.style.left = `${leftPct}%`;
        bd.style.top  = `${topPct}%`;
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [matchOver]);

  // ── Game event loop ────────────────────────────────────────────────────────
  // Lê estado quente via refs — fireEvent é estável (não rebuilda no clock).
  const fireEvent = useCallback(() => {
    if (!runningRef.current) return;
    // Pausado (intervalo, countdown) — reagenda checagem em 1s
    if (pausedRef.current) {
      loopRef.current = setTimeout(fireEvent, 1000);
      return;
    }

    const activeSkills = skillsRef.current
      .filter(s => s.active)
      .map(s => s.id as ManagerSkillId);
    const minute = minuteRef.current;
    const score = scoreRef.current;
    const possession = possessionRef.current;
    const passStyle = passStyleRef.current;

    setPlayers(prev => {
      // ─── KICKOFF: primeiro evento da partida é HOME atacante → meio-campo ─
      // Identidade do início, não roleta. Bola sai do círculo central.
      let result;
      if (kickoffPendingRef.current) {
        kickoffPendingRef.current = false;
        const kickTeam = kickoffTeamRef.current;
        const teamPlayers = prev.filter(p => p.team === kickTeam);
        const striker = teamPlayers.find(p => p.role === 'ST') ?? teamPlayers.find(p => p.role === 'CM') ?? teamPlayers[0];
        const cms = teamPlayers.filter(p => p.role === 'CM' || p.role === 'DM');
        // Pega o CM mais perto do striker — passe natural pra trás
        const receiver = cms.length > 0
          ? cms.slice().sort((a, b) =>
              Math.hypot(a.position.x - striker.position.x, a.position.y - striker.position.y)
              - Math.hypot(b.position.x - striker.position.x, b.position.y - striker.position.y),
            )[0]
          : teamPlayers.find(p => p.role !== 'ST') ?? teamPlayers[1];

        const kickoffEvt: MatchEvent = {
          id: `evt_kickoff_${Date.now()}`,
          minute,
          type: 'pass',
          team: kickTeam,
          playerId: striker.id,
          playerName: striker.shortName,
          archetype: striker.archetype,
          text: `${striker.shortName} dá início — toca para ${receiver.shortName}.`,
          ballX: receiver.position.x,
          ballY: receiver.position.y,
          receiverPlayerId: receiver.id,
          passSubtype: 'curto',
          rationale: `kickoff: ${kickTeam} striker → midfield`,
        };
        result = { event: kickoffEvt, nextSequence: null, receiverId: receiver.id };
      } else if (goalkeeperRestartRef.current) {
        // ─── GOLEIRO REINICIA — após wide/save/corner ──────────────────
        // Goleiro do time que tomou bola decide: chutão pro meio OU sai
        // pelo pé pra um lateral livre. Adversário ATACANTE de minutos
        // anteriores fica posicionado naturalmente (sem mover).
        const restartTeam = goalkeeperRestartRef.current.team;
        goalkeeperRestartRef.current = null;
        const teamPlayers = prev.filter(p => p.team === restartTeam);
        const gk = teamPlayers.find(p => p.role === 'GK') ?? teamPlayers[0];
        const fbs = teamPlayers.filter(p => p.role === 'LB' || p.role === 'RB');
        const cms = teamPlayers.filter(p => p.role === 'CM' || p.role === 'DM');
        // Decisão: 60% sai pelo pé pro FB livre / 40% chutão pro CM
        const goesShort = Math.random() < 0.60 && fbs.length > 0;
        const target = goesShort
          ? fbs[Math.floor(Math.random() * fbs.length)]
          : (cms.find(c => c.role === 'CM') ?? cms[0] ?? teamPlayers[1]);
        const gkText = goesShort
          ? `${gk.shortName} sai pelo pé — toca pro ${target.shortName}`
          : `${gk.shortName} bate o tiro de meta — chutão pro ${target.shortName}`;
        const gkEvt: MatchEvent = {
          id: `evt_gk_${Date.now()}`,
          minute,
          type: 'pass',
          team: restartTeam,
          playerId: gk.id,
          playerName: gk.shortName,
          archetype: gk.archetype,
          text: gkText,
          ballX: target.position.x,
          ballY: target.position.y,
          receiverPlayerId: target.id,
          passSubtype: goesShort ? 'curto' : 'planejado',
          rationale: `gk-restart ${restartTeam}: ${goesShort ? 'short to FB' : 'long to mid'}`,
        };
        result = { event: gkEvt, nextSequence: null, receiverId: target.id };
      } else {
        result = generateEvent(prev, minute, score, possession, {
          activeSkills,
          chain: chainRef.current,
          passStyle,
          sequence: sequenceRef.current ?? undefined,
          narrativeProfiles: homeNarrativeProfiles,
        });
      }

      const { event: evt, nextSequence, receiverId } = result;

      // Avança ou reseta a sequência de jogada
      sequenceRef.current = nextSequence;

      // Atualiza animação da bola conforme o subtipo do passe
      const passKind: 'curto' | 'rapido' | 'planejado' | 'cruzamento' | 'shot' | 'default' =
        (evt.type === 'goal' || evt.type === 'shot' || evt.type === 'save' ||
         evt.type === 'post' || evt.type === 'wide' || evt.type === 'rebound' || evt.type === 'blocked')
          ? 'shot'
        : evt.passSubtype === 'cruzamento' ? 'cruzamento'
        : evt.passSubtype === 'rapido'     ? 'rapido'
        : evt.passSubtype === 'planejado'  ? 'planejado'
        : evt.passSubtype === 'curto'      ? 'curto'
        : 'default';

      passAnimRef.current = {
        kind: passKind,
        startX: ballRef.current.x,
        startY: ballRef.current.y,
        startedAt: Date.now(),
        durationEst: passKind === 'shot' ? 1200 : passKind === 'rapido' ? 350 : passKind === 'planejado' ? 800 : 600,
      };

      ballRef.current.targetX = evt.ballX;
      ballRef.current.targetY = evt.ballY;
      heatRef.current.accumulate(evt.ballX, evt.ballY);

      // Ball carrier: quem tem a bola após este evento
      if (evt.type === 'pass' || evt.type === 'cross') {
        // Bola em trânsito → receptor terá a bola quando chegar
        carrierIdRef.current = receiverId ?? evt.playerId;
        ballInTransitRef.current = true;
        // Libera trânsito após a duração estimada do passe
        const transitMs = passAnimRef.current.durationEst || 600;
        setTimeout(() => { ballInTransitRef.current = false; }, transitMs);
      } else if (evt.type === 'tackle' || evt.type === 'interception' || evt.type === 'duel') {
        carrierIdRef.current = evt.playerId;
        ballInTransitRef.current = false;
      } else if (evt.type === 'shot' || evt.type === 'goal' || evt.type === 'wide' || evt.type === 'post' || evt.type === 'save' || evt.type === 'blocked') {
        carrierIdRef.current = null;
        ballInTransitRef.current = false;
      } else {
        carrierIdRef.current = evt.playerId;
        ballInTransitRef.current = false;
      }

      // Atualiza fases táticas dos times — micro-movimento do bloco
      const ballHolder = prev.find(p => p.id === evt.playerId);
      if (ballHolder) {
        const ballPosForPhase = { x: evt.ballX, y: evt.ballY };
        // Fase é do time DO PORTADOR vs do time adversário
        const homePh = computeTeamPhase('home', ballHolder, ballPosForPhase);
        const awayPh = computeTeamPhase('away', ballHolder, ballPosForPhase);
        setHomePhase(homePh);
        setAwayPhase(awayPh);
      }

      // Em passes, destaca o RECEPTOR (onde a bola vai chegar)
      // Em outros eventos (chute, defesa, etc), destaca o ator principal
      if ((evt.type === 'pass' || evt.type === 'cross') && receiverId) {
        const receiver = prev.find(p => p.id === receiverId);
        if (receiver) setHighlightPlayer(receiver);
      } else {
        const actor = prev.find(p => p.id === evt.playerId);
        if (actor) setHighlightPlayer(actor);
      }

      // Linha de passe: portador → receptor (também pra cruzamento)
      if ((evt.type === 'pass' || evt.type === 'cross') && evt.playerId && receiverId) {
        setLastPassPair([evt.playerId, receiverId]);
      } else {
        setLastPassPair(null);
      }

      // Update chain context
      chainRef.current = {
        lastType: evt.type,
        lastTeam: evt.team,
        chainCount: chainRef.current?.lastTeam === evt.team ? (chainRef.current.chainCount + 1) : 1,
      };

      // Coach ping em situações críticas
      const isCritical = evt.type === 'goal' || evt.type === 'danger' ||
        (evt.type === 'shot' && minute > 75) ||
        (evt.type === 'foul' && minute > 80);
      if (isCritical) {
        setCoachPing(true);
        setTimeout(() => setCoachPing(false), 4000);
      }

      // Posse: time com mais passes tem a bola
      if (evt.type === 'pass' || evt.type === 'cross') {
        setPossession(evt.team);
      } else if (evt.type === 'tackle' || evt.type === 'interception' || evt.type === 'duel') {
        setPossession(evt.team === 'home' ? 'away' : 'home');
      }

      // Gatilho tático — exibe badge breve no campo
      if (evt.tacticalTrigger) {
        setLastTacticalTrigger(evt.tacticalTrigger);
        setTimeout(() => setLastTacticalTrigger(null), 2200);
      }
      // Skill activation — exibe como badge separado
      if (evt.skillActivated && !evt.tacticalTrigger) {
        setLastSkillActivated(evt.skillActivated);
        setTimeout(() => setLastSkillActivated(null), 2200);
      }

      // ─── SHOT SEQUENCE: micro cinematográfico de finalização ─────────────
      // Resultado só aparece DEPOIS do chute. Sequência:
      // shot_flight (300ms) → shot_slowmo (500ms) → shot_resolved (reveal)
      const isShotSequenceEvent = evt.type === 'goal' || evt.type === 'save' ||
        evt.type === 'wide' || evt.type === 'post' || evt.type === 'blocked';

      if (isShotSequenceEvent) {
        // Fase 1: ball flight — bola inicia trajetória
        setShotSequencePhase('shot_flight');
        setCameraZoom(true);
        setDangerFlash(true);

        // Fase 2: slow motion — suspense (após 300ms de voo)
        const slowmoDelay = 300;
        const slowmoDuration = 500;
        const revealDelay = slowmoDelay + slowmoDuration; // 800ms total

        shotSequenceTimerRef.current = setTimeout(() => {
          setShotSequencePhase('shot_slowmo');
        }, slowmoDelay);

        // Fase 3: resolved — revela resultado
        setTimeout(() => {
          setShotSequencePhase('shot_resolved');
          setDangerFlash(false);
          setCameraZoom(false);

          // AGORA atualiza score, feed, timeline, stats
          setStats(s => deriveStatsDelta(evt, s, possessionRef.current));

          if (evt.type === 'goal') {
            setScore(prev2 => ({ ...prev2, [evt.team]: prev2[evt.team] + 1 }));
            setGoalFlash(true);
            setTimeout(() => setGoalFlash(false), 1500);
            setTimeout(() => {
              setGoalOverlay({ type: 'goal', playerName: evt.playerName ?? '' });
              setTimeout(() => setGoalOverlay(null), 3000);
            }, 400); // overlay 400ms após reveal (bola já "entrou")
            setTimeout(() => {
              ballRef.current.targetX = FIELD_W_LOGIC / 2;
              ballRef.current.targetY = FIELD_H_LOGIC / 2;
              carrierIdRef.current = null;
              ballInTransitRef.current = false;
              kickoffPendingRef.current = true;
              kickoffTeamRef.current = evt.team === 'home' ? 'away' : 'home';
              const base = basePositionsRef.current;
              if (base) {
                setPlayers(prev2 => resetPlayersToBase(prev2, base));
              }
            }, 3800);
          }

          if (evt.type === 'wide' || evt.type === 'post') {
            setTimeout(() => {
              setGoalOverlay({ type: 'wide', playerName: evt.playerName ?? '' });
              setTimeout(() => setGoalOverlay(null), 2000);
            }, 400);
          }

          if (evt.type === 'save') {
            setTimeout(() => {
              setGoalOverlay({ type: 'save', playerName: evt.playerName ?? '' });
              setTimeout(() => setGoalOverlay(null), 2000);
            }, 400);
          }

          // Feed e timeline só após resultado revelado
          matchEventsRef.current = [...matchEventsRef.current, evt];
          setLatestEvent(evt);
          setEventFeed(prev2 => [evt, ...prev2].slice(0, FEED_MAX));
          setTimelineSlots(prev2 => addTimelineSlot(prev2, evt));

          // Volta ao idle após reveal
          setTimeout(() => setShotSequencePhase('idle'), 300);
        }, revealDelay);

        // Pausa do próximo evento: inclui tempo da sequência + respiro
        if (evt.type === 'goal') {
          pendingPauseRef.current = revealDelay + 4800; // sequência + festa + kickoff
        } else {
          pendingPauseRef.current = revealDelay + 3200; // sequência + banner + respiro
        }

        // Goleiro reinicia após wide/save/corner
        if (evt.type === 'wide' || evt.type === 'save') {
          const conceding: 'home' | 'away' = evt.team === 'home' ? 'away' : 'home';
          goalkeeperRestartRef.current = { team: conceding };
          setTimeout(() => {
            const gkX = conceding === 'home' ? 40 : FIELD_W_LOGIC - 40;
            ballRef.current.targetX = gkX;
            ballRef.current.targetY = FIELD_H_LOGIC / 2;
            carrierIdRef.current = null;
            ballInTransitRef.current = false;
          }, revealDelay + 800);
        }
      } else {
        // ─── Eventos NÃO-chute: fluxo normal (imediato) ─────────────────────
        if (evt.type === 'danger' || evt.type === 'shot') {
          setDangerFlash(true);
          setTimeout(() => setDangerFlash(false), 800);
        }

        matchEventsRef.current = [...matchEventsRef.current, evt];
        setLatestEvent(evt);
        setEventFeed(prev2 => [evt, ...prev2].slice(0, FEED_MAX));
        setTimelineSlots(prev2 => addTimelineSlot(prev2, evt));

        if (evt.type === 'corner') {
          pendingPauseRef.current = 2000;
          const conceding: 'home' | 'away' = evt.team === 'home' ? 'away' : 'home';
          goalkeeperRestartRef.current = { team: conceding };
          const gkX = conceding === 'home' ? 40 : FIELD_W_LOGIC - 40;
          ballRef.current.targetX = gkX;
          ballRef.current.targetY = FIELD_H_LOGIC / 2;
          carrierIdRef.current = null;
          ballInTransitRef.current = false;
        }

        setStats(s => deriveStatsDelta(evt, s, possessionRef.current));
      }

      // Atualiza memória da partida (Fase 4): cumulativo de gols, virada,
      // pressão sustentada, flank attack, on fire, turnover crítico.
      const updatedPlayers = applyEventToPlayers(prev, evt);
      matchStoryRef.current = updateMatchStory(matchStoryRef.current, evt, updatedPlayers, score);

      // Agentes se movem continuamente via movement loop (15fps).
      // Aqui só atualizamos fatigue/confidence/mental — posição é do loop.
      return updatedPlayers;
    });

    // Intervalo: pausas de 3s pra bola fora / gol / pensar — momentos onde
    // o tempo respira e os jogadores se reposicionam. O resto fluí rápido.
    const inSequence = sequenceRef.current !== null;
    const lastEventRef = sequenceRef.current; // ref state já capturado antes
    let interval: number;
    // Detectamos o tipo do último evento via state já atualizado (escopo do setTimeout)
    const lastTypeForPause = (() => {
      // após bola fora ou gol, força pausa de 3s (goleiro pensando / kickoff)
      // (o "type" desse evento foi setado em setLatestEvent antes deste setTimeout)
      // ref imediato: setLatestEvent é assíncrono mas o valor está no state interno
      return null; // placeholder — abaixo usa pendingPauseRef
    })();

    if (pendingPauseRef.current) {
      interval = pendingPauseRef.current; // pausa dinâmica (ms) até reinício
      pendingPauseRef.current = 0;
    } else if (inSequence) {
      interval = 600 + Math.random() * 500;  // 1200-2000 → 600-1100 (rápido, fluido)
    } else {
      interval = EVENT_INTERVAL_MIN + Math.random() * EVENT_INTERVAL_RANGE;
    }

    loopRef.current = setTimeout(fireEvent, interval);
    void lastEventRef; void lastTypeForPause; // not needed — pendingPauseRef é a fonte
    // Deps vazias — fireEvent é estável (estado quente vem dos refs acima).
    // Garante que o useEffect que faz setTimeout(fireEvent, 1200) NÃO seja
    // re-executado a cada tick do clock (que clobberava o timer).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeNarrativeProfiles]);

  useEffect(() => {
    // 1.2s respiro inicial pro DOM montar e jogadores aparecerem.
    // O primeiro evento é o KICKOFF (HOME atacante → meio) — controlado por
    // kickoffPendingRef.current. Não usar timer maior aqui porque essa effect
    // re-roda quando fireEvent rebuilds e clobbera o timer interno seguinte.
    loopRef.current = setTimeout(fireEvent, 1200);
    return () => clearTimeout(loopRef.current ?? undefined);
  }, [fireEvent]);

  // ─── Coach AI inteligente — leitura tática via Anthropic Haiku ──────────
  // Refs evitam que o setTimeout/setInterval seja cancelado a cada evento.
  // Effect roda 1x quando running muda; lê refs (sempre atualizadas) na hora.
  const snapshotRef = useRef({ homeTeam, awayTeam, score, minute, period, stats, passStyle, skills, players, latestEvent });
  useEffect(() => {
    snapshotRef.current = { homeTeam, awayTeam, score, minute, period, stats, passStyle, skills, players, latestEvent };
  });

  useEffect(() => {
    if (!running || matchOver) return;
    let cancelled = false;

    async function tick() {
      try {
        const { fetchClassicCoachReading } = await import('@/lib/classicCoachClient');
        const snap = snapshotRef.current;
        const homeTeamPlayers = snap.players.filter(p => p.team === 'home');
        const keyPlayers = [...homeTeamPlayers]
          .sort((a, b) => {
            const aS = (a.onFire ? 100 : 0) + (a.isStar ? 80 : 0) + (a.fatigue > 75 ? 60 : 0) +
                       (a.mental?.recentInvolvement ?? 0) * 12 + a.confidence * 0.3;
            const bS = (b.onFire ? 100 : 0) + (b.isStar ? 80 : 0) + (b.fatigue > 75 ? 60 : 0) +
                       (b.mental?.recentInvolvement ?? 0) * 12 + b.confidence * 0.3;
            return bS - aS;
          })
          .slice(0, 4)
          .map(p => ({
            name: p.shortName, role: p.role, archetype: p.archetype, ovr: p.ovr,
            fatigue: Math.round(p.fatigue), confidence: Math.round(p.confidence),
            onFire: p.onFire, isStar: p.isStar,
            mental: deriveMentalState(p, snap.minute), // FSM Light no payload
          }));

        const storyBeats = storyBeatsForCoach(matchStoryRef.current, snap.minute);
        const reading = await fetchClassicCoachReading({
          homeTeam: snap.homeTeam, awayTeam: snap.awayTeam,
          score: snap.score, minute: snap.minute, period: snap.period,
          possession: snap.stats.possession,
          shots: snap.stats.shots,
          shotsOnTarget: snap.stats.shotsOnTarget,
          passStyle: snap.passStyle,
          mentalidade: 'EQUILIBRADO',
          activeSkills: snap.skills.filter(s => s.active).map(s => s.id),
          keyPlayers,
          lastEvent: snap.latestEvent ? {
            type: snap.latestEvent.type,
            playerName: snap.latestEvent.playerName,
            minute: snap.latestEvent.minute,
          } : undefined,
          storyBeats,
        });
        if (cancelled || !reading) return;
        setCoachReading(reading);
        setCoachReadingFresh(true);
        setCoachPing(true);
      } catch (err) {
        // silenciado — fallback é os templates if/else
      }
    }

    // Primeira leitura aos ~12s, depois a cada ~30s
    const first = setTimeout(tick, 12_000);
    const interval = setInterval(tick, 30_000);
    return () => { cancelled = true; clearTimeout(first); clearInterval(interval); };
  }, [running, matchOver]);

  // Feedback visual imediato do coach quando skill é ativada
  const [coachFeedback, setCoachFeedback] = useState<string | null>(null);

  const toggleSkill = useCallback((id: string) => {
    setSkills(prev => prev.map(s => (s.id === id && s.remaining === 0) ? { ...s, active: true, remaining: s.cooldown } : s));
    const reactions: Record<string, string> = {
      counter: 'CONTRA ATAQUE — atacantes em profundidade imediata.',
      press:   'PRESSÃO ALTA — HUNTER e DESTROYER dominam o meio.',
      offens:  'FOCO OFENSIVO — FINISHER e WILD com liberdade total.',
      cross:   'BOLA NA ÁREA — BOX_INVADER no segundo pau.',
    };
    if (reactions[id]) {
      setCoachFeedback(reactions[id]);
      setCoachPing(true);
      setTimeout(() => setCoachFeedback(null), 3500);
    }
  }, []);

  const applyFormation = useCallback((formation: FormationId) => {
    setActiveFormation(formation);
    setFormationModal(false);
    setRepositioning(true);
    setPlayers(prev => {
      const withHome = repositionForFormation(prev, formation, 'home');
      return repositionForFormation(withHome, formation, 'away');
    });
    setTimeout(() => setRepositioning(false), 1200);
  }, []);

  // ── Legacy skill — pulse on highlighted/star player ────────────────────────
  const triggerLegacy = useCallback(() => {
    const target = highlightPlayer ?? players.find(p => p.isStar) ?? players[7];
    if (!target) return;
    setLegacyPulse({ key: Date.now(), player: target });
    // Auto-clean after animation finishes
    setTimeout(() => setLegacyPulse(null), 1400);
  }, [highlightPlayer, players]);

  const FIELD_VIEWPORT_H = 280;
  const star = highlightPlayer ?? players.find(p => p.isStar) ?? players[7];
  // Segundo destaque: jogador com maior confiança que não seja o star
  const secondStar = players
    .filter(p => p.team === 'home' && p.id !== star.id)
    .sort((a, b) => b.confidence - a.confidence)[0] ?? players[8];

  // Energia média do time home (100 - fadiga média)
  const homePlayersForEnergy = players.filter(p => p.team === 'home');
  const avgEnergy = homePlayersForEnergy.length > 0
    ? Math.round(100 - homePlayersForEnergy.reduce((s, p) => s + p.fatigue, 0) / homePlayersForEnergy.length)
    : 100;

  // Foto do jogador real (portraitUrl) com fallback determinístico em pixel-art
  // pros jogadores demo (TIGRES/ALVORADA sem foto associada).
  function playerPhoto(p: ClassicPlayer | undefined, size = 120): string {
    if (p?.portraitUrl)      return p.portraitUrl;
    if (p?.portraitTokenUrl) return p.portraitTokenUrl;
    const seed = encodeURIComponent((p?.name ?? '').toLowerCase().replace(/\s/g, '-'));
    return `https://api.dicebear.com/7.x/pixel-art/svg?seed=${seed}&size=${size}&backgroundColor=1a1a1a`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // Tela de fim de partida
  if (matchOver) {
    const homeWon  = score.home > score.away;
    const awayWon  = score.away > score.home;
    const isDraw   = score.home === score.away;
    const resultLabel = isDraw ? 'EMPATE' : homeWon ? `${homeTeam} VENCE` : `${awayTeam} VENCE`;
    const resultColor = isDraw ? 'var(--c-text-sec)' : homeWon ? 'var(--c-accent)' : 'var(--c-team-away)';
    const mvpPlayer = mvp ?? star;
    const fullMatchEvents = matchEventsRef.current;
    const keyMoment = fullMatchEvents.find(e => e.type === 'goal') ??
      fullMatchEvents.find(e => e.type === 'save' || e.type === 'post' || e.skillActivated) ??
      fullMatchEvents[fullMatchEvents.length - 1] ??
      null;
    const tacticalPattern = passStyle === 'LATERAL' ? 'Amplitude e cruzamentos'
      : passStyle === 'LONGO' ? 'Jogo vertical'
      : passStyle === 'COUNTER' ? 'Transição rápida'
      : 'Circulação curta';

    return (
      <>
        <style>{CSS_VARS}</style>
        <div
          className="classic-mode"
          style={{
            fontFamily: 'var(--cf-body)',
            background: 'var(--c-bg-primary)',
            color: 'var(--c-text-primary)',
            minHeight: '100svh',
            display: 'flex',
            flexDirection: 'column',
            animation: 'c-fadeInDown 0.4s ease',
          }}
        >
          {/* Header resultado */}
          <div style={{ background:'var(--c-bg-surface)', borderBottom:'1px solid var(--c-border)', padding:'20px 18px 16px', textAlign:'center' }}>
            <div style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-text-muted)', letterSpacing:'0.28em', marginBottom:6 }}>
              {competition} · JORNADA {round} · APITO FINAL
            </div>
            {/* Placar final */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16, marginBottom:10 }}>
              <span style={{ ...T_HERO, fontSize:18, color:'var(--c-text-primary)', flex:1, textAlign:'right' }}>{homeTeam}</span>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ ...T_HERO, fontSize:52, color: homeWon ? 'var(--c-accent)' : 'var(--c-text-primary)', lineHeight:1, letterSpacing:'-0.04em' }}>{score.home}</span>
                <span style={{ ...T_BODY, fontSize:22, color:'var(--c-text-muted)' }}>—</span>
                <span style={{ ...T_HERO, fontSize:52, color: awayWon ? 'var(--c-accent)' : 'var(--c-text-primary)', lineHeight:1, letterSpacing:'-0.04em' }}>{score.away}</span>
              </div>
              <span style={{ ...T_HERO, fontSize:18, color:'var(--c-text-primary)', flex:1, textAlign:'left' }}>{awayTeam}</span>
            </div>
            <div style={{ ...T_DISPLAY, fontSize:13, fontWeight:900, color: resultColor, letterSpacing:'0.22em' }}>
              {resultLabel}
            </div>
          </div>

          <div style={{ padding:'14px 18px 0' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                { label:'FINAL SCORE', value:`${score.home} - ${score.away}` },
                { label:'KEY MOMENT', value:keyMoment ? `${keyMoment.minute}' ${keyMoment.text}` : 'Partida sem grande ruptura' },
                { label:'MAN OF THE MATCH', value:mvpPlayer.shortName },
                { label:'TACTICAL PATTERN', value:tacticalPattern },
              ].map(item => (
                <div key={item.label} style={{ background:'var(--c-bg-surface)', border:'1px solid var(--c-border)', borderRadius:6, padding:'10px 12px', minWidth:0 }}>
                  <div style={{ ...T_DISPLAY, fontSize:8, color:'var(--c-accent)', letterSpacing:'0.18em', marginBottom:5 }}>{item.label}</div>
                  <div style={{ ...T_BODY, fontSize:11, color:'var(--c-text-primary)', lineHeight:1.25, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MVP */}
          <div style={{ padding:'18px 18px 0' }}>
            <div style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-accent)', letterSpacing:'0.28em', marginBottom:10 }}>
              MELHOR DA PARTIDA
            </div>
            <div style={{ display:'flex', gap:14, alignItems:'center', background:'var(--c-bg-surface)', border:'1px solid var(--c-border-accent)', borderRadius:8, padding:'14px', marginBottom:14 }}>
              {/* Foto MVP */}
              <div style={{ width:96, height:120, borderRadius:6, overflow:'hidden', flexShrink:0, border:'1px solid var(--c-border-accent)', background:'#000' }}>
                <img
                  src={playerPhoto(mvpPlayer, 240)}
                  alt={mvpPlayer.shortName}
                  loading="lazy"
                  style={{ width:'100%', height:'100%', objectFit:'cover', imageRendering: mvpPlayer.portraitUrl ? 'auto' : 'pixelated' }}
                />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                {/* OVR grande + nome */}
                <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:4 }}>
                  <span style={{ ...T_HERO, fontSize:44, color:'var(--c-accent)', lineHeight:1, letterSpacing:'-0.03em' }}>{mvpPlayer.ovr}</span>
                  <div style={{ display:'flex', flexDirection:'column', gap:2, minWidth:0 }}>
                    <span style={{ ...T_DISPLAY, fontSize:8, color:'var(--c-text-muted)', letterSpacing:'0.22em' }}>OVR</span>
                    <span style={{ ...T_DISPLAY, fontSize:14, fontWeight:900, color:'var(--c-text-primary)', letterSpacing:'0.10em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{mvpPlayer.shortName}</span>
                  </div>
                </div>
                <div style={{ ...T_BODY, fontSize:11, color:'var(--c-text-sec)', marginBottom:10 }}>
                  {mvpPlayer.role} · {mvpPlayer.archetype} · {mvpPlayer.team === 'home' ? homeTeam : awayTeam}
                </div>
                {/* Rating editorial — número GIGANTE em Moret italic */}
                <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                  <span style={{ ...T_HERO, fontSize:48, color:'var(--c-accent)', lineHeight:1, letterSpacing:'-0.03em' }}>
                    {(6.0 + (mvpPlayer.confidence / 100) * 4).toFixed(2)}
                  </span>
                  <span style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-text-muted)', letterSpacing:'0.24em' }}>RATING</span>
                </div>
              </div>
            </div>

            {/* Stats resumo — números grandes e impactantes (Moret italic editorial) */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:1, background:'var(--c-border)', marginBottom:16 }}>
              {[
                { label:'POSSE',    home:`${stats.possession.home}%`, away:`${stats.possession.away}%` },
                { label:'CHUTES',   home:`${stats.shots.home}`,       away:`${stats.shots.away}` },
                { label:'NO ALVO',  home:`${stats.shotsOnTarget.home}`, away:`${stats.shotsOnTarget.away}` },
                { label:'PASSES',   home:`${stats.passes.home}`,      away:`${stats.passes.away}` },
                { label:'FALTAS',   home:`${stats.fouls.home}`,       away:`${stats.fouls.away}` },
                { label:'CANTOS',   home:`${stats.corners.home}`,     away:`${stats.corners.away}` },
              ].map((s, i) => (
                <div key={i} style={{ background:'var(--c-bg-surface)', padding:'14px 14px 16px' }}>
                  <div style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-text-muted)', letterSpacing:'0.24em', marginBottom:8 }}>{s.label}</div>
                  <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:6 }}>
                    <span style={{ ...T_HERO, fontSize:34, color:'var(--c-accent)', lineHeight:1, letterSpacing:'-0.03em' }}>{s.home}</span>
                    <span style={{ ...T_HERO, fontSize:24, color:'var(--c-text-sec)', lineHeight:1, letterSpacing:'-0.02em' }}>{s.away}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Stats individuais — top performers da partida */}
            {(() => {
              const homePlayers2 = players
                .filter(p => p.team === 'home' && p.matchStats)
                .sort((a, b) => (b.matchStats!.goals * 10 + b.matchStats!.shots * 2 + b.matchStats!.passes) -
                                (a.matchStats!.goals * 10 + a.matchStats!.shots * 2 + a.matchStats!.passes))
                .slice(0, 4);
              if (homePlayers2.length === 0) return null;
              return (
                <div style={{ marginBottom:20, padding:'0 18px' }}>
                  <div style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-accent)', letterSpacing:'0.28em', marginBottom:10 }}>
                    DESTAQUES INDIVIDUAIS
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {homePlayers2.map(p => {
                      const ms = p.matchStats!;
                      const rating = (6.0 + (p.confidence / 100) * 4).toFixed(1);
                      return (
                        <div key={p.id} style={{
                          display:'grid', gridTemplateColumns:'28px 1fr auto',
                          alignItems:'center', gap:10,
                          background:'var(--c-bg-surface)',
                          border:'1px solid var(--c-border)',
                          borderRadius:6, padding:'8px 12px',
                        }}>
                          <span style={{ ...T_HERO, fontSize:18, color:'var(--c-accent)', lineHeight:1 }}>{p.number}</span>
                          <div>
                            <div style={{ ...T_DISPLAY, fontSize:10, fontWeight:900, color:'var(--c-text-primary)', letterSpacing:'0.08em' }}>{p.shortName}</div>
                            <div style={{ ...T_BODY, fontSize:10, color:'var(--c-text-muted)', marginTop:2, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                              {ms.goals > 0 && (
                                <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
                                  <GoalIcon size={11} /> {ms.goals}
                                </span>
                              )}
                              {ms.shots > 0 && (
                                <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
                                  <Target size={11} /> {ms.shots}
                                </span>
                              )}
                              <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
                                <ArrowUpRight size={11} /> {ms.passes}
                              </span>
                              {ms.tackles > 0 && (
                                <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
                                  <Swords size={11} /> {ms.tackles}
                                </span>
                              )}
                              {ms.duelsWon > 0 && (
                                <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
                                  <Shield size={11} /> {ms.duelsWon}
                                </span>
                              )}
                              {ms.tikTakCount > 0 && (
                                <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
                                  <Zap size={11} /> {ms.tikTakCount}
                                </span>
                              )}
                            </div>
                          </div>
                          <span style={{ ...T_HERO, fontSize:22, color: p.onFire ? 'var(--c-accent)' : 'var(--c-text-sec)', lineHeight:1 }}>{rating}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* CTAs */}
          <div style={{ marginTop:'auto', padding:'0 18px 32px', display:'flex', flexDirection:'column', gap:10 }}>
            <button
              type="button"
              onClick={() => {
                // Reset completo
                setScore({ home:0, away:0 });
                setMinute(0);
                setExtraMinute(0);
                setPeriod('1º TEMPO');
                setMatchOver(false);
                setMvp(null);
                setRunning(true);
                setPlayers([...getHomePlayers(), ...getAwayPlayers()].map(p => ({ ...p, matchStats: emptyPlayerMatchStats() })));
                setEventFeed([]);
                matchEventsRef.current = [];
                setTimelineSlots([]);
                setLatestEvent(null);
                setStats({ possession:{home:50,away:50}, shots:{home:0,away:0}, shotsOnTarget:{home:0,away:0}, passes:{home:0,away:0}, fouls:{home:0,away:0}, corners:{home:0,away:0} });
                setPossession('home');
                chainRef.current = null;
                sequenceRef.current = null;
                matchStoryRef.current = createMatchStory();
                leaguePointsAppliedRef.current = false;
                kickoffPendingRef.current = true;
                setCoachReading(null);
                setPeriodOverlay(null);
                setLastTacticalTrigger(null);
                // Reset visual state — bola volta ao centro, heatmap zerado,
                // trail limpo. Sem isso o canvas começa estranho na 2ª partida.
                ballRef.current = { x: 300, y: 200, targetX: 300, targetY: 200 };
                trailRef.current = [];
                heatRef.current = new HeatmapEngine();
                passAnimRef.current = { kind: 'default', startX: 300, startY: 200, startedAt: 0, durationEst: 600 };
                pendingPauseRef.current = 0;
              }}
              style={{
                width:'100%', padding:'16px',
                background:'var(--c-accent)', color:'#0D0D0D',
                border:'none', borderRadius:6, cursor:'pointer',
                ...T_DISPLAY, fontSize:13, fontWeight:900, letterSpacing:'0.22em',
              }}
            >
              JOGAR NOVAMENTE
            </button>
            <button
              type="button"
              onClick={onExit}
              style={{
                width:'100%', padding:'16px',
                background:'transparent', color:'var(--c-text-primary)',
                border:'1px solid var(--c-border)', borderRadius:6, cursor:'pointer',
                ...T_DISPLAY, fontSize:13, fontWeight:700, letterSpacing:'0.22em',
              }}
            >
              HOME
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{CSS_VARS}</style>
      <div
        className="classic-mode"
        style={{
          fontFamily: 'var(--cf-body)',
          background: 'var(--c-bg-primary)',
          color: 'var(--c-text-primary)',
          minHeight: '100svh',
          paddingBottom: 64,
          maxWidth: 480,
          margin: '0 auto',
          position: 'relative',
          animation: goalFlash ? 'c-goalFlash 1.5s ease' : undefined,
        }}
      >
        {/* ── [A] Status bar — Classic League + cronômetro dinâmico ────── */}
        <div style={{ height: 24, background: '#0A0A0A', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 14px' }}>
          <span style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-accent)', letterSpacing:'0.24em', display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--c-danger)', display:'inline-block', animation:'c-pulse 1s infinite' }} />
            REC
          </span>
          <span style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-text-sec)', letterSpacing:'0.20em', display:'inline-flex', alignItems:'center', gap:8 }}>
            {competition}
            <span aria-hidden style={{ width:3, height:3, borderRadius:'50%', background:'var(--c-text-muted)' }} />
            <span style={{ color:'var(--c-accent)', fontVariantNumeric:'tabular-nums' }}>
              {extraMinute > 0
                ? `${padTime(extraMinute > HALF1_EXTRA ? HALF2_END : HALF1_END)}+${extraMinute}'`
                : `${padTime(Math.min(minute, period === '2º TEMPO' ? HALF2_END : HALF1_END))}'`}
            </span>
          </span>
          <button
            type="button"
            onClick={onExit}
            aria-label="Sair da partida"
            style={{
              background:'transparent', border:'none', cursor:'pointer',
              ...T_DISPLAY, fontSize:9, color:'var(--c-danger)', letterSpacing:'0.18em',
              display:'flex', alignItems:'center', gap:4, padding:'2px 0',
            }}
          >
            <X size={10} strokeWidth={2.5} /> SAIR DA PARTIDA
          </button>
        </div>

        {/* ── [B] Top bar — BRASÃO · SCORE · CLOCK · SCORE · BRASÃO ────── */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 18px', gap:8,
          background:'linear-gradient(180deg,#111 0%,#0D0D0D 100%)',
          borderBottom:'1px solid var(--c-border)',
          minHeight:130,
        }}>
          {/* HOME crest + initials */}
          <ClubCrest
            color="var(--c-team-home)"
            initials={homeShort}
            crestUrl={config?.homeCrestUrl}
            size={62}
          />

          {/* Score HOME — Moret italic amarelo */}
          <span style={{ ...T_HERO, fontSize:54, color:'var(--c-accent)', lineHeight:1, letterSpacing:'-0.04em', minWidth:36, textAlign:'center' }}>
            {score.home}
          </span>

          {/* Center — cronômetro em AGENCY + jornada/período */}
          <div style={{ textAlign:'center', flex:'0 1 auto', minWidth:88 }}>
            <div style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-text-sec)', letterSpacing:'0.22em', marginBottom:3 }}>
              JORNADA {round}
            </div>
            <div style={{
              ...T_DISPLAY,
              fontSize:34, fontWeight:900,
              color: extraMinute > 0 || minute >= 85 ? 'var(--c-danger)' : 'var(--c-text-primary)',
              lineHeight:1, letterSpacing:'0.04em',
              transition:'color 0.5s',
              fontVariantNumeric:'tabular-nums',
            }}>
              {extraMinute > 0
                ? <>{padTime(extraMinute > HALF1_EXTRA ? HALF2_END : HALF1_END)}<span style={{ fontSize:18, opacity:0.7 }}>+{extraMinute}</span></>
                : <>{padTime(Math.min(minute, period === '2º TEMPO' ? HALF2_END : HALF1_END))}<span style={{ fontSize:18, opacity:0.6, marginLeft:1 }}>'</span></>
              }
            </div>
            <div style={{ display:'inline-block', ...T_DISPLAY, fontSize:9, fontWeight:700, color:'var(--c-text-primary)', borderBottom:'2px solid var(--c-accent)', paddingBottom:2, marginTop:5, letterSpacing:'0.18em' }}>
              {period}
            </div>
          </div>

          {/* Score AWAY — Moret italic amarelo */}
          <span style={{ ...T_HERO, fontSize:54, color:'var(--c-accent)', lineHeight:1, letterSpacing:'-0.04em', minWidth:36, textAlign:'center' }}>
            {score.away}
          </span>

          {/* AWAY crest + initials */}
          <ClubCrest
            color="var(--c-team-away)"
            initials={awayShort}
            crestUrl={config?.awayCrestUrl}
            size={62}
          />
        </div>

        {/* ── [C] Campo tático estático ──────────────────────────────────
            REGRA DE OURO: 22 jogadores fixos em % do campo, sempre visíveis. */}
        <div style={{
          width:'100%',
          aspectRatio: `${FIELD_W_LOGIC} / ${FIELD_H_LOGIC}`,
          maxHeight: FIELD_VIEWPORT_H,
          overflow:'hidden',
          position:'relative',
          background:'var(--c-bg-field)',
          borderTop:'1px solid var(--c-border-accent)',
          borderBottom:'1px solid var(--c-border-accent)',
          animation: dangerFlash ? 'c-dangerPulse 0.8s ease' : undefined,
          // Zoom sutil quando há chute — viewport se aproxima por ~900ms.
          // Jogadores em % seguem fixos relativos ao container.
          // Shot sequence: zoom progressivo durante voo e slow-mo
          transform: shotSequencePhase === 'shot_slowmo' ? 'scale(1.07)'
            : shotSequencePhase === 'shot_flight' ? 'scale(1.04)'
            : cameraZoom ? 'scale(1.05)'
            : 'scale(1)',
          transition: shotSequencePhase === 'shot_slowmo'
            ? 'transform 0.5s cubic-bezier(0.16,1,0.3,1)'
            : 'transform 0.4s cubic-bezier(0.32,0,0.32,1)',
          transformOrigin: 'center',
        }}>
          {/* Canvas estático */}
          <canvas
            ref={canvasRef}
            width={FIELD_W_LOGIC}
            height={FIELD_H_LOGIC}
            style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', display:'block' }}
          />

          {/* Shot sequence vignette — suspense visual durante finalização */}
          {shotSequencePhase !== 'idle' && (
            <div style={{
              position:'absolute', top:0, left:0, width:'100%', height:'100%',
              pointerEvents:'none', zIndex:50,
              background: shotSequencePhase === 'shot_slowmo'
                ? 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.35) 100%)'
                : 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.18) 100%)',
              animation: 'c-shot-vignette 0.8s ease forwards',
              transition: 'background 0.3s ease',
            }} />
          )}

          {/* Zone overlay — ZD / ZC / ZA com % de gol */}
          {showZones && (
            <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:1 }}>
              {/* ZD — Defensive Zone (0-40%) */}
              <div style={{ position:'absolute', left:'0%', top:0, width:'40%', height:'100%', background:'rgba(59,130,246,0.12)', borderRight:'1px dashed rgba(59,130,246,0.4)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:11, fontWeight:800, color:'rgba(59,130,246,0.7)', letterSpacing:'0.1em' }}>ZD</span>
              </div>
              {/* ZC — Creative Zone (40-70%) */}
              <div style={{ position:'absolute', left:'40%', top:0, width:'30%', height:'100%', background:'rgba(253,225,0,0.08)', borderRight:'1px dashed rgba(253,225,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:11, fontWeight:800, color:'rgba(253,225,0,0.6)', letterSpacing:'0.1em' }}>ZC</span>
              </div>
              {/* ZA — Attack Zone (70-100%) com % de gol */}
              <div style={{ position:'absolute', left:'70%', top:0, width:'30%', height:'100%', background:'rgba(239,68,68,0.10)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2 }}>
                <span style={{ fontSize:11, fontWeight:800, color:'rgba(239,68,68,0.7)', letterSpacing:'0.1em' }}>ZA</span>
                <span style={{ fontSize:9, fontWeight:700, color:'rgba(239,68,68,0.55)' }}>GOL 12-35%</span>
              </div>
            </div>
          )}

          {/* Toggle zonas */}
          <button
            onClick={() => setShowZones(z => !z)}
            style={{
              position:'absolute', top:4, right:4, zIndex:10,
              background: showZones ? 'rgba(253,225,0,0.9)' : 'rgba(0,0,0,0.5)',
              color: showZones ? '#000' : '#fff',
              border:'none', borderRadius:4, padding:'2px 6px',
              fontSize:9, fontWeight:700, cursor:'pointer', letterSpacing:'0.05em',
            }}
          >
            {showZones ? 'ZONES ✓' : 'ZONES'}
          </button>

          {/* Connection lines — pass pair + coverage links */}
          <svg
            aria-hidden
            style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:1 }}
            viewBox={`0 0 ${FIELD_W_LOGIC} ${FIELD_H_LOGIC}`}
            preserveAspectRatio="none"
          >
            {/* Pass connection: linha amarela tracejada com flow visível */}
            {lastPassPair && (() => {
              const a = players.find(p => p.id === lastPassPair[0]);
              const b = players.find(p => p.id === lastPassPair[1]);
              if (!a || !b) return null;
              return (
                <line
                  key={`pass-${lastPassPair[0]}-${lastPassPair[1]}`}
                  x1={a.position.x} y1={a.position.y}
                  x2={b.position.x} y2={b.position.y}
                  stroke="rgba(253,225,0,0.85)"
                  strokeWidth="1.4"
                  strokeDasharray="6 4"
                  style={{ animation:'c-pass-line 1.2s ease-out forwards' }}
                />
              );
            })()}
            {/* Coverage links: CB↔CB and DM↔nearby defenders — always visible, very faint */}
            {players
              .filter(p => p.role === 'CB' || p.role === 'DM')
              .map(p => {
                const teammates = players.filter(t =>
                  t.team === p.team && t.id !== p.id &&
                  (t.role === 'CB' || t.role === 'DM' || t.role === 'LB' || t.role === 'RB')
                );
                return teammates.map(t => {
                  const dist = Math.hypot(p.position.x - t.position.x, p.position.y - t.position.y);
                  if (dist > 160) return null;
                  return (
                    <line
                      key={`cov-${p.id}-${t.id}`}
                      x1={p.position.x} y1={p.position.y}
                      x2={t.position.x} y2={t.position.y}
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="0.8"
                    />
                  );
                });
              })}
          </svg>

          {/* Player nodes — posição-base FIXA, mas cada zona do time se desloca
              gradualmente seguindo a posse e a posição da bola. Atacando avança,
              defendendo recua. Movimento sutil, sempre baseado em quem tem a bola. */}
          {players.map(p => {
            // Agentes autônomos controlam posição — playerShift desabilitado
            const leftPct = (p.position.x / FIELD_W_LOGIC) * 100;
            const topPct  = (p.position.y / FIELD_H_LOGIC) * 100;
            const isHL = highlightPlayer?.id === p.id;
            const isLegacyTarget = legacyPulse?.player.id === p.id;
            const NODE = 26;
            const isExhausted = p.fatigue > 82;
            const isHot = !!p.onFire;
            const isStarPlayer = !!p.isStar;
            // FSM Light: estado mental derivado — aura sutil no campo
            const mentalState = deriveMentalState(p, minute);
            const isEngaged = mentalState === 'engaged';
            const isAnxious = mentalState === 'anxious';
            const isAware   = mentalState === 'aware';

            // Borda: prioridade exhausted > onFire > anxious > engaged > HL > base
            const borderColor = isExhausted
              ? 'rgba(239,68,68,0.60)'
              : isHot
              ? 'rgba(253,225,0,0.95)'
              : isAnxious
              ? 'rgba(239,68,68,0.45)'                // vermelho sutil — pressionado
              : isEngaged
              ? 'rgba(253,225,0,0.55)'                // amarelo médio — no jogo
              : isHL
              ? 'rgba(255,255,255,0.85)'
              : isAware
              ? 'rgba(255,255,255,0.55)'
              : 'rgba(255,255,255,0.35)';

            // Cores do time: HOME = amarelo sólido / AWAY = preto sólido
            const isHome = p.team === 'home';
            const bgColor = isHome ? '#FDE100' : '#0A0A0A';
            const numberColor = isHome ? '#0A0A0A' : '#FFFFFF';

            const shadow = isHL && !isLegacyTarget && !isHot
              ? '0 0 0 1.5px rgba(255,255,255,0.4)'
              : isEngaged
              ? '0 0 8px rgba(253,225,0,0.30)'
              : '0 1px 3px rgba(0,0,0,0.6)';

            return (
              <div key={p.id} style={{
                position:'absolute',
                left: `${leftPct}%`, top: `${topPct}%`,
                transform: 'translate(-50%,-50%)',
                width: NODE, height: NODE,
                borderRadius:'50%',
                border: `1.5px solid ${borderColor}`,
                background: bgColor,
                color: numberColor,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'var(--cf-body)', fontSize:10, fontWeight:800,
                pointerEvents:'none',
                // Movimento contínuo via agent loop (15fps) — sem transition em left/top
                transition: 'border-color 0.3s ease, background 0.3s ease',
                animation: isLegacyTarget
                  ? 'c-legacyCore 1.2s ease'
                  : isHot
                  ? 'c-confidence-aura 1.8s ease-in-out infinite'
                  : isExhausted
                  ? 'c-fatigue-pulse 1.4s ease infinite'
                  : repositioning
                  ? 'c-reposition 0.6s ease'
                  : undefined,
                boxShadow: shadow,
                opacity: p.fatigue > 85 ? 0.7 : 1,
                zIndex: isLegacyTarget ? 6 : isHL ? 5 : 2,
              }}>
                {/* Número do jogador */}
                <div style={{
                  width: 16, height: 16,
                  borderRadius:'50%',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize: 9, fontWeight: 800,
                  color: numberColor,
                  lineHeight: 1,
                }}>
                  {p.number}
                </div>
                <span style={{
                  position:'absolute',
                  top:'calc(100% + 2px)',
                  left:'50%',
                  transform:'translateX(-50%)',
                  fontFamily:'var(--cf-body)',
                  fontSize:8, fontWeight:600,
                  color: isHL ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.40)',
                  whiteSpace:'nowrap',
                  textShadow:'0 1px 3px rgba(0,0,0,0.95)',
                  letterSpacing:'0.04em',
                }}>
                  {p.shortName.split(' ')[0]}
                </span>
              </div>
            );
          })}

          {/* Bola — div absoluto, sempre acima dos tokens */}
          <div
            ref={ballDivRef}
            aria-hidden
            style={{
              position:'absolute',
              left:'50%', top:'50%',
              width:14, height:14,
              transform:'translate(-50%,-50%)',
              borderRadius:'50%',
              background:'#FFFFFF',
              boxShadow:'0 0 8px rgba(255,255,255,0.95), 0 0 16px rgba(255,255,255,0.6), 0 1px 2px rgba(0,0,0,0.5)',
              pointerEvents:'none',
              zIndex: 9,
              willChange:'left, top',
            }}
          />

          {/* Legacy radial pulse */}
          {legacyPulse && (() => {
            const p = legacyPulse.player;
            const leftPct = (p.position.x / FIELD_W_LOGIC) * 100;
            const topPct  = (p.position.y / FIELD_H_LOGIC) * 100;
            return (
              <div
                key={legacyPulse.key}
                aria-hidden
                style={{
                  position:'absolute',
                  left:`${leftPct}%`, top:`${topPct}%`,
                  width:60, height:60, borderRadius:'50%',
                  border:'2px solid rgba(253,225,0,0.85)',
                  background:'radial-gradient(circle, rgba(253,225,0,0.35) 0%, rgba(253,225,0,0) 70%)',
                  pointerEvents:'none',
                  animation:'c-legacyRadius 1.4s ease-out forwards',
                  zIndex: 4,
                }}
              />
            );
          })()}

          {/* Highlight balloon */}
          {highlightPlayer && (
            <div style={{
              position:'absolute',
              left: `${(highlightPlayer.position.x / FIELD_W_LOGIC) * 100}%`,
              top:  `${(highlightPlayer.position.y / FIELD_H_LOGIC) * 100}%`,
              transform: 'translate(-50%, calc(-100% - 24px))',
              background:'rgba(0,0,0,0.88)',
              border:'1px solid var(--c-accent)',
              borderRadius:4,
              padding:'3px 8px',
              ...T_DISPLAY,
              fontSize:10, color:'var(--c-accent)',
              whiteSpace:'nowrap', pointerEvents:'none',
              zIndex:7, letterSpacing:'0.12em',
              display:'flex', alignItems:'center', gap:5,
            }}>
              {highlightPlayer.number} {highlightPlayer.shortName}
              {highlightPlayer.isStar && <Star size={9} fill="currentColor" />}
              <ChevronDown size={11} style={{ position:'absolute', bottom:-10, left:'50%', transform:'translateX(-50%)', color:'var(--c-accent)' }} />
            </div>
          )}

          {/* Badge de gatilho tático — aparece brevemente no campo */}
          {lastTacticalTrigger && (() => {
            const labels: Record<string, string> = {
              tiktak: 'TIK-TAK',
              long_ball: 'BOLA LONGA',
              false9: 'FALSO 9',
              forced_shot: 'CHUTE!',
              duel_win: 'DUELO GANHO',
            };
            const label = labels[lastTacticalTrigger] ?? lastTacticalTrigger.toUpperCase();
            return (
              <div style={{
                position:'absolute', top:'50%', left:'50%',
                transform:'translate(-50%,-50%)',
                background:'rgba(0,0,0,0.88)',
                border:'1px solid var(--c-accent)',
                borderRadius:4, padding:'4px 12px',
                ...T_DISPLAY, fontSize:11, fontWeight:900,
                color:'var(--c-accent)', letterSpacing:'0.22em',
                whiteSpace:'nowrap', pointerEvents:'none',
                zIndex:8,
                animation:'c-fadeInDown 0.2s ease',
              }}>
                {label}
              </div>
            );
          })()}

          {/* Skill activation badge */}
          {lastSkillActivated && !lastTacticalTrigger && (
            <div style={{
              position:'absolute', top:'50%', left:'50%',
              transform:'translate(-50%,-50%)',
              background:'rgba(20,60,20,0.92)',
              border:'1px solid #4ade80',
              borderRadius:4, padding:'4px 12px',
              ...T_DISPLAY, fontSize:10, fontWeight:800,
              color:'#4ade80', letterSpacing:'0.18em',
              whiteSpace:'nowrap', pointerEvents:'none',
              zIndex:8,
              animation:'c-fadeInDown 0.2s ease',
            }}>
              ⚡ {lastSkillActivated.toUpperCase()}
            </div>
          )}

          {/* Overlay de período — intervalo e início do 2º tempo */}
          {periodOverlay && (
            <div style={{
              position:'absolute', inset:0,
              background:'rgba(0,0,0,0.82)',
              display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center',
              gap:6, zIndex:10,
              animation:'c-fadeInDown 0.3s ease',
            }}>
              <div style={{ ...T_DISPLAY, fontSize:22, fontWeight:900, color:'var(--c-accent)', letterSpacing:'0.28em' }}>
                {periodOverlay.label}
              </div>
              <div style={{ ...T_BODY, fontSize:12, color:'var(--c-text-sec)' }}>
                {periodOverlay.sub}
              </div>
              {/* Counter grande quando há countdown */}
              {typeof periodOverlay.countdown === 'number' && (
                <div style={{ ...T_HERO, fontStyle:'italic', fontSize:64, fontWeight:700, color:'var(--c-accent)', lineHeight:1, letterSpacing:'-0.04em', marginTop:8, animation:'c-fadeInDown 0.3s ease' }}>
                  {periodOverlay.countdown}
                </div>
              )}
              <div style={{ display:'flex', gap:16, marginTop:4 }}>
                <span style={{ ...T_HERO, fontSize:32, color:'var(--c-text-primary)', letterSpacing:'-0.04em' }}>
                  {score.home} — {score.away}
                </span>
              </div>
            </div>
          )}

          {/* Overlay GOL / PRA FORA / DEFENDEU */}
          {goalOverlay && (
            <div style={{
              position:'absolute', inset:0,
              background: goalOverlay.type === 'goal' ? '#0A0A0A'
                        : goalOverlay.type === 'save' ? '#1a5c1a'
                        : '#FDE100',
              display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center',
              gap:8, zIndex:12,
              animation:'c-fadeInDown 0.3s ease',
            }}>
              {goalOverlay.type === 'goal' ? (
                <>
                  <div style={{ ...T_HERO, fontSize:48, fontWeight:900, fontStyle:'italic', color:'#FDE100', letterSpacing:'-0.02em', lineHeight:1, textTransform:'uppercase' }}>
                    GOOOOL!
                  </div>
                  <div style={{ ...T_DISPLAY, fontSize:16, fontWeight:700, color:'#fff', letterSpacing:'0.12em', marginTop:4 }}>
                    {goalOverlay.playerName}
                  </div>
                </>
              ) : goalOverlay.type === 'save' ? (
                <>
                  <div style={{ ...T_HERO, fontSize:38, fontWeight:900, fontStyle:'italic', color:'#fff', letterSpacing:'-0.02em', lineHeight:1, textTransform:'uppercase' }}>
                    DEFENDEU!
                  </div>
                  <div style={{ ...T_DISPLAY, fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.7)', letterSpacing:'0.1em', marginTop:2 }}>
                    {goalOverlay.playerName}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ ...T_HERO, fontSize:38, fontWeight:900, fontStyle:'italic', color:'#0A0A0A', letterSpacing:'-0.02em', lineHeight:1, textTransform:'uppercase' }}>
                    PRA FORAAAA!
                  </div>
                  <div style={{ ...T_DISPLAY, fontSize:13, fontWeight:700, color:'rgba(0,0,0,0.6)', letterSpacing:'0.1em', marginTop:2 }}>
                    {goalOverlay.playerName}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Possession timeline bar */}
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:4, background:'var(--c-bg-elevated)' }}>
            <div style={{ height:'100%', background:'var(--c-team-home)', width:`${stats.possession.home}%`, transition:'width 0.8s ease' }} />
          </div>
        </div>

        {/* (Placar expandido removido — score agora vive nos crests laterais)  */}

        {/* ── Coach feedback — reação imediata quando skill é ativada ──── */}
        {coachFeedback && (
          <div style={{
            margin:'8px 12px 0',
            padding:'10px 14px',
            background:'rgba(253,225,0,0.08)',
            border:'1px solid rgba(253,225,0,0.40)',
            borderLeft:'3px solid var(--c-accent)',
            borderRadius:6,
            display:'flex', alignItems:'center', gap:10,
            animation:'c-fadeInDown 0.25s ease',
          }}>
            <Brain size={14} color="var(--c-accent)" />
            <span style={{ ...T_BODY, fontSize:12, color:'var(--c-text-primary)', flex:1 }}>{coachFeedback}</span>
          </div>
        )}

        {/* ── EVENTO ATUAL — narrativa curta do momento ──────────────────── */}
        <div style={{
          padding:'10px 14px',
          background:'#0A0A0A',
          borderBottom:'1px solid var(--c-border)',
          minHeight:38,
          display:'flex', alignItems:'center', gap:8,
          overflow:'hidden',
        }}>
          {latestEvent ? (
            <>
              <span style={{ ...T_DISPLAY, fontSize:11, fontWeight:900, color:'var(--c-accent)', fontVariantNumeric:'tabular-nums', flexShrink:0 }}>
                {latestEvent.minute}'
              </span>
              {latestEvent.skillActivated && (
                <span style={{ ...T_DISPLAY, fontSize:9, fontWeight:800, color:'#4ade80', letterSpacing:'0.10em', flexShrink:0 }}>
                  ⚡
                </span>
              )}
              {formatSkillTag(latestEvent) && (
                <span style={{ ...T_DISPLAY, fontSize:8, fontWeight:900, color:'#4ade80', letterSpacing:'0.08em', flexShrink:0 }}>
                  {formatSkillTag(latestEvent)}
                </span>
              )}
              <span style={{ ...T_BODY, fontSize:12, color:'var(--c-text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:1 }}>
                {latestEvent.text}
              </span>
            </>
          ) : (
            <span style={{ ...T_BODY, fontSize:11, color:'var(--c-text-muted)', fontStyle:'italic' }}>
              Aguardando início...
            </span>
          )}
        </div>

        {/* ── TIMELINE VIVA — barra horizontal com eventos marcados ───────── */}
        <div style={{
          padding:'8px 14px 10px',
          background:'var(--c-bg-primary)',
          borderBottom:'1px solid var(--c-border)',
        }}>
          {/* Barra de progresso do jogo */}
          <div style={{ position:'relative', height:28, display:'flex', alignItems:'center' }}>
            {/* Track */}
            <div style={{ position:'absolute', left:0, right:0, top:'50%', transform:'translateY(-50%)', height:3, background:'var(--c-bg-elevated)', borderRadius:2 }}>
              <div style={{ height:'100%', background:'var(--c-accent)', borderRadius:2, width:`${Math.min(100, (minute / 90) * 100)}%`, transition:'width 1s ease', opacity:0.6 }} />
            </div>
            {/* Marcadores de eventos na timeline */}
            {timelineSlots.length === 0 && (
              <span style={{
                position:'absolute', left:'50%', top:'50%',
                transform:'translate(-50%,-50%)',
                ...T_BODY, fontSize:10, color:'var(--c-text-muted)', fontStyle:'italic',
                whiteSpace:'nowrap',
              }}>
                A partida ainda está se estudando.
              </span>
            )}
            {timelineSlots.map((slot, i) => {
              const pos = Math.min(98, Math.max(2, (slot.minute / 90) * 100));
              const isGoal = slot.type === 'goal';
              const isSave = slot.type === 'save' || slot.type === 'interception';
              const isDanger = slot.type === 'shot' || slot.type === 'wide' || slot.type === 'post';
              const isSkill = !!slot.skillActivated || slot.tacticalTrigger === 'forced_shot' || slot.tacticalTrigger === 'duel_win';
              const dotColor = isGoal ? 'var(--c-accent)' : isSave ? '#22c55e' : isDanger ? '#ef4444' : 'var(--c-text-sec)';
              return (
                <div
                  key={i}
                  style={{
                    position:'absolute', left:`${pos}%`, top:'50%',
                    transform:'translate(-50%,-50%)',
                    width: isGoal ? 18 : 8, height: isGoal ? 18 : 8,
                    borderRadius:'50%',
                    background: isGoal ? 'var(--c-accent)' : dotColor,
                    border: isGoal ? '2px solid #0A0A0A' : 'none',
                    boxShadow: isGoal ? '0 0 12px rgba(253,225,0,0.8), 0 0 4px rgba(253,225,0,0.4)'
                      : isSkill ? '0 0 10px rgba(74,222,128,0.55)'
                      : isSave ? '0 0 8px rgba(34,197,94,0.45)'
                      : undefined,
                    animation: isGoal || isSave || isSkill ? 'c-shot-pulse 1.2s ease' : undefined,
                    zIndex: isGoal ? 3 : 1,
                    transition:'all 0.3s',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}
                  title={`${slot.minute}' — ${slot.type}`}
                >
                  {isGoal && <GoalIcon size={10} color="#0A0A0A" strokeWidth={2.5} />}
                </div>
              );
            })}
            {/* Indicador de minuto atual */}
            <div style={{
              position:'absolute', left:`${Math.min(98, (minute / 90) * 100)}%`, top:'50%',
              transform:'translate(-50%,-50%)',
              width:4, height:16, borderRadius:2,
              background:'var(--c-text-primary)', opacity:0.8,
              transition:'left 1s ease',
            }} />
          </div>
          {/* Labels */}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:2 }}>
            <span style={{ ...T_DISPLAY, fontSize:7, color:'var(--c-text-muted)', letterSpacing:'0.12em' }}>0'</span>
            <span style={{ ...T_DISPLAY, fontSize:7, color:'var(--c-text-muted)', letterSpacing:'0.12em' }}>45'</span>
            <span style={{ ...T_DISPLAY, fontSize:7, color:'var(--c-text-muted)', letterSpacing:'0.12em' }}>90'</span>
          </div>
        </div>

        {/* ── HERO CARDS — Interações Táticas ────────────────────────────── */}
        <div style={{ padding:'12px 12px 8px', display:'flex', flexDirection:'column', gap:10 }}>

          {/* Card 1: MENTALIDADE TÁTICA — controle de postura do time */}
          <div style={{
            background:'var(--c-bg-surface)', border:'1px solid var(--c-border)',
            borderRadius:8, overflow:'hidden',
          }}>
            <div style={{ padding:'10px 14px 8px', borderBottom:'1px solid var(--c-border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-accent)', letterSpacing:'0.22em', fontWeight:900 }}>MENTALIDADE</span>
              <span style={{ ...T_DISPLAY, fontSize:8, color:'var(--c-text-muted)', letterSpacing:'0.14em' }}>
                {passStyle === 'TIKTAK' ? 'TOQUE RÁPIDO' : passStyle === 'LONGO' ? 'DIRETO' : passStyle === 'LATERAL' ? 'AMPLITUDE' : 'CONTRA-ATAQUE'}
              </span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:1, background:'var(--c-border)' }}>
              {PASS_STYLES.map(ps => {
                const isActive = passStyle === ps.id;
                const IconMap: Record<string, React.ReactNode> = {
                  TIKTAK: <Repeat size={18} strokeWidth={1.6} />,
                  LONGO: <ArrowUpRight size={18} strokeWidth={1.6} />,
                  LATERAL: <ChevronRight size={18} strokeWidth={1.6} />,
                  COUNTER: <Zap size={18} strokeWidth={1.6} />,
                };
                return (
                  <button
                    key={ps.id}
                    type="button"
                    onClick={() => { setPassStyle(ps.id); sequenceRef.current = null; }}
                    style={{
                      padding:'14px 8px',
                      background: isActive ? 'rgba(253,225,0,0.10)' : 'var(--c-bg-surface)',
                      border:'none', cursor:'pointer',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                      borderBottom: isActive ? '2px solid var(--c-accent)' : '2px solid transparent',
                      transition:'all 0.15s',
                      color: isActive ? 'var(--c-accent)' : 'var(--c-text-sec)',
                    }}
                  >
                    <span style={{ opacity: isActive ? 1 : 0.5, lineHeight:1 }}>{IconMap[ps.id]}</span>
                    <span style={{ ...T_DISPLAY, fontSize:9, fontWeight:800, color: isActive ? 'var(--c-accent)' : 'var(--c-text-sec)', letterSpacing:'0.10em' }}>
                      {ps.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card 2: SKILLS ATIVAS — habilidades do manager */}
          <div style={{
            background:'var(--c-bg-surface)', border:'1px solid var(--c-border)',
            borderRadius:8, overflow:'hidden',
          }}>
            <div style={{ padding:'10px 14px 8px', borderBottom:'1px solid var(--c-border)' }}>
              <span style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-accent)', letterSpacing:'0.22em', fontWeight:900 }}>HABILIDADES DO COACH</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:1, background:'var(--c-border)' }}>
              {skills.map(sk => {
                const onCooldown = sk.remaining > 0;
                return (
                  <button
                    key={sk.id}
                    type="button"
                    onClick={() => toggleSkill(sk.id)}
                    style={{
                      padding:'12px 8px',
                      background: sk.active ? 'rgba(253,225,0,0.10)' : 'var(--c-bg-surface)',
                      border:'none',
                      cursor: onCooldown ? 'not-allowed' : 'pointer',
                      opacity: onCooldown ? 0.4 : 1,
                      display:'flex', flexDirection:'column', alignItems:'center', gap:5,
                      borderBottom: sk.active ? '2px solid var(--c-accent)' : '2px solid transparent',
                      transition:'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize:16, lineHeight:1, filter: sk.active ? 'drop-shadow(0 0 4px rgba(253,225,0,0.6))' : undefined }}>
                      <SkillIcon icon={sk.icon} />
                    </div>
                    <span style={{ ...T_DISPLAY, fontSize:8, fontWeight:800, color: sk.active ? 'var(--c-accent)' : 'var(--c-text-sec)', letterSpacing:'0.08em', textAlign:'center', lineHeight:1.2 }}>
                      {sk.label}
                    </span>
                    {onCooldown && (
                      <span style={{ ...T_BODY, fontSize:8, color:'var(--c-text-muted)' }}>{sk.remaining}s</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card 3: PAINEL AO VIVO — stats + energia + momentum */}
          <div style={{
            background:'var(--c-bg-surface)', border:'1px solid var(--c-border)',
            borderRadius:8, padding:'12px 14px',
          }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <span style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-accent)', letterSpacing:'0.22em', fontWeight:900 }}>AO VIVO</span>
              <span style={{ ...T_DISPLAY, fontSize:8, color:'var(--c-text-muted)', letterSpacing:'0.14em' }}>
                {stats.possession.home > 58 ? 'DOMINANDO' : stats.possession.home < 42 ? 'SOB PRESSÃO' : 'EQUILIBRADO'}
              </span>
            </div>
            {/* Stats grid */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {/* Posse */}
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ ...T_DISPLAY, fontSize:8, color:'var(--c-text-muted)', letterSpacing:'0.14em' }}>POSSE</span>
                  <span style={{ ...T_DISPLAY, fontSize:10, fontWeight:900, color:'var(--c-text-primary)' }}>{stats.possession.home}%</span>
                </div>
                <div style={{ height:4, background:'var(--c-bg-elevated)', borderRadius:2 }}>
                  <div style={{ height:'100%', background:'var(--c-accent)', borderRadius:2, width:`${stats.possession.home}%`, transition:'width 1s', opacity:0.8 }} />
                </div>
              </div>
              {/* Energia */}
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ ...T_DISPLAY, fontSize:8, color:'var(--c-text-muted)', letterSpacing:'0.14em' }}>ENERGIA</span>
                  <span style={{ ...T_DISPLAY, fontSize:10, fontWeight:900, color: avgEnergy < 40 ? 'var(--c-danger)' : avgEnergy < 60 ? 'var(--c-warning)' : 'var(--c-text-primary)' }}>{avgEnergy}%</span>
                </div>
                <div style={{ height:4, background:'var(--c-bg-elevated)', borderRadius:2 }}>
                  <div style={{ height:'100%', background: avgEnergy < 40 ? 'var(--c-danger)' : avgEnergy < 60 ? 'var(--c-warning)' : 'var(--c-ok)', borderRadius:2, width:`${avgEnergy}%`, transition:'width 1s' }} />
                </div>
              </div>
              {/* Finalizações */}
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ ...T_DISPLAY, fontSize:8, color:'var(--c-text-muted)', letterSpacing:'0.14em' }}>CHUTES</span>
                  <span style={{ ...T_DISPLAY, fontSize:10, fontWeight:900, color:'var(--c-text-primary)' }}>{stats.shots.home} — {stats.shots.away}</span>
                </div>
                <div style={{ height:4, background:'var(--c-bg-elevated)', borderRadius:2 }}>
                  <div style={{ height:'100%', background:'var(--c-team-home)', borderRadius:2, width:`${(stats.shots.home / (stats.shots.home + stats.shots.away || 1)) * 100}%`, transition:'width 1s', opacity:0.7 }} />
                </div>
              </div>
              {/* Passes */}
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ ...T_DISPLAY, fontSize:8, color:'var(--c-text-muted)', letterSpacing:'0.14em' }}>PASSES</span>
                  <span style={{ ...T_DISPLAY, fontSize:10, fontWeight:900, color:'var(--c-text-primary)' }}>{stats.passes.home} — {stats.passes.away}</span>
                </div>
                <div style={{ height:4, background:'var(--c-bg-elevated)', borderRadius:2 }}>
                  <div style={{ height:'100%', background:'var(--c-team-home)', borderRadius:2, width:`${(stats.passes.home / (stats.passes.home + stats.passes.away || 1)) * 100}%`, transition:'width 1s', opacity:0.7 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: AÇÕES RÁPIDAS — botões com efeito real no jogo */}
          <div style={{
            display:'grid', gridTemplateColumns:'1fr 1fr', gap:8,
          }}>
            <button
              type="button"
              onClick={() => { setPassStyle('LONGO'); sequenceRef.current = null; }}
              style={{
                padding:'14px 12px',
                background: passStyle === 'LONGO' ? 'rgba(239,68,68,0.12)' : 'var(--c-bg-surface)',
                border: passStyle === 'LONGO' ? '1px solid #ef4444' : '1px solid var(--c-border)',
                borderRadius:8, cursor:'pointer',
                display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                transition:'all 0.15s',
              }}
            >
              <Swords size={20} color={passStyle === 'LONGO' ? '#ef4444' : 'var(--c-text-sec)'} strokeWidth={1.8} />
              <span style={{ ...T_DISPLAY, fontSize:10, fontWeight:900, color: passStyle === 'LONGO' ? '#ef4444' : 'var(--c-text-primary)', letterSpacing:'0.14em' }}>ATACAR</span>
              <span style={{ ...T_BODY, fontSize:8, color:'var(--c-text-muted)', textAlign:'center' }}>Jogo vertical, bola longa</span>
            </button>
            <button
              type="button"
              onClick={() => { setPassStyle('TIKTAK'); sequenceRef.current = null; }}
              style={{
                padding:'14px 12px',
                background: passStyle === 'TIKTAK' ? 'rgba(253,225,0,0.12)' : 'var(--c-bg-surface)',
                border: passStyle === 'TIKTAK' ? '1px solid var(--c-accent)' : '1px solid var(--c-border)',
                borderRadius:8, cursor:'pointer',
                display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                transition:'all 0.15s',
              }}
            >
              <Zap size={20} color={passStyle === 'TIKTAK' ? 'var(--c-accent)' : 'var(--c-text-sec)'} strokeWidth={1.8} />
              <span style={{ ...T_DISPLAY, fontSize:10, fontWeight:900, color: passStyle === 'TIKTAK' ? 'var(--c-accent)' : 'var(--c-text-primary)', letterSpacing:'0.14em' }}>PRESSIONAR</span>
              <span style={{ ...T_BODY, fontSize:8, color:'var(--c-text-muted)', textAlign:'center' }}>Toque rápido, intensidade</span>
            </button>
            <button
              type="button"
              onClick={() => { setPassStyle('LATERAL'); sequenceRef.current = null; }}
              style={{
                padding:'14px 12px',
                background: passStyle === 'LATERAL' ? 'rgba(59,130,246,0.12)' : 'var(--c-bg-surface)',
                border: passStyle === 'LATERAL' ? '1px solid #3b82f6' : '1px solid var(--c-border)',
                borderRadius:8, cursor:'pointer',
                display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                transition:'all 0.15s',
              }}
            >
              <ChevronRight size={20} color={passStyle === 'LATERAL' ? '#3b82f6' : 'var(--c-text-sec)'} strokeWidth={1.8} />
              <span style={{ ...T_DISPLAY, fontSize:10, fontWeight:900, color: passStyle === 'LATERAL' ? '#3b82f6' : 'var(--c-text-primary)', letterSpacing:'0.14em' }}>AMPLITUDE</span>
              <span style={{ ...T_BODY, fontSize:8, color:'var(--c-text-muted)', textAlign:'center' }}>Jogo pelas alas, cruzamentos</span>
            </button>
            <button
              type="button"
              onClick={() => { setPassStyle('COUNTER'); sequenceRef.current = null; }}
              style={{
                padding:'14px 12px',
                background: passStyle === 'COUNTER' ? 'rgba(34,197,94,0.12)' : 'var(--c-bg-surface)',
                border: passStyle === 'COUNTER' ? '1px solid #22c55e' : '1px solid var(--c-border)',
                borderRadius:8, cursor:'pointer',
                display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                transition:'all 0.15s',
              }}
            >
              <Repeat size={20} color={passStyle === 'COUNTER' ? '#22c55e' : 'var(--c-text-sec)'} strokeWidth={1.8} />
              <span style={{ ...T_DISPLAY, fontSize:10, fontWeight:900, color: passStyle === 'COUNTER' ? '#22c55e' : 'var(--c-text-primary)', letterSpacing:'0.14em' }}>CONTRA</span>
              <span style={{ ...T_BODY, fontSize:8, color:'var(--c-text-muted)', textAlign:'center' }}>Transição rápida, velocidade</span>
            </button>
          </div>

        </div>

        {/* ── [I] Bottom nav — 3 botões: Coach AI · Legacy · Formação ──── */}
        <div style={{
          position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
          width:'100%', maxWidth:480, height:64,
          background:'#000000',
          borderTop:'1px solid var(--c-border-accent)',
          display:'grid', gridTemplateColumns:'1fr 1fr 1fr', zIndex:100,
        }}>
          {[
            { id:'coach',  label:'COACH AI',  Icon: Brain,       onClick: () => { setCoachModal(true); setCoachPing(false); setCoachReadingFresh(false); } },
            { id:'legacy', label:'LEGACY',    Icon: Sparkles,    onClick: triggerLegacy            },
            { id:'form',   label:'FORMAÇÃO', Icon: LayoutGrid,  onClick: () => setFormationModal(true) },
          ].map((tab, idx) => {
            const isCoachAlert = tab.id === 'coach' && coachPing;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={tab.onClick}
                aria-label={isCoachAlert ? `${tab.label} — leitura tática nova` : tab.label}
                style={{
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4,
                  cursor:'pointer', position:'relative', background: isCoachAlert ? 'rgba(253,225,0,0.06)' : 'transparent', border:'none',
                  color: 'var(--c-accent)',
                  borderLeft: idx > 0 ? '1px solid var(--c-border)' : 'none',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{ position:'relative', filter: isCoachAlert ? 'drop-shadow(0 0 6px rgba(253,225,0,0.85))' : undefined, transition:'filter 0.3s' }}>
                  <tab.Icon size={20} strokeWidth={isCoachAlert ? 2.4 : 2} />
                  {isCoachAlert && (
                    <span style={{
                      position:'absolute', top:-4, right:-4,
                      width:10, height:10, borderRadius:'50%',
                      background:'var(--c-accent)',
                      boxShadow:'0 0 0 2px #000, 0 0 12px rgba(253,225,0,0.85)',
                      animation:'c-coach-ping 0.9s ease-in-out infinite',
                      display:'block',
                    }} />
                  )}
                </div>
                <span style={{
                  ...T_DISPLAY, fontSize:9, fontWeight:800, letterSpacing:'0.18em',
                  color:'var(--c-accent)',
                  textShadow: isCoachAlert ? '0 0 6px rgba(253,225,0,0.8)' : undefined,
                }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Coach Modal — leitura tática, sem chat ────────────────────── */}
        {coachModal && (
          <div
            role="dialog" aria-modal="true" aria-labelledby="coach-modal-title"
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:200, display:'flex', flexDirection:'column' }}
            onClick={() => setCoachModal(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                marginTop:'auto',
                background:'var(--c-bg-elevated)',
                borderTop:'3px solid var(--c-accent)',
                borderRadius:'16px 16px 0 0',
                animation:'c-slideUp 0.28s ease-out',
                padding:'18px 18px 28px',
              }}
            >
              {/* Header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Brain size={18} color="var(--c-accent)" />
                  <span id="coach-modal-title" style={{ ...T_DISPLAY, fontSize:12, fontWeight:900, color:'var(--c-accent)', letterSpacing:'0.26em' }}>LEITURA DO JOGO</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCoachModal(false)}
                  aria-label="Fechar"
                  style={{ background:'transparent', border:'1px solid var(--c-border)', color:'var(--c-text-primary)', padding:'4px 8px', borderRadius:4, cursor:'pointer', display:'flex', alignItems:'center', gap:4, ...T_DISPLAY, fontSize:9, letterSpacing:'0.12em' }}
                >
                  <X size={11} /> FECHAR
                </button>
              </div>

              {/* Placar + minuto atual */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16, marginBottom:16, padding:'10px', background:'var(--c-bg-primary)', borderRadius:6 }}>
                <span style={{ ...T_HERO, fontSize:16, color:'var(--c-text-primary)' }}>{homeTeam}</span>
                <span style={{ ...T_HERO, fontSize:36, color:'var(--c-accent)', letterSpacing:'-0.04em' }}>{score.home} — {score.away}</span>
                <span style={{ ...T_HERO, fontSize:16, color:'var(--c-text-primary)' }}>{awayTeam}</span>
              </div>

              {/* ── Leitura inteligente (Anthropic Haiku) — destaque editorial ── */}
              {coachReading && (() => {
                const toneColor = coachReading.tone === 'urgent' || coachReading.tone === 'alert'
                  ? 'var(--c-danger)'
                  : coachReading.tone === 'positive'
                  ? 'var(--c-ok)'
                  : 'var(--c-accent)';
                return (
                  <div style={{
                    background:'linear-gradient(180deg, rgba(253,225,0,0.06) 0%, rgba(253,225,0,0.02) 100%)',
                    border:`1px solid ${toneColor}33`,
                    borderLeft:`3px solid ${toneColor}`,
                    borderRadius:8,
                    padding:'14px 16px',
                    marginBottom:16,
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                      <span style={{ ...T_DISPLAY, fontSize:8, fontWeight:900, color: toneColor, letterSpacing:'0.28em' }}>
                        ANÁLISE · {coachReading.tone.toUpperCase()}
                      </span>
                      <span aria-hidden style={{ flex:1, height:1, background:`${toneColor}33`, marginLeft:6 }} />
                    </div>
                    {/* Headline em Moret italic editorial */}
                    <div style={{
                      ...T_HERO, fontStyle:'italic', fontWeight:700,
                      fontSize:22, color:'var(--c-text-primary)',
                      lineHeight:1.15, letterSpacing:'-0.02em',
                      marginBottom:8,
                    }}>
                      {coachReading.headline}
                    </div>
                    {/* Reading em Inter */}
                    <p style={{
                      ...T_BODY, fontSize:13, color:'var(--c-text-primary)',
                      lineHeight:1.5, margin:0, opacity:0.92,
                    }}>
                      {coachReading.reading}
                    </p>
                    {/* Suggestion como CTA Agency uppercase */}
                    <div style={{
                      marginTop:12, padding:'8px 12px',
                      border:`1px solid ${toneColor}66`,
                      borderRadius:4,
                      background:`${toneColor}0A`,
                      ...T_DISPLAY, fontSize:11, fontWeight:900,
                      color: toneColor, letterSpacing:'0.20em',
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                    }}>
                      <span>{coachReading.suggestion}</span>
                      <span aria-hidden style={{ fontSize:10, opacity:0.7 }}>›</span>
                    </div>
                  </div>
                );
              })()}

              {/* Leituras complementares (templates if/else — fallback sempre presente) */}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {(() => {
                  const homePoss = stats.possession.home;
                  const homeShots = stats.shots.home;
                  const awayShots = stats.shots.away;
                  const homeGoals = score.home;
                  const awayGoals = score.away;
                  const isLosing = homeGoals < awayGoals;
                  const isWinning = homeGoals > awayGoals;
                  const isDraw = homeGoals === awayGoals;
                  const lateGame = minute > 70;
                  const extraTime = extraMinute > 0;

                  const readings: Array<{ icon: string; label: string; text: string; color?: string }> = [];

                  // Posse
                  if (homePoss > 60) {
                    readings.push({ icon:'●', label:'POSSE', text:`${homePoss}% de posse. Domínio claro — usa a bola para esgotar o adversário.` });
                  } else if (homePoss < 40) {
                    readings.push({ icon:'●', label:'POSSE', text:`Só ${homePoss}% de posse. Estás a jogar no limite — considera mudar para COUNTER.`, color:'var(--c-danger)' });
                  } else {
                    readings.push({ icon:'●', label:'POSSE', text:`${homePoss}% de posse. Equilíbrio no meio-campo. Mantém a pressão.` });
                  }

                  // Chutes
                  if (awayShots > homeShots + 3) {
                    readings.push({ icon:'▲', label:'PERIGO', text:`Adversário com ${awayShots} finalizações. Linha defensiva está exposta — fecha o corredor central.`, color:'var(--c-danger)' });
                  } else if (homeShots > awayShots + 3) {
                    readings.push({ icon:'▲', label:'PRESSÃO', text:`${homeShots} finalizações. Estás a dominar a Zona 14 — continua a atacar os half-spaces.`, color:'var(--c-ok)' });
                  }

                  // Resultado + tempo
                  if (isLosing && lateGame) {
                    readings.push({ icon:'!', label:'URGÊNCIA', text:`A perder com ${minute > 80 ? 'menos de 10' : 'menos de 20'} minutos. Muda para TIKTAK e sobe os laterais.`, color:'var(--c-danger)' });
                  } else if (isWinning && lateGame) {
                    readings.push({ icon:'✓', label:'GESTÃO', text:`A vencer. Usa LATERAL para circular e gastar tempo — não arrisques transições.`, color:'var(--c-ok)' });
                  } else if (isDraw && lateGame) {
                    readings.push({ icon:'!', label:'DECISÃO', text:`Empate nos minutos finais. Hora de arriscar — activa FOCO OFENSIVO e vai à Zona 14.` });
                  }

                  // Acréscimos
                  if (extraTime) {
                    readings.push({ icon:'⚡', label:'ACRÉSCIMOS', text:`Estamos nos acréscimos. Cada segundo conta — pressão máxima, sem recuo.`, color:'var(--c-danger)' });
                  }

                  // Tipo de passe activo
                  const psInfo = PASS_STYLES.find(p => p.id === passStyle);
                  if (psInfo) {
                    readings.push({ icon:'→', label:'ESTILO', text:`${psInfo.label} activo: ${psInfo.desc}. ${passStyle === 'TIKTAK' ? 'Aciona mais jogadores antes do chute.' : passStyle === 'COUNTER' ? 'Transição rápida — mantém profundidade.' : passStyle === 'LATERAL' ? 'Usa os corredores para criar superioridade.' : 'Lançamento directo — exige ST forte no hold-up.'}` });
                  }

                  return readings.map((r, i) => (
                    <div key={i} style={{
                      display:'flex', gap:10, alignItems:'flex-start',
                      padding:'10px 12px',
                      background:'var(--c-bg-primary)',
                      border:`1px solid ${r.color ? r.color + '44' : 'var(--c-border)'}`,
                      borderLeft:`3px solid ${r.color ?? 'var(--c-accent)'}`,
                      borderRadius:4,
                    }}>
                      <span style={{ ...T_DISPLAY, fontSize:9, color: r.color ?? 'var(--c-accent)', letterSpacing:'0.16em', flexShrink:0, marginTop:1 }}>{r.label}</span>
                      <span style={{ ...T_BODY, fontSize:12, color:'var(--c-text-primary)', lineHeight:1.5 }}>{r.text}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ── Formation Modal — slide-up list ───────────────────────────── */}
        {formationModal && (
          <div role="dialog" aria-modal="true" aria-labelledby="form-modal-title" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', zIndex:200, display:'flex', flexDirection:'column' }} onClick={() => setFormationModal(false)}>
            <div
              onClick={e => e.stopPropagation()}
              style={{
                marginTop:'auto',
                background:'var(--c-bg-elevated)',
                borderTop:'3px solid var(--c-accent)',
                borderRadius:'16px 16px 0 0',
                animation:'c-slideUp 0.28s ease-out',
                padding:'18px 0 12px',
              }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 18px', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <LayoutGrid size={18} color="var(--c-accent)" />
                  <span id="form-modal-title" style={{ ...T_DISPLAY, fontSize:12, fontWeight:900, color:'var(--c-accent)', letterSpacing:'0.26em' }}>FORMAÇÃO</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormationModal(false)}
                  aria-label="Fechar"
                  style={{ background:'transparent', border:'1px solid var(--c-border)', color:'var(--c-text-primary)', padding:'4px 8px', borderRadius:4, cursor:'pointer', display:'flex', alignItems:'center', gap:4, ...T_DISPLAY, fontSize:9, letterSpacing:'0.12em' }}
                >
                  <X size={11} /> FECHAR
                </button>
              </div>

              <ul style={{ listStyle:'none', margin:0, padding:0 }}>
                {FORMATIONS.map(f => (
                  <li key={f}>
                    <button
                      type="button"
                      onClick={() => applyFormation(f)}
                      style={{
                        width:'100%', padding:'14px 22px',
                        background: activeFormation === f ? 'rgba(253,225,0,0.06)' : 'transparent',
                        borderLeft: activeFormation === f ? '3px solid var(--c-accent)' : '3px solid transparent',
                        border:'none', borderBottom:'1px solid var(--c-border)',
                        textAlign:'left', cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
                        color: activeFormation === f ? 'var(--c-accent)' : 'var(--c-text-primary)',
                      }}
                    >
                      <span style={{ ...T_HERO, fontSize:22, letterSpacing:'-0.02em' }}>{f}</span>
                      {activeFormation === f
                        ? <span style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-accent)', letterSpacing:'0.22em' }}>ATIVA</span>
                        : <ChevronRight size={14} color="var(--c-text-muted)" />}
                    </button>
                  </li>
                ))}
              </ul>

              <div style={{ padding:'12px 18px 0', borderTop:'1px solid var(--c-border)' }}>
                <button
                  type="button"
                  onClick={() => setFormationModal(false)}
                  style={{ width:'100%', padding:'10px 0', background:'transparent', border:'1px solid var(--c-border)', color:'var(--c-text-primary)', borderRadius:4, cursor:'pointer', ...T_DISPLAY, fontSize:10, letterSpacing:'0.22em', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
                >
                  <ChevronDown size={11} style={{ transform:'rotate(90deg)' }} /> VOLTAR
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
