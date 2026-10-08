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

/**
 * DS 2027 · RECEBER / ENVIAR / COMPRAR: caixas de contorno em papel com rótulo
 * em Anton; o atalho de dinheiro entrando ("green") é a AÇÃO — rua cheia.
 */
type WalletQuickActionsProps = {
  actions: QuickAction[];
};

export function WalletQuickActions({ actions }: WalletQuickActionsProps) {
  return (
    <section>
      <div className="grid grid-cols-2 gap-2.5 min-[420px]:grid-cols-4">
        {actions.map((a) => {
          const acao = a.accent === 'green';
          return (
            <motion.button
              key={a.key}
              type="button"
              onClick={a.onClick}
              disabled={a.disabled}
              whileTap={a.disabled ? undefined : { scale: 0.96 }}
              className={`group relative flex h-[60px] min-w-0 items-center justify-center gap-2 px-2 transition-colors disabled:opacity-40 ${
                acao
                  ? 'bg-rua text-asfalto-27 hover:bg-papel'
                  : 'border-2 border-papel text-papel hover:bg-papel hover:text-asfalto-27'
              } ${a.accent === 'red' ? '!border-baixa !text-baixa' : ''}`}
            >
              <span className="relative flex shrink-0 items-center justify-center">
                {a.icon}
                {a.badge ? (
                  <span className="absolute -right-3 -top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rua px-1 font-prova text-[9px] font-bold text-asfalto-27 tabular-nums">
                    {a.badge}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate font-impact text-[18px] uppercase leading-none">{a.label}</span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
