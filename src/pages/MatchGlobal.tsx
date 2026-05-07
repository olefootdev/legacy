/**
 * Match Global — Painel Mundial de Rodadas Simultâneas
 *
 * Design inspirado no BVB (Borussia Dortmund) com identidade Olefoot
 * Adaptado para Global League MVP com 3 divisões
 */

import { useState, useMemo, useEffect } from 'react';
import { useGameStore } from '@/game/store';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Activity, Clock, ArrowUp, ArrowDown } from 'lucide-react';
import type { GlobalFixture } from '@/match/globalMatch';
import { GLOBAL_MATCH_CONSTANTS } from '@/match/globalMatch';
import type { GlobalTeam, PlayoffRound } from '@/match/globalLeagueMVP';
import { SCHEDULER_CONFIG } from '@/match/globalRoundScheduler';

type FilterMode = 'all' | 'division_1' | 'division_2' | 'division_3';

// ─── Slot helpers (cliente — espelho da Edge Function) ──────────────────────
function nextSlotKickoffMs(nowMs: number, slots: string[], slotDurationMin: number): number | null {
  if (!slots || slots.length === 0) return null;
  const durationMs = slotDurationMin * 60_000;
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const day = new Date(nowMs);
    day.setUTCDate(day.getUTCDate() + dayOffset);
    day.setUTCHours(0, 0, 0, 0);
    const sortedSlots = [...slots].sort();
    for (const slot of sortedSlots) {
      const [h, m] = slot.split(':').map(Number);
      const slotStart = new Date(day);
      slotStart.setUTCHours(h, m, 0, 0);
      const start = slotStart.getTime();
      const end = start + durationMs;
      if (nowMs >= end) continue;
      return Math.max(nowMs, start);
    }
  }
  return null;
}

function isInSlot(nowMs: number, slots: string[], slotDurationMin: number): { active: boolean; slotName: string | null; endMs: number | null } {
  const durationMs = slotDurationMin * 60_000;
  for (const slot of slots ?? []) {
    const [h, m] = slot.split(':').map(Number);
    const day = new Date(nowMs);
    day.setUTCHours(h, m, 0, 0);
    const start = day.getTime();
    const end = start + durationMs;
    if (nowMs >= start && nowMs < end) {
      return { active: true, slotName: slot, endMs: end };
    }
  }
  return { active: false, slotName: null, endMs: null };
}

