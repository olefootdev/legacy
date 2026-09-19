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

/** VOLT2: ícone branco chapado; verde = dinheiro entrando; vermelho = ação de risco. */
const ACCENT_RING: Record<NonNullable<QuickAction['accent']>, string> = {
  green: 'text-alta',
  red: 'text-baixa',
  amber: 'text-white',
  cyan: 'text-white',
  yellow: 'text-white',
};

type WalletQuickActionsProps = {
  actions: QuickAction[];
};

export function WalletQuickActions({ actions }: WalletQuickActionsProps) {
  return (
    <section>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {actions.map((a) => {
          const ringCls = a.accent ? ACCENT_RING[a.accent] : 'text-white';
          return (
            <motion.button
              key={a.key}
              type="button"
              onClick={a.onClick}
              disabled={a.disabled}
              whileTap={a.disabled ? undefined : { scale: 0.94 }}
              className="group relative flex h-[64px] min-w-0 flex-col items-center justify-center gap-1.5 border border-white/14 bg-card px-1 transition-colors hover:border-white/30 disabled:opacity-40"
            >
              <span className={`relative flex items-center justify-center ${ringCls}`}>
                {a.icon}
                {a.badge ? (
                  <span className="ole-num absolute -top-2 -right-3 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-neon-yellow px-1 text-[8px] text-deep-black tabular-nums">
                    {a.badge}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate text-[11px] font-semibold text-white sm:text-[12px]">
                {a.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
