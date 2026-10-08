/**
 * DailyBracket — visualização do mata-mata diário (rounds daily_ko).
 *
 * Renderiza uma coluna por fase (Oitavas → Final), cada confronto com placar
 * e, se houve disputa, o placar de pênaltis. O vencedor de cada jogo é
 * destacado. O time do manager (myTeamId) recebe realce dourado.
 */

import { L } from '@/i18n/L';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Crown, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyKnockoutRound } from '@/match/globalLeagueMVP';
import type { GlobalFixture } from '@/match/globalMatch';

function roundLabel(size: number): string {
  switch (size) {
    case 2: return 'Final';
    case 4: return L('Semifinal', 'Semi-final');
    case 8: return L('Quartas', 'Quarters');
    case 16: return L('Oitavas', 'Last 16');
    case 32: return L('Fase de 32', 'Last 32');
    default: return L(`Fase de ${size}`, `Last ${size}`);
  }
}

function fmtMs(ms: number): string {
  if (ms <= 0) return L('já', 'now');
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
  /** Nome do clube campeão — coroa o vencedor da Final. */
  championName?: string;
}

export function DailyBracket({ bracket, myTeamId, championName }: DailyBracketProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (bracket.length === 0) {
    return (
      <div className="border-2 border-dashed border-fio px-4 py-6">
        <p className="font-voz text-[22px] leading-[1.05] text-suave">
          {L('Chave ainda não saiu. O mata-mata começa às 19h.', 'Bracket not out yet. The knockout starts at 7pm.')}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-4">
        {bracket.map((round) => {
          const myAlive = !!myTeamId && round.fixtures.some(
            (fx) => fx.homeTeamId === myTeamId || fx.awayTeamId === myTeamId,
          );
          const msToKick = round.scheduledKickoffMs - now;
          const isFinal = round.size === 2;
          return (
          <div key={round.id} className="flex min-w-[224px] flex-col gap-3">
            <div className="flex items-end justify-between gap-2 border-b-2 border-linha pb-2">
              <div className="flex items-center gap-1.5">
                {isFinal && <Trophy className="h-4 w-4 text-ouro-27" strokeWidth={2.2} aria-hidden />}
                <div className="flex flex-col">
                  <h3 className={cn('font-impact text-[20px] uppercase leading-none', isFinal ? 'text-ouro-27' : 'text-papel')}>
                    {roundLabel(round.size)}
                  </h3>
                  {myAlive && round.status !== 'finished' && (
                    <span className="font-prova text-[10px] font-bold uppercase tracking-[0.12em] text-rua">
                      {L('tu tá aqui', 'you are here')}
                    </span>
                  )}
                </div>
              </div>
              {round.status === 'live' && (
                <span className="bg-rua px-1.5 py-0.5 font-prova text-[10px] font-bold uppercase text-asfalto-27">● {L('ao vivo', 'live')}</span>
              )}
              {round.status === 'scheduled' && msToKick > 0 && (
                <span className="font-spray text-[16px] font-black text-suave">{L('em', 'in')} {fmtMs(msToKick)}</span>
              )}
              {round.status === 'scheduled' && msToKick <= 0 && (
                <span className="font-prova text-[10px] font-bold uppercase text-rua">{L('iniciando…', 'starting…')}</span>
              )}
              {round.status === 'finished' && (
                <span className="font-prova text-[10px] font-bold uppercase text-mudo">{L('encerrada', 'finished')}</span>
              )}
            </div>

            <div className="flex flex-1 flex-col justify-around gap-2">
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
                    className="flex flex-col gap-0.5 overflow-hidden"
                  >
                    {rows.map((r) => {
                      const isWinner = winner === r.side;
                      const isMe = !!myTeamId && r.id === myTeamId;
                      const isChampion = isFinal && isWinner && !!championName && r.name === championName;
                      return (
                        <div
                          key={r.side}
                          className={cn(
                            'flex min-h-[38px] items-center justify-between gap-2 px-3',
                            isChampion ? 'bg-ouro-27 text-asfalto-27' : isMe ? 'bg-rua text-asfalto-27' : 'bg-asfalto-27',
                          )}
                        >
                          <span
                            className={cn(
                              'flex min-w-0 items-center gap-1.5 truncate font-impact text-[15px] uppercase leading-none',
                              !isChampion && !isMe && (isWinner ? 'text-papel' : 'text-mudo'),
                            )}
                          >
                            {isChampion && <Crown className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} aria-hidden />}
                            <span className="truncate">{r.name}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {fx.wentToPenalties && r.pen != null && (
                              <span className={cn('font-prova text-[10px]', isChampion || isMe ? '' : 'text-mudo')}>({r.pen})</span>
                            )}
                            <span
                              className={cn(
                                'font-spray text-[20px] font-black leading-none',
                                !isChampion && !isMe && (isWinner ? 'text-rua' : 'text-mudo'),
                              )}
                            >
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
