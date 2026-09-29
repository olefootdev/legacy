import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * Toggle SPOT | DEX do hero da Wallet.
 *
 * SPOT é o que vive no jogo: BRO, EXP e VERBA. DEX é o que vive (ou vai viver)
 * na Solana: a OLEWALLET, a posição de OLEFOOT e o que ela rende.
 *
 * Eram SPOT | COLEÇÃO, e Coleção aparecia duas vezes na mesma tela — aqui e nos
 * atalhos logo abaixo. O fundador cortou em 2026-09-29: o lugar de cima é da
 * DEX, e Coleção fica só no atalho.
 *
 * VOLT2: segmento reto sobre asfalto — ativo em branco chapado, sem sombra.
 */
const tabClass =
  'shrink-0 px-5 py-2 text-center font-mono text-[11px] font-medium uppercase tracking-[0.2em] transition-colors min-[380px]:px-6 min-[380px]:text-[12px]';

const estado = ({ isActive }: { isActive: boolean }) =>
  cn(tabClass, isActive ? 'bg-white text-black' : 'text-cimento hover:text-white');

export function WalletSpotToggle() {
  return (
    <div
      className="inline-flex items-center gap-1 border border-white/16 bg-panel p-1"
      role="tablist"
      aria-label="Conta SPOT ou DEX"
    >
      <NavLink to="/wallet" end className={estado}>
        SPOT
      </NavLink>
      <NavLink to="/wallet/dex" className={estado}>
        DEX
      </NavLink>
    </div>
  );
}
