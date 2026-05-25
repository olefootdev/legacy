/**
 * OLEFOOT PYTHON MODE — Widget de claim de bonus 3h (semana) / 1h (fim de semana).
 *
 * Mostra:
 *   - Próxima recompensa (preview)
 *   - Botão de claim quando disponível
 *   - Countdown quando ainda cedo
 *   - Feedback animado após claim
 *
 * Usado na Home. UI minimalista pra caber em qualquer slot.
 */
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Clock } from 'lucide-react';
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

  // Limpa lastClaimResult após 4s pra animação sumir
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
    <div
      className={cn(
        'relative w-full rounded-sm bg-[var(--color-card)] border border-white/8 overflow-hidden',
        'px-4 py-3 flex items-center gap-3',
        canClaim && 'border-l-4 border-l-neon-yellow',
      )}
    >
      <div
        className={cn(
          'shrink-0 w-10 h-10 rounded-sm grid place-items-center',
          canClaim ? 'bg-neon-yellow/15 text-neon-yellow' : 'bg-white/5 text-white/40',
        )}
      >
        {canClaim ? <Gift size={20} /> : <Clock size={18} />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="ole-eyebrow text-white/50 mb-0.5" style={{ fontFamily: 'var(--font-ui)' }}>
          Bônus de login · ciclo {intervalHours}h
        </div>
        <div className="font-display text-sm sm:text-base text-white truncate">
          {canClaim
            ? `Reivindicar: ${nextReward?.label ?? 'recompensa'}`
            : `Próximo em ${formatCountdown(msUntilNext)}`}
        </div>
      </div>

      {canClaim && (
        <button
          onClick={onClaim}
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-sm bg-neon-yellow text-deep-black',
            'text-xs font-display font-black uppercase tracking-wider',
            'hover:bg-neon-yellow/90 active:scale-95 transition',
          )}
          aria-label="Reivindicar bônus"
        >
          Resgatar
        </button>
      )}

      {/* Feedback animado pós-claim */}
      <AnimatePresence>
        {lastClaimResult?.claimed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-neon-yellow/95 text-deep-black grid place-items-center pointer-events-none"
          >
            <div className="text-center px-4">
              <div className="ole-eyebrow font-black" style={{ fontFamily: 'var(--font-ui)' }}>
                Concedido!
              </div>
              <div className="font-display text-base sm:text-lg font-black">
                {lastClaimResult.reward?.label}
              </div>
              {lastClaimResult.slotIndex && lastClaimResult.slotIndex > 1 && (
                <div className="text-[10px] mt-0.5 opacity-70">
                  Slot {lastClaimResult.slotIndex} consecutivo
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
