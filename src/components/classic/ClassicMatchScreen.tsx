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
  Flame,
} from 'lucide-react';
import type {
  ClassicPlayer, MatchEvent, MatchStats, MatchScore,
  BallState, TrailPoint, SkillEntry,
  ClassicMatchConfig, ManagerSkillId, EventChainContext,
} from '@/engine/classic/types';
import { emptyPlayerMatchStats } from '@/engine/classic/types';
import { getHomePlayers, getAwayPlayers, FIELD_W_LOGIC, FIELD_H_LOGIC, repositionForFormation } from '@/engine/classic/formations';
import { generateEvent, applyEventToPlayers, deriveStatsDelta } from '@/engine/classic/eventGenerator';
import { computeTeamPhase, playerShift } from '@/engine/classic/decisionEngine';
import { createMatchStory, updateMatchStory, storyBeatsForCoach } from '@/engine/classic/matchStory';
import type { MatchStory } from '@/engine/classic/matchStory';
import { useGameDispatch } from '@/game/store';
import { HeatmapEngine } from '@/engine/classic/heatmapEngine';

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
const EVENT_INTERVAL_MIN   = 4000;
const EVENT_INTERVAL_RANGE = 3000;
const TRAIL_MAX  = 8;
const BALL_LERP  = 0.12;
const FEED_MAX   = 4;

// Match structure: 45+3 first half, 45+5 second half
const HALF1_END   = 45;
const HALF1_EXTRA = 3;   // acréscimos 1º tempo
const HALF2_END   = 90;
const HALF2_EXTRA = 5;   // acréscimos 2º tempo
const MATCH_END   = HALF2_END + HALF2_EXTRA; // 95 real minutes total

