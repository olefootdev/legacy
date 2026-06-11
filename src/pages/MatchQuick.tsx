import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Home, LogOut, Plus, Trophy, RotateCcw, X } from 'lucide-react';
import { getGameState, useGameDispatch, useGameStore } from '@/game/store';
import { mergeLineupWithDefaults } from '@/entities/lineup';
import { buildFatigueByIdMap } from '@/systems/fatigue';
import { overallFromAttributes, playerToCardView } from '@/entities/player';
import type { PitchPlayerState } from '@/engine/types';
import { roleFromPos } from '@/engine/pitchFromLineup';
import type { OpponentStub } from '@/entities/types';
import type { FormationSchemeId } from '@/match-engine/types';
import { cn } from '@/lib/utils';
import { playerPortraitSrc } from '@/lib/playerPortrait';
import { hashStringSeed } from '@/match/seededRng';
import { computeAwayImpactsFromVirtualLedger, computeHomeImpactsFromLedger } from '@/match/impactLedger';
import { evaluateOfficialSquad, isOfficialSquadGateRelaxedForTests } from '@/match/squadEligibility';
import { curateQuickFeedPool, quickFeedLineClass, renderQuickFeedRichText } from '@/match/quickMatchFeed';
import { DEFAULT_OPPONENT } from '@/entities/team';
import { computeScoutFromEvents, type MatchScoutBoard } from '@/match/scout';
import { MatchInterruptOverlay } from '@/match/MatchInterruptOverlay';
import { MatchFindingOverlay } from '@/components/match/MatchFindingOverlay';
import { MatchPredictionPanel } from '@/components/match/MatchPredictionPanel';
import { simulateMatchN, simulateLiveRemainder } from '@/match/matchMonteCarlo';
import { computeMatchContextModifiers } from '@/match/contextFactors';
import { selectEffectiveTeamStrength } from '@/match/availabilityReport';
import {
  fetchFriendlyChallengeById,
  userParticipatesInChallenge,
} from '@/supabase/friendlyChallenges';
import { GoalScorerOverlay } from '@/match/GoalScorerOverlay';
import { QuickGoalCelebration } from '@/components/matchquick/QuickGoalCelebration';
import { pickGoalOverlayStoryline } from '@/match/goalOverlayNarration';
import { GOAL_SCORER_OVERLAY_MS } from '@/gamespirit/spiritStateMachine';
import { fetchKeyMomentNarration } from '@/match/narrativeKeyMomentClient';
import { PenaltyKickModalV2 as PenaltyKickModal } from '@/match/PenaltyKickModalV2';
import { SetPieceModal } from '@/match/SetPieceModal';
import { SubstitutionOverlay } from '@/components/matchquick/SubstitutionOverlay';
import { RedCardOverlay } from '@/components/matchquick/RedCardOverlay';
import { AssistantAI, type HalftimeScript } from '@/components/matchquick/AssistantAI';
import { AssistantPanel, type AssistantEvent } from '@/match/AssistantPanel';
import { StreakBar } from '@/components/match/StreakBar';
import { MomentumBar } from '@/components/match/MomentumBar';
import { InstantRewards } from '@/components/match/InstantRewards';
import { NearMissOverlay, NearMissMotivation, useNearMissDetection, detectShotNearMiss } from '@/components/match/NearMissSystem';
import { getFatigueState, fatigueBadgeColor } from '@/match/fatigueState';
import {
  MatchdayVersusWithClock,
  MatchdayLineupColumnTitle,
  MatchdayResultScores,
} from '@/components/matchday/MatchdayVersusTitle';
import { LiveMatchClockDisplay } from '@/components/matchday/LiveMatchClockDisplay';
import { trackMissionEvent } from '@/progression/trackEvent';
import { QuickMatchScoreboard } from '@/components/matchquick/QuickMatchScoreboard';
import { QuickMatchLineup } from '@/components/matchquick/QuickMatchLineup';
import { QuickMatchHalftime } from '@/components/matchquick/QuickMatchHalftime';
import { QuickFeedDecisionCard } from '@/components/matchquick/QuickFeedDecisionCard';
import { QuickReactiveNarrator } from '@/components/matchquick/QuickReactiveNarrator';
import {
  reactToGoal,
  reactToRed,
  reactToDecision,
  type NarratorLine,
  type NarratorMemory,
} from '@/match/quickNarrator';
import { QuickPerformanceBonusPanel } from '@/components/matchquick/QuickPerformanceBonusPanel';
import { QuickTacticalIntensityControls, QuickTacticalIntensityInfo } from '@/components/matchquick/QuickTacticalIntensityControls';
import { QuickNarrativeArcIndicator } from '@/components/matchquick/QuickNarrativeArcIndicator';
import { QuickStreakChallengesPanel } from '@/components/matchquick/QuickStreakChallengesPanel';
import { matchdayHomeCrestUrl } from '@/settings/matchdayCrest';
import {
  shouldTriggerCounterAttack,
  shouldTriggerSetPiece,
  shouldTriggerDefensiveChoice,
  shouldTriggerSubTiming,
  buildCounterAttackMoment,
  buildSetPieceMoment,
  buildDefensiveChoiceMoment,
  buildSubTimingMoment,
} from '@/match/quickInteractiveMoments';
import { buildSquadDecisionMoment } from '@/match/quickSquadPalette';
import { buildGoalChain, type NarrationChain } from '@/match/quickNarrationChain';
import { QuickCinematicNarration } from '@/components/matchquick/QuickCinematicNarration';
import { detectNarrativeArc, getArcFeedSpeed } from '@/match/quickNarrativeArcs';
import { shouldAutoSwitchIntensity, type TacticalIntensityLevel } from '@/match/quickTacticalIntensity';
import { evaluatePerformanceBonuses, calculateTotalBonusRewards } from '@/match/quickPerformanceBonuses';

const FIRST_HALF_MS = 45_000;
const HALFTIME_MS = 10_000;
const MINUTES_PER_HALF = 45;
const MS_PER_MINUTE = Math.round(FIRST_HALF_MS / MINUTES_PER_HALF);
const GOAL_FREEZE_MS = 2_000;
const FEED_VISIBLE_COUNT = 3;
const FEED_POOL_MAX = 14;
const FEED_ROTATE_MS = 4_200;

/** Pré-partida: prelúdio “pronto?” + 3–2–1 (1.2s cada) + mensagem de bola a rolar. */
const QUICK_KICKOFF_PRELUDE_MS = 900;
const QUICK_KICKOFF_COUNTDOWN_MS = 1200;
const QUICK_KICKOFF_MESSAGE_MS = 1400;

type QuickPreStartPhase = 'ready' | 'c3' | 'c2' | 'c1' | 'kickoff' | null;

interface SecondYellowAlert {
  playerId: string;
  playerName: string;
  playerNum: number;
  playerPos: string;
  slotId: string;
}

/** Só bloqueia efeitos da partida rápida para jogos 3D / auto explícitos; `mode` ausente = legado (tratar como quick). */
function isBlockingNonQuickMatch(live: { mode?: string }): boolean {
  return live.mode === 'auto';
}

/**
 * 0–1 ao longo do eixo campo: ~1 = pressão da casa junto à baliza adversária (direita);
 * ~0 = visitante a ameaçar a baliza da casa.
 */
type QuickEventBadge = 'goal' | 'yellow' | 'red' | 'injury';

function pushBadge(m: Map<string, QuickEventBadge[]>, id: string, b: QuickEventBadge) {
  const cur = m.get(id) ?? [];
  cur.push(b);
  m.set(id, cur);
}

/** Cartão vermelho visível na lista (expulsos). */
function RedCardIcon({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Cartão vermelho"
      title="Expulso"
      className={cn(
        'inline-block shrink-0 rounded-[2px] bg-red-600 ring-1 ring-red-950/50 shadow-[0_0_10px_rgba(220,38,38,0.5)]',
        'w-[11px] h-[14px] sm:w-3 sm:h-4',
        className,
      )}
    />
  );
}

function PlayerEventStrip({ badges }: { badges: QuickEventBadge[] }) {
  if (!badges.length) return null;
  return (
    <span className="flex items-center gap-1 shrink-0 ml-1" aria-hidden>
      {badges.map((b, i) => {
        if (b === 'goal')
          return (
            <span key={`g-${i}`} title="Gol" className="inline-flex text-[11px] leading-none">
              ⚽
            </span>
          );
        if (b === 'yellow')
          return (
            <span
              key={`y-${i}`}
              title="Amarelo"
              className="inline-block w-2 h-2.5 rounded-[1px] bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]"
            />
          );
        if (b === 'red')
          return (
            <span
              key={`r-${i}`}
              title="Vermelho"
              className="inline-block w-2 h-2.5 rounded-[1px] bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.45)]"
            />
          );
        return (
          <Plus
            key={`i-${i}`}
            className="w-3 h-3 text-red-400 rotate-45 stroke-[3]"
            aria-label="Lesão"
          />
        );
      })}
    </span>
  );
}

function momentumPressure01(
  possession: 'home' | 'away',
  ballX: number,
  spiritMomentum?: { home: number; away: number } | null,
): number {
  const bx = (Math.min(92, Math.max(8, ballX)) - 50) / 50;
  // Início neutro: 0.5 (50/50) + ajustes por posição da bola e narrativa
  const base = 0.5;
  const possessionBias = possession === 'home' ? 0.08 : -0.08;
  const narrative = spiritMomentum
    ? (spiritMomentum.home - spiritMomentum.away) * 0.12
    : 0;
  return Math.min(0.96, Math.max(0.04, base + possessionBias + bx * 0.26 + narrative));
}

/**
 * QuickPlayerRowCard — Sprint D Fase 1.
 * Adapta o pattern `view-player-card` (TransferRowCard) ao contexto de partida.
 * Compacto: foto 64-80px com OVR Moret overlay + info (nome, pos, fadiga, impact).
 *
 * Variantes:
 *  - 'home-active'  : clicável (substituição), suporta selected/tired/top
 *  - 'home-sent-off': expulso (rail vermelho, ícone)
 *  - 'away'         : estático, IA, sem foto OVR (sintético)
 */
interface QuickPlayerRowCardProps {
  variant: 'home-active' | 'home-sent-off' | 'away';
  rank?: number;          // 1..N na lista de impacto
  num: number;
  name: string;
  pos: string;
  ovr?: number;           // Home only (a partir de overallFromAttributes)
  fatigue?: number;       // Home only (0..100)
  impact?: number;        // 0..10
  isSelected?: boolean;
  isTop?: boolean;        // Top 3 do impact
  badges?: ReactNode;     // PlayerEventStrip
  photoUrl?: string;      // URL resolvida pelo caller (playerPortraitSrc)
  onClick?: () => void;
}

const QuickPlayerRowCard = memo(function QuickPlayerRowCard({
  variant,
  rank,
  num,
  name,
  pos,
  ovr,
  fatigue = 0,
  impact,
  isSelected = false,
  isTop = false,
  badges,
  photoUrl,
  onClick,
}: QuickPlayerRowCardProps) {
  const isSentOff = variant === 'home-sent-off';
  const isAway = variant === 'away';
  const isTired = !isSentOff && !isAway && fatigue >= 68;
  const [imgError, setImgError] = useState(false);
  const handleImgError = useCallback(() => setImgError(true), []);

  const railClass = isSelected
    ? 'border-l-neon-yellow bg-neon-yellow/[0.08]'
    : isSentOff
      ? 'border-l-[var(--color-danger)]'
      : isTired
        ? 'border-l-[var(--color-warning)]'
        : isTop
          ? isAway
            ? 'border-l-white/45'
            : 'border-l-neon-yellow'
          : 'border-l-white/15';

  const Wrapper: any = onClick && !isSentOff ? motion.button : motion.div;
  const wrapperProps = onClick && !isSentOff
    ? { type: 'button', onClick }
    : {};

  const fatigueColor =
    fatigue >= 80
      ? 'text-[var(--color-danger)]'
      : fatigue >= 60
        ? 'text-[var(--color-warning)]'
        : 'text-white/55';
  const fatigueBarColor =
    fatigue >= 80
      ? 'bg-[var(--color-danger)]'
      : fatigue >= 60
        ? 'bg-[var(--color-warning)]'
        : 'bg-[var(--color-success)]';

  return (
    <Wrapper
      initial={false}
      {...wrapperProps}
      className={cn(
        'group flex w-full overflow-hidden border border-l-[3px] border-[var(--color-border)] bg-dark-gray transition-all duration-200',
        onClick && !isSentOff ? 'text-left hover:border-neon-yellow/40 hover:-translate-y-0.5 cursor-pointer' : '',
        isSentOff ? 'opacity-85' : '',
        railClass,
      )}
      style={{ borderRadius: 'var(--radius-md)', willChange: onClick && !isSentOff ? 'transform' : undefined }}
    >
      {/* Foto + OVR overlay (só home) — w-14 mobile (56px) economiza
       *  ~20% da largura pra info; w-20 (80px) em sm+. */}
      <div
        className="relative w-14 sm:w-20 flex-shrink-0 overflow-hidden bg-black border-r border-white/8"
        aria-hidden
      >
        {!isAway ? (
          <>
            {photoUrl && !imgError ? (
              <img
                src={photoUrl}
                alt=""
                loading="eager"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover object-top grayscale transition-opacity duration-300"
                style={{ opacity: 0.88 }}
                referrerPolicy="no-referrer"
                onError={handleImgError}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/10 to-white/[0.02]">
                <span
                  className="italic text-white/40 leading-none"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontWeight: 700,
                    fontSize: 'clamp(22px, 3vw, 30px)',
                    letterSpacing: '-0.04em',
                  }}
                >
                  {(name?.[0] ?? '?').toUpperCase()}
                </span>
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/65 via-black/15 to-transparent" />
            {/* OVR — só desktop (sm+). Mobile fica minimalista. */}
            {ovr !== undefined && !isSentOff ? (
              <div className="absolute top-1 left-1.5 z-10 hidden sm:block">
                <p
                  className="italic text-neon-yellow tabular-nums leading-none drop-shadow-[0_3px_8px_rgba(0,0,0,0.95)]"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontWeight: 700,
                    fontSize: 'clamp(20px, 3vw, 28px)',
                    letterSpacing: '-0.04em',
                  }}
                >
                  {ovr}
                </p>
              </div>
            ) : null}
            {isSentOff ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
                <RedCardIcon />
              </div>
            ) : null}
            {/* ─── Fatigue badge — top-right da foto. Só home & em jogo.
                Verde/fresco: sem badge (visual limpo). 50-70%: amarelo.
                71-89%: laranja pulsante. 90+: vermelho pulsante.
                Tooltip via title — sem necessidade de UI extra. */}
            {!isSentOff ? (() => {
              const fState = getFatigueState(fatigue);
              if (fState.badgeTone === 'none') return null;
              const color = fatigueBadgeColor(fState.badgeTone);
              const isPulse = fState.badgeTone === 'alert' || fState.badgeTone === 'danger';
              return (
                <div
                  className={cn(
                    'absolute top-1 right-1 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-2 ring-deep-black',
                    isPulse ? 'animate-pulse' : '',
                  )}
                  style={{ backgroundColor: color }}
                  role="img"
                  aria-label={`Fadiga ${Math.round(fState.pct)}% — ${fState.shortLabel}`}
                  title={`Fadiga ${Math.round(fState.pct)}% — ${fState.shortLabel}`}
                >
                  <span
                    aria-hidden
                    className="text-deep-black font-display font-black leading-none"
                    style={{ fontSize: '8px' }}
                  >
                    !
                  </span>
                </div>
              );
            })() : null}
          </>
        ) : (
          // Away: silhueta mínima IA com inicial
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/10 to-white/[0.02]">
            <span
              className="italic text-white/35 leading-none"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontWeight: 700,
                fontSize: 'clamp(22px, 3vw, 30px)',
                letterSpacing: '-0.04em',
              }}
            >
              {(name?.[0] ?? '?').toUpperCase()}
            </span>
          </div>
        )}
        {/* POS chip — só DESKTOP (sm+) na foto. No mobile a posição
            vive na info-strip pra deixar a foto mais limpa. */}
        <div className="absolute bottom-1 left-1 z-10 hidden sm:inline-flex items-center bg-black/75 px-1.5 py-0.5">
          <span
            className="font-display font-bold uppercase text-white/90"
            style={{ fontSize: '8px', letterSpacing: '0.18em' }}
          >
            {pos}
          </span>
        </div>
        {/* Número da camisa — bottom-right só mobile (com margem segura). */}
        {!isSentOff ? (
          <div className="absolute bottom-1 right-1 z-10 inline-flex items-baseline gap-0.5 sm:hidden">
            <span
              className="italic tabular-nums leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontSize: '15px',
                fontWeight: 700,
                color: isAway ? 'rgba(255,255,255,0.95)' : 'var(--color-neon-yellow)',
                letterSpacing: '-0.02em',
              }}
            >
              {num}
            </span>
          </div>
        ) : null}
      </div>

      {/* ─── Info — MOBILE (minimalista) ───────────────────────────────
          POS · fadiga% · badges · rating Moret. Sem nome, sem rank,
          sem label "IA·CPU", sem palavra "cansaço". */}
      <div className="flex sm:hidden min-w-0 flex-1 items-center gap-2 px-2 py-2">
        {/* Posição — chip leve no início da strip */}
        <span
          className="shrink-0 inline-flex items-center bg-white/8 text-white/85 px-1.5 py-0.5 uppercase font-display font-bold"
          style={{ fontSize: '9px', letterSpacing: '0.18em' }}
        >
          {pos}
        </span>
        {/* Fadiga — só home & em jogo. Apenas o número, sem rótulo. */}
        {!isAway && !isSentOff ? (
          <span
            className={cn('shrink-0 tabular-nums', fatigueColor)}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.02em',
            }}
          >
            {Math.round(fatigue)}%
          </span>
        ) : null}
        {/* Badges (gol, cartões, lesão) — empurrados pro fim da linha */}
        <div className="flex items-center gap-1 min-w-0 ml-auto">
          {badges}
          {isSentOff ? <RedCardIcon /> : null}
        </div>
        {/* Rating Moret */}
        {impact !== undefined && !isSentOff ? (
          <span
            className={cn(
              'shrink-0 italic tabular-nums leading-none',
              isAway ? 'text-white/85' : 'text-neon-yellow',
            )}
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontWeight: 700,
              fontSize: '17px',
              letterSpacing: '-0.02em',
            }}
          >
            {impact.toFixed(2)}
          </span>
        ) : null}
      </div>

      {/* ─── Info — DESKTOP (sm+) — layout completo original ──────────── */}
      <div className="hidden sm:flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
        {/* Rank lateral */}
        {rank !== undefined ? (
          <span
            className="shrink-0 italic tabular-nums leading-none w-5 text-center"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontWeight: 700,
              fontSize: '15px',
              color: isSentOff
                ? 'rgba(255,80,80,0.65)'
                : isTop
                  ? isAway
                    ? 'rgba(255,255,255,0.9)'
                    : 'var(--color-neon-yellow)'
                  : 'rgba(255,255,255,0.35)',
              letterSpacing: '-0.02em',
            }}
          >
            {isSentOff ? '—' : rank}
          </span>
        ) : null}

        {/* Centro: nome + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center min-w-0">
            <span
              className="truncate uppercase"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '13px',
                fontWeight: 800,
                letterSpacing: '0.03em',
                color: isSentOff ? 'rgba(255,255,255,0.85)' : '#fff',
                lineHeight: 1.05,
              }}
            >
              {num} {name}
            </span>
            {badges}
            {isSentOff ? (
              <span
                className="shrink-0 ml-1.5 text-[var(--color-danger)] uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                }}
              >
                Expulso
              </span>
            ) : null}
          </div>
          {!isAway && !isSentOff ? (
            <>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={cn('tabular-nums', fatigueColor)}
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '9px',
                    letterSpacing: '0.18em',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  {Math.round(fatigue)}% cansaço
                </span>
              </div>
              <div className="mt-1 h-[2px] bg-white/8 overflow-hidden max-w-[7rem]">
                <div
                  className={cn('h-full transition-all duration-700', fatigueBarColor)}
                  style={{ width: `${Math.min(100, fatigue)}%` }}
                  aria-hidden
                />
              </div>
            </>
          ) : (
            <div
              className="text-white/45 uppercase mt-0.5 whitespace-nowrap"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '9px',
                letterSpacing: '0.18em',
                fontWeight: 600,
              }}
            >
              {isSentOff ? pos : 'IA\u00A0·\u00A0CPU'}
            </div>
          )}
        </div>

        {/* Impact — Moret italic */}
        {impact !== undefined && !isSentOff ? (
          <span
            className={cn(
              'shrink-0 italic tabular-nums leading-none',
              isAway ? 'text-white/85' : 'text-neon-yellow',
            )}
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontWeight: 700,
              fontSize: 'clamp(18px, 2.2vw, 22px)',
              letterSpacing: '-0.02em',
            }}
          >
            {impact.toFixed(2)}
          </span>
        ) : null}
        {isSentOff ? <RedCardIcon /> : null}
      </div>
    </Wrapper>
  );
});

interface MvpSnapshot {
  playerId: string;
  name: string;
  num: number;
  pos: string;
  ovr?: number;
  rating: number;     // impact 0..10
  goals: number;
  assists: number;
  portraitUrl?: string | null;
}

interface MatchStats {
  shotsHome: number;
  shotsAway: number;
  possessionHome: number; // 0..100
  cornersHome: number;
  yellowsHome: number;
  redsHome: number;
}

