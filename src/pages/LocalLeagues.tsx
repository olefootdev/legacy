/**
 * Página /ligas-locais — mostra Liga Classic e Fast Liga lado a lado.
 * Cada tab mostra:
 *   1. Suas estatísticas (placar acumulado)
 *   2. Top 50 do leaderboard (puxado do manager_game_state via Supabase)
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Zap, Layers } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { BackButton } from '@/components/BackButton';
import { SecaoRua } from '@/components/ui/Rua';
import { AbasRua, CabecalhoRua, FaltaRua, FormaRua, LinhaRua, VazioRua, posRua } from '@/components/leagues/RuaTabela';
import { L } from '@/i18n/L';
import {
  emptyLocalLeagueStanding,
  type LocalLeagueId,
  type LocalLeagueStanding,
} from '@/match/localLeagues';
import {
  fetchLocalLeagueLeaderboard,
  type LocalLeaderboardEntry,
} from '@/supabase/localLeaguesRanking';

const LEAGUE_META: Record<LocalLeagueId, { label: string; subtitle: string; icon: typeof Trophy }> = {
  classic: {
    label: L('Liga Classic', 'Classic League'),
    subtitle: L('Pontos somam toda vez que você joga uma partida CLASSIC (2D).', 'Points add up every time you play a CLASSIC (2D) match.'),
    icon: Layers,
  },
  fast: {
    label: L('Fast Liga', 'Fast League'),
    subtitle: L('Pontos somam toda vez que você joga uma partida RÁPIDA.', 'Points add up every time you play a QUICK match.'),
    icon: Zap,
  },
};

export default function LocalLeaguesPage() {
  const [tab, setTab] = useState<LocalLeagueId>('classic');
  const localLeagues = useGameStore((s) => s.localLeagues);
  const myClubName = useGameStore((s) => s.club?.name);
  const myStanding: LocalLeagueStanding = useMemo(
    () => localLeagues?.[tab] ?? emptyLocalLeagueStanding(),
    [localLeagues, tab],
  );

  const [leaderboard, setLeaderboard] = useState<LocalLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLocalLeagueLeaderboard(tab, 50)
      .then((rows) => { if (!cancelled) setLeaderboard(rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab]);

  const meta = LEAGUE_META[tab];
  const myIdx = leaderboard.findIndex((r) => !!r.clubName && r.clubName === myClubName);
  const gapAbove = myIdx > 0 ? Math.max(0, leaderboard[myIdx - 1].points - leaderboard[myIdx].points) : null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-8 overflow-x-hidden px-3 pb-10 sm:px-4">
      <BackButton to="/competicao" label={L('Competição', 'Competition')} />

      <CabecalhoRua rotulo="#ligaslocais" titulo={L('Ligas locais', 'Local leagues')} voz={meta.subtitle} aside={meta.label} />

      <AbasRua
        ariaLabel={L('Ligas locais', 'Local leagues')}
        ativa={tab}
        onChange={setTab}
        abas={(['classic', 'fast'] as const).map((id) => {
          const m = LEAGUE_META[id];
          const TabIcon = m.icon;
          return {
            id,
            label: (
              <span className="inline-flex items-center gap-2">
                <TabIcon aria-hidden className="h-4 w-4" />
                {m.label}
              </span>
            ),
          };
        })}
      />

      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        {/* Meu placar acumulado */}
        <div className="rua-grao flex flex-col gap-4 border-l-[5px] border-rua bg-concreto p-4 sm:p-5">
          <SecaoRua label={L('Meu placar acumulado', 'My cumulative record')} />
          <div className="grid grid-cols-4 gap-1.5">
            <Stat label={L('Jogos', 'Played')} value={myStanding.played} />
            <Stat label={L('Pontos', 'Points')} value={myStanding.points} highlight />
            <Stat label={L('V/E/D', 'W/D/L')} value={`${myStanding.wins}/${myStanding.draws}/${myStanding.losses}`} small />
            <Stat label={L('Saldo', 'GD')} value={myStanding.goalsFor - myStanding.goalsAgainst} />
          </div>
          {myStanding.recentForm.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">{L('Forma', 'Form')}</span>
              <FormaRua form={myStanding.recentForm} />
            </div>
          )}
        </div>

        {gapAbove != null && (
          <FaltaRua
            valor={gapAbove}
            unidade={L('pts', 'pts')}
            frase={L(`é o que separa tu do ${posRua(myIdx)}.`, `is all that's between you and ${posRua(myIdx)}.`)}
          />
        )}

        {/* Leaderboard */}
        <div className="flex flex-col gap-3">
          <SecaoRua label="Top 50 managers" aside={leaderboard.length > 0 ? leaderboard.length : undefined} />
          {loading && <p className="font-prova text-[12px] uppercase tracking-[0.14em] text-mudo">{L('Carregando ranking…', 'Loading ranking…')}</p>}
          {!loading && leaderboard.length === 0 && (
            <VazioRua titulo={L('Ranking vazio', 'Empty ranking')} frase={L('Joga e estreia no topo.', 'Play and debut at the top.')} />
          )}
          {!loading && leaderboard.length > 0 && (
            <div className="flex flex-col gap-1.5">
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
      </motion.div>
    </div>
  );
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
