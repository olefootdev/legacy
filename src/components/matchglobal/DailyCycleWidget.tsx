/**
 * DailyCycleWidget — banner FIXO da Coroa do Dia na Home.
 *
 * Sempre visível (não esconde quando não há dados — vira convite). Aplica o
 * hero pattern editorial do Olefoot: BG neon-yellow + watermark gigante atrás
 * + hero text preto + divider + serif-hero italic. Adaptativo por fase:
 *
 *   • qualifying → CORRIDA DO DIA · meu rank + countdown 19h
 *   • knockout   → MATA-MATA · fase atual + status do meu time
 *   • crowned    → COROADO · campeão do dia
 *   • sem dados  → ENTRA NA CORRIDA · convite + countdown próxima janela
 *
 * Click leva pra /match/global (rota real, NÃO /liga-global/hoje).
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Crown, Clock, Swords, ChevronRight, Flag, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDailyCycle } from '@/hooks/useDailyCycle';

function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'agora';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function phaseLabel(size: number): string {
  switch (size) {
    case 2: return 'Final';
    case 4: return 'Semifinal';
    case 8: return 'Quartas';
    case 16: return 'Oitavas';
    case 32: return 'Fase de 32';
    default: return `Fase de ${size}`;
  }
}

export function DailyCycleWidget() {
  const navigate = useNavigate();
  const daily = useDailyCycle();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Banner FIXO: sempre renderiza, mesmo sem dados.
  const liveRound = daily.bracket.find((r) => r.status === 'live');
  const nextRound = daily.bracket.find((r) => r.status !== 'finished');

  // Watermark + título por fase
  const heroConfig = (() => {
    if (daily.phase === 'crowned' && daily.todayCrown) {
      return {
        watermark: 'COROA',
        kicker: 'Coroa do Dia',
        title: 'COROADO',
        subtitle: daily.todayCrown.clubName,
        Icon: Crown,
      };
    }
    if (daily.phase === 'knockout') {
      const r = liveRound ?? nextRound;
      return {
        watermark: 'KO',
        kicker: 'Coroa do Dia',
        title: 'MATA-MATA',
        subtitle: r ? phaseLabel(r.size) + (liveRound ? ' ao vivo' : ' aguardando') : 'em andamento',
        Icon: Swords,
      };
    }
    return {
      watermark: 'COROA',
      kicker: 'Coroa do Dia',
      title: 'CORRIDA',
      subtitle: 'Top ' + (daily.cutSize || 32) + ' às ' + daily.qualifyHour + 'h',
      Icon: Flag,
    };
  })();

  const Icon = heroConfig.Icon;

  return (
    <motion.button
      type="button"
      onClick={() => navigate('/match/global')}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', damping: 18, stiffness: 240 }}
      className="relative w-full overflow-hidden bg-neon-yellow rounded-sm text-left shadow-[0_4px_24px_rgba(255,220,0,0.12)] focus:outline-none focus:ring-2 focus:ring-neon-yellow/60"
    >
      {/* Watermark gigante atrás (hero pattern Olefoot) */}
      <div className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden" aria-hidden>
        <span
          className="font-display font-black uppercase whitespace-nowrap text-black/[0.06]"
          style={{ fontSize: 'clamp(80px, 18vw, 200px)', lineHeight: '0.85', letterSpacing: '-0.02em' }}
        >
          {heroConfig.watermark}
        </span>
      </div>

      {/* Conteúdo */}
      <div className="relative z-10 px-4 sm:px-5 py-4 sm:py-5 flex items-center gap-4">
        {/* Bloco esquerdo: kicker + title + subtitle */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <div className="shrink-0 rounded-sm bg-black/90 p-2 sm:p-2.5">
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-neon-yellow" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="font-display text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.3em] text-black/60">
              {heroConfig.kicker}
            </p>
            <h3 className="font-display text-xl sm:text-2xl font-black uppercase text-black leading-none tracking-tight">
              {heroConfig.title}
            </h3>
            <span aria-hidden className="block w-8 h-[2px] bg-black mt-1.5" />
            <p className="font-serif-hero italic text-sm sm:text-base text-black/80 mt-1.5 truncate">
              {heroConfig.subtitle}
            </p>
          </div>
        </div>

        {/* Bloco direito: contexto por fase */}
        <div className="shrink-0 hidden sm:flex items-center gap-3">
          {daily.phase === 'qualifying' && (
            <div className="flex flex-col items-end">
              {daily.myRank != null ? (
                <>
                  <p className="font-mono text-3xl font-black text-black leading-none">
                    {daily.myRank}<span className="text-base">º</span>
                  </p>
                  <p className="text-[10px] font-display uppercase tracking-wider text-black/60 mt-1">
                    {daily.inCut ? 'no top ' + daily.cutSize : daily.distanceToCut ? `${daily.distanceToCut} fora` : 'sem partidas'}
                  </p>
                </>
              ) : (
                <>
                  <Clock className="w-5 h-5 text-black/70 mb-1" />
                  <p className="font-mono text-sm font-bold text-black leading-none">
                    {fmtCountdown(daily.msToCut)}
                  </p>
                  <p className="text-[10px] font-display uppercase tracking-wider text-black/60 mt-1">
                    pro corte
                  </p>
                </>
              )}
            </div>
          )}

          {daily.phase === 'knockout' && nextRound && (
            <div className="flex flex-col items-end">
              {liveRound ? (
                <>
                  <span className="font-display text-[9px] font-bold uppercase tracking-[0.2em] text-black/60">ao vivo</span>
                  <p className="font-mono text-2xl font-black text-black leading-none animate-pulse">●</p>
                  <p className="text-[10px] font-display uppercase tracking-wider text-black/60 mt-1">
                    simulando
                  </p>
                </>
              ) : (
                <>
                  <Clock className="w-5 h-5 text-black/70 mb-1" />
                  <p className="font-mono text-base font-black text-black leading-none">
                    {fmtCountdown(Math.max(0, nextRound.scheduledKickoffMs - now))}
                  </p>
                  <p className="text-[10px] font-display uppercase tracking-wider text-black/60 mt-1">
                    próxima rodada
                  </p>
                </>
              )}
            </div>
          )}

          {daily.phase === 'crowned' && daily.todayCrown && (
            <div className="flex flex-col items-end">
              <Trophy className="w-6 h-6 text-black mb-1" />
              <p className="font-mono text-xs font-bold text-black leading-none">
                {daily.todayCrown.dailyDate}
              </p>
              <p className="text-[10px] font-display uppercase tracking-wider text-black/60 mt-1">
                campeão de hoje
              </p>
            </div>
          )}

          <ChevronRight className="w-6 h-6 text-black/80" />
        </div>

        {/* Mobile: só seta */}
        <div className="sm:hidden shrink-0">
          <ChevronRight className="w-5 h-5 text-black/80" />
        </div>
      </div>

      {/* Mobile: contexto embaixo, em barra preta */}
      <div className="relative z-10 sm:hidden bg-black/90 px-4 py-2 flex items-center justify-between">
        {daily.phase === 'qualifying' && (
          <>
            <span className="text-[10px] font-display uppercase tracking-wider text-white/60">
              {daily.myRank != null ? `Você em ${daily.myRank}º` : 'Jogue 1 partida'}
            </span>
            <span className="font-mono text-sm font-bold text-neon-yellow">
              {fmtCountdown(daily.msToCut)}
            </span>
          </>
        )}
        {daily.phase === 'knockout' && nextRound && (
          <>
            <span className="text-[10px] font-display uppercase tracking-wider text-white/60">
              {liveRound ? phaseLabel(liveRound.size) + ' ao vivo' : 'Próxima rodada em'}
            </span>
            <span className="font-mono text-sm font-bold text-neon-yellow">
              {liveRound ? '● agora' : fmtCountdown(Math.max(0, nextRound.scheduledKickoffMs - now))}
            </span>
          </>
        )}
        {daily.phase === 'crowned' && daily.todayCrown && (
          <>
            <span className="text-[10px] font-display uppercase tracking-wider text-white/60">
              Campeão · {daily.todayCrown.dailyDate}
            </span>
            <span className="font-display text-sm font-bold uppercase text-neon-yellow truncate ml-2">
              {daily.todayCrown.clubShort}
            </span>
          </>
        )}
      </div>
    </motion.button>
  );
}
