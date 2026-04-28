import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * Toggle SPOT | OLEXP | GAT do hero da Wallet.
 * Sprint B-4 Legacy Tech: pílulas arredondadas (radius-pill) com peso editorial.
 */
const tabClass =
  'shrink-0 rounded-[var(--radius-pill)] px-5 py-2 text-center font-display text-[11px] font-black uppercase tracking-[0.22em] transition-all min-[380px]:px-6 min-[380px]:text-[12px]';

export function WalletSpotToggle() {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-black/15 bg-black/10 p-1 backdrop-blur-sm"
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
              ? 'bg-black text-neon-yellow shadow-[0_2px_10px_rgba(0,0,0,0.25)]'
              : 'text-black/55 hover:text-black',
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
              ? 'bg-purple-600 text-white shadow-[0_2px_10px_rgba(124,58,237,0.35)]'
              : 'text-black/55 hover:text-black',
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
              ? 'bg-amber-500 text-black shadow-[0_2px_10px_rgba(245,158,11,0.35)]'
              : 'text-black/55 hover:text-black',
          )
        }
      >
        GAT
      </NavLink>
    </div>
  );
}
