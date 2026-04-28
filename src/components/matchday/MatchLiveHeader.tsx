/**
 * MATCH LIVE — HEADER (F2 — Olefoot Broadcast)
 *
 * Layout broadcast: bug skewed à esquerda com placar (assinatura BVB),
 * relógio central monumental tabular, menu discreto à direita.
 * Em gols recentes, o bug pulsa via `goalPulseAt` prop.
 */
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';

export type MatchLiveHeaderProps = {
  homeScore: number;
  awayScore: number;
  homeShort: string;
  awayShort: string;
  clockDisplay: string;
  period: string;
  /** Timestamp do último gol (ms). Quando muda, dispara goal-flash no bug. */
  goalPulseAt?: number | null;
  onMenuToggle?: () => void;
  onExit?: () => void;
};

export function MatchLiveHeader({
  homeScore,
  awayScore,
  homeShort,
  awayShort,
  clockDisplay,
  period,
  goalPulseAt,
  onMenuToggle,
  onExit,
}: MatchLiveHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    if (goalPulseAt) setPulseKey((k) => k + 1);
  }, [goalPulseAt]);

  return (
    <>
      <header
        className="relative z-50 grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3"
        style={{
          background: 'linear-gradient(180deg, rgba(13,13,13,0.92) 0%, rgba(13,13,13,0.55) 100%)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--color-divider-soft)',
        }}
      >
        {/* ESQUERDA — Sair + Broadcast bug com placar ─────────────── */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onExit}
            className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 text-white/40 hover:text-white transition-colors"
            style={{ transitionDuration: 'var(--dur-micro)' }}
            aria-label="Sair"
          >
            <span className="text-lg leading-none">←</span>
          </button>

          {/* Broadcast bug */}
          <div
            key={pulseKey}
            className={`ole-broadcast-bug ${pulseKey > 0 ? 'ole-goal-flash' : ''}`}
          >
            <div className="flex items-center gap-3">
              {/* HOME */}
              <span
                className="font-display font-bold tracking-[0.16em] text-white/65"
                style={{ fontSize: '10px' }}
              >
                {homeShort}
              </span>
              <span
                className="font-display font-black tabular-nums leading-none"
                style={{
                  color: 'var(--color-team-home)',
                  fontSize: 'clamp(22px, 3vw, 28px)',
                  letterSpacing: '-0.04em',
                }}
              >
                {homeScore}
              </span>
              <span className="text-white/25 leading-none" style={{ fontSize: '14px' }}>
                ×
              </span>
              <span
                className="font-display font-black tabular-nums leading-none"
                style={{
                  color: 'var(--color-team-away)',
                  fontSize: 'clamp(22px, 3vw, 28px)',
                  letterSpacing: '-0.04em',
                }}
              >
                {awayScore}
              </span>
              <span
                className="font-display font-bold tracking-[0.16em] text-white/65"
                style={{ fontSize: '10px' }}
              >
                {awayShort}
              </span>
            </div>
          </div>
        </div>

        {/* CENTRO — Relógio monumental + período ──────────────────── */}
        <div className="flex flex-col items-center justify-center min-w-0">
          <div
            className="font-display font-black tabular-nums leading-none text-white"
            style={{
              fontSize: 'clamp(20px, 3.4vw, 32px)',
              letterSpacing: '0.02em',
            }}
          >
            {clockDisplay}
          </div>
          <div
            className="font-ui font-semibold text-white/45 mt-0.5"
            style={{
              fontSize: '9px',
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
            }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle"
              style={{
                background: 'var(--color-event-goal)',
                boxShadow: '0 0 8px var(--color-event-goal)',
                animation: 'ole-live-pulse 1.5s ease-in-out infinite',
              }}
            />
            {period}
          </div>
        </div>

        {/* DIREITA — Menu ───────────────────────────────────────── */}
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(!menuOpen);
              onMenuToggle?.();
            }}
            className="inline-flex items-center justify-center w-8 h-8 text-white/45 hover:text-white transition-colors"
            style={{ transitionDuration: 'var(--dur-micro)' }}
            aria-label="Menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Menu dropdown ───────────────────────────────────────────── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-16 right-4 z-50 w-64 sports-panel"
            style={{
              background: 'rgba(13, 13, 13, 0.96)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: 'var(--shadow-card-hover)',
            }}
          >
            <div className="p-4 space-y-3">
              <div
                className="font-ui font-bold text-[10px] uppercase tracking-[0.32em] pb-2"
                style={{
                  color: 'var(--color-neon-yellow)',
                  borderBottom: '1px solid var(--color-divider-yellow)',
                }}
              >
                Opções
              </div>
              {['Câmera', 'Estatísticas', 'Substituições'].map((label) => (
                <button
                  key={label}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                  style={{ fontFamily: 'var(--font-ui)', transitionDuration: 'var(--dur-micro)' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
