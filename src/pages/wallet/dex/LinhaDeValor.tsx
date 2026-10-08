import { cn } from '@/lib/utils';

/**
 * Rótulo em cima, valor embaixo.
 *
 * Eram lado a lado. Em 320px, com o número em Archivo expandida, "184.250,43
 * USDT" não cabia ao lado de "Patrimônio do fundo" e a linha cortava o VALOR —
 * o único pedaço que a pessoa veio ler. Empilhado, o valor tem a largura toda.
 *
 * DS 2027: rótulo em A PROVA (Geist Mono), valor em O GRITO (Anton). `forte` é
 * o valor que é TEU — vai em ouro (degrau RESPEITO).
 */
export function LinhaDeValor({
  rotulo, valor, forte,
}: {
  rotulo: string;
  valor: string;
  forte?: boolean;
}) {
  return (
    <div className="min-w-0 border-b-2 border-linha px-4 py-3.5 last:border-b-0">
      <div className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">{rotulo}</div>
      <div
        className={cn(
          'mt-1.5 whitespace-nowrap font-impact leading-none tabular-nums',
          forte ? 'text-[clamp(26px,7.5vw,34px)] text-ouro-27' : 'text-[20px] text-papel',
        )}
      >
        {valor}
      </div>
    </div>
  );
}
