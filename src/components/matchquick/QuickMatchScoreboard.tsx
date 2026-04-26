/**
 * QuickMatchScoreboard — Placar ao vivo cinematográfico para Partida Rápida.
 *
 * Placar gigante em Moret italic + barra de momentum animada + relógio ao vivo.
 * Padrão visual: MatchdayHero + identidade BVB (amarelo elétrico, preto profundo).
 */

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { LiveMatchClockDisplay } from '@/components/matchday/LiveMatchClockDisplay';

interface QuickMatchScoreboardProps {
  homeShort: string;
  awayShort: string;
  homeName?: string;
  awayName?: string;
  homeScore: number;
  awayScore: number;
  /** Brasões reais dos times */
  homeCrestUrl?: string | null;
  awayCrestUrl?: string | null;
  /** Pressão 0-1: 0 = visitante domina, 1 = casa domina */
  momentumPressure: number;
  /** Chave de animação — muda quando há gol/evento importante */
  momentumAnimKey: string | null;
  /** Duração da transição da barra (ms) */
  barTransitionMs: number;
  /** Easing da transição */
  barEasing: string;
  /** Relógio */
  elapsedSec: number;
  clockFrozen: boolean;
  phase?: 'playing' | 'halftime' | 'postgame';
  msPerMinute: number;
  /** Shake animation quando defesa espetacular */
  scoreShakeKey?: number;
  /** Ícone de luva quando defesa */
  gloveVisible?: boolean;
}

