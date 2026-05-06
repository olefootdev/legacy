import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Brain, Sparkles, LayoutGrid,
  Pause, Play, Star, Shield,
  Zap, Target, Crosshair, Box,
  ChevronRight, ChevronDown, ChevronUp, X,
  Wifi, AlertTriangle, Goal as GoalIcon, Swords, Repeat, Footprints, Send,
} from 'lucide-react';
import type { ClassicPlayer, MatchEvent, MatchStats, MatchScore, BallState, TrailPoint, SkillEntry, SubEntry, QuickInstruction, ClassicMatchConfig } from '@/engine/classic/types';
import { getHomePlayers, getAwayPlayers, FIELD_W_LOGIC, FIELD_H_LOGIC } from '@/engine/classic/formations';
import { generateEvent } from '@/engine/classic/eventGenerator';
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
`;

// ─── Constants ────────────────────────────────────────────────────────────────
const EVENT_INTERVAL_MIN   = 1800;
const EVENT_INTERVAL_RANGE = 2200;
const TRAIL_MAX  = 8;
const BALL_LERP  = 0.12;

const SKILLS_INIT: SkillEntry[] = [
  { id:'counter', label:'CONTRA ATAQUE RÁPIDO', icon:'zap',       cooldown:10, active:false, remaining:0 },
  { id:'press',   label:'PRESSÃO ALTA',          icon:'shield',    cooldown:15, active:false, remaining:0 },
  { id:'offens',  label:'FOCO OFENSIVO',          icon:'target',    cooldown:20, active:false, remaining:0 },
  { id:'cross',   label:'BOLA NA ÁREA',           icon:'crosshair', cooldown:15, active:false, remaining:0 },
];

const SUBS_INIT: SubEntry[] = [
  { number:7,  name:'TATAJUBA', fatigue:82, trend:'up'   },
  { number:9,  name:'R. SILVA', fatigue:75, trend:'up'   },
  { number:21, name:'M. JUNIOR',fatigue:68, trend:'down' },
];

const INSTRUCTIONS: QuickInstruction[] = [
  { id:'def', label:'LINHA DEFENSIVA NORMAL' },
  { id:'man', label:'MARCAÇÃO INDIVIDUAL'    },
  { id:'clr', label:'TIRAR MARCADOR'         },
];

const FORMATIONS = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '4-5-1', '5-3-2', '3-4-3'] as const;
type FormationId = typeof FORMATIONS[number];

const MENTALIDADES = ['DEFENSIVO', 'EQUILIBRADO', 'OFENSIVO'] as const;
type Mentalidade = typeof MENTALIDADES[number];

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
function ClubCrest({ color, initials, side }: { color: string; initials: string; side: 'home' | 'away' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, minWidth:48 }}>
      <div style={{
        width:42, height:42,
        borderRadius:'6px 6px 16px 16px',  // shield-ish silhouette
        border:`1.5px solid ${color}`,
        background: side === 'home' ? 'rgba(253,225,0,0.10)' : 'rgba(255,255,255,0.06)',
        display:'flex', alignItems:'center', justifyContent:'center',
        position:'relative',
      }}>
        <Shield size={20} color={color} strokeWidth={2} fill="none" />
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', ...T_DISPLAY, fontSize:9, fontWeight:900, color, letterSpacing:'0.04em' }}>
          {initials.charAt(0)}
        </div>
      </div>
      <span style={{ ...T_DISPLAY, fontSize:10, fontWeight:800, color:'var(--c-text-primary)', letterSpacing:'0.20em' }}>
        {initials}
      </span>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
interface Props {
  config?: Partial<ClassicMatchConfig>;
  onExit?: () => void;
}

export function ClassicMatchScreen({ config, onExit }: Props) {
  const homeTeam    = config?.homeTeam    ?? 'TIGRES';
  const awayTeam    = config?.awayTeam    ?? 'ALVORADA FC';
  const round       = config?.round       ?? 12;
  const competition = config?.competition ?? 'CLASSIC LEAGUE';
  const homeShort   = shortInitials(homeTeam);
  const awayShort   = shortInitials(awayTeam);

  // ── State ──────────────────────────────────────────────────────────────────
  const [players]  = useState<ClassicPlayer[]>(() => [...getHomePlayers(), ...getAwayPlayers()]);
  const [latestEvent, setLatestEvent] = useState<MatchEvent | null>(null);
  const [score, setScore]     = useState<MatchScore>({ home: 0, away: 0 });
  const [minute, setMinute]   = useState(78);
  const [seconds, setSeconds] = useState(24);
  const [period]              = useState<string>('2º TEMPO');
  const [running, setRunning] = useState(true);
  const [stats, setStats]     = useState<MatchStats>({
    possession:    { home: 58, away: 42 },
    shots:         { home: 9,  away: 6  },
    shotsOnTarget: { home: 4,  away: 2  },
    passes:        { home: 267, away: 184 },
    fouls:         { home: 8,  away: 11  },
    corners:       { home: 4,  away: 2  },
  });
  const [possession, setPossession] = useState<'home' | 'away'>('home');
  const [mentalidade, setMentalidade] = useState<Mentalidade>('EQUILIBRADO');
  const [mentalSlider, setMentalSlider] = useState(50);
  const [intensidade, setIntensidade]   = useState(60);
  const [skills, setSkills]   = useState<SkillEntry[]>(SKILLS_INIT);
  const [highlightPlayer, setHighlightPlayer] = useState<ClassicPlayer | null>(null);
  const [coachModal, setCoachModal]     = useState(false);
  const [formationModal, setFormationModal] = useState(false);
  const [activeFormation, setActiveFormation] = useState<FormationId>('4-3-3');
  const [legacyPulse, setLegacyPulse] = useState<{ key: number; player: ClassicPlayer } | null>(null);
  const [coachMessages, setCoachMessages] = useState<Array<{role:'ai'|'user', text:string}>>([
    { role:'ai', text:'Estamos dominando as laterais. Continua a explorar o espaço nas costas deles.' },
  ]);
  const [chatInput, setChatInput]   = useState('');
  const [goalFlash, setGoalFlash]   = useState(false);
  const [dangerFlash, setDangerFlash] = useState(false);

  // ── Canvas / animation refs ────────────────────────────────────────────────
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const miniCanvasRef = useRef<HTMLCanvasElement>(null);
  const ballRef    = useRef<BallState>({ x: 300, y: 200, targetX: 300, targetY: 200 });
  const trailRef   = useRef<TrailPoint[]>([]);
  const heatRef    = useRef(new HeatmapEngine());
  const rafRef     = useRef<number>(0);
  const loopRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clockRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Clock (5× speed) ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    clockRef.current = setInterval(() => {
      setSeconds(s => { if (s >= 59) { setMinute(m => m + 1); return 0; } return s + 1; });
    }, 200);
    return () => clearInterval(clockRef.current ?? undefined);
  }, [running]);

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
      ball.x += (ball.targetX - ball.x) * BALL_LERP;
      ball.y += (ball.targetY - ball.y) * BALL_LERP;
      if (Math.abs(ball.x - prevX) > 0.5 || Math.abs(ball.y - prevY) > 0.5) {
        trailRef.current.push({ x: prevX, y: prevY, opacity: 0.8 });
        if (trailRef.current.length > TRAIL_MAX) trailRef.current.shift();
      }
      trailRef.current.forEach(p => { p.opacity *= 0.88; });

      ctx.clearRect(0, 0, FIELD_W_LOGIC, FIELD_H_LOGIC);
      drawField(ctx);
      heatRef.current.render(ctx);
      drawBall(ctx, ball, trailRef.current);

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Game event loop ────────────────────────────────────────────────────────
  const fireEvent = useCallback(() => {
    if (!running) return;
    const evt = generateEvent(players, minute, score, possession);

    ballRef.current.targetX = evt.ballX;
    ballRef.current.targetY = evt.ballY;
    heatRef.current.accumulate(evt.ballX, evt.ballY);

    const actor = players.find(p => p.id === evt.playerId);
    if (actor) setHighlightPlayer(actor);

    setStats(prev => {
      const ns = { ...prev };
      if (evt.type === 'shot' || evt.type === 'goal') {
        ns.shots = { ...ns.shots, [evt.team]: ns.shots[evt.team] + 1 };
        if (evt.type === 'goal' || Math.random() < 0.5)
          ns.shotsOnTarget = { ...ns.shotsOnTarget, [evt.team]: ns.shotsOnTarget[evt.team] + 1 };
      }
      if (evt.type === 'foul')   ns.fouls   = { ...ns.fouls,   [evt.team]: ns.fouls[evt.team]   + 1 };
      if (evt.type === 'corner') ns.corners = { ...ns.corners, [evt.team]: ns.corners[evt.team] + 1 };
      if (evt.type === 'pass')   ns.passes  = { ...ns.passes,  [evt.team]: ns.passes[evt.team]  + 1 };
      if (Math.random() < 0.3) setPossession(p => p === 'home' ? 'away' : 'home');
      return ns;
    });

    if (evt.type === 'goal') {
      setScore(prev => ({ ...prev, [evt.team]: prev[evt.team] + 1 }));
      setGoalFlash(true);
      setTimeout(() => setGoalFlash(false), 1500);
    }
    if (evt.type === 'danger' || evt.type === 'shot') {
      setDangerFlash(true);
      setTimeout(() => setDangerFlash(false), 800);
    }

    setLatestEvent(evt);
    loopRef.current = setTimeout(fireEvent, EVENT_INTERVAL_MIN + Math.random() * EVENT_INTERVAL_RANGE);
  }, [running, players, minute, score, possession]);

  useEffect(() => {
    loopRef.current = setTimeout(fireEvent, 800);
    return () => clearTimeout(loopRef.current ?? undefined);
  }, [fireEvent]);

  // ── Coach chat ─────────────────────────────────────────────────────────────
  const sendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setCoachMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setTimeout(() => {
      const replies = [
        `A pressão no meio-campo está a funcionar. Mantém o bloco compacto.`,
        `${awayTeam} está exposta nas laterais. Explora com cruzamentos.`,
        `Troca o volante se a fadiga subir mais — o ENGINE está no limite.`,
        `Bloquear o MAESTRO deles é a chave para o segundo tempo.`,
      ];
      setCoachMessages(prev => [...prev, { role: 'ai', text: replies[Math.floor(Math.random() * replies.length)] }]);
    }, 900);
  }, [chatInput, awayTeam]);

  const handleMentalSlider = useCallback((v: number) => {
    setMentalSlider(v);
    setMentalidade(v < 33 ? 'DEFENSIVO' : v < 67 ? 'EQUILIBRADO' : 'OFENSIVO');
  }, []);

  const toggleSkill = useCallback((id: string) => {
    setSkills(prev => prev.map(s => (s.id === id && s.remaining === 0) ? { ...s, active: true, remaining: s.cooldown } : s));
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

  // ── Render ─────────────────────────────────────────────────────────────────
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
        {/* ── [A] Status bar ─────────────────────────────────────────────── */}
        <div style={{ height: 22, background: '#0A0A0A', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 14px' }}>
          <span style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-accent)', letterSpacing:'0.24em', display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--c-danger)', display:'inline-block', animation:'c-pulse 1s infinite' }} />
            REC
          </span>
          <span style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-text-sec)', letterSpacing:'0.18em' }}>
            OLEFOOT · {competition}
          </span>
          <span style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-ok)', letterSpacing:'0.16em', display:'flex', alignItems:'center', gap:4 }}>
            <Wifi size={9} /> ONLINE
          </span>
        </div>

        {/* ── [B] Top bar — clock + crests ─────────────────────────────── */}
        <div style={{
          display:'grid', gridTemplateColumns:'auto 1fr auto',
          alignItems:'center', padding:'12px 14px', gap:14,
          background:'linear-gradient(180deg,#111 0%,#0D0D0D 100%)',
          borderBottom:'1px solid var(--c-border)', minHeight:104,
          position:'relative',
        }}>
          {/* HOME crest + initials */}
          <ClubCrest color="var(--c-team-home)" initials={homeShort} side="home" />

          {/* Center — clock em Moret italic */}
          <div style={{ textAlign:'center' }}>
            <div style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-text-sec)', letterSpacing:'0.24em', marginBottom:4 }}>JORNADA {round}</div>
            <div style={{ ...T_HERO, fontSize:44, color:'var(--c-accent)', lineHeight:1, letterSpacing:'-0.02em' }}>
              {padTime(minute)}:{padTime(seconds)}
            </div>
            <div style={{ display:'inline-block', ...T_DISPLAY, fontSize:11, fontWeight:700, color:'var(--c-text-primary)', borderBottom:'2px solid var(--c-accent)', paddingBottom:2, marginTop:5, letterSpacing:'0.18em' }}>
              {period}
            </div>
          </div>

          {/* AWAY crest + initials */}
          <ClubCrest color="var(--c-team-away)" initials={awayShort} side="away" />

          {/* Pause */}
          <button
            type="button"
            onClick={() => setRunning(r => !r)}
            aria-label={running ? 'Pausar partida' : 'Retomar partida'}
            style={{ position:'absolute', top:10, right:10, width:28, height:28, border:'1px solid var(--c-accent)', borderRadius:4, background:'transparent', color:'var(--c-accent)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
          >
            {running ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
          </button>
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

          {/* Player nodes (FIXED, no movement) */}
          {players.map(p => {
            const leftPct = (p.position.x / FIELD_W_LOGIC) * 100;
            const topPct  = (p.position.y / FIELD_H_LOGIC) * 100;
            const isHL = highlightPlayer?.id === p.id;
            const isLegacyTarget = legacyPulse?.player.id === p.id;
            const NODE = 26;
            return (
              <div key={p.id} style={{
                position:'absolute',
                left: `${leftPct}%`, top: `${topPct}%`,
                transform: 'translate(-50%,-50%)',
                width: NODE, height: NODE,
                borderRadius:'50%',
                border: `2px solid ${p.team === 'home' ? 'var(--c-team-home)' : 'var(--c-team-away)'}`,
                background: p.team === 'home' ? 'rgba(253,225,0,0.16)' : 'rgba(255,255,255,0.10)',
                color: p.team === 'home' ? 'var(--c-team-home)' : 'var(--c-team-away)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'var(--cf-body)', fontSize:10, fontWeight:700,
                pointerEvents:'none',
                animation: isLegacyTarget ? 'c-legacyCore 1.2s ease' : undefined,
                boxShadow: isHL && !isLegacyTarget
                  ? '0 0 0 3px rgba(253,225,0,0.5), 0 0 18px rgba(253,225,0,0.4)'
                  : '0 1px 4px rgba(0,0,0,0.4)',
                transition: 'box-shadow 0.3s',
                zIndex: isLegacyTarget ? 6 : isHL ? 5 : 2,
              }}>
                {p.number}
                {p.isStar && (
                  <Star size={10} color="var(--c-accent)" fill="currentColor" style={{ position:'absolute', top:-9, right:-5 }} />
                )}
                <span style={{
                  position:'absolute',
                  top:'calc(100% + 2px)',
                  left:'50%',
                  transform:'translateX(-50%)',
                  fontFamily:'var(--cf-body)',
                  fontSize:8, fontWeight:600,
                  color:'var(--c-text-primary)',
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

          {/* Field labels */}
          <div style={{ position:'absolute', top:8, left:8, background:'rgba(0,0,0,0.65)', border:'1px solid var(--c-border)', borderRadius:4, ...T_DISPLAY, fontSize:9, padding:'4px 9px', color:'var(--c-text-primary)', display:'flex', alignItems:'center', gap:6, letterSpacing:'0.16em' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--c-danger)', display:'inline-block', animation:'c-pulse 1s infinite' }} />
            REC · ACTION MOTION
          </div>
          <div style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.65)', border:'1px solid var(--c-accent)', borderRadius:4, ...T_DISPLAY, fontSize:9, padding:'4px 9px', color:'var(--c-accent)', letterSpacing:'0.16em', display:'flex', alignItems:'center', gap:4 }}>
            FOCO ATAQUE <ChevronRight size={11} />
          </div>
          <div style={{ position:'absolute', bottom:14, right:8, background:'rgba(0,0,0,0.65)', border:'1px solid var(--c-border)', borderRadius:4, ...T_DISPLAY, fontSize:9, padding:'4px 9px', color:'var(--c-accent)', letterSpacing:'0.12em', display:'flex', alignItems:'center', gap:4 }}>
            1X <ChevronRight size={11} />
          </div>

          {/* Mini heatmap */}
          <div style={{ position:'absolute', bottom:20, left:8, width:80, height:60, background:'rgba(0,0,0,0.75)', border:'1px solid var(--c-border)', borderRadius:4, overflow:'hidden' }}>
            <canvas ref={miniCanvasRef} width={80} height={60} style={{ position:'absolute', top:0, left:0 }} />
            <span style={{ position:'absolute', bottom:3, left:'50%', transform:'translateX(-50%)', ...T_DISPLAY, fontSize:7, color:'var(--c-text-muted)', letterSpacing:'0.14em', whiteSpace:'nowrap' }}>ZONA QUENTE</span>
          </div>

          {/* Possession timeline bar */}
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:4, background:'var(--c-bg-elevated)' }}>
            <div style={{ height:'100%', background:'var(--c-team-home)', width:`${stats.possession.home}%`, transition:'width 0.8s ease' }} />
          </div>
        </div>

        {/* ── [D] Placar expandido — team names em Moret · sem glow ───── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', background:'var(--c-bg-surface)', borderBottom:'1px solid var(--c-border)', gap:12 }}>
          <span style={{ ...T_HERO, fontSize:26, color:'var(--c-text-primary)', lineHeight:1, letterSpacing:'-0.02em', flex:1 }}>{homeTeam}</span>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
            <span style={{ ...T_HERO, fontSize:48, color:'var(--c-accent)', lineHeight:1, letterSpacing:'-0.04em' }}>{score.home}</span>
            <span style={{ fontFamily:'var(--cf-body)', fontSize:20, color:'var(--c-text-sec)', lineHeight:1 }}>—</span>
            <span style={{ ...T_HERO, fontSize:48, color:'var(--c-accent)', lineHeight:1, letterSpacing:'-0.04em' }}>{score.away}</span>
          </div>
          <span style={{ ...T_HERO, fontSize:26, color:'var(--c-text-primary)', lineHeight:1, letterSpacing:'-0.02em', flex:1, textAlign:'right' }}>{awayTeam}</span>
        </div>
        <div style={{ textAlign:'center', ...T_BODY, fontSize:11, color:'var(--c-text-sec)', padding:'4px 0 8px', background:'var(--c-bg-surface)', borderBottom:'1px solid var(--c-border)', fontVariantNumeric:'tabular-nums' }}>
          {padTime(minute)}:{padTime(seconds)}
        </div>

        {/* ── [E] Narrativa — APENAS 1 evento visível por vez ───────────── */}
        <div style={{ background:'var(--c-bg-surface)', borderBottom:'1px solid var(--c-border)', minHeight:54 }}>
          {latestEvent ? (
            <div
              key={latestEvent.id}
              style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 18px',
                animation:'c-fadeInDown 0.25s ease',
                background: latestEvent.type === 'goal' ? 'rgba(253,225,0,0.06)' : undefined,
                borderLeft:
                  latestEvent.type === 'goal' ? '3px solid var(--c-accent)'
                  : latestEvent.type === 'shot' || latestEvent.type === 'danger' ? '3px solid var(--c-danger)'
                  : '3px solid transparent',
              }}>
              <span style={{ ...T_BODY, fontSize:11, color:'var(--c-text-sec)', minWidth:24, fontVariantNumeric:'tabular-nums' }}>{latestEvent.minute}'</span>
              <span style={{ width:18, display:'flex', alignItems:'center', justifyContent:'center', color: latestEvent.type === 'goal' ? 'var(--c-accent)' : 'var(--c-text-sec)' }}>
                <EventIcon type={latestEvent.type} />
              </span>
              <span style={{ ...T_BODY, fontSize: latestEvent.type === 'goal' ? 15 : 13.5, fontWeight: latestEvent.type === 'goal' ? 700 : 500, color: latestEvent.type === 'goal' ? 'var(--c-accent)' : 'var(--c-text-primary)', flex:1, lineHeight:1.35 }}>
                {latestEvent.text}
              </span>
            </div>
          ) : (
            <div style={{ padding:'18px', ...T_BODY, fontSize:12, color:'var(--c-text-muted)', textAlign:'center' }}>
              Aguardando o apito inicial…
            </div>
          )}
        </div>

        {/* ── [F] Stats carousel ───────────────────────────────────────── */}
        <div style={{ display:'flex', overflowX:'auto', scrollSnapType:'x mandatory', gap:1, background:'var(--c-border)' }}>
          {[
            { label:'POSSE DE BOLA', home:stats.possession.home,    away:stats.possession.away,    fmt:(v:number)=>`${v}%` },
            { label:'FINALIZAÇÕES',  home:stats.shots.home,         away:stats.shots.away,         fmt:(v:number)=>`${v}`  },
            { label:'NO ALVO',       home:stats.shotsOnTarget.home, away:stats.shotsOnTarget.away, fmt:(v:number)=>`${v}`  },
            { label:'PASSES CERTOS', home:stats.passes.home,        away:stats.passes.away,        fmt:(v:number)=>`${v}`  },
            { label:'FALTAS',        home:stats.fouls.home,         away:stats.fouls.away,         fmt:(v:number)=>`${v}`  },
          ].map((stat, i) => {
            const total = stat.home + stat.away || 1;
            return (
              <div key={i} style={{ minWidth:122, flexShrink:0, background:'var(--c-bg-surface)', padding:'12px 14px', scrollSnapAlign:'start' }}>
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

        {/* ── [G] Painel tático — 3 cols (Mentalidade · Destaque · Skills) */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:1, background:'var(--c-border)' }}>
          {/* Mentalidade */}
          <div style={{ background:'var(--c-bg-surface)', padding:'12px 10px' }}>
            <div style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-accent)', letterSpacing:'0.24em', marginBottom:8 }}>MENTALIDADE</div>
            <div style={{ ...T_DISPLAY, fontSize:12, fontWeight:700, color:'var(--c-text-primary)', marginBottom:10, letterSpacing:'0.12em' }}>{mentalidade}</div>
            <input
              type="range" min={0} max={100} value={mentalSlider}
              onChange={e => handleMentalSlider(Number(e.target.value))}
              style={{ width:'100%', height:3, appearance:'none', background:`linear-gradient(to right, var(--c-accent) ${mentalSlider}%, var(--c-bg-elevated) ${mentalSlider}%)`, borderRadius:2, outline:'none', cursor:'pointer' }}
            />
            <div style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-accent)', letterSpacing:'0.24em', marginTop:14, marginBottom:4 }}>INTENSIDADE</div>
            <div style={{ ...T_DISPLAY, fontSize:11, color:'var(--c-text-primary)', marginBottom:6, letterSpacing:'0.10em' }}>ALTA</div>
            <input
              type="range" min={0} max={100} value={intensidade}
              onChange={e => setIntensidade(Number(e.target.value))}
              style={{ width:'100%', height:3, appearance:'none', background:`linear-gradient(to right, var(--c-accent) ${intensidade}%, var(--c-bg-elevated) ${intensidade}%)`, borderRadius:2, outline:'none', cursor:'pointer' }}
            />
          </div>

          {/* Destaque */}
          <div style={{ background:'var(--c-bg-surface)', padding:'12px 10px' }}>
            <div style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-accent)', letterSpacing:'0.24em', marginBottom:8 }}>DESTAQUE</div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <div style={{ width:34, height:34, borderRadius:4, background:'rgba(253,225,0,0.09)', border:'1px solid var(--c-accent)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Shield size={18} color="var(--c-accent)" />
              </div>
              <div>
                <div style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-accent)', letterSpacing:'0.12em', display:'flex', alignItems:'center', gap:3 }}>
                  <Star size={9} fill="currentColor" /> {star.shortName}
                </div>
                <div style={{ ...T_BODY, fontSize:10, color:'var(--c-text-sec)' }}>{star.role}</div>
              </div>
            </div>
            <div style={{ ...T_HERO, fontSize:26, color:'var(--c-accent)', textAlign:'center', marginBottom:8, letterSpacing:'-0.02em' }}>
              {(7.5 + (star.confidence / 100) * 2).toFixed(1)}
            </div>
            <div style={{ marginBottom:4 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                <span style={{ ...T_DISPLAY, fontSize:8, color:'var(--c-text-sec)', letterSpacing:'0.16em' }}>FADIGA</span>
                <span style={{ ...T_BODY, fontSize:8, color:'var(--c-text-sec)', fontVariantNumeric:'tabular-nums' }}>{star.fatigue}%</span>
              </div>
              <div style={{ height:4, background:'var(--c-bg-elevated)', borderRadius:2 }}>
                <div style={{ height:'100%', background:'var(--c-warning)', borderRadius:2, width:`${star.fatigue}%`, transition:'width 1s' }} />
              </div>
            </div>
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                <span style={{ ...T_DISPLAY, fontSize:8, color:'var(--c-text-sec)', letterSpacing:'0.16em' }}>CONFIANÇA</span>
                <span style={{ ...T_BODY, fontSize:8, color:'var(--c-text-sec)', fontVariantNumeric:'tabular-nums' }}>{star.confidence}%</span>
              </div>
              <div style={{ height:4, background:'var(--c-bg-elevated)', borderRadius:2 }}>
                <div style={{ height:'100%', background:'var(--c-ok)', borderRadius:2, width:`${star.confidence}%`, transition:'width 1s' }} />
              </div>
            </div>
          </div>

          {/* Skills */}
          <div style={{ background:'var(--c-bg-surface)', padding:'12px 10px' }}>
            <div style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-accent)', letterSpacing:'0.24em', marginBottom:8 }}>SKILLS</div>
            {skills.map(sk => (
              <button
                key={sk.id}
                type="button"
                onClick={() => toggleSkill(sk.id)}
                style={{
                  display:'flex', alignItems:'center', gap:5, width:'100%', padding:'6px 8px', marginBottom:4,
                  border: sk.active ? '1px solid var(--c-accent)' : '1px solid var(--c-border)',
                  borderRadius:4, background: sk.active ? 'rgba(253,225,0,0.07)' : 'transparent',
                  cursor: sk.remaining > 0 ? 'not-allowed' : 'pointer',
                  opacity: sk.remaining > 0 ? 0.55 : 1,
                  color: sk.active ? 'var(--c-accent)' : 'var(--c-text-primary)',
                }}
              >
                <SkillIcon icon={sk.icon} />
                <span style={{ ...T_DISPLAY, fontSize:8, fontWeight:700, textAlign:'left', flex:1, letterSpacing:'0.10em' }}>{sk.label}</span>
                <span style={{ ...T_BODY, fontSize:8, color:'var(--c-text-sec)', fontVariantNumeric:'tabular-nums' }}>
                  {sk.remaining > 0 ? `${sk.remaining}s` : `${sk.cooldown}s ›`}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── [H] Subs + Instruções (Coach IA removido — agora só no nav) ─ */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1, background:'var(--c-border)' }}>
          {/* Substituições */}
          <div style={{ background:'var(--c-bg-surface)', padding:'12px 14px' }}>
            <div style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-accent)', letterSpacing:'0.24em', marginBottom:8 }}>SUBSTITUIÇÕES</div>
            {SUBS_INIT.map(sub => (
              <div key={sub.number} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 0', borderBottom:'1px solid var(--c-border)' }}>
                <span style={{ ...T_BODY, fontSize:11, color:'var(--c-text-sec)', minWidth:18, fontVariantNumeric:'tabular-nums' }}>{sub.number}</span>
                <span style={{ ...T_DISPLAY, fontSize:11, fontWeight:700, color:'var(--c-text-primary)', letterSpacing:'0.08em', flex:1 }}>{sub.name}</span>
                <span style={{ ...T_BODY, fontSize:11, color:'var(--c-text-sec)', fontVariantNumeric:'tabular-nums' }}>{sub.fatigue}%</span>
                <span style={{ display:'flex', alignItems:'center', color: sub.trend === 'up' ? 'var(--c-ok)' : sub.trend === 'down' ? 'var(--c-danger)' : 'var(--c-text-sec)' }}>
                  {sub.trend === 'up' ? <ChevronUp size={12} /> : sub.trend === 'down' ? <ChevronDown size={12} /> : '—'}
                </span>
              </div>
            ))}
          </div>

          {/* Instruções */}
          <div style={{ background:'var(--c-bg-surface)', padding:'12px 14px' }}>
            <div style={{ ...T_DISPLAY, fontSize:9, color:'var(--c-accent)', letterSpacing:'0.24em', marginBottom:8 }}>INSTRUÇÕES</div>
            {INSTRUCTIONS.map(inst => (
              <div key={inst.id} style={{ ...T_DISPLAY, fontSize:11, fontWeight:600, color:'var(--c-text-primary)', letterSpacing:'0.08em', padding:'8px 0', borderBottom:'1px solid var(--c-border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span>{inst.label}</span>
                <ChevronRight size={12} color="var(--c-text-muted)" />
              </div>
            ))}
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
            { id:'coach',  label:'COACH AI',  Icon: Brain,       onClick: () => setCoachModal(true) },
            { id:'legacy', label:'LEGACY',    Icon: Sparkles,    onClick: triggerLegacy            },
            { id:'form',   label:'FORMAÇÃO', Icon: LayoutGrid,  onClick: () => setFormationModal(true) },
          ].map((tab, idx) => (
            <button
              key={tab.id}
              type="button"
              onClick={tab.onClick}
              style={{
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4,
                cursor:'pointer', position:'relative', background:'transparent', border:'none',
                color:'var(--c-accent)',
                borderLeft: idx > 0 ? '1px solid var(--c-border)' : 'none',
              }}
            >
              <tab.Icon size={20} strokeWidth={2} />
              <span style={{ ...T_DISPLAY, fontSize:9, fontWeight:800, letterSpacing:'0.18em', color:'var(--c-accent)' }}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>

        {/* ── Coach Modal — slide-up from bottom ────────────────────────── */}
        {coachModal && (
          <div role="dialog" aria-modal="true" aria-labelledby="coach-modal-title" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:200, display:'flex', flexDirection:'column' }} onClick={() => setCoachModal(false)}>
            <div
              onClick={e => e.stopPropagation()}
              style={{
                marginTop:'auto',
                background:'var(--c-bg-elevated)',
                borderTop:'3px solid var(--c-accent)',
                borderRadius:'16px 16px 0 0',
                animation:'c-slideUp 0.28s ease-out',
                padding:'18px 18px 24px',
                maxHeight:'85vh',
                display:'flex', flexDirection:'column',
              }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Brain size={18} color="var(--c-accent)" />
                  <span id="coach-modal-title" style={{ ...T_DISPLAY, fontSize:12, fontWeight:900, color:'var(--c-accent)', letterSpacing:'0.26em' }}>COACH AI</span>
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

              <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:10, marginBottom:12, minHeight:120, maxHeight:260 }}>
                {coachMessages.map((msg, i) => (
                  <div key={i} style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    background: msg.role === 'user' ? 'rgba(253,225,0,0.07)' : 'var(--c-bg-primary)',
                    border: msg.role === 'user' ? '1px solid var(--c-accent)' : '1px solid var(--c-border)',
                    borderLeft: msg.role === 'ai' ? '3px solid var(--c-accent)' : undefined,
                    borderRadius:8, padding:'10px 14px',
                    ...T_BODY, fontSize:13, color:'var(--c-text-primary)', maxWidth:'85%', lineHeight:1.5,
                  }}>
                    {msg.text}
                  </div>
                ))}
              </div>

              {/* Quick chips */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                {['O que sugeres?', 'Como parar o ataque deles?', 'Hora de substituir?', 'A pressão funciona?'].map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setChatInput(chip)}
                    style={{ padding:'6px 12px', border:'1px solid var(--c-border-accent)', borderRadius:20, ...T_BODY, fontSize:11, color:'var(--c-accent)', cursor:'pointer', background:'rgba(253,225,0,0.05)' }}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                  placeholder="Fala com o técnico…"
                  style={{ flex:1, background:'var(--c-bg-primary)', border:'1px solid var(--c-border)', borderRadius:4, padding:'10px 14px', color:'var(--c-text-primary)', ...T_BODY, fontSize:13, outline:'none' }}
                />
                <button
                  type="button"
                  onClick={sendChat}
                  aria-label="Enviar"
                  style={{ padding:'10px 16px', background:'var(--c-accent)', color:'#0D0D0D', border:'none', borderRadius:4, cursor:'pointer', display:'flex', alignItems:'center', gap:6, ...T_DISPLAY, fontSize:11, fontWeight:900, letterSpacing:'0.16em' }}
                >
                  <Send size={12} /> ENVIAR
                </button>
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
                      onClick={() => { setActiveFormation(f); setFormationModal(false); }}
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

              {onExit && (
                <div style={{ padding:'12px 18px 0', borderTop:'1px solid var(--c-border)' }}>
                  <button
                    type="button"
                    onClick={() => { setFormationModal(false); onExit(); }}
                    style={{ width:'100%', padding:'10px 0', background:'transparent', border:'1px solid var(--c-border)', color:'var(--c-text-sec)', borderRadius:4, cursor:'pointer', ...T_DISPLAY, fontSize:10, letterSpacing:'0.18em' }}
                  >
                    SAIR DA PARTIDA
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
