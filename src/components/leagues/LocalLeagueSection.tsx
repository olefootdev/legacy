/**
 * Bloco inline da Liga Classic ou Fast Liga — exibe placar acumulado do
 * manager + Top 50 leaderboard. Usado em /competicao/ligas como conteúdo
 * principal das tabs "Liga Classic" / "Fast Liga".
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useGameStore } from '@/game/store';
import { BotaoRua, SecaoRua } from '@/components/ui/Rua';
import { L } from '@/i18n/L';
import { FaltaRua, FormaRua, LinhaRua, VazioRua, posRua } from './RuaTabela';
import {
  emptyLocalLeagueStanding,
  type LocalLeagueId,
  type LocalLeagueStanding,
} from '@/match/localLeagues';
import {
  fetchLocalLeagueLeaderboard,
  type LocalLeaderboardEntry,
} from '@/supabase/localLeaguesRanking';

const META: Record<LocalLeagueId, { title: string; subtitle: string; ctaLabel: string }> = {
  classic: {
    title: L('LIGA CLASSIC', 'CLASSIC LEAGUE'),
    subtitle: L('Pontos somam toda partida CLASSIC (2D tático).', 'Points add up every CLASSIC match (tactical 2D).'),
    ctaLabel: L('Jogar Classic', 'Play Classic'),
  },
  fast: {
    title: L('FAST LIGA', 'FAST LEAGUE'),
    subtitle: L('Pontos somam toda partida RÁPIDA.', 'Points add up every QUICK match.'),
    ctaLabel: L('Jogar Rápida', 'Play Quick'),
  },
};

interface Props {
  league: LocalLeagueId;
}

export function LocalLeagueSection({ league }: Props) {
  const localLeagues = useGameStore((s) => s.localLeagues);
  const myClubName = useGameStore((s) => s.club?.name);
  const myStanding: LocalLeagueStanding = useMemo(
    () => localLeagues?.[league] ?? emptyLocalLeagueStanding(),
    [localLeagues, league],
  );

  const [leaderboard, setLeaderboard] = useState<LocalLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLocalLeagueLeaderboard(league, 50)
      .then((rows) => { if (!cancelled) setLeaderboard(rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [league]);

  const meta = META[league];
  // 2026-05-27: Classic em "Em breve" — desativa CTA e redireciona pra Quick.
  const isClassicSoon = league === 'classic';
  const ctaHref = isClassicSoon ? '/match/quick' : '/match/quick';
  const ctaLabel = isClassicSoon ? L('Em breve', 'Coming soon') : meta.ctaLabel;

  // DS 2027: "quanto falta" — distância real até a linha de cima no Top 50.
  const myIdx = leaderboard.findIndex((r) => !!r.clubName && r.clubName === myClubName);
  const gapAbove = myIdx > 0 ? Math.max(0, leaderboard[myIdx - 1].points - leaderboard[myIdx].points) : null;

  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex min-w-0 flex-col gap-6">
      {/* Cabeçalho + meu placar acumulado em concreto com grão */}
      <div className="rua-grao flex min-w-0 flex-col gap-4 bg-concreto p-5 sm:p-7">
        <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.2em] text-mudo">
          {L('#ligalocal · cumulativa', '#localleague · cumulative')}
        </span>
        <h2 className="flex min-w-0 flex-col">
          <span className="truncate font-impact uppercase leading-[0.86] text-papel" style={{ fontSize: 'clamp(40px, 11vw, 72px)' }}>
            {meta.title}
          </span>
          <span className="font-spray font-black uppercase leading-[0.9] text-rua" style={{ fontSize: 'clamp(34px, 10vw, 60px)' }}>
            {myStanding.points} {myStanding.points === 1 ? L('ponto', 'point') : L('pontos', 'points')}
          </span>
        </h2>
        <p className="font-voz text-[22px] leading-[1.05] text-suave">{meta.subtitle}</p>

        <div className="grid grid-cols-4 gap-1.5">
          <Stat label={L('Jogos', 'Played')} value={myStanding.played} />
          <Stat label={L('Pontos', 'Points')} value={myStanding.points} highlight />
          <Stat label={L('V/E/D', 'W/D/L')} value={`${myStanding.wins}/${myStanding.draws}/${myStanding.losses}`} small />
          <Stat label={L('Saldo', 'GD')} value={fmtDiff(myStanding.goalsFor - myStanding.goalsAgainst)} />
        </div>

        {myStanding.recentForm.length > 0 && (
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">{L('Forma', 'Form')}</span>
            <FormaRua form={myStanding.recentForm} />
            {myStanding.bestStreak > 0 && (
              <span className="ml-auto truncate font-prova text-[11px] font-bold uppercase tracking-[0.14em] text-mudo">
                {L('Melhor sequência', 'Best streak')}: {myStanding.bestStreak}{L('V', 'W')}
              </span>
            )}
          </div>
        )}

        {isClassicSoon ? (
          <BotaoRua variante="vazio" className="self-start" ariaLabel={ctaLabel}>
            {ctaLabel}
          </BotaoRua>
        ) : (
          <BotaoRua to={ctaHref} className="self-start">
            {ctaLabel} <span aria-hidden>→</span>
          </BotaoRua>
        )}
      </div>

      {gapAbove != null && (
        <FaltaRua
          valor={gapAbove}
          unidade={L('pts', 'pts')}
          frase={L(`é o que separa tu do ${posRua(myIdx)}.`, `is all that's between you and ${posRua(myIdx)}.`)}
        />
      )}

      {/* Top 50 leaderboard */}
      <div className="flex min-w-0 flex-col gap-3">
        <SecaoRua label="Top 50 managers" aside={leaderboard.length > 0 ? leaderboard.length : undefined} />
        {loading && (
          <p className="font-prova text-[12px] uppercase tracking-[0.14em] text-mudo">{L('Carregando ranking…', 'Loading ranking…')}</p>
        )}
        {!loading && leaderboard.length === 0 && (
          <VazioRua titulo={L('Ranking vazio', 'Empty ranking')} frase={L('Joga e estreia no topo.', 'Play and debut at the top.')} />
        )}
        {!loading && leaderboard.length > 0 && (
          <div className="flex max-h-[520px] flex-col gap-1.5 overflow-y-auto overflow-x-hidden px-1 py-1">
            {leaderboard.map((row, idx) => {
              const isMe = !!row.clubName && row.clubName === myClubName;
              return (
                <LinhaRua
                  key={row.userId}
                  pos={idx + 1}
                  tom={isMe ? 'eu' : idx === 0 ? 'lider' : myIdx >= 0 && idx > myIdx ? 'abaixo' : 'normal'}
                  nome={row.clubName ?? row.managerName ?? row.userId.slice(0, 8)}
                  sub={`${row.played}${L('j', 'p')} · ${L('SG', 'GD')} ${row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}`}
                  valor={row.points}
                />
              );
            })}
          </div>
        )}
      </div>
    </motion.section>
  );
}

function fmtDiff(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
}

function Stat({ label, value, highlight, small }: { label: string; value: number | string; highlight?: boolean; small?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-asfalto-27 px-2 py-2.5">
      <p className="truncate font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo">{label}</p>
      <p className={`truncate font-spray font-black leading-[0.9] ${small ? 'text-[22px]' : 'text-[30px]'} ${highlight ? 'text-rua' : 'text-papel'}`}>
        {value}
      </p>
    </div>
  );
}
