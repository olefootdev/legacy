/**
 * Partida ao vivo MVP: modo `test2d` — `TacticalSimLoop` + `SIM_SYNC`, campo 2D a partir do truth.
 */
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Gauge, Home, LayoutGrid, LogOut, RotateCcw, Scan, Tag, Trophy, Zap } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { getGameState, useGameDispatch, useGameStore } from '@/game/store';
import { evaluateOfficialSquad, isOfficialSquadGateRelaxedForTests } from '@/match/squadEligibility';
import { playerTokenSrc } from '@/lib/playerPortrait';
import { MatchInterruptOverlay } from '@/match/MatchInterruptOverlay';
import { MatchdayResultScores } from '@/components/matchday/MatchdayVersusTitle';
import { GoalTakeover } from '@/components/matchday/GoalTakeover';
import { LiveMatchClockDisplay } from '@/components/matchday/LiveMatchClockDisplay';
import { LiveMatchManagerPanel } from '@/components/matchday/LiveMatchManagerPanel';
import { LiveStatsPanel } from '@/components/matchday/LiveStatsPanel';
import { PitchNarrationOverlay } from '@/components/matchday/PitchNarrationOverlay';
import { CoachCommandInput } from '@/components/matchday/CoachCommandInput';
import { PenaltyKickModalV2 } from '@/match/PenaltyKickModalV2';
import { SetPieceModal } from '@/match/SetPieceModal';
import { matchdayHomeCrestUrl } from '@/settings/matchdayCrest';
import type { LiveMatchSnapshot, LiveMatchClockPeriod, PitchPlayerState } from '@/engine/types';
import { interpolateBallPosition, type BallTrajectoryState } from '@/engine/test2d/ballTrajectory';
import { computePitchTokenSeparation } from '@/engine/test2d/antiChaosEngine';
import { truthSnapshotToTest2dPitch, carrierIdToStoreOnBallId } from '@/engine/test2d/truthToTest2dPitch';
import { useLive2dTacticalSim, LIVE2D_RENDER_INTERVAL_MS } from '@/pages/useLive2dTacticalSim';
import { tryAutoAttachFromWindow } from '@/bridge/babylonPlayerVisualsIntegration';
import { buildHomeStaffMatchBonuses, buildActivePlayerStaffBoosts } from '@/systems/staffBenefits';
import { cn } from '@/lib/utils';
import {
  loadZoneView18Pref,
  saveZoneView18Pref,
} from '@/components/matchday/TacticalPitchDevLayer';
import {
  calculateTacticalRadius,
  calculatePassConnections,
  calculatePlayerAwareness,
  type PassConnection,
  type PlayerAwareness,
} from '@/match/tacticalAwareness';
import '@/styles/field2d.css';
import { Live2dPlayerVision } from '@/components/matchday/Live2dPlayerVision';
import { PlayerVoiceBubble } from '@/components/matchday/PlayerResponseBubble';
import { LivePlayerInfoPanel } from '@/components/matchday/LivePlayerInfoPanel';
import {
  computePitchCameraRig,
  loadLive2dPitchCamera,
  saveLive2dPitchCamera,
  type Live2dPitchCameraMode,
} from '@/match/live2dPitchCamera';
import { LIVE2D_ENERGY_HALO_UI_MS, LIVE2D_FATIGUE_ALERT_THRESHOLD } from '@/match/matchSimulationTuning';
import {
  fetchFriendlyChallengeById,
  userParticipatesInChallenge,
} from '@/supabase/friendlyChallenges';
import { MomentumFieldEffect } from '@/components/matchday/MomentumFieldEffect';

const LIVE_MATCH_ENGINE_MODE = 'test2d' as const;

/** Barra compacta em /match/live: campo tático + zonas + câmaras + alertas de fadiga (extensível). */
const LIVE_MATCH_FIELD_TOOLBAR_MAX = 7;
const LIVE2D_NAMES_STORAGE_KEY = 'olefoot_live2d_names';

function loadLive2dNamesPref(): boolean {
  try { return localStorage.getItem(LIVE2D_NAMES_STORAGE_KEY) === '1'; } catch { return false; }
}
function saveLive2dNamesPref(on: boolean): void {
  try { localStorage.setItem(LIVE2D_NAMES_STORAGE_KEY, on ? '1' : '0'); } catch { /* ignore */ }
}

const LIVE2D_ENERGY_MAP_STORAGE_KEY = 'olefoot_live2d_energy_map';

