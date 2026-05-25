/**
 * OLEFOOT PYTHON MODE — Widget de bônus 3h/1h (Legacy Tech).
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ ┌──┐  EYEBROW Agency tracking-0.32em                     │
 *   │ │GI│  Reward (Moret italic) / Countdown (Moret italic)   │
 *   │ │FT│  ─────────                                           │
 *   │ └──┘                                       [ CTA YELLOW ] │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Eyebrow Agency + Moret italic no número/reward respeitam DS §4 e §7.4.
 * CTA é botão amarelo dominante (DS §7.1). Quando claimable, rail amarelo
 * 3px à esquerda + glow neon assinatura.
 */
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Clock, Sparkles } from 'lucide-react';
import { useGameDispatch } from '@/game/store';
import { useLoginBonus } from '@/hooks/useEngagement';
import { cn } from '@/lib/utils';

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'agora';
  const totalMin = Math.ceil(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function LoginBonusWidget() {
  const dispatch = useGameDispatch();
  const { canClaim, msUntilNext, intervalHours, nextReward, lastClaimResult } = useLoginBonus();

  useEffect(() => {
    if (!lastClaimResult?.claimed) return;
    const id = setTimeout(() => dispatch({ type: 'CLEAR_LAST_BONUS_CLAIM' }), 4000);
    return () => clearTimeout(id);
  }, [lastClaimResult, dispatch]);

  const onClaim = () => {
    if (!canClaim) return;
    dispatch({ type: 'CLAIM_LOGIN_BONUS' });
  };

  return (
    <motion.div
      whileHover={canClaim ? { y: -1 } : undefined}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={cn(
        'relative w-full bg-[var(--color-card)] border border-l-[3px] overflow-hidden',
        canClaim
          ? 'border-l-neon-yellow border-white/12 shadow-[0_0_18px_rgba(253,225,0,0.12)]'
          : 'border-l-white/15 border-white/8',
      )}
      style={{
        borderRadius: 'var(--radius-md)',
        boxShadow: canClaim
          ? '0 8px 24px rgba(0,0,0,0.18), 0 0 18px rgba(253,225,0,0.12)'
          : '0 8px 24px rgba(0,0,0,0.18)',
      }}
    >
      <div className="px-4 py-3.5 flex items-center gap-3">
        {/* Ícone à esquerda */}
        <div
          className={cn(
            'shrink-0 w-11 h-11 grid place-items-center border',
            canClaim
              ? 'bg-neon-yellow/12 text-neon-yellow border-neon-yellow/35'
              : 'bg-deep-black/40 text-white/40 border-white/10',
          )}
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          {canClaim ? <Gift size={18} /> : <Clock size={16} />}
        </div>

        {/* Bloco textual */}
        <div className="flex-1 min-w-0">
          {/* Eyebrow */}
          <div className="flex items-center gap-1.5">
            <span aria-hidden className="block h-px w-4 bg-neon-yellow/55" />
            <span
              className="text-neon-yellow"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '9px',
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
              }}
            >
              Bônus · ciclo {intervalHours}h
            </span>
          </div>

          {/* Headline — Moret italic */}
          <div className="mt-1">
            {canClaim ? (
              <div
                className="text-white truncate leading-tight"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontWeight: 700,
                  fontSize: 'clamp(15px, 2.6vw, 18px)',
                  letterSpacing: '-0.02em',
                }}
              >
                {nextReward?.label ?? 'Recompensa pronta'}
              </div>
            ) : (
              <div className="flex items-baseline gap-2">
                <span
                  className="text-white/45"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: '10px',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                  }}
                >
                  Próximo em
                </span>
                <span
                  className="text-white tabular-nums leading-none"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontStyle: 'italic',
                    fontWeight: 700,
                    fontSize: 'clamp(18px, 2.8vw, 22px)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {formatCountdown(msUntilNext)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* CTA dominante (DS §7.1) */}
        {canClaim && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onClaim}
            className="shrink-0 bg-neon-yellow text-deep-black px-4 py-2 hover:bg-white transition-colors"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: '11px',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 8px 24px rgba(253,225,0,0.22)',
            }}
            aria-label="Reivindicar bônus"
          >
            Resgatar
          </motion.button>
        )}
      </div>

      {/* Feedback animado pós-claim (overlay amarelo cinematográfico) */}
      <AnimatePresence>
        {lastClaimResult?.claimed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-neon-yellow text-deep-black grid place-items-center pointer-events-none"
          >
            <div className="text-center px-4">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Sparkles size={11} className="text-black/70" />
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    fontSize: '10px',
                    letterSpacing: '0.32em',
                    textTransform: 'uppercase',
                  }}
                >
                  Concedido
                </span>
                <Sparkles size={11} className="text-black/70" />
              </div>
              <div
                className="text-black leading-none"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontWeight: 700,
                  fontSize: 'clamp(18px, 3vw, 22px)',
                  letterSpacing: '-0.02em',
                }}
              >
                {lastClaimResult.reward?.label}
              </div>
              {lastClaimResult.slotIndex && lastClaimResult.slotIndex > 1 && (
                <div
                  className="text-black/60 mt-1 tabular-nums"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '9px',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                  }}
                >
                  Slot {lastClaimResult.slotIndex} consecutivo
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
