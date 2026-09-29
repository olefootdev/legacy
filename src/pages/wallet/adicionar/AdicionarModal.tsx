import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OlefootUsdBrlQuoteState } from '@/wallet/olefootUsdBrlQuote';
import { FormBro } from './FormBro';
import { FormOlefoot, type PedidoOlefoot } from './FormOlefoot';

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
      className="fixed inset-0 z-[190] flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Adicionar"
      onClick={(e) => e.target === e.currentTarget && onFechar()}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex max-h-[92dvh] w-full max-w-md flex-col border border-white/16 bg-panel"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <h2 className="font-impact text-lg uppercase leading-[1.1] text-white">Adicionar</h2>
          <button
            type="button"
            onClick={onFechar}
            className="p-2 text-cimento hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 border-b border-white/10 p-1" role="tablist" aria-label="O que adicionar">
          {(['bro', 'olefoot'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={produto === p}
              onClick={() => setProduto(p)}
              className={cn(
                'py-2.5 text-center font-mono text-[11.5px] font-medium uppercase tracking-[0.2em] transition-colors',
                produto === p ? 'bg-white text-black' : 'text-cimento hover:text-white',
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
