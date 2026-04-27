/**
 * QuickMatchHalftime — Painel de intervalo otimizado e direto.
 *
 * Padrão visual:
 * - Placar parcial em Moret italic
 * - Stats essenciais do 1º tempo (apenas 3 principais)
 * - Botão "Iniciar 2º Tempo" amarelo primário
 * - Countdown reduzido (5s) - clique retoma imediatamente
 */

import { motion } from 'motion/react';
import { Play } from 'lucide-react';

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
  // Mostrar apenas os 3 stats mais importantes
  const topStats = stats.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-deep-black/95 backdrop-blur-md px-4"
    >
      <div className="w-full max-w-xl space-y-6">
        {/* Eyebrow compacto */}
        <div className="flex items-center justify-center gap-2">
          <span aria-hidden className="h-px w-8 bg-neon-yellow/40" />
          <span
            className="text-neon-yellow uppercase tracking-[0.35em] font-medium"
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '10px',
            }}
          >
            Intervalo
          </span>
          <span aria-hidden className="h-px w-8 bg-neon-yellow/40" />
        </div>

        {/* Placar compacto */}
        <div className="flex items-center justify-center gap-6">
          {/* Casa */}
          <div className="flex items-center gap-3">
            <p
              className="text-white/55 uppercase tracking-wider"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '11px',
                fontWeight: 700,
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
                fontSize: 'clamp(40px, 8vw, 64px)',
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
              fontSize: 'clamp(24px, 4vw, 32px)',
            }}
          >
            –
          </span>

          {/* Visitante */}
          <div className="flex items-center gap-3">
            <span
              className="leading-none text-white tabular-nums"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontStyle: 'italic',
                fontSize: 'clamp(40px, 8vw, 64px)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
              }}
            >
              {awayScore}
            </span>
            <p
              className="text-white/55 uppercase tracking-wider"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.18em',
              }}
            >
              {awayShort}
            </p>
          </div>
        </div>

        {/* Stats essenciais (apenas 3) */}
        {topStats.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {topStats.map((s) => (
              <div
                key={s.label}
                className="border border-white/10 bg-black/60 px-3 py-2.5 text-center backdrop-blur-sm"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <p
                  className="mb-1 uppercase tracking-[0.18em] text-white/45"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '9px',
                    fontWeight: 600,
                  }}
                >
                  {s.label}
                </p>
                <div className="flex items-center justify-center gap-1.5">
                  <span
                    className="font-display font-black leading-none tabular-nums text-neon-yellow"
                    style={{ fontSize: 'clamp(16px, 2.5vw, 20px)' }}
                  >
                    {s.homeValue}
                  </span>
                  <span className="text-[10px] text-white/25">×</span>
                  <span
                    className="font-display font-black leading-none tabular-nums text-white"
                    style={{ fontSize: 'clamp(16px, 2.5vw, 20px)' }}
                  >
                    {s.awayValue}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Botão CTA grande + countdown */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onForceEnd}
            className="inline-flex items-center gap-3 border-2 border-neon-yellow bg-neon-yellow px-8 py-4 text-black shadow-[0_0_30px_rgba(253,224,71,0.4)] transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(253,224,71,0.6)] active:scale-95"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '13px',
              fontWeight: 900,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <Play className="w-5 h-5 fill-current" />
            Iniciar 2º Tempo
          </button>

          <p
            className="text-[11px] text-white/40"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Inicia automaticamente em <span className="font-bold tabular-nums text-neon-yellow">{countdown}s</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
