import type { ReactNode } from 'react';
import { motion } from 'motion/react';

export type QuickAction = {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  accent?: 'green' | 'red' | 'amber' | 'cyan' | 'yellow';
  disabled?: boolean;
  badge?: string;
};

const ACCENT_RING: Record<NonNullable<QuickAction['accent']>, string> = {
  green: 'ring-neon-green/30 text-neon-green',
  red: 'ring-red-400/30 text-red-400',
  amber: 'ring-amber-400/30 text-amber-400',
  cyan: 'ring-cyan-400/30 text-cyan-400',
  yellow: 'ring-neon-yellow/30 text-neon-yellow',
};

type WalletQuickActionsProps = {
  actions: QuickAction[];
};

export function WalletQuickActions({ actions }: WalletQuickActionsProps) {
  return (
    <section
      className="border border-white/[0.06] p-3 sm:p-4"
      style={{
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-panel-elevated,#0b0b0b)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="grid grid-cols-5 gap-1 sm:gap-3">
        {actions.map((a) => {
          const ringCls = a.accent ? ACCENT_RING[a.accent] : 'ring-white/15 text-white/80';
          return (
            <motion.button
              key={a.key}
              type="button"
              onClick={a.onClick}
              disabled={a.disabled}
              whileTap={a.disabled ? undefined : { scale: 0.94 }}
              className="group relative flex flex-col items-center gap-2 px-1 py-2 transition-colors disabled:opacity-40"
            >
              <span
                className={`relative flex h-11 w-11 items-center justify-center rounded-full bg-black/40 ring-1 text-[18px] transition-all group-hover:ring-2 sm:h-12 sm:w-12 ${ringCls}`}
              >
                {a.icon}
                {a.badge ? (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-neon-yellow px-1 font-display text-[8px] font-black text-deep-black tabular-nums">
                    {a.badge}
                  </span>
                ) : null}
              </span>
              <span className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-white/75 group-hover:text-white">
                {a.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
