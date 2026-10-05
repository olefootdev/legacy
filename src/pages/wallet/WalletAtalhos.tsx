import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDown, Layers, Menu, Network } from 'lucide-react';
import { AdicionarModal, type PedidoOlefoot, type Produto } from './adicionar/AdicionarModal';
import { PixCheckoutModal } from '@/components/PixCheckoutModal';
import { WalletQuickActions, type QuickAction } from './WalletQuickActions';
import { useOlefootUsdBrlQuote } from '@/wallet/useOlefootUsdBrlQuote';
import { applyPendingCredits } from '@/wallet/applyPendingCredits';
import { avisarQueAPosicaoMudou } from '@/wallet/eventosDaCarteira';
import { esquecerConviteVisto } from '@/wallet/conviteVisto';
import { L, LOCALE } from '@/i18n/L';

/**
 * Os quatro atalhos da carteira — os mesmos em SPOT e em DEX.
 *
 * São da CARTEIRA, não de uma das contas: adicionar, coleção, network e
 * extrato valem dos dois lados. Por isso a gaveta mora aqui dentro, com o
 * checkout, em vez de cada tela carregar o seu estado.
 *
 * 🔑 A gaveta abre por TRÊS portas, e as três passam pelo mesmo lugar:
 *   · o atalho Adicionar;
 *   · `?adicionar=olefoot&pack=1000` — o botão "Ativar com $10" do NETWORK;
 *   · `?adicionar=olefoot` — o link que a OLEWALLET manda de fora.
 * Usar o endereço em vez de um estado compartilhado é o que deixa a terceira
 * porta existir: quem vem de outra origem só tem a URL.
 */

// Dólar escrito como o resto da tela: ponto no milhar, vírgula no centavo.
const dolar = (cents: number) =>
  `$${(cents / 100).toLocaleString(LOCALE, {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2,
  })}`;

export function WalletAtalhos() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [gaveta, setGaveta] = useState<{ produto: Produto; pack?: number } | null>(null);
  const [pixBro, setPixBro] = useState<number | null>(null);
  const [pixOlefoot, setPixOlefoot] = useState<PedidoOlefoot | null>(null);

  // A cotação só é buscada com a gaveta aberta — o atalho aparece em duas
  // telas e nenhuma delas precisa do dólar pra desenhar quatro botões.
  const usdBrlQuote = useOlefootUsdBrlQuote(gaveta !== null);

  // Porta 2 e porta 3: o pedido veio no endereço. Abre e LIMPA o endereço —
  // senão recarregar a página reabriria a gaveta, e o voltar do navegador
  // também.
  useEffect(() => {
    const pedido = params.get('adicionar');
    if (pedido !== 'olefoot' && pedido !== 'bro') return;
    const pack = Number(params.get('pack'));
    setGaveta({ produto: pedido, pack: Number.isInteger(pack) && pack > 0 ? pack : undefined });
    const resto = new URLSearchParams(params);
    resto.delete('adicionar');
    resto.delete('pack');
    setParams(resto, { replace: true });
  }, [params, setParams]);

  const atalhos: QuickAction[] = [
    { key: 'add', label: L('Adicionar', 'Add'), icon: <ArrowDown className="h-5 w-5" strokeWidth={2.2} />, accent: 'green', onClick: () => setGaveta({ produto: 'bro' }) },
    { key: 'collection', label: L('Coleção', 'Collection'), icon: <Layers className="h-5 w-5" strokeWidth={2.2} />, onClick: () => navigate('/wallet/colecao') },
    { key: 'network', label: 'Network', icon: <Network className="h-5 w-5" strokeWidth={2.2} />, onClick: () => navigate('/wallet/network') },
    { key: 'extract', label: L('Extrato', 'Statement'), icon: <Menu className="h-5 w-5" strokeWidth={2.2} />, onClick: () => navigate('/wallet/extract') },
  ];

  return (
    <>
      <AdicionarModal
        aberto={gaveta !== null}
        produtoInicial={gaveta?.produto ?? 'bro'}
        packInicial={gaveta?.pack}
        quote={usdBrlQuote}
        onFechar={() => setGaveta(null)}
        onPagarBro={(brlCents) => { setGaveta(null); setPixBro(brlCents); }}
        onPagarOlefoot={(pedido) => { setGaveta(null); setPixOlefoot(pedido); }}
      />

      <PixCheckoutModal
        open={pixBro !== null}
        productKind="recharge"
        amountCents={pixBro ?? 0}
        title={L('Depósito em BRO', 'BRO deposit')}
        description={L('O BRO entra no saldo assim que o Pix cair.', 'Your BRO hits your balance as soon as the Pix clears.')}
        paidMessage={L('Seu BRO já está no saldo.', 'Your BRO is in your balance.')}
        onClose={() => setPixBro(null)}
        onSuccess={() => {
          setPixBro(null);
          // O Layout só resgata ao MONTAR e quando a sessão muda. Quem pagava e
          // continuava na tela via o saldo parado até recarregar.
          void applyPendingCredits();
        }}
      />

      <PixCheckoutModal
        open={pixOlefoot !== null}
        productKind="presale_pack"
        amountCents={pixOlefoot?.brlCents ?? 0}
        usdCents={pixOlefoot?.plano === 'ativacao_3x' ? 1000 : pixOlefoot?.usdCents}
        plano={pixOlefoot?.plano}
        title={pixOlefoot?.plano === 'ativacao_3x' ? L('Ativação 3×', '3× Activation') : L('Comprar OLEFOOT', 'Buy OLEFOOT')}
        description={
          pixOlefoot?.plano === 'ativacao_3x'
            ? L(`${pixOlefoot.recebe.toLocaleString(LOCALE)} OLEFOOT × 3 contas · você + Time 1 + Time 2`, `${pixOlefoot.recebe.toLocaleString(LOCALE)} OLEFOOT × 3 accounts · you + Team 1 + Team 2`)
            : pixOlefoot
              ? L(`${pixOlefoot.recebe.toLocaleString(LOCALE)} OLEFOOT · pack de ${dolar(pixOlefoot.usdCents)}`, `${pixOlefoot.recebe.toLocaleString(LOCALE)} OLEFOOT · ${dolar(pixOlefoot.usdCents)} pack`)
              : ''
        }
        paidMessage={
          pixOlefoot?.plano === 'ativacao_3x'
            ? L('Suas 3 contas estão ativas — 1 em cada time. O bônus já conta.', 'Your 3 accounts are active — 1 on each team. The bonus already counts.')
            : L('Seu OLEFOOT está na sua posição, travado.', 'Your OLEFOOT is in your position, locked.')
        }
        onClose={() => setPixOlefoot(null)}
        onSuccess={() => {
          setPixOlefoot(null);
          // Quem comprou já entrou na árvore: o convite que estava guardado
          // não tem mais o que perguntar.
          esquecerConviteVisto();
          avisarQueAPosicaoMudou();
          navigate('/wallet/dex');
        }}
      />

      <WalletQuickActions actions={atalhos} />
    </>
  );
}