function loadLive2dEnergyMapPref(): boolean {
  try {
    return localStorage.getItem(LIVE2D_ENERGY_MAP_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveLive2dEnergyMapPref(on: boolean): void {
  try {
    localStorage.setItem(LIVE2D_ENERGY_MAP_STORAGE_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Só jogadores cansados: pin de alerta (sem anel no token — substituição). */
function Live2dPlayerFatigueAlert({
  playerId,
  fatigue,
}: {
  playerId: string;
  fatigue: number;
}) {
  // BUG FIX #6: Validar fatigue para evitar NaN propagation
  const safeFatigue = Number.isFinite(fatigue) ? fatigue : 0;
  const latestRef = useRef(safeFatigue);
  latestRef.current = safeFatigue;
  const [shownFatigue, setShownFatigue] = useState(() => Math.round(safeFatigue));

  useEffect(() => {
    setShownFatigue(Math.round(safeFatigue));
  }, [playerId, safeFatigue]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const current = latestRef.current;
      if (Number.isFinite(current)) {
        setShownFatigue(Math.round(current));
      }
    }, LIVE2D_ENERGY_HALO_UI_MS);
    return () => window.clearInterval(id);
  }, []);

  if (shownFatigue < LIVE2D_FATIGUE_ALERT_THRESHOLD) return null;

  const energyApprox = Math.round(100 - Math.max(0, Math.min(100, shownFatigue)));
  const fatigueTitle = `Cansado (~${energyApprox}% energia, fadiga ${shownFatigue}%) — considere substituir`;
  return (
    <div
      className={cn(
        'pointer-events-none absolute -right-0.5 -top-0.5 z-[2] flex h-3.5 w-3.5 items-center justify-center',
        'rounded-full bg-red-600 text-white shadow-sm ring-1 ring-white/90 sm:h-4 sm:w-4',
      )}
      title={fatigueTitle}
      aria-label={fatigueTitle}
    >
      <AlertTriangle className="h-2 w-2 shrink-0 sm:h-2.5 sm:w-2.5" strokeWidth={2.5} aria-hidden />
    </div>
  );
}

export interface Live2dShellConfig {
  productLabel: string;
  productSub: string;
}

const FIRST_HALF_MS = 60_000;
const HALFTIME_MS = 5_000;
const MINUTES_PER_HALF = 45;
const MS_PER_MINUTE = Math.round(FIRST_HALF_MS / MINUTES_PER_HALF);
const HALFTIME_TICK_START = Math.round(HALFTIME_MS / 1_000);
const GOAL_FREEZE_MS = 2_000;
/** Contagem regressiva antes do apito (1.2 s por número + prelúdio "Preparados?"). */
const TEST2D_KICKOFF_COUNTDOWN_SEC = 3;
const TEST2D_KICKOFF_STEP_MS = 1_200;
const TEST2D_KICKOFF_MESSAGE_MS = 1_400;
const TEST2D_KICKOFF_PRELUDE_MS = 900;

/** `runMatchMinute` / `pitchFromLineup` usam coordenadas ~0–100 no plano do campo (não 0–1). */
function pitchPlanePercent(v: number): number {
  if (!Number.isFinite(v)) return 50;
  return Math.min(100, Math.max(0, v));
}

function distPlayerBallPct(
  px: number,
  py: number,
  bx: number,
  by: number,
): number {
  return Math.hypot(px - bx, py - by);
}

/** Find the player nearest to a point (for away on-ball detection). */
function nearestToPoint(
  players: PitchPlayerState[],
  pt: { x: number; y: number },
): PitchPlayerState | undefined {
  if (!players.length) return undefined;
  let best = players[0]!;
  let bestD = 1e9;
  for (const p of players) {
    const d = Math.hypot(p.x - pt.x, p.y - pt.y);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/**
 * CSS transition durations para tokens:
 * - Players: ease-out 120ms — natural deceleration, hides per-frame jitter sem “arrastar”
 * - Ball: linear mais curto para seguir trajectória real; ease-out em passes longos
 */
const TOKEN_MOVE_MS = 120;
const BALL_BASE_MOVE_MS = Math.round(LIVE2D_RENDER_INTERVAL_MS * 1.75); // ~42ms para bola regular

type Test2dKickoffPhase = 'ready' | 5 | 4 | 3 | 2 | 1 | 'kickoff' | null;

function isBlockingNonQuickMatch(live: { mode?: string }): boolean {
  return live.mode === 'auto';
}

interface EndSummary {
  homeShort: string;
  awayShort: string;
  homeName?: string;
  awayName?: string;
  homeScore: number;
  awayScore: number;
  events: { id: string; text: string }[];
}

type HomePlayerTokenProps = {
  p: PitchPlayerState;
  portraitUrl?: string;
  onBall: boolean;
  nudge: { dx: number; dy: number };
  reducedMotion: boolean;
  showVisionBeam: boolean;
  visionPx: number;
  visionPy: number;
  ballPercent: { x: number; y: number };
  clockPeriod: LiveMatchClockPeriod | undefined;
  distBallPct: number;
  showEnergyMap: boolean;
  showNames: boolean;
  showActionRadius: boolean;
  role?: string;
  awareness?: PlayerAwareness;
  onSelect?: (p: PitchPlayerState) => void;
};

function homePlayerTokenPropsEqual(a: HomePlayerTokenProps, b: HomePlayerTokenProps): boolean {
  return (
    a.p.playerId === b.p.playerId &&
    a.p.x === b.p.x &&
    a.p.y === b.p.y &&
    a.p.name === b.p.name &&
    a.p.num === b.p.num &&
    a.portraitUrl === b.portraitUrl &&
    a.onBall === b.onBall &&
    a.nudge.dx === b.nudge.dx &&
    a.nudge.dy === b.nudge.dy &&
    a.reducedMotion === b.reducedMotion &&
    a.showVisionBeam === b.showVisionBeam &&
    a.visionPx === b.visionPx &&
    a.visionPy === b.visionPy &&
    a.ballPercent.x === b.ballPercent.x &&
    a.ballPercent.y === b.ballPercent.y &&
    a.clockPeriod === b.clockPeriod &&
    a.distBallPct === b.distBallPct &&
    a.showEnergyMap === b.showEnergyMap &&
    a.showNames === b.showNames &&
    a.showActionRadius === b.showActionRadius &&
    a.role === b.role &&
    a.awareness?.isIsolated === b.awareness?.isIsolated &&
    a.awareness?.supportQuality === b.awareness?.supportQuality &&
    a.p.fatigue === b.p.fatigue &&
    a.onSelect === b.onSelect
  );
}

const Test2dHomePlayerToken = memo(function Test2dHomePlayerToken({
  p,
  portraitUrl,
  onBall,
  nudge,
  reducedMotion,
  showVisionBeam,
  visionPx,
  visionPy,
  ballPercent,
  clockPeriod,
  distBallPct,
  showEnergyMap,
  showNames,
  showActionRadius,
  role,
  awareness,
  onSelect,
}: HomePlayerTokenProps) {
  const left = pitchPlanePercent(p.x) + nudge.dx;
  const top = pitchPlanePercent(p.y) + nudge.dy;

  // Calcula raio tático avançado
  const tacticalRadius = showActionRadius && role
    ? calculateTacticalRadius(p, role)
    : null;

  // P1: animate transform only (composite-only, no layout/paint).
  const motionCss =
    reducedMotion || TOKEN_MOVE_MS <= 0
      ? undefined
      : (`transform ${TOKEN_MOVE_MS}ms ease-out` as const);
  return (
    <div
      className="absolute left-0 top-0"
      style={{
        zIndex: onBall ? 4 : 3,
        transform: `translate3d(${left}cqw, ${top}cqh, 0) translate(-50%, -50%)`,
        transition: motionCss,
        willChange: reducedMotion ? undefined : ('transform' as const),
        backfaceVisibility: 'hidden',
        cursor: onSelect ? 'pointer' : undefined,
      }}
      onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(p); } : undefined}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p); } } : undefined}
      aria-label={onSelect ? `Selecionar ${p.name}` : undefined}
    >
      {showVisionBeam ? (
        <Live2dPlayerVision
          player={p}
          px={visionPx}
          py={visionPy}
          ballPercent={ballPercent}
          clockPeriod={clockPeriod}
          side="home"
          onBall={onBall}
          distBallPct={distBallPct}
        />
      ) : null}
      {showActionRadius && tacticalRadius ? (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: `${tacticalRadius.radiusCqw * 2}cqw`,
            height: `${tacticalRadius.radiusCqw * 2}cqh`,
            zIndex: 0,
          }}
          title={`${p.name} - ${role} - Raio: ${Math.round(tacticalRadius.radiusMeters)}m${awareness?.isIsolated ? ' (ISOLADO)' : ''}`}
        >
          <div
            className={cn(
              'h-full w-full rounded-full border border-dashed transition-all duration-300',
              awareness?.isIsolated && 'ring-2 ring-red-500/40 animate-pulse',
            )}
            style={{
              borderColor: `${tacticalRadius.color}${Math.round(tacticalRadius.opacity * 255).toString(16).padStart(2, '0')}`,
              backgroundColor: `${tacticalRadius.color}${Math.round(tacticalRadius.opacity * 0.15 * 255).toString(16).padStart(2, '0')}`,
            }}
          />
        </div>
      ) : null}
      <div className="relative inline-flex h-[1.584rem] w-[1.584rem] shrink-0 items-center justify-center sm:h-[2.076rem] sm:w-[2.076rem]">
        <PlayerVoiceBubble playerId={p.playerId} />
        {showEnergyMap ? <Live2dPlayerFatigueAlert playerId={p.playerId} fatigue={p.fatigue} /> : null}
        <div
          className={cn(
            'relative z-[1] flex h-full w-full items-center justify-center overflow-hidden rounded-full border-[1.5px] bg-black/55 transition-shadow',
            onBall
              ? 'border-neon-yellow ring-[1.5px] ring-neon-yellow/50 shadow-[0_0_12px_rgba(253,225,0,0.35)]'
              : 'border-white/75 shadow-[0_3px_9px_rgba(0,0,0,0.5)]',
            onSelect && 'hover:ring-2 hover:ring-cyan-400/50 hover:shadow-[0_0_14px_rgba(34,211,238,0.3)]',
          )}
          title={`${p.num} ${p.name}`}
        >
          {portraitUrl ? (
            <img
              src={portraitUrl}
              alt=""
              className="h-full w-full object-cover object-top"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-[6px] sm:text-[7px] font-black text-white">{p.num}</span>
          )}
        </div>
        {showNames ? (
          <span
            className="pointer-events-none absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded-sm bg-black/75 px-1 font-display text-[7px] font-bold uppercase tracking-wider text-neon-yellow shadow-[0_1px_3px_rgba(0,0,0,0.6)] sm:mt-1 sm:text-[8px]"
            aria-hidden
          >
            {firstNameFor(p.name)}
          </span>
        ) : null}
      </div>
    </div>
  );
}, homePlayerTokenPropsEqual);

function firstNameFor(full: string): string {
  const t = full.trim().split(/\s+/)[0] ?? full;
  return t.length > 10 ? `${t.slice(0, 9)}…` : t;
}

type AwayPlayerTokenProps = Omit<HomePlayerTokenProps, 'portraitUrl' | 'onSelect'>;

function awayPlayerTokenPropsEqual(a: AwayPlayerTokenProps, b: AwayPlayerTokenProps): boolean {
  return (
    a.p.playerId === b.p.playerId &&
    a.p.x === b.p.x &&
    a.p.y === b.p.y &&
    a.p.name === b.p.name &&
    a.p.num === b.p.num &&
    a.onBall === b.onBall &&
    a.nudge.dx === b.nudge.dx &&
    a.nudge.dy === b.nudge.dy &&
    a.reducedMotion === b.reducedMotion &&
    a.showVisionBeam === b.showVisionBeam &&
    a.visionPx === b.visionPx &&
    a.visionPy === b.visionPy &&
    a.ballPercent.x === b.ballPercent.x &&
    a.ballPercent.y === b.ballPercent.y &&
    a.clockPeriod === b.clockPeriod &&
    a.distBallPct === b.distBallPct &&
    a.showEnergyMap === b.showEnergyMap &&
    a.showNames === b.showNames &&
    a.showActionRadius === b.showActionRadius &&
    a.role === b.role &&
    a.awareness?.isIsolated === b.awareness?.isIsolated &&
    a.awareness?.supportQuality === b.awareness?.supportQuality &&
    a.p.fatigue === b.p.fatigue
  );
}

const Test2dAwayPlayerToken = memo(function Test2dAwayPlayerToken({
  p,
  onBall,
  nudge,
  reducedMotion,
  showVisionBeam,
  visionPx,
  visionPy,
  ballPercent,
  clockPeriod,
  distBallPct,
  showEnergyMap,
  showNames,
  showActionRadius,
  role,
  awareness,
}: AwayPlayerTokenProps) {
  const left = pitchPlanePercent(p.x) + nudge.dx;
  const top = pitchPlanePercent(p.y) + nudge.dy;

  // Calcula raio tático avançado
  const tacticalRadius = showActionRadius && role
    ? calculateTacticalRadius(p, role)
    : null;

  // P1: animate transform only (composite-only, no layout/paint).
  const motionCss =
    reducedMotion || TOKEN_MOVE_MS <= 0
      ? undefined
      : (`transform ${TOKEN_MOVE_MS}ms ease-out` as const);
  return (
    <div
      className="absolute left-0 top-0"
      style={{
        zIndex: onBall ? 4 : 2,
        transform: `translate3d(${left}cqw, ${top}cqh, 0) translate(-50%, -50%)`,
        transition: motionCss,
        willChange: reducedMotion ? undefined : ('transform' as const),
        backfaceVisibility: 'hidden',
      }}
    >
      {showVisionBeam ? (
        <Live2dPlayerVision
          player={p}
          px={visionPx}
          py={visionPy}
          ballPercent={ballPercent}
          clockPeriod={clockPeriod}
          side="away"
          onBall={onBall}
          distBallPct={distBallPct}
        />
      ) : null}
      {showActionRadius && tacticalRadius ? (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: `${tacticalRadius.radiusCqw * 2}cqw`,
            height: `${tacticalRadius.radiusCqw * 2}cqh`,
            zIndex: 0,
          }}
          title={`${p.name} - ${role} - Raio: ${Math.round(tacticalRadius.radiusMeters)}m${awareness?.isIsolated ? ' (ISOLADO)' : ''}`}
        >
          <div
            className={cn(
              'h-full w-full rounded-full border border-dashed transition-all duration-300',
              awareness?.isIsolated && 'ring-2 ring-red-500/40 animate-pulse',
            )}
            style={{
              borderColor: `${tacticalRadius.color}${Math.round(tacticalRadius.opacity * 255).toString(16).padStart(2, '0')}`,
              backgroundColor: `${tacticalRadius.color}${Math.round(tacticalRadius.opacity * 0.15 * 255).toString(16).padStart(2, '0')}`,
            }}
          />
        </div>
      ) : null}
      <div className="relative inline-flex h-[1.584rem] w-[1.584rem] shrink-0 items-center justify-center sm:h-[2.076rem] sm:w-[2.076rem]">
        <PlayerVoiceBubble playerId={p.playerId} />
        {showEnergyMap ? <Live2dPlayerFatigueAlert playerId={p.playerId} fatigue={p.fatigue} /> : null}
        <div
          className={cn(
            'relative z-[1] flex h-full w-full items-center justify-center rounded-full border-[1.5px] text-[6px] sm:text-[7px] font-black tabular-nums shadow-[0_3px_9px_rgba(0,0,0,0.55)]',
            onBall
              ? 'border-rose-300 bg-gradient-to-b from-rose-700/95 to-rose-950/90 text-white ring-[1.5px] ring-rose-400/40'
              : 'border-rose-400/90 bg-gradient-to-b from-rose-900/95 to-black/80 text-rose-50',
          )}
          title={`${p.num} ${p.name} (visitante)`}
        >
          {p.num}
        </div>
        {showNames ? (
          <span
            className="pointer-events-none absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded-sm bg-black/75 px-1 font-display text-[7px] font-bold uppercase tracking-wider text-rose-200 shadow-[0_1px_3px_rgba(0,0,0,0.6)] sm:mt-1 sm:text-[8px]"
            aria-hidden
          >
            {firstNameFor(p.name)}
          </span>
        ) : null}
      </div>
    </div>
  );
}, awayPlayerTokenPropsEqual);