const SKILLS_INIT: SkillEntry[] = [
  { id:'counter', label:'CONTRA ATAQUE RÁPIDO', icon:'zap',       cooldown:10, active:false, remaining:0 },
  { id:'press',   label:'PRESSÃO ALTA',          icon:'shield',    cooldown:15, active:false, remaining:0 },
  { id:'offens',  label:'FOCO OFENSIVO',          icon:'target',    cooldown:20, active:false, remaining:0 },
  { id:'cross',   label:'BOLA NA ÁREA',           icon:'crosshair', cooldown:15, active:false, remaining:0 },
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

function drawBall(ctx: CanvasRenderingContext2D, ball: BallState, trail: TrailPoint[]) {
  for (const p of trail) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(253,225,0,${p.opacity * 0.35})`;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#FDE100';
  ctx.shadowColor = 'rgba(253,225,0,0.9)';
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;
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
    case 'zap':       return <Zap       size={size} />;
    case 'shield':    return <Shield    size={size} />;
    case 'target':    return <Target    size={size} />;
    case 'crosshair': return <Crosshair size={size} />;
    default:          return <Zap       size={size} />;
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
  const pendingPauseRef = useRef(false);
  // Primeiro evento da partida é SEMPRE kickoff: HOME atacante → meio-campo.
  // Identidade da bola sair pelo centro do campo, não roleta.
  const kickoffPendingRef = useRef(true);
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
  const [dangerFlash, setDangerFlash] = useState(false);
  // Overlay de intervalo/início de 2º tempo
  const [periodOverlay, setPeriodOverlay] = useState<{ label: string; sub: string } | null>(null);
  // Último gatilho tático — exibido brevemente no campo
  const [lastTacticalTrigger, setLastTacticalTrigger] = useState<import('@/engine/classic/types').TacticalTrigger>(null);
  const chainRef    = useRef<EventChainContext | null>(null);
  const sequenceRef = useRef<{ zones: string[]; index: number } | null>(null);

  // ── Canvas / animation refs ────────────────────────────────────────────────
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const miniCanvasRef = useRef<HTMLCanvasElement>(null);
  const ballRef    = useRef<BallState>({ x: 300, y: 200, targetX: 300, targetY: 200 });
  const trailRef   = useRef<TrailPoint[]>([]);
  const heatRef    = useRef(new HeatmapEngine());
  const rafRef     = useRef<number>(0);
  const loopRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clockRef   = useRef<ReturnType<typeof setInterval> | null>(null);

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
          setPeriodOverlay({ label: 'INTERVALO', sub: 'Jogo parado — 2º tempo em breve' });
          setTimeout(() => setPeriodOverlay(null), 4000);
        }
        if (next === HALF1_END + HALF1_EXTRA + 1) {
          setPeriod('2º TEMPO');
          setExtraMinute(0);
          setPeriodOverlay({ label: '2º TEMPO', sub: 'Bola rolando — 45 minutos pela frente' });
          setTimeout(() => setPeriodOverlay(null), 3500);
        }
        // Acréscimos 1º tempo: 46, 47, 48 → exibe 45+1, 45+2, 45+3
        if (next > HALF1_END && next <= HALF1_END + HALF1_EXTRA) {
          setExtraMinute(next - HALF1_END);
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

  // ── MVP + pontos da liga: calculados quando a partida termina ──────────
  useEffect(() => {
    if (!matchOver) return;
    setPlayers(prev => {
      // MVP = jogador com maior confiança de qualquer time
      const best = [...prev].sort((a, b) => b.confidence - a.confidence)[0];
      setMvp(best ?? null);
      return prev;
    });

    // Aplica pontos da liga olefoot (Fase 4) — vitórias 3pt, empate 1pt,
    // derrota 0pt. Manager vê os pontos crescerem nas partidas casuais.
    if (!leaguePointsAppliedRef.current) {
      leaguePointsAppliedRef.current = true;
      const result: 'win' | 'draw' | 'loss' =
        score.home > score.away ? 'win' :
        score.home < score.away ? 'loss' : 'draw';
      dispatch({
        type: 'APPLY_CASUAL_RESULT_TO_LEAGUE',
        result: { scoreHome: score.home, scoreAway: score.away, result },
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
  useEffect(() => {
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
  }, []);

  // ── rAF loop — ball + canvas (NO camera, static field) ────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function frame() {
      const ball = ballRef.current;
      const prevX = ball.x, prevY = ball.y;

      // Lerp factor varia por tipo de passe
      const anim = passAnimRef.current;
      const lerp = anim.kind === 'rapido'   ? 0.22
                 : anim.kind === 'planejado'? 0.10
                 : anim.kind === 'shot'     ? 0.28
                 : anim.kind === 'cruzamento' ? 0.10
                 : BALL_LERP;

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

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Game event loop ────────────────────────────────────────────────────────
  // Lê estado quente via refs — fireEvent é estável (não rebuilda no clock).
  const fireEvent = useCallback(() => {
    if (!runningRef.current) return;

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
        const home = prev.filter(p => p.team === 'home');
        const striker = home.find(p => p.role === 'ST') ?? home.find(p => p.role === 'CM') ?? home[0];
        const cms = home.filter(p => p.role === 'CM' || p.role === 'DM');
        // Pega o CM mais perto do striker — passe natural pra trás
        const receiver = cms.length > 0
          ? cms.slice().sort((a, b) =>
              Math.hypot(a.position.x - striker.position.x, a.position.y - striker.position.y)
              - Math.hypot(b.position.x - striker.position.x, b.position.y - striker.position.y),
            )[0]
          : home.find(p => p.role !== 'ST') ?? home[1];

        const kickoffEvt: MatchEvent = {
          id: 'evt_kickoff',
          minute: 0,
          type: 'pass',
          team: 'home',
          playerId: striker.id,
          playerName: striker.shortName,
          archetype: striker.archetype,
          text: `${striker.shortName} dá início à partida — toca para ${receiver.shortName}.`,
          ballX: receiver.position.x,
          ballY: receiver.position.y,
          receiverPlayerId: receiver.id,
          passSubtype: 'curto',
          rationale: 'kickoff: HOME striker → midfield',
        };
        result = { event: kickoffEvt, nextSequence: null, receiverId: receiver.id };
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
         evt.type === 'post' || evt.type === 'wide' || evt.type === 'rebound')
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
        durationEst: passKind === 'rapido' ? 350 : passKind === 'planejado' ? 800 : 600,
      };

      ballRef.current.targetX = evt.ballX;
      ballRef.current.targetY = evt.ballY;
      heatRef.current.accumulate(evt.ballX, evt.ballY);

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

      setStats(s => deriveStatsDelta(evt, s, possessionRef.current));
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

      if (evt.type === 'goal') {
        setScore(prev2 => ({ ...prev2, [evt.team]: prev2[evt.team] + 1 }));
        setGoalFlash(true);
        setTimeout(() => setGoalFlash(false), 1500);
      }
      if (evt.type === 'danger' || evt.type === 'shot') {
        setDangerFlash(true);
        setTimeout(() => setDangerFlash(false), 800);
      }

      setLatestEvent(evt);
      setEventFeed(prev2 => [evt, ...prev2].slice(0, FEED_MAX));

      // Pausa de 3s após eventos que param o jogo: gol (festa+kickoff),
      // chute pra fora (tiro de meta), trave (rebote), defesa (goleiro decide).
      // Jogadores se reposicionam suavemente nesses 3s — beleza do conceito.
      if (evt.type === 'goal' || evt.type === 'wide' || evt.type === 'post' ||
          evt.type === 'save' || evt.type === 'corner') {
        pendingPauseRef.current = true;
      }

      // Atualiza memória da partida (Fase 4): cumulativo de gols, virada,
      // pressão sustentada, flank attack, on fire, turnover crítico.
      const updatedPlayers = applyEventToPlayers(prev, evt);
      matchStoryRef.current = updateMatchStory(matchStoryRef.current, evt, updatedPlayers, score);

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
      interval = 3000; // 3 segundos de pensamento
      pendingPauseRef.current = false;
    } else if (inSequence) {
      interval = 1200 + Math.random() * 800;
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
            const aS = (a.onFire ? 100 : 0) + (a.isStar ? 80 : 0) + (a.fatigue > 75 ? 60 : 0) + a.confidence * 0.3;
            const bS = (b.onFire ? 100 : 0) + (b.isStar ? 80 : 0) + (b.fatigue > 75 ? 60 : 0) + b.confidence * 0.3;
            return bS - aS;
          })
          .slice(0, 4)
          .map(p => ({
            name: p.shortName, role: p.role, archetype: p.archetype, ovr: p.ovr,
            fatigue: p.fatigue, confidence: p.confidence,
            onFire: p.onFire, isStar: p.isStar,
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
                            <div style={{ ...T_BODY, fontSize:10, color:'var(--c-text-muted)', marginTop:2, display:'flex', gap:8 }}>
                              {ms.goals > 0 && <span>⚽ {ms.goals}</span>}
                              {ms.shots > 0 && <span>🎯 {ms.shots}</span>}
                              <span>↗ {ms.passes}</span>
                              {ms.tackles > 0 && <span>⚔ {ms.tackles}</span>}
                              {ms.duelsWon > 0 && <span>🛡 {ms.duelsWon}</span>}
                              {ms.tikTakCount > 0 && <span>⚡ {ms.tikTakCount}</span>}
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
        }}>
          {/* Canvas estático */}
          <canvas
            ref={canvasRef}
            width={FIELD_W_LOGIC}
            height={FIELD_H_LOGIC}
            style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', display:'block' }}
          />

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
            // Time que tem a bola = time do último ator com posse (latestEvent)
            const holderTeam: 'home' | 'away' = latestEvent?.team ?? 'home';
            const ballPosNow = { x: ballRef.current.targetX, y: ballRef.current.targetY };
            const shift = playerShift(p, ballPosNow, holderTeam);
            const shiftedX = p.position.x + shift.dx * FIELD_W_LOGIC;
            const shiftedY = p.position.y + shift.dy * FIELD_H_LOGIC;
            const leftPct = (shiftedX / FIELD_W_LOGIC) * 100;
            const topPct  = (shiftedY / FIELD_H_LOGIC) * 100;
            const isHL = highlightPlayer?.id === p.id;
            const isLegacyTarget = legacyPulse?.player.id === p.id;
            const NODE = 26;
            const isExhausted = p.fatigue > 82;
            const isHot = !!p.onFire;
            const isStarPlayer = !!p.isStar;

            // Borda:
            // - cansado → vermelho fraco pulsante
            // - on fire → amarelo neon fixo (aura faz o brilho)
            // - destaque ativo → branco mais forte
            // - resto → branco/cinza neutro
            const borderColor = isExhausted
              ? 'rgba(239,68,68,0.60)'
              : isHot
              ? 'rgba(253,225,0,0.95)'
              : isHL
              ? 'rgba(255,255,255,0.85)'
              : 'rgba(255,255,255,0.35)';

            const bgColor = isHot
              ? 'rgba(253,225,0,0.16)'
              : isHL
              ? 'rgba(255,255,255,0.14)'
              : 'rgba(255,255,255,0.06)';

            const shadow = isHL && !isLegacyTarget && !isHot
              ? '0 0 0 1.5px rgba(255,255,255,0.4)'
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
                color: 'rgba(255,255,255,0.90)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'var(--cf-body)', fontSize:10, fontWeight:700,
                pointerEvents:'none',
                // Phase 2: micro-movimento do bloco — left/top transitionam suavemente
                // quando a fase tática do time muda (1.4s para sentir como onda)
                transition: repositioning
                  ? 'left 0.9s cubic-bezier(0.4,0,0.2,1), top 0.9s cubic-bezier(0.4,0,0.2,1)'
                  : 'left 1.4s cubic-bezier(0.32,0,0.32,1), top 1.4s cubic-bezier(0.32,0,0.32,1), border-color 0.3s ease, background 0.3s ease',
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
                {p.number}
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

          {/* Mini heatmap — ZONA QUENTE: campo oculto onde o jogo acontece.
              Jogadores não aparecem aqui, mas cada evento acumula calor.
              O manager lê por onde o time está atacando sem ver o campo ao vivo. */}
          <div style={{ position:'absolute', bottom:20, left:8, width:96, height:72, background:'rgba(0,0,0,0.88)', border:'1px solid rgba(253,225,0,0.30)', borderRadius:4, overflow:'hidden' }}>
            <canvas ref={miniCanvasRef} width={96} height={72} style={{ position:'absolute', top:0, left:0 }} />
            {/* Label duplo: título + corredor dominante */}
            <span style={{ position:'absolute', bottom:3, left:'50%', transform:'translateX(-50%)', ...T_DISPLAY, fontSize:7, color:'rgba(253,225,0,0.70)', letterSpacing:'0.14em', whiteSpace:'nowrap' }}>ZONA QUENTE</span>
          </div>

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
              <div style={{ display:'flex', gap:16, marginTop:4 }}>
                <span style={{ ...T_HERO, fontSize:32, color:'var(--c-text-primary)', letterSpacing:'-0.04em' }}>
                  {score.home} — {score.away}
                </span>
              </div>
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

        {/* ── Vitrines do museu vivo: cards modulares com rail amarelo ──── */}
        <div style={{ display:'flex', flexDirection:'column', gap:10, padding:'12px 12px 4px' }}>

        {/* ── Jogador em ação — primeiro card, logo abaixo do placar ───── */}
        <ModuleCard eyebrow={star.onFire ? 'JOIA EM CHAMA' : 'JOGADOR EM AÇÃO'} noPadding>
          <div style={{ display:'grid', gridTemplateColumns:'112px 1fr', minHeight:128 }}>
            <div style={{ position:'relative', background:'#000', overflow:'hidden' }}>
              <img
                src={playerPhoto(star, 240)}
                alt={star.shortName}
                loading="lazy"
                style={{ width:'100%', height:'100%', objectFit:'cover', imageRendering: star.portraitUrl ? 'auto' : 'pixelated', filter: star.portraitUrl ? 'contrast(1.05)' : 'grayscale(35%) contrast(1.05)' }}
              />
              <div aria-hidden style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 72%, rgba(0,0,0,0.55) 100%)' }} />
              <div style={{ position:'absolute', top:6, left:8, lineHeight:0.9 }}>
                <div style={{ ...T_HERO, fontStyle:'italic', fontWeight:700, fontSize:36, color:'#FFFFFF', letterSpacing:'-0.02em', textShadow:'0 2px 6px rgba(0,0,0,0.85), 0 0 12px rgba(0,0,0,0.5)' }}>
                  {star.ovr}
                </div>
                <div style={{ ...T_DISPLAY, fontSize:8, color:'rgba(255,255,255,0.85)', letterSpacing:'0.22em', marginTop:1, textShadow:'0 1px 3px rgba(0,0,0,0.8)' }}>OVR</div>
              </div>
              <div style={{ position:'absolute', bottom:6, left:6, background:'rgba(0,0,0,0.85)', padding:'2px 6px', ...T_DISPLAY, fontSize:8, fontWeight:900, color:'var(--c-text-primary)', letterSpacing:'0.18em', borderRadius:2 }}>
                {star.role}
              </div>
              {star.isStar && (
                <div style={{ position:'absolute', top:6, right:6, background:'var(--c-accent)', color:'#0D0D0D', padding:'2px 5px', borderRadius:2, ...T_DISPLAY, fontSize:8, fontWeight:900, letterSpacing:'0.16em', display:'flex', alignItems:'center', gap:3, boxShadow:'0 0 12px rgba(253,225,0,0.45)' }}>
                  <Star size={8} fill="currentColor" /> MVP
                </div>
              )}
              {star.onFire && !star.isStar && (
                <div style={{ position:'absolute', top:6, right:6, background:'#FB923C', color:'#0D0D0D', padding:'2px 5px', borderRadius:2, ...T_DISPLAY, fontSize:8, fontWeight:900, letterSpacing:'0.14em', display:'flex', alignItems:'center', gap:3 }}>
                  <Flame size={8} fill="currentColor" /> CHAMA
                </div>
              )}
            </div>

            <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', justifyContent:'space-between', minWidth:0 }}>
              <div>
                <div style={{ ...T_DISPLAY, fontSize:8, color:'var(--c-text-muted)', letterSpacing:'0.26em', marginBottom:4 }}>{star.archetype}</div>
                <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:6 }}>
                  <span style={{ ...T_DISPLAY, fontSize:14, fontWeight:900, color:'var(--c-text-primary)', letterSpacing:'0.04em', flexShrink:0 }}>{star.number}</span>
                  <span style={{ ...T_DISPLAY, fontSize:14, fontWeight:900, color:'var(--c-text-primary)', letterSpacing:'0.10em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{star.shortName}</span>
                </div>
                <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                  <span style={{ ...T_HERO, fontStyle:'italic', fontWeight:700, fontSize:26, color:'var(--c-accent)', lineHeight:1, letterSpacing:'-0.02em' }}>
                    {(6.0 + (star.confidence / 100) * 4).toFixed(2)}
                  </span>
                  <span style={{ ...T_DISPLAY, fontSize:8, color:'var(--c-text-muted)', letterSpacing:'0.22em' }}>RATING</span>
                </div>
              </div>
              <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:5 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ ...T_DISPLAY, fontSize:8, color:'var(--c-text-muted)', letterSpacing:'0.16em', minWidth:54 }}>FADIGA</span>
                  <div style={{ flex:1, height:2, background:'var(--c-bg-elevated)', borderRadius:1 }}>
                    <div style={{ height:'100%', background: star.fatigue > 70 ? 'var(--c-danger)' : 'var(--c-warning)', borderRadius:1, width:`${star.fatigue}%`, transition:'width 1s' }} />
                  </div>
                  <span style={{ ...T_BODY, fontSize:9, color:'var(--c-text-sec)', fontVariantNumeric:'tabular-nums', minWidth:30, textAlign:'right' }}>{Math.round(star.fatigue)}%</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ ...T_DISPLAY, fontSize:8, color:'var(--c-text-muted)', letterSpacing:'0.16em', minWidth:54 }}>CONFIANÇA</span>
                  <div style={{ flex:1, height:2, background:'var(--c-bg-elevated)', borderRadius:1 }}>
                    <div style={{ height:'100%', background:'var(--c-ok)', borderRadius:1, width:`${star.confidence}%`, transition:'width 1s' }} />
                  </div>
                  <span style={{ ...T_BODY, fontSize:9, color:'var(--c-text-sec)', fontVariantNumeric:'tabular-nums', minWidth:30, textAlign:'right' }}>{Math.round(star.confidence)}%</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'48px 1fr auto', alignItems:'center', gap:10, padding:'8px 14px', borderTop:'1px solid var(--c-border)', background:'rgba(255,255,255,0.015)' }}>
            <div style={{ position:'relative', width:48, height:40, borderRadius:3, overflow:'hidden', background:'#000' }}>
              <img
                src={playerPhoto(secondStar, 120)}
                alt={secondStar.shortName}
                loading="lazy"
                style={{ width:'100%', height:'100%', objectFit:'cover', imageRendering: secondStar.portraitUrl ? 'auto' : 'pixelated', filter: secondStar.portraitUrl ? 'contrast(1.05)' : 'grayscale(50%)' }}
              />
              <div style={{ position:'absolute', top:2, left:3, ...T_HERO, fontStyle:'italic', fontSize:14, color:'#FFFFFF', lineHeight:1, textShadow:'0 1px 3px rgba(0,0,0,0.95)' }}>
                {secondStar.ovr}
              </div>
            </div>
            <div>
              <div style={{ ...T_DISPLAY, fontSize:11, fontWeight:900, color:'var(--c-text-primary)', letterSpacing:'0.10em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {secondStar.number} {secondStar.shortName}
              </div>
              <div style={{ ...T_BODY, fontSize:9, color:'var(--c-text-muted)', marginTop:1 }}>
                {secondStar.role} · {secondStar.archetype}
              </div>
            </div>
            <span style={{ ...T_DISPLAY, fontSize:8, color:'var(--c-text-muted)', letterSpacing:'0.18em' }}>SEGUNDO</span>
          </div>
        </ModuleCard>

        {/* ── [F] Stats carousel ───────────────────────────────────────── */}
        <ModuleCard eyebrow="ESTATÍSTICAS · AO VIVO" noPadding meta={
          <span style={{ ...T_BODY, fontSize:9, color:'var(--c-text-muted)', letterSpacing:'0.10em' }}>arrasta →</span>
        }>
          <div style={{ display:'flex', overflowX:'auto', scrollSnapType:'x mandatory' }}>
            {[
              { label:'POSSE DE BOLA', home:stats.possession.home,    away:stats.possession.away,    fmt:(v:number)=>`${v}%` },
              { label:'FINALIZAÇÕES',  home:stats.shots.home,         away:stats.shots.away,         fmt:(v:number)=>`${v}`  },
              { label:'NO ALVO',       home:stats.shotsOnTarget.home, away:stats.shotsOnTarget.away, fmt:(v:number)=>`${v}`  },
              { label:'PASSES CERTOS', home:stats.passes.home,        away:stats.passes.away,        fmt:(v:number)=>`${v}`  },
              { label:'FALTAS',        home:stats.fouls.home,         away:stats.fouls.away,         fmt:(v:number)=>`${v}`  },
            ].map((stat, i) => {
              const total = stat.home + stat.away || 1;
              return (
                <div key={i} style={{ minWidth:120, flexShrink:0, padding:'12px 14px', scrollSnapAlign:'start', borderRight: i < 4 ? '1px solid var(--c-border)' : 'none' }}>
                  <div style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-text-sec)', letterSpacing:'0.22em', marginBottom:6 }}>{stat.label}</div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ ...T_HERO, fontSize:15, color:'var(--c-team-home)' }}>{stat.fmt(stat.home)}</span>
                    <span style={{ ...T_HERO, fontSize:15, color:'var(--c-team-away)' }}>{stat.fmt(stat.away)}</span>
                  </div>
                  <div style={{ height:3, background:'var(--c-bg-elevated)', borderRadius:2 }}>
                    <div style={{ height:'100%', background:'var(--c-accent)', borderRadius:2, width:`${(stat.home / total) * 100}%`, transition:'width 1s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ModuleCard>


        {/* ── [G] Operação Tática — agora 2 cols: Tipo de Passe | Skills ─ */}
        <ModuleCard eyebrow="OPERAÇÃO TÁTICA" noPadding>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1, background:'var(--c-border)' }}>
            {/* Tipo de Passe — só título maior, sem descritivo */}
            <div style={{ background:'var(--c-bg-surface)', padding:'10px 12px', display:'flex', flexDirection:'column' }}>
              <div style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-accent)', letterSpacing:'0.24em', marginBottom:10 }}>TIPO DE PASSE</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1 }}>
                {PASS_STYLES.map(ps => {
                  const isActive = passStyle === ps.id;
                  return (
                    <button
                      key={ps.id}
                      type="button"
                      onClick={() => { setPassStyle(ps.id); sequenceRef.current = null; }}
                      style={{
                        flex:1, width:'100%', padding:'10px 12px',
                        border: isActive ? '1px solid var(--c-accent)' : '1px solid var(--c-border)',
                        borderLeft: isActive ? '3px solid var(--c-accent)' : '3px solid transparent',
                        borderRadius:4, background: isActive ? 'rgba(253,225,0,0.08)' : 'transparent',
                        cursor:'pointer', textAlign:'left',
                        boxShadow: isActive ? '0 0 14px rgba(253,225,0,0.18)' : undefined,
                        transition:'all 0.18s',
                      }}
                    >
                      <span style={{ ...T_DISPLAY, fontSize:13, fontWeight:900, color: isActive ? 'var(--c-accent)' : 'var(--c-text-primary)', letterSpacing:'0.16em' }}>
                        {ps.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Skills — mantém ícone + cooldown */}
            <div style={{ background:'var(--c-bg-surface)', padding:'10px 12px', display:'flex', flexDirection:'column' }}>
              <div style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-accent)', letterSpacing:'0.24em', marginBottom:10 }}>SKILLS</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1 }}>
                {skills.map(sk => (
                  <button
                    key={sk.id}
                    type="button"
                    onClick={() => toggleSkill(sk.id)}
                    style={{
                      flex:1, display:'flex', alignItems:'center', gap:8, width:'100%', padding:'10px 12px',
                      border: sk.active ? '1px solid var(--c-accent)' : '1px solid var(--c-border)',
                      borderLeft: sk.active ? '3px solid var(--c-accent)' : '3px solid transparent',
                      borderRadius:4, background: sk.active ? 'rgba(253,225,0,0.08)' : 'transparent',
                      cursor: sk.remaining > 0 ? 'not-allowed' : 'pointer',
                      opacity: sk.remaining > 0 ? 0.5 : 1,
                      color: sk.active ? 'var(--c-accent)' : 'var(--c-text-primary)',
                      boxShadow: sk.active ? '0 0 14px rgba(253,225,0,0.18)' : undefined,
                      transition:'all 0.18s',
                    }}
                  >
                    <SkillIcon icon={sk.icon} />
                    <span style={{ ...T_DISPLAY, fontSize:10, fontWeight:900, textAlign:'left', flex:1, letterSpacing:'0.12em', lineHeight:1.2 }}>{sk.label}</span>
                    <span style={{ ...T_BODY, fontSize:9, color:'var(--c-text-sec)', fontVariantNumeric:'tabular-nums', flexShrink:0 }}>
                      {sk.remaining > 0 ? `${sk.remaining}s` : `${sk.cooldown}s`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ModuleCard>

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
