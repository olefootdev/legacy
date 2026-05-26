/**
 * PassiveIncomeWidget — Renda passiva de estruturas (estádio + megaloja).
 *
 * Mostra:
 *   - Rate atual (EXP/h)
 *   - Acumulado pendente desde lastClaimAt (capado em 8h)
 *   - Botão "Coletar" quando há acúmulo
 *   - "Cheio em Xh" quando ainda não bateu o cap
 *
 * Estilo Legacy Tech (DS §4 + §7.1) — coerente com LoginBonusWidget e
 * DailyChallengesCard. Mesma palette: rail amarelo quando claimable, neutro
 * quando aguardando.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Coins, Sparkles } from 'lucide-react';
import { useGameDispatch, useGameStore } from '@/game/store';
import {
  calculatePassiveAccrual,
  passiveIncomeRatePerHour,
  passiveIncomeBreakdown,
  msUntilCap,
  PASSIVE_INCOME_MAX_OFFLINE_HOURS,
} from '@/clubStructures/passiveIncome';
import { cn } from '@/lib/utils';

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'cheio';
  const totalMin = Math.ceil(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function PassiveIncomeWidget() {
  const dispatch = useGameDispatch();
  const structures = useGameStore((s) => s.structures);
  const lastClaimAt = useGameStore((s) => s.finance.passiveIncome?.lastClaimAt ?? null);
  const [, setTick] = useState(0);
  const [justClaimed, setJustClaimed] = useState<number | null>(null);

  // Re-render a cada 60s pra atualizar o accrued visível
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Inicia o relógio na 1ª render se ainda não foi iniciado
  useEffect(() => {
    if (!lastClaimAt) {
      dispatch({ type: 'CLAIM_PASSIVE_STRUCTURE_INCOME' });
    }
  }, [lastClaimAt, dispatch]);

  const ratePerHour = passiveIncomeRatePerHour(structures);
  const breakdown = passiveIncomeBreakdown(structures);
  const accrued = calculatePassiveAccrual(structures, lastClaimAt);
  const untilCap = msUntilCap(lastClaimAt);
  const isCapped = untilCap <= 0 && accrued > 0;
  const canClaim = accrued > 0;

  const onClaim = () => {
    if (!canClaim) return;
    setJustClaimed(accrued);
    dispatch({ type: 'CLAIM_PASSIVE_STRUCTURE_INCOME' });
    setTimeout(() => setJustClaimed(null), 4000);
  };

  return (
    <motion.div
      whileHover={canClaim ? { y: -1 } : undefined}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={cn(
        'relative w-full bg-[var(--color-card)] border border-l-[3px] overflow-hidden',
        canClaim
          ? 'border-l-neon-yellow border-white/12 shadow-[0_0_18px_rgba(253,225,0,0.12)]'
          : 'border-l-cyan-400/40 border-white/8',
      )}
      style={{
        borderRadius: 'var(--radius-md)',
        boxShadow: canClaim
          ? '0 8px 24px rgba(0,0,0,0.18), 0 0 18px rgba(253,225,0,0.12)'
          : '0 8px 24px rgba(0,0,0,0.18)',
      }}
    >
      <div className="px-4 py-3.5 flex items-center gap-3">
        {/* Ícone */}
        <div
          className={cn(
            'shrink-0 w-11 h-11 grid place-items-center border',
            canClaim
              ? 'bg-neon-yellow/12 text-neon-yellow border-neon-yellow/35'
              : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
          )}
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          {canClaim ? <Coins size={18} /> : <Building2 size={16} />}
        </div>

        {/* Bloco textual */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span aria-hidden className={cn('block h-px w-4', canClaim ? 'bg-neon-yellow/55' : 'bg-cyan-400/55')} />
            <span
              className={canClaim ? 'text-neon-yellow' : 'text-cyan-300'}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '9px',
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
              }}
            >
              Receita do clube · {ratePerHour}/h
            </span>
          </div>

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
                +{accrued.toLocaleString('pt-BR')} EXP
                {isCapped && <span className="text-[10px] text-neon-yellow/70 ml-2 italic">cheio</span>}
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
                  Estádio {breakdown.stadium}/h · Megaloja {breakdown.megastore}/h
                </span>
              </div>
            )}
          </div>
          {canClaim && !isCapped && (
            <p className="text-[10px] text-white/40 mt-0.5">
              Cheio em {formatCountdown(untilCap)} · cap {PASSIVE_INCOME_MAX_OFFLINE_HOURS}h
            </p>
          )}
        </div>

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
            aria-label="Coletar receita"
          >
            Coletar
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {justClaimed !== null && justClaimed > 0 && (
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
                  Coletado
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
                +{justClaimed.toLocaleString('pt-BR')} EXP
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
