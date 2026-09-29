import { cn } from '@/lib/utils';

/**
 * Rótulo em cima, valor embaixo.
 *
 * Eram lado a lado. Em 320px, com o número em Archivo expandida, "184.250,43
 * USDT" não cabia ao lado de "Patrimônio do fundo" e a linha cortava o VALOR —
 * o único pedaço que a pessoa veio ler. Empilhado, o valor tem a largura toda.
 */
export function LinhaDeValor({
  rotulo, valor, forte,
}: {
  rotulo: string;
  valor: string;
  forte?: boolean;
}) {
  return (
    <div className="min-w-0 border-b border-white/10 px-4 py-3 last:border-b-0">
      <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-poeira">{rotulo}</div>
      <div
        className={cn(
          'ole-num mt-1 whitespace-nowrap leading-tight tabular-nums',
          forte ? 'text-[18px] text-white' : 'text-[14px] text-giz',
        )}
      >
        {valor}
      </div>
    </div>
  );
}
