/**
 * QuickMatchLineup — Cards de lineup MOBILE-FIRST para Partida Rápida.
 *
 * Layout final otimizado:
 * - Ranking por posição (1º, 2º, 3º...) mostra o NÚMERO DA CAMISA do jogador
 * - Não duplica o número ao lado do nome
 * - Fadiga apenas como porcentagem (%) colorida
 * - Grid 3 colunas: [Número Camisa] [Nome+Pos+Badges] [OVR+Fadiga%]
 */

import { motion } from 'motion/react';
import type { PitchPlayerState } from '@/engine/types';
import { cn } from '@/lib/utils';

type QuickEventBadge = 'goal' | 'yellow' | 'red' | 'injury';

interface QuickMatchLineupProps {
  players: (PitchPlayerState & { impact?: number })[];
  eventBadges: Map<string, QuickEventBadge[]>;
  onPlayerClick?: (player: PitchPlayerState) => void;
  side: 'home' | 'away';
  /** Jogadores expulsos (aparecem no fim com cartão vermelho) */
  sentOffPlayers?: { playerId: string; num: number; name: string; pos: string }[];
}

function PlayerEventBadges({ badges }: { badges: QuickEventBadge[] }) {
  if (!badges.length) return null;
  return (
    <span className="flex items-center gap-1 shrink-0" aria-hidden>
      {badges.map((b, i) => {
        if (b === 'goal')
          return (
            <span key={`g-${i}`} title="Gol" className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-neon-yellow text-black text-[8px] font-bold leading-none">
              G
            </span>
          );
        if (b === 'yellow')
          return (
            <span
              key={`y-${i}`}
              title="Amarelo"
              className="inline-block w-2 h-2.5 sm:w-2.5 sm:h-3 rounded-[1px] bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]"
            />
          );
        if (b === 'red')
          return (
            <span
              key={`r-${i}`}
              title="Vermelho"
              className="inline-block w-2 h-2.5 sm:w-2.5 sm:h-3 rounded-[1px] bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.45)]"
            />
          );
        return (
          <span
            key={`i-${i}`}
            title="Lesão"
            className="inline-block w-3 h-3 text-red-400 rotate-45 font-bold text-xs leading-none"
          >
            +
          </span>
        );
      })}
    </span>
  );
}

function FatiguePercentage({ fatigue }: { fatigue: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(fatigue)));
  const color = pct >= 80 ? 'text-red-500' : pct >= 65 ? 'text-neon-yellow' : 'text-white/50';
  return (
    <span
      className={cn('tabular-nums leading-none font-bold', color)}
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(11px, 2vw, 13px)',
      }}
    >
      {pct}%
    </span>
  );
}

