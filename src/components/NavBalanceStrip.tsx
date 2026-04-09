import { useGameStore } from '@/game/store';
import { formatBroDisplay, formatExp } from '@/systems/economy';

/**
 * BRO (spot), OLE e EXP — ambos OLE/EXP refletem `finance.ole` até existir split wallet/jogo no backend.
 * Usado só nas rotas `/wallet` (e subpáginas), não no layout global.
 */
export function NavBalanceStrip() {
  const finance = useGameStore((s) => s.finance);
  const bro = formatBroDisplay(finance.broCents);
  const oleExp = formatExp(finance.ole);

  return (
    <div
      className="grid grid-cols-3 gap-1 sm:gap-2 text-center rounded-xl border border-white/10 bg-black/40 backdrop-blur-md px-2 py-2.5"
      aria-label={`Saldos: ${bro.primary}, OLE ${oleExp}, EXP ${oleExp}`}
    >
      <div className="min-w-0 border-r border-white/5 pr-1 sm:pr-2">
        <p className="text-[8px] sm:text-[9px] text-gray-500 uppercase font-display font-bold tracking-wider">BRO</p>
        <p className="text-[10px] sm:text-xs font-display font-bold text-white truncate">{bro.primary}</p>
      </div>
      <div className="min-w-0 border-r border-white/5 px-1">
        <p className="text-[8px] sm:text-[9px] text-gray-500 uppercase font-display font-bold tracking-wider">OLE</p>
        <p className="text-[10px] sm:text-xs font-display font-bold text-neon-yellow/90 truncate">{oleExp}</p>
      </div>
      <div className="min-w-0 pl-1">
        <p className="text-[8px] sm:text-[9px] text-gray-500 uppercase font-display font-bold tracking-wider">EXP</p>
        <p className="text-[10px] sm:text-xs font-display font-bold text-gray-200 truncate">{oleExp}</p>
      </div>
    </div>
  );
}
