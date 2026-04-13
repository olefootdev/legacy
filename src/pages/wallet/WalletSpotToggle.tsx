import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const tabClass =
  'min-w-0 flex-1 rounded-lg border border-transparent px-2 py-2.5 text-center text-[10px] font-display font-bold uppercase tracking-widest transition-all min-[380px]:px-3 min-[380px]:text-[11px]';

export function WalletSpotToggle() {
  return (
    <div
      className="flex min-w-0 w-full gap-1 rounded-2xl border border-white/10 bg-black/50 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl"
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
      <NavLink
        to="/wallet/gat"
        className={({ isActive }) =>
          cn(
            tabClass,
            isActive
              ? 'bg-amber-500/25 text-amber-100 border-amber-400/45 shadow-[0_0_20px_rgba(245,158,11,0.18)]'
              : 'text-gray-500 hover:text-white hover:bg-white/5',
          )
        }
      >
        GAT
      </NavLink>
    </div>
  );
}
