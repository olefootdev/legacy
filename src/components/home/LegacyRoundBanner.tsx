/**
 * Banner adaptativo da Liga LEGACY na Home.
 * - Modo AO VIVO: rodada acontecendo (status='live') → strip de 3 fixtures + minuto pulsando + CTA "Entrar".
 * - Modo PRÓXIMA RODADA: countdown grande + descritor da janela atual (recovery/training/tactical/lock).
 *
 * Mesma slot na Home; alterna sozinho com base em globalLeagueMVP.leagueRounds + clock real.
 */

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Activity, Clock, ChevronRight, Heart, Dumbbell, Target, Lock, Zap } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { GameBannerBackdrop } from '@/components/GameBannerBackdrop';
import { GLOBAL_MATCH_CONSTANTS, type CycleWindowPhase } from '@/match/globalMatch';
import type { LeagueRound } from '@/match/globalLeagueMVP';
import type { GlobalFixture } from '@/match/globalMatch';
import { cn } from '@/lib/utils';

const ROUND_DURATION_MS = GLOBAL_MATCH_CONSTANTS.ROUND_DURATION_MS;

function derivePhase(round: LeagueRound, nowMs: number): CycleWindowPhase {
  const C = GLOBAL_MATCH_CONSTANTS;
  const k = round.scheduledKickoffMs;
  const liveEnd = (round.actualKickoffMs ?? k) + ROUND_DURATION_MS;
  if (round.status === 'finished' || nowMs >= liveEnd) return 'finished';
  if (round.status === 'live' || nowMs >= k) return 'live';
  const lockStart = k - C.LOCK_WINDOW_MS;
  const tacticalStart = lockStart - C.TACTICAL_WINDOW_MS;
  const trainingStart = tacticalStart - C.TRAINING_WINDOW_MS;
  if (nowMs >= lockStart) return 'lock';
  if (nowMs >= tacticalStart) return 'tactical';
  if (nowMs >= trainingStart) return 'training';
  return 'recovery';
}

function nextPhaseStartMs(round: LeagueRound, phase: CycleWindowPhase): number {
  const C = GLOBAL_MATCH_CONSTANTS;
  const k = round.scheduledKickoffMs;
  switch (phase) {
    case 'recovery': return k - C.LOCK_WINDOW_MS - C.TACTICAL_WINDOW_MS - C.TRAINING_WINDOW_MS;
    case 'training': return k - C.LOCK_WINDOW_MS - C.TACTICAL_WINDOW_MS;
    case 'tactical': return k - C.LOCK_WINDOW_MS;
    case 'lock': return k;
    case 'live': return (round.actualKickoffMs ?? k) + ROUND_DURATION_MS;
    default: return k;
  }
}

const PHASE_META: Record<CycleWindowPhase, { label: string; sub: string; Icon: typeof Heart; tone: string; nextLabel: string }> = {
  recovery: {
    label: 'Recuperação', sub: 'Plantel descansando · trate lesões e fadiga',
    Icon: Heart, tone: 'text-emerald-400', nextLabel: 'Treino abre em',
  },
  training: {
    label: 'Treino', sub: 'Janela de evolução · planos coletivos e individuais',
    Icon: Dumbbell, tone: 'text-sky-400', nextLabel: 'Tática abre em',
  },
  tactical: {
    label: 'Tática', sub: 'Ajustes finais · formação, mentalidade, pressão',
    Icon: Target, tone: 'text-amber-400', nextLabel: 'Lock em',
  },
  lock: {
    label: 'Lock', sub: 'Comandos travados · aguarde o apito',
    Icon: Lock, tone: 'text-red-400', nextLabel: 'Kickoff em',
  },
  live: {
    label: 'AO VIVO', sub: '', Icon: Activity, tone: 'text-neon-green', nextLabel: 'Termina em',
  },
  finished: {
    label: 'Encerrada', sub: 'Próxima rodada agendada', Icon: Clock,
    tone: 'text-text-muted', nextLabel: 'Em',
  },
};

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function FixtureChip({ fx, nowMs }: { key?: import("react").Key; fx: GlobalFixture; nowMs: number }) {
  const min = fx.kickoffMs ? Math.min(90, Math.max(0, Math.floor((nowMs - fx.kickoffMs) / GLOBAL_MATCH_CONSTANTS.GAME_MINUTE_MS))) : fx.currentMinute ?? 0;
  return (
    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-deep-black/60 px-3 py-2 min-w-0">
      <div className="flex-1 min-w-0 text-right">
        <p className="font-display text-[11px] font-bold uppercase tracking-wide text-white truncate">{fx.homeTeamName}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="font-serif-hero text-xl font-bold text-neon-yellow">{fx.scoreHome}</span>
        <span className="text-text-muted text-xs">×</span>
        <span className="font-serif-hero text-xl font-bold text-neon-yellow">{fx.scoreAway}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display text-[11px] font-bold uppercase tracking-wide text-white truncate">{fx.awayTeamName}</p>
      </div>
      <div className="shrink-0 flex items-center gap-1 text-[10px] font-display font-bold text-neon-green">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
        {min}'
      </div>
    </div>
  );
}

