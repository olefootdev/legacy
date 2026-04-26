/**
 * QuickMatchHalftime — Painel de intervalo cinematográfico.
 *
 * Padrão visual:
 * - Eyebrow "INTERVALO" com traços laterais
 * - Placar parcial em Moret italic
 * - Stats do 1º tempo em grid (Agency FB bold)
 * - Botão "Retomar" amarelo primário
 * - Countdown automático (15s)
 */

import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';

interface QuickMatchHalftimeProps {
  homeShort: string;
  awayShort: string;
  homeScore: number;
  awayScore: number;
  /** Stats do 1º tempo */
  stats?: { label: string; homeValue: string; awayValue: string }[];
  /** Countdown em segundos */
  countdown: number;
  /** Callback para forçar fim do intervalo */
  onForceEnd: () => void;
}

export function QuickMatchHalftime({
  homeShort,
  awayShort,
  homeScore,
  awayScore,
  stats = [],
  countdown,
  onForceEnd,
}: QuickMatchHalftimeProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-deep-black/95 backdrop-blur-md px-4"
    >
      <div className="w-full max-w-2xl space-y-6 sm:space-y-8">
        {/* Eyebrow */}
        <div className="flex items-center justify-center gap-3">
          <span aria-hidden className="h-px w-12 bg-neon-yellow/40" />
          <span
            className="text-neon-yellow uppercase tracking-[0.35em] text-[11px] font-medium"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            Intervalo
          </span>
          <span aria-hidden className="h-px w-12 bg-neon-yellow/40" />
        </div>

        {/* Placar parcial */}
        <div className="flex items-center justify-center gap-4 sm:gap-8">
          {/* Casa */}
          <div className="flex flex-col items-end gap-2">
            <p
              className="text-white/55 uppercase font-display font-bold tracking-wider"
              style={{
                fontSize: 'clamp(11px, 1.5vw, 14px)',
                letterSpacing: '0.18em',
              }}
            >
              {homeShort}
            </p>
            <span
              className="leading-none text-neon-yellow tabular-nums"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontStyle: 'italic',
                fontSize: 'clamp(48px, 10vw, 80px)',
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
              fontSize: 'clamp(28px, 5vw, 40px)',
            }}
          >
            –
          </span>

          {/* Visitante */}
          <div className="flex flex-col items-start gap-2">
            <p
              className="text-white/55 uppercase font-display font-bold tracking-wider"
              style={{
                fontSize: 'clamp(11px, 1.5vw, 14px)',
                letterSpacing: '0.18em',
              }}
            >
              {awayShort}
            </p>
            <span
              className="leading-none text-white tabular-nums"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontStyle: 'italic',
                fontSize: 'clamp(48px, 10vw, 80px)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
              }}
            >
              {awayScore}
            </span>
          </div>
        </div>

        {/* Stats do 1º tempo */}
        {stats.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="border border-white/10 bg-black/60 px-3 py-3 text-center backdrop-blur-sm sm:px-4 sm:py-4"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <p
                  className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.18em] text-white/45 sm:text-[10px]"
                  style={{ fontFamily: 'var(--font-ui)' }}
                >
                  {s.label}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <span
                    className="font-display font-black leading-none tabular-nums text-neon-yellow"
                    style={{ fontSize: 'clamp(18px, 3vw, 24px)' }}
                  >
                    {s.homeValue}
                  </span>
                  <span className="text-xs text-white/25">×</span>
                  <span
                    className="font-display font-black leading-none tabular-nums text-white"
                    style={{ fontSize: 'clamp(18px, 3vw, 24px)' }}
                  >
                    {s.awayValue}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Botão retomar + countdown */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onForceEnd}
            className="inline-flex items-center gap-2 border border-neon-yellow/40 bg-gradient-to-br from-neon-yellow via-neon-yellow/95 to-neon-yellow/90 px-6 py-3 text-black shadow-[0_0_20px_rgba(253,224,71,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(253,224,71,0.5)] active:scale-[0.98]"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            Retomar agora
            <ChevronRight className="w-4 h-4" />
          </button>

          <p
            className="text-xs text-white/45"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Retoma automaticamente em <span className="font-bold tabular-nums text-neon-yellow">{countdown}s</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
