/**
 * Match Global — Painel Mundial de Rodadas Simultâneas
 *
 * Design inspirado no BVB (Borussia Dortmund) com identidade Olefoot
 * Adaptado para Global League MVP com 3 divisões
 */

import { L, emIngles } from '@/i18n/L';
import { useState, useMemo, useEffect, Fragment } from 'react';
import { useGameStore } from '@/game/store';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ArrowUp, ArrowDown, History, ChevronDown } from 'lucide-react';
import type { GlobalFixture } from '@/match/globalMatch';
import { GLOBAL_MATCH_CONSTANTS } from '@/match/globalMatch';
import { GLOBAL_LEAGUE_MVP_CONSTANTS } from '@/match/globalLeagueMVP';
import type { GlobalTeam, PlayoffRound } from '@/match/globalLeagueMVP';
import { SCHEDULER_CONFIG } from '@/match/globalRoundScheduler';
import { DailyCycleHero } from '@/components/matchglobal/DailyCycleHero';
import { CrownsGallery } from '@/components/matchglobal/CrownsGallery';
import { CoronationModal } from '@/components/matchglobal/CoronationModal';
import { useCoronationListener } from '@/hooks/useCoronationListener';
import { BarraSegmentos, BotaoRua, FitaRua, MarcaRua, SecaoRua, SeloRua } from '@/components/ui/Rua';
import { FaltaRua, LinhaRua, ZonaRua } from '@/components/leagues/RuaTabela';
import { cn } from '@/lib/utils';

type FilterMode = 'all' | 'division_1' | 'division_2' | 'division_3';

