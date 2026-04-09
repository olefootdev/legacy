import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const tabClass =
  'flex-1 py-2.5 px-3 text-center text-[11px] font-display font-bold uppercase tracking-widest transition-all rounded-lg border border-transparent';

export function WalletSpotToggle() {
  return (
    <div
      className="flex gap-1 p-1 rounded-2xl bg-black/50 border border-white/10 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      role="tablist"
      aria-label="Conta SPOT ou OLEXP"
    >
      <NavLink
        to="/wallet"
        end
        className={({ isActive }) =>
          cn(
            tabClass,
            isActive
              ? 'bg-neon-yellow text-black border-neon-yellow/40 shadow-[0_0_20px_rgba(250,204,21,0.15)]'
              : 'text-gray-500 hover:text-white hover:bg-white/5',
          )
        }
      >
        SPOT
      </NavLink>
      <NavLink
        to="/wallet/olexp"
        className={({ isActive }) =>
          cn(
            tabClass,
            isActive
              ? 'bg-purple-600/90 text-white border-purple-400/50 shadow-[0_0_24px_rgba(147,51,234,0.2)]'
              : 'text-gray-500 hover:text-white hover:bg-white/5',
          )
        }
      >
        OLEXP
      </NavLink>
    </div>
  );
}
