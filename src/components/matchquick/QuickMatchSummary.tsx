/**
 * QuickMatchSummary — Tela de resultado final cinematográfica.
 *
 * Padrão visual:
 * - Resultado gigante em Moret italic (vitória amarelo, empate branco, derrota vermelho)
 * - Placar final com tipografia display
 * - Feed de eventos-chave em timeline vertical
 * - Botões de ação (Ver postgame, Nova partida, Home)
 */

import { motion } from 'motion/react';
import { Home, RotateCcw, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface QuickMatchSummaryProps {
  homeShort: string;
  awayShort: string;
  homeName?: string;
  awayName?: string;
  homeScore: number;
  awayScore: number;
  /** Eventos-chave para mostrar na timeline */
  events: { id: string; text: string }[];
  onNewMatch: () => void;
}

export function QuickMatchSummary({
  homeShort,
  awayShort,
  homeName,
  awayName,
  homeScore,
  awayScore,
  events,
  onNewMatch,
}: QuickMatchSummaryProps) {
  const isWin = homeScore > awayScore;
  const isDraw = homeScore === awayScore;
  const isLoss = homeScore < awayScore;

  const resultLabel = isWin ? 'Vitória' : isDraw ? 'Empate' : 'Derrota';
  const resultColor = isWin ? 'text-neon-yellow' : isDraw ? 'text-white' : 'text-red-400';
  const resultBg = isWin ? 'bg-neon-yellow/10' : isDraw ? 'bg-white/5' : 'bg-red-500/10';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] bg-deep-black overflow-y-auto overscroll-contain"
    >
      <div className="min-h-full flex flex-col items-center justify-center px-4 py-12 gap-8 sm:gap-12">
        {/* Resultado principal */}
        <div className="w-full max-w-3xl space-y-6">
          {/* Eyebrow */}
          <div className="flex items-center justify-center gap-3">
            <span aria-hidden className="h-px w-12 bg-white/20" />
            <span
              className="text-white/55 uppercase tracking-[0.35em] text-[10px] font-medium"
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              Final
            </span>
            <span aria-hidden className="h-px w-12 bg-white/20" />
          </div>

          {/* Resultado em destaque — Moret italic gigante */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className={cn('text-center py-6 sm:py-8', resultBg)}
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            <p
              className={cn('italic leading-none', resultColor)}
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontWeight: 700,
                fontSize: 'clamp(3rem, 8vw, 6rem)',
                letterSpacing: '-0.02em',
              }}
            >
              {resultLabel}
            </p>
          </motion.div>

          {/* Placar final */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex items-center justify-center gap-4 sm:gap-8"
          >
            {/* Casa */}
            <div className="flex flex-col items-end gap-2">
              <p
                className="text-white/55 uppercase font-display font-bold tracking-wider truncate max-w-[120px] sm:max-w-none"
                style={{
                  fontSize: 'clamp(11px, 1.5vw, 14px)',
                  letterSpacing: '0.18em',
                }}
              >
                {homeName ?? homeShort}
              </p>
              <span
                className={cn('leading-none tabular-nums', isWin ? 'text-neon-yellow' : 'text-white')}
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontSize: 'clamp(56px, 12vw, 96px)',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                }}
              >
                {homeScore}
              </span>
            </div>

            {/* Separador */}
            <span
              className="leading-none text-white/35 select-none"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontStyle: 'italic',
                fontSize: 'clamp(32px, 6vw, 48px)',
              }}
            >
              –
            </span>

            {/* Visitante */}
            <div className="flex flex-col items-start gap-2">
              <p
                className="text-white/55 uppercase font-display font-bold tracking-wider truncate max-w-[120px] sm:max-w-none"
                style={{
                  fontSize: 'clamp(11px, 1.5vw, 14px)',
                  letterSpacing: '0.18em',
                }}
              >
                {awayName ?? awayShort}
              </p>
              <span
                className={cn('leading-none tabular-nums', isLoss ? 'text-red-400' : 'text-white')}
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontSize: 'clamp(56px, 12vw, 96px)',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                }}
              >
                {awayScore}
              </span>
            </div>
          </motion.div>
        </div>

        {/* Timeline de eventos-chave (últimos 8) */}
        {events.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="w-full max-w-2xl space-y-3"
          >
            <div className="flex items-center gap-3 px-0.5 mb-4">
              <span aria-hidden className="shrink-0 w-[3px] h-6 bg-white/40" />
              <p
                className="text-white/70 uppercase font-bold tracking-wider"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '11px',
                  letterSpacing: '0.18em',
                }}
              >
                Momentos-chave
              </p>
            </div>

            <div className="space-y-2 max-h-[240px] overflow-y-auto overscroll-contain hide-scrollbar">
              {events.slice(0, 8).map((ev, i) => (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.05, duration: 0.25 }}
                  className="px-3 py-2 bg-[var(--color-card)] border border-white/8"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                >
                  <p
                    className="text-white/75 leading-relaxed text-sm"
                    style={{ fontFamily: 'var(--font-sans)' }}
                  >
                    {ev.text}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Ações */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="flex flex-wrap justify-center gap-3"
        >
          <Link
            to="/postgame"
            className="inline-flex items-center gap-2 bg-neon-yellow text-black px-5 py-3 hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <Trophy className="w-4 h-4" />
            Ver postgame
          </Link>

          <button
            type="button"
            onClick={onNewMatch}
            className="inline-flex items-center gap-2 bg-deep-black border border-white/15 text-white px-5 py-3 hover:border-neon-yellow hover:text-neon-yellow hover:scale-[1.02] active:scale-[0.98] transition-all"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <RotateCcw className="w-4 h-4" />
            Nova partida
          </button>

          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-deep-black border border-white/15 text-white px-5 py-3 hover:border-neon-yellow hover:text-neon-yellow hover:scale-[1.02] active:scale-[0.98] transition-all"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