type BallTokenProps = {
  x: number;
  y: number;
  trajectoryKind?: string;
  /** Ball height above ground in metres (0 = on ground). */
  heightM?: number;
  reducedMotion: boolean;
};

function ballTokenPropsEqual(a: BallTokenProps, b: BallTokenProps): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.trajectoryKind === b.trajectoryKind &&
    (a.heightM ?? 0) === (b.heightM ?? 0) &&
    a.reducedMotion === b.reducedMotion
  );
}

const Test2dBallToken = memo(function Test2dBallToken({
  x,
  y,
  trajectoryKind,
  heightM,
  reducedMotion,
}: BallTokenProps) {
  const left = pitchPlanePercent(x);
  const top = pitchPlanePercent(y);
  // Variety seed — bumpa a cada nova ação detectada (transição de trajectoryKind).
  // Resultado: cada chute/passe gira com direção e padrão diferentes.
  const prevKindRef = useRef<string | undefined>(undefined);
  const seedRef = useRef(0);
  if (prevKindRef.current !== trajectoryKind) {
    if (trajectoryKind) {
      seedRef.current = (seedRef.current + 1) % 4;
    }
    prevKindRef.current = trajectoryKind;
  }
  const variantIdx = seedRef.current;
  const spinName = variantIdx % 2 === 0 ? 'olefoot-ball-rotate' : 'olefoot-ball-tumble';
  const spinDir = variantIdx < 2 ? 'normal' : 'reverse';
  const speed =
    trajectoryKind === 'shot'
      ? 42
      : trajectoryKind === 'pass_long' || trajectoryKind === 'cross'
        ? 68
        : trajectoryKind === 'carry'
          ? 100
          : BALL_BASE_MOVE_MS;
  // P1: animate transform only.
  const motionPos =
    reducedMotion || speed <= 0 ? undefined : (`transform ${speed}ms linear` as const);
  const motionInner =
    reducedMotion || speed <= 0 ? undefined : (`transform ${speed}ms linear` as const);
  const h = Math.max(0, heightM ?? 0);
  const airborne = h > 0.15;
  const ballScale = 1 + Math.min(h * 0.06, 0.28);
  const ballLiftPx = h * 2.8;

  const shadowW = 4 + Math.min(h * 0.8, 3);
  const shadowH = 2 + Math.min(h * 0.3, 1.5);
  const shadowBlur = 0.5 + Math.min(h * 0.3, 1.5);
  const shadowOpacity = Math.max(0.04, 0.25 - h * 0.03);

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-[4]"
      style={{
        transform: `translate3d(${left}cqw, ${top}cqh, 0) translate(-50%, -50%)`,
        transition: motionPos,
        willChange: reducedMotion ? undefined : ('transform' as const),
        backfaceVisibility: 'hidden',
      }}
      aria-hidden
    >
      {/* Ground shadow — always rendered, stays fixed at ground level */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: `${shadowW}px`,
          height: `${shadowH}px`,
          opacity: shadowOpacity,
          background: 'radial-gradient(ellipse at center, #000 0%, transparent 70%)',
          filter: `blur(${shadowBlur}px)`,
        }}
      />
      {/* Ball sprite — OLEFOOT ball, com vida: sempre girando quando em movimento, padrão varia a cada ação */}
      {(() => {
        const isShot = trajectoryKind === 'shot';
        const isLong = trajectoryKind === 'pass_long' || trajectoryKind === 'cross';
        const isCarry = trajectoryKind === 'carry' || trajectoryKind === 'pass_short';
        const isMoving = Boolean(trajectoryKind);
        // Velocidade do giro proporcional à intensidade do movimento.
        const rotateDur = isShot ? 0.16 : isLong ? 0.38 : isCarry ? 0.8 : isMoving ? 1.4 : 3.2;
        const blurPx = isShot ? 0.9 : isLong ? 0.45 : 0;
        const glowClass = isShot
          ? 'drop-shadow-[0_0_14px_rgba(253,225,0,0.85)] drop-shadow-[0_0_6px_rgba(255,255,255,0.6)] drop-shadow-[0_3px_5px_rgba(0,0,0,0.4)]'
          : isLong
            ? 'drop-shadow-[0_0_10px_rgba(255,255,255,0.6)] drop-shadow-[0_2px_4px_rgba(0,0,0,0.38)]'
            : airborne
              ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.55)] drop-shadow-[0_3px_4px_rgba(0,0,0,0.4)]'
              : 'drop-shadow-[0_0_5px_rgba(255,255,255,0.4)] drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]';
        const punchMult = isShot ? 1.15 : isLong ? 1.06 : 1;
        return (
          <div
            className={cn('h-4 w-4 sm:h-5 sm:w-5', glowClass)}
            style={{
              transform: `scale(${ballScale * punchMult}) translateY(${-ballLiftPx}px)`,
              transition: motionInner,
              willChange: reducedMotion ? undefined : 'transform',
              animation: reducedMotion || !isShot ? undefined : 'olefoot-ball-pulse 0.4s ease-out infinite alternate',
            }}
          >
            <img
              src="/assets/soccer-ball-256.png"
              alt=""
              className="h-full w-full select-none"
              draggable={false}
              style={{
                filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
                animation: reducedMotion
                  ? undefined
                  : `${spinName} ${rotateDur}s linear infinite ${spinDir}`,
                willChange: reducedMotion ? undefined : 'transform',
              }}
            />
          </div>
        );
      })()}
    </div>
  );
}, ballTokenPropsEqual);

