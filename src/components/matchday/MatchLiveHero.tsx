/**
 * MATCH LIVE HERO - LAYER 1
 * Hero cinematográfico com design system BVB
 * Split diagonal amarelo/preto + placar compacto e elegante
 */
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type MatchLiveHeroProps = {
  homeShort: string;
  homeName: string;
  homeScore: number;
  awayShort: string;
  awayName: string;
  awayScore: number;
  clockDisplay: string;
  period: string;
  competition: string;
  quote: string;
  onScrollToField: () => void;
  onExit: () => void;
};

/**
 * Dígito animado com bounce + glow quando muda
 */
function AnimatedScore({ value, side }: { value: number; side: 'home' | 'away' }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (value !== prev.current) {
      prev.current = value;
      setKey((k) => k + 1);
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 900);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <span className="relative inline-flex items-center justify-center">
      {/* Flash verde no gol */}
      <AnimatePresence>
        {flash && (
          <motion.span
            key="flash"
            initial={{ opacity: 0.85, scale: 1.6 }}
            animate={{ opacity: 0, scale: 2.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 rounded-full bg-emerald-400/60"
          />
        )}
      </AnimatePresence>

      {/* Número com pulse + glow */}
      <motion.span
        key={key}
        initial={{ y: -28, opacity: 0, scale: 0.7 }}
        animate={
          flash
            ? {
                y: 0,
                opacity: 1,
                scale: [0.7, 1.35, 0.95, 1.08, 1],
                textShadow: [
                  '0 0 0px var(--yellow)',
                  '0 0 18px var(--yellow)',
                  '0 0 6px var(--yellow)',
                  '0 0 0px var(--yellow)',
                ],
              }
            : { y: 0, opacity: 1, scale: 1 }
        }
        transition={{ type: 'spring', stiffness: 420, damping: 18 }}
        className="relative tabular-nums ole-headline"
        style={{
          color: side === 'home' ? 'var(--yellow)' : '#ef4444',
        }}
      >
        {value}
      </motion.span>
    </span>
  );
}

export function MatchLiveHero({
  homeShort,
  homeName,
  homeScore,
  awayShort,
  awayName,
  awayScore,
  clockDisplay,
  period,
  competition,
  quote,
  onScrollToField,
  onExit,
}: MatchLiveHeroProps) {
  const totalScore = homeScore + awayScore;

  return (
    <section className="relative w-full overflow-hidden min-h-[88vh]" style={{ background: 'var(--stadium-night)' }}>
      {/* Split diagonal amarelo/preto (assinatura BVB) */}
      <div
        className="absolute inset-0"
        style={{
          background: 'var(--yellow)',
          clipPath: 'polygon(0 0, 62% 0, 38% 100%, 0% 100%)'
        }}
        aria-hidden
      />

      {/* Linhas verticais sutis (textura de campo) */}
      <svg
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ clipPath: 'polygon(0 0, 62% 0, 38% 100%, 0% 100%)' }}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <g stroke="#000" strokeOpacity="0.06" strokeWidth="0.15">
          <line x1="20" y1="0" x2="20" y2="100" />
          <line x1="40" y1="0" x2="40" y2="100" />
          <line x1="60" y1="0" x2="60" y2="100" />
          <line x1="80" y1="0" x2="80" y2="100" />
        </g>
      </svg>

      {/* Watermark gigante do placar total */}
      <div
        className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
        aria-hidden
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={totalScore}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.4 }}
            className="ole-headline tabular-nums whitespace-nowrap text-black/[0.03]"
            style={{
              fontSize: 'clamp(180px, 32vw, 460px)',
              lineHeight: '0.85',
              letterSpacing: '-0.05em',
            }}
          >
            {totalScore.toString().padStart(2, '0')}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Conteúdo */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-8 py-5 sm:py-7 flex flex-col min-h-[88vh]">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 mb-8 sm:mb-12">
          {/* Botão Sair */}
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-2 text-black/80 hover:text-black transition-colors"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-ui-xs)',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase'
            }}
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>

          {/* Competição */}
          <span
            className="text-black/70 text-center flex-1 truncate"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-ui-xs)',
              fontWeight: 700,
              letterSpacing: '0.22em',
              textTransform: 'uppercase'
            }}
          >
            {competition}
          </span>

          {/* Status ao vivo */}
          <span
            className="inline-flex items-center gap-1.5 text-black/85"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-ui-xs)',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase'
            }}
          >
            <span className="text-black/65">{clockDisplay}</span>
            <span aria-hidden className="text-black/40">—</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 live-dot" aria-hidden />
              AO VIVO
            </span>
          </span>
        </div>

        {/* Placar épico */}
        <div className="flex-1 flex flex-col items-center justify-center gap-8 sm:gap-12">
          {/* Times e placar */}
          <div className="w-full max-w-4xl">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-6">
              {/* Casa */}
              <div className="text-left">
                <h2
                  className="ole-headline text-black leading-[0.85] uppercase truncate"
                  style={{ fontSize: 'clamp(24px, 5vw, 48px)' }}
                >
                  {homeName}
                </h2>
                <p
                  className="mt-1 text-black/70"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-ui-xs)',
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase'
                  }}
                >
                  {homeShort}
                </p>
              </div>

              {/* Placar central */}
              <div className="flex items-center gap-3 sm:gap-4">
                <AnimatedScore value={homeScore} side="home" />
                <span
                  className="text-black/40 ole-headline"
                  style={{
                    fontSize: 'clamp(32px, 8vw, 64px)',
                  }}
                >
                  ×
                </span>
                <AnimatedScore value={awayScore} side="away" />
              </div>

              {/* Visitante */}
              <div className="text-right">
                <h2
                  className="ole-headline text-white leading-[0.85] uppercase truncate"
                  style={{ fontSize: 'clamp(24px, 5vw, 48px)' }}
                >
                  {awayName}
                </h2>
                <p
                  className="mt-1 text-white/70"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-ui-xs)',
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase'
                  }}
                >
                  {awayShort}
                </p>
              </div>
            </div>
          </div>

          {/* Quote editorial (Moret italic) */}
          <motion.blockquote
            key={quote}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="ole-headline-italic text-black/85 mx-auto max-w-2xl leading-snug text-center"
            style={{ fontSize: 'clamp(15px, 2vw, 19px)' }}
          >
            "{quote}"
          </motion.blockquote>

          {/* Período */}
          <div className="text-center">
            <span
              className="text-black/50"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.15em',
                textTransform: 'uppercase'
              }}
            >
              {period}
            </span>
          </div>
        </div>

        {/* Scroll cue */}
        <button
          type="button"
          onClick={onScrollToField}
          className="flex flex-col items-center gap-2 text-black/60 hover:text-black transition-colors animate-bounce"
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-ui-xs)',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase'
            }}
          >
            Ver campo ao vivo
          </span>
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* CSS para bolinha pulsante */}
      <style>{`
        @keyframes live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .live-dot {
          animation: live-pulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}