export function QuickMatchScoreboard({
  homeShort,
  awayShort,
  homeName,
  awayName,
  homeScore,
  awayScore,
  homeCrestUrl,
  awayCrestUrl,
  momentumPressure,
  momentumAnimKey,
  barTransitionMs,
  barEasing,
  elapsedSec,
  clockFrozen,
  phase,
  msPerMinute,
  scoreShakeKey = 0,
  gloveVisible = false,
}: QuickMatchScoreboardProps) {
  const homePressurePct = Math.round(momentumPressure * 100);
  const awayPressurePct = 100 - homePressurePct;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Placar principal — Moret italic gigante + brasões maiores */}
      <motion.div
        key={scoreShakeKey}
        animate={scoreShakeKey > 0 ? { x: [0, -4, 4, -2, 2, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="relative flex items-center justify-center gap-4 sm:gap-6 md:gap-8 mb-4 sm:mb-6"
      >
        {/* Casa */}
        <div className="flex flex-col items-end gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Brasão maior */}
          {homeCrestUrl ? (
            <img
              src={homeCrestUrl}
              alt={homeName ?? homeShort}
              className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 object-contain shrink-0"
              referrerPolicy="no-referrer"
              draggable={false}
            />
          ) : (
            <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full border-[2.5px] sm:border-[3px] border-neon-yellow bg-deep-black grid place-items-center shrink-0">
              <span
                className="font-display font-black uppercase text-neon-yellow tracking-[0.06em]"
                style={{ fontSize: 'clamp(11px, 2vw, 16px)' }}
              >
                {homeShort}
              </span>
            </div>
          )}

          {/* Nome do time */}
          <p
            className="text-white/70 uppercase font-display font-bold tracking-wider truncate max-w-full text-right"
            style={{
              fontSize: 'clamp(11px, 1.8vw, 15px)',
              letterSpacing: '0.18em',
            }}
          >
            {homeName ?? homeShort}
          </p>

          {/* Score */}
          <span
            className="leading-none text-neon-yellow tabular-nums"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontSize: 'clamp(64px, 14vw, 108px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
            }}
          >
            {homeScore}
          </span>
        </div>

        {/* Separador — com ícone de luva quando defesa */}
        <div className="relative flex flex-col items-center gap-2 shrink-0">
          <span
            className="leading-none text-white/35 select-none"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontSize: 'clamp(36px, 7vw, 56px)',
            }}
          >
            –
          </span>
          {gloveVisible && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              className="absolute top-1/2 -translate-y-1/2 text-3xl sm:text-4xl"
              role="img"
              aria-label="Defesa"
            >
              🧤
            </motion.span>
          )}
        </div>

        {/* Visitante */}
        <div className="flex flex-col items-start gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Brasão maior */}
          {awayCrestUrl ? (
            <img
              src={awayCrestUrl}
              alt={awayName ?? awayShort}
              className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 object-contain shrink-0"
              referrerPolicy="no-referrer"
              draggable={false}
            />
          ) : (
            <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full border-[2.5px] sm:border-[3px] border-white/40 bg-deep-black grid place-items-center shrink-0">
              <span
                className="font-display font-black uppercase text-white tracking-[0.06em]"
                style={{ fontSize: 'clamp(11px, 2vw, 16px)' }}
              >
                {awayShort}
              </span>
            </div>
          )}

          {/* Nome do time */}
          <p
            className="text-white/70 uppercase font-display font-bold tracking-wider truncate max-w-full text-left"
            style={{
              fontSize: 'clamp(11px, 1.8vw, 15px)',
              letterSpacing: '0.18em',
            }}
          >
            {awayName ?? awayShort}
          </p>

          {/* Score */}
          <span
            className="leading-none text-white tabular-nums"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontSize: 'clamp(64px, 14vw, 108px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
            }}
          >
            {awayScore}
          </span>
        </div>
      </motion.div>

      {/* Relógio centralizado */}
      <div className="flex justify-center mb-3 sm:mb-4">
        <LiveMatchClockDisplay
          elapsedSec={elapsedSec}
          frozen={clockFrozen}
          phase={phase}
          msPerMinute={msPerMinute}
        />
      </div>

      {/* Barra de momentum — animada com transição suave */}
      <div className="relative w-full h-2 bg-deep-black border border-white/10 overflow-hidden" style={{ borderRadius: 'var(--radius-sm)' }}>
        {/* Fundo gradiente sutil */}
        <div className="absolute inset-0 bg-gradient-to-r from-neon-yellow/10 via-transparent to-white/10" />

        {/* Barra amarela (casa) — cresce da esquerda */}
        <motion.div
          key={`momentum-home-${momentumAnimKey}`}
          initial={false}
          animate={{ width: `${homePressurePct}%` }}
          transition={{ duration: barTransitionMs / 1000, ease: barEasing }}
          className="absolute left-0 top-0 h-full bg-neon-yellow"
          style={{
            boxShadow: homePressurePct > 70 ? '0 0 12px rgba(253,225,0,0.6)' : 'none',
          }}
        />

        {/* Barra branca (visitante) — cresce da direita */}
        <motion.div
          key={`momentum-away-${momentumAnimKey}`}
          initial={false}
          animate={{ width: `${awayPressurePct}%` }}
          transition={{ duration: barTransitionMs / 1000, ease: barEasing }}
          className="absolute right-0 top-0 h-full bg-white/80"
          style={{
            boxShadow: awayPressurePct > 70 ? '0 0 12px rgba(255,255,255,0.5)' : 'none',
          }}
        />

        {/* Indicador central (linha vertical fina) */}
        <div className="absolute left-1/2 top-0 h-full w-[1px] bg-white/20 -translate-x-1/2" aria-hidden />
      </div>

      {/* Labels de pressão (opcional, discreto) */}
      <div className="flex items-center justify-between mt-1.5 px-1">
        <span
          className={cn(
            "text-[9px] sm:text-[10px] uppercase tracking-wider font-medium transition-colors",
            homePressurePct > 60 ? "text-neon-yellow" : "text-white/35"
          )}
          style={{ fontFamily: 'var(--font-ui)' }}
        >
          {homePressurePct > 60 ? 'Pressão' : ''}
        </span>
        <span
          className={cn(
            "text-[9px] sm:text-[10px] uppercase tracking-wider font-medium transition-colors",
            awayPressurePct > 60 ? "text-white/70" : "text-white/35"
          )}
          style={{ fontFamily: 'var(--font-ui)' }}
        >
          {awayPressurePct > 60 ? 'Pressão' : ''}
        </span>
      </div>
    </div>
  );
}
