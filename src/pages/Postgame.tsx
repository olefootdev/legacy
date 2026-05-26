import { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Trophy, ArrowRight, Star, Megaphone } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { trackMissionEvent } from '@/progression/trackEvent';
import { syncMyExpLifetime } from '@/supabase/referrals';

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

/** Tier de atributo (Football Manager). Aplica via data-tier no .ole-attr. */
const attrTier = (n: number): 'elite' | 'good' | 'avg' | 'weak' =>
  n >= 80 ? 'elite' : n >= 65 ? 'good' : n >= 50 ? 'avg' : 'weak';

/** Rating 0–10 mapeado para tier (10→elite, 7→good, 5→avg, <5→weak). */
const ratingTier = (r: number) => attrTier(r * 10);

export default function Postgame() {
  const navigate = useNavigate();
  const live = useGameStore((s) => s.liveMatch);
  const playersById = useGameStore((s) => s.players);
  const clubName = useGameStore((s) => s.club.name);
  const expLifetimeEarned = useGameStore(
    (s) => (s.finance as { expLifetimeEarned?: number }).expLifetimeEarned ?? 0,
  );

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
    // Sync lifetime EXP com o servidor. Trigger credita 5% de comissão pro
    // referrer se houver. Fire-and-forget: não bloqueia UI.
    if (expLifetimeEarned > 0) {
      void syncMyExpLifetime(expLifetimeEarned);
    }
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
  const resultLabel = homeWin ? 'Vitória.' : draw ? 'Empate.' : 'Derrota.';
  const resultColor = homeWin ? 'text-neon-green' : draw ? 'text-neon-yellow' : 'text-rose-400';
  const resultNarrative = homeWin
    ? 'enfim.'
    : draw
      ? 'fica pra próxima.'
      : 'amanhã o sol nasce de novo.';

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
        {/* Header — eyebrow + resultado emocional em Moret italic */}
        <header className="text-center space-y-4">
          <div className="ole-eyebrow">Pós-jogo</div>
          <h1
            className={`ole-headline-italic ${resultColor} leading-[0.9]`}
            style={{ fontSize: 'clamp(64px, 14vw, 128px)' }}
          >
            {resultLabel}
          </h1>
          <div className="mx-auto w-12 h-[3px] bg-white/30" aria-hidden />
        </header>

        {/* Resultado — placar monumental + narrativa Moret italic */}
        <section className="ole-card p-6 text-center bg-gradient-to-b from-panel to-deep-black">
          <h1 className="ole-headline text-5xl sm:text-7xl">
            {clubName}{' '}
            <span className="text-neon-yellow tabular-nums">{homeScore}</span>
            <span className="ole-scoreboard__separator">×</span>
            <span className="text-neon-yellow tabular-nums">{awayScore}</span>{' '}
            {live.awayShort ?? 'Visitante'}
          </h1>
          <p className="ole-headline-italic mt-2 text-lg sm:text-xl text-white/55">
            {resultNarrative}
          </p>
          <p className="mt-3 text-xs text-white/45">
            {live.homeShort} vs {live.awayShort} · {Math.max(90, live.minute ?? 0)}′
          </p>
        </section>

        {/* MVP */}
        <section className="ole-card-accent p-5 bg-neon-yellow/[0.06]">
          <header className="mb-3 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-neon-yellow" />
            <h2 className="font-display text-sm font-black uppercase tracking-[0.25em] text-neon-yellow">
              Prêmio MVP
            </h2>
          </header>
          {mvp ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-2xl font-black text-white uppercase tracking-wide">{mvp.name}</p>
                <p className="text-[11px] uppercase tracking-wider text-white/50">
                  {mvp.pos} · nota{' '}
                  <span className="ole-attr text-base" data-tier={ratingTier(mvp.rating)}>
                    {mvp.rating.toFixed(1)}
                  </span>
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center sm:text-right">
                <div>
                  <p className="ole-attr text-2xl" data-tier={attrTier(mvp.stats.shotsOn * 20)}>
                    {mvp.stats.shotsOn}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-white/40">Chutes no alvo</p>
                </div>
                <div>
                  <p className="ole-attr text-2xl" data-tier={attrTier(mvp.stats.tackles * 15)}>
                    {mvp.stats.tackles}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-white/40">Desarmes</p>
                </div>
                <div>
                  <p
                    className="ole-attr text-2xl"
                    data-tier={
                      mvp.stats.passesAttempt > 0
                        ? attrTier((mvp.stats.passesOk / mvp.stats.passesAttempt) * 100)
                        : 'avg'
                    }
                  >
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
        <section className="ole-card p-5 bg-white/[0.02]">
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
            <StatTile label="Gols" value={homeScore.toString()} highlight />
          </div>
        </section>

        {voiceStats.total > 0 ? (
          <section className="ole-card p-5 border-l-4 border-l-violet-400/70 bg-violet-950/30">
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
            className="inline-flex items-center gap-2 rounded-sm bg-neon-yellow px-6 py-3 font-display text-sm font-black uppercase tracking-[0.25em] text-black transition-colors hover:bg-white"
          >
            Continuar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="ole-card p-3 text-center">
      <p
        className="ole-attr text-xl"
        style={highlight ? { color: 'var(--color-neon-yellow)' } : undefined}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[9px] uppercase tracking-wider text-white/50">{label}</p>
      {sub ? <p className="text-[9px] text-white/30">{sub}</p> : null}
    </div>
  );
}
