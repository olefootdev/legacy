import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OlefootUsdBrlQuoteState } from '@/wallet/olefootUsdBrlQuote';
import { FormBro } from './FormBro';
import { FormOlefoot, type PedidoOlefoot } from './FormOlefoot';
import { L } from '@/i18n/L';

/**
 * ADICIONAR — a gaveta única de entrada de dinheiro.
 *
 * Eram duas coisas em dois lugares: "Depositar" na carteira do jogo (só BRO) e
 * "Comprar OLEFOOT" na OLEWALLET, que era um aviso mandando voltar pro jogo —
 * onde não existia tela de compra. O mesmo Pix serve pros dois; aqui a pessoa
 * só escolhe O QUE o Pix compra.
 *
 *   BRO      crédito do jogo. 1 BRO = 1 dólar. Aparece na conta SPOT.
 *   OLEFOOT  o token, na pré-venda. Entra travado. Aparece na conta DEX.
 */
export type Produto = 'bro' | 'olefoot';

export type { PedidoOlefoot };

export function AdicionarModal({
  aberto,
  produtoInicial,
  packInicial,
  quote,
  onFechar,
  onPagarBro,
  onPagarOlefoot,
}: {
  aberto: boolean;
  produtoInicial: Produto;
  packInicial?: number;
  quote: OlefootUsdBrlQuoteState;
  onFechar: () => void;
  onPagarBro: (brlCents: number) => void;
  onPagarOlefoot: (pedido: PedidoOlefoot) => void;
}) {
  const [produto, setProduto] = useState<Produto>(produtoInicial);

  // Reabrir pela outra porta (o botão do NETWORK, o link da OLEWALLET) tem que
  // cair no produto pedido, não no último que a pessoa olhou.
  useEffect(() => {
    if (aberto) setProduto(produtoInicial);
  }, [aberto, produtoInicial]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-[190] flex items-end justify-center bg-black/85 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={L('Adicionar', 'Add')}
      onClick={(e) => e.target === e.currentTarget && onFechar()}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex max-h-[92dvh] w-full max-w-md flex-col border-t-[3px] border-rua bg-asfalto-27 sm:border-[3px]"
      >
        {/* DS 2027: alambrado no topo da gaveta — a peça é de ação (rua). */}
        <div className="relative flex items-center justify-between gap-3 px-5 pb-4 pt-5">
          <div aria-hidden className="rua-alambrado pointer-events-none absolute inset-x-0 top-0 h-16 [--alambrado:rgba(242,230,30,.16)]" />
          <div className="relative flex min-w-0 flex-col gap-1">
            <p className="font-prova text-[11.5px] font-bold uppercase tracking-[0.22em] text-mudo">— Pix</p>
            <h2 className="font-voz text-[clamp(38px,11vw,48px)] leading-[0.92] text-papel">{L('Adicionar', 'Add')}</h2>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center border-2 border-linha text-mudo transition-colors hover:border-papel hover:text-papel"
            aria-label={L('Fechar', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-5 grid grid-cols-2 border-2 border-linha p-0.5" role="tablist" aria-label={L('O que adicionar', 'What to add')}>
          {(['bro', 'olefoot'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={produto === p}
              onClick={() => setProduto(p)}
              className={cn(
                'min-h-[46px] text-center font-impact text-[20px] uppercase leading-none transition-colors',
                produto === p ? 'bg-rua text-asfalto-27' : 'text-mudo hover:text-papel',
              )}
            >
              {p === 'bro' ? 'BRO' : 'OLEFOOT'}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {produto === 'bro' ? (
            <FormBro quote={quote} onPagar={onPagarBro} />
          ) : (
            <FormOlefoot packInicial={packInicial} onPagar={onPagarOlefoot} onFechar={onFechar} />
          )}
        </div>
      </motion.div>
    </div>
  );
}