export function Live2dMatchShell({ config }: { config: Live2dShellConfig }) {
  const [searchParams] = useSearchParams();
  const fcParam = searchParams.get('fc');
  const { productLabel, productSub } = config;
  const usesLive2dTacticalEngine = true;
  const navigate = useNavigate();
  const dispatch = useGameDispatch();

  // P7: useShallow consolidates 12 selectors into 1, reducing Zustand subscribers
  const { live, playersById, lineupIds, fixture, tacticalMentality, defensiveLine, tempo, tacticalStyle, pressing, staff, tacticalObedience, managerRelationByPlayer } = useGameStore(
    useShallow((s) => ({
      live: s.liveMatch,
      playersById: s.players,
      lineupIds: s.lineup,
      fixture: s.nextFixture,
      tacticalMentality: s.manager.tacticalMentality,
      defensiveLine: s.manager.defensiveLine,
      tempo: s.manager.tempo,
      tacticalStyle: s.manager.tacticalStyle,
      pressing: s.manager.pressing,
      staff: s.manager.staff,
      tacticalObedience: s.tacticalObedience,
      managerRelationByPlayer: s.managerRelationByPlayer,
    }))
  );

  // Brasão do time do coração
  const homeCrestUrl = useGameStore((s) => matchdayHomeCrestUrl(s.userSettings));

  const homeStaffMatch = useMemo(
    () => buildHomeStaffMatchBonuses(staff, { isHomeFixture: fixture.isHome }),
    [staff, fixture.isHome],
  );
  const homeStaffPlayerBoosts = useMemo(() => buildActivePlayerStaffBoosts(staff), [staff]);
  const manager = useMemo(
    () => ({
      tacticalMentality,
      defensiveLine,
      tempo,
      tacticalStyle,
      pressing,
      isHomeFixture: fixture.isHome,
      homeStaffMatch,
      homeStaffPlayerBoosts,
    }),
    [tacticalMentality, defensiveLine, tempo, tacticalStyle, pressing, fixture.isHome, homeStaffMatch, homeStaffPlayerBoosts],
  );

  const [session, setSession] = useState(0);
  const [halfTimeUi, setHalfTimeUi] = useState(false);
  const [summary, setSummary] = useState<EndSummary | null>(null);
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [halfTimeTick, setHalfTimeTick] = useState(HALFTIME_TICK_START);
  const [quickPreStart, setQuickPreStart] = useState<Test2dKickoffPhase>(
    TEST2D_KICKOFF_COUNTDOWN_SEC > 0 ? 'ready' : null,
  );
  const [preGoalActive, setPreGoalActive] = useState(false);
  const [, setMomentumAnimKey] = useState<string | null>(null);
  const [goalTakeoverKey, setGoalTakeoverKey] = useState<string | null>(null);
  const [goalCelebrationActive, setGoalCelebrationActive] = useState(false);
  const [zoneView18, setZoneView18] = useState(loadZoneView18Pref);
  const [pitchCameraMode, setPitchCameraMode] = useState<Live2dPitchCameraMode>(() => loadLive2dPitchCamera());
  const [energyMapOn, setEnergyMapOn] = useState(loadLive2dEnergyMapPref);
  const [namesOn, setNamesOn] = useState(loadLive2dNamesPref);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PitchPlayerState | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setPrefersReducedMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const tacticalLive2dEnabled =
    usesLive2dTacticalEngine && live?.phase === 'playing' && quickPreStart === null;
  const { loopRef: tacticalLive2dLoopRef, truthSnap, carrierSimId, fatigue: simFatigue } = useLive2dTacticalSim({
    enabled: tacticalLive2dEnabled,
    session,
    live,
    manager,
  });

  const truthSnapRef = useRef(truthSnap);
  truthSnapRef.current = truthSnap;

  const tacticalPitchFromTruth = useMemo(() => {
    if (!usesLive2dTacticalEngine || !truthSnap?.players?.length || !live?.homePlayers?.length) {
      return null;
    }
    return truthSnapshotToTest2dPitch({
      snap: truthSnap,
      homePlayers: live.homePlayers,
      awayRoster: live.awayRoster ?? [],
    });
  }, [usesLive2dTacticalEngine, truthSnap, live?.homePlayers, live?.awayRoster]);

  const pitch = tacticalPitchFromTruth?.homePitch ?? live?.homePlayers ?? [];

  // Penalty bridge — TacticalSimLoop detecta falta dentro da grande área e dispara o modal via reducer.
  useEffect(() => {
    const loop = tacticalLive2dLoopRef.current;
    if (!loop) return;
    loop.setOnPenaltyAwarded((info) => {
      // BUG FIX #7: Validação defensiva completa para penalty award
      const st = getGameState();
      if (!st || !st.players || !st.lineup) {
        console.error('[Penalty] Estado inválido:', st);
        return;
      }

      let takerName = info.takerName;
      let takerId = info.takerId;

      if (info.attackingSide === 'home') {
        const p = st.players[info.victimId];
        if (p) {
          takerName = p.name;
          takerId = p.id;
        } else {
          // Fallback: melhor finalizador entre os titulares
          const lineup = Object.values(st.lineup ?? {}).filter((id): id is string => typeof id === 'string');
          const candidates = lineup
            .map((pid) => st.players[pid])
            .filter((pl): pl is NonNullable<typeof pl> => pl != null && pl.attrs?.finalizacao != null);

          if (candidates.length === 0) {
            console.error('[Penalty] Nenhum batedor válido encontrado');
            return;
          }

          const candidate = candidates.sort((a, b) => (b.attrs.finalizacao ?? 0) - (a.attrs.finalizacao ?? 0))[0];
          if (candidate) {
            takerName = candidate.name;
            takerId = candidate.id;
          }
        }
      } else {
        const ro = st.liveMatch?.awayRoster?.find((r) => r.id === info.victimId);
        if (ro) {
          takerName = ro.name;
          takerId = ro.id;
        }
      }

      // Validar que temos batedor válido antes de disparar
      if (!takerId || !takerName) {
        console.error('[Penalty] Batedor inválido:', { takerId, takerName });
        return;
      }

      dispatch({
        type: 'AWARD_LIVE_PENALTY',
        attackingSide: info.attackingSide,
        takerId,
        takerName,
        minute: info.minute,
      });
    });
    return () => {
      loop.setOnPenaltyAwarded(null);
    };
  }, [tacticalLive2dLoopRef, dispatch]);

  useEffect(() => {
    // Um único attach por sessão: `truthSnap` muda a cada frame do sim; refs evitam dispose/reattach em loop.
    const attached = tryAutoAttachFromWindow(() => truthSnapRef.current);
    return () => {
      try {
        attached && attached.dispose && attached.dispose();
      } catch {
        /* ignore */
      }
    };
  }, [session]);

  const htRef = useRef(0);
  const htTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalizedRef = useRef(false);
  const freezeUntilRef = useRef(0);
  const lastSeenGoalEventIdRef = useRef<string | null>(null);
  const preKickoffTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [fcGate, setFcGate] = useState<'off' | 'pending' | 'ok' | 'fail'>('off');
  const fcSeedRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!fcParam) {
      setFcGate('off');
      fcSeedRef.current = undefined;
      return;
    }
    let cancelled = false;
    setFcGate('pending');
    void (async () => {
      const row = await fetchFriendlyChallengeById(fcParam);
      if (cancelled) return;
      if (!row || row.status !== 'accepted') {
        setFcGate('fail');
        return;
      }
      const ok = await userParticipatesInChallenge(row);
      if (cancelled || !ok) {
        setFcGate('fail');
        return;
      }
      fcSeedRef.current =
        row.simulation_seed != null && Number.isFinite(Number(row.simulation_seed))
          ? Math.floor(Number(row.simulation_seed))
          : undefined;
      setFcGate('ok');
    })();
    return () => {
      cancelled = true;
    };
  }, [fcParam]);

  useEffect(() => {
    if (fcGate === 'fail') {
      navigate('/', { replace: true });
    }
  }, [fcGate, navigate]);

  useEffect(() => {
    if (fcParam && fcGate !== 'ok') return;
    finalizedRef.current = false;
    setSummary(null);
    htRef.current = 0;
    setHalfTimeUi(false);
    setHalfTimeTick(HALFTIME_TICK_START);
    freezeUntilRef.current = 0;
    lastSeenGoalEventIdRef.current = null;
    setMomentumAnimKey(null);
    setPreGoalActive(false);
    setQuickPreStart(
      TEST2D_KICKOFF_COUNTDOWN_SEC > 0 ? 'ready' : null,
    );
    preKickoffTimersRef.current.forEach(clearTimeout);
    preKickoffTimersRef.current = [];
    dispatch({
      type: 'START_LIVE_MATCH',
      mode: LIVE_MATCH_ENGINE_MODE,
      ...(fcSeedRef.current != null ? { simulationSeed: fcSeedRef.current } : {}),
    });

    const clearIv = () => {
      if (ivRef.current) {
        clearInterval(ivRef.current);
        ivRef.current = null;
      }
    };

    const tick = () => {
      dispatch({ type: 'TICK_MATCH_MINUTE' });
    };

    const loop = () => {
      clearIv();
      if (usesLive2dTacticalEngine) {
        return;
      }
      ivRef.current = setInterval(() => {
        const lm = getGameState().liveMatch;
        if (!lm || lm.phase !== 'playing') {
          clearIv();
          return;
        }
        if (lm.minute >= 90) {
          clearIv();
          return;
        }
        if (Date.now() < freezeUntilRef.current) {
          return;
        }

        if (lm.minute === 45 && htRef.current === 0) {
          htRef.current = 1;
          clearIv();
          htTimersRef.current.forEach(clearTimeout);
          htTimersRef.current = [];
          setHalfTimeUi(true);
          setHalfTimeTick(HALFTIME_TICK_START);
          for (let s = 1; s < HALFTIME_TICK_START; s++) {
            htTimersRef.current.push(
              window.setTimeout(() => setHalfTimeTick(HALFTIME_TICK_START - s), s * 1000),
            );
          }
          htTimersRef.current.push(
            window.setTimeout(() => {
              setHalfTimeUi(false);
              setHalfTimeTick(HALFTIME_TICK_START);
              htRef.current = 2;
              loop();
            }, HALFTIME_MS),
          );
          return;
        }

        tick();
      }, MS_PER_MINUTE);
    };

    if (TEST2D_KICKOFF_COUNTDOWN_SEC <= 0 && TEST2D_KICKOFF_MESSAGE_MS <= 0) {
      loop();
    } else {
      // Sequência: ready (prelúdio) → N → ... → 1 → kickoff → rodar loop.
      const preludeEnd = TEST2D_KICKOFF_PRELUDE_MS;
      // Primeiro número aparece logo após o prelúdio.
      preKickoffTimersRef.current.push(
        window.setTimeout(
          () => setQuickPreStart(TEST2D_KICKOFF_COUNTDOWN_SEC as Test2dKickoffPhase),
          preludeEnd,
        ),
      );
      for (let n = TEST2D_KICKOFF_COUNTDOWN_SEC - 1; n >= 1; n--) {
        preKickoffTimersRef.current.push(
          window.setTimeout(
            () => setQuickPreStart(n as Test2dKickoffPhase),
            preludeEnd + (TEST2D_KICKOFF_COUNTDOWN_SEC - n) * TEST2D_KICKOFF_STEP_MS,
          ),
        );
      }
      const kickMs = preludeEnd + TEST2D_KICKOFF_COUNTDOWN_SEC * TEST2D_KICKOFF_STEP_MS;
      const tEnd = kickMs + TEST2D_KICKOFF_MESSAGE_MS;
      preKickoffTimersRef.current.push(window.setTimeout(() => setQuickPreStart('kickoff'), kickMs));
      preKickoffTimersRef.current.push(
        window.setTimeout(() => {
          setQuickPreStart(null);
          loop();
        }, tEnd),
      );
    }

    return () => {
      clearIv();
      htTimersRef.current.forEach(clearTimeout);
      htTimersRef.current = [];
      preKickoffTimersRef.current.forEach(clearTimeout);
      preKickoffTimersRef.current = [];
    };
  }, [session, dispatch, usesLive2dTacticalEngine, fcParam, fcGate]);

  /** Intervalo: guiado pelo `MatchClock` do sim (`SIM_SYNC`), não por `minute === 45` + interval. */
  useEffect(() => {
    if (!usesLive2dTacticalEngine) return;
    if (live?.phase !== 'playing' && live?.phase !== 'postgame') return;
    if (live?.clockPeriod === 'halftime') {
      setHalfTimeUi(true);
    } else {
      setHalfTimeUi(false);
    }
  }, [usesLive2dTacticalEngine, live?.clockPeriod, live?.phase]);

  useEffect(() => {
    const hint = live?.preGoalHint;
    if (!hint || !live || live.phase !== 'playing') {
      if (preGoalActive) setPreGoalActive(false);
      return;
    }
    setPreGoalActive(true);
    const endAt = hint.startedAtMs + hint.durationMs;
    const remaining = Math.max(0, endAt - Date.now());
    const t = window.setTimeout(() => {
      setPreGoalActive(false);
      const topEv = getGameState().liveMatch?.events[0];
      if (topEv) lastSeenGoalEventIdRef.current = topEv.id;
      setMomentumAnimKey(`pre-goal-flash-${hint.startedAtMs}`);
    }, remaining);
    return () => clearTimeout(t);
  }, [live?.preGoalHint?.startedAtMs]);

  useEffect(() => {
    if (!live || isBlockingNonQuickMatch(live) || live.phase !== 'playing') return;
    if (preGoalActive) return;
    const top = live.events[0];
    if (!top || (top.kind !== 'goal_home' && top.kind !== 'goal_away')) return;
    if (lastSeenGoalEventIdRef.current === top.id) return;
    lastSeenGoalEventIdRef.current = top.id;
    freezeUntilRef.current = Date.now() + GOAL_FREEZE_MS;
    setMomentumAnimKey(top.id);
    setGoalTakeoverKey(top.id);
    setGoalCelebrationActive(true); // Pausa o relógio durante a celebração
  }, [live?.events, live?.phase, live?.mode, preGoalActive]);

  useEffect(() => {
    const o = live?.spiritOverlay;
    if (!live || isBlockingNonQuickMatch(live) || live.phase !== 'playing' || !o) return;
    const until = o.startedAtMs + o.autoDismissMs;
    freezeUntilRef.current = Math.max(freezeUntilRef.current, until);
    if (o.kind === 'goal') {
      setMomentumAnimKey(`spirit-goal-${o.startedAtMs}`);
    }
    const t = window.setTimeout(() => {
      const st = getGameState().liveMatch;
      const cur = st?.spiritOverlay;
      if (!cur || cur.startedAtMs !== o.startedAtMs) return;
      if (cur.kind === 'goal') {
        dispatch({ type: 'DISMISS_SPIRIT_OVERLAY' });
        return;
      }
      if (cur.kind === 'penalty') {
        const p = st?.penalty;
        // No live (test2d), o modal interativo trata o kick — não auto-resolver aqui.
        // Apenas auto-resolve em modos não-interativos (auto), ou avança outros stages.
        const isInteractiveMode = live?.mode === 'test2d' || live?.mode === 'quick';
        if (p?.stage === 'kick' && isInteractiveMode) {
          // Modal vai disparar penalty_resolve via onResolve
          return;
        }
        if (p?.stage === 'kick') {
          dispatch({ type: 'APPLY_SPIRIT_OUTCOME', payload: { kind: 'penalty_resolve' } });
        } else if (p?.stage === 'result') {
          dispatch({ type: 'DISMISS_SPIRIT_OVERLAY' });
        } else {
          dispatch({ type: 'APPLY_SPIRIT_OUTCOME', payload: { kind: 'penalty_advance' } });
        }
        return;
      }
      dispatch({ type: 'DISMISS_SPIRIT_OVERLAY' });
    }, o.autoDismissMs);
    return () => clearTimeout(t);
  }, [live?.spiritOverlay?.startedAtMs, live?.spiritOverlay?.kind, live?.phase, live?.mode, dispatch]);

  useEffect(() => {
    if (!live || isBlockingNonQuickMatch(live)) return;
    if (live.phase !== 'postgame' || finalizedRef.current) return;
    finalizedRef.current = true;

    // BUG FIX #1: Validação defensiva completa antes de finalizar
    const currentLive = getGameState().liveMatch;
    if (!currentLive) {
      console.error('[Live2dMatchShell] FINALIZE_MATCH abortado: liveMatch é null');
      return;
    }

    // Validar campos obrigatórios
    if (!currentLive.homeShort || !currentLive.awayShort) {
      console.error('[Live2dMatchShell] FINALIZE_MATCH abortado: times inválidos', currentLive);
      return;
    }

    setSummary({
      homeShort: currentLive.homeShort,
      awayShort: currentLive.awayShort,
      homeName: currentLive.homeName,
      awayName: currentLive.awayName,
      homeScore: currentLive.homeScore ?? 0,
      awayScore: currentLive.awayScore ?? 0,
      events: (currentLive.events ?? []).map((e) => ({ id: e.id, text: e.text })),
    });
    dispatch({ type: 'FINALIZE_MATCH' });
    navigate('/postgame');
  }, [live, dispatch, navigate]);

  const squadReport = useMemo(
    () => evaluateOfficialSquad(lineupIds, playersById),
    [lineupIds, playersById],
  );
  const squadOkForMatch = squadReport.ok || isOfficialSquadGateRelaxedForTests();

  // P8: Preload portraits with <link rel="preload"> + async decoding
  useEffect(() => {
    if (!live?.homePlayers?.length) return;
    const urls = new Set<string>();
    for (const p of live.homePlayers) {
      const ent = playersById[p.playerId];
      if (ent) {
        const u = playerTokenSrc(ent, 72);
        if (u) urls.add(u);
      }
    }
    const links: HTMLLinkElement[] = [];
    for (const u of urls) {
      // Preload via <link> for priority hint
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = u;
      document.head.appendChild(link);
      links.push(link);
      // Also trigger Image() for browsers that don't support preload
      const img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = u;
    }
    return () => {
      links.forEach((link) => document.head.removeChild(link));
    };
  }, [live?.homePlayers, playersById]);

  // CORREÇÃO: tacticalPitchFromTruth já foi movido para cima (linha ~676)

  const storeOnBallId = useMemo(() => {
    if (usesLive2dTacticalEngine && tacticalLive2dEnabled) {
      return carrierIdToStoreOnBallId(carrierSimId, live?.awayRoster ?? []);
    }
    return live?.onBallPlayerId;
  }, [usesLive2dTacticalEngine, tacticalLive2dEnabled, carrierSimId, live?.awayRoster, live?.onBallPlayerId]);

  const awayPitch = tacticalPitchFromTruth?.awayPitch ?? live?.awayPitchPlayers ?? [];
  const showBoard = summary === null;

  const onPitchIds = useMemo(() => {
    if (live?.matchLineupBySlot && Object.keys(live.matchLineupBySlot).length > 0) {
      return new Set(Object.values(live.matchLineupBySlot));
    }
    return new Set(pitch.map((p) => p.playerId));
  }, [live?.matchLineupBySlot, pitch]);

  const benchPlayers = useMemo(() => {
    return Object.values(playersById)
      .filter((p) => !onPitchIds.has(p.id) && p.outForMatches <= 0)
      .sort((a, b) => a.num - b.num);
  }, [playersById, onPitchIds]);

  const maxSubs = live?.mode === 'quick' ? 5 : 3;
  const subsUsed = live?.substitutionsUsed ?? 0;
  const subsLeft = Math.max(0, maxSubs - subsUsed);

  const handleSelectPlayer = useCallback((p: PitchPlayerState) => {
    setSelectedPlayer(p);
  }, []);

  useEffect(() => {
    if (!selectedPlayer || !live?.homePlayers?.length) return;
    const stillOnPitch = live.homePlayers.some((p) => p.playerId === selectedPlayer.playerId);
    if (!stillOnPitch) setSelectedPlayer(null);
  }, [live?.homePlayers, selectedPlayer]);


  // Auto-substitution: swap the most fatigued home outfield player during a deadball window.
  const autoSubDoneThisDeadballRef = useRef(false);
  useEffect(() => {
    if (!usesLive2dTacticalEngine || !tacticalLive2dEnabled) return;
    if (!simFatigue.deadBall) {
      // Reset gate when deadball ends so next deadball can trigger another auto-sub.
      autoSubDoneThisDeadballRef.current = false;
      return;
    }
    if (autoSubDoneThisDeadballRef.current) return;
    if (!live || live.phase !== 'playing') return;
    const subsUsedNow = live.substitutionsUsed ?? 0;
    const maxSubsNow = live.mode === 'quick' ? 5 : 3;
    if (subsUsedNow >= maxSubsNow) return;
    if (simFatigue.ids.length === 0) return;

    // Find first critically fatigued player still on pitch.
    const outId = simFatigue.ids.find((id: string) => live.homePlayers?.some((p) => p.playerId === id));
    if (!outId) return;

    // Pick the fittest available bench player (non-GK preferred if outgoing is not GK).
    const onPitch = new Set((live.homePlayers ?? []).map((p) => p.playerId));
    const bench = Object.values(playersById).filter(
      (p) => !onPitch.has(p.id) && p.outForMatches <= 0,
    );
    if (bench.length === 0) return;
    const inPlayer = bench[0];
    if (!inPlayer) return;

    autoSubDoneThisDeadballRef.current = true;
    dispatch({ type: 'MATCH_SUBSTITUTE', outPlayerId: outId, inPlayerId: inPlayer.id });
  }, [simFatigue.deadBall, simFatigue.ids, usesLive2dTacticalEngine, tacticalLive2dEnabled, live, playersById, dispatch]);

  const ballPosBase = useMemo(() => {
    if (tacticalPitchFromTruth) {
      return tacticalPitchFromTruth.ball;
    }
    if (!live) return { x: 50, y: 50 };
    if (live.ballTrajectory) {
      return interpolateBallPosition(live.ballTrajectory as BallTrajectoryState);
    }
    return live.ball;
  }, [tacticalPitchFromTruth, live?.ball, live?.ballTrajectory]);

  const ballPos = ballPosBase;
  const ballHeightM = tacticalPitchFromTruth?.ballHeight ?? 0;

  const pitchCameraRig = useMemo(() => {
    const bx = pitchPlanePercent(ballPos.x);
    const by = pitchPlanePercent(ballPos.y);
    return computePitchCameraRig(pitchCameraMode, bx, by, prefersReducedMotion);
  }, [pitchCameraMode, ballPos.x, ballPos.y, prefersReducedMotion]);

  const tokenSeparation = useMemo(() => {
    const agents = [
      ...pitch.map((p) => ({ id: `h:${p.playerId}`, x: p.x, y: p.y })),
      ...awayPitch.map((p) => ({ id: `a:${p.playerId}`, x: p.x, y: p.y })),
    ];
    return computePitchTokenSeparation(agents, { ball: ballPos });
  }, [pitch, awayPitch, ballPos]);

  // P6: hoist per-frame derived values out of the .map() iterations below.
  // Without this, nearestToPoint(awayPitch, ballPos) and pitchPlanePercent(ballPos.*)
  // were recomputed N times per render (~22 × 42fps = 924/sec). Now once per render.
  const ballPxPct = pitchPlanePercent(ballPos.x);
  const ballPyPct = pitchPlanePercent(ballPos.y);
  const awayNearestBallId = useMemo(
    () => nearestToPoint(awayPitch, ballPos)?.playerId ?? null,
    [awayPitch, ballPos],
  );

  const secondHalfResumeCountdown =
    usesLive2dTacticalEngine && tacticalLive2dEnabled
      ? (truthSnap?.secondHalfResumeCountdownSec ?? 0)
      : 0;
  const tacticalKickoffHoldCountdown = secondHalfResumeCountdown;
  const scoreboardCountdownSec = null as number | null;

  const clockFrozen =
    quickPreStart !== null ||
    halfTimeUi ||
    !!(live?.spiritOverlay) ||
    preGoalActive ||
    goalCelebrationActive ||
    tacticalKickoffHoldCountdown > 0 ||
    Date.now() < freezeUntilRef.current;
  const displayHomeScore =
    preGoalActive && live?.preGoalHint?.side === 'home' ? (live?.homeScore ?? 1) - 1 : live?.homeScore ?? 0;
  const displayAwayScore =
    preGoalActive && live?.preGoalHint?.side === 'away' ? (live?.awayScore ?? 1) - 1 : live?.awayScore ?? 0;

  const confirmForfeit = () => {
    dispatch({ type: 'FORFEIT_MATCH', mode: LIVE_MATCH_ENGINE_MODE });
    setForfeitOpen(false);
  };

  if (fcParam && fcGate === 'pending') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <p className="font-display text-sm font-bold uppercase tracking-wider text-neon-yellow">Amistoso online</p>
        <p className="max-w-sm text-sm text-gray-400">A validar convite aceite…</p>
      </div>
    );
  }

  return (
    <div className="flex w-full min-h-0 flex-1 flex-col space-y-3 sm:space-y-4 py-4 sm:py-6 px-2 sm:px-4 pb-20 sm:pb-24 md:flex-none">
      <GoalTakeover
        triggerKey={goalTakeoverKey}
        disabled={prefersReducedMotion}
        onDismiss={() => {
          setGoalCelebrationActive(false);
          setGoalTakeoverKey(null);
          freezeUntilRef.current = 0;
        }}
      />

      {/* Penalty interativo no live (test2d) — pausa o pitch via overlay full-screen */}
      {live?.penalty?.stage === 'kick' && live?.phase === 'playing' && live?.penalty && (
        <PenaltyKickModalV2
          key={`penalty-${live.penalty.takerId ?? live.penalty.takerName ?? 'anon'}`}
          penalty={live.penalty}
          homePlayers={live.homePlayers ?? []}
          opponentStrength={fixture?.opponent?.strength ?? 50}
          takerReady={Boolean(live.penalty.takerId)}
          homeScore={live.homeScore}
          awayScore={live.awayScore}
          homeShort={live.homeShort ?? ''}
          awayShort={live.awayShort ?? fixture?.opponent?.shortName ?? ''}
          minute={live.minute ?? 0}
          onPickTaker={(playerId, name) => {
            dispatch({ type: 'PENALTY_SET_TAKER', playerId, name } as any);
          }}
          onResolve={(rng) => {
            window.setTimeout(() => {
              dispatch({ type: 'APPLY_SPIRIT_OUTCOME', payload: { kind: 'penalty_resolve', rng } });
            }, 800);
          }}
        />
      )}

      {/* Sprint L3 — Set-piece interativo */}
      <SetPieceModal />

      <div className="flex items-center justify-between gap-1.5 sm:gap-2 flex-wrap">
        <Link to="/" className="text-[10px] sm:text-xs font-bold text-gray-500 hover:text-neon-yellow">
          ← Home
        </Link>
        <div className="flex flex-col items-end gap-0.5">
          <span
            className="text-[8px] sm:text-[10px] font-display font-bold uppercase tracking-widest text-cyan-200/95"
          >
            {productLabel}
          </span>
          <span
            className="text-[7px] sm:text-[9px] font-medium uppercase tracking-wide text-cyan-500/75"
          >
            {productSub}
          </span>
        </div>
        {showBoard && live?.phase === 'playing' && quickPreStart === null && (
          <button
            type="button"
            onClick={() => setForfeitOpen(true)}
            className="text-[10px] font-display font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair do jogo
          </button>
        )}
      </div>

      {showBoard && !live && (
        <div className="glass-panel p-6 border border-white/10 space-y-3">
          {!squadOkForMatch ? (
            <>
              <p className="font-display font-black text-sm uppercase tracking-wide text-amber-200">
                Plantel incompleto
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">
                São necessários 11 titulares disponíveis e pelo menos 5 no banco para entrar em campo.
              </p>
              {squadReport.reason ? (
                <p className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-500">{squadReport.reason}</p>
              ) : null}
              <Link
                to="/team"
                className="inline-flex w-full justify-center rounded-xl bg-neon-yellow px-4 py-3 font-display text-sm font-black uppercase tracking-wide text-black sm:w-auto"
              >
                Ajustar plantel
              </Link>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">A preparar a partida…</p>
          )}
        </div>
      )}

      <AnimatePresence>
        {forfeitOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="forfeit-live-match-title"
            onClick={() => setForfeitOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              className="glass-panel w-full max-w-md p-4 sm:p-6 border border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.12)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="forfeit-live-match-title"
                className="font-display font-black text-lg sm:text-xl text-white text-center uppercase tracking-wide"
              >
                Sair do jogo?
              </h2>
              <p className="text-xs sm:text-sm text-gray-400 text-center mt-3 sm:mt-4 leading-relaxed">
                Você perde por <span className="text-red-400 font-display font-black text-base sm:text-lg">5×0</span>. O resultado
                entra na liga e no histórico.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-display font-black uppercase tracking-wider text-sm transition-colors"
                  onClick={confirmForfeit}
                >
                  Confirmar desistência
                </button>
                <button
                  type="button"
                  className="w-full py-3 rounded-xl border border-white/20 text-gray-300 font-bold text-sm hover:bg-white/5 transition-colors"
                  onClick={() => setForfeitOpen(false)}
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {halfTimeUi ? (
          <Fragment key="match-halftime-2d">
            <MatchInterruptOverlay
              kind="halftime"
              title="Intervalo"
              lines={['2.º tempo a seguir…']}
              countdown={usesLive2dTacticalEngine ? undefined : halfTimeTick}
            />
          </Fragment>
        ) : live?.spiritOverlay && !preGoalActive ? (
          <Fragment key={`spirit-2d-${live.spiritOverlay.startedAtMs}-${live.spiritOverlay.kind}`}>
            <MatchInterruptOverlay
              kind={live.spiritOverlay.kind}
              title={live.spiritOverlay.title}
              lines={live.spiritOverlay.lines}
            />
          </Fragment>
        ) : null}
      </AnimatePresence>

      {showBoard && live && (
        <div className="glass-panel p-3 sm:p-5 border border-white/10 space-y-3 sm:space-y-4 relative overflow-x-hidden overflow-y-visible">
          {quickPreStart === 'ready' || typeof quickPreStart === 'number' || quickPreStart === 'kickoff' ? (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-none"
              aria-live="polite"
            >
              {quickPreStart === 'ready' ? (
                <motion.span
                  key="ready"
                  initial={{ scale: 0.9, opacity: 0, letterSpacing: '0.05em' }}
                  animate={{ scale: 1, opacity: 1, letterSpacing: '0.25em' }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="font-display font-black text-[min(8vw,2.2rem)] uppercase text-white/90 drop-shadow-[0_0_18px_rgba(253,225,0,0.35)]"
                >
                  Preparados?
                </motion.span>
              ) : (
                <motion.span
                  key={quickPreStart}
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                  className={cn(
                    'font-display font-black text-neon-yellow tabular-nums drop-shadow-[0_0_24px_rgba(253,225,0,0.35)]',
                    quickPreStart === 'kickoff'
                      ? 'text-[min(8vw,2.25rem)] uppercase tracking-widest'
                      : 'text-[min(22vw,7rem)]',
                  )}
                >
                  {quickPreStart === 'kickoff' ? 'Bola a rolar' : quickPreStart}
                </motion.span>
              )}
            </div>
          ) : null}

          {/* Placar estilo Quick Match — brasões + nomes + Moret italic */}
          <div className="w-full max-w-3xl mx-auto mb-4">
            <div className="relative flex items-center justify-center gap-6 sm:gap-8">
              {/* Casa */}
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 justify-end">
                {/* Brasão */}
                {homeCrestUrl ? (
                  <img
                    src={homeCrestUrl}
                    alt={live.homeName ?? live.homeShort}
                    className="w-14 h-14 sm:w-16 sm:h-16 object-contain shrink-0"
                    referrerPolicy="no-referrer"
                    draggable={false}
                  />
                ) : (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-neon-yellow bg-deep-black grid place-items-center shrink-0">
                    <span className="font-display font-black uppercase text-neon-yellow text-sm tracking-wider">
                      {live.homeShort}
                    </span>
                  </div>
                )}

                {/* Score + Nome */}
                <div className="flex flex-col items-center gap-1">
                  {/* Score */}
                  <span
                    className="leading-none text-neon-yellow tabular-nums"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontStyle: 'italic',
                      fontSize: 'clamp(44px, 12vw, 80px)',
                      fontWeight: 700,
                      letterSpacing: '-0.03em',
                    }}
                  >
                    {displayHomeScore}
                  </span>

                  {/* Nome do time */}
                  <p
                    className="text-white uppercase truncate max-w-full text-center"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontStyle: 'italic',
                      fontWeight: 700,
                      fontSize: 'clamp(10px, 1.6vw, 13px)',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {live.homeName ?? live.homeShort}
                  </p>
                </div>
              </div>

              {/* Relógio no meio */}
              <div className="flex flex-col items-center shrink-0">
                <LiveMatchClockDisplay
                  elapsedSec={live?.footballElapsedSec ?? 0}
                  frozen={clockFrozen}
                  phase={live?.phase}
                  msPerMinute={MS_PER_MINUTE}
                  tacticalLoopRef={tacticalLive2dEnabled ? tacticalLive2dLoopRef : undefined}
                />
              </div>

              {/* Visitante */}
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 justify-start">
                {/* Score + Nome */}
                <div className="flex flex-col items-center gap-1">
                  {/* Score */}
                  <span
                    className="leading-none text-white tabular-nums"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontStyle: 'italic',
                      fontSize: 'clamp(44px, 12vw, 80px)',
                      fontWeight: 700,
                      letterSpacing: '-0.03em',
                    }}
                  >
                    {displayAwayScore}
                  </span>

                  {/* Nome do time */}
                  <p
                    className="text-white uppercase truncate max-w-full text-center"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontStyle: 'italic',
                      fontWeight: 700,
                      fontSize: 'clamp(10px, 1.6vw, 13px)',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {live.awayName ?? live.awayShort}
                  </p>
                </div>

                {/* Brasão */}
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-white/40 bg-deep-black grid place-items-center shrink-0">
                  <span className="font-display font-black uppercase text-white text-sm tracking-wider">
                    {live.awayShort}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Toolbar de controles do campo */}
          <div
            className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-0.5 pb-0.5 sm:pb-1"
            role="toolbar"
            aria-label={`Atalhos do campo, câmara e alertas de fadiga (até ${LIVE_MATCH_FIELD_TOOLBAR_MAX})`}
          >
            {(
              [
                {
                  key: 'zone18',
                  Icon: LayoutGrid,
                  title: 'Raio de ação dos jogadores e zonas de influência',
                  ariaPressed: zoneView18,
                  active: zoneView18,
                  activeClass: 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100',
                  onClick: () => {
                    const next = !zoneView18;
                    setZoneView18(next);
                    saveZoneView18Pref(next);
                  },
                },
                {
                  key: 'cam-drone',
                  Icon: Scan,
                  title: 'Vista total (câmara)',
                  ariaPressed: pitchCameraMode === 'drone',
                  active: pitchCameraMode === 'drone',
                  activeClass: 'border-neon-yellow/70 bg-neon-yellow/15 text-neon-yellow',
                  onClick: () => {
                    setPitchCameraMode('drone');
                    saveLive2dPitchCamera('drone');
                  },
                },
                {
                  key: 'cam-action',
                  Icon: Zap,
                  title: 'Zoom dinâmico seguindo a bola',
                  ariaPressed: pitchCameraMode === 'action',
                  active: pitchCameraMode === 'action',
                  activeClass: 'border-neon-yellow/70 bg-neon-yellow/15 text-neon-yellow',
                  onClick: () => {
                    setPitchCameraMode('action');
                    saveLive2dPitchCamera('action');
                  },
                },
                {
                  key: 'names',
                  Icon: Tag,
                  title: 'Mostrar nomes dos jogadores sob os tokens — pra falar o nome no comando por voz',
                  ariaPressed: namesOn,
                  active: namesOn,
                  activeClass: 'border-neon-yellow/60 bg-neon-yellow/15 text-neon-yellow',
                  onClick: () => {
                    const next = !namesOn;
                    setNamesOn(next);
                    saveLive2dNamesPref(next);
                  },
                },
                {
                  key: 'energy-map',
                  Icon: Gauge,
                  title:
                    'Alertas de fadiga: ícone só em jogadores muito cansados (sem círculo no token) — foco em substituições',
                  ariaPressed: energyMapOn,
                  active: energyMapOn,
                  activeClass: 'border-emerald-400/55 bg-emerald-500/12 text-emerald-100',
                  onClick: () => {
                    const next = !energyMapOn;
                    setEnergyMapOn(next);
                    saveLive2dEnergyMapPref(next);
                  },
                },
              ] as const
            )
              .slice(0, LIVE_MATCH_FIELD_TOOLBAR_MAX)
              .map(({ key, Icon, title, ariaPressed, active, activeClass, onClick }) => (
                <button
                  key={key}
                  type="button"
                  aria-label={title}
                  aria-pressed={ariaPressed}
                  onClick={onClick}
                  title={title}
                  className={cn(
                    'inline-flex size-6 shrink-0 items-center justify-center rounded-md border p-0 transition-colors sm:size-7',
                    active ? activeClass : 'border-white/12 text-gray-500 hover:border-white/22 hover:text-gray-300',
                  )}
                >
                  <Icon className="h-2.5 w-2.5 shrink-0 opacity-90" aria-hidden />
                </button>
              ))}
          </div>
          <div
            className="mx-auto w-full max-w-3xl py-0.5 sm:py-1 [perspective:min(1400px,110vw)]"
            aria-label="Campo: gol à esquerda é da casa, à direita é do visitante; o time da casa ataca para a direita e o visitante ataca para a esquerda."
          >
            <div
              className="origin-[50%_100%] transform-gpu will-change-transform"
              style={{
                transformStyle: 'preserve-3d',
                // P4: CSS variables evitam re-render do React quando ballPos muda
                transform: `rotateX(calc(5.5deg + var(--cam-rotate-x-add, 0deg)))`,
                transition: prefersReducedMotion ? 'none' : 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
                ['--cam-rotate-x-add' as string]: `${pitchCameraRig.rotateXAdd}deg`,
              }}
            >
              <div
                className={cn(
                  'relative rounded-xl',
                  pitchCameraRig.clipOverflow ? 'overflow-hidden' : 'overflow-visible',
                  'shadow-[0_28px_90px_-16px_rgba(0,0,0,0.92),0_0_72px_-20px_rgba(89,133,37,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]',
                  'ring-1 ring-white/15',
                )}
              >
                <div
                  className={cn(
                    'transform-gpu will-change-transform',
                    prefersReducedMotion ? '' : 'transition-transform duration-300 ease-out',
                  )}
                  style={{
                    // P4: CSS variables para scale e origin
                    transform: `scale(var(--cam-scale, 1))`,
                    transformOrigin: `var(--cam-origin-x, 50)% var(--cam-origin-y, 100)%`,
                    ['--cam-scale' as string]: pitchCameraRig.scale,
                    ['--cam-origin-x' as string]: pitchCameraRig.originXPct,
                    ['--cam-origin-y' as string]: pitchCameraRig.originYPct,
                  }}
                >
                  <div className="field-container w-full overflow-visible rounded-lg p-2 sm:p-3">
                  <div className="field">
                    {/* Melhoria #9: Efeito Visual no Campo quando Momentum Extremo */}
                    <MomentumFieldEffect momentum={live.spiritMomentum} />

                    <div className="pitch-overlay">
                      <div className="half-line" />
                      <div className="center-circle" />
                      <div className="center-dot" />
                      <div className="penalty-area left" />
                      <div className="penalty-area right" />
                      <div className="goal-area left" />
                      <div className="goal-area right" />
                      <div className="penalty-arc left" />
                      <div className="penalty-arc right" />
                      <div className="penalty-spot left" />
                      <div className="penalty-spot right" />
                      <div className="corner top-left" />
                      <div className="corner top-right" />
                      <div className="corner bottom-left" />
                      <div className="corner bottom-right" />
                      <div className="goal left">
                        <div className="goal-net" />
                      </div>
                      <div className="goal right">
                        <div className="goal-net" />
                      </div>
                      <div
                        className="pointer-events-none absolute left-[0.8%] sm:left-[1.2%] top-1/2 z-[9] -translate-y-1/2 select-none"
                        aria-hidden
                      >
                        <span className="block max-w-[3rem] sm:max-w-[4.5rem] font-display text-[clamp(5px,1.1vw,8px)] font-black uppercase leading-tight tracking-wider text-neon-yellow/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                          Gol da casa
                        </span>
                      </div>
                      <div
                        className="pointer-events-none absolute right-[0.8%] sm:right-[1.2%] top-1/2 z-[9] -translate-y-1/2 select-none text-right"
                        aria-hidden
                      >
                        <span className="block max-w-[3rem] sm:max-w-[4.5rem] font-display text-[clamp(5px,1.1vw,8px)] font-black uppercase leading-tight tracking-wider text-rose-300/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                          Gol visitante
                        </span>
                      </div>
                      <div className="zone-attack-left" aria-hidden />
                      <div className="zone-attack-right" aria-hidden />
                      <div className="zone-defense-left" aria-hidden />
                      <div className="zone-defense-right" aria-hidden />
                      <div className="zone-midfield" aria-hidden />
                      <div className="zone-box-left" aria-hidden />
                      <div className="zone-box-right" aria-hidden />
                    </div>
                    <div
                      className="field-tokens-layer"
                      style={{
                        contain: 'layout',
                        // P1: enable container-query units (cqw/cqh) so tokens
                        // can use transform-only positioning relative to this layer.
                        containerType: 'size' as const,
                      }}
                    >
                      {awayPitch.map((p) => {
                        const awayOnBall =
                          usesLive2dTacticalEngine && tacticalLive2dEnabled && storeOnBallId
                            ? storeOnBallId === p.playerId
                            : live.possession === 'away' &&
                              awayNearestBallId === p.playerId;
                        const nudgeA = tokenSeparation.get(`a:${p.playerId}`) ?? { dx: 0, dy: 0 };
                        const pxA = pitchPlanePercent(p.x) + nudgeA.dx;
                        const pyA = pitchPlanePercent(p.y) + nudgeA.dy;
                        const dBallA = distPlayerBallPct(pxA, pyA, ballPxPct, ballPyPct);
                        return (
                          <Fragment key={p.playerId}>
                            <Test2dAwayPlayerToken
                              p={p}
                              onBall={awayOnBall}
                              nudge={nudgeA}
                              reducedMotion={prefersReducedMotion}
                              showVisionBeam={!prefersReducedMotion}
                              visionPx={pxA}
                              visionPy={pyA}
                              ballPercent={ballPos}
                              clockPeriod={live.clockPeriod}
                              distBallPct={dBallA}
                              showEnergyMap={energyMapOn}
                              showNames={namesOn}
                              showActionRadius={zoneView18}
                            />
                          </Fragment>
                        );
                      })}
                      {pitch.map((p) => {
                        const ent = playersById[p.playerId];
                        const portraitUrl = ent ? playerTokenSrc(ent, 72) : undefined;
                        const onBall =
                          usesLive2dTacticalEngine && tacticalLive2dEnabled && storeOnBallId
                            ? storeOnBallId === p.playerId
                            : live.onBallPlayerId === p.playerId;
                        const nudgeH = tokenSeparation.get(`h:${p.playerId}`) ?? { dx: 0, dy: 0 };
                        const pxH = pitchPlanePercent(p.x) + nudgeH.dx;
                        const pyH = pitchPlanePercent(p.y) + nudgeH.dy;
                        const dBallH = distPlayerBallPct(pxH, pyH, ballPxPct, ballPyPct);
                        return (
                          <Fragment key={p.playerId}>
                            <Test2dHomePlayerToken
                              p={p}
                              portraitUrl={portraitUrl}
                              onBall={onBall}
                              nudge={nudgeH}
                              reducedMotion={prefersReducedMotion}
                              showVisionBeam={!prefersReducedMotion}
                              visionPx={pxH}
                              visionPy={pyH}
                              ballPercent={ballPos}
                              clockPeriod={live.clockPeriod}
                              distBallPct={dBallH}
                              showEnergyMap={energyMapOn}
                              showNames={namesOn}
                              showActionRadius={zoneView18}
                              onSelect={handleSelectPlayer}
                            />
                          </Fragment>
                        );
                      })}
                      <Test2dBallToken
                        x={ballPos.x}
                        y={ballPos.y}
                        trajectoryKind={live.ballTrajectory?.kind}
                        heightM={ballHeightM}
                        reducedMotion={prefersReducedMotion}
                      />
                      <PitchNarrationOverlay />
                    </div>
                    {tacticalKickoffHoldCountdown > 0 ? (
                      <div
                        className="pointer-events-none absolute inset-0 z-[20] flex flex-col items-center justify-center gap-2 rounded-sm bg-black/50 backdrop-blur-[2px]"
                        aria-live="polite"
                        role="status"
                      >
                        <p className="px-3 text-center font-display text-[clamp(9px,2vw,11px)] font-black uppercase tracking-[0.2em] text-white/90">
                          2.º tempo · troca de campo
                        </p>
                        <motion.span
                          key={tacticalKickoffHoldCountdown}
                          initial={{ scale: 0.88, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                          className="font-display font-black tabular-nums text-neon-yellow drop-shadow-[0_0_24px_rgba(253,225,0,0.35)] text-[min(22vw,5.5rem)]"
                        >
                          {tacticalKickoffHoldCountdown}
                        </motion.span>
                      </div>
                    ) : null}
                    {/* Set piece restart indicator — shown during throw-in, corner, goal kick */}
                    <AnimatePresence>
                      {usesLive2dTacticalEngine &&
                        tacticalLive2dEnabled &&
                        (truthSnap?.matchPhase === 'throw_in' ||
                          truthSnap?.matchPhase === 'corner_kick' ||
                          truthSnap?.matchPhase === 'goal_kick') ? (
                        <motion.div
                          key={truthSnap.matchPhase}
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.22 }}
                          className="pointer-events-none absolute top-2 left-1/2 z-[18] -translate-x-1/2"
                          aria-live="polite"
                          role="status"
                        >
                          <span className="rounded-full border border-white/20 bg-black/70 px-2.5 py-0.5 font-display text-[clamp(7px,1.6vw,10px)] font-black uppercase tracking-[0.18em] text-white/95 shadow-lg backdrop-blur-sm">
                            {truthSnap.matchPhase === 'throw_in'
                              ? 'Lateral'
                              : truthSnap.matchPhase === 'corner_kick'
                                ? 'Canto'
                                : 'Saída de baliza'}
                          </span>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>
                </div>
              </div>
            </div>
          </div>

          {live.phase === 'playing' && quickPreStart === null ? (
            <>
              {/* Comando Técnico — push-to-talk + texto + mentions */}
              <div className="glass-panel p-3 sm:p-4 border border-white/10">
                <CoachCommandInput
                  players={pitch}
                  playersById={playersById}
                  ballCarrierId={live.ballCarrier?.playerId}
                  side="home"
                  minute={live.minute}
                  teamObedience={tacticalObedience}
                  managerRelationByPlayer={managerRelationByPlayer}
                  onCommandExecuted={(result) => {
                    console.log('[voice] Comando executado:', result);
                  }}
                />
              </div>

              <LiveMatchManagerPanel
                homeShort={live.homeShort}
                awayShort={live.awayShort}
                homePlayers={pitch}
                awayRoster={live.awayRoster ?? []}
                playersById={playersById}
              />
            </>
          ) : null}

          {live.phase === 'playing' && quickPreStart === null ? (
            <LiveStatsPanel />
          ) : null}
        </div>
      )}

      {summary && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 sm:space-y-4">
          <div className="glass-panel p-4 sm:p-6 border border-neon-yellow/20 text-center">
            <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase font-bold mb-1.5 sm:mb-2">Fim de jogo</p>
            <MatchdayResultScores
              homeShort={summary.homeShort}
              awayShort={summary.awayShort}
              homeName={summary.homeName}
              awayName={summary.awayName}
              homeScore={summary.homeScore}
              awayScore={summary.awayScore}
              awaySeed={fixture.opponent.id}
              className="text-2xl sm:text-3xl"
            />
            <p className="text-[10px] sm:text-xs text-gray-500 mt-1.5 sm:mt-2">Liga e elenco atualizados</p>
          </div>
          <div className="glass-panel p-3 sm:p-4 border border-white/10 max-h-28 sm:max-h-36 overflow-y-auto">
            {summary.events.slice(0, 15).map((e) => (
              <p key={e.id} className="text-[10px] sm:text-[11px] text-gray-400 py-0.5">
                {e.text}
              </p>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="btn-primary w-full flex justify-center"
              onClick={() => setSession((s) => s + 1)}
            >
              <span className="btn-primary-inner flex items-center gap-2">
                <RotateCcw className="w-4 h-4" /> Jogar novamente
              </span>
            </button>
            <button
              type="button"
              className="w-full py-3 rounded-xl border border-white/20 font-bold text-sm flex items-center justify-center gap-2"
              onClick={() => navigate('/leagues')}
            >
              <Trophy className="w-4 h-4 text-neon-yellow" /> Ir para Liga
            </button>
            <button
              type="button"
              className="w-full py-3 rounded-xl border border-white/20 font-bold text-sm flex items-center justify-center gap-2"
              onClick={() => navigate('/')}
            >
              <Home className="w-4 h-4" /> Home
            </button>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {selectedPlayer && live?.phase === 'playing' && (
          <LivePlayerInfoPanel
            key={selectedPlayer.playerId}
            player={selectedPlayer}
            playerEntity={playersById[selectedPlayer.playerId]}
            onClose={() => setSelectedPlayer(null)}
            benchPlayers={benchPlayers}
            subsLeft={subsLeft}
            maxSubs={maxSubs}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
