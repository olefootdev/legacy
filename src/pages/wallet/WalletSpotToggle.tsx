import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { L } from '@/i18n/L';

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
 * DS 2027: segmento reto; a conta ativa em rua chapada.
 */
// DS 2027: segmento em Anton; a conta aberta é ação em rua chapada.
const tabClass =
  'inline-flex min-h-[40px] shrink-0 items-center px-5 font-impact text-[18px] uppercase leading-none tracking-[0.02em] transition-colors';

const estado = ({ isActive }: { isActive: boolean }) =>
  cn(tabClass, isActive ? 'bg-rua text-asfalto-27' : 'text-mudo hover:text-papel');

export function WalletSpotToggle() {
  return (
    <div
      className="inline-flex items-center border-2 border-linha p-0.5"
      role="tablist"
      aria-label={L('Conta SPOT ou DEX', 'SPOT or DEX account')}
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