export function QuickMatchLineup({
  players,
  eventBadges,
  onPlayerClick,
  side,
  sentOffPlayers = [],
}: QuickMatchLineupProps) {
  const isHome = side === 'home';

  return (
    <div className="w-full space-y-2 sm:space-y-3">
      {/* Eyebrow */}
      <div className="flex items-center gap-2 sm:gap-3 px-0.5">
        <span
          aria-hidden
          className={cn('shrink-0 w-[3px] h-5 sm:h-6', isHome ? 'bg-neon-yellow' : 'bg-white/60')}
        />
        <p
          className={cn('uppercase font-bold tracking-wider', isHome ? 'text-neon-yellow' : 'text-white/70')}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(10px, 2vw, 12px)',
            letterSpacing: '0.18em',
          }}
        >
          {isHome ? 'Seu time' : 'Adversário'}
        </p>
      </div>

      {/* Lista de jogadores — grid 2 colunas: [Número Camisa] [Nome+Pos+Badges+OVR+Fadiga%] */}
      <div className="space-y-2 sm:space-y-2.5">
        {players.map((p, i) => {
          const badges = eventBadges.get(p.playerId) ?? [];
          const ovr = Math.round(
            (p.attributes?.velocidade ?? 70) * 0.15 +
              (p.attributes?.finalizacao ?? 70) * 0.15 +
              (p.attributes?.passeCurto ?? 70) * 0.15 +
              (p.attributes?.drible ?? 70) * 0.15 +
              (p.attributes?.marcacao ?? 70) * 0.2 +
              (p.attributes?.fisico ?? 70) * 0.2
          );

          return (
            <motion.button
              key={p.playerId}
              type="button"
              onClick={() => onPlayerClick?.(p)}
              initial={{ opacity: 0, x: isHome ? -8 : 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03, duration: 0.25 }}
              className={cn(
                'group relative w-full bg-[var(--color-card)] border border-white/8 transition-all',
                'hover:border-neon-yellow/40 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.35)]',
                onPlayerClick && 'cursor-pointer'
              )}
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              {/* Grid 2 colunas: [Número Camisa] [Resto] */}
              <div className="grid grid-cols-[auto_1fr] gap-3 sm:gap-4 px-3 py-2.5 sm:px-4 sm:py-3">
                {/* Coluna 1: Número da Camisa (destaque) */}
                <div className="flex items-center justify-center shrink-0">
                  <span
                    className="text-neon-yellow font-display font-black leading-none tabular-nums"
                    style={{ fontSize: 'clamp(28px, 5vw, 36px)' }}
                  >
                    {p.num}
                  </span>
                </div>

                {/* Coluna 2: Nome + Posição + Badges + OVR + Fadiga */}
                <div className="flex flex-col justify-center gap-1.5 min-w-0">
                  {/* Linha 1: Nome + OVR */}
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className="text-white uppercase truncate leading-tight flex-1 min-w-0"
                      style={{
                        fontFamily: 'var(--font-serif-hero)',
                        fontStyle: 'italic',
                        fontWeight: 700,
                        fontSize: 'clamp(14px, 2.8vw, 16px)',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {p.name}
                    </p>
                    <span
                      className="italic text-neon-yellow tabular-nums leading-none shrink-0"
                      style={{
                        fontFamily: 'var(--font-serif-hero)',
                        fontWeight: 700,
                        fontSize: 'clamp(20px, 3.5vw, 24px)',
                      }}
                    >
                      {ovr}
                    </span>
                  </div>

                  {/* Linha 2: Posição + Badges + Fadiga */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="text-white/45 uppercase font-bold tracking-wider leading-none shrink-0"
                        style={{
                          fontFamily: 'var(--font-ui)',
                          fontSize: 'clamp(9px, 1.6vw, 10px)',
                        }}
                      >
                        {p.pos}
                      </span>

                      {/* Badges (se houver) */}
                      {badges.length > 0 && (
                        <div className="shrink-0">
                          <PlayerEventBadges badges={badges} />
                        </div>
                      )}
                    </div>

                    {/* Fadiga (%) */}
                    <div className="shrink-0">
                      <FatiguePercentage fatigue={p.fatigue} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}

        {/* Expulsos (aparecem no fim com cartão vermelho) */}
        {sentOffPlayers.map((p, i) => (
          <motion.div
            key={p.playerId}
            initial={{ opacity: 0, x: isHome ? -8 : 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: (players.length + i) * 0.03, duration: 0.25 }}
            className="relative w-full bg-red-500/10 border border-red-500/30 opacity-60"
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            {/* Grid 2 colunas (mesmo layout) */}
            <div className="grid grid-cols-[auto_1fr] gap-3 sm:gap-4 px-3 py-2.5 sm:px-4 sm:py-3">
              {/* Número da Camisa */}
              <div className="flex items-center justify-center shrink-0">
                <span
                  className="text-red-300 font-display font-black leading-none tabular-nums"
                  style={{ fontSize: 'clamp(28px, 5vw, 36px)' }}
                >
                  {p.num}
                </span>
              </div>

              {/* Nome + Posição + Cartão */}
              <div className="flex flex-col justify-center gap-1.5 min-w-0">
                {/* Linha 1: Nome + Cartão */}
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className="text-red-300 uppercase truncate leading-tight flex-1 min-w-0"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontStyle: 'italic',
                      fontWeight: 700,
                      fontSize: 'clamp(14px, 2.8vw, 16px)',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {p.name}
                  </p>
                  <span
                    role="img"
                    aria-label="Expulso"
                    className="inline-block shrink-0 rounded-[2px] bg-red-600 ring-1 ring-red-950/50 shadow-[0_0_10px_rgba(220,38,38,0.5)] w-[11px] h-[14px] sm:w-3 sm:h-4"
                  />
                </div>

                {/* Linha 2: Posição */}
                <span
                  className="text-red-300/60 uppercase font-bold tracking-wider leading-none"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: 'clamp(9px, 1.6vw, 10px)',
                  }}
                >
                  {p.pos}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
