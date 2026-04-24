import { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Trophy, ArrowRight, Star, Megaphone } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { trackMissionEvent } from '@/progression/trackEvent';

type TeamStats = {
  passesOk: number;
  passesAttempt: number;
  tackles: number;
  shotsOn: number;
  shotsOff: number;
  saves: number;
  dribblesOk: number;
};

const ZERO_TEAM_STATS: TeamStats = {
  passesOk: 0,
  passesAttempt: 0,
  tackles: 0,
  shotsOn: 0,
  shotsOff: 0,
  saves: 0,
  dribblesOk: 0,
};

function formatPct(ok: number, attempts: number): string {
  if (attempts <= 0) return '—';
  return `${Math.round((ok / attempts) * 100)}%`;
}

export default function Postgame() {
  const navigate = useNavigate();
  const live = useGameStore((s) => s.liveMatch);
  const playersById = useGameStore((s) => s.players);
  const clubName = useGameStore((s) => s.club.name);

  useEffect(() => {
    if (!live) {
      navigate('/', { replace: true });
      return;
    }
    const mode = live.mode;
    const evt: import('@/progression/types').MissionEvent =
      mode === 'quick' ? 'fast_match_completed' : 'match_completed';
    trackMissionEvent(evt);
    const homeScore = live.homeScore ?? 0;
    const awayScore = live.awayScore ?? 0;
    if (homeScore > awayScore) trackMissionEvent('match_won');
    if (homeScore > 0) trackMissionEvent('goal_scored', homeScore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!live) navigate('/', { replace: true });
  }, [live, navigate]);

  const teamStats: TeamStats = useMemo(() => {
    if (!live?.homeStats) return ZERO_TEAM_STATS;
    const out = { ...ZERO_TEAM_STATS };
    for (const s of Object.values(live.homeStats)) {
      out.passesOk += s.passesOk ?? 0;
      out.passesAttempt += s.passesAttempt ?? 0;
      out.tackles += s.tackles ?? 0;
      out.shotsOn += (s as { shotsOn?: number }).shotsOn ?? 0;
      out.shotsOff += (s as { shotsOff?: number }).shotsOff ?? 0;
      out.saves += (s as { saves?: number }).saves ?? 0;
      out.dribblesOk += (s as { dribblesOk?: number }).dribblesOk ?? 0;
    }
    return out;
  }, [live?.homeStats]);

  const mvp = useMemo(() => {
    if (!live?.homeStats) return null as null | { id: string; name: string; pos: string; rating: number; stats: TeamStats };
    let bestId: string | null = null;
    let bestScore = -Infinity;
    for (const [pid, s] of Object.entries(live.homeStats)) {
      const sh = (s as { shotsOn?: number; shotsOff?: number; saves?: number; dribblesOk?: number });
      const score =
        (s.rating ?? 6) * 1.0
        + (s.tackles ?? 0) * 0.25
        + (sh.shotsOn ?? 0) * 0.6
        + (sh.saves ?? 0) * 0.55
        + (sh.dribblesOk ?? 0) * 0.4
        + ((s.passesAttempt ?? 0) > 0 ? (s.passesOk / s.passesAttempt) * 1.2 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestId = pid;
      }
    }
    if (!bestId) return null;
    const sStat = live.homeStats[bestId];
    const pp = live.homePlayers?.find((p) => p.playerId === bestId);
    const pEnt = playersById[bestId];
    const name = pp?.name ?? pEnt?.name ?? 'Jogador';
    const pos = pp?.slotId?.toUpperCase() ?? pEnt?.pos ?? '';
    return {
      id: bestId,
      name,
      pos,
      rating: Number((sStat?.rating ?? 6).toFixed(1)),
      stats: {
        passesOk: sStat?.passesOk ?? 0,
        passesAttempt: sStat?.passesAttempt ?? 0,
        tackles: sStat?.tackles ?? 0,
        shotsOn: (sStat as { shotsOn?: number })?.shotsOn ?? 0,
        shotsOff: (sStat as { shotsOff?: number })?.shotsOff ?? 0,
        saves: (sStat as { saves?: number })?.saves ?? 0,
        dribblesOk: (sStat as { dribblesOk?: number })?.dribblesOk ?? 0,
      },
    };
  }, [live?.homeStats, live?.homePlayers, playersById]);

  if (!live) return null;

  const homeScore = live.homeScore ?? 0;
  const awayScore = live.awayScore ?? 0;
  const homeWin = homeScore > awayScore;
  const draw = homeScore === awayScore;
  const resultLabel = homeWin ? 'VITÓRIA' : draw ? 'EMPATE' : 'DERROTA';
  const resultColor = homeWin ? 'text-neon-green' : draw ? 'text-neon-yellow' : 'text-rose-400';

  const voiceStats = (() => {
    let total = 0, accepted = 0, refused = 0;
    for (const ev of live.events ?? []) {
      if (!ev.text?.includes('Comando:')) continue;
      total++;
      if (ev.text.includes('"DEIXA COMIGO!"') || ev.text.includes('"Vou fazer"') || ev.text.includes('"Vou tentar"')) accepted++;
      else if (ev.text.includes('"Tá difícil..."') || ev.text.includes('"NÃO POSSO"')) refused++;
    }
    return { total, accepted, refused };
  })();

  const shotsTotal = teamStats.shotsOn + teamStats.shotsOff;
  const passAcc = formatPct(teamStats.passesOk, teamStats.passesAttempt);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        {/* Resultado */}
        <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-black/70 to-black/40 p-6 text-center">
          <p className={`font-display text-[10px] font-black uppercase tracking-[0.35em] ${resultColor}`}>
            {resultLabel}
          </p>
          <h1 className="mt-2 font-display text-4xl font-black text-white sm:text-5xl">
            {clubName}{' '}
            <span className="text-neon-yellow">{homeScore}</span>
            <span className="mx-3 text-white/30">×</span>
            <span className="text-neon-yellow">{awayScore}</span>{' '}
            {live.awayShort ?? 'Visitante'}
          </h1>
          <p className="mt-2 text-xs text-white/45">
            {live.homeShort} vs {live.awayShort} · {Math.max(90, live.minute ?? 0)}′
          </p>
        </section>

        {/* MVP */}
        <section className="rounded-2xl border border-neon-yellow/40 bg-neon-yellow/[0.06] p-5">
          <header className="mb-3 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-neon-yellow" />
            <h2 className="font-display text-sm font-black uppercase tracking-[0.25em] text-neon-yellow">
              Prêmio MVP
            </h2>
          </header>
          {mvp ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-2xl font-black text-white">{mvp.name}</p>
                <p className="text-[11px] uppercase tracking-wider text-white/50">
                  {mvp.pos} · nota {mvp.rating.toFixed(1)}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center sm:text-right">
                <div>
                  <p className="font-mono text-base font-bold text-white">{mvp.stats.shotsOn}</p>
                  <p className="text-[9px] uppercase tracking-wider text-white/40">Chutes no alvo</p>
                </div>
                <div>
                  <p className="font-mono text-base font-bold text-white">{mvp.stats.tackles}</p>
                  <p className="text-[9px] uppercase tracking-wider text-white/40">Desarmes</p>
                </div>
                <div>
                  <p className="font-mono text-base font-bold text-white">
                    {mvp.stats.passesOk}/{mvp.stats.passesAttempt || '—'}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-white/40">Passes</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/50">Sem dados suficientes para eleger o MVP.</p>
          )}
        </section>

        {/* Estatísticas do time */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <header className="mb-3 flex items-center gap-2">
            <Star className="h-4 w-4 text-white/60" />
            <h2 className="font-display text-xs font-black uppercase tracking-[0.25em] text-white/70">
              Estatísticas do time
            </h2>
          </header>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Passes certos" value={teamStats.passesOk.toString()} />
            <StatTile
              label="Passes errados"
              value={(teamStats.passesAttempt - teamStats.passesOk).toString()}
              sub={passAcc}
            />
            <StatTile label="Chutes no alvo" value={teamStats.shotsOn.toString()} sub={`${shotsTotal} total`} />
            <StatTile label="Chutes pra fora" value={teamStats.shotsOff.toString()} />
            <StatTile label="Desarmes" value={teamStats.tackles.toString()} />
            <StatTile label="Defesas (GK)" value={teamStats.saves.toString()} />
            <StatTile label="Dribles certos" value={teamStats.dribblesOk.toString()} />
            <StatTile label="Gols" value={homeScore.toString()} />
          </div>
        </section>

        {voiceStats.total > 0 ? (
          <section className="rounded-2xl border border-violet-500/40 bg-violet-950/30 p-5">
            <header className="mb-3 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-violet-300" />
              <h2 className="font-display text-xs font-black uppercase tracking-[0.25em] text-violet-200">
                Comandos de voz
              </h2>
            </header>
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="Emitidos" value={voiceStats.total.toString()} />
              <StatTile label="Aceitos" value={voiceStats.accepted.toString()} />
              <StatTile label="Recusados" value={voiceStats.refused.toString()} />
            </div>
          </section>
        ) : null}

        {/* CTA */}
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-xl bg-neon-yellow px-6 py-3 font-display text-sm font-black uppercase tracking-[0.25em] text-black transition-colors hover:bg-white"
          >
            Continuar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-center">
      <p className="font-mono text-xl font-bold text-white">{value}</p>
      <p className="mt-0.5 text-[9px] uppercase tracking-wider text-white/50">{label}</p>
      {sub ? <p className="text-[9px] text-white/30">{sub}</p> : null}
    </div>
  );
}