function formatCountdown(ms: number): string {
  if (ms < 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function NextSlotBanner({ slots, slotDurationMin, currentDay, competitionStartedAt, competitionDurationDays }: {
  slots?: string[];
  slotDurationMin?: number;
  currentDay?: string;
  competitionStartedAt?: number;
  competitionDurationDays?: number;
}) {
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const slotsArr = slots ?? ['05:30', '11:00', '15:00', '19:00', '21:30'];
  const duration = slotDurationMin ?? 30;
  const inSlot = isInSlot(tick, slotsArr, duration);
  const nextMs = nextSlotKickoffMs(tick, slotsArr, duration);
  const today = currentDay ?? new Date(tick).toISOString().slice(0, 10);

  // Competition window
  const compEndsMs = competitionStartedAt && competitionDurationDays
    ? competitionStartedAt + competitionDurationDays * 86_400_000
    : null;
  const compMsLeft = compEndsMs ? compEndsMs - tick : null;
  const compDaysLeft = compMsLeft != null ? Math.max(0, Math.ceil(compMsLeft / 86_400_000)) : null;

  return (
    <div className="bg-deep-black border border-white/10 rounded-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col">
          <span className="text-[10px] font-display uppercase tracking-wider text-white/40">Dia OleFoot</span>
          <span className="font-mono text-sm text-white/80">{today} UTC</span>
        </div>
        <span className="w-px h-8 bg-white/10" />
        <div className="flex flex-col">
          <span className="text-[10px] font-display uppercase tracking-wider text-white/40">
            {inSlot.active ? 'Slot ao vivo' : 'Próximo slot'}
          </span>
          {inSlot.active ? (
            <span className="font-mono text-sm font-bold text-neon-green">
              {inSlot.slotName} — termina em {formatCountdown((inSlot.endMs ?? tick) - tick)}
            </span>
          ) : nextMs ? (
            <span className="font-mono text-sm font-bold text-neon-yellow">
              {new Date(nextMs).toISOString().slice(11, 16)} UTC — em {formatCountdown(nextMs - tick)}
            </span>
          ) : (
            <span className="font-mono text-sm text-white/50">—</span>
          )}
        </div>
        {compDaysLeft != null && (
          <>
            <span className="w-px h-8 bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[10px] font-display uppercase tracking-wider text-white/40">Competição termina em</span>
              <span className="font-mono text-sm font-bold text-neon-yellow">
                {compDaysLeft}d {compMsLeft != null ? formatCountdown(compMsLeft % 86_400_000) : ''}
              </span>
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-[9px] text-white/50 font-mono uppercase tracking-wider">
        <span>SLOTS:</span>
        {slotsArr.map((s, i) => {
          const [h, m] = s.split(':').map(Number);
          const day = new Date(tick);
          day.setUTCHours(h, m, 0, 0);
          const isPast = tick >= day.getTime() + duration * 60_000;
          const isCurrent = inSlot.slotName === s;
          return (
            <span
              key={i}
              className={`px-1.5 py-0.5 rounded ${
                isCurrent ? 'bg-neon-green/20 text-neon-green border border-neon-green/40' :
                isPast ? 'bg-white/5 text-white/30' :
                'bg-neon-yellow/10 text-neon-yellow/80 border border-neon-yellow/30'
              }`}
            >
              {s}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Mock helpers removidos. Server (Railway) agora gera playoffs/rodadas
// automaticamente quando teams >= min_teams_required no banco.
// A tela é uma vitrine read-only do estado real, hidratado via Realtime.

function FixtureCard({ fixture, index }: { key?: import("react").Key; fixture: GlobalFixture; index: number }) {
  const lastEvent = fixture.events[fixture.events.length - 1];
  const hasGoal = fixture.scoreHome > 0 || fixture.scoreAway > 0;
  const isLive = fixture.currentMinute > 0 && fixture.currentMinute < 90;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`sports-panel rounded-lg p-4 transition-all group min-w-0 ${
        isLive
          ? 'border border-neon-green/40 shadow-[0_0_12px_rgba(0,255,128,0.08)]'
          : 'hover:border-neon-yellow/30'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 min-w-0">
        <span className="text-xs text-text-soft uppercase tracking-wider font-display truncate">
          Divisão {fixture.division}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <Clock className={`w-3 h-3 ${isLive ? 'text-neon-green' : 'text-white/40'}`} />
          <span className={`font-serif-hero font-bold text-lg ${isLive ? 'text-neon-green' : 'text-white/60'}`}>
            {fixture.currentMinute}'
          </span>
          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />}
        </div>
      </div>

      {/* Placar */}
      <div className="flex items-center justify-between gap-2 mb-3 min-w-0">
        {/* Time Casa */}
        <div className="flex-1 text-left min-w-0">
          <p className="font-serif-hero text-base sm:text-xl font-bold text-white truncate group-hover:text-neon-yellow transition-colors uppercase">
            {fixture.homeTeamName}
          </p>
          <p className="text-xs sm:text-sm text-text-soft mt-1">
            OVR <span className="text-neon-yellow font-serif-hero font-bold text-base sm:text-xl">{fixture.homeOverall}</span>
          </p>
        </div>

        {/* Placar Central */}
        <div className="flex items-center gap-2 px-3 py-2 bg-deep-black rounded-md border border-white/5 shrink-0">
          <motion.span
            key={`home-${fixture.scoreHome}`}
            initial={{ scale: hasGoal ? 1.5 : 1 }}
            animate={{ scale: 1 }}
            className="font-serif-hero text-3xl sm:text-5xl font-bold text-neon-yellow"
          >
            {fixture.scoreHome}
          </motion.span>
          <span className="text-text-muted text-lg sm:text-2xl">×</span>
          <motion.span
            key={`away-${fixture.scoreAway}`}
            initial={{ scale: hasGoal ? 1.5 : 1 }}
            animate={{ scale: 1 }}
            className="font-serif-hero text-3xl sm:text-5xl font-bold text-neon-yellow"
          >
            {fixture.scoreAway}
          </motion.span>
        </div>

        {/* Time Visitante */}
        <div className="flex-1 text-right min-w-0">
          <p className="font-serif-hero text-base sm:text-xl font-bold text-white truncate group-hover:text-neon-yellow transition-colors uppercase">
            {fixture.awayTeamName}
          </p>
          <p className="text-xs sm:text-sm text-text-soft mt-1">
            OVR <span className="text-neon-yellow font-serif-hero font-bold text-base sm:text-xl">{fixture.awayOverall}</span>
          </p>
        </div>
      </div>

      {/* Último Evento */}
      <AnimatePresence mode="wait">
        {lastEvent && (
          <motion.div
            key={lastEvent.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="bg-deep-black rounded px-3 py-2 border-l-2 border-l-neon-green"
          >
            <p className="text-xs text-gray-300">
              <span className="font-serif-hero font-bold text-neon-yellow text-sm">
                {lastEvent.minute}'
              </span>{' '}
              {lastEvent.text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DivisionStandings({ division, teams }: { division: number; teams: GlobalTeam[] }) {
  const promotionCount = Math.ceil(teams.length * 0.1);
  const relegationCount = Math.ceil(teams.length * 0.1);

  const divisionColor = division === 1 ? 'neon-yellow' : division === 2 ? 'blue-400' : 'white/60';
  const divisionName = division === 1 ? 'Elite' : division === 2 ? 'Intermediária' : 'Acesso';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sports-panel rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="bg-deep-black px-6 py-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className={`w-5 h-5 text-${divisionColor}`} />
            <div>
              <h3 className="font-display text-base font-bold uppercase tracking-wider text-white">
                Divisão {division}
              </h3>
              <p className="text-xs text-white/60 mt-0.5">{divisionName}</p>
            </div>
          </div>
          <span className={`font-serif-hero text-2xl font-bold text-${divisionColor}`}>
            {teams.length}
          </span>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto -mx-0">
        <table className="w-full min-w-[340px]">
          <thead className="bg-black/20">
            <tr className="text-left">
              <th className="px-2 sm:px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60">#</th>
              <th className="px-2 sm:px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60">Time</th>
              <th className="px-1 sm:px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">J</th>
              <th className="px-1 sm:px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">V</th>
              <th className="px-1 sm:px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">E</th>
              <th className="px-1 sm:px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">D</th>
              <th className="px-1 sm:px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">SG</th>
              <th className="px-2 sm:px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">
                PTS
              </th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, index) => {
              const isPromotion = division > 1 && index < promotionCount;
              const isRelegation = division < 3 && index >= teams.length - relegationCount;
              const isLeader = index === 0;

              let bgClass = '';
              let borderClass = '';
              if (isLeader) {
                bgClass = 'bg-neon-yellow/10';
                borderClass = 'border-l-4 border-l-neon-yellow';
              } else if (isPromotion) {
                bgClass = 'bg-emerald-500/10';
                borderClass = 'border-l-4 border-l-emerald-500';
              } else if (isRelegation) {
                bgClass = 'bg-red-500/10';
                borderClass = 'border-l-4 border-l-red-500';
              }

              const positionChange = team.previousPosition
                ? team.previousPosition - (team.position || 0)
                : 0;

              return (
                <tr
                  key={team.id}
                  className={`border-t border-white/5 hover:bg-white/5 transition-colors ${bgClass} ${borderClass}`}
                >
                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs sm:text-sm text-white/60">{team.position}</span>
                      {positionChange > 0 && (
                        <ArrowUp className="w-3 h-3 text-emerald-400" strokeWidth={3} />
                      )}
                      {positionChange < 0 && (
                        <ArrowDown className="w-3 h-3 text-red-400" strokeWidth={3} />
                      )}
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 max-w-[100px] sm:max-w-none">
                    <div>
                      <p className="font-display text-xs sm:text-sm font-bold text-white truncate">{team.clubName}</p>
                      <p className="text-[10px] text-white/40">{team.clubShort}</p>
                    </div>
                  </td>
                  <td className="px-1 sm:px-4 py-2 sm:py-3 text-center">
                    <span className="font-mono text-xs sm:text-sm text-white/80">{team.matchesPlayed}</span>
                  </td>
                  <td className="px-1 sm:px-4 py-2 sm:py-3 text-center">
                    <span className="font-mono text-xs sm:text-sm text-emerald-400">{team.wins}</span>
                  </td>
                  <td className="px-1 sm:px-4 py-2 sm:py-3 text-center">
                    <span className="font-mono text-xs sm:text-sm text-amber-400">{team.draws}</span>
                  </td>
                  <td className="px-1 sm:px-4 py-2 sm:py-3 text-center">
                    <span className="font-mono text-xs sm:text-sm text-red-400">{team.losses}</span>
                  </td>
                  <td className="px-1 sm:px-4 py-2 sm:py-3 text-center">
                    <span className={`font-mono text-xs sm:text-sm ${
                      team.goalDifference > 0 ? 'text-emerald-400' :
                      team.goalDifference < 0 ? 'text-red-400' : 'text-white/60'
                    }`}>
                      {team.goalDifference > 0 ? '+' : ''}{team.goalDifference}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                    <div className="flex flex-col items-center leading-tight">
                      <span
                        className="font-serif-hero text-base sm:text-lg font-bold text-neon-yellow"
                        title={`Total acumulado em ${team.allTimeSeasonsPlayed ?? 0} temporada(s)`}
                      >
                        {team.allTimePoints ?? 0}
                      </span>
                      <span className="font-mono text-[9px] text-white/40 mt-0.5">
                        {team.points} (rodada)
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div className="bg-black/20 px-6 py-4 border-t border-white/10">
        <div className="flex flex-wrap gap-4 text-xs">
          {division === 1 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-neon-yellow rounded-sm" />
              <span className="text-white/60">Líder</span>
            </div>
          )}
          {division > 1 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
              <span className="text-white/60">Zona de Promoção (Top 10%)</span>
            </div>
          )}
          {division < 3 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-sm" />
              <span className="text-white/60">Zona de Rebaixamento (Bottom 10%)</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function PlayoffRoundStatusBar({ round, totalRounds }: { round: PlayoffRound | undefined; totalRounds: number }) {
  const [countdown, setCountdown] = useState('--:--');

  useEffect(() => {
    const tick = () => {
      const nowMs = Date.now();
      if (!round) { setCountdown('--:--'); return; }

      if (round.status === 'scheduled') {
        const diff = Math.max(0, round.scheduledKickoffMs - nowMs);
        setCountdown(formatMs(diff));
        return;
      }
      if (round.status === 'live' && round.actualKickoffMs) {
        const elapsed = nowMs - round.actualKickoffMs;
        const remaining = Math.max(0, GLOBAL_MATCH_CONSTANTS.ROUND_DURATION_MS - elapsed);
        setCountdown(formatMs(remaining));
        return;
      }
      if (round.status === 'finished' && round.finishedAtMs) {
        const nextIn = Math.max(0, round.finishedAtMs + SCHEDULER_CONFIG.ROUND_INTERVAL_MS - nowMs);
        setCountdown(formatMs(nextIn));
        return;
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [round]);

  if (!round) return null;

  const isLive = round.status === 'live';
  const isFinished = round.status === 'finished';
  const isScheduled = round.status === 'scheduled';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="sports-panel rounded-lg p-4 border border-white/10"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {isLive && <Activity className="w-5 h-5 text-neon-green animate-pulse shrink-0" />}
          {isFinished && <Trophy className="w-5 h-5 text-neon-yellow shrink-0" />}
          {isScheduled && <Clock className="w-5 h-5 text-white/40 shrink-0" />}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-display">
              {isLive ? 'Ao Vivo' : isFinished ? 'Próxima rodada em' : 'Kickoff em'}
            </p>
            <p className={`font-serif-hero text-2xl font-bold ${isLive ? 'text-neon-green' : isFinished ? 'text-neon-yellow' : 'text-white'}`}>
              {isLive ? `${round.fixtures[0]?.currentMinute ?? 0}'` : countdown}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-display">Rodada</p>
          <p className="font-serif-hero text-2xl font-bold text-white">{round.roundNumber}<span className="text-white/30 text-sm">/{totalRounds}</span></p>
        </div>
      </div>

      {/* Progresso das rodadas — linha separada para não comprimir em mobile */}
      <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-0.5">
        {Array.from({ length: totalRounds }, (_, i) => {
          const r = i + 1;
          const isCurrent = r === round.roundNumber;
          const isDone = r < round.roundNumber;
          return (
            <div
              key={r}
              className={`h-1.5 rounded-full transition-all shrink-0 ${
                isDone ? 'w-4 bg-neon-yellow' :
                isCurrent ? 'w-6 bg-neon-green' :
                'w-4 bg-white/20'
              }`}
            />
          );
        })}
      </div>
    </motion.div>
  );
}

/** Mini-tabela compacta de uma divisão projetada (estilo Elifoot). */
function ProjectedDivisionMini({
  division,
  teams,
  totalDivisions,
}: {
  division: number;
  teams: GlobalTeam[];
  totalDivisions: number;
}) {
  const accent = division === 1 ? 'text-neon-yellow' : division === 2 ? 'text-blue-400' : 'text-white/70';
  const accentBg = division === 1 ? 'bg-neon-yellow' : division === 2 ? 'bg-blue-400' : 'bg-white/40';
  const label = division === 1 ? 'Elite' : division === 2 ? 'Intermediária' : 'Acesso';
  const promoCount = Math.max(1, Math.ceil(teams.length * 0.1));
  const releCount = Math.max(1, Math.ceil(teams.length * 0.1));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="sports-panel rounded-lg overflow-hidden"
    >
      <div className="bg-deep-black px-3 py-2 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-1.5 h-4 ${accentBg}`} />
          <h3 className="font-display text-[11px] font-bold uppercase tracking-wider text-white">
            {division}ª Divisão
          </h3>
          <span className="text-[10px] text-white/40">· {label}</span>
        </div>
        <span className={`font-serif-hero text-base font-bold ${accent}`}>{teams.length}</span>
      </div>

      <table className="w-full text-[11px]">
        <thead className="bg-black/30">
          <tr className="text-left text-white/40">
            <th className="px-2 py-1.5 font-display font-bold uppercase tracking-wider w-6">#</th>
            <th className="px-2 py-1.5 font-display font-bold uppercase tracking-wider">Time</th>
            <th className="px-1 py-1.5 font-display font-bold uppercase tracking-wider text-center">J</th>
            <th className="px-1 py-1.5 font-display font-bold uppercase tracking-wider text-center">V</th>
            <th className="px-1 py-1.5 font-display font-bold uppercase tracking-wider text-center">E</th>
            <th className="px-1 py-1.5 font-display font-bold uppercase tracking-wider text-center">D</th>
            <th className="px-1 py-1.5 font-display font-bold uppercase tracking-wider text-center">SG</th>
            <th className="px-2 py-1.5 font-display font-bold uppercase tracking-wider text-center">PTS</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, index) => {
            const sg = team.playoffGoalsFor - team.playoffGoalsAgainst;
            const isLeader = index === 0;
            const isPromotion = division > 1 && index < promoCount;
            const isRelegation = division < totalDivisions && index >= teams.length - releCount;
            let rowBg = '';
            let rowBorder = '';
            if (isLeader) { rowBg = 'bg-neon-yellow/10'; rowBorder = 'border-l-2 border-l-neon-yellow'; }
            else if (isPromotion) { rowBg = 'bg-emerald-500/10'; rowBorder = 'border-l-2 border-l-emerald-500'; }
            else if (isRelegation) { rowBg = 'bg-red-500/10'; rowBorder = 'border-l-2 border-l-red-500'; }
            return (
              <tr key={team.id} className={`border-t border-white/5 ${rowBg} ${rowBorder}`}>
                <td className="px-2 py-1.5"><span className="font-mono text-white/60">{index + 1}</span></td>
                <td className="px-2 py-1.5 truncate">
                  <span className="font-display font-bold text-white truncate">{team.clubName}</span>
                  <span className="text-[10px] text-white/40 ml-1.5">{team.clubShort}</span>
                </td>
                <td className="px-1 py-1.5 text-center font-mono text-white/80">{team.playoffMatchesPlayed}</td>
                <td className="px-1 py-1.5 text-center font-mono text-emerald-400">{team.playoffWins}</td>
                <td className="px-1 py-1.5 text-center font-mono text-amber-400">{team.playoffDraws}</td>
                <td className="px-1 py-1.5 text-center font-mono text-red-400">{team.playoffLosses}</td>
                <td className="px-1 py-1.5 text-center">
                  <span className={`font-mono ${sg > 0 ? 'text-emerald-400' : sg < 0 ? 'text-red-400' : 'text-white/60'}`}>
                    {sg > 0 ? '+' : ''}{sg}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <div className="flex flex-col items-center leading-tight">
                    <span
                      className="font-serif-hero text-base font-bold text-neon-yellow"
                      title={`Total acumulado em ${team.allTimeSeasonsPlayed ?? 0} temporada(s)`}
                    >
                      {team.allTimePoints ?? 0}
                    </span>
                    <span className="font-mono text-[8px] text-white/40">
                      {team.playoffPoints} (rodada)
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </motion.div>
  );
}

/**
 * Grid de divisões projetadas durante os playoffs (estilo Elifoot).
 * Distribui os times em N divisões (default 3) baseado na pontuação atual,
 * dando um "preview" de onde cada um terminaria se os playoffs acabassem agora.
 */
function ProjectedDivisionsGrid({
  teams,
  roundNumber,
  totalDivisions = 3,
}: {
  teams: GlobalTeam[];
  roundNumber: number;
  totalDivisions?: number;
}) {
  const sorted = [...teams].sort((a, b) => {
    if (b.playoffPoints !== a.playoffPoints) return b.playoffPoints - a.playoffPoints;
    const sgA = a.playoffGoalsFor - a.playoffGoalsAgainst;
    const sgB = b.playoffGoalsFor - b.playoffGoalsAgainst;
    if (sgB !== sgA) return sgB - sgA;
    return b.playoffGoalsFor - a.playoffGoalsFor;
  });

  const teamsPerDivision = Math.ceil(teams.length / totalDivisions);
  const divisions: GlobalTeam[][] = Array.from({ length: totalDivisions }, (_, divIdx) =>
    sorted.slice(divIdx * teamsPerDivision, Math.min((divIdx + 1) * teamsPerDivision, teams.length))
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Trophy className="w-5 h-5 text-neon-yellow" />
        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">
            Classificação · Após rodada {roundNumber}
          </h2>
          <p className="text-[11px] text-white/40 mt-0.5">
            Projeção de divisões caso os playoffs terminassem agora · Top 10% sobe · Bottom 10% desce
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {divisions.map((divTeams, idx) => (
          <ProjectedDivisionMini
            key={idx}
            division={idx + 1}
            teams={divTeams}
            totalDivisions={totalDivisions}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-[10px] text-white/50 px-1">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-neon-yellow rounded-sm" />Líder</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />Promoção projetada</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-500 rounded-sm" />Rebaixamento projetado</span>
      </div>
    </div>
  );
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export default function MatchGlobal() {
  const navigate = useNavigate();
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  // Hooks devem ser chamados na mesma ordem em todo render — sem returns antes deles.
  const currentLeagueRound = globalLeagueMVP?.status === 'active'
    ? globalLeagueMVP.leagueRounds.find(r => r.roundNumber === globalLeagueMVP.currentLeagueRound)
    : undefined;
  const filteredFixtures = useMemo(() => {
    if (!currentLeagueRound) return [];
    if (filterMode === 'all') return currentLeagueRound.fixtures;
    const divisionNumber = filterMode.split('_')[1];
    return currentLeagueRound.fixtures.filter(f => f.division === divisionNumber);
  }, [currentLeagueRound, filterMode]);

  // Verificar status da liga
  if (!globalLeagueMVP || globalLeagueMVP.status === 'waiting_teams') {
    const teamsNow = globalLeagueMVP?.teams.length ?? 0;
    const minTeams = globalLeagueMVP?.minTeamsRequired ?? 2;
    const ready = teamsNow >= minTeams;

    return (
      <div className="mx-auto min-w-0 w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-16 text-center overflow-x-hidden">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5">
            <Activity className="w-3 h-3 text-neon-green animate-pulse" />
            <span className="font-display text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">
              {ready ? 'Próxima rodada em instantes' : 'Aguardando managers'}
            </span>
          </div>

          <h1 className="font-display text-5xl sm:text-6xl font-bold uppercase text-white">
            Liga Global
          </h1>

          <p className="font-serif-hero text-lg sm:text-xl italic text-white/70 max-w-xl mx-auto">
            {ready
              ? 'A primeira rodada vai começar automaticamente no próximo topo de 5 minutos do relógio.'
              : `Faltam ${Math.max(0, minTeams - teamsNow)} ${minTeams - teamsNow === 1 ? 'manager' : 'managers'} para destravar os playoffs.`}
          </p>

          <div className="flex items-center justify-center gap-8 pt-4">
            <div>
              <p className="font-serif-hero text-4xl font-bold text-neon-yellow">{teamsNow}</p>
              <p className="text-[10px] font-display font-bold uppercase tracking-wider text-white/40 mt-1">Inscritos</p>
            </div>
            <div className="h-12 w-px bg-white/10" />
            <div>
              <p className="font-serif-hero text-4xl font-bold text-white">{minTeams}</p>
              <p className="text-[10px] font-display font-bold uppercase tracking-wider text-white/40 mt-1">Mínimo</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/liga-global/registro')}
            className="mt-4 inline-flex items-center gap-2 bg-neon-yellow text-black px-6 py-3 font-display text-xs font-black uppercase tracking-[0.2em] -skew-x-6 hover:bg-white transition-colors"
          >
            <span className="skew-x-6">Ver registro completo</span>
          </button>
        </motion.div>
      </div>
    );
  }

  if (globalLeagueMVP.status === 'playoffs') {
    const roundNumber = globalLeagueMVP.currentPlayoffRound ?? 1;
    const round = globalLeagueMVP.playoffRounds.find(r => r.roundNumber === roundNumber);
    const totalRounds = globalLeagueMVP.playoffRounds.length;

    return (
      <div className="mx-auto min-w-0 w-full max-w-7xl space-y-6 overflow-x-hidden px-3 sm:px-4 lg:px-8 pb-6 md:pb-8">
        {/* Hero */}
        <section className="relative w-full overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-8 rounded-sm">
          {/* Watermark */}
          <div className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden" aria-hidden>
            <span
              className="font-display font-black uppercase whitespace-nowrap text-black/[0.04]"
              style={{ fontSize: 'clamp(120px, 24vw, 360px)', lineHeight: '0.85', letterSpacing: '-0.02em' }}
            >
              GLOBAL
            </span>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 text-center"
          >
            <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-black/60 mb-2">
              Playoffs · Rodada {roundNumber} de {totalRounds}
            </p>
            <h1 className="font-display text-4xl sm:text-6xl font-bold uppercase text-black">
              Liga Global
            </h1>
            <span aria-hidden className="mx-auto mt-4 block w-16 h-[3px] bg-black" />
            <p className="font-serif-hero text-xl sm:text-2xl italic text-black/80 mt-4">
              {round?.status === 'live' ? 'Ao Vivo Agora' :
               round?.status === 'finished' ? 'Rodada Encerrada' :
               'Aguardando Kickoff'}
            </p>
          </motion.div>
        </section>

        {/* Slot banner — Etapa 2 */}
        <NextSlotBanner
          slots={globalLeagueMVP.matchSlots}
          slotDurationMin={globalLeagueMVP.slotDurationMin}
          currentDay={globalLeagueMVP.currentOlefootDay}
          competitionStartedAt={globalLeagueMVP.competitionStartedAt}
          competitionDurationDays={globalLeagueMVP.competitionDurationDays}
        />

        {/* Status bar da rodada */}
        <PlayoffRoundStatusBar round={round} totalRounds={totalRounds} />

        {/* Jogos ao vivo ou finalizados */}
        {round && (round.status === 'live' || round.status === 'finished') && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              {round.status === 'live' && (
                <span className="flex items-center gap-1.5 bg-neon-green/20 text-neon-green border border-neon-green/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  <Activity className="w-3 h-3 animate-pulse" /> Ao Vivo
                </span>
              )}
              {round.status === 'finished' && (
                <span className="flex items-center gap-1.5 bg-white/10 text-white/60 border border-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  <Trophy className="w-3 h-3" /> Encerrado
                </span>
              )}
              <span className="text-white/40 text-xs font-display uppercase tracking-wider">
                {round.fixtures.length} partidas
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {round.fixtures.map((fixture, index) => (
                <FixtureCard key={fixture.id} fixture={fixture} index={index} />
              ))}
            </div>
          </div>
        )}

        {/* Classificação dos playoffs (pontos acumulados) */}
        {globalLeagueMVP.teams.length > 0 && (
          <ProjectedDivisionsGrid teams={globalLeagueMVP.teams} roundNumber={roundNumber} />
        )}
      </div>
    );
  }

  // Liga ativa - mostrar divisões
  const division1Teams = globalLeagueMVP.teams.filter(t => t.division === 1);
  const division2Teams = globalLeagueMVP.teams.filter(t => t.division === 2);
  const division3Teams = globalLeagueMVP.teams.filter(t => t.division === 3);
  const currentRound = currentLeagueRound;

  return (
    <div className="mx-auto min-w-0 w-full max-w-7xl space-y-6 overflow-x-hidden px-3 sm:px-4 lg:px-8 pb-6 md:pb-8">
      {/* Hero */}
      <section className="relative w-full overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-8 rounded-sm">
        {/* Watermark */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden" aria-hidden>
          <span
            className="font-display font-black uppercase whitespace-nowrap text-black/[0.04]"
            style={{ fontSize: 'clamp(120px, 24vw, 360px)', lineHeight: '0.85', letterSpacing: '-0.02em' }}
          >
            GLOBAL
          </span>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 text-center"
        >
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-black/60 mb-4">
            Liga Global · Temporada 2026
          </p>
          <h1 className="font-display text-4xl sm:text-6xl font-bold uppercase text-black">
            Liga LEGACY
          </h1>
          <span aria-hidden className="mx-auto mt-4 block w-16 h-[3px] bg-black" />
          <p className="font-serif-hero text-xl sm:text-2xl italic text-black/80 mt-4">
            Rodadas em slots · Temporada 2026
          </p>
        </motion.div>
      </section>

      {/* Slot banner — Etapa 2 */}
      <NextSlotBanner
        slots={globalLeagueMVP.matchSlots}
        slotDurationMin={globalLeagueMVP.slotDurationMin}
        currentDay={globalLeagueMVP.currentOlefootDay}
      />

      {/* Filtros */}
      {currentRound && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-4 py-2 rounded-sm font-display text-xs font-bold uppercase tracking-wider transition-all ${
              filterMode === 'all'
                ? 'bg-neon-yellow text-black'
                : 'bg-panel text-white/60 hover:text-white'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilterMode('division_1')}
            className={`px-4 py-2 rounded-sm font-display text-xs font-bold uppercase tracking-wider transition-all ${
              filterMode === 'division_1'
                ? 'bg-neon-yellow text-black'
                : 'bg-panel text-white/60 hover:text-white'
            }`}
          >
            Divisão 1
          </button>
          <button
            onClick={() => setFilterMode('division_2')}
            className={`px-4 py-2 rounded-sm font-display text-xs font-bold uppercase tracking-wider transition-all ${
              filterMode === 'division_2'
                ? 'bg-blue-400 text-black'
                : 'bg-panel text-white/60 hover:text-white'
            }`}
          >
            Divisão 2
          </button>
          <button
            onClick={() => setFilterMode('division_3')}
            className={`px-4 py-2 rounded-sm font-display text-xs font-bold uppercase tracking-wider transition-all ${
              filterMode === 'division_3'
                ? 'bg-white/20 text-white'
                : 'bg-panel text-white/60 hover:text-white'
            }`}
          >
            Divisão 3
          </button>
        </div>
      )}

      {/* Partidas da Rodada Atual */}
      {currentRound && filteredFixtures.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredFixtures.map((fixture, index) => (
            <FixtureCard key={fixture.id} fixture={fixture} index={index} />
          ))}
        </div>
      )}

      {/* Tabelas de Classificação */}
      <div className="space-y-6">
        <DivisionStandings division={1} teams={division1Teams} />
        <DivisionStandings division={2} teams={division2Teams} />
        <DivisionStandings division={3} teams={division3Teams} />
      </div>
    </div>
  );
}
