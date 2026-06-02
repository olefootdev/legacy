/**
 * /liga-global/coroas — Hall da Fama das Coroas do Dia
 *
 * • Ranking de coroas da temporada (season_crowns dos times) — mais coroas é
 *   um título paralelo ao campeão de divisão no fim da season.
 * • Histórico de campeões diários (tabela daily_crowns).
 */

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Crown, ArrowLeft, Medal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { loadRecentCrowns } from '@/supabase/globalLeague';
import type { DailyCrown } from '@/match/globalLeagueMVP';

export default function GlobalLeagueCrowns() {
  const navigate = useNavigate();
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const club = useGameStore((s) => s.club);
  const managerId = managerProfile?.email ?? club?.id;

  const [crowns, setCrowns] = useState<DailyCrown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadRecentCrowns(60).then((c) => {
      if (!cancelled) { setCrowns(c); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  // Ranking de coroas da temporada
  const crownLeaders = useMemo(() => {
    const teams = globalLeagueMVP?.teams ?? [];
    return [...teams]
      .filter((t) => (t.seasonCrowns ?? 0) > 0)
      .sort((a, b) => (b.seasonCrowns ?? 0) - (a.seasonCrowns ?? 0) || (b.allTimeCrowns ?? 0) - (a.allTimeCrowns ?? 0))
      .slice(0, 20);
  }, [globalLeagueMVP]);

  return (
    <div className="mx-auto min-w-0 w-full max-w-4xl space-y-6 overflow-x-hidden px-3 sm:px-4 lg:px-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 pt-4">
        <button
          type="button"
          onClick={() => navigate('/competicao')}
          className="text-text-soft hover:text-white transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-neon-yellow">Liga Global</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wider text-white">
            Hall das Coroas
          </h1>
        </div>
      </div>
      <div className="h-1 w-24 bg-neon-yellow rounded-full" />

      {/* Ranking de coroas da temporada */}
      <section className="sports-panel rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-neon-yellow/15 to-transparent border-b border-neon-yellow/30">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider text-white">Coroas da Temporada</h2>
          <p className="text-xs font-mono text-text-soft mt-0.5">mais coroas no fim da season = título paralelo</p>
        </div>
        {crownLeaders.length === 0 ? (
          <p className="text-center text-text-soft py-8 px-4">Nenhuma coroa conquistada nesta temporada ainda.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {crownLeaders.map((t, i) => {
              const isMe = !!managerId && t.managerId === managerId;
              return (
                <div
                  key={t.id}
                  className={`flex items-center gap-3 px-4 py-2.5 ${isMe ? 'bg-neon-yellow/10 border-l-4 border-neon-yellow' : 'border-l-4 border-transparent'}`}
                >
                  <span className="w-6 text-center font-mono font-bold text-text-soft">{i + 1}</span>
                  {i === 0 ? <Medal className="w-4 h-4 text-neon-yellow" /> : <span className="w-4" />}
                  <span className="flex-1 text-sm font-bold text-white truncate">
                    {t.clubName}
                    {isMe && <span className="ml-2 text-[10px] font-mono text-neon-yellow">você</span>}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-neon-yellow font-bold">
                    <Crown className="w-4 h-4" />{t.seasonCrowns ?? 0}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Histórico de campeões diários */}
      <section>
        <h2 className="font-display text-lg font-bold uppercase tracking-wider text-white mb-3">Campeões por Dia</h2>
        {loading ? (
          <p className="text-center text-text-soft py-8">Carregando…</p>
        ) : crowns.length === 0 ? (
          <p className="text-center text-text-soft py-8">Nenhum campeão diário registrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {crowns.map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="sports-panel rounded-md p-3 flex items-center gap-3"
              >
                <Crown className="w-5 h-5 text-neon-yellow shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{c.clubName}</p>
                  <p className="text-[11px] font-mono text-text-soft">
                    {c.dailyDate}
                    {c.runnerUpClubName && ` • venceu ${c.runnerUpClubName}`}
                    {c.finalWentToPens && ' (pênaltis)'}
                  </p>
                </div>
                <span className="text-[11px] font-mono text-text-soft shrink-0">bracket {c.bracketSize}</span>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
