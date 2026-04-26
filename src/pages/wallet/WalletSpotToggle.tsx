import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const tabClass =
  'min-w-0 flex-1 border border-transparent px-2 py-2.5 text-center text-[10px] font-display font-bold uppercase tracking-widest transition-all min-[380px]:px-3 min-[380px]:text-[11px]';

export function WalletSpotToggle() {
  return (
    <div
      className="flex min-w-0 w-full gap-1 border border-white/10 bg-black p-1"
      role="tablist"
      aria-label="Conta SPOT, OLEXP ou GAT"
    >
      <NavLink
        to="/wallet"
        end
        className={({ isActive }) =>
          cn(
            tabClass,
            isActive
              ? 'bg-neon-yellow text-black border-neon-yellow/40'
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
              ? 'bg-purple-600 text-white border-purple-400/50'
              : 'text-gray-500 hover:text-white hover:bg-white/5',
          )
        }
      >
        OLEXP
      </NavLink>
      <NavLink
        to="/wallet/gat"
        className={({ isActive }) =>
          cn(
            tabClass,
            isActive
              ? 'bg-amber-500 text-black border-amber-400/45'
              : 'text-gray-500 hover:text-white hover:bg-white/5',
          )
        }
      >
        GAT
      </NavLink>
    </div>
  );
}
