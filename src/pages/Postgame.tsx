import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Megaphone, Share2, Check } from 'lucide-react';
import { getGameState, useGameDispatch, useGameStore } from '@/game/store';
import { trackMissionEvent } from '@/progression/trackEvent';
import { syncMyExpLifetime } from '@/supabase/referrals';
import { recordPvpMatchResult } from '@/supabase/pvpMatches';
import { Hashtag } from '@/components/ui';
import { SecaoRua } from '@/components/ui/Rua';
import { ResultadoRua, type ResultadoTipo } from '@/components/match/ResultadoRua';
import { L, emIngles } from '@/i18n/L';

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
  const dispatch = useGameDispatch();
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

    // Registra resultado PvP no servidor (Quick vs manager real).
    // Cliente A grava → server insere ledger + B coleta no próximo login.
    // MatchClassic usa engine separado e não passa por esse Postgame —
    // integração de Classic fica como follow-up.
    if (mode === 'quick') {
      const opponent = getGameState().nextFixture?.opponent;
      const opponentLabel = opponent?.name ?? opponent?.shortName ?? 'Manager';
      if (opponent?.id) {
        void recordPvpMatchResult({
          mode: 'quick',
          awayUserId: opponent.id,
          homeScore,
          awayScore,
          awayOverall: opponent.strength ?? null,
        }).then((res) => {
          if (!res) return;
          const outcome: 'win' | 'draw' | 'loss' =
            res.outcome === 'home_win' ? 'win' : res.outcome === 'draw' ? 'draw' : 'loss';
          if (res.homeExpReward > 0) {
            dispatch({
              type: 'WALLET_RECEIVE_PVP_REWARD',
              amount: res.homeExpReward,
              mode: 'quick',
              outcome,
              opponentLabel,
            });
          }
        });
      }
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
    const name = pp?.name ?? pEnt?.name ?? L('Jogador', 'Player');
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

  const [shareState, setShareState] = useState<'idle' | 'done'>('idle');

  if (!live) return null;

  const homeScore = live.homeScore ?? 0;
  const awayScore = live.awayScore ?? 0;
  const homeWin = homeScore > awayScore;
  const draw = homeScore === awayScore;
  const resultLabel = homeWin ? L('Vitória.', 'Win.') : draw ? L('Empate.', 'Draw.') : L('Derrota.', 'Loss.');
  const resultado: ResultadoTipo = homeWin ? 'win' : draw ? 'draw' : 'loss';

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
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-6"
      >
        <Hashtag className="font-prova text-mudo">{L('#posjogo', '#postmatch')}</Hashtag>

        {/* O RESULTADO (DS 2027, PDF pág. 6): spray, voz, MVP em post-it, fita. */}
        <ResultadoRua
          homeName={clubName}
          awayName={live.awayShort ?? L('Visitante', 'Away')}
          homeScore={homeScore}
          awayScore={awayScore}
          resultado={resultado}
          rotuloDir={`${live.homeShort} × ${live.awayShort} · ${Math.max(90, live.minute ?? 0)}′`}
          mvp={mvp ? { name: mvp.name, rating: mvp.rating } : null}
        />

        {/* MVP — os números do craque */}
        <section className="bg-concreto px-5 py-4">
          <SecaoRua label={L('Prêmio MVP', 'MVP award')} className="mb-3" />
          {mvp ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-voz text-[30px] leading-none text-papel">{mvp.name}</p>
                <p className="mt-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.14em] text-mudo">
                  {mvp.pos} · {L('nota', 'rating')}{' '}
                  <span className="ole-attr text-base" data-tier={ratingTier(mvp.rating)}>
                    {mvp.rating.toFixed(1)}
                  </span>
                </p>
              </div>
              <div className="grid grid-cols-3 gap-px bg-linha text-center">
                <MvpNum valor={String(mvp.stats.shotsOn)} tier={attrTier(mvp.stats.shotsOn * 20)} label={L('No alvo', 'On target')} />
                <MvpNum valor={String(mvp.stats.tackles)} tier={attrTier(mvp.stats.tackles * 15)} label={L('Desarmes', 'Tackles')} />
                <MvpNum
                  valor={`${mvp.stats.passesOk}/${mvp.stats.passesAttempt || '—'}`}
                  tier={mvp.stats.passesAttempt > 0 ? attrTier((mvp.stats.passesOk / mvp.stats.passesAttempt) * 100) : 'avg'}
                  label="Passes"
                />
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-mudo">{L('Sem dados suficientes para eleger o MVP.', 'Not enough data to pick the MVP.')}</p>
          )}
        </section>

        {/* Estatísticas do time */}
        <section>
          <SecaoRua label={L('Estatísticas do time', 'Team stats')} className="mb-3" />
          <div className="grid grid-cols-2 gap-px bg-linha sm:grid-cols-4">
            <StatTile label={L('Passes certos', 'Passes completed')} value={teamStats.passesOk.toString()} />
            <StatTile
              label={L('Passes errados', 'Passes missed')}
              value={(teamStats.passesAttempt - teamStats.passesOk).toString()}
              sub={passAcc}
            />
            <StatTile label={L('Chutes no alvo', 'Shots on target')} value={teamStats.shotsOn.toString()} sub={`${shotsTotal} total`} />
            <StatTile label={L('Chutes pra fora', 'Shots off target')} value={teamStats.shotsOff.toString()} />
            <StatTile label={L('Desarmes', 'Tackles')} value={teamStats.tackles.toString()} />
            <StatTile label={L('Defesas (GK)', 'Saves (GK)')} value={teamStats.saves.toString()} />
            <StatTile label={L('Dribles certos', 'Dribbles completed')} value={teamStats.dribblesOk.toString()} />
            <StatTile label={L('Gols', 'Goals')} value={homeScore.toString()} highlight />
          </div>
        </section>

        {voiceStats.total > 0 ? (
          <section className="border-l-[3px] border-papel bg-concreto px-5 py-4">
            <header className="mb-3 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-papel" aria-hidden />
              <h2 className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">
                {L('Comandos de voz', 'Voice commands')}
              </h2>
            </header>
            <div className="grid grid-cols-3 gap-px bg-linha">
              <StatTile label={L('Emitidos', 'Issued')} value={voiceStats.total.toString()} />
              <StatTile label={L('Aceitos', 'Accepted')} value={voiceStats.accepted.toString()} />
              <StatTile label={L('Recusados', 'Refused')} value={voiceStats.refused.toString()} />
            </div>
          </section>
        ) : null}

        {/* CTA */}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row-reverse sm:items-center sm:justify-start">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex min-h-[54px] items-center justify-center gap-2 bg-rua px-7 font-impact text-[20px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--color-papel)]"
          >
            {L('Continuar', 'Continue')}
            <ArrowRight className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          </button>
          <button
            type="button"
            onClick={async () => {
              const origin = typeof window !== 'undefined' ? window.location.origin : 'https://game.olefoot.ai';
              const text = emIngles()
                ? `${resultLabel} ${clubName} ${homeScore}×${awayScore} ${live.awayShort ?? ''} — on Olefoot. Build your team and join: ${origin}`
                : `${resultLabel} ${clubName} ${homeScore}×${awayScore} ${live.awayShort ?? ''} — no Olefoot. Monta teu time e vem: ${origin}`;
              try {
                if (navigator.share) await navigator.share({ text });
                else await navigator.clipboard?.writeText(text);
                setShareState('done');
                setTimeout(() => setShareState('idle'), 2200);
              } catch { /* usuário cancelou o share — sem ação */ }
            }}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 border-2 border-papel px-6 font-impact text-[18px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27"
          >
            {shareState === 'done' ? <><Check className="h-4 w-4" aria-hidden /> {L('Copiado', 'Copied')}</> : <><Share2 className="h-4 w-4" aria-hidden /> {L('Compartilhar', 'Share')}</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function MvpNum({ valor, tier, label }: { valor: string; tier: 'elite' | 'good' | 'avg' | 'weak'; label: string }) {
  return (
    <div className="min-w-[5.5rem] bg-asfalto-27 px-2 py-2.5">
      <p className="ole-attr text-2xl" data-tier={tier}>
        {valor}
      </p>
      <p className="mt-1 font-prova text-[9.5px] font-bold uppercase tracking-[0.12em] text-mudo">{label}</p>
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
    <div className="bg-concreto px-3 py-3 text-center">
      <p className={`font-spray font-black text-[34px] leading-none tabular-nums ${highlight ? 'text-rua' : 'text-papel'}`}>
        {value}
      </p>
      <p className="mt-1.5 font-prova text-[9.5px] font-bold uppercase tracking-[0.12em] text-mudo">{label}</p>
      {sub ? <p className="mt-0.5 font-prova text-[10px] text-fio">{sub}</p> : null}
    </div>
  );
}
