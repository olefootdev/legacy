import type { ReactNode } from 'react';
import { tradutor } from '@/i18n/idioma';
import { useIdioma } from '@/i18n/useIdioma';
import { TEXTOS } from './textos';

/**
 * A barra de abas: Carteira · Rede.
 *
 * Sem router de biblioteca — a carteira existe pra ser pequena. A aba é estado
 * do App, e a rede (expansão) é a única que sai desta origem, porque o painel
 * é servido pelo jogo (os dados estão no Supabase atrás de RLS e esta origem
 * guarda a frase de 12 palavras). Comprar e Render moraram aqui até a Fase 6:
 * viviam de números copiados do servidor, e agora quem os diz é a aba DEX do
 * jogo, lendo de GET /api/earnings.
 */
export type Aba = 'carteira' | 'rede';

const Icone = ({ d, ativo }: { d: string; ativo: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
       stroke={ativo ? '#FDE100' : '#7E8185'} strokeWidth="2">
    <path d={d} />
  </svg>
);

const CAMINHOS: Record<Aba, string> = {
  carteira: 'M3 6h18v13H3zM16 12h3',
  rede: 'M12 4v6M6 20l6-10 6 10',
};

export function Abas({ atual, ir, linkRede }: {
  atual: Aba; ir: (a: Aba) => void; linkRede: string;
}) {
  const [idioma] = useIdioma();
  const t = tradutor(TEXTOS, idioma);
  const itens: Array<{ id: Aba; rotulo: string }> = [
    { id: 'carteira', rotulo: t('abaCarteira') },
    { id: 'rede', rotulo: t('abaRede') },
  ];

  return (
    <nav className="grid shrink-0 grid-cols-2 border-t border-white/10 bg-nav"
         style={{ height: 62 }} aria-label={t('abaCarteira')}>
      {itens.map((i) => {
        const ativo = atual === i.id;
        const conteudo = (
          <>
            <Icone d={CAMINHOS[i.id]} ativo={ativo} />
            <span className="text-[10px]" style={{ color: ativo ? '#FDE100' : '#7E8185' }}>{i.rotulo}</span>
          </>
        );
        const classe = 'flex flex-col items-center justify-center gap-1';
        // A rede mora no jogo: é <a>, não aba interna.
        return i.id === 'rede' ? (
          <a key={i.id} href={linkRede} className={classe}>{conteudo}</a>
        ) : (
          <button key={i.id} type="button" onClick={() => ir(i.id)} className={classe}
                  aria-current={ativo ? 'page' : undefined}>
            {conteudo}
          </button>
        );
      })}
    </nav>
  );
}

/** Estado honesto: a tela existe, e diz o que falta pra ela funcionar. */
export function AindaNao({ titulo, oQueFalta, children }: {
  titulo: string; oQueFalta: string; children?: ReactNode;
}) {
  return (
    <div className="border border-white/10 bg-panel px-4 py-5">
      <p className="font-num text-[14px] font-extrabold uppercase text-giz">{titulo}</p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-cimento">{oQueFalta}</p>
      {children}
    </div>
  );
}
