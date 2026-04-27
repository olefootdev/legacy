/**
 * MATCH LIVE - HEADER IMERSIVO BVB
 * Header minimalista para experiência cinematográfica
 */
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';

export type MatchLiveHeaderProps = {
  homeScore: number;
  awayScore: number;
  homeShort: string;
  awayShort: string;
  clockDisplay: string;
  period: string;
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
  onMenuToggle,
  onExit,
}: MatchLiveHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Header minimalista - 3 elementos apenas */}
      <header className="relative z-50 flex items-center justify-between px-4 py-3 bg-black/40 backdrop-blur-md border-b border-white/5">
        {/* Botão Sair - canto esquerdo */}
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 text-white/50 hover:text-neon-yellow transition-colors"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          <span className="text-lg">←</span>
          <span className="hidden sm:inline">Sair</span>
        </button>

        {/* Placar central - destaque máximo */}
        <div className="flex flex-col items-center gap-1">
          {/* Placar */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Time da casa */}
            <div className="flex items-center gap-2">
              <span
                className="text-white/70 uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                }}
              >
                {homeShort}
              </span>
              <span
                className="text-neon-yellow tabular-nums"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(24px, 5vw, 32px)',
                  fontWeight: 900,
                  letterSpacing: '-0.02em',
                }}
              >
                {homeScore}
              </span>
            </div>

            {/* Separador */}
            <span className="text-white/30 text-xl font-bold">×</span>

            {/* Time visitante */}
            <div className="flex items-center gap-2">
              <span
                className="text-red-400 tabular-nums"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(24px, 5vw, 32px)',
                  fontWeight: 900,
                  letterSpacing: '-0.02em',
                }}
              >
                {awayScore}
              </span>
              <span
                className="text-white/70 uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                }}
              >
                {awayShort}
              </span>
            </div>
          </div>

          {/* Relógio e período */}
          <div className="flex items-center gap-2">
            <span
              className="text-white/50 tabular-nums"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.1em',
              }}
            >
              {clockDisplay}
            </span>
            <span className="text-white/30">·</span>
            <span
              className="text-white/40 uppercase"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '9px',
                fontWeight: 600,
                letterSpacing: '0.15em',
              }}
            >
              {period}
            </span>
          </div>
        </div>

        {/* Menu hamburguer - canto direito */}
        <button
          type="button"
          onClick={() => {
            setMenuOpen(!menuOpen);
            onMenuToggle?.();
          }}
          className="inline-flex items-center justify-center w-8 h-8 text-white/50 hover:text-neon-yellow transition-colors"
          aria-label="Menu"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Menu dropdown (quando aberto) */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 right-4 z-50 w-64 bg-black/95 backdrop-blur-md border border-white/10 rounded-sm shadow-2xl"
          >
            <div className="p-4 space-y-3">
              <div className="text-[10px] font-display font-bold uppercase tracking-widest text-neon-yellow/70 pb-2 border-b border-white/10">
                Opções
              </div>
              {/* Opções do menu aqui */}
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded transition-colors"
              >
                Câmera
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded transition-colors"
              >
                Estatísticas
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded transition-colors"
              >
                Substituições
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
