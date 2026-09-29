import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, Layers, Menu, Network } from 'lucide-react';
import { DepositModal } from './DepositModal';
import { PixCheckoutModal } from '@/components/PixCheckoutModal';
import { WalletQuickActions, type QuickAction } from './WalletQuickActions';
import { useOlefootUsdBrlQuote } from '@/wallet/useOlefootUsdBrlQuote';
import { applyPendingCredits } from '@/wallet/applyPendingCredits';

/**
 * Os quatro atalhos da carteira — os mesmos em SPOT e em DEX.
 *
 * São da CARTEIRA, não de uma das contas: depositar, coleção, network e
 * extrato valem dos dois lados. Por isso o depósito mora aqui dentro, com os
 * dois modais, em vez de cada tela carregar o seu estado.
 *
 * "Coleção" aparece UMA vez. Ela ocupava também o toggle do topo, que agora é
 * SPOT | DEX.
 */
export function WalletAtalhos() {
  const navigate = useNavigate();
  const [depositOpen, setDepositOpen] = useState(false);
  const [pixOpen, setPixOpen] = useState(false);
  const [pixAmountCents, setPixAmountCents] = useState(0);
  // A cotação só é buscada quando o depósito abre — o atalho aparece em duas
  // telas e nenhuma delas precisa do dólar pra desenhar quatro botões.
  const usdBrlQuote = useOlefootUsdBrlQuote(depositOpen);

  const atalhos: QuickAction[] = [
    { key: 'deposit', label: 'Depositar', icon: <ArrowDown className="h-5 w-5" strokeWidth={2.2} />, accent: 'green', onClick: () => setDepositOpen(true) },
    { key: 'collection', label: 'Coleção', icon: <Layers className="h-5 w-5" strokeWidth={2.2} />, onClick: () => navigate('/wallet/colecao') },
    { key: 'network', label: 'Network', icon: <Network className="h-5 w-5" strokeWidth={2.2} />, onClick: () => navigate('/wallet/network') },
    { key: 'extract', label: 'Extrato', icon: <Menu className="h-5 w-5" strokeWidth={2.2} />, onClick: () => navigate('/wallet/extract') },
  ];

  return (
    <>
      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        quote={usdBrlQuote}
        onContinueToPix={(cents) => {
          setPixAmountCents(cents);
          setPixOpen(true);
        }}
      />
      <PixCheckoutModal
        open={pixOpen}
        productKind="recharge"
        amountCents={pixAmountCents}
        title="Depósito Olefoot"
        description={`Saldo BRO instantâneo após confirmação · R$ ${(pixAmountCents / 100).toFixed(2).replace('.', ',')}`}
        onClose={() => setPixOpen(false)}
        onSuccess={() => {
          setPixOpen(false);
          // O Layout só resgata ao MONTAR e quando a sessão muda. Quem pagava e
          // continuava na tela via o saldo parado até recarregar.
          void applyPendingCredits();
        }}
      />
      <WalletQuickActions actions={atalhos} />
    </>
  );
}