// ─── Identidade das divisões na escada do DS 2027: Elite em ouro (respeito),
// Intermediária em papel, Acesso em mudo. Sem aço/bronze/azul de enfeite.
// Classes ESTÁTICAS — o Tailwind não compila `text-${x}`. ─────────────────────
const DIV_THEME: Record<number, { name: string; text: string; spineBg: string }> = {
  1: { name: 'Elite', text: 'text-ouro-27', spineBg: 'bg-ouro-27' },
  2: { name: L('Intermediária', 'Intermediate'), text: 'text-papel', spineBg: 'bg-papel' },
  3: { name: L('Acesso', 'Access'), text: 'text-suave', spineBg: 'bg-fio' },
};
const divTheme = (d: number) => DIV_THEME[d] ?? DIV_THEME[3];

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
    <div className="rua-grao flex min-w-0 flex-col gap-4 bg-concreto px-4 py-4 sm:px-5">
      <div className="grid min-w-0 grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:items-end sm:gap-8">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.18em] text-mudo">{L('Dia OleFoot', 'OleFoot Day')}</span>
          <span className="truncate font-impact text-[20px] leading-none text-papel">{today} <span className="font-prova text-[11px] text-mudo">UTC</span></span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.18em] text-mudo">
            {inSlot.active ? L('Slot ao vivo · termina em', 'Live slot · ends in') : L('Próximo slot', 'Next slot')}
          </span>
          {inSlot.active ? (
            <span className="font-spray text-[30px] font-black leading-none text-rua">{formatCountdown((inSlot.endMs ?? tick) - tick)}</span>
          ) : nextMs ? (
            <span className="font-spray text-[30px] font-black leading-none text-rua">
              {formatCountdown(nextMs - tick)}
              <span className="ml-2 font-prova text-[11px] font-bold text-mudo">{new Date(nextMs).toISOString().slice(11, 16)} UTC</span>
            </span>
          ) : (
            <span className="font-impact text-[20px] text-mudo">—</span>
          )}
        </div>
        {compDaysLeft != null && (
          <div className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-1">
            <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.18em] text-mudo">{L('Competição termina em', 'Competition ends in')}</span>
            <span className="font-spray text-[30px] font-black leading-none text-papel">
              {compDaysLeft}d {compMsLeft != null ? formatCountdown(compMsLeft % 86_400_000) : ''}
            </span>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 font-prova text-[10.5px] font-bold uppercase tracking-[0.12em]">
        <span className="text-mudo">Slots</span>
        {slotsArr.map((s, i) => {
          const [h, m] = s.split(':').map(Number);
          const day = new Date(tick);
          day.setUTCHours(h, m, 0, 0);
          const isPast = tick >= day.getTime() + duration * 60_000;
          const isCurrent = inSlot.slotName === s;
          return (
            <span
              key={i}
              className={cn(
                'px-1.5 py-0.5',
                isCurrent ? 'bg-rua text-asfalto-27' : isPast ? 'bg-linha text-fio line-through' : 'border-2 border-rua text-rua',
              )}
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
  const theme = divTheme(Number(fixture.division));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn('min-w-0 bg-concreto px-3 py-2.5', isLive && 'border-l-[5px] border-rua')}
    >
      {/* Confronto compacto — tudo numa linha só */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <span className={cn('shrink-0 font-prova text-[10px] font-bold uppercase tracking-[0.1em]', theme.text)}>D{fixture.division}</span>

        {/* Time Casa */}
        <div className="flex min-w-0 flex-1 items-baseline justify-end gap-1.5">
          <span className="truncate font-impact text-[15px] uppercase leading-none text-papel sm:text-[18px]" title={fixture.homeTeamName}>
            {fixture.homeTeamName}
          </span>
          <span className="shrink-0 font-prova text-[10px] text-mudo">{fixture.homeOverall}</span>
        </div>

        {/* Placar em spray */}
        <div className="flex shrink-0 items-center gap-1 bg-asfalto-27 px-2 py-0.5">
          <motion.span
            key={`home-${fixture.scoreHome}`}
            initial={{ scale: hasGoal ? 1.4 : 1 }}
            animate={{ scale: 1 }}
            className="font-spray text-[22px] font-black leading-none tabular-nums text-rua sm:text-[28px]"
          >
            {fixture.scoreHome}
          </motion.span>
          <span className="font-spray text-[16px] font-black text-mudo">×</span>
          <motion.span
            key={`away-${fixture.scoreAway}`}
            initial={{ scale: hasGoal ? 1.4 : 1 }}
            animate={{ scale: 1 }}
            className="font-spray text-[22px] font-black leading-none tabular-nums text-rua sm:text-[28px]"
          >
            {fixture.scoreAway}
          </motion.span>
        </div>

        {/* Time Visitante */}
        <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className="shrink-0 font-prova text-[10px] text-mudo">{fixture.awayOverall}</span>
          <span className="truncate font-impact text-[15px] uppercase leading-none text-papel sm:text-[18px]" title={fixture.awayTeamName}>
            {fixture.awayTeamName}
          </span>
        </div>

        {/* Minuto */}
        <span className={cn('w-9 shrink-0 text-right font-spray text-[16px] font-black tabular-nums', isLive ? 'text-rua' : 'text-mudo')}>
          {fixture.currentMinute}'
        </span>
      </div>

      {/* Último evento — linha fina, só quando há lance */}
      <AnimatePresence mode="wait">
        {lastEvent && (
          <motion.div
            key={lastEvent.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1.5 overflow-hidden pl-7"
          >
            <p className="truncate font-prova text-[11px] text-suave">
              <span className="font-bold text-rua">{lastEvent.minute}'</span> {lastEvent.text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DivisionStandings({ division, teams, myTeamId, defaultOpen = true, isMine = false }: { division: number; teams: GlobalTeam[]; myTeamId?: string | null; defaultOpen?: boolean; isMine?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  // ORDENA pela classificação real antes de renderizar — sem isso, o index do
  // map é a ordem de inserção e os destaques (líder/promo/rele) ficam errados.
  const sortedTeams = useMemo(() => [...teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.clubName.localeCompare(b.clubName);
  }), [teams]);
  const promotionCount = Math.ceil(sortedTeams.length * 0.1);
  const relegationCount = Math.ceil(sortedTeams.length * 0.1);
  const theme = divTheme(division);
  const leader = sortedTeams[0];

  // Janela: numa divisão gigante (1000 times), mostrar todos é impossível.
  // Mostra o topo + o meu time; o resto fica sob "Ver tabela completa".
  const [showFull, setShowFull] = useState(false);
  const CAP = 20;
  const myIdx = myTeamId ? sortedTeams.findIndex((t) => t.id === myTeamId) : -1;
  const windowed = open && !showFull && sortedTeams.length > CAP;

  // DS 2027: "quanto falta pro acesso" — pontos reais até a última vaga da zona.
  const me = myIdx >= 0 ? sortedTeams[myIdx] : undefined;
  const lastPromo = division > 1 && promotionCount > 0 ? sortedTeams[promotionCount - 1] : undefined;
  const gapToPromo = isMine && me && lastPromo && myIdx >= promotionCount ? Math.max(0, lastPromo.points - me.points) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex min-w-0 flex-col gap-3">
      {/* Cabeçalho — clicável: expande/colapsa a divisão (condensa 1000 times) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn('relative flex w-full min-w-0 items-center justify-between gap-3 bg-concreto px-4 py-4 text-left transition-colors hover:bg-linha', isMine && 'border-l-[5px] border-rua')}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="font-impact text-[26px] uppercase leading-none text-papel">
              {L('Divisão', 'Division')} {division}
            </h3>
            {isMine && <SeloRua tom="corre" className="py-0.5 text-[10px]">{L('Tua liga', 'Your league')}</SeloRua>}
          </div>
          {open ? (
            <p className={cn('font-voz text-[20px] leading-none', theme.text)}>{theme.name}</p>
          ) : (
            <p className="truncate font-prova text-[11px] uppercase tracking-[0.1em] text-mudo">
              {leader ? (
                <>
                  {L('Líder', 'Leader')} <span className="font-bold text-ouro-27">{leader.clubName}</span> · {leader.points} pts
                </>
              ) : (
                theme.name
              )}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className={cn('font-spray text-[32px] font-black leading-none', theme.text)}>{teams.length}</span>
          <ChevronDown className={cn('h-5 w-5 text-mudo transition-transform', open && 'rotate-180')} strokeWidth={2.5} aria-hidden />
        </div>
      </button>

      {open && (
        <>
          {gapToPromo != null && (
            <FaltaRua
              valor={gapToPromo}
              unidade={L('pts', 'pts')}
              frase={L('é o que separa tu do acesso.', "is all that's between you and promotion.")}
            />
          )}

          {/* Tabela — linhas em concreto, líder no fio de ouro, o meu time colado torto. */}
          <div className="flex min-w-0 flex-col gap-1.5">
            {sortedTeams.map((team, index) => {
              // Janela: esconde o miolo quando a tabela é gigante, mantendo topo + meu time.
              if (windowed && index >= CAP && index !== myIdx) return null;
              const gapBefore = windowed && index === myIdx && myIdx >= CAP;
              const isPromotion = division > 1 && index < promotionCount;
              const isRelegation = division < 3 && index >= sortedTeams.length - relegationCount;
              const isLeader = index === 0;
              const isMe = !!myTeamId && team.id === myTeamId;

              const positionChange = team.previousPosition ? team.previousPosition - (team.position || 0) : 0;

              // Linha de corte: DEPOIS da zona de acesso e ANTES da de rebaixamento.
              const showPromoCut = division > 1 && index === promotionCount - 1 && sortedTeams.length > promotionCount;
              const showReleCut = division < 3 && index === sortedTeams.length - relegationCount - 1 && sortedTeams.length > relegationCount;

              return (
                <Fragment key={team.id}>
                  {gapBefore && (
                    <div aria-hidden className="flex h-8 items-center justify-center font-prova text-[10.5px] font-bold uppercase tracking-[0.2em] text-mudo">
                      ··· {L(`${myIdx - CAP} times acima de ti`, `${myIdx - CAP} teams above you`)}
                    </div>
                  )}
                  <LinhaRua
                    id={isMe ? 'my-global-team' : undefined}
                    pos={team.position ?? index + 1}
                    tom={isMe ? 'eu' : isLeader ? 'lider' : isPromotion ? 'zona' : isRelegation ? 'abaixo' : 'normal'}
                    nome={team.clubName}
                    sub={`${L('J', 'P')}${team.matchesPlayed} ${L('V', 'W')}${team.wins} ${L('E', 'D')}${team.draws} ${L('D', 'L')}${team.losses} · ${L('SG', 'GD')} ${team.goalDifference > 0 ? '+' : ''}${team.goalDifference} · ${team.allTimePoints ?? 0} ${L('hist.', 'all-time')}`}
                    chip={
                      positionChange > 0 ? (
                        <ArrowUp aria-label={L('Subiu', 'Up')} className={cn('h-4 w-4 shrink-0', isMe ? 'text-asfalto-27' : 'text-alta')} strokeWidth={3} />
                      ) : positionChange < 0 ? (
                        <ArrowDown aria-label={L('Caiu', 'Down')} className={cn('h-4 w-4 shrink-0', isMe ? 'text-asfalto-27' : 'text-baixa')} strokeWidth={3} />
                      ) : null
                    }
                    valor={team.points}
                  />
                  {showPromoCut && <ZonaRua label={L('Zona de acesso', 'Promotion zone')} />}
                  {showReleCut && <ZonaRua label={L('Zona de queda', 'Relegation zone')} tom="fio" />}
                </Fragment>
              );
            })}
          </div>

          {/* Ver tabela completa — só quando a divisão é grande demais pra rolar inteira */}
          {sortedTeams.length > CAP && (
            <button
              type="button"
              onClick={() => setShowFull((v) => !v)}
              className="flex w-full items-center justify-center gap-2 border-2 border-dashed border-fio py-3 font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo transition-colors hover:border-papel hover:text-papel"
            >
              {showFull ? L('Recolher tabela', 'Collapse table') : L(`Ver tabela completa · ${sortedTeams.length} times`, `View full table · ${sortedTeams.length} teams`)}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showFull && 'rotate-180')} strokeWidth={2.5} />
            </button>
          )}

          {/* Legenda */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 font-prova text-[10.5px] font-bold uppercase tracking-[0.12em] text-mudo">
            <span className="flex items-center gap-2"><span className="h-3 w-3 border-2 border-ouro-27" />{L('Líder', 'Leader')}</span>
            {division > 1 && (
              <span className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-rua" />{L('Acesso · top 10%', 'Promotion · top 10%')}</span>
            )}
            {division < 3 && (
              <span className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-fio" />{L('Queda · últimos 10%', 'Relegation · bottom 10%')}</span>
            )}
          </div>
        </>
      )}
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
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className={cn('flex min-w-0 flex-col gap-3 bg-concreto p-4', isLive && 'border-l-[5px] border-rua')}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.18em] text-mudo">
            {isLive ? L('● Ao vivo', '● Live') : isFinished ? L('Próxima rodada em', 'Next round in') : L('Kickoff em', 'Kickoff in')}
          </span>
          <span className={cn('font-spray text-[44px] font-black leading-none', isLive || isFinished ? 'text-rua' : 'text-papel')}>
            {isLive ? `${round.fixtures[0]?.currentMinute ?? 0}'` : countdown}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.18em] text-mudo">{L('Rodada', 'Round')}</span>
          <span className="font-spray text-[44px] font-black leading-none text-papel">
            {round.roundNumber}<span className="text-[22px] text-fio">/{totalRounds}</span>
          </span>
        </div>
      </div>
      {/* Progresso das rodadas em segmentos */}
      <BarraSegmentos valor={isScheduled ? round.roundNumber - 1 : round.roundNumber} max={totalRounds} segmentos={Math.max(1, totalRounds)} />
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
  const theme = divTheme(division);
  const promoCount = Math.max(1, Math.ceil(teams.length * 0.1));
  const releCount = Math.max(1, Math.ceil(teams.length * 0.1));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-baseline justify-between gap-2 px-1">
        <h3 className="min-w-0 truncate font-impact text-[20px] uppercase leading-none text-papel">
          {emIngles() ? `Division ${division}` : `${division}ª Divisão`} <span className={cn('font-voz text-[18px] normal-case', theme.text)}>{theme.name}</span>
        </h3>
        <span className={cn('shrink-0 font-spray text-[24px] font-black leading-none', theme.text)}>{teams.length}</span>
      </div>
      {teams.map((team, index) => {
        const sg = team.playoffGoalsFor - team.playoffGoalsAgainst;
        const isLeader = index === 0;
        const isPromotion = division > 1 && index < promoCount;
        const isRelegation = division < totalDivisions && index >= teams.length - releCount;
        return (
          <Fragment key={team.id}>
            <LinhaRua
              pos={index + 1}
              tom={isLeader ? 'lider' : isPromotion ? 'zona' : isRelegation ? 'abaixo' : 'normal'}
              nome={team.clubName}
              sub={`${L('J', 'P')}${team.playoffMatchesPlayed} ${L('V', 'W')}${team.playoffWins} ${L('E', 'D')}${team.playoffDraws} ${L('D', 'L')}${team.playoffLosses} · ${L('SG', 'GD')} ${sg > 0 ? '+' : ''}${sg} · ${team.allTimePoints ?? 0} ${L('hist.', 'all-time')}`}
              valor={team.playoffPoints}
            />
            {division > 1 && index === promoCount - 1 && teams.length > promoCount && <ZonaRua label={L('Sobe', 'Up')} />}
            {division < totalDivisions && index === teams.length - releCount - 1 && teams.length > releCount && <ZonaRua label={L('Desce', 'Down')} tom="fio" />}
          </Fragment>
        );
      })}
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
  totalDivisions = GLOBAL_LEAGUE_MVP_CONSTANTS.DIVISIONS,
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
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <SecaoRua label={L(`Classificação · após rodada ${roundNumber}`, `Standings · after round ${roundNumber}`)} />
        <p className="font-voz text-[22px] leading-[1.05] text-suave">
          {L('Projeção: top 10% sobe, últimos 10% descem.', 'Projection: top 10% up, bottom 10% down.')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {divisions.map((divTeams, idx) => (
          <ProjectedDivisionMini key={idx} division={idx + 1} teams={divTeams} totalDivisions={totalDivisions} />
        ))}
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
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const club = useGameStore((s) => s.club);
  // null = sem escolha explícita → cai no default (minha divisão). Assim o manager
  // abre direto na SUA liga (condensa 1000 times) e vê as outras só se quiser.
  const [filterOverride, setFilterOverride] = useState<FilterMode | null>(null);

  const managerId = managerProfile?.email ?? club?.id;
  const myTeamId = globalLeagueMVP?.teams.find(t => t.managerId === managerId)?.id ?? null;
  const myDivision = globalLeagueMVP?.teams.find(t => t.id === myTeamId)?.division;
  const filterMode: FilterMode = filterOverride ?? (myDivision ? (`division_${myDivision}` as FilterMode) : 'all');

  // Listener Realtime: dispara o CoronationModal quando o manager é coroado.
  const coronation = useCoronationListener();

  // Hooks devem ser chamados na mesma ordem em todo render — sem returns antes deles.
  const currentLeagueRound = globalLeagueMVP?.status === 'active'
    ? globalLeagueMVP.leagueRounds.find(r => r.roundNumber === globalLeagueMVP.currentLeagueRound)
    : undefined;

  // Última rodada finalizada (para mostrar resultados reais em vez de 0x0)
  const lastFinishedRound = useMemo(() => {
    if (!globalLeagueMVP) return undefined;
    const finished = globalLeagueMVP.leagueRounds
      .filter(r => r.status === 'finished')
      .sort((a, b) => b.roundNumber - a.roundNumber);
    return finished[0];
  }, [globalLeagueMVP]);

  const filteredFixtures = useMemo(() => {
    // Prioridade: última rodada finalizada > rodada atual scheduled
    const source = lastFinishedRound ?? currentLeagueRound;
    if (!source) return [];
    if (filterMode === 'all') return source.fixtures;
    const divisionNumber = filterMode.split('_')[1];
    return source.fixtures.filter(f => f.division === divisionNumber);
  }, [lastFinishedRound, currentLeagueRound, filterMode]);

  // Verificar status da liga
  if (!globalLeagueMVP || globalLeagueMVP.status === 'waiting_teams') {
    const teamsNow = globalLeagueMVP?.teams.length ?? 0;
    const minTeams = globalLeagueMVP?.minTeamsRequired ?? 2;
    const ready = teamsNow >= minTeams;

    return (
      <div className="mx-auto min-w-0 w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-10 overflow-x-hidden space-y-8">
        <CoronationModal crown={coronation.crown} onClose={coronation.dismiss} />
        <DailyCycleHero />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex min-w-0 flex-col gap-5">
          <SeloRua tom={ready ? 'corre' : 'corre-contorno'} className="self-start">
            {ready ? L('● Próxima rodada em instantes', '● Next round shortly') : L('Aguardando managers', 'Waiting for managers')}
          </SeloRua>
          <h1 className="font-impact uppercase leading-[0.86] text-papel" style={{ fontSize: 'clamp(52px, 14vw, 96px)' }}>
            {L('Liga Global', 'Global League')}
          </h1>
          <p className="font-voz text-[clamp(24px,6.4vw,32px)] leading-[1.05] text-suave">
            {ready
              ? L('Começa sozinha em até 5 minutos.', 'Starts on its own within 5 minutes.')
              : L(`Faltam ${Math.max(0, minTeams - teamsNow)} ${minTeams - teamsNow === 1 ? 'manager' : 'managers'} pros playoffs.`, `${Math.max(0, minTeams - teamsNow)} more ${minTeams - teamsNow === 1 ? 'manager' : 'managers'} to the playoffs.`)}
          </p>

          <div className="grid max-w-md grid-cols-2 gap-1.5">
            <div className="flex flex-col gap-1 bg-concreto p-4">
              <span className="font-spray text-[56px] font-black leading-none text-rua">{teamsNow}</span>
              <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.16em] text-mudo">{L('Inscritos', 'Registered')}</span>
            </div>
            <div className="flex flex-col gap-1 border-2 border-dashed border-fio p-4">
              <span className="font-spray text-[56px] font-black leading-none text-papel">{minTeams}</span>
              <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.16em] text-mudo">{L('Mínimo', 'Minimum')}</span>
            </div>
          </div>
          <BarraSegmentos valor={teamsNow} max={minTeams} className="max-w-md" />

          <BotaoRua onClick={() => navigate('/liga-global/registro')} className="self-start">
            {L('Ver registro completo', 'View full registry')} <span aria-hidden>→</span>
          </BotaoRua>
        </motion.div>
        <CrownsGallery />
      </div>
    );
  }

  if (globalLeagueMVP.status === 'playoffs') {
    const roundNumber = globalLeagueMVP.currentPlayoffRound ?? 1;
    const round = globalLeagueMVP.playoffRounds.find(r => r.roundNumber === roundNumber);
    const totalRounds = globalLeagueMVP.playoffRounds.length;

    return (
      <div className="mx-auto min-w-0 w-full max-w-7xl space-y-6 overflow-x-hidden px-3 sm:px-4 lg:px-8 pb-6 md:pb-8">
        <CoronationModal crown={coronation.crown} onClose={coronation.dismiss} />
        <DailyCycleHero />

        {/* Hero — fita de rua + grito; o status da rodada na voz. */}
        <FitaRua tags={['#playoffs', '#ligaglobal']} className="-mx-3 sm:-mx-4 lg:-mx-8" />
        <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex min-w-0 flex-col gap-2">
          <SecaoRua label={L(`Playoffs · rodada ${roundNumber} de ${totalRounds}`, `Playoffs · round ${roundNumber} of ${totalRounds}`)} />
          <h1 className="font-impact uppercase leading-[0.86] text-papel" style={{ fontSize: 'clamp(52px, 14vw, 96px)' }}>
            {L('Liga Global', 'Global League')}
          </h1>
          <p className={cn('font-voz text-[clamp(24px,6.4vw,32px)] leading-[1.05]', round?.status === 'live' ? 'text-rua' : 'text-suave')}>
            {round?.status === 'live' ? L('Bola rolando agora.', 'Ball rolling now.') :
             round?.status === 'finished' ? L('Rodada encerrada.', 'Round finished.') :
             L('Aguardando o apito.', 'Waiting for kickoff.')}
          </p>
        </motion.header>

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
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              {round.status === 'live' && <SeloRua tom="corre">● {L('Ao vivo', 'Live')}</SeloRua>}
              {round.status === 'finished' && <SeloRua tom="cal">{L('Encerrado', 'Finished')}</SeloRua>}
              <span className="font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo">
                {round.fixtures.length} {L('partidas', 'matches')}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
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

        <CrownsGallery />
      </div>
    );
  }

  if (globalLeagueMVP.status === 'season_ended') {
    const div1Teams = [...globalLeagueMVP.teams]
      .filter(t => t.division === 1)
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
      });

    // Campeão: líder da divisão 1, ou time com mais allTimePoints se não houver div1
    const champion = div1Teams[0] ?? [...globalLeagueMVP.teams].sort((a, b) => (b.allTimePoints ?? 0) - (a.allTimePoints ?? 0))[0];
    const podium = div1Teams.slice(0, 3);

    const allTeams = globalLeagueMVP.teams;
    const totalMatches = allTeams.reduce((s, t) => s + (t.matchesPlayed ?? 0), 0) / 2;
    const totalGoals = allTeams.reduce((s, t) => s + (t.goalsFor ?? 0), 0);
    const topScorer = [...allTeams].sort((a, b) => (b.goalsFor ?? 0) - (a.goalsFor ?? 0))[0];

    return (
      <div className="mx-auto min-w-0 w-full max-w-4xl space-y-8 overflow-x-hidden px-3 sm:px-4 lg:px-8 pb-10">
        <CoronationModal crown={coronation.crown} onClose={coronation.dismiss} />
        <DailyCycleHero />
        {/* Hero */}
        <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex min-w-0 flex-col gap-2">
          <SecaoRua label={L('#ligaglobal · fim de temporada', '#globalleague · season over')} />
          <h1 className="font-impact uppercase leading-[0.86] text-papel" style={{ fontSize: 'clamp(48px, 13vw, 92px)' }}>
            {L('Temporada encerrada', 'Season over')}
          </h1>
          {globalLeagueMVP.seasonName && (
            <p className="font-voz text-[clamp(24px,6.4vw,32px)] leading-[1.05] text-suave">{globalLeagueMVP.seasonName}</p>
          )}
        </motion.header>

        {/* Campeão — LENDA: ouro chapado, o topo da escada. */}
        {champion && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative flex min-w-0 items-end justify-between gap-4 overflow-hidden bg-ouro-27 p-5 text-asfalto-27 sm:p-7"
          >
            <span
              aria-hidden
              className="rua-reticula absolute -right-4 -top-4 h-40 w-48 [--reticula:rgba(13,13,12,0.4)]"
              style={{
                WebkitMaskImage: 'radial-gradient(circle at 100% 0%, #000 0%, transparent 72%)',
                maskImage: 'radial-gradient(circle at 100% 0%, #000 0%, transparent 72%)',
              }}
            />
            <div className="relative flex min-w-0 flex-col gap-2">
              <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.22em]">{L('Campeão', 'Champion')}</span>
              <h2 className="font-impact uppercase leading-[0.86] [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(40px, 11vw, 72px)' }}>
                {champion.clubName}
              </h2>
              <p className="font-voz text-[24px] leading-none">{L('Respeito é ouro.', 'Respect is gold.')}</p>
              <p className="font-prova text-[12px] font-bold uppercase tracking-[0.1em]">
                {champion.points} pts · {champion.wins}{L('V', 'W')} {champion.draws}{L('E', 'D')} {champion.losses}{L('D', 'L')}
              </p>
            </div>
            <MarcaRua tipo="nove" className="relative h-24 bg-asfalto-27 sm:h-32" />
          </motion.div>
        )}

        {/* Pódio divisão 1 */}
        {podium.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex min-w-0 flex-col gap-2">
            <SecaoRua label={L('Pódio · Divisão 1', 'Podium · Division 1')} />
            {podium.map((team, idx) => (
              <LinhaRua
                key={team.id}
                pos={idx + 1}
                tom={idx === 0 ? 'lider' : 'normal'}
                nome={team.clubName}
                sub={`${team.clubShort} · ${team.wins}${L('V', 'W')} ${team.draws}${L('E', 'D')} ${team.losses}${L('D', 'L')}`}
                valor={team.points}
              />
            ))}
          </motion.div>
        )}

        {/* Números da temporada */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-3 gap-1.5">
          <div className="flex min-w-0 flex-col gap-1 bg-concreto p-4">
            <span className="font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo">{L('Partidas', 'Matches')}</span>
            <span className="font-spray text-[40px] font-black leading-none text-papel">{Math.round(totalMatches)}</span>
          </div>
          <div className="flex min-w-0 flex-col gap-1 bg-concreto p-4">
            <span className="font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo">{L('Gols', 'Goals')}</span>
            <span className="font-spray text-[40px] font-black leading-none text-rua">{totalGoals}</span>
          </div>
          <div className="flex min-w-0 flex-col gap-1 bg-concreto p-4">
            <span className="truncate font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo">{L('Maior ataque', 'Best attack')}</span>
            <span className="truncate font-impact text-[24px] uppercase leading-none text-papel">{topScorer?.clubShort ?? '—'}</span>
            <span className="font-prova text-[10px] text-mudo">{topScorer?.goalsFor ?? 0} {L('gols', 'goals')}</span>
          </div>
        </motion.div>

        {/* Links e mensagem */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <BotaoRua to="/match/global/history" variante="contorno">
              <History aria-hidden className="h-4 w-4" />
              {L('Histórico', 'History')}
            </BotaoRua>
            <BotaoRua to="/match/global/all-time" variante="contorno">
              <Trophy aria-hidden className="h-4 w-4" />
              All-Time
            </BotaoRua>
          </div>
          <p className="font-voz text-[24px] leading-none text-suave">{L('Nova temporada em breve.', 'New season soon.')}</p>
        </motion.div>

        <CrownsGallery />
      </div>
    );
  }

  // Liga ativa - mostrar divisões
  const division1Teams = globalLeagueMVP.teams.filter(t => t.division === 1);
  const division2Teams = globalLeagueMVP.teams.filter(t => t.division === 2);
  const division3Teams = globalLeagueMVP.teams.filter(t => t.division === 3);
  const currentRound = currentLeagueRound;
  // Hero vivo: o líder da D1 (o gigante a bater) + o meu time + rolar até ele.
  const d1Leader = [...division1Teams].sort((a, b) =>
    b.points - a.points || b.wins - a.wins || b.goalDifference - a.goalDifference)[0];
  const myTeam = myTeamId ? globalLeagueMVP.teams.find(t => t.id === myTeamId) : undefined;
  const scrollToMyTeam = () => document.getElementById('my-global-team')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <div className="mx-auto min-w-0 w-full max-w-7xl space-y-6 overflow-x-hidden px-3 sm:px-4 lg:px-8 pb-6 md:pb-8">
      <CoronationModal crown={coronation.crown} onClose={coronation.dismiss} />
      <DailyCycleHero />

      {/* Hero — fita de rua + grito + selos vivos (líder da Elite e o meu time). */}
      <FitaRua tags={['#ligaglobal', '#pirâmide']} className="-mx-3 sm:-mx-4 lg:-mx-8" />
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex min-w-0 flex-col gap-3">
        <SecaoRua label={L(`${globalLeagueMVP.teams.length} clubes · 3 divisões`, `${globalLeagueMVP.teams.length} clubs · 3 divisions`)} />
        <h1 className="font-impact uppercase leading-[0.86] text-papel" style={{ fontSize: 'clamp(52px, 14vw, 96px)' }}>
          {L('Liga Global', 'Global League')}
        </h1>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {d1Leader && (
            <span className="inline-flex min-w-0 max-w-full items-center gap-2 border-2 border-ouro-27 px-2.5 py-1">
              <Trophy aria-hidden className="h-3.5 w-3.5 shrink-0 text-ouro-27" />
              <span className="shrink-0 font-prova text-[10px] font-bold uppercase tracking-[0.12em] text-mudo">{L('Líder Elite', 'Elite leader')}</span>
              <span className="min-w-0 truncate font-impact text-[15px] uppercase leading-none text-ouro-27">{d1Leader.clubName}</span>
              <span className="shrink-0 font-impact text-[15px] leading-none text-ouro-27">{d1Leader.points}</span>
            </span>
          )}
          {myTeam && (
            <button
              type="button"
              onClick={scrollToMyTeam}
              className="inline-flex min-w-0 max-w-full -rotate-1 items-center gap-2 bg-rua px-2.5 py-1 text-asfalto-27 shadow-[3px_3px_0_var(--color-papel)] transition-transform hover:-translate-y-0.5"
            >
              <span className="shrink-0 font-prova text-[10px] font-bold uppercase tracking-[0.12em]">{L('Meu time', 'My team')}</span>
              <span className="min-w-0 truncate font-impact text-[15px] uppercase leading-none">{myTeam.clubName}</span>
              <ArrowDown aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
            </button>
          )}
        </div>
      </motion.header>

      {/* Slot banner — Etapa 2 */}
      <NextSlotBanner
        slots={globalLeagueMVP.matchSlots}
        slotDurationMin={globalLeagueMVP.slotDurationMin}
        currentDay={globalLeagueMVP.currentOlefootDay}
      />

      {/* Filtros */}
      {(lastFinishedRound ?? currentRound) && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {([
            ['all', L('Todas', 'All')],
            ['division_1', L('Divisão 1', 'Division 1')],
            ['division_2', L('Divisão 2', 'Division 2')],
            ['division_3', L('Divisão 3', 'Division 3')],
          ] as [FilterMode, string][]).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterOverride(mode)}
              aria-pressed={filterMode === mode}
              className={cn(
                'inline-flex min-h-[44px] items-center px-3.5 font-impact text-[15px] uppercase leading-none transition-colors',
                filterMode === mode ? 'bg-rua text-asfalto-27' : 'border-2 border-linha text-suave hover:border-papel hover:text-papel',
              )}
            >
              {label}
            </button>
          ))}

          {/* Links de navegação */}
          <div className="flex shrink-0 items-center gap-1.5 sm:ml-auto">
            <Link
              to="/match/global/all-time"
              className="inline-flex min-h-[44px] items-center gap-1.5 px-3 font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-mudo transition-colors hover:text-rua"
            >
              <Trophy aria-hidden className="h-3.5 w-3.5" />
              All-Time
            </Link>
            <Link
              to="/match/global/history"
              className="inline-flex min-h-[44px] items-center gap-1.5 px-3 font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-mudo transition-colors hover:text-rua"
            >
              <History aria-hidden className="h-3.5 w-3.5" />
              {L('Histórico', 'History')}
            </Link>
          </div>
        </div>
      )}

      {/* Partidas — última rodada finalizada ou rodada atual */}
      {filteredFixtures.length > 0 && (
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate font-prova text-[12px] font-bold uppercase tracking-[0.2em] text-mudo">
                —{' '}
                {lastFinishedRound
                  ? L(`Rodada ${lastFinishedRound.roundNumber} · resultados`, `Round ${lastFinishedRound.roundNumber} · results`)
                  : L(`Rodada ${currentRound?.roundNumber} · aguardando kickoff`, `Round ${currentRound?.roundNumber} · awaiting kickoff`)}
              </span>
              {lastFinishedRound && myTeamId && lastFinishedRound.fixtures.some(f => f.homeTeamId === myTeamId || f.awayTeamId === myTeamId) && (
                <SeloRua tom="corre-contorno" className="py-0 text-[10px]">{L('Teu jogo', 'Your match')}</SeloRua>
              )}
            </div>
            <Link to="/match/global/history" className="shrink-0 font-impact text-[15px] uppercase text-rua transition-colors hover:text-papel">
              {L('Ver todas', 'View all')} <span aria-hidden>→</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
            {filteredFixtures.map((fixture, index) => (
              <FixtureCard key={fixture.id} fixture={fixture} index={index} />
            ))}
          </div>
        </div>
      )}

      {/* Tabelas de classificação — condensadas por divisão.
          Default (sem filtro): só a MINHA divisão aberta; as outras entram
          colapsadas, um toque abre. Com filtro de divisão: só ela. */}
      <div className="flex min-w-0 flex-col gap-6">
        {[1, 2, 3].map((div) => {
          const divTeams = div === 1 ? division1Teams : div === 2 ? division2Teams : division3Teams;
          const isMine = myDivision === div;
          // 'all' → mostra as três (minha aberta). 'division_N' → só a N.
          if (filterMode !== 'all' && filterMode !== `division_${div}`) return null;
          return (
            <DivisionStandings
              key={div}
              division={div}
              teams={divTeams}
              myTeamId={myTeamId}
              isMine={isMine}
              defaultOpen={filterMode === `division_${div}` || isMine}
            />
          );
        })}
        {filterMode !== 'all' && (
          <BotaoRua onClick={() => setFilterOverride('all')} variante="contorno" className="self-center">
            {L('Ver todas as divisões', 'View all divisions')}
          </BotaoRua>
        )}
      </div>

      <CrownsGallery />
    </div>
  );
}
