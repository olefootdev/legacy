/**
 * MATCH LIVE - WATERMARK ÉPICO
 * Placar gigante em fundo (preto/5%) com tipografia BVB
 */
import { motion } from 'motion/react';

export type MatchLiveWatermarkProps = {
  homeScore: number;
  awayScore: number;
};

export function MatchLiveWatermark({ homeScore, awayScore }: MatchLiveWatermarkProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex items-center gap-8 select-none"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(120px, 20vw, 280px)',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          lineHeight: 1,
        }}
      >
        {/* Score da casa - amarelo neon */}
        <span
          className="text-neon-yellow/5 tabular-nums"
          style={{
            textShadow: '0 0 80px rgba(253, 225, 0, 0.08)',
          }}
        >
          {homeScore}
        </span>

        {/* Separador */}
        <span className="text-white/3 text-[0.6em]">×</span>

        {/* Score visitante - vermelho */}
        <span
          className="text-red-500/5 tabular-nums"
          style={{
            textShadow: '0 0 80px rgba(239, 68, 68, 0.08)',
          }}
        >
          {awayScore}
        </span>
      </motion.div>
    </div>
  );
}
