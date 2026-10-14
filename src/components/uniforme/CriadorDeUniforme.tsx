/**
 * O CRIADOR DE UNIFORME (14/10/2026) — camisa em peças, na Fundação e no Clube.
 *
 * Controlado: recebe a camisa e devolve a camisa nova a cada toque. Peças:
 * corpo (cor + padrão), mangas, calção e meião (cor), gola, punho, manga longa,
 * texto do peito. Paleta do jogo + cor livre. Frente e costas ao vivo.
 */
import { useState } from 'react';
import { L } from '@/i18n/L';
import { cn } from '@/lib/utils';
import { SecaoRua } from '@/components/ui/Rua';
import {
  CORES_DE_CAMISA, GOLAS, PADROES, corDaManga, corDoMeiao, golaDe, temPunho,
  type CamisaDoClube,
} from '@/club/camisa';
import { UniformeSVG } from './UniformeSVG';

type Peca = 'corpo' | 'mangas' | 'calcao' | 'meiao';

interface Props {
  camisa: CamisaDoClube;
  onChange: (c: CamisaDoClube) => void;
  iniciais: string;
  /** Costas: nome e número de um jogador do elenco (ausentes = a sigla e o 10). */
  nome?: string;
  numero?: string | number;
}

export function CriadorDeUniforme({ camisa, onChange, iniciais, nome, numero }: Props) {
  const [peca, setPeca] = useState<Peca>('corpo');
  const muda = (p: Partial<CamisaDoClube>) => onChange({ ...camisa, ...p });

  const corDaPeca = peca === 'corpo' ? camisa.primaria : peca === 'mangas' ? corDaManga(camisa) : peca === 'calcao' ? camisa.calcao : corDoMeiao(camisa);
  const pintar = (cor: string) => {
    if (peca === 'corpo') muda({ primaria: cor });
    else if (peca === 'mangas') muda({ manga: cor });
    else if (peca === 'calcao') muda({ calcao: cor });
    else muda({ meiao: cor });
  };
  const PECAS: { k: Peca; nome: string; cor: string }[] = [
    { k: 'corpo', nome: L('Corpo', 'Body'), cor: camisa.primaria },
    { k: 'mangas', nome: L('Mangas', 'Sleeves'), cor: corDaManga(camisa) },
    { k: 'calcao', nome: L('Calção', 'Shorts'), cor: camisa.calcao },
    { k: 'meiao', nome: L('Meião', 'Socks'), cor: corDoMeiao(camisa) },
  ];

  const Paleta = ({ atual, escolher, rotulo, id }: { atual: string; escolher: (c: string) => void; rotulo: string; id: string }) => (
    <div className="flex flex-wrap items-center gap-2">
      {CORES_DE_CAMISA.map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={atual.toLowerCase() === c.toLowerCase()}
          aria-label={`${rotulo} ${c}`}
          onClick={() => escolher(c)}
          className={cn('h-9 w-9 border-2 border-linha', atual.toLowerCase() === c.toLowerCase() && 'outline outline-[3px] outline-offset-2 outline-rua')}
          style={{ background: c }}
        />
      ))}
      <label className="flex h-9 items-center gap-1.5 border-2 border-linha bg-concreto px-1.5 font-prova text-[10px] uppercase tracking-[0.1em] text-mudo">
        <input id={id} type="color" value={atual} onChange={(e) => escolher(e.target.value.toUpperCase())} className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0" aria-label={L(`${rotulo}: cor livre`, `${rotulo}: any colour`)} />
        {L('Livre', 'Any')}
      </label>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 items-end gap-3 bg-concreto px-3 py-4">
        <figure className="m-0 flex flex-col items-center gap-1">
          <UniformeSVG camisa={camisa} iniciais={iniciais} nome={nome} numero={numero} largura={150} rotulo={L('Uniforme: frente', 'Kit: front')} />
          <figcaption className="font-prova text-[10px] uppercase tracking-[0.16em] text-mudo">{L('Frente', 'Front')}</figcaption>
        </figure>
        <figure className="m-0 flex flex-col items-center gap-1">
          <UniformeSVG camisa={camisa} vista="costas" iniciais={iniciais} nome={nome} numero={numero} largura={150} rotulo={L('Uniforme: costas', 'Kit: back')} />
          <figcaption className="font-prova text-[10px] uppercase tracking-[0.16em] text-mudo">{L('Costas', 'Back')}</figcaption>
        </figure>
      </div>

      <div className="flex flex-col gap-2.5">
        <SecaoRua label={L('Peça', 'Piece')} />
        <div className="grid grid-cols-4 gap-2" role="group" aria-label={L('Peça que você está pintando', 'Piece you are painting')}>
          {PECAS.map((p) => (
            <button
              key={p.k}
              type="button"
              aria-pressed={peca === p.k}
              onClick={() => setPeca(p.k)}
              className={cn('flex min-h-[48px] flex-col items-center justify-center gap-1 border-[3px] bg-concreto px-1 py-1.5 font-prova text-[10px] font-bold uppercase tracking-[0.08em]', peca === p.k ? 'border-rua text-papel' : 'border-transparent text-mudo')}
            >
              <span aria-hidden className="h-3 w-full border border-asfalto-27" style={{ background: p.cor }} />
              {p.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <SecaoRua label={L(`Cor — ${PECAS.find((p) => p.k === peca)!.nome}`, `Colour — ${PECAS.find((p) => p.k === peca)!.nome}`)} />
        <Paleta atual={corDaPeca} escolher={pintar} rotulo={PECAS.find((p) => p.k === peca)!.nome} id={`uni-cor-${peca}`} />
      </div>

      <div className="flex flex-col gap-2.5">
        <SecaoRua label={L('Cor do detalhe (padrão, gola, punho, número do calção)', 'Detail colour (pattern, collar, cuffs)')} />
        <Paleta atual={camisa.secundaria} escolher={(c) => muda({ secundaria: c })} rotulo={L('Cor do detalhe', 'Detail colour')} id="uni-cor-detalhe" />
      </div>

      <div className="flex flex-col gap-2.5">
        <SecaoRua label={L('Padrão do corpo', 'Body pattern')} />
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {PADROES.map(({ k, pt, en }) => (
            <button
              key={k}
              type="button"
              aria-pressed={camisa.padrao === k}
              onClick={() => muda({ padrao: k })}
              className={cn('flex min-w-0 flex-col items-center gap-0.5 border-[3px] bg-concreto px-1 pb-1 pt-1.5', camisa.padrao === k ? 'border-rua' : 'border-transparent')}
            >
              <UniformeSVG camisa={{ ...camisa, padrao: k }} iniciais="" largura={46} soCamisa />
              <span className="font-prova text-[9.5px] font-bold uppercase tracking-[0.06em] text-mudo">{L(pt, en)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <SecaoRua label={L('Gola e mangas', 'Collar and sleeves')} />
        <div className="flex flex-wrap gap-2">
          {GOLAS.map(({ k, pt, en }) => (
            <button
              key={k}
              type="button"
              aria-pressed={golaDe(camisa) === k}
              onClick={() => muda({ gola: k })}
              className={cn('min-h-[40px] border-2 px-3 font-prova text-[12px]', golaDe(camisa) === k ? 'border-rua text-rua' : 'border-linha text-papel')}
            >
              {L(pt, en)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 font-prova text-[12px]">
          <label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[var(--color-rua)]" checked={!!camisa.mangaLonga} onChange={(e) => muda({ mangaLonga: e.target.checked })} />{L('Manga longa', 'Long sleeves')}</label>
          <label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[var(--color-rua)]" checked={temPunho(camisa)} onChange={(e) => muda({ punho: e.target.checked })} />{L('Punho no detalhe', 'Contrast cuffs')}</label>
          <label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[var(--color-rua)]" checked={!!camisa.padraoNasMangas} onChange={(e) => muda({ padraoNasMangas: e.target.checked })} />{L('Padrão nas mangas', 'Pattern on sleeves')}</label>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <SecaoRua label={L('Texto do peito', 'Chest text')} />
        <input
          id="uni-peito"
          value={camisa.peito ?? iniciais}
          maxLength={12}
          onChange={(e) => muda({ peito: e.target.value.toUpperCase().replace(/[^A-Z0-9À-Ú '!.-]/gi, '').slice(0, 12) })}
          placeholder={iniciais}
          className="min-h-[44px] w-full border-2 border-linha bg-concreto px-3 font-impact text-[20px] uppercase tracking-wide text-papel focus:border-rua focus:outline-none"
        />
        <span className="font-prova text-[11px] text-mudo">{L('No lugar do patrocínio. Até 12 letras; vazio deixa o peito limpo.', 'Where a sponsor would go. Up to 12 letters; empty leaves it clean.')}</span>
      </div>
    </div>
  );
}