interface EndSummary {
  homeShort: string;
  awayShort: string;
  homeName?: string;
  awayName?: string;
  homeScore: number;
  awayScore: number;
  events: { id: string; text: string }[];
  result: 'win' | 'draw' | 'loss';
  mvp?: MvpSnapshot;
  stats?: MatchStats;
  /** Scout da partida (régua compartilhada, Fase 1) — top pontuadores dos 2 lados. */
  scout?: MatchScoutBoard;
}

interface QuickAwayPlayer {
  id: string;
  num: number;
  name: string;
  pos: string;
}

/** 11 titulares visitantes sintéticos (motor só simula o lado casa). */
function buildAwayQuickRoster(opponent: OpponentStub, sessionKey: number): QuickAwayPlayer[] {
  const slots: { pos: string; num: number }[] = [
    { pos: 'GOL', num: 1 },
    { pos: 'ZAG', num: 4 },
    { pos: 'ZAG', num: 5 },
    { pos: 'LE', num: 3 },
    { pos: 'LD', num: 2 },
    { pos: 'VOL', num: 8 },
    { pos: 'MC', num: 6 },
    { pos: 'MC', num: 10 },
    { pos: 'PE', num: 7 },
    { pos: 'PD', num: 11 },
    { pos: 'ATA', num: 9 },
  ];
  const surnames = [
    'RIBEIRO',
    'NUNES',
    'CARVALHO',
    'MENDES',
    'TEIXEIRA',
    'BARBOSA',
    'CARDOSO',
    'REIS',
    'MOREIRA',
    'CASTRO',
    'FREITAS',
  ];
  return slots.map((slot, i) => {
    const h = hashStringSeed(`${opponent.id}|away|${sessionKey}|${i}`);
    const sur = surnames[Math.abs(h) % surnames.length]!;
    const isStar = slot.pos === 'ATA' && opponent.highlightPlayer;
    return {
      id: `away-${opponent.id}-${sessionKey}-${i}`,
      num: slot.num,
      name: isStar ? opponent.highlightPlayer!.name : sur,
      pos: slot.pos,
    };
  });
}

/**
 * Partida rápida: 25s + intervalo 5s + 25s; feed ao vivo; substituição altera `matchLineupBySlot` (mesmo reducer).
 */
