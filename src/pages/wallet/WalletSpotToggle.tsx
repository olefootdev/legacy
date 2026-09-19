import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * Toggle SPOT | COLEÇÃO do hero da Wallet.
 * VOLT2: segmento reto sobre asfalto — ativo em branco chapado, sem sombra.
 * OLEXP e GAT foram removidos em 2026-07-16; a Coleção ocupou o lugar.
 */
const tabClass =
  'shrink-0 px-5 py-2 text-center font-mono text-[11px] font-medium uppercase tracking-[0.2em] transition-colors min-[380px]:px-6 min-[380px]:text-[12px]';

export function WalletSpotToggle() {
  return (
    <div
      className="inline-flex items-center gap-1 border border-white/16 bg-panel p-1"
      role="tablist"
      aria-label="Conta SPOT ou Coleção"
    >
      <NavLink
        to="/wallet"
        end
        className={({ isActive }) =>
          cn(
            tabClass,
            isActive
              ? 'bg-white text-black'
              : 'text-cimento hover:text-white',
          )
        }
      >
        SPOT
      </NavLink>
      <NavLink
        to="/wallet/colecao"
        className={({ isActive }) =>
          cn(
            tabClass,
            isActive
              ? 'bg-white text-black'
              : 'text-cimento hover:text-white',
          )
        }
      >
        Coleção
      </NavLink>
    </div>
  );
}