export function LegacyRoundBanner() {
  const league = useGameStore((s) => s.globalLeagueMVP);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const round = useMemo<LeagueRound | undefined>(() => {
    if (!league) return undefined;
    const rounds: LeagueRound[] = league.status === 'playoffs'
      ? (league.playoffRounds as unknown as LeagueRound[])
      : league.leagueRounds;
    if (rounds.length === 0) return undefined;
    const nowMs = now;
    const live = rounds.find((r) => {
      const k = r.actualKickoffMs ?? r.scheduledKickoffMs;
      return r.status === 'live' && nowMs < k + ROUND_DURATION_MS;
    });
    if (live) return live;
    const upcoming = rounds
      .filter((r) => r.status !== 'finished' && r.scheduledKickoffMs > nowMs - ROUND_DURATION_MS)
      .sort((a, b) => a.scheduledKickoffMs - b.scheduledKickoffMs)[0];
    if (upcoming) return upcoming;
    return rounds[rounds.length - 1];
  }, [league, now]);

  const phaseLabel = league?.status === 'playoffs' ? 'Playoffs' : 'Liga';

  if (!league) return null;

  // Quando não há rodadas ainda (waiting_teams / início de season), mostra banner de espera
  if (!round) {
    const isWaiting = league.status === 'waiting_teams';
    const teamCount = league.teams?.length ?? 0;
    return (
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden border border-neon-yellow/30 sports-panel"
        style={{ borderRadius: 'var(--radius-sm, 6px)' }}
      >
        <GameBannerBackdrop slot="leagues_header" imageOpacity={0.18} />
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/55 to-black/85" aria-hidden />
        <div className="relative z-10 p-5">
          <div className="flex items-center gap-2 text-amber-400">
            <Clock className="h-4 w-4 shrink-0" />
            <span className="font-display text-[10px] font-black uppercase tracking-[0.25em]">
              Liga LEGACY · {isWaiting ? 'Aguardando times' : 'Preparando rodadas'}
            </span>
          </div>
          <h2 className="ole-headline-italic mt-2 text-white" style={{ fontSize: 'clamp(20px, 5vw, 30px)' }}>
            {isWaiting ? 'Nova temporada a caminho' : 'Gerando rodadas…'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            {isWaiting
              ? `${teamCount} time${teamCount !== 1 ? 's' : ''} cadastrado${teamCount !== 1 ? 's' : ''} · playoffs iniciam automaticamente`
              : 'A liga está processando a próxima fase. Recarregue em alguns instantes.'}
          </p>
          <Link
            to="/leagues"
            className="mt-4 inline-flex items-center gap-2 border border-neon-yellow/40 px-4 py-2 font-display text-[11px] font-black uppercase tracking-[0.2em] text-neon-yellow hover:bg-neon-yellow hover:text-black transition-colors"
          >
            Ver Liga
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </motion.section>
    );
  }

  const phase = derivePhase(round, now);
  const meta = PHASE_META[phase];
  const isLive = phase === 'live';
  const nextStart = nextPhaseStartMs(round, phase);
  const remainMs = nextStart - now;

  const featuredFixtures = round.fixtures.slice(0, 3);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden border border-neon-yellow/30 sports-panel"
      style={{ borderRadius: 'var(--radius-sm, 6px)' }}
    >
      <GameBannerBackdrop slot="leagues_header" imageOpacity={isLive ? 0.32 : 0.22} />
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/55 to-black/85" aria-hidden />

      <div className="relative z-10 p-5">
        {/* Eyebrow */}
        <div className={cn('flex items-center gap-2', meta.tone)}>
          <meta.Icon className={cn('h-4 w-4 shrink-0', isLive && 'animate-pulse')} />
          <span className="font-display text-[10px] font-black uppercase tracking-[0.25em]">
            Liga LEGACY · {phaseLabel} R{round.roundNumber} · {meta.label}
          </span>
        </div>

        {isLive ? (
          <>
            <h2 className="ole-headline-italic mt-2 text-white" style={{ fontSize: 'clamp(24px, 6vw, 36px)' }}>
              Rodada AO VIVO
            </h2>
            <p className="mt-1 text-xs text-white/60 font-display tracking-wide">
              Termina em <span className="text-neon-yellow font-bold">{fmtCountdown(remainMs)}</span> · {round.fixtures.length} jogos
            </p>

            <div className="mt-4 space-y-2">
              {featuredFixtures.map((fx) => (
                <FixtureChip key={fx.id} fx={fx} nowMs={now} />
              ))}
            </div>

            <Link
              to="/match/global"
              className="mt-4 inline-flex items-center gap-2 bg-neon-yellow text-black px-4 py-2 font-display text-[11px] font-black uppercase tracking-[0.2em] -skew-x-6 hover:bg-white transition-colors"
            >
              <Zap className="h-3 w-3" />
              Entrar no painel
              <ChevronRight className="h-3 w-3" />
            </Link>
          </>
        ) : (
          <>
            <div className="mt-2 flex items-baseline gap-3 flex-wrap">
              <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                {meta.nextLabel}
              </span>
              <span className="font-serif-hero text-5xl font-bold text-neon-yellow leading-none tabular-nums">
                {fmtCountdown(remainMs)}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              {meta.sub}
            </p>

            {/* Mini timeline das janelas */}
            <div className="mt-4 flex items-center gap-1">
              {(['recovery', 'training', 'tactical', 'lock'] as CycleWindowPhase[]).map((p) => (
                <div
                  key={p}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-colors',
                    p === phase ? 'bg-neon-yellow' : isPhasePassed(phase, p) ? 'bg-white/40' : 'bg-white/10',
                  )}
                />
              ))}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[9px] font-display font-bold uppercase tracking-wide">
              {(['recovery', 'training', 'tactical', 'lock'] as CycleWindowPhase[]).map((p) => (
                <span
                  key={p}
                  className={cn('flex-1 text-center', p === phase ? 'text-neon-yellow' : 'text-white/35')}
                >
                  {p === 'recovery' ? 'Rec' : p === 'training' ? 'Treino' : p === 'tactical' ? 'Tática' : 'Lock'}
                </span>
              ))}
            </div>

            <Link
              to="/match/global"
              className="mt-4 inline-flex items-center gap-2 border border-neon-yellow/40 px-4 py-2 font-display text-[11px] font-black uppercase tracking-[0.2em] text-neon-yellow hover:bg-neon-yellow hover:text-black transition-colors"
            >
              Painel da rodada
              <ChevronRight className="h-3 w-3" />
            </Link>
          </>
        )}
      </div>
    </motion.section>
  );
}

const PHASE_ORDER: CycleWindowPhase[] = ['recovery', 'training', 'tactical', 'lock', 'live', 'finished'];
function isPhasePassed(current: CycleWindowPhase, target: CycleWindowPhase): boolean {
  return PHASE_ORDER.indexOf(current) > PHASE_ORDER.indexOf(target);
}