export function MatchQuick() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fcParam = searchParams.get('fc');
  const dispatch = useGameDispatch();
  const live = useGameStore((s) => s.liveMatch);
  const playersById = useGameStore((s) => s.players);
  const playerHealth = useGameStore((s) => s.playerHealth);
  // Derivados base — declarados aqui no topo para evitar TDZ em deps de hooks (effects/memos abaixo).
  const pitch = live?.homePlayers ?? [];
  const lineupIds = useGameStore((s) => s.lineup);
  const fixtureBase = useGameStore((s) => s.nextFixture);
  const club = useGameStore((s) => s.club);
  const quickMatchStreak = useGameStore((s) => s.quickMatchStreak);
  const quickMatchIntensity = useGameStore((s) => s.quickMatchIntensity);
  const streakChallenges = useGameStore((s) => s.streakChallenges);

  // PvP assíncrono: adversário real passado via navigate state.
  // Stub "no-opponent-available" antigo em location.state é IGNORADO — senão
  // ele tem precedência sobre a re-busca e a partida nunca começa.
  const location = useLocation();
  const pvpStubRaw = (location.state as { pvpOpponentStub?: OpponentStub } | null)?.pvpOpponentStub;
  const pvpStubFromState = pvpStubRaw && pvpStubRaw.id !== 'no-opponent-available' ? pvpStubRaw : undefined;

  // [2026-05-18] Auto-buscar adversário se o usuário caiu direto em /match/quick
  // sem passar pelo QuickSearchModal. Evita o TITANS FC mock e segue a regra:
  // sempre buscar um manager real (fallback: bot do pool, nunca placeholder).
  //
  // Fix 2026-05-18b: useRef em vez de state nas deps — antes `playersById` +
  // `autoSearching` recriavam o effect a cada render, gerando loop infinito
  // de busca que congelava a UI (botões da Home pareciam mortos).
  //
  // [2026-06-11] Regra de produto 2026-05-27 reafirmada: a Partida Rápida
  // SEMPRE acontece. O matchmaking escolhe um time qualquer (sem filtro de
  // OVR) e o GameSpirit joga pelo manager offline; bot é o último recurso.
  // Também re-busca quando um 'no-opponent-available' antigo ficou persistido
  // no fixture (antes era beco sem saída: nunca buscava de novo).
  const [autoOpponent, setAutoOpponent] = useState<OpponentStub | null>(null);
  const autoSearchTriedRef = useRef(false);
  const isPlaceholderOpponent =
    !pvpStubFromState &&
    (fixtureBase.opponent.id === 'placeholder-opponent' ||
      fixtureBase.opponent.id === 'no-opponent-available');

  useEffect(() => {
    if (!isPlaceholderOpponent || autoSearchTriedRef.current) return;
    autoSearchTriedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const { quickFindOpponent, opponentMatchToStub } = await import('@/match/friendlyMatchmaking');
        const { getSupabase } = await import('@/supabase/client');
        const sb = getSupabase();
        const userId = sb ? (await sb.auth.getSession()).data.session?.user?.id : undefined;
        // Snapshot do plantel atual — não entra nas deps pra evitar loop
        const snapshot = getGameState().players;
        const myOverall = Math.round(
          Object.values(snapshot).reduce((s, p) => s + overallFromAttributes(p.attrs), 0) /
            Math.max(1, Object.keys(snapshot).length),
        );
        const match = await quickFindOpponent(club.id, myOverall || 70, userId);
        if (cancelled) return;
        const stub = opponentMatchToStub(match, myOverall || 70);
        setAutoOpponent(stub);
        dispatch({ type: 'ADMIN_PATCH_NEXT_FIXTURE', partial: { opponent: stub, awayName: stub.name } });
      } catch (err) {
        console.warn('[MatchQuick] auto opponent search failed', err);
        if (cancelled) return;
        // Regra 2026-05-27: a partida SEMPRE começa. Se até a cascata de
        // matchmaking explodiu (rede/chunk/Supabase), cai num bot do pool —
        // o GameSpirit joga por ele, igual faria por um manager offline.
        try {
          const { getMatchingBotTeam } = await import('@/match/botTeams');
          const bot = getMatchingBotTeam(70, 15);
          const stub: OpponentStub = {
            id: bot.id,
            name: bot.name,
            shortName: bot.shortName,
            strength: bot.avgOverall,
          };
          setAutoOpponent(stub);
          dispatch({ type: 'ADMIN_PATCH_NEXT_FIXTURE', partial: { opponent: stub, awayName: stub.name } });
        } catch {
          // Sem rede nem pro chunk do bot (dev server caiu): stub local fixo.
          const stub: OpponentStub = {
            id: 'bot-fallback-local',
            name: 'Esquadrão Reserva',
            shortName: 'RES',
            strength: 68,
          };
          setAutoOpponent(stub);
          dispatch({ type: 'ADMIN_PATCH_NEXT_FIXTURE', partial: { opponent: stub, awayName: stub.name } });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isPlaceholderOpponent, club.id]);

  const pvpStub = pvpStubFromState ?? autoOpponent;
  const fixture = pvpStub
    ? { ...fixtureBase, opponent: pvpStub, awayName: pvpStub.name }
    : fixtureBase;

  // Brasão do time do coração
  const homeCrestUrl = useGameStore((s) => matchdayHomeCrestUrl(s.userSettings));

  const [fcGate, setFcGate] = useState<'off' | 'pending' | 'ok' | 'fail'>('off');
  const fcSeedRef = useRef<number | undefined>(undefined);

  const [session, setSession] = useState(0);
  const [halfTimeUi, setHalfTimeUi] = useState(false);
  const [summary, setSummary] = useState<EndSummary | null>(null);
  const [showInstantRewards, setShowInstantRewards] = useState(false);
  const [selected, setSelected] = useState<PitchPlayerState | null>(null);
  const [subPickId, setSubPickId] = useState('');
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [halfTimeTick, setHalfTimeTick] = useState(3);
  const [secondYellowAlert, setSecondYellowAlert] = useState<SecondYellowAlert | null>(null);
  const [yellowCountdown, setYellowCountdown] = useState(8);
  const [injurySubCountdown, setInjurySubCountdown] = useState(5);
  const secondYellowAlertRef = useRef<SecondYellowAlert | null>(null);
  const secondYellowAutoRedRef = useRef<number | null>(null);
  const injurySubAutoCloseRef = useRef<number | null>(null);

  // Assistente técnico
  const [assistantEvent, setAssistantEvent] = useState<AssistantEvent | null>(null);
  /** Sprint D: chave que dispara o fluxo de chat scriptado de intervalo. */
  const [halftimeAssistantKey, setHalftimeAssistantKey] = useState<number | null>(null);
  const shownAssistantEventsRef = useRef(new Set<string>());
  const halftimeForceEndRef = useRef<(() => void) | null>(null);
  const lastAssistantShownMsRef = useRef<number>(0);
  /** Timestamp real de quando o loop de jogo arrancou — garante que o assistente
   *  nunca dispara nos primeiros segundos mesmo que o estado de fadiga já seja alto. */
  const matchLoopStartMsRef = useRef<number>(0);
  const [tacticalFeedback, setTacticalFeedback] = useState<string | null>(null);
  const tacticalFeedbackTimerRef = useRef<number | null>(null);
  const lastEmotionalMinuteRef = useRef<number>(-1);
  const processedNarrativeEventIdRef = useRef<Set<string>>(new Set());

  // Near-Miss System
  const { nearMissEvent, triggerNearMiss, clearNearMiss } = useNearMissDetection();
  const [showNearMissMotivation, setShowNearMissMotivation] = useState(false);
  const lastShotPreviewRef = useRef<string | null>(null);

  // Interactive Moment auto-timeout
  const interactiveMomentTimeoutRef = useRef<number | null>(null);
  // §4.2: raciona os nós de decisão (≥8 min entre eles → ~5/partida).
  const lastMomentMinuteRef = useRef<number>(-99);

  // ── Narrador reativo (§6) ──────────────────────────────────────────────
  // Linha cinética atual + nonce (mesmo texto pode repetir → nonce força UI).
  const [reactiveLine, setReactiveLine] = useState<(NarratorLine & { nonce: number }) | null>(null);
  const reactiveNonceRef = useRef(0);
  // Memória do padrão do manager (erros por tipo de decisão) — "de novo, hein?".
  const narratorMemoryRef = useRef<NarratorMemory>({});
  // Rastreia o que já foi narrado pra não repetir ao remontar.
  const narratedGoalIdRef = useRef<string | null>(null);
  const narratedRedIdRef = useRef<string | null>(null);
  const narratedOutcomeNonceRef = useRef<number | null>(null);
  const pushReactiveLine = (line: NarratorLine) => {
    reactiveNonceRef.current += 1;
    setReactiveLine({ ...line, nonce: reactiveNonceRef.current });
  };

  // StreakBar transitório (2026-06-11): era `fixed top-20 z-50` SEMPRE visível
  // com streak ≥ 1 — o "banner persistente sujando a tela" entre partidas.
  // Agora aparece 5s quando a sequência MUDA (fim de jogo) e some sozinho.
  const [streakBannerVisible, setStreakBannerVisible] = useState(false);
  const prevStreakRef = useRef<number | null>(null);

  // sync ref for use inside interval
  useEffect(() => { secondYellowAlertRef.current = secondYellowAlert; }, [secondYellowAlert]);

  const htRef = useRef(0);
  const htTimersRef = useRef<number[]>([]);
  const ivRef = useRef<number | null>(null);
  const finalizedRef = useRef(false);
  const freezeUntilRef = useRef(0);
  const lastSeenGoalEventIdRef = useRef<string | null>(null);
  const [momentumAnimKey, setMomentumAnimKey] = useState<string | null>(null);
  const [feedWindowStart, setFeedWindowStart] = useState(0);
  const lastFeedHeadIdRef = useRef<string | undefined>(undefined);
  const injurySubOpenForRef = useRef<string | null>(null);
  const [preGoalActive, setPreGoalActive] = useState(false);
  const [goalScorerRevealDone, setGoalScorerRevealDone] = useState(false);
  const [goalCelebrationKey, setGoalCelebrationKey] = useState<string | null>(null);
  const [goalCelebrationActive, setGoalCelebrationActive] = useState(false);
  // §3.2: narração full-screen cinética (cadeia → GOOOL) antes do card do artilheiro.
  const [cinematicGoal, setCinematicGoal] = useState<{ chain: NarrationChain; goalId: string } | null>(null);
  // Segurança anti-órfão: o overlay auto-avança e chama onDone, mas se desmontar
  // no meio, garante que não fica preso congelando o relógio.
  useEffect(() => {
    if (!cinematicGoal) return;
    const t = window.setTimeout(() => setCinematicGoal(null), 6000);
    return () => window.clearTimeout(t);
  }, [cinematicGoal]);

  // Novos overlays de substituição e cartão vermelho
  const [substitutionOverlay, setSubstitutionOverlay] = useState<{
    playerOut: { playerId?: string; name: string; number: number; position: string };
    playerIn: { playerId?: string; name: string; number: number; position: string };
    reason: 'injury' | 'tactical' | 'red_card';
  } | null>(null);
  const [redCardOverlay, setRedCardOverlay] = useState<{
    player: { name: string; number: number; position: string };
    reason: 'second_yellow' | 'direct_red' | 'violent_conduct';
  } | null>(null);
  const substitutionOverlayTimerRef = useRef<number | null>(null);
  const redCardOverlayTimerRef = useRef<number | null>(null);

  // Callbacks para o AssistantAI
  const handleSubstitution = (outPlayerId: string, inPlayerId: string, reason: 'injury' | 'tactical') => {
    const outPlayer = playersById[outPlayerId];
    const inPlayer = playersById[inPlayerId];
    if (!outPlayer || !inPlayer) return;

    // Mostrar overlay de substituição
    setSubstitutionOverlay({
      playerOut: {
        playerId: outPlayerId,
        name: outPlayer.name,
        number: outPlayer.num,
        position: outPlayer.pos,
      },
      playerIn: {
        playerId: inPlayerId,
        name: inPlayer.name,
        number: inPlayer.num,
        position: inPlayer.pos,
      },
      reason,
    });

    // Pausar o relógio por 3 segundos
    freezeUntilRef.current = Date.now() + 3000;

    // Executar a substituição no reducer
    dispatch({
      type: 'MATCH_SUBSTITUTE',
      outPlayerId,
      inPlayerId,
    });

    // Auto-clear após 3 segundos
    if (substitutionOverlayTimerRef.current) clearTimeout(substitutionOverlayTimerRef.current);
    substitutionOverlayTimerRef.current = setTimeout(() => {
      setSubstitutionOverlay(null);
    }, 3000) as unknown as number;
  };

  const handleTacticalChange = (command: string) => {
    // Aplicar mudança tática via reducer
    dispatch({ type: 'SET_PLAYING_STYLE_PRESET', presetId: command as any });

    // Feedback visual
    const feedMap: Record<string, string> = {
      PRESSAO_ALTA: 'Treinador manda pressionar alto — equipe avança as linhas e aumenta a intensidade.',
      TRANSICAO_RAPIDA: 'Instrução: transição rápida após recuperar a bola — menos toques, mais velocidade.',
      JOGO_DIRETO: 'Equipe adota jogo direto — bolas longas e disputa de segunda bola.',
      BLOCO_BAIXO: 'Time recua o bloco — linhas defensivas fechadas, menos espaço ao adversário.',
      POSSE_CONTROLADA: 'Instrução de posse controlada — construção paciente pelo meio.',
      CRIATIVO_LIVRE: 'Liberdade tática para o ataque — menos rigidez, mais improviso.',
      JOGO_PELAS_LATERAIS: 'Equipe busca as laterais — amplitude e cruzamentos na área.',
      balanced: 'Retorno ao equilíbrio tático — bloco organizado, transições controladas.',
    };
    const feedText = feedMap[command] || `Tática alterada para ${command}`;
    if (live?.phase === 'playing') {
      dispatch({ type: 'ADD_LIVE_MATCH_EVENT', text: feedText, kind: 'narrative' });
    }
  };

  // Animações de eventos
  const [scoreShakeKey, setScoreShakeKey] = useState(0);
  const lastShakeEventIdRef = useRef<string | null>(null);
  const [quickPreStart, setQuickPreStart] = useState<QuickPreStartPhase>('ready');
  const preKickoffTimersRef = useRef<number[]>([]);
  const soundEnabled = useGameStore((s) => s.userSettings.soundEnabled);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [soundStarted, setSoundStarted] = useState(false);

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

  // Sprint 3: Inicializar desafios semanais
  useEffect(() => {
    if (!streakChallenges || streakChallenges.challenges.length === 0) {
      dispatch({ type: 'REFRESH_STREAK_CHALLENGES' });
    }
  }, [streakChallenges, dispatch]);

  // Preload quick-match sound (do not autoplay). The user must press the button to start playback.
  useEffect(() => {
    if (!soundEnabled) return;
    const a = new Audio('/test-pitch/quick-match-sound.mp3');
    a.volume = 0.75;
    a.loop = true; // will loop until kickoff
    // keep reference for the button handler
    audioRef.current = a;
    // try to load the asset
    try {
      a.load();
    } catch (e) {
      // ignore
    }
    return () => {
      try {
        a.pause();
        a.currentTime = 0;
      } catch (e) {
        // ignore
      }
      if (audioRef.current === a) audioRef.current = null;
    };
  }, [soundEnabled]);

  // Stop/cleanup the audio once the pre-start sequence finishes and the match really begins (kickoff)
  useEffect(() => {
    if (quickPreStart === null && audioRef.current) {
      try {
        audioRef.current.loop = false;
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) {
        // ignore
      }
      setSoundStarted(false);
    }
  }, [quickPreStart]);

  useEffect(() => {
    if (fcGate === 'fail') {
      navigate('/', { replace: true });
    }
  }, [fcGate, navigate]);

  // Guarda anti-banner-fantasma (§12 P1): se uma partida NOVA já está rolando
  // e o summary da anterior ainda existe (o reset acima aguarda matchmaking),
  // desmonta summary + recompensas imediatamente.
  useEffect(() => {
    if (live?.phase === 'playing' && live.minute <= 1 && summary !== null) {
      setSummary(null);
      setShowInstantRewards(false);
      finalizedRef.current = false;
    }
  }, [live?.phase, live?.minute, summary]);

  // StreakBar: mostra por 5s quando o valor da sequência muda (pós-jogo).
  useEffect(() => {
    const cur = quickMatchStreak?.current ?? 0;
    if (prevStreakRef.current === null) {
      prevStreakRef.current = cur;
      return;
    }
    if (cur === prevStreakRef.current) return;
    prevStreakRef.current = cur;
    if (cur === 0) {
      setStreakBannerVisible(false);
      return;
    }
    setStreakBannerVisible(true);
    const t = window.setTimeout(() => setStreakBannerVisible(false), 5000);
    return () => window.clearTimeout(t);
  }, [quickMatchStreak?.current]);

  // Pênalti do VISITANTE (2026-06-11): o PenaltyKickModal é o POV do manager
  // batendo — pro lado de lá quem joga é o GameSpirit (manager offline). Sem
  // isto o stage 'kick' do away nunca resolvia e o relógio congelava (loop
  // pausa em lm.penalty) — sintoma "trava aos 64' e a partida não termina".
  useEffect(() => {
    const pen = live?.penalty;
    if (!pen || live?.phase !== 'playing' || pen.side !== 'away' || pen.stage !== 'kick') return;
    const t = window.setTimeout(() => {
      const cur = getGameState().liveMatch?.penalty;
      if (!cur || cur.side !== 'away' || cur.stage !== 'kick') return;
      dispatch({ type: 'APPLY_SPIRIT_OUTCOME', payload: { kind: 'penalty_resolve', rng: Math.random() } });
    }, 1800);
    return () => window.clearTimeout(t);
  }, [live?.penalty?.stage, live?.penalty?.side, live?.phase, dispatch]);

  // Watchdog anti-trava de pênalti (2026-06-11): a progressão banner→walk→kick
  // depende do spiritOverlay; se o overlay for dispensado no meio (qualquer
  // corrida de overlays), o pênalti fica órfão sem UI e o jogo congela. Se há
  // pênalti pendente SEM overlay fora do 'kick', força o avanço.
  useEffect(() => {
    const pen = live?.penalty;
    if (!pen || live?.phase !== 'playing') return;
    if (pen.stage === 'kick' || pen.stage === 'result') return;
    if (live?.spiritOverlay) return;
    const t = window.setTimeout(() => {
      const st = getGameState().liveMatch;
      const cur = st?.penalty;
      if (!cur || cur.stage === 'kick' || cur.stage === 'result' || st?.spiritOverlay) return;
      dispatch({ type: 'APPLY_SPIRIT_OUTCOME', payload: { kind: 'penalty_advance' } });
    }, 1500);
    return () => window.clearTimeout(t);
  }, [live?.penalty?.stage, live?.spiritOverlay, live?.phase, dispatch]);

  // ── Watchdog de minuto CONGELADO (2026-06-11) ──────────────────────────
  // Sintoma reportado: "chega no 2º tempo, o narrative feed roda mas o relógio
  // não avança / a partida não finaliza". Raiz: o loop da partida pausa em
  // QUALQUER estado bloqueante (pênalti da casa não-batido, momento interativo
  // órfão, sub por lesão, freeze preso) e só o feed (interval separado) segue
  // girando. O WATCHDOG_MS=240s do loop é o único backstop hoje — lento demais.
  // Aqui: se o minuto fica parado além de qualquer pausa LEGÍTIMA (gol 2s,
  // momento 5s, pênalti em estágios ~6s), destrava decisivamente o que segura
  // o loop. Interval (não setTimeout) pra re-checar sozinho sem depender de
  // re-arm via deps — cobre até estados encadeados.
  useEffect(() => {
    if (!live || live.phase !== 'playing') return;
    if (quickPreStart !== null || halfTimeUi) return;
    const STALL_UNSTICK_MS = 14_000;
    let lastMinute = getGameState().liveMatch?.minute ?? live.minute;
    let lastChangeMs = Date.now();
    const iv = window.setInterval(() => {
      const st = getGameState().liveMatch;
      if (!st || st.phase !== 'playing') return;
      if (st.minute !== lastMinute) {
        lastMinute = st.minute;
        lastChangeMs = Date.now();
        return;
      }
      if (Date.now() - lastChangeMs < STALL_UNSTICK_MS) return;
      // Minuto travado tempo demais — solta o que estiver segurando o loop.
      lastChangeMs = Date.now(); // evita disparo em rajada; re-tenta em +14s se persistir
      if (st.penalty) {
        if (st.penalty.stage === 'result' || st.spiritOverlay) {
          dispatch({ type: 'DISMISS_SPIRIT_OVERLAY' });
        } else {
          dispatch({ type: 'APPLY_SPIRIT_OUTCOME', payload: { kind: 'penalty_resolve', rng: Math.random() } });
        }
      } else if (st.activeInteractiveMoment) {
        dispatch({
          type: 'RESOLVE_QUICK_INTERACTIVE_MOMENT',
          momentId: st.activeInteractiveMoment.id,
          choiceId: null,
        });
      } else if (st.quickInjurySub) {
        dispatch({ type: 'CANCEL_QUICK_INJURY_SUB' });
      } else if (st.pendingSetPiece) {
        dispatch({ type: 'CANCEL_SET_PIECE' });
      } else if (st.spiritOverlay) {
        dispatch({ type: 'DISMISS_SPIRIT_OVERLAY' });
      }
      // freeze preso sem estado visível: libera o gate de tempo do loop.
      freezeUntilRef.current = 0;
    }, 2_000) as unknown as number;
    return () => window.clearInterval(iv);
  }, [live?.phase, quickPreStart, halfTimeUi, dispatch]);

  // Gate: aguarda o matchmaking resolver (placeholder/no-opponent são estados
  // transitórios de busca). Regra de produto 2026-05-27: a partida SEMPRE
  // acontece — manager real preferido, bot como último recurso; o GameSpirit
  // joga pelo adversário offline em qualquer caso.
  const opponentId = fixture?.opponent?.id;
  const hasValidOpponent = !!opponentId && opponentId !== 'placeholder-opponent' && opponentId !== 'no-opponent-available';

  useEffect(() => {
    if (fcParam && fcGate !== 'ok') return;
    if (!hasValidOpponent) return; // aguarda matchmaking achar manager real
    finalizedRef.current = false;
    setSummary(null);
    setShowInstantRewards(false);
    htRef.current = 0;
    setHalfTimeUi(false);
    setHalfTimeTick(3);
    setSecondYellowAlert(null);
    setYellowCountdown(8);
    if (secondYellowAutoRedRef.current) clearTimeout(secondYellowAutoRedRef.current);
    lastEmotionalMinuteRef.current = -1;
    setAssistantEvent(null);
    shownAssistantEventsRef.current = new Set();
    processedNarrativeEventIdRef.current = new Set();
    if (tacticalFeedbackTimerRef.current) clearTimeout(tacticalFeedbackTimerRef.current);
    freezeUntilRef.current = 0;
    lastSeenGoalEventIdRef.current = null;
    lastMomentMinuteRef.current = -99;
    narratorMemoryRef.current = {};
    narratedOutcomeNonceRef.current = null;
    setCinematicGoal(null);
    setMomentumAnimKey(null);
    setFeedWindowStart(0);
    lastFeedHeadIdRef.current = undefined;
    setPreGoalActive(false);
    setGoalScorerRevealDone(false);
    setQuickPreStart('ready');
    preKickoffTimersRef.current.forEach(clearTimeout);
    preKickoffTimersRef.current = [];
    dispatch({
      type: 'START_LIVE_MATCH',
      mode: 'quick',
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

    // Watchdog: a partida rápida toda dura ~100s reais (90 minutos × 1s
    // + 10s de intervalo). Mesmo com penalty/momento interativo no caminho,
    // 240s é teto generoso. Se passar disso, algo travou (modal sem callback,
    // freeze infinito por bug). Força a finalização em vez de obrigar FORFEIT.
    const matchStartedWallMs = Date.now();
    const WATCHDOG_MS = 240_000;

    const loop = () => {
      clearIv();
      matchLoopStartMsRef.current = Date.now();
      lastAssistantShownMsRef.current = Date.now(); // cooldown inicia no arranque real
      ivRef.current = setInterval(() => {

        const lm = getGameState().liveMatch;
        if (!lm || lm.phase !== 'playing') {
          clearIv();
          return;
        }
        if (lm.minute >= 90) {
          clearIv();
          // FIX final-whistle: se chegamos a 90 com phase ainda 'playing'
          // (qualquer caminho que tenha contornado a promoção em runTick),
          // forçamos a transição pra postgame aqui. Sem isso a partida
          // ficava eternamente em 90' e a única saída era FORFEIT 5x0.
          if (lm.phase === 'playing') {
            dispatch({ type: 'END_MATCH_TO_POST' });
          }
          return;
        }
        // Watchdog: se passou MUITO tempo real sem chegar ao fim, força fim.
        // Protege contra travamento de modal/freeze sem callback.
        if (Date.now() - matchStartedWallMs > WATCHDOG_MS) {
          clearIv();
          dispatch({ type: 'END_MATCH_TO_POST' });
          return;
        }
        if (Date.now() < freezeUntilRef.current) {
          return;
        }
        if (secondYellowAlertRef.current) {
          return;
        }
        // Pausa hard durante UI bloqueante — sem isso, side-effects do loop
        // (triggers de assistente, momentos interativos, narrativa) disparam
        // por trás do modal de pênalti / cobrança e poluem a tela.
        if (lm.penalty) {
          return;
        }
        if (lm.activeInteractiveMoment) {
          return;
        }
        if (lm.quickInjurySub) {
          return;
        }
        // Bola parada interativa (falta/escanteio): pausa pra não tomar/fazer
        // gol "por trás" do card. O QuickSetPieceCard auto-resolve em ~7s e o
        // watchdog de travamento cobre órfão (card desmontado sem resolver).
        if (lm.pendingSetPiece) {
          return;
        }

        // ── Triggers do Assistente Técnico ───────────────────────────────
        const shown = shownAssistantEventsRef.current;
        const penaltyActive = lm.penalty?.stage === 'kick';
        const now = Date.now();
        const cooldownOk = now - lastAssistantShownMsRef.current > 10_000;
        // Nenhum assistente nos primeiros 18s de jogo real (evita disparo imediato
        // quando jogadores já carregam fadiga de partidas anteriores)
        const matchWarmupOk = now - matchLoopStartMsRef.current > 18_000;

        // Clear assistant when penalty activates
        if (penaltyActive) {
          setAssistantEvent(null);
        }

        if (!penaltyActive && cooldownOk && matchWarmupOk) {
          // Calcular estatísticas para contexto
          const shots = lm.events.filter(e => e.kind === 'shot_home').length;
          const shotsAgainst = lm.events.filter(e => e.kind === 'shot_away').length;
          const possession = lm.possession === 'home' ? 60 : 40;

          // Triggers inteligentes baseados em eventos (Passo 5)
          const scoreDiff = lm.homeScore - lm.awayScore;
          const isLosing = scoreDiff < 0;
          const isLosingBadly = scoreDiff <= -2;
          const lowPossession = possession < 35;
          const noShots = shots === 0 && lm.minute >= 15;

          // Min 15: Análise tática inicial
          if (lm.minute === 15 && !shown.has('min15_check')) {
            shown.add('min15_check');
            lastAssistantShownMsRef.current = now;
            setAssistantEvent({
              kind: 'min15_check',
              matchContext: {
                minute: lm.minute,
                homeScore: lm.homeScore,
                awayScore: lm.awayScore,
                possession,
                shots,
                shotsAgainst,
              },
            });
          }

          // Situação crítica: perdendo por 2+ gols
          if (isLosingBadly && lm.minute >= 20 && !shown.has('losing_badly')) {
            shown.add('losing_badly');
            lastAssistantShownMsRef.current = now;
            setAssistantEvent({
              kind: 'min15_check',
              matchContext: {
                minute: lm.minute,
                homeScore: lm.homeScore,
                awayScore: lm.awayScore,
                possession,
                shots,
                shotsAgainst,
              },
            });
          }

          // Min 70: Ajuste final
          if (lm.minute === 70 && !shown.has('min70_check')) {
            shown.add('min70_check');
            lastAssistantShownMsRef.current = now;
            setAssistantEvent({
              kind: 'min70_check',
              matchContext: {
                minute: lm.minute,
                homeScore: lm.homeScore,
                awayScore: lm.awayScore,
                possession,
                shots,
                shotsAgainst,
              },
            });
          }
        }
        // ─────────────────────────────────────────────────────────────────

        // ── Sprint 2: Detectar arco narrativo a cada 5 minutos ───────────
        if (lm.minute % 5 === 0 && lm.minute > 0) {
          const shots = lm.events.filter(e =>
            e.kind === 'shot_home' ||
            (e.kind === 'narrative' && e.text.toLowerCase().includes('chut'))
          ).length;

          const shotsAgainst = lm.events.filter(e =>
            e.kind === 'shot_away' ||
            (e.kind === 'narrative' && e.text.toLowerCase().includes('adversário') && e.text.toLowerCase().includes('chut'))
          ).length;

          const arc = detectNarrativeArc({
            minute: lm.minute,
            homeScore: lm.homeScore,
            awayScore: lm.awayScore,
            events: lm.events,
            possession: lm.possession === 'home' ? 60 : 40,
            shots,
            shotsAgainst,
          });

          dispatch({ type: 'SET_NARRATIVE_ARC', arc });
        }

        // ── Sprint 2: Auto-switch de intensidade tática ──────────────────
        const autoIntensity = shouldAutoSwitchIntensity(
          lm.minute,
          lm.homeScore,
          lm.awayScore,
          (quickMatchIntensity?.current ?? 'balanced') as TacticalIntensityLevel,
        );
        if (autoIntensity) {
          dispatch({ type: 'SET_TACTICAL_INTENSITY', level: autoIntensity });
        }

        // ── Trigger momentos interativos (§4.2: racionado, ~5 nós/partida) ──
        const momentCooldownOk = lm.minute - lastMomentMinuteRef.current >= 8;
        if (!lm.activeInteractiveMoment && momentCooldownOk && Math.random() < 0.22) {
          const ctx = {
            minute: lm.minute,
            homeScore: lm.homeScore,
            awayScore: lm.awayScore,
            possession: lm.possession,
            homePlayers: lm.homePlayers,
            momentum: lm.spiritMomentum ?? { home: 50, away: 50 },
          };
          const markTriggered = () => { lastMomentMinuteRef.current = lm.minute; };

          // §5: nó de ATAQUE principal — menu gerado pelos atributos do elenco
          // (criação×defesa). Dispara com a casa tocando a bola no meio/ataque.
          if (lm.possession === 'home' && lm.minute >= 12 && lm.minute <= 86 && lm.homePlayers.length >= 5) {
            const { moment } = buildSquadDecisionMoment(lm.homePlayers, lm.minute, Date.now());
            dispatch({ type: 'TRIGGER_QUICK_INTERACTIVE_MOMENT', moment });
            markTriggered();
          } else if (shouldTriggerCounterAttack(ctx)) {
            const attacker = lm.homePlayers.find(p => p.role === 'attack');
            if (attacker) {
              const moment = buildCounterAttackMoment(ctx, attacker);
              dispatch({ type: 'TRIGGER_QUICK_INTERACTIVE_MOMENT', moment });
              markTriggered();
            }
          } else if (shouldTriggerSetPiece(ctx)) {
            const takers = lm.homePlayers
              .filter(p => p.role !== 'gk')
              .sort((a, b) => {
                const aFinishing = a.attributes?.finalizacao ?? 50;
                const bFinishing = b.attributes?.finalizacao ?? 50;
                return bFinishing - aFinishing;
              });
            if (takers.length >= 2) {
              const moment = buildSetPieceMoment(ctx, takers);
              dispatch({ type: 'TRIGGER_QUICK_INTERACTIVE_MOMENT', moment });
              markTriggered();
            }
          } else if (shouldTriggerDefensiveChoice(ctx)) {
            // FIX G: pressão adversária no nosso terço → escolha defensiva.
            const moment = buildDefensiveChoiceMoment(ctx);
            dispatch({ type: 'TRIGGER_QUICK_INTERACTIVE_MOMENT', moment });
            markTriggered();
          } else {
            // FIX G: sub timing — só dispara se há titular cansado E banco fresco.
            const tiredStarter = lm.homePlayers
              .filter((p) => p.role !== 'gk' && p.fatigue >= 78)
              .sort((a, b) => b.fatigue - a.fatigue)[0];
            const freshBenchCount = Object.values(playersById).filter((p) => {
              if (lm.homePlayers.some((hp) => hp.playerId === p.id)) return false;
              const h = playerHealth?.[p.id];
              const fat = h?.fatigue ?? p.fatigue ?? 0;
              const out = h?.outForMatches ?? p.outForMatches ?? 0;
              return fat < 55 && out === 0;
            }).length;
            const subCtx = { ...ctx, tiredStarter, freshBenchCount };
            if (shouldTriggerSubTiming(subCtx) && tiredStarter) {
              const moment = buildSubTimingMoment(ctx, tiredStarter);
              dispatch({ type: 'TRIGGER_QUICK_INTERACTIVE_MOMENT', moment });
              markTriggered();
            }
          }
        }
        // ─────────────────────────────────────────────────────────────────

        if (lm.minute === 45 && htRef.current === 0) {
          htRef.current = 1;
          clearIv();
          htTimersRef.current.forEach(clearTimeout);
          htTimersRef.current = [];
          setHalfTimeUi(true);
          // Assistente do intervalo — agora abre o AssistantAI com fluxo scriptado
          lastAssistantShownMsRef.current = Date.now();
          setHalftimeAssistantKey(Date.now());
          const endHalftime = () => {
            htTimersRef.current.forEach(clearTimeout);
            htTimersRef.current = [];
            setHalfTimeUi(false);
            setAssistantEvent(null);
            setHalftimeAssistantKey(null);
            htRef.current = 2;
            loop();
          };
          halftimeForceEndRef.current = endHalftime;
          htTimersRef.current.push(
            window.setTimeout(endHalftime, HALFTIME_MS),
          );
          return;
        }

        tick();
      }, MS_PER_MINUTE) as unknown as number;
    };

    const tPrelude = QUICK_KICKOFF_PRELUDE_MS;
    const t3Start = tPrelude;
    const t2Start = tPrelude + QUICK_KICKOFF_COUNTDOWN_MS;
    const t1Start = tPrelude + QUICK_KICKOFF_COUNTDOWN_MS * 2;
    const tKickoff = tPrelude + QUICK_KICKOFF_COUNTDOWN_MS * 3;
    const tEnd = tKickoff + QUICK_KICKOFF_MESSAGE_MS;

    preKickoffTimersRef.current.push(
      window.setTimeout(() => setQuickPreStart('c3'), t3Start),
      window.setTimeout(() => setQuickPreStart('c2'), t2Start),
      window.setTimeout(() => setQuickPreStart('c1'), t1Start),
      window.setTimeout(() => setQuickPreStart('kickoff'), tKickoff),
      window.setTimeout(() => {
        setQuickPreStart(null);
        loop();
      }, tEnd),
    );

    return () => {
      clearIv();
      htTimersRef.current.forEach(clearTimeout);
      htTimersRef.current = [];
      preKickoffTimersRef.current.forEach(clearTimeout);
      preKickoffTimersRef.current = [];
    };
  }, [session, dispatch, fcParam, fcGate, hasValidOpponent]);

  // Detecta chute defendido/bloqueado pelo texto do evento mais recente
  useEffect(() => {
    const top = live?.events[0];
    if (!top || top.kind !== 'narrative') return;
    if (top.id === lastShakeEventIdRef.current) return;
    const t = top.text.toLowerCase();
    const isSave = ['defende', 'salva', 'voou', 'bloqueou', 'punh', 'nega', 'trav'].some((kw) => t.includes(kw));
    if (!isSave) return;
    lastShakeEventIdRef.current = top.id;
    setScoreShakeKey((k) => k + 1);
  }, [live?.events]);

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
    setMomentumAnimKey(top.id);

    // Limpar spiritOverlay de gol para não conflitar com a celebração
    if (live.spiritOverlay?.kind === 'goal') {
      dispatch({ type: 'DISMISS_SPIRIT_OVERLAY' });
    }

    // §3.2: gol da CASA ganha a narração cinética (cadeia build-up → GOOOL)
    // ANTES do card do artilheiro. Mantém o relógio congelado durante a cadeia;
    // o card do artilheiro entra no onDone do cinemático.
    if (top.kind === 'goal_home') {
      const scorerName = top.playerId ? playersById[top.playerId]?.name : undefined;
      const full = buildGoalChain({ scorerName, players: live.homePlayers });
      // Compacto (3 beats ~3.5s) — partidas têm vários gols, sem arrastar.
      const beats = [full.beats[0]!, full.beats[full.beats.length - 2]!, full.beats[full.beats.length - 1]!];
      freezeUntilRef.current = Date.now() + 9000; // cobre cadeia + card
      setCinematicGoal({ chain: { ...full, beats }, goalId: top.id });
      return;
    }

    // Gol do visitante: card direto (sem takeover cinético).
    freezeUntilRef.current = Date.now() + GOAL_FREEZE_MS;
    setGoalCelebrationKey(top.id);
    setGoalCelebrationActive(true);
  }, [live?.events, live?.phase, live?.mode, preGoalActive, live?.spiritOverlay?.kind, playersById, dispatch]);

  /** Após pré-golo: 3s com cartão do marcador, depois painel narrativo (total = autoDismissMs). */
  useEffect(() => {
    if (!live || live.phase !== 'playing') {
      setGoalScorerRevealDone(false);
      return;
    }
    const o = live.spiritOverlay;
    if (!o || o.kind !== 'goal') {
      setGoalScorerRevealDone(false);
      return;
    }
    const hint = live.preGoalHint;
    if (hint && Date.now() < hint.startedAtMs + hint.durationMs) {
      setGoalScorerRevealDone(false);
      return;
    }
    if (preGoalActive) {
      setGoalScorerRevealDone(false);
      return;
    }
    setGoalScorerRevealDone(false);
    const id = o.startedAtMs;
    const t = window.setTimeout(() => {
      const st = getGameState().liveMatch;
      const cur = st?.spiritOverlay;
      if (cur?.kind === 'goal' && cur.startedAtMs === id) {
        setGoalScorerRevealDone(true);
      }
    }, GOAL_SCORER_OVERLAY_MS);
    return () => window.clearTimeout(t);
  }, [
    live?.spiritOverlay?.startedAtMs,
    live?.spiritOverlay?.kind,
    live?.phase,
    preGoalActive,
    live?.preGoalHint?.startedAtMs,
    live?.preGoalHint?.durationMs,
  ]);

  /** GameSpirit: overlay de golo/penalty — congela minutos e encadeia penalty. */
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
        if (p?.stage === 'kick') {
          // Em quick mode: o PenaltyKickModal trata o kick interativamente — não auto-resolver aqui
          if (st?.mode !== 'quick') {
            dispatch({ type: 'APPLY_SPIRIT_OUTCOME', payload: { kind: 'penalty_resolve' } });
          }
        } else if (p?.stage === 'result') {
          dispatch({ type: 'DISMISS_SPIRIT_OVERLAY' });
        } else {
          dispatch({ type: 'APPLY_SPIRIT_OUTCOME', payload: { kind: 'penalty_advance' } });
        }
        return;
      }
      dispatch({ type: 'DISMISS_SPIRIT_OVERLAY' });
    }, o.autoDismissMs);
    return () => window.clearTimeout(t);
  }, [live?.spiritOverlay?.startedAtMs, live?.spiritOverlay?.kind, live?.phase, live?.mode, dispatch]);

  useEffect(() => {
    const head = live?.events[0]?.id;
    if (head === undefined) return;
    if (lastFeedHeadIdRef.current !== head) {
      lastFeedHeadIdRef.current = head;
      setFeedWindowStart(0);
    }
  }, [live?.events]);

  useEffect(() => {
    if (!live || isBlockingNonQuickMatch(live) || live.phase !== 'playing' || summary !== null) return;
    // Feed adaptativo (2026-05-30 noite): em Partida Rápida o motor pode
    // gerar 5–10 eventos em poucos segundos (golos, narrativa, momentum…).
    // FEED_ROTATE_MS=4200 fazia o usuário ver eventos com 15-20s de atraso
    // em relação ao cronômetro — quebra a sensação de tempo real.
    // Solução: quando a fila acumular (events além do visível), rotaciona
    // proporcionalmente mais rápido até esvaziar.
    const baseRotateMs = live.narrativeArc ? getArcFeedSpeed(live.narrativeArc.arc) : FEED_ROTATE_MS;
    const eventsLen = Math.min((live.events ?? []).length, FEED_POOL_MAX);
    const queueDepth = Math.max(0, eventsLen - FEED_VISIBLE_COUNT);
    // queueDepth=0 → rotação normal; queueDepth=8 → ~1/3 do tempo; piso 900ms.
    const speedFactor = queueDepth > 0 ? Math.max(0.25, 1 - queueDepth * 0.12) : 1;
    const rotateMs = Math.max(900, Math.round(baseRotateMs * speedFactor));
    const id = window.setInterval(() => {
      setFeedWindowStart((s) => {
        const evs = getGameState().liveMatch?.events ?? [];
        const len = Math.min(evs.length, FEED_POOL_MAX);
        const maxStart = Math.max(0, len - FEED_VISIBLE_COUNT);
        if (maxStart <= 0) return 0;
        const clamped = Math.min(s, maxStart);
        return (clamped + 1) % (maxStart + 1);
      });
    }, rotateMs);
    return () => window.clearInterval(id);
  }, [live?.mode, live?.phase, live?.narrativeArc?.arc, session, summary, (live?.events ?? []).length]);

  // Enforce quick-match card rules: direct red on injury, two yellows -> red.
  const _quickEnforcedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    // reset when session (new match) starts
    _quickEnforcedRef.current = new Set();
  }, [session]);

  useEffect(() => {
    if (!live || live.phase !== 'playing' || isBlockingNonQuickMatch(live) || live.mode !== 'quick') return;
    const events = live.events ?? [];
    const yellowCount = new Map<string, number>();
    for (const ev of events) {
      if (!ev.playerId) continue;
      // handle yellows
      if (ev.kind === 'yellow_home' || ev.kind === 'yellow_away') {
        const c = (yellowCount.get(ev.playerId) ?? 0) + 1;
        yellowCount.set(ev.playerId, c);
        if (c >= 2) {
          const pid = ev.playerId;
          if (!_quickEnforcedRef.current.has(pid) && !(live.sentOffPlayerIds ?? []).includes(pid)) {
            _quickEnforcedRef.current.add(pid);
            const pitchPlayer = pitch.find((p) => p.playerId === pid);
            const entity = playersById[pid];
            setSecondYellowAlert({
              playerId: pid,
              playerName: pitchPlayer?.name ?? entity?.name ?? 'Jogador',
              playerNum: pitchPlayer?.num ?? entity?.num ?? 0,
              playerPos: pitchPlayer?.pos ?? entity?.pos ?? '',
              slotId: pitchPlayer?.slotId ?? '',
            });
          }
        }
      }
  // injury -> direct red
  if (String(ev.kind).startsWith('injury')) {
        const pid = ev.playerId;
        if (pid && !_quickEnforcedRef.current.has(pid) && !(live.sentOffPlayerIds ?? []).includes(pid)) {
          dispatch({ type: 'QUICK_ENFORCE_CARD_RULES', playerId: pid, reason: 'injury_red' });
          _quickEnforcedRef.current.add(pid);
        }
      }
    }
  }, [live?.events, live?.phase, live?.mode, dispatch]);

  // Countdown + auto-red when 2nd yellow alert is shown
  useEffect(() => {
    if (!secondYellowAlert) return;
    setYellowCountdown(5);
    if (secondYellowAutoRedRef.current) clearTimeout(secondYellowAutoRedRef.current);

    const start = Date.now();
    const tickInterval = window.setInterval(() => {
      const remaining = Math.ceil(Math.max(0, 5 - (Date.now() - start) / 1000));
      setYellowCountdown(remaining);
    }, 200);

    secondYellowAutoRedRef.current = window.setTimeout(() => {
      clearInterval(tickInterval);
      dispatch({ type: 'QUICK_ENFORCE_CARD_RULES', playerId: secondYellowAlert.playerId, reason: 'two_yellows' });
      setSecondYellowAlert(null);
    }, 5000) as unknown as number;

    return () => {
      clearInterval(tickInterval);
      if (secondYellowAutoRedRef.current) clearTimeout(secondYellowAutoRedRef.current);
    };
  }, [secondYellowAlert?.playerId, dispatch]);

  // Detectar cartões vermelhos e mostrar overlay
  const lastRedCardEventIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!live || live.phase !== 'playing' || isBlockingNonQuickMatch(live)) return;
    const events = live.events ?? [];

    // Procurar evento de cartão vermelho mais recente
    const redCardEvent = events.find(ev => ev.kind === 'red_home' || ev.kind === 'red_away');
    if (!redCardEvent || redCardEvent.id === lastRedCardEventIdRef.current) return;

    lastRedCardEventIdRef.current = redCardEvent.id;

    // Só mostrar overlay para cartões vermelhos do time da casa
    if (redCardEvent.kind === 'red_home' && redCardEvent.playerId) {
      const pitchPlayer = pitch.find(p => p.playerId === redCardEvent.playerId);
      const entity = playersById[redCardEvent.playerId];

      if (pitchPlayer || entity) {
        // Determinar motivo do cartão vermelho
        const reason: 'second_yellow' | 'direct_red' | 'violent_conduct' =
          redCardEvent.text?.toLowerCase().includes('segundo') || redCardEvent.text?.toLowerCase().includes('amarelo')
            ? 'second_yellow'
            : redCardEvent.text?.toLowerCase().includes('violenta') || redCardEvent.text?.toLowerCase().includes('agressão')
            ? 'violent_conduct'
            : 'direct_red';

        // Mostrar overlay de cartão vermelho
        setRedCardOverlay({
          player: {
            name: pitchPlayer?.name ?? entity?.name ?? 'Jogador',
            number: pitchPlayer?.num ?? entity?.num ?? 0,
            position: pitchPlayer?.pos ?? entity?.pos ?? '',
          },
          reason,
        });

        // Pausar o relógio por 3 segundos
        freezeUntilRef.current = Date.now() + 3000;

        // Auto-clear após 3 segundos
        if (redCardOverlayTimerRef.current) clearTimeout(redCardOverlayTimerRef.current);
        redCardOverlayTimerRef.current = setTimeout(() => {
          setRedCardOverlay(null);
        }, 3000) as unknown as number;
      }
    }
  }, [live?.events, live?.phase, live?.mode, pitch, playersById]);

  useEffect(() => {
    setSubPickId('');
  }, [selected?.playerId]);

  useEffect(() => {
    const q = live?.quickInjurySub;
    if (!q || live.phase !== 'playing' || halfTimeUi || summary !== null) {
      if (!q) injurySubOpenForRef.current = null;
      return;
    }
    if (injurySubOpenForRef.current === q.outPlayerId) return;
    const ent = playersById[q.outPlayerId];
    if (!ent) return;
    injurySubOpenForRef.current = q.outPlayerId;
    setSelected({
      playerId: q.outPlayerId,
      slotId: q.slotId,
      name: q.name,
      num: ent.num,
      pos: ent.pos,
      x: q.x,
      y: q.y,
      fatigue: Math.round(ent.fatigue),
      role: roleFromPos(ent.pos),
    });
  }, [live?.quickInjurySub, live?.phase, halfTimeUi, summary, playersById]);

  // Auto-close injury sub dialog após 5s — IA decide automaticamente para lesões graves
  useEffect(() => {
    const q = live?.quickInjurySub;
    if (!q || live?.phase !== 'playing' || halfTimeUi || summary !== null) {
      if (injurySubAutoCloseRef.current) clearTimeout(injurySubAutoCloseRef.current);
      setInjurySubCountdown(5);
      return;
    }

    // Verificar se é lesão grave
    const injuredPlayer = playersById[q.outPlayerId];
    const isGrave = (playerHealth?.[q.outPlayerId]?.outForMatches ?? injuredPlayer?.outForMatches ?? 1) >= 3;

    if (isGrave) {
      // Lesão grave: IA decide automaticamente quem entra
      const benchState = getGameState();
      const pitchIdSet = new Set((live.homePlayers ?? []).map(p => p.playerId));

      // Buscar melhor substituto disponível da mesma posição
      const injuredPos = injuredPlayer?.pos ?? '';
      const benchHealth = benchState.playerHealth ?? {};
      const benchPlayers = Object.values(benchState.players ?? {}).filter((p) => {
        if (pitchIdSet.has(p.id)) return false;
        const h = benchHealth[p.id];
        if (h) return (h.outForMatches ?? 0) <= 0 && (h.suspendedMatches ?? 0) <= 0;
        return p.outForMatches <= 0;
      });

      // Priorizar jogador da mesma posição, senão pegar o melhor disponível
      const bestSub = benchPlayers.find(p => p.pos === injuredPos) || benchPlayers[0];

      if (bestSub) {
        // Executa substituição automática
        dispatch({
          type: 'MATCH_SUBSTITUTE',
          outPlayerId: q.outPlayerId,
          inPlayerId: bestSub.id,
          slotId: q.slotId,
        } as any);

        // Notifica GameSpirit para recalcular forças
        dispatch({
          type: 'RECALCULATE_TEAM_STRENGTH',
          reason: 'injury_substitution',
          minute: live.minute,
        } as any);

        // Feedback no feed
        const feedText = `Lesão grave! ${injuredPlayer?.name} sai. ${bestSub.name} entra no lugar.`;
        dispatch({
          type: 'ADD_LIVE_MATCH_EVENT',
          text: feedText,
          kind: 'narrative',
        } as any);

        setSelected(null);
        return;
      } else {
        // Sem substitutos: jogador sai e time fica com 10
        const feedText = `Lesão grave! ${injuredPlayer?.name} sai. Sem substitutos disponíveis.`;
        dispatch({
          type: 'ADD_LIVE_MATCH_EVENT',
          text: feedText,
          kind: 'narrative',
        } as any);
        dispatch({ type: 'CANCEL_QUICK_INJURY_SUB' });
        setSelected(null);
        return;
      }
    }

    // Lesão leve: mantém comportamento original (countdown 5s)
    setInjurySubCountdown(5);
    const start = Date.now();
    const tickId = window.setInterval(() => {
      setInjurySubCountdown(Math.ceil(Math.max(0, 5 - (Date.now() - start) / 1000)));
    }, 200);
    injurySubAutoCloseRef.current = window.setTimeout(() => {
      clearInterval(tickId);
      dispatch({ type: 'CANCEL_QUICK_INJURY_SUB' });
      setSelected(null);
    }, 5000) as unknown as number;
    return () => {
      clearInterval(tickId);
      if (injurySubAutoCloseRef.current) clearTimeout(injurySubAutoCloseRef.current);
    };
  }, [live?.quickInjurySub?.outPlayerId, live?.phase, halfTimeUi, summary, dispatch, playersById]);

  // Feature 6 — estado emocional: mensagens no feed em momentos chave da partida
  useEffect(() => {
    if (!live || live.phase !== 'playing' || isBlockingNonQuickMatch(live)) return;
    const m = live.minute ?? 0;
    const milestones = [30, 60, 75, 85];
    const milestone = milestones.find((ms) => m >= ms && lastEmotionalMinuteRef.current < ms);
    if (!milestone) return;
    lastEmotionalMinuteRef.current = milestone;

    const players = live.homePlayers ?? [];
    const avgFatigue = players.length
      ? players.reduce((s, p) => s + p.fatigue, 0) / players.length
      : 0;
    const diff = live.homeScore - live.awayScore;

    let text = '';
    if (avgFatigue > 78) {
      text = `${m}' — Elenco visivelmente desgastado. Risco elevado de lesão e erros de concentração.`;
    } else if (avgFatigue > 65) {
      text = `${m}' — Jogadores já sentem o peso dos minutos. Substituições podem mudar a partida.`;
    } else if (diff > 1) {
      text = `${m}' — Moral em alta! O grupo joga com confiança após a vantagem no marcador.`;
    } else if (diff < -1) {
      text = `${m}' — Elenco pressionado pela desvantagem. Precisa de reação imediata.`;
    } else if (diff === 0 && milestone >= 75) {
      text = `${m}' — Empate nos minutos finais — quem arrisca mais pode vencer ou perder tudo.`;
    }
    if (text) dispatch({ type: 'ADD_LIVE_MATCH_EVENT', text, kind: 'narrative' });
  }, [live?.minute, live?.phase, dispatch]);

  // OpenAI narration: gols e cartões vermelhos
  useEffect(() => {
    if (!live || live.phase !== 'playing' || isBlockingNonQuickMatch(live)) return;
    const top = live.events[0];
    if (!top) return;
    const KEY_KINDS = new Set(['goal_home', 'goal_away', 'red_home', 'red_away']);
    if (!KEY_KINDS.has(top.kind ?? '')) return;
    if (processedNarrativeEventIdRef.current.has(top.id)) return;
    processedNarrativeEventIdRef.current.add(top.id);

    const recentLines = live.events
      .slice(1, 4)
      .map((e) => e.text)
      .filter(Boolean) as string[];

    // Resolve player name from homePlayers for goal/red events
    const playerEntity = top.playerId
      ? live.homePlayers?.find((p) => p.playerId === top.playerId)
      : undefined;

    fetchKeyMomentNarration({
      kind: top.kind as 'goal_home' | 'goal_away' | 'red_home' | 'red_away',
      player: playerEntity?.name ?? undefined,
      minute: live.minute ?? 0,
      homeTeam: live.homeShort ?? 'Casa',
      awayTeam: live.awayShort ?? 'Fora',
      homeScore: live.homeScore,
      awayScore: live.awayScore,
      buildUp: top.goalBuildUp === 'counter' ? 'counter' : top.goalBuildUp === 'positional' ? 'positional' : undefined,
      recentLines,
    }).then((narration) => {
      if (narration) {
        dispatch({ type: 'ADD_LIVE_MATCH_EVENT', text: narration, kind: 'narrative' });
      }
    });
  }, [live?.events, live?.phase, dispatch]);

  // Auto-timeout para Interactive Moments (5s)
  useEffect(() => {
    if (!live?.activeInteractiveMoment) {
      if (interactiveMomentTimeoutRef.current) {
        clearTimeout(interactiveMomentTimeoutRef.current);
        interactiveMomentTimeoutRef.current = null;
      }
      return;
    }

    // Cria timeout de 5s para escolha automática baseada na intensidade tática
    interactiveMomentTimeoutRef.current = setTimeout(() => {
      const moment = live.activeInteractiveMoment;
      if (!moment) return;

      // Escolha automática baseada na Tactical Intensity
      const intensity = quickMatchIntensity?.current ?? 'counter';
      let autoChoiceId = moment.choices[0]?.id; // fallback: primeira opção

      // Lógica de escolha baseada na intensidade
      if (intensity === 'attack' || intensity === 'press') {
        // Táticas agressivas: escolhe opção mais ofensiva (geralmente a primeira)
        autoChoiceId = moment.choices[0]?.id;
      } else if (intensity === 'defend') {
        // Tática defensiva: escolhe opção mais conservadora (geralmente a última)
        autoChoiceId = moment.choices[moment.choices.length - 1]?.id;
      } else {
        // Posse/Counter: escolhe opção do meio (balanceada)
        const midIndex = Math.floor(moment.choices.length / 2);
        autoChoiceId = moment.choices[midIndex]?.id;
      }

      dispatch({
        type: 'RESOLVE_QUICK_INTERACTIVE_MOMENT',
        momentId: moment.id,
        choiceId: autoChoiceId,
      });
    }, 5000) as unknown as number;

    return () => {
      if (interactiveMomentTimeoutRef.current) {
        clearTimeout(interactiveMomentTimeoutRef.current);
      }
    };
  }, [live?.activeInteractiveMoment, quickMatchIntensity?.current, dispatch]);

  // ── Narrador reativo (§6): reage a gols / vermelhos / decisões ───────────
  // events[0] é o mais recente (reducer prepende). Só narra lance "do agora"
  // (minuto ≈ live.minute) — assim não rebate gols velhos ao remontar.
  useEffect(() => {
    if (!live || live.phase !== 'playing') return;
    const nowMin = live.minute;
    const fresh = (m?: number) => typeof m === 'number' && nowMin - m <= 3;

    const goal = live.events.find((e) => e.kind === 'goal_home' || e.kind === 'goal_away');
    if (goal && goal.id !== narratedGoalIdRef.current && fresh(goal.minute)) {
      narratedGoalIdRef.current = goal.id;
      pushReactiveLine(
        reactToGoal(goal.kind === 'goal_home' ? 'home' : 'away', {
          minute: nowMin,
          homeScore: live.homeScore,
          awayScore: live.awayScore,
        }),
      );
      return;
    }

    const red = live.events.find((e) => e.kind === 'red_home' || e.kind === 'red_away');
    if (red && red.id !== narratedRedIdRef.current && fresh(red.minute)) {
      narratedRedIdRef.current = red.id;
      pushReactiveLine(reactToRed(red.kind === 'red_home' ? 'home' : 'away'));
    }
  }, [live?.events, live?.minute, live?.phase, live?.homeScore, live?.awayScore]);

  // Desfecho da decisão do manager → exalta/cutuca + memória do padrão.
  useEffect(() => {
    const outcome = live?.lastInteractiveOutcome;
    if (!outcome) return;
    if (narratedOutcomeNonceRef.current === null) {
      // Prime ao montar — não narra desfecho herdado de partida anterior.
      narratedOutcomeNonceRef.current = outcome.nonce;
      return;
    }
    if (outcome.nonce === narratedOutcomeNonceRef.current) return;
    narratedOutcomeNonceRef.current = outcome.nonce;
    // Se a decisão virou gol, o narrador de gol (reactToGoal) já explode o GOOOL.
    if (outcome.scored) return;
    pushReactiveLine(
      reactToDecision({
        momentType: outcome.momentType,
        success: outcome.success,
        memory: narratorMemoryRef.current,
      }),
    );
  }, [live?.lastInteractiveOutcome?.nonce]);

  useEffect(() => {
    if (!live || isBlockingNonQuickMatch(live)) return;
    if (live.phase !== 'postgame' || finalizedRef.current) return;
    // Anti-corrida (2026-06-11): ao remontar sobre um postgame antigo, o efeito
    // de START já pode ter criado uma partida NOVA neste mesmo commit — o `live`
    // desta closure ainda é o postgame velho. Sem este guard, o FINALIZE abaixo
    // matava a partida recém-criada (placar 0x0 fantasma indo pro histórico).
    const freshLm = getGameState().liveMatch;
    if (!freshLm || freshLm.phase !== 'postgame') return;
    finalizedRef.current = true;

    // ─ MVP: melhor do home por impact (homeRanked já está sorted desc)
    let mvpSnapshot: MvpSnapshot | undefined;
    if (homeRanked.length > 0) {
      const top = homeRanked[0];
      const entity = playersById[top.player.playerId];
      const goals = live.events.filter(
        (e) => e.kind === 'goal_home' && e.playerId === top.player.playerId,
      ).length;
      const assists = live.events.filter(
        (e: any) => e.kind === 'assist_home' && e.playerId === top.player.playerId,
      ).length;
      mvpSnapshot = {
        playerId: top.player.playerId,
        name: top.player.name,
        num: top.player.num,
        pos: top.player.pos,
        ovr: entity ? overallFromAttributes(entity.attrs) : undefined,
        rating: top.impact,
        goals,
        assists,
        portraitUrl: entity ? playerPortraitSrc(entity, 256, 256) : null,
      };
    }

    // ─ Stats agregadas
    const shotsHome = live.events.filter((e) => e.kind === 'shot_home').length;
    const shotsAway = live.events.filter((e) => e.kind === 'shot_away').length;
    const cornersHome = live.events.filter((e) =>
      /escanteio.*(casa|home)|córner.*(casa|home)/i.test(e.text ?? ''),
    ).length;
    const yellowsHome = live.events.filter((e) => e.kind === 'yellow_home').length;
    const redsHome = live.events.filter((e) => e.kind === 'red_home').length;
    const possessionHome = live.possession === 'home' ? 58 : 42;

    // ─ Scout da partida (Fase 1 → UI): pontos por jogador dos DOIS lados,
    //   pela régua compartilhada (determinística, capitão ×2).
    const scoutBoard = computeScoutFromEvents({
      events: live.events,
      homeRoster: live.homePlayers.map((p) => ({ id: p.playerId, name: p.name, pos: p.pos ?? p.role ?? 'MC' })),
      awayRoster: (live.awayRosterAtKickoff ?? live.awayRoster ?? []).map((p) => ({ id: p.id, name: p.name, pos: p.pos })),
      homeCaptainId: live.homeCaptainPlayerId,
      homeScore: live.homeScore,
      awayScore: live.awayScore,
    });

    setSummary({
      homeShort: live.homeShort,
      awayShort: live.awayShort,
      homeName: live.homeName,
      awayName: live.awayName,
      homeScore: live.homeScore,
      awayScore: live.awayScore,
      events: live.events.map((e) => ({ id: e.id, text: e.text })),
      result: live.homeScore > live.awayScore ? 'win' : live.homeScore < live.awayScore ? 'loss' : 'draw',
      mvp: mvpSnapshot,
      stats: { shotsHome, shotsAway, possessionHome, cornersHome, yellowsHome, redsHome },
      scout: scoutBoard,
    });
    // Mostrar recompensas instantâneas após 800ms (deixa o summary aparecer primeiro)
    window.setTimeout(() => setShowInstantRewards(true), 800);
    dispatch({ type: 'FINALIZE_MATCH' });
    // Solta o adversário (2026-06-11): sem isso o fixture persiste o mesmo
    // oponente e a PRÓXIMA partida começa instantânea contra ele — sem
    // matchmaking novo, sem a animação "Buscando partida" e repetindo o mesmo
    // time (sensação de "cone"). Placeholder força busca nova no próximo mount.
    dispatch({
      type: 'ADMIN_PATCH_NEXT_FIXTURE',
      partial: { opponent: DEFAULT_OPPONENT, awayName: DEFAULT_OPPONENT.name },
    });

    // ── Persist inverse result + away events to opponent's state (async PvP) ──
    const isRealOpponent = fixture?.opponent?.id && !fixture.opponent.id.startsWith('bot-') && !fixture.opponent.id.startsWith('placeholder');
    if (isRealOpponent) {
      const oppUserId = fixture.opponent.id;
      const oppResult: 'win' | 'draw' | 'loss' =
        live.homeScore > live.awayScore ? 'loss' : live.homeScore < live.awayScore ? 'win' : 'draw';
      // Fire-and-forget: persist opponent's Fast Liga standing
      import('@/supabase/managerGameState').then(({ persistOpponentQuickMatchResult }) => {
        persistOpponentQuickMatchResult(oppUserId, oppResult, live.awayScore, live.homeScore);
      });
      // Fire-and-forget: persist cards/injuries that happened to opponent's players
      const awayHealthEvents = live.events
        .filter((e) => (e.kind === 'yellow_away' || e.kind === 'red_away') && e.playerId)
        .map((e) => {
          const base = {
            playerId: e.playerId!,
            matchId: `quick-${Date.now()}`,
            matchMode: 'quick' as const,
            at: Date.now() + e.minute * 60_000,
          };
          if (e.kind === 'red_away') return { ...base, type: 'red_card' as const, reason: 'direct' as const };
          return { ...base, type: 'yellow_card' as const, leagueId: 'fast_liga' };
        });
      if (awayHealthEvents.length > 0) {
        import('@/supabase/managerGameState').then(({ persistOpponentAwayEvents }) => {
          persistOpponentAwayEvents(oppUserId, awayHealthEvents);
        });
      }
    }

    trackMissionEvent('fast_match_completed');
    if (live.homeScore > live.awayScore) trackMissionEvent('match_won');
    if (live.homeScore > 0) trackMissionEvent('goal_scored', live.homeScore);

    // (removido) Near-miss motivation no fim de jogo — não faz mais
    // parte do design da Partida Rápida (decisão de produto: 2026-04-28).
    // O state setShowNearMissMotivation continua existindo só pra não
    // quebrar o render do componente, mas nunca mais é setado pra true.
  }, [live, dispatch]);

  // Detect near-miss events from shot previews
  useEffect(() => {
    if (!live?.lastShotPreview) return;
    const shotId = `${live.lastShotPreview.ts}`;
    if (lastShotPreviewRef.current === shotId) return;
    lastShotPreviewRef.current = shotId;

    // Near-Miss: apenas para casos MUITO próximos (intensidade alta)
    const nearMiss = detectShotNearMiss(live.lastShotPreview.probs);
    if (nearMiss && typeof nearMiss.intensity === 'number' && nearMiss.intensity >= 0.8) {
      triggerNearMiss(nearMiss.type, nearMiss.message, nearMiss.intensity);
    }
  }, [live?.lastShotPreview, triggerNearMiss]);

  const squadReport = useMemo(
    () => evaluateOfficialSquad(lineupIds, playersById),
    [lineupIds, playersById],
  );
  const squadOkForMatch = squadReport.ok || isOfficialSquadGateRelaxedForTests();

  const maxOvr = useMemo(() => {
    const vals = Object.values(playersById);
    if (!vals.length) return 88;
    return Math.max(...vals.map((p) => overallFromAttributes(p.attrs)));
  }, [playersById]);

  const onPitchIds = useMemo(() => {
    if (live?.matchLineupBySlot && Object.keys(live.matchLineupBySlot).length > 0) {
      return new Set(Object.values(live.matchLineupBySlot));
    }
    const fatigueById = buildFatigueByIdMap(playersById, playerHealth);
    return new Set(Object.values(mergeLineupWithDefaults(lineupIds, playersById, { fatigueById })));
  }, [live, lineupIds, playersById, playerHealth]);

  // FIX D: alerta preventivo de squad exausto. Conta jogadores que entraram em
  // campo com fatigue acima do limite confortável (>75). Mostra banner antes do
  // kickoff e durante a partida em modo quiet.
  const exhaustedAlert = useMemo(() => {
    if (!onPitchIds.size) return null;
    const fatigueById = buildFatigueByIdMap(playersById, playerHealth);
    let exhaustedStarters = 0;
    let criticalStarters = 0;
    for (const pid of onPitchIds) {
      const f = fatigueById[pid] ?? 0;
      if (f >= 75) exhaustedStarters++;
      if (f >= 90) criticalStarters++;
    }
    if (criticalStarters === 0 && exhaustedStarters === 0) return null;
    return {
      tier: criticalStarters > 0 ? ('critical' as const) : ('warning' as const),
      exhaustedStarters,
      criticalStarters,
    };
  }, [onPitchIds, playersById, playerHealth]);

  const benchCards = useMemo(() => {
    return Object.values(playersById)
      .filter((p) => {
        if (onPitchIds.has(p.id)) return false;
        const h = playerHealth?.[p.id];
        if (h) return (h.outForMatches ?? 0) <= 0 && (h.suspendedMatches ?? 0) <= 0;
        return p.outForMatches <= 0;
      })
      .slice(0, 8)
      .map((p) => playerToCardView(p, maxOvr));
  }, [playersById, onPitchIds, maxOvr, playerHealth]);

  const homeStats = live?.homeStats ?? {};

  // Sprint D Fase 2: script do AssistantAI no intervalo (formações, estilos, jogadores cansados)
  const halftimeScript = useMemo<HalftimeScript>(() => {
    const currentFormation = (lineupIds?.formation ?? '4-3-3') as FormationSchemeId;
    const allFormations: FormationSchemeId[] = [
      '4-3-3',
      '4-4-2',
      '4-2-3-1',
      '3-5-2',
      '4-5-1',
      '5-3-2',
      '3-4-3',
    ];
    // Esconde a formação atual e mantém pelo menos 5
    const formations = allFormations
      .filter((f) => f !== currentFormation)
      .slice(0, 6)
      .map((f) => ({ id: f, label: f }));

    const playStyles = [
      { id: 'PRESSAO_ALTA', label: 'Pressão Alta' },
      { id: 'POSSE_CONTROLADA', label: 'Posse Controlada' },
      { id: 'TRANSICAO_RAPIDA', label: 'Contra-Ataque Rápido' },
      { id: 'BLOCO_BAIXO', label: 'Bloco Baixo' },
      { id: 'JOGO_DIRETO', label: 'Jogo Direto' },
    ];

    // Top 3 mais cansados (em campo)
    const tiredPlayers = (live?.homePlayers ?? [])
      .slice()
      .sort((a, b) => (b.fatigue ?? 0) - (a.fatigue ?? 0))
      .slice(0, 3)
      .map((p) => ({
        id: p.playerId,
        label: `${p.num} ${p.name} — ${Math.round(p.fatigue ?? 0)}% cansaço`,
      }));

    return {
      formations,
      playStyles,
      tiredPlayers,
      onPickFormation: (formation) => {
        dispatch({ type: 'LIVE_MATCH_SET_FORMATION', formation } as any);
        dispatch({
          type: 'ADD_LIVE_MATCH_EVENT',
          text: `Formação alterada para ${formation}`,
          kind: 'narrative',
        } as any);
      },
      onPickPlayStyle: (presetId) => {
        dispatch({ type: 'SET_PLAYING_STYLE_PRESET', presetId: presetId as import('@/tactics/playingStyle').PlayingStylePresetId });
      },
      onPickTiredPlayer: (playerId) => {
        // Abre o modal de substituição focado neste jogador
        const p = (live?.homePlayers ?? []).find((x) => x.playerId === playerId);
        if (p) setSelected(p);
      },
      onClose: () => {
        setHalftimeAssistantKey(null);
      },
    };
  }, [lineupIds?.formation, live?.homePlayers, dispatch]);

  // Força = SOMA dos overalls dos titulares em campo (atualiza a cada substituição/expulsão)
  const homeForce = useMemo(() => {
    const lineupMap = live?.matchLineupBySlot ?? {};
    const pitchIds = Object.keys(lineupMap).length
      ? Object.values(lineupMap)
      : (live?.homePlayers ?? []).map((p) => p.playerId);
    const sentOff = new Set(live?.sentOffPlayerIds ?? []);
    return pitchIds
      .filter((id) => !sentOff.has(id))
      .map((id) => playersById[id])
      .filter(Boolean)
      .reduce((sum, ent) => sum + overallFromAttributes(ent!.attrs), 0);
  }, [live?.matchLineupBySlot, live?.homePlayers, live?.sentOffPlayerIds, playersById]);

  const awayForce = useMemo(() => {
    if (!fixture?.opponent) return 0;
    // Enquanto buscando ou sem oponente, não exibir força fantasma (ex: "770")
    if (fixture.opponent.id === 'placeholder-opponent' || fixture.opponent.id === 'no-opponent-available') {
      return 0;
    }
    const baseOvr = fixture.opponent.strength ?? 72;
    const count = (live?.awayRoster ?? []).length || 11;
    return baseOvr * count;
  }, [live?.awayRoster, fixture?.opponent?.strength, fixture?.opponent?.id]);

  const eventsChronological = useMemo(() => [...(live?.events ?? [])].reverse(), [live?.events]);

  const awayRoster = useMemo(
    () => {
      if ((live?.awayRoster ?? []).length > 0) return live!.awayRoster!;
      if (!fixture?.opponent) return [];
      return buildAwayQuickRoster(fixture.opponent, session);
    },
    [live?.awayRoster, fixture?.opponent, session],
  );

  // ── Fase 1 PR-B — Predição V/E/D Monte Carlo pré-jogo ──────────────────
  // Reroda só se mudarem inputs estruturais. Seed deriva do id do fixture pra
  // o manager ver a MESMA leitura ao reabrir (não muda a cada refresh).
  const matchPrediction = useMemo(() => {
    if (!fixture?.opponent || fixture.opponent.id === 'placeholder-opponent' || fixture.opponent.id === 'no-opponent-available') {
      return null;
    }
    const effective = selectEffectiveTeamStrength({ players: playersById, health: playerHealth });
    if (effective.startersCounted === 0) return null;
    const mods = computeMatchContextModifiers({
      isHome: true,
      effectiveTeamStrength: effective,
    });
    const seed = Array.from(fixture.opponent.id).reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
    return simulateMatchN({
      homeTeamOvr: effective.effectiveOverall,
      awayTeamOvr: fixture.opponent.strength ?? 72,
      contextModifiers: mods,
      effectiveHomeStrength: effective,
      homeRoster: Object.values(playersById),
      n: 1000,
      seed,
    });
  }, [fixture?.opponent, playersById, playerHealth]);

  // PR-C — Recompute V/E/D AO VIVO. Trigger: mudança de placar OU múltiplos
  // de 15 min. 500 sims pra ser barato (~5ms). Esconde quando não em playing.
  const liveMinuteBucket = live?.phase === 'playing' && typeof live.minute === 'number'
    ? Math.floor(live.minute / 15) * 15
    : null;
  const livePrediction = useMemo(() => {
    if (!live || live.phase !== 'playing') return null;
    if (!fixture?.opponent || fixture.opponent.id === 'placeholder-opponent' || fixture.opponent.id === 'no-opponent-available') return null;
    const effective = selectEffectiveTeamStrength({ players: playersById, health: playerHealth });
    if (effective.startersCounted === 0) return null;
    const mods = computeMatchContextModifiers({
      isHome: true,
      effectiveTeamStrength: effective,
    });
    const seedKey = `${fixture.opponent.id}_${live.homeScore}_${live.awayScore}_${liveMinuteBucket}`;
    const seed = Array.from(seedKey).reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 13);
    return simulateLiveRemainder({
      homeTeamOvr: effective.effectiveOverall,
      awayTeamOvr: fixture.opponent.strength ?? 72,
      contextModifiers: mods,
      effectiveHomeStrength: effective,
      n: 500,
      seed,
      currentHomeGoals: live.homeScore,
      currentAwayGoals: live.awayScore,
      minutesElapsed: live.minute,
    });
  }, [live?.phase, live?.homeScore, live?.awayScore, liveMinuteBucket, fixture?.opponent, playersById, playerHealth]);

  const goalScorerOverlayProps = useMemo(() => {
    if (!live) return null;
    const ev = live.events[0];
    if (!ev || (ev.kind !== 'goal_home' && ev.kind !== 'goal_away')) return null;
    const side: 'home' | 'away' = ev.kind === 'goal_home' ? 'home' : 'away';
    let scorerName = 'Marcador';
    let scorerNumber: number | undefined;
    let scorerPortraitUrl: string | undefined;
    if (side === 'home' && ev.playerId) {
      const p = pitch.find((x) => x.playerId === ev.playerId);
      if (p) {
        scorerName = p.name;
        scorerNumber = p.num;
      }
      const entity = playersById[ev.playerId];
      if (entity) {
        scorerPortraitUrl = playerPortraitSrc(entity, 200, 200);
      }
    } else if (side === 'away' && ev.playerId) {
      const p = awayRoster.find((x) => x.id === ev.playerId);
      if (p) {
        scorerName = p.name;
        scorerNumber = p.num;
      }
    }
    const storyline = pickGoalOverlayStoryline({
      scorerName,
      minute: ev.minute,
      goalBuildUp: ev.goalBuildUp,
      side,
      awayShort: live.awayShort,
    });
    return {
      scorerName,
      scorerNumber,
      scorerPortraitUrl,
      scorerPortraitSeed: ev.playerId ?? scorerName,
      minute: ev.minute,
      side,
      homeShort: live.homeShort,
      awayShort: live.awayShort,
      homeScore: live.homeScore,
      awayScore: live.awayScore,
      goalBuildUp: ev.goalBuildUp,
      storyline,
    };
  }, [live, pitch, awayRoster, playersById]);

  const awayRanked = useMemo(() => {
    const hs = live?.homeScore ?? 0;
    const as = live?.awayScore ?? 0;
    const ph = live?.phase ?? 'playing';
    const ranked = computeAwayImpactsFromVirtualLedger(awayRoster, eventsChronological, hs, as, ph);
    return ranked.map((r) => {
      const p = awayRoster.find((x) => x.id === r.id)!;
      return { ...p, impact: r.impact };
    });
  }, [awayRoster, eventsChronological, live?.homeScore, live?.awayScore, live?.phase]);

  const homeRanked = useMemo(() => {
    if (!live) return [] as { player: PitchPlayerState; impact: number }[];
    const rows = computeHomeImpactsFromLedger(
      pitch,
      homeStats,
      live.homeImpactLedger,
      live.phase,
      live.awayScore,
      eventsChronological,
    );
    return rows
      .map((r) => {
        const player = pitch.find((p) => p.playerId === r.playerId);
        return player ? { player, impact: r.impact } : null;
      })
      .filter((x): x is { player: PitchPlayerState; impact: number } => Boolean(x));
  }, [pitch, homeStats, eventsChronological, live?.awayScore, live?.phase, live?.homeImpactLedger, live]);

  /** Expulsos em partida rápida saem do `pitch` — mostrar no fim da lista com cartão vermelho. */
  const homeSentOffRows = useMemo(() => {
    const ids = [...new Set(live?.sentOffPlayerIds ?? [])];
    const seen = new Set(homeRanked.map((r) => r.player.playerId));
    const out: { playerId: string; num: number; name: string; pos: string }[] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      const ent = playersById[id];
      if (!ent) continue;
      seen.add(id);
      out.push({ playerId: id, num: ent.num, name: ent.name, pos: ent.pos });
    }
    return out;
  }, [live?.sentOffPlayerIds, homeRanked, playersById]);

  /** Só jogadores que saíram do `awayRoster` após vermelho — baseline = snapshot no apito (reducer). */
  const awaySentOffRows = useMemo(() => {
    const baseline = live?.awayRosterAtKickoff;
    if (!baseline?.length) return [];
    const currentIds = new Set(awayRoster.map((p) => p.id));
    return baseline.filter((p) => !currentIds.has(p.id));
  }, [live?.awayRosterAtKickoff, awayRoster]);

  const feedHomeNames = useMemo(() => pitch.map((p) => p.name).filter(Boolean), [pitch]);
  const feedAwayNames = useMemo(() => awayRoster.map((p) => p.name).filter(Boolean), [awayRoster]);

  const feedVisibleEvents = useMemo(() => {
    // Curadoria (§12 P3): eventos-chave têm prioridade no pool; filler só
    // preenche vaga. live.events segue intacto (summary/narração usam tudo).
    // live.minute limita a idade dos lances-chave (anti-reciclagem do 1º tempo).
    const pool = curateQuickFeedPool(live?.events ?? [], FEED_POOL_MAX, live?.minute);
    const maxStart = Math.max(0, pool.length - FEED_VISIBLE_COUNT);
    const start = Math.min(feedWindowStart, maxStart);
    return pool.slice(start, start + FEED_VISIBLE_COUNT);
  }, [live?.events, live?.minute, feedWindowStart]);

  const { homeEventBadges, awayEventBadges } = useMemo(() => {
    const home = new Map<string, QuickEventBadge[]>();
    const away = new Map<string, QuickEventBadge[]>();
    const list = [...(live?.events ?? [])].reverse();
    for (const ev of list) {
      if (ev.kind === 'goal_home' && ev.playerId) {
        pushBadge(home, ev.playerId, 'goal');
      }
      if (ev.kind === 'goal_away' && ev.playerId) {
        pushBadge(away, ev.playerId, 'goal');
      }
      if (ev.kind === 'yellow_home' && ev.playerId) pushBadge(home, ev.playerId, 'yellow');
      if (ev.kind === 'red_home' && ev.playerId) pushBadge(home, ev.playerId, 'red');
      if (ev.kind === 'yellow_away' && ev.playerId) pushBadge(away, ev.playerId, 'yellow');
      if (ev.kind === 'red_away' && ev.playerId) pushBadge(away, ev.playerId, 'red');
      if (ev.kind === 'injury_home' && ev.playerId) pushBadge(home, ev.playerId, 'injury');
    }
    return { homeEventBadges: home, awayEventBadges: away };
  }, [live?.events, awayRoster]);

  const minute = live?.minute ?? 0;
  // CRÍTICO: cada estado que pausa o setInterval do tick PRECISA também congelar
  // o clock display. Senão o display interpola sem o snapshot avançar — vai
  // "viajando no tempo" pra frente e quando o snapshot finalmente atualiza,
  // o display "volta pra trás" pra refletir o tempo real do snapshot.
  // Sintoma reportado: chega a 70', volta pra 38' quando alerta de 2º amarelo é resolvido.
  //
  // v2 (2026-05-30): além do `frozen` derivado de state, passamos `freezeUntilMs`
  // pro clock para o RAF respeitar o timer mesmo entre renders. Combinado com
  // o cap de +60s no display (LiveMatchClockDisplay), elimina o time-travel
  // mesmo quando algum estado de pausa fica fora de sync.
  const clockFrozen =
    quickPreStart !== null ||
    halfTimeUi ||
    (!goalCelebrationActive && !!(live?.spiritOverlay)) ||
    preGoalActive ||
    goalCelebrationActive ||
    !!live?.quickInjurySub ||
    !!live?.penalty ||
    !!live?.activeInteractiveMoment ||
    !!live?.pendingSetPiece ||
    !!cinematicGoal ||
    !!secondYellowAlert ||
    Date.now() < freezeUntilRef.current;
  const matchClock = (
    <div className="flex flex-col items-center gap-1.5">
      <LiveMatchClockDisplay
        elapsedSec={live?.footballElapsedSec ?? 0}
        frozen={clockFrozen}
        phase={live?.phase}
        msPerMinute={MS_PER_MINUTE}
        freezeUntilMs={freezeUntilRef.current}
      />
      {live?.lastShotPreview && Date.now() - live.lastShotPreview.ts < 3500 ? (
        <ShotProbabilityBar preview={live.lastShotPreview} />
      ) : null}
    </div>
  );
  const showBoard = summary === null;

  const momentumPressure = useMemo(() => {
    if (!live || live.phase !== 'playing') return 0.5;
    if (live.spiritMomentumClamp01 != null) {
      return Math.min(0.98, Math.max(0.02, live.spiritMomentumClamp01));
    }
    return momentumPressure01(live.possession, live.ball.x, live.spiritMomentum);
  }, [live?.possession, live?.ball.x, live?.phase, live?.spiritMomentumClamp01, live?.spiritMomentum]);

  const displayHomeScore = preGoalActive && live?.preGoalHint?.side === 'home'
    ? (live?.homeScore ?? 1) - 1
    : live?.homeScore ?? 0;
  const displayAwayScore = preGoalActive && live?.preGoalHint?.side === 'away'
    ? (live?.awayScore ?? 1) - 1
    : live?.awayScore ?? 0;

  const barTransitionMs = preGoalActive ? (live?.preGoalHint?.durationMs ?? 3000) : 500;
  /** Mesmo easing do retorno ao centro pós-golo: desacelera ao aproximar do extremo. */
  const barEasing = 'ease-out';

  const handleYellowSubstituteNow = () => {
    if (!secondYellowAlert) return;
    if (secondYellowAutoRedRef.current) clearTimeout(secondYellowAutoRedRef.current);
    const pitchPlayer = pitch.find((p) => p.playerId === secondYellowAlert.playerId);
    setSelected(
      pitchPlayer ?? {
        playerId: secondYellowAlert.playerId,
        slotId: secondYellowAlert.slotId,
        name: secondYellowAlert.playerName,
        num: secondYellowAlert.playerNum,
        pos: secondYellowAlert.playerPos,
        x: 50,
        y: 50,
        fatigue: 0,
        role: 'mid',
      },
    );
    setSecondYellowAlert(null);
  };

  const handleYellowWaitVar = () => {
    if (!secondYellowAlert) return;
    if (secondYellowAutoRedRef.current) clearTimeout(secondYellowAutoRedRef.current);
    dispatch({ type: 'QUICK_ENFORCE_CARD_RULES', playerId: secondYellowAlert.playerId, reason: 'two_yellows' });
    setSecondYellowAlert(null);
  };

  const dismissCoachMoment = () => {
    // TODO: Implementar quando coachMoment for adicionado
    // if (coachMomentDismissRef.current) clearTimeout(coachMomentDismissRef.current);
    // setCoachMoment(null);
  };

  const COACH_ACTION_FEED: Record<string, string> = {
    PRESSAO_ALTA: 'Treinador manda pressionar alto — equipe avança as linhas e aumenta a intensidade.',
    TRANSICAO_RAPIDA: 'Instrução: transição rápida após recuperar a bola — menos toques, mais velocidade.',
    JOGO_DIRETO: 'Equipe adota jogo direto — bolas longas e disputa de segunda bola.',
    BLOCO_BAIXO: 'Time recua o bloco — linhas defensivas fechadas, menos espaço ao adversário.',
    POSSE_CONTROLADA: 'Instrução de posse controlada — construção paciente pelo meio.',
    CRIATIVO_LIVRE: 'Liberdade tática para o ataque — menos rigidez, mais improviso.',
    JOGO_PELAS_LATERAIS: 'Equipe busca as laterais — amplitude e cruzamentos na área.',
    balanced: 'Retorno ao equilíbrio tático — bloco organizado, transições controladas.',
  };

  const applyCoachAction = (presetId: string) => {
    dispatch({ type: 'SET_PLAYING_STYLE_PRESET', presetId: presetId as import('@/tactics/playingStyle').PlayingStylePresetId });
    const feedText = COACH_ACTION_FEED[presetId];
    if (feedText && live?.phase === 'playing') {
      dispatch({ type: 'ADD_LIVE_MATCH_EVENT', text: feedText, kind: 'narrative' });
    }
    dismissCoachMoment();
  };

  const confirmForfeitQuick = () => {
    dispatch({ type: 'FORFEIT_MATCH', mode: 'quick' });
    setForfeitOpen(false);
    setSelected(null);
  };

  // Early returns após todos os hooks
  if (fcParam && fcGate === 'pending') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <p className="font-display text-sm font-bold uppercase tracking-wider text-neon-yellow">Amistoso online</p>
        <p className="max-w-sm text-sm text-gray-400">A validar convite aceite…</p>
      </div>
    );
  }

  // Loading narrativo real: "Buscando partida → Encontrada → Times em campo →
  // Torcida vibra → Começa a partida". Auto-completa e dá lugar à partida.
  if (!live && !summary) {
    return (
      <MatchFindingOverlay
        opponent={pvpStub ?? null}
        homeShort={club.shortName}
        onComplete={() => { /* live será criado em paralelo — re-render natural */ }}
      />
    );
  }

  // Branch legado de "Nenhum manager disponível" — matchmaking agora SEMPRE
  // devolve oponente (manager real ou bot fallback). Mantido por safety nos
  // saves antigos que ainda carreguem NO_OPPONENT_STUB_ID em location.state.
  if (opponentId === 'no-opponent-available') {
    return (
      <div className="flex w-full min-h-svh items-center justify-center bg-deep-black px-6">
        <div className="max-w-md text-center space-y-6">
          <div className="ole-eyebrow !text-neon-yellow"><span>Partida rápida</span></div>
          <h1
            className="text-white italic"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontWeight: 700,
              fontSize: 'clamp(28px, 5vw, 44px)',
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
            }}
          >
            Nenhum manager disponível
          </h1>
          <p className="text-white/65 text-sm leading-relaxed">
            Estamos escalando um adversário pra ti — a busca recomeça sozinha em instantes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="bg-neon-yellow text-black px-5 py-2.5 hover:bg-white transition-colors"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '11px',
                fontWeight: 900,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              Procurar de novo
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="border border-white/15 text-white/80 px-5 py-2.5 hover:border-neon-yellow hover:text-neon-yellow transition-colors"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              Voltar pra Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full min-h-0 flex-1 flex-col space-y-4 py-6 px-4 pb-[calc(13rem+env(safe-area-inset-bottom,0px))] md:flex-none" style={{ touchAction: 'pan-y' }}>
      {/* Streak Bar */}
      {streakBannerVisible && <StreakBar streak={quickMatchStreak} />}

      {/* Top bar — chrome editorial Olefoot */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-white/65 hover:text-neon-yellow transition-colors"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}
        >
          ← Home
        </Link>

        {/* Centro — eyebrow + logo + sub */}
        <div className="flex flex-col items-center gap-3 flex-1 min-w-0">
          <div className="ole-eyebrow !text-neon-yellow" style={{ fontFamily: 'var(--font-ui)' }}>
            <span>Partida rápida</span>
          </div>
          {soundEnabled ? (
            !soundStarted ? (
              <button
                type="button"
                onClick={() => {
                  const a = audioRef.current ?? new Audio('/test-pitch/quick-match-sound.mp3');
                  a.loop = true;
                  a.volume = 0.75;
                  audioRef.current = a;
                  void a.play().then(() => setSoundStarted(true)).catch(() => {
                    setSoundStarted(false);
                  });
                }}
                className="inline-flex items-center gap-1.5 bg-neon-yellow px-4 py-2 text-black hover:bg-white transition-colors"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                Tocar som
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const a = audioRef.current;
                  if (a) {
                    try {
                      a.loop = false;
                      a.pause();
                      a.currentTime = 0;
                    } catch (e) {}
                  }
                  setSoundStarted(false);
                }}
                className="inline-flex items-center gap-1.5 border border-[var(--color-border)] bg-deep-black px-4 py-2 text-white/80 hover:border-neon-yellow/60 hover:text-neon-yellow transition-colors"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                Parar som
              </button>
            )
          ) : null}
        </div>

        {/* Sair (durante jogo) */}
        {showBoard && live?.phase === 'playing' && quickPreStart === null ? (
          <button
            type="button"
            onClick={() => setForfeitOpen(true)}
            className="inline-flex items-center gap-1.5 border border-[var(--color-danger)] bg-[rgba(255,61,61,0.08)] px-3 py-1.5 text-[var(--color-danger)] hover:bg-[rgba(255,61,61,0.16)] transition-colors"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        ) : (
          <span className="w-12" aria-hidden /> /* spacer pra equilibrar com o ← Home */
        )}
      </div>

      {/* FIX D: Banner de squad exausto — visível pré-jogo e durante a partida */}
      {showBoard && exhaustedAlert && (
        <div
          className={`mb-3 border border-l-[3px] px-4 py-3 flex items-start gap-3 ${
            exhaustedAlert.tier === 'critical'
              ? 'border-rose-500/40 border-l-rose-400 bg-rose-500/10'
              : 'border-amber-500/40 border-l-amber-400 bg-amber-500/10'
          }`}
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          <div
            className={`mt-0.5 text-lg ${
              exhaustedAlert.tier === 'critical' ? 'text-rose-300' : 'text-amber-300'
            }`}
            aria-hidden
          >
            ⚠
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={`font-display uppercase tracking-[0.2em] text-[10px] font-black ${
                exhaustedAlert.tier === 'critical' ? 'text-rose-300' : 'text-amber-300'
              }`}
            >
              {exhaustedAlert.tier === 'critical' ? 'Squad em risco' : 'Squad cansado'}
            </p>
            <p className="text-[12px] text-white/75 mt-0.5">
              {exhaustedAlert.criticalStarters > 0 ? (
                <>
                  {exhaustedAlert.criticalStarters} titular(es) com fadiga ≥90% em campo —
                  rendimento e risco de lesão comprometidos.
                </>
              ) : (
                <>
                  {exhaustedAlert.exhaustedStarters} titular(es) cansado(s). Considere descanso
                  ou substituições rápidas.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {showBoard && !live && (
        <div
          className="border border-[var(--color-border)] border-l-[3px] border-l-[var(--color-warning)] bg-dark-gray p-6 sm:p-7"
          style={{ borderRadius: 'var(--radius-md)' }}
        >
          {!squadOkForMatch ? (
            <div className="flex flex-col items-start gap-4">
              <div className="ole-eyebrow !text-[var(--color-warning)] !justify-start">
                <span>Plantel incompleto</span>
              </div>
              <p
                className="italic text-white/85"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontSize: 'clamp(1.1rem, 2.4vw, 1.5rem)',
                  lineHeight: 1.4,
                  letterSpacing: '-0.005em',
                }}
              >
                Precisas de <span className="not-italic text-neon-yellow tabular-nums" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>11 titulares</span> e pelo menos <span className="not-italic text-neon-yellow tabular-nums" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>5 no banco</span> pra entrar em campo.
              </p>
              {squadReport.reason ? (
                <p
                  className="border border-[var(--color-border)] bg-deep-black px-3 py-2 text-white/55 max-w-full"
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '12px',
                    lineHeight: 1.5,
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {squadReport.reason}
                </p>
              ) : null}
              <Link
                to="/team"
                className="inline-flex items-center justify-center gap-2 bg-neon-yellow px-7 py-3 text-black hover:bg-white hover:scale-[1.005] active:scale-[0.995] transition-all"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                }}
              >
                Ajustar plantel
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {matchPrediction ? (
                <MatchPredictionPanel
                  result={matchPrediction}
                  homeName={club?.shortName ?? 'Casa'}
                  awayName={fixture?.opponent?.shortName ?? 'Visitante'}
                />
              ) : null}
              <p
                className="italic text-white/55 text-center py-2"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontSize: 'clamp(15px, 2vw, 18px)',
                  lineHeight: 1.4,
                }}
              >
                "a preparar a partida…"
              </p>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {forfeitOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90"
            role="dialog"
            aria-modal="true"
            aria-labelledby="forfeit-quick-title"
            onClick={() => setForfeitOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              className="w-full max-w-sm border border-[var(--color-border)] border-l-[3px] border-l-[var(--color-danger)] bg-deep-black p-6"
              style={{ borderRadius: 'var(--radius-md)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <span aria-hidden className="w-[3px] h-7 bg-[var(--color-danger)] shrink-0" />
                <h2
                  id="forfeit-quick-title"
                  className="text-[var(--color-danger)] uppercase"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '14px',
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                  }}
                >
                  Sair do jogo?
                </h2>
              </div>
              <p
                className="italic text-white/85"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontSize: 'clamp(16px, 2.2vw, 19px)',
                  lineHeight: 1.45,
                }}
              >
                Você perde por{' '}
                <span
                  className="not-italic text-[var(--color-danger)] tabular-nums"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
                >
                  5×0
                </span>
                . O resultado entra na liga e no histórico.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  className="w-full py-3 bg-[var(--color-danger)] hover:bg-white hover:text-[var(--color-danger)] text-white transition-colors"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  onClick={confirmForfeitQuick}
                >
                  Confirmar desistência
                </button>
                <button
                  type="button"
                  className="w-full py-3 border border-[var(--color-border)] bg-deep-black text-white/75 hover:border-neon-yellow/60 hover:text-neon-yellow transition-colors"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  onClick={() => setForfeitOpen(false)}
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Second Yellow Alert - Notificação discreta no topo */}
      <AnimatePresence>
        {secondYellowAlert && live?.phase === 'playing' && (
          <motion.div
            key="second-yellow-notification"
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[90] w-full max-w-md px-4"
          >
            <div className="bg-amber-500/95 backdrop-blur-sm border-2 border-amber-400 rounded-lg p-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="flex gap-1 shrink-0">
                  <span className="inline-block w-3 h-4 rounded-[2px] bg-amber-600" />
                  <span className="inline-block w-3 h-4 rounded-[2px] bg-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Segundo Amarelo
                  </p>
                  <p className="text-sm font-black text-black truncate">
                    #{secondYellowAlert.playerNum} {secondYellowAlert.playerName}
                  </p>
                </div>
                <button
                  onClick={handleYellowSubstituteNow}
                  className="shrink-0 px-3 py-1.5 bg-black text-amber-400 text-xs font-bold uppercase tracking-wider rounded hover:bg-gray-900 transition-colors"
                >
                  Substituir
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {halfTimeUi ? (
          <Fragment key="match-halftime">
            <MatchInterruptOverlay
              kind="halftime"
              title="Intervalo"
              lines={['Escolhe as alterações para o 2.º tempo']}
            />
          </Fragment>
        ) : live?.spiritOverlay?.kind === 'goal' &&
          !preGoalActive &&
          goalScorerOverlayProps &&
          !goalScorerRevealDone ? (
          <GoalScorerOverlay
            key={`goal-scorer-${live.spiritOverlay.startedAtMs}`}
            {...goalScorerOverlayProps}
          />
        ) : live?.spiritOverlay && !preGoalActive ? (
          <Fragment key={`spirit-${live.spiritOverlay.startedAtMs}-${live.spiritOverlay.kind}`}>
            <MatchInterruptOverlay
              kind={live.spiritOverlay.kind}
              title={live.spiritOverlay.title}
              lines={live.spiritOverlay.lines}
            />
          </Fragment>
        ) : null}
      </AnimatePresence>

      {/* Painel de previsão é banner de PRÉ-jogo: desmonta quando a bola rola
          (§12 P1 — banners persistentes sujavam a tela durante a partida). */}
      {showBoard && live && livePrediction && quickPreStart !== null ? (
        <div className="mb-3">
          <MatchPredictionPanel
            result={livePrediction}
            homeName={club?.name ?? club?.shortName ?? 'Casa'}
            awayName={fixture?.opponent?.name ?? fixture?.opponent?.shortName ?? 'Visitante'}
            compact
          />
        </div>
      ) : null}

      {showBoard && live && (
        <div data-tutorial-anchor="match-quick-board" className="glass-panel p-5 border border-white/10 space-y-4 relative overflow-visible">
          {quickPreStart === 'ready' || quickPreStart === 'c3' || quickPreStart === 'c2' || quickPreStart === 'c1' ? (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/55 backdrop-blur-[2px] pointer-events-none"
              aria-live="polite"
            >
              {/* Confronto SEMPRE visível no pré-jogo (§ "contra qual time é o jogo?") */}
              <p
                className="font-display uppercase text-white/70 text-center px-4 max-w-full truncate"
                style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.22em' }}
              >
                <span className="text-neon-yellow">{live.homeName ?? live.homeShort}</span>
                <span className="mx-2 text-white/40">×</span>
                <span>{live.awayName ?? fixture?.opponent?.name ?? live.awayShort}</span>
              </p>
              {quickPreStart === 'ready' ? (
                <motion.span
                  key="ready"
                  initial={{ scale: 0.9, opacity: 0, letterSpacing: '0.05em' }}
                  animate={{ scale: 1, opacity: 1, letterSpacing: '0.25em' }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="font-display font-black text-[min(8vw,2.2rem)] uppercase text-white/90 drop-shadow-[0_0_18px_rgba(234,255,0,0.35)]"
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
                  className="font-display font-black text-[min(22vw,7rem)] text-neon-yellow tabular-nums drop-shadow-[0_0_24px_rgba(234,255,0,0.35)]"
                >
                  {quickPreStart === 'c3' ? 3 : quickPreStart === 'c2' ? 2 : 1}
                </motion.span>
              )}
            </div>
          ) : null}

          <motion.div
            key={scoreShakeKey}
            animate={scoreShakeKey > 0 ? { x: [0, -7, 7, -5, 5, -3, 3, 0] } : { x: 0 }}
            transition={{ duration: 0.42, ease: 'easeInOut' }}
            className="relative"
          >
            <MatchdayVersusWithClock
              homeShort={live.homeShort}
              awayShort={live.awayShort}
              homeName={live.homeName}
              awayName={live.awayName}
              awaySeed={fixture?.opponent?.id ?? 'away'}
              clock={matchClock}
              scoreboardCountdownSec={null}
              rowClassName="w-full max-w-[min(100%,44rem)] mx-auto"
            />
          </motion.div>
          {/* Força dos times — Moret italic, padrão DNA do Campeão */}
          <div className="w-full max-w-[min(100%,44rem)] mx-auto mt-2 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            <div className="flex flex-col items-start gap-1">
              <motion.span
                key={homeForce}
                initial={{ scale: 1.15 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.4 }}
                className="italic text-neon-yellow tabular-nums leading-none"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontWeight: 700,
                  fontSize: 'clamp(24px, 3.5vw, 32px)',
                  letterSpacing: '-0.02em',
                }}
              >
                {homeForce || '—'}
              </motion.span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span
                className="italic text-white/40"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontWeight: 400,
                  fontSize: 'clamp(16px, 2.2vw, 22px)',
                  lineHeight: 1,
                }}
              >
                vs
              </span>
              <div className="flex flex-col gap-0.5 text-center">
                {(live.sentOffPlayerIds ?? []).length > 0 && (
                  <span
                    className="text-[var(--color-danger)] uppercase"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '9px',
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                    }}
                  >
                    {(live.sentOffPlayerIds ?? []).length} exp.
                  </span>
                )}
                {awaySentOffRows.length > 0 && (
                  <span
                    className="text-[var(--color-danger)]/70 uppercase"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '9px',
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                    }}
                  >
                    {awaySentOffRows.length} exp. vis.
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <motion.span
                key={awayForce}
                initial={{ scale: 1.15 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.4 }}
                className="italic text-white tabular-nums leading-none"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontWeight: 700,
                  fontSize: 'clamp(24px, 3.5vw, 32px)',
                  letterSpacing: '-0.02em',
                }}
              >
                {awayForce || '—'}
              </motion.span>
            </div>
          </div>
          {/* Score editorial — Moret italic gigante (assinatura Olefoot) */}
          <div
            className={cn(
              'flex justify-center items-center transition-opacity',
              quickPreStart === 'ready' || quickPreStart === 'c3' || quickPreStart === 'c2' || quickPreStart === 'c1'
                ? 'opacity-35'
                : 'opacity-100',
            )}
          >
            <span
              className="italic text-neon-yellow tabular-nums leading-none"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontWeight: 700,
                fontSize: 'clamp(56px, 12vw, 112px)',
                letterSpacing: '-0.04em',
              }}
            >
              {displayHomeScore}
            </span>
            <span
              className="italic text-white/40 leading-none mx-2 sm:mx-3"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontWeight: 400,
                fontSize: 'clamp(40px, 8vw, 76px)',
              }}
            >
              –
            </span>
            <span
              className="italic text-white tabular-nums leading-none"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontWeight: 700,
                fontSize: 'clamp(56px, 12vw, 112px)',
                letterSpacing: '-0.04em',
              }}
            >
              {displayAwayScore}
            </span>
          </div>
          {/* §6: narrador reativo — legenda cinética sobre o lance */}
          {quickPreStart === null && live.phase === 'playing' && (
            <QuickReactiveNarrator line={reactiveLine} />
          )}
          {quickPreStart === null ? (
            <div className="w-full max-w-[min(100%,44rem)] mx-auto pt-4">
              <MomentumBar
                momentum={momentumPressure}
                homeShort={live.homeShort}
                awayShort={live.awayShort}
                homeColor="#FDE047"
                awayColor="#FFFFFF"
              />

              {/* ─── Sprint 2: Controles de Intensidade Tática (logo abaixo do momentum) ─────────────────── */}
              {live?.phase === 'playing' && !halfTimeUi && !live.activeInteractiveMoment && !summary && (
                <div className="mt-4">
                  <QuickTacticalIntensityControls
                    current={(quickMatchIntensity?.current ?? 'balanced') as TacticalIntensityLevel}
                    onChange={(level) => dispatch({ type: 'SET_TACTICAL_INTENSITY', level })}
                    disabled={false}
                  />
                  <div className="mt-2">
                    <QuickTacticalIntensityInfo level={(quickMatchIntensity?.current ?? 'balanced') as TacticalIntensityLevel} />
                  </div>
                </div>
              )}
            </div>
          ) : null}
          {quickPreStart === null ? (
            <div className="space-y-2 pt-1 hidden">
              <p className="text-[9px] font-bold uppercase tracking-wider text-center text-gray-500">
                Momento — pressão em direção à baliza adversária
              </p>
              <div
                key={momentumAnimKey ?? 'momentum-idle'}
                className={cn(
                  'relative w-full px-0.5',
                  momentumAnimKey && 'momentum-bar-goal-flash rounded-lg py-1',
                )}
              >
                <div
                  className="relative w-full origin-center"
                  style={{
                    transform: preGoalActive ? 'scaleX(1.06) scaleY(1.45)' : 'scale(1)',
                    transitionProperty: 'transform',
                    transitionDuration: `${barTransitionMs}ms`,
                    transitionTimingFunction: 'ease-out',
                  }}
                >
                  <div className="relative w-full h-9 flex items-center">
                    <div
                      className={cn(
                        'absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full border overflow-hidden pointer-events-none',
                        preGoalActive
                          ? 'h-4 border-neon-yellow/50 bg-black/70 shadow-[0_0_28px_rgba(228,255,0,0.25)]'
                          : 'h-3 border-white/15 bg-black/50',
                      )}
                      style={{
                        transitionProperty: 'height, border-color, box-shadow, background-color',
                        transitionDuration: `${barTransitionMs}ms`,
                        transitionTimingFunction: 'ease-out',
                      }}
                    >
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-neon-yellow/65 via-neon-yellow/25 to-transparent"
                        style={{
                          width: `${momentumPressure * 100}%`,
                          transitionProperty: 'width',
                          transitionDuration: `${barTransitionMs}ms`,
                          transitionTimingFunction: barEasing,
                        }}
                        aria-hidden
                      />
                      <div
                        className="absolute inset-y-0 right-0 rounded-full bg-gradient-to-l from-white/18 to-transparent"
                        style={{
                          left: `${momentumPressure * 100}%`,
                          transitionProperty: 'left',
                          transitionDuration: `${barTransitionMs}ms`,
                          transitionTimingFunction: barEasing,
                        }}
                        aria-hidden
                      />
                    </div>
                    <div
                      className={cn(
                        'absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white pointer-events-none',
                        preGoalActive
                          ? 'h-7 w-2 ring-2 ring-neon-yellow/60 shadow-[0_0_36px_rgba(228,255,0,0.95)]'
                          : 'h-5 w-1.5 ring-2 ring-white/40 shadow-[0_0_16px_rgba(228,255,0,0.65)]',
                      )}
                      style={{
                        left: `${momentumPressure * 100}%`,
                        transitionProperty: 'left, height, width, box-shadow, ring-color',
                        transitionDuration: `${barTransitionMs}ms`,
                        transitionTimingFunction: barEasing,
                      }}
                      aria-hidden
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-start gap-2 text-[9px] font-bold uppercase tracking-wide px-0.5">
                <span className={live.possession === 'home' ? 'text-neon-yellow' : 'text-gray-500'}>
                  {live.homeShort}{' '}
                  <span className="font-extrabold">{live.possession === 'home' ? 'ataca →' : 'defende'}</span>
                </span>
                <span className={live.possession === 'away' ? 'text-white' : 'text-gray-500'}>
                  <span className="font-extrabold">{live.possession === 'away' ? '← ataca' : 'defende'}</span>{' '}
                  {live.awayShort}
                </span>
              </div>
            </div>
          ) : (
            <div className="min-h-[5.5rem] pt-1 flex items-center justify-center border border-white/8 rounded-lg bg-black/20">
              <p className="text-[10px] font-medium text-gray-500 text-center px-4">
                {quickPreStart === 'kickoff'
                  ? 'Bola a rolar em instantes…'
                  : 'Prepara-te — o apito soa em segundos.'}
              </p>
            </div>
          )}
          <div className="border-t border-white/10 pt-3 mt-2 space-y-2">
            {/* §12 pivot: decisão INLINE no topo do feed (não takeover) */}
            <AnimatePresence>
              {quickPreStart === null && live.activeInteractiveMoment && (
                <QuickFeedDecisionCard
                  moment={live.activeInteractiveMoment}
                  onChoice={(choiceId) =>
                    dispatch({
                      type: 'RESOLVE_QUICK_INTERACTIVE_MOMENT',
                      momentId: live.activeInteractiveMoment!.id,
                      choiceId,
                    })
                  }
                />
              )}
            </AnimatePresence>
            <div className="min-h-[4.5rem] space-y-1.5 overflow-hidden">
              {quickPreStart === 'kickoff' ? (
                <div className="flex items-center justify-center min-h-[4.5rem] px-3">
                  <p
                    className="font-display font-black text-base sm:text-lg uppercase tracking-wide text-center text-neon-yellow"
                    aria-live="assertive"
                  >
                    COMEÇA A PARTIDA
                  </p>
                </div>
              ) : quickPreStart === 'ready' || quickPreStart === 'c3' || quickPreStart === 'c2' || quickPreStart === 'c1' ? (
                <div className="flex items-center justify-center min-h-[4.5rem]">
                  <p className="text-[11px] text-gray-500 text-center font-medium">Feed ao vivo após o apito…</p>
                </div>
              ) : (
                <AnimatePresence initial={false} mode="popLayout">
                  {feedVisibleEvents.map((e) => {
                    const isYellow = e.kind === 'yellow_home' || e.kind === 'yellow_away';
                    const isRed = e.kind === 'red_home' || e.kind === 'red_away';
                    const isCard = isYellow || isRed;
                    const cardGlow = isRed
                      ? ['0 0 0 2px #ef4444cc', '0 0 10px 3px #ef444466', '0 0 0 0px transparent']
                      : isYellow
                        ? ['0 0 0 2px #fbbf24cc', '0 0 10px 3px #fbbf2466', '0 0 0 0px transparent']
                        : undefined;
                    return (
                      <motion.div
                        key={e.id}
                        layout="position"
                        initial={{ opacity: 0, x: 44 }}
                        animate={
                          isCard
                            ? { opacity: 1, x: 0, boxShadow: cardGlow }
                            : { opacity: 1, x: 0 }
                        }
                        exit={{ opacity: 0, x: -10, transition: { duration: 0.18 } }}
                        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                        className={cn(
                          'text-[11px] text-gray-300 leading-relaxed rounded-md px-2 py-1.5 border border-white/6',
                          quickFeedLineClass(e.kind),
                        )}
                      >
                        {renderQuickFeedRichText(e.text, {
                          homeShort: live.homeShort,
                          awayShort: live.awayShort,
                          homeNames: feedHomeNames,
                          awayNames: feedAwayNames,
                          homeClassName: 'text-neon-yellow',
                          awayClassName: 'text-gray-100',
                        })}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>
      )}

      {showBoard && live && (
        // C4 — safe area pra bottom nav (botão JOGAR + h-16) não cobrir
        // o último card do board.
        <div className="pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 sm:gap-3 md:gap-4 items-start w-full">
            <div className="space-y-3 min-w-0">
              {/* Header da coluna — ▍ TÍTULO */}
              <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] pb-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span aria-hidden className="shrink-0 w-[3px] h-5 bg-neon-yellow" />
                  <span
                    className="text-neon-yellow uppercase truncate"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                    }}
                  >
                    {live.homeName ?? club.name}
                  </span>
                </div>
                <span
                  className="shrink-0 text-white/45 uppercase"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '9px',
                    letterSpacing: '0.22em',
                    fontWeight: 600,
                  }}
                >
                  Casa
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {homeRanked.length === 0 && homeSentOffRows.length === 0 ? (
                  // C5 — empty-state da coluna CASA. Acontece quando o
                  // user ainda não tem plantel cadastrado. Evita coluna
                  // 100% vazia ao lado da AWAY cheia.
                  <div className="rounded-md border border-dashed border-white/15 bg-deep-black/40 px-3 py-6 text-center">
                    <p
                      className="text-white/55 mb-1 uppercase"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '10px',
                        fontWeight: 700,
                        letterSpacing: '0.18em',
                      }}
                    >
                      Plantel vazio
                    </p>
                    <p className="text-white/35 text-[11px] leading-snug">
                      Sem titulares pra mostrar nesta partida.
                    </p>
                  </div>
                ) : (
                  <>
                    {homeRanked.map(({ player: p, impact }, idx) => {
                      const entity = playersById[p.playerId];
                      const ovr = entity ? overallFromAttributes(entity.attrs) : undefined;
                      return (
                        <QuickPlayerRowCard
                          key={p.playerId}
                          variant="home-active"
                          rank={idx + 1}
                          num={p.num}
                          name={p.name}
                          pos={p.pos}
                          ovr={ovr}
                          fatigue={p.fatigue}
                          impact={impact}
                          isSelected={selected?.playerId === p.playerId}
                          isTop={idx < 3}
                          badges={<PlayerEventStrip badges={homeEventBadges.get(p.playerId) ?? []} />}
                          photoUrl={entity ? playerPortraitSrc(entity, 80, 96) : undefined}
                          onClick={() => setSelected(p)}
                        />
                      );
                    })}
                    {homeSentOffRows.map((row) => {
                      const ent = playersById[row.playerId];
                      return (
                        <QuickPlayerRowCard
                          key={`sent-off-${row.playerId}`}
                          variant="home-sent-off"
                          num={row.num}
                          name={row.name}
                          pos={row.pos}
                          photoUrl={ent ? playerPortraitSrc(ent, 80, 96) : undefined}
                        />
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            <div
              className="flex flex-col items-center justify-center shrink-0 self-stretch w-5 sm:w-10 md:w-14 py-2 sm:py-6 select-none"
              aria-hidden
            >
              <div className="hidden sm:block w-px flex-1 min-h-6 bg-gradient-to-b from-transparent via-neon-yellow/35 to-transparent" />
              <span className="font-display font-black text-[8px] text-neon-yellow/90 italic tracking-tighter leading-none py-1 flex flex-col items-center sm:hidden">
                <span>V</span>
                <span>S</span>
              </span>
              <span className="hidden sm:inline font-display font-black text-neon-yellow/90 italic tracking-tighter sm:[writing-mode:vertical-rl] sm:rotate-180 sm:text-xl md:text-2xl py-2">
                VS
              </span>
              <div className="hidden sm:block w-px flex-1 min-h-6 bg-gradient-to-b from-neon-yellow/25 via-transparent to-transparent" />
            </div>

            <div className="space-y-3 min-w-0">
              {/* Header da coluna — ▍ TÍTULO */}
              <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] pb-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span aria-hidden className="shrink-0 w-[3px] h-5 bg-white/35" />
                  <span
                    className="text-white/85 uppercase truncate"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                    }}
                  >
                    {live.awayName ?? fixture?.opponent?.name ?? 'Visitante'}
                  </span>
                </div>
                <span
                  className="shrink-0 text-white/45 uppercase text-right"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '9px',
                    letterSpacing: '0.22em',
                    fontWeight: 600,
                  }}
                >
                  Vis. (IA)
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {awayRanked.map((p, idx) => (
                  <QuickPlayerRowCard
                    key={p.id}
                    variant="away"
                    rank={idx + 1}
                    num={p.num}
                    name={p.name}
                    pos={p.pos}
                    impact={p.impact}
                    isTop={idx < 3}
                    badges={<PlayerEventStrip badges={awayEventBadges.get(p.id) ?? []} />}
                  />
                ))}
                {awaySentOffRows.map((row) => (
                  <QuickPlayerRowCard
                    key={`away-sent-off-${row.id}`}
                    variant="home-sent-off"
                    num={row.num}
                    name={row.name}
                    pos={row.pos}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showBoard && selected && live?.phase === 'playing' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sub-quick-title"
          onClick={() => {
            if (!live?.quickInjurySub) setSelected(null);
          }}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-md bg-deep-black overflow-hidden border border-neon-yellow/30 shadow-[0_0_40px_rgba(253,224,71,0.2)]"
            style={{ borderRadius: 'var(--radius-md)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header colorido por tipo */}
            {live?.quickInjurySub ? (() => {
              const injuredEnt = playersById[live.quickInjurySub.outPlayerId];
              const isGrave = (playerHealth?.[live.quickInjurySub.outPlayerId]?.outForMatches ?? injuredEnt?.outForMatches ?? 1) >= 3;
              return (
                <div className={cn('px-5 py-4 flex items-center justify-between gap-3 border-b', isGrave ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30')}>
                  <div className="flex items-center gap-3">
                    <div className={cn('flex h-12 w-12 items-center justify-center rounded-lg border', isGrave ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30')}>
                      <span className={cn('text-2xl font-bold', isGrave ? 'text-red-400' : 'text-amber-400')}>!</span>
                    </div>
                    <div>
                      <p
                        className={cn('uppercase tracking-[0.18em]', isGrave ? 'text-red-400' : 'text-amber-400')}
                        style={{
                          fontFamily: 'var(--font-ui)',
                          fontSize: '10px',
                          fontWeight: 700,
                        }}
                      >
                        {isGrave ? 'Lesão grave' : 'Lesão leve'}
                      </p>
                      <p
                        className={cn('leading-tight uppercase', isGrave ? 'text-white' : 'text-white')}
                        style={{
                          fontFamily: 'var(--font-serif-hero)',
                          fontStyle: 'italic',
                          fontWeight: 700,
                          fontSize: '18px',
                          letterSpacing: '0.01em',
                        }}
                      >
                        {selected.num} {selected.name}
                      </p>
                    </div>
                  </div>
                  <div
                    className={cn('tabular-nums', isGrave ? 'text-red-400' : 'text-amber-400')}
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 900,
                      fontSize: '32px',
                    }}
                  >
                    {injurySubCountdown}s
                  </div>
                </div>
              );
            })() : (
              <div className="bg-neon-yellow/5 px-5 py-4 flex items-center gap-3 border-b border-neon-yellow/20">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-neon-yellow/10 border border-neon-yellow/30">
                  <span className="text-2xl font-bold text-neon-yellow">↔</span>
                </div>
                <div>
                  <p
                    className="text-neon-yellow uppercase tracking-[0.18em]"
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '10px',
                      fontWeight: 700,
                    }}
                  >
                    Substituição
                  </p>
                  <p
                    className="text-white leading-tight uppercase"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontStyle: 'italic',
                      fontWeight: 700,
                      fontSize: '18px',
                      letterSpacing: '0.01em',
                    }}
                  >
                    {selected.num} {selected.name} sai
                  </p>
                </div>
              </div>
            )}

            <div className="p-5 space-y-4">
              {live?.quickInjurySub ? (() => {
                const injuredEnt = playersById[live.quickInjurySub.outPlayerId];
                const isGrave = (playerHealth?.[live.quickInjurySub.outPlayerId]?.outForMatches ?? injuredEnt?.outForMatches ?? 1) >= 3;
                return (
                  <p
                    className="leading-relaxed"
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                      color: isGrave ? '#fca5a5' : '#fcd34d',
                    }}
                  >
                    {isGrave
                      ? `Lesão grave — ${selected.name} não pode continuar. Escolhe o substituto obrigatoriamente.`
                      : `Lesão leve — podes substituir ou arriscar que ${selected.name} continue em campo.`}
                  </p>
                );
              })() : null}

              <div>
                <label
                  className="block text-white/50 uppercase tracking-[0.18em] mb-2"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '10px',
                    fontWeight: 700,
                  }}
                >
                  Entra (banco)
                </label>
                <select
                  value={subPickId}
                  onChange={(e) => setSubPickId(e.target.value)}
                  className="w-full bg-black/60 border border-white/15 px-3 py-2.5 text-white focus:border-neon-yellow focus:outline-none transition-colors"
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <option value="">— Escolher jogador —</option>
                  {benchCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.num} {c.name} · {c.pos} · {c.ovr}
                    </option>
                  ))}
                </select>
              </div>

              {live?.quickInjurySub && benchCards.length === 0 ? (
                <p
                  className="text-red-400"
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                  }}
                >
                  Não há jogadores elegíveis no banco. Termina a partida ou joga com menos.
                </p>
              ) : null}

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  disabled={!subPickId}
                  className="w-full py-3 bg-neon-yellow text-black uppercase tracking-[0.2em] disabled:opacity-40 disabled:pointer-events-none hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-sm)',
                  }}
                  onClick={() => {
                    if (!subPickId) return;
                    dispatch({ type: 'MATCH_SUBSTITUTE', outPlayerId: selected.playerId, inPlayerId: subPickId });
                    setSelected(null);
                  }}
                >
                  Confirmar substituição
                </button>

                {/* Opção "Arriscar" só para lesão leve */}
                {live?.quickInjurySub && (() => {
                  const injuredEnt = playersById[live.quickInjurySub.outPlayerId];
                  const isGrave = (playerHealth?.[live.quickInjurySub.outPlayerId]?.outForMatches ?? injuredEnt?.outForMatches ?? 1) >= 3;
                  if (isGrave) return null;
                  return (
                    <button
                      type="button"
                      className="w-full py-3 bg-black/60 hover:bg-black/80 border border-amber-500/40 text-amber-400 uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: 'var(--radius-sm)',
                      }}
                      onClick={() => {
                        dispatch({ type: 'CANCEL_QUICK_INJURY_SUB' });
                        setSelected(null);
                      }}
                    >
                      Arriscar — continua em campo
                    </button>
                  );
                })()}

                {!live?.quickInjurySub ? (
                  <button
                    type="button"
                    className="w-full py-3 bg-black/60 hover:bg-black/80 border border-white/15 text-white/70 hover:text-white transition-all"
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-sm)',
                    }}
                    onClick={() => setSelected(null)}
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ─── Assistente Técnico ─────────────────────────────────────────── */}
      <AnimatePresence>
        {assistantEvent && !summary && (
          <AssistantPanel
            key={assistantEvent.kind}
            event={assistantEvent}
            onDismiss={() => setAssistantEvent(null)}
            onApplyPreset={(presetId) => {
              // Feedback tático detalhado (Passo 7)
              let feedText = '';
              let feedbackDetail = '';

              if (presetId === 'MORAL_BOOST') {
                feedText = '⚡ Bônus de Moral aplicado! Equipa motivada.';
                feedbackDetail = 'Confiança +10%, Fadiga -5% nos próximos 10 minutos';
                // Aplicar bônus de moral aos jogadores
                dispatch({
                  type: 'ADD_LIVE_MATCH_EVENT',
                  text: feedText,
                  kind: 'narrative',
                } as any);
              } else {
                const presetLabels: Record<string, { name: string; effect: string }> = {
                  PRESSAO_ALTA: { name: 'Pressão Alta', effect: 'Fadiga aumentará 60% mais rápido. +10% chance de gol.' },
                  POSSE_CONTROLADA: { name: 'Posse Controlada', effect: '+15% posse de bola. Desgasta o adversário.' },
                  TRANSICAO_RAPIDA: { name: 'Contra-Ataque', effect: '+30% chance de contra-ataque. +8% chance de gol.' },
                  BLOCO_BAIXO: { name: 'Bloco Baixo', effect: '+25% defesa. -15% chance de gol.' },
                  JOGO_DIRETO: { name: 'Jogo Direto', effect: 'Bolas longas. Disputa de segunda bola.' },
                };

                const preset = presetLabels[presetId] || { name: presetId, effect: 'Ajuste aplicado' };
                feedText = `🎯 ${preset.name} aplicado`;
                feedbackDetail = preset.effect;

                dispatch({ type: 'SET_PLAYING_STYLE_PRESET', presetId: presetId as import('@/tactics/playingStyle').PlayingStylePresetId });

                // Adicionar feedback detalhado no feed (Passo 7)
                setTimeout(() => {
                  dispatch({
                    type: 'ADD_LIVE_MATCH_EVENT',
                    text: `💡 ${feedbackDetail}`,
                    kind: 'narrative',
                  } as any);
                }, 1000);
              }

              setAssistantEvent(null);

              // Mostrar feedback visual temporário (Passo 7)
              setTacticalFeedback(feedbackDetail);
              if (tacticalFeedbackTimerRef.current) clearTimeout(tacticalFeedbackTimerRef.current);
              tacticalFeedbackTimerRef.current = setTimeout(() => {
                setTacticalFeedback(null);
              }, 8000) as unknown as number;
            }}
            onFormationChange={(formation) => {
              dispatch({ type: 'LIVE_MATCH_SET_FORMATION', formation } as any);
            }}
            onConfirmSub={(outPlayerId, inPlayerId) => {
              dispatch({
                type: 'MATCH_SUBSTITUTE',
                outPlayerId,
                inPlayerId,
                slotId: live?.matchLineupBySlot
                  ? Object.entries(live.matchLineupBySlot).find(([, id]) => id === outPlayerId)?.[0] ?? ''
                  : '',
              } as any);
              setAssistantEvent(null);
            }}
            onOpenSubs={() => {
              setAssistantEvent(null);
              const firstPlayer = live?.homePlayers?.[0];
              if (firstPlayer) setSelected(firstPlayer);
            }}
            onStartSecondHalf={() => {
              halftimeForceEndRef.current?.();
              setAssistantEvent(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* (FAB do assistente removido — o painel ainda abre automaticamente
           via assistantEvent quando o motor sugere ação tática.) */}

      {/* ─── Sprint 2: Indicador de Arco Narrativo ─────────────────────── */}
      {live?.narrativeArc && live.phase === 'playing' && !halfTimeUi && !summary && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-10 w-full max-w-md px-4">
          <QuickNarrativeArcIndicator
            arc={live.narrativeArc.arc}
            intensity={live.narrativeArc.intensity}
          />
        </div>
      )}

      {summary && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* ─── HERO PLACAR + MVP — duo editorial ────────────────────────── */}
          <div
            className="overflow-hidden border border-[var(--color-border)] border-l-[3px] border-l-neon-yellow bg-dark-gray"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            {/* Eyebrow */}
            <div className="flex items-center justify-center gap-3 pt-5 pb-2">
              <span aria-hidden className="block h-px w-8 bg-neon-yellow/45" />
              <span
                className="font-display uppercase text-neon-yellow"
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.32em',
                }}
              >
                {summary.result === 'win' ? 'Vitória' : summary.result === 'loss' ? 'Derrota' : 'Empate'} · Fim de jogo
              </span>
              <span aria-hidden className="block h-px w-8 bg-neon-yellow/45" />
            </div>

            {/* Placar editorial — nomes Agency compactos + scores Moret gigantes */}
            <div className="px-4 sm:px-6 py-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
              {/* Home: escudo + nome */}
              <div className="flex items-center gap-2 min-w-0 justify-end">
                {homeCrestUrl ? (
                  <img src={homeCrestUrl} alt="" className="h-7 w-7 sm:h-8 sm:w-8 shrink-0" />
                ) : null}
                <p
                  className="text-white uppercase truncate text-right"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 'clamp(11px, 1.6vw, 14px)',
                    letterSpacing: '0.18em',
                    lineHeight: 1.1,
                  }}
                >
                  {summary.homeName?.trim() || summary.homeShort}
                </p>
              </div>

              {/* Score Moret gigante */}
              <div className="flex items-baseline gap-2 sm:gap-3">
                <span
                  className="italic text-neon-yellow tabular-nums leading-none"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontWeight: 700,
                    fontSize: 'clamp(48px, 9vw, 72px)',
                    letterSpacing: '-0.04em',
                  }}
                >
                  {summary.homeScore}
                </span>
                <span
                  className="text-white/35 leading-none"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontStyle: 'italic',
                    fontWeight: 400,
                    fontSize: 'clamp(28px, 5vw, 40px)',
                  }}
                  aria-hidden
                >
                  –
                </span>
                <span
                  className="italic text-white tabular-nums leading-none"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontWeight: 700,
                    fontSize: 'clamp(48px, 9vw, 72px)',
                    letterSpacing: '-0.04em',
                  }}
                >
                  {summary.awayScore}
                </span>
              </div>

              {/* Away: nome + escudo */}
              <div className="flex items-center gap-2 min-w-0 justify-start">
                <p
                  className="text-white uppercase truncate text-left"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 'clamp(11px, 1.6vw, 14px)',
                    letterSpacing: '0.18em',
                    lineHeight: 1.1,
                  }}
                >
                  {summary.awayName?.trim() || summary.awayShort}
                </p>
                <span
                  className="inline-flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center bg-[#5e1a26] text-white"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: '13px',
                    letterSpacing: '0.05em',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  aria-hidden
                >
                  {(summary.awayName?.trim() || summary.awayShort).charAt(0).toUpperCase()}
                </span>
              </div>
            </div>

            {/* MVP card embutido */}
            {summary.mvp ? (
              <div className="mt-2 grid grid-cols-[110px_1fr] sm:grid-cols-[140px_1fr] gap-0 border-t border-[var(--color-divider-yellow)] bg-deep-black/40">
                {/* Foto */}
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-black">
                  {summary.mvp.portraitUrl ? (
                    <img
                      src={summary.mvp.portraitUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover object-top"
                      referrerPolicy="no-referrer"
                      aria-hidden
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neon-yellow/15 to-transparent">
                      <span
                        className="italic text-neon-yellow/80 leading-none"
                        style={{
                          fontFamily: 'var(--font-serif-hero)',
                          fontWeight: 700,
                          fontSize: 'clamp(48px, 8vw, 64px)',
                        }}
                      >
                        {(summary.mvp.name?.[0] ?? '?').toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/45" />
                  {/* OVR */}
                  {summary.mvp.ovr !== undefined ? (
                    <div className="absolute top-2 left-2 z-10">
                      <p
                        className="italic text-neon-yellow tabular-nums leading-none drop-shadow-[0_3px_8px_rgba(0,0,0,0.95)]"
                        style={{
                          fontFamily: 'var(--font-serif-hero)',
                          fontWeight: 700,
                          fontSize: 'clamp(28px, 4.5vw, 40px)',
                          letterSpacing: '-0.04em',
                        }}
                      >
                        {summary.mvp.ovr}
                      </p>
                    </div>
                  ) : null}
                  {/* Tag MVP */}
                  <div className="absolute top-2 right-2 z-10">
                    <span
                      className="inline-flex items-center bg-neon-yellow text-black px-2 py-0.5 font-display font-black uppercase shadow-[0_0_14px_rgba(253,225,0,0.45)]"
                      style={{
                        fontSize: '9px',
                        letterSpacing: '0.22em',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      MVP
                    </span>
                  </div>
                  {/* POS chip rodapé */}
                  <div className="absolute bottom-2 left-2 z-10">
                    <span
                      className="inline-flex items-center bg-black/75 px-1.5 py-0.5 font-display font-bold uppercase text-white/90"
                      style={{ fontSize: '9px', letterSpacing: '0.22em' }}
                    >
                      {summary.mvp.pos}
                    </span>
                  </div>
                </div>

                {/* Info MVP */}
                <div className="flex flex-col justify-center gap-2 px-4 py-3 sm:px-5 sm:py-4">
                  <span
                    className="font-display uppercase text-white/45"
                    style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.32em' }}
                  >
                    Joia do Plantel
                  </span>
                  <p
                    className="text-white uppercase truncate"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 'clamp(16px, 2.5vw, 22px)',
                      letterSpacing: '0.03em',
                      lineHeight: 1.05,
                    }}
                  >
                    {summary.mvp.num} {summary.mvp.name}
                  </p>
                  {/* Rating Moret gigante */}
                  <p
                    className="italic text-neon-yellow tabular-nums leading-none mt-1"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontWeight: 700,
                      fontSize: 'clamp(28px, 5vw, 40px)',
                      letterSpacing: '-0.03em',
                    }}
                  >
                    {summary.mvp.rating.toFixed(2)}
                    <span
                      className="ml-2 not-italic font-display text-white/45"
                      style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em' }}
                    >
                      RATING
                    </span>
                  </p>
                  {/* Mini-stats do MVP */}
                  {(summary.mvp.goals > 0 || summary.mvp.assists > 0) ? (
                    <div className="flex gap-3 mt-1">
                      {summary.mvp.goals > 0 ? (
                        <span
                          className="inline-flex items-baseline gap-1 text-white/85"
                          style={{ fontFamily: 'var(--font-ui)', fontSize: '11px' }}
                        >
                          <strong className="font-display tabular-nums" style={{ fontSize: '14px', color: 'var(--color-success)' }}>{summary.mvp.goals}</strong>
                          <span className="uppercase tracking-wider" style={{ fontSize: '9px', letterSpacing: '0.22em' }}>Gols</span>
                        </span>
                      ) : null}
                      {summary.mvp.assists > 0 ? (
                        <span
                          className="inline-flex items-baseline gap-1 text-white/85"
                          style={{ fontFamily: 'var(--font-ui)', fontSize: '11px' }}
                        >
                          <strong className="font-display tabular-nums" style={{ fontSize: '14px', color: 'var(--color-neon-yellow)' }}>{summary.mvp.assists}</strong>
                          <span className="uppercase tracking-wider" style={{ fontSize: '9px', letterSpacing: '0.22em' }}>Assist.</span>
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Frase editorial fechando */}
            <div className="px-6 pt-3 pb-5 text-center border-t border-[var(--color-divider-yellow)]">
              <span aria-hidden className="mx-auto mb-3 block w-10 h-[2px] bg-neon-yellow/70" />
              <p
                className="italic text-white/55"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontSize: 'clamp(13px, 1.5vw, 15px)',
                  lineHeight: 1.4,
                }}
              >
                "liga e elenco atualizados."
              </p>
            </div>
          </div>

          {/* ─── Stats agregadas ─────────────────────────────────────────── */}
          {summary.stats ? (
            <div
              className="border border-[var(--color-border)] bg-dark-gray p-4"
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span aria-hidden className="w-[3px] h-5 bg-neon-yellow shrink-0" />
                <h3
                  className="text-neon-yellow uppercase"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.24em',
                  }}
                >
                  Estatísticas
                </h3>
              </div>
              {(() => {
                const s = summary.stats!;
                const cells = [
                  { label: 'Posse', val: `${s.possessionHome}%` },
                  { label: 'Chutes', val: `${s.shotsHome}` },
                  { label: 'Escanteios', val: `${s.cornersHome}` },
                  { label: 'Cartões', val: `${s.yellowsHome + s.redsHome}` },
                ];
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {cells.map((c) => (
                      <div
                        key={c.label}
                        className="flex flex-col gap-1 border border-white/10 bg-deep-black/40 px-3 py-3"
                        style={{ borderRadius: 'var(--radius-sm)' }}
                      >
                        <span
                          className="font-display uppercase text-white/45"
                          style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.24em' }}
                        >
                          {c.label}
                        </span>
                        <span
                          className="italic text-neon-yellow tabular-nums leading-none"
                          style={{
                            fontFamily: 'var(--font-serif-hero)',
                            fontWeight: 700,
                            fontSize: 'clamp(20px, 3.5vw, 28px)',
                            letterSpacing: '-0.02em',
                          }}
                        >
                          {c.val}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : null}

          {/* ─── Scout da partida (régua compartilhada — Fase 1) ─────────── */}
          {summary.scout && (summary.scout.home.length > 0 || summary.scout.away.length > 0) ? (
            <div
              className="border border-[var(--color-border)] bg-dark-gray p-4"
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="w-[3px] h-5 bg-neon-yellow shrink-0" />
                  <h3
                    className="text-neon-yellow uppercase"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.24em',
                    }}
                  >
                    Scout da partida
                  </h3>
                </div>
                {summary.scout.topScorer ? (
                  <span
                    className="uppercase text-white/45"
                    style={{ fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em' }}
                  >
                    Craque: <span className="text-neon-yellow">{summary.scout.topScorer.name}</span>
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { label: summary.homeName ?? summary.homeShort, rows: summary.scout.home.slice(0, 3), homeSide: true },
                  { label: summary.awayName ?? summary.awayShort, rows: summary.scout.away.slice(0, 3), homeSide: false },
                ] as const).map((col) => (
                  <div
                    key={col.label}
                    className="border border-white/10 bg-deep-black/40 px-3 py-3 space-y-2"
                    style={{ borderRadius: 'var(--radius-sm)' }}
                  >
                    <p
                      className={cn('font-display uppercase truncate', col.homeSide ? 'text-neon-yellow/80' : 'text-white/55')}
                      style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.24em' }}
                    >
                      {col.label}
                    </p>
                    {col.rows.length === 0 ? (
                      <p className="text-white/35" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px' }}>
                        Sem destaques pontuados.
                      </p>
                    ) : (
                      col.rows.map((r) => (
                        <div key={r.playerId} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="text-white/85 truncate"
                              style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600 }}
                            >
                              {r.name}
                            </span>
                            <span className="text-white/35 uppercase shrink-0" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>
                              {r.pos}
                            </span>
                            {r.isCaptain ? (
                              <span
                                className="shrink-0 px-1 rounded-sm bg-neon-yellow/15 text-neon-yellow uppercase"
                                style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '0.1em' }}
                                title="Capitão — pontos ×2"
                              >
                                C ×2
                              </span>
                            ) : null}
                            {r.goals > 0 ? (
                              <span className="shrink-0 text-white/60" style={{ fontSize: '10px' }} title={`${r.goals} gol(s)`}>
                                ⚽{r.goals > 1 ? `×${r.goals}` : ''}
                              </span>
                            ) : null}
                          </span>
                          <span
                            className={cn('italic tabular-nums shrink-0', r.points >= 0 ? 'text-neon-yellow' : 'text-red-400')}
                            style={{ fontFamily: 'var(--font-serif-hero)', fontWeight: 700, fontSize: '16px' }}
                          >
                            {r.points.toFixed(1)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* ─── Lances do jogo ──────────────────────────────────────────── */}
          <div
            className="border border-[var(--color-border)] bg-dark-gray p-4 max-h-44 overflow-y-auto"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span aria-hidden className="w-[3px] h-5 bg-neon-yellow shrink-0" />
              <h3
                className="text-neon-yellow uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.24em',
                }}
              >
                Lances do jogo
              </h3>
            </div>
            <div className="space-y-1">
              {summary.events.slice(0, 15).map((e) => (
                <p
                  key={e.id}
                  className="text-white/65"
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '12px',
                    lineHeight: 1.5,
                  }}
                >
                  {e.text}
                </p>
              ))}
            </div>
          </div>

          {/* ─── Sprint 1: Painel de Bônus de Performance ─────────────────── */}
          {live?.performanceBonuses && live.performanceBonuses.length > 0 && (
            <div
              className="border border-[var(--color-border)] bg-dark-gray p-4"
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              <QuickPerformanceBonusPanel
                bonuses={live.performanceBonuses}
                totalOle={calculateTotalBonusRewards(live.performanceBonuses).ole}
                totalExp={calculateTotalBonusRewards(live.performanceBonuses).exp}
              />
            </div>
          )}

          {/* ─── Sprint 3: Desafios Semanais ──────────────────────────────── */}
          {streakChallenges && streakChallenges.challenges.length > 0 && (
            <div
              className="border border-[var(--color-border)] bg-dark-gray p-4"
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              <QuickStreakChallengesPanel
                challenges={streakChallenges.challenges}
                onClaimReward={(challengeId) =>
                  dispatch({ type: 'CLAIM_STREAK_CHALLENGE_REWARD', challengeId })
                }
              />
            </div>
          )}

          {/* CTAs — Legacy Tech */}
          <div className="flex flex-col gap-2 pt-1">
            {summary.result === 'loss' ? (
              <>
                <motion.button
                  type="button"
                  initial={{ scale: 0.96 }}
                  animate={{ scale: 1 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 inline-flex items-center justify-center gap-2 bg-neon-yellow text-black border-l-[3px] border-l-[var(--color-danger)] hover:bg-white transition-all"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '13px',
                    fontWeight: 900,
                    letterSpacing: '0.24em',
                    textTransform: 'uppercase',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: '0 8px 24px rgba(253,225,0,0.20)',
                  }}
                  onClick={() => setSession((s) => s + 1)}
                >
                  <RotateCcw className="w-5 h-5" />
                  Revanche imediata
                </motion.button>
                <p
                  className="text-center italic text-[var(--color-danger)]/85 -mt-1 mb-1"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontSize: '13px',
                  }}
                >
                  "Não desistas. Tenta outra vez."
                </p>
              </>
            ) : (
              <button
                type="button"
                className="w-full py-3.5 inline-flex items-center justify-center gap-2 bg-neon-yellow text-black hover:bg-white active:scale-[0.99] transition-all"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '12px',
                  fontWeight: 900,
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: '0 8px 24px rgba(253,225,0,0.18)',
                }}
                onClick={() => setSession((s) => s + 1)}
              >
                <RotateCcw className="w-4 h-4" />
                Jogar novamente
              </button>
            )}
            <button
              type="button"
              className="w-full py-3 inline-flex items-center justify-center gap-2 border border-[var(--color-border)] bg-deep-black text-white/85 hover:border-neon-yellow/60 hover:text-neon-yellow transition-colors"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                borderRadius: 'var(--radius-sm)',
              }}
              onClick={() => navigate('/leagues')}
            >
              <Trophy className="w-4 h-4" />
              Ir para Liga
            </button>
            <button
              type="button"
              className="w-full py-3 inline-flex items-center justify-center gap-2 border border-[var(--color-border)] bg-deep-black text-white/85 hover:border-neon-yellow/60 hover:text-neon-yellow transition-colors"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                borderRadius: 'var(--radius-sm)',
              }}
              onClick={() => navigate('/')}
            >
              <Home className="w-4 h-4" />
              Home
            </button>
          </div>
        </motion.div>
      )}

      {/* ─── Celebração de Gol ─────────────────────────────────────────── */}
      {/* §3.2: narração cinética em tela cheia (gol da casa) — antes do card */}
      <AnimatePresence>
        {cinematicGoal && (
          <QuickCinematicNarration
            key={cinematicGoal.goalId}
            chain={cinematicGoal.chain}
            accent="home"
            onDone={() => {
              const goalId = cinematicGoal.goalId;
              setCinematicGoal(null);
              // Encadeia o card do artilheiro (mantém freeze curto pra ele tocar).
              freezeUntilRef.current = Date.now() + 2600;
              setGoalCelebrationKey(goalId);
              setGoalCelebrationActive(true);
            }}
          />
        )}
      </AnimatePresence>

      {live && goalCelebrationKey && (
        <QuickGoalCelebration
          triggerKey={goalCelebrationKey}
          scorerName={(() => {
            const lastGoal = live.events?.find((e) => e.kind === 'goal_home' || e.kind === 'goal_away');
            if (lastGoal?.playerId) {
              const player = playersById[lastGoal.playerId];
              return player?.name || 'Jogador';
            }
            return 'Gol!';
          })()}
          scorerPortrait={(() => {
            const lastGoal = live.events?.find((e) => e.kind === 'goal_home' || e.kind === 'goal_away');
            if (lastGoal?.playerId) {
              const player = playersById[lastGoal.playerId];
              return player ? playerPortraitSrc(player, 256, 256) : null;
            }
            return null;
          })()}
          narrative={(() => {
            const lastGoal = live.events?.find((e) => e.kind === 'goal_home' || e.kind === 'goal_away');
            return lastGoal?.text || 'Estufou as redes!';
          })()}
          onDismiss={() => {
            setGoalCelebrationActive(false);
            setGoalCelebrationKey(null);
            // Limpar freeze para garantir que o jogo retome imediatamente
            freezeUntilRef.current = 0;
          }}
        />
      )}

      {/* ─── Penalty Kick Modal ─────────────────────────────────────────── */}
      {live?.penalty?.stage === 'kick' && live?.phase === 'playing' && live?.penalty?.side === 'home' && (
        <PenaltyKickModal
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
          takerPortraitUrl={(() => {
            const takerId = live.penalty.takerId;
            const entity = takerId ? playersById[takerId] : undefined;
            return entity ? playerPortraitSrc(entity, 200, 200) : undefined;
          })()}
          onPickTaker={(playerId, name) => {
            dispatch({ type: 'PENALTY_SET_TAKER', playerId, name } as any);
          }}
          onResolve={(rng) => {
            // 2s com placar visível antes de retomar o jogo
            window.setTimeout(() => {
              dispatch({ type: 'APPLY_SPIRIT_OUTCOME', payload: { kind: 'penalty_resolve', rng } });
            }, 2000);
          }}
        />
      )}

      {/* Sprint L3 — Set-piece interativo (escanteio/falta) */}
      <SetPieceModal />

      {/* §12 pivot: momento interativo agora é INLINE no feed (QuickFeedDecisionCard).
          O takeover full-screen fica reservado ao clímax (gol/vermelho). */}

      {/* ─── Overlays de Substituição e Cartão Vermelho ─────────────────── */}
      <AnimatePresence>
        {substitutionOverlay && (
          <SubstitutionOverlay
            playerOut={substitutionOverlay.playerOut}
            playerIn={substitutionOverlay.playerIn}
            reason={substitutionOverlay.reason}
            onDismiss={() => {
              if (substitutionOverlayTimerRef.current) {
                clearTimeout(substitutionOverlayTimerRef.current);
                substitutionOverlayTimerRef.current = null;
              }
              setSubstitutionOverlay(null);
              freezeUntilRef.current = 0;
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {redCardOverlay && (
          <RedCardOverlay
            player={redCardOverlay.player}
            reason={redCardOverlay.reason}
          />
        )}
      </AnimatePresence>

      {/* ─── Assistente AI ─────────────────────────────────────────────── */}
      {live?.phase === 'playing' && !summary && (
        <AssistantAI
          onSubstitution={handleSubstitution}
          onTacticalChange={handleTacticalChange}
          availablePlayers={pitch.map(p => ({
            id: p.playerId,
            name: p.name,
            position: p.pos,
            fatigue: p.fatigue,
          }))}
          benchPlayers={benchCards.map(c => ({
            id: c.id,
            name: c.name,
            position: c.pos,
          }))}
          halftimeOpenKey={halftimeAssistantKey}
          halftimeScript={halftimeScript}
        />
      )}

      {/* Espaçador de segurança — garante rolagem confortável acima da nav bar */}
      <div className="h-24 shrink-0" aria-hidden />

      {/* Near-Miss System */}
      <NearMissOverlay event={nearMissEvent} onDismiss={clearNearMiss} />
      <NearMissMotivation
        visible={showNearMissMotivation}
        scoreDiff={summary ? summary.awayScore - summary.homeScore : 0}
        onClose={() => setShowNearMissMotivation(false)}
      />

      {/* Recompensas instantâneas pós-partida */}
      {summary && (
        <InstantRewards
          visible={showInstantRewards}
          result={summary.result}
          baseExp={summary.result === 'win' ? 120 : summary.result === 'draw' ? 60 : 30}
          streakMultiplier={quickMatchStreak && quickMatchStreak.current >= 3 ? 1 + quickMatchStreak.current * 0.1 : 1}
          streakCount={quickMatchStreak?.current ?? 0}
          bonuses={live?.performanceBonuses?.map((b) => ({ label: b.name, value: b.exp })) ?? []}
          onClose={() => setShowInstantRewards(false)}
        />
      )}
    </div>
  );
}

/**
 * Barra de transparência: mostra probabilidades agregadas do último tiro.
 * Gol (amarelo) · Defesa (ciano) · Fora (cinza).
 * Visível só por ~3.5s após o shot_attempt; desaparece depois.
 */
function ShotProbabilityBar({
  preview,
}: {
  preview: NonNullable<NonNullable<ReturnType<typeof useGameStore<import('@/engine/types').LiveMatchSnapshot | null>>>['lastShotPreview']>;
}) {
  const { goal, save, out } = preview.probs;
  const pct = (v: number) => Math.round(v * 100);
  const labels: Array<{ k: 'goal' | 'save' | 'out'; v: number; cls: string; txt: string }> = [
    { k: 'goal', v: goal, cls: 'bg-neon-yellow text-black', txt: `${pct(goal)}% GOL` },
    { k: 'save', v: save, cls: 'bg-cyan-500/80 text-black', txt: `${pct(save)}% DEF` },
    { k: 'out',  v: out,  cls: 'bg-white/20 text-white',    txt: `${pct(out)}% FORA` },
  ];
  return (
    <div
      role="status"
      aria-label="Probabilidades do tiro"
      className="flex h-5 w-[min(260px,70vw)] overflow-hidden rounded-md border border-white/10 bg-black/40 font-display text-[9px] font-black uppercase tracking-wider shadow-[0_0_16px_rgba(234,255,0,0.18)]"
    >
      {labels.map((l) => (
        <div
          key={l.k}
          className={cn('flex items-center justify-center truncate px-1 transition-[flex-basis] duration-300', l.cls)}
          style={{ flexBasis: `${l.v * 100}%` }}
          title={l.txt}
        >
          {l.v > 0.08 ? l.txt : ''}
        </div>
      ))}
    </div>
  );
}
