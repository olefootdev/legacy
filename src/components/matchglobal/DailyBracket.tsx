/**
 * DailyBracket — visualização do mata-mata diário (rounds daily_ko).
 *
 * Renderiza uma coluna por fase (Oitavas → Final), cada confronto com placar
 * e, se houve disputa, o placar de pênaltis. O vencedor de cada jogo é
 * destacado. O time do manager (myTeamId) recebe realce dourado.
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import type { DailyKnockoutRound } from '@/match/globalLeagueMVP';
import type { GlobalFixture } from '@/match/globalMatch';

function roundLabel(size: number): string {
  switch (size) {
    case 2: return 'Final';
    case 4: return 'Semifinal';
    case 8: return 'Quartas';
    case 16: return 'Oitavas';
    case 32: return 'Fase de 32';
    default: return `Fase de ${size}`;
  }
}

function fmtMs(ms: number): string {
  if (ms <= 0) return 'já';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h${m % 60}m`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

function fixtureWinner(fx: GlobalFixture): 'home' | 'away' | null {
  if (fx.status !== 'finished') return null;
  if (fx.scoreHome !== fx.scoreAway) return fx.scoreHome > fx.scoreAway ? 'home' : 'away';
  if (fx.wentToPenalties && fx.penaltyScoreHome != null && fx.penaltyScoreAway != null) {
    return fx.penaltyScoreHome > fx.penaltyScoreAway ? 'home' : 'away';
  }
  return null;
}

interface DailyBracketProps {
  bracket: DailyKnockoutRound[];
  myTeamId?: string | null;
}

export function DailyBracket({ bracket, myTeamId }: DailyBracketProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (bracket.length === 0) {
    return (
      <p className="text-center text-text-soft py-8">
        Bracket ainda não gerado. O mata-mata começa às 19h.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-4 min-w-max">
        {bracket.map((round) => {
          const myAlive = !!myTeamId && round.fixtures.some(
            (fx) => fx.homeTeamId === myTeamId || fx.awayTeamId === myTeamId,
          );
          const msToKick = round.scheduledKickoffMs - now;
          return (
          <div key={round.id} className="flex flex-col gap-3 min-w-[220px]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-neon-yellow">
                  {roundLabel(round.size)}
                </h3>
                {myAlive && round.status !== 'finished' && (
                  <span className="font-display text-[9px] font-bold uppercase tracking-wider text-neon-green">
                    você está aqui
                  </span>
                )}
              </div>
              {round.status === 'live' && (
                <span className="text-[10px] font-mono text-neon-green animate-pulse">● ao vivo</span>
              )}
              {round.status === 'scheduled' && msToKick > 0 && (
                <span className="text-[10px] font-mono text-text-soft">em {fmtMs(msToKick)}</span>
              )}
              {round.status === 'scheduled' && msToKick <= 0 && (
                <span className="text-[10px] font-mono text-neon-yellow">iniciando…</span>
              )}
              {round.status === 'finished' && (
                <span className="text-[10px] font-mono text-text-soft">encerrada</span>
              )}
            </div>

            <div className="flex flex-col justify-around gap-3 flex-1">
              {round.fixtures.map((fx, i) => {
                const winner = fixtureWinner(fx);
                const rows: Array<{ side: 'home' | 'away'; name: string; id: string; score: number; pen?: number }> = [
                  { side: 'home', name: fx.homeTeamName, id: fx.homeTeamId, score: fx.scoreHome, pen: fx.penaltyScoreHome },
                  { side: 'away', name: fx.awayTeamName, id: fx.awayTeamId, score: fx.scoreAway, pen: fx.penaltyScoreAway },
                ];
                return (
                  <motion.div
                    key={fx.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="sports-panel rounded-md overflow-hidden text-sm"
                  >
                    {rows.map((r) => {
                      const isWinner = winner === r.side;
                      const isMe = !!myTeamId && r.id === myTeamId;
                      return (
                        <div
                          key={r.side}
                          className={`flex items-center justify-between px-3 py-2 ${
                            isWinner ? 'bg-neon-green/10' : ''
                          } ${isMe ? 'border-l-4 border-neon-yellow' : 'border-l-4 border-transparent'}`}
                        >
                          <span className={`truncate ${isWinner ? 'font-bold text-white' : 'text-text-soft'}`}>
                            {r.name}
                          </span>
                          <span className="flex items-center gap-1.5 font-mono shrink-0">
                            {fx.wentToPenalties && r.pen != null && (
                              <span className="text-[10px] text-text-soft">({r.pen})</span>
                            )}
                            <span className={isWinner ? 'text-neon-green font-bold' : 'text-text-soft'}>
                              {fx.status === 'finished' ? r.score : '–'}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </motion.div>
                );
              })}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
