/**
 * PARTIDA VIVA — o que mora no trilho esquerdo (Fase 4).
 *
 * Um "slot de contexto" mostra UMA coisa por vez, nesta prioridade:
 *   decisão em aberto → lambe do gol → tática → cartão do jogador → narração.
 * Nada disso cobre o campo (regra dos trilhos, docs/PARTIDA-VIVA-PLANO.md §4.3.1).
 */
import { useEffect, useState } from 'react';
import { L } from '@/i18n/L';
import { nomeDaClasse, DESCRICAO_DA_CLASSE } from '@/smartProfile/rotulos';
import { iniciais } from './escalacao';
import type { DecisaoNoCampo, Ficha, QuadroAoVivo } from './tipos';

const BOTAO = 'w-full border px-2 py-1.5 text-left font-prova text-[11px] leading-snug';

/** Estilos do dock da Rápida (mesma ordem: defesa → ataque). */
export const ESTILOS: { id: string; rotulo: string }[] = [
  { id: 'defend', rotulo: L('Retranca', 'Park the bus') },
  { id: 'counter', rotulo: L('Contra-ataque', 'Counter') },
  { id: 'possession', rotulo: L('Posse', 'Possession') },
  { id: 'press', rotulo: L('Pressão', 'Press') },
  { id: 'attack', rotulo: L('Ataque', 'Attack') },
];

function Prazo({ chave, ms }: { chave: string; ms: number }) {
  const [inicio, setInicio] = useState(() => performance.now());
  const [agora, setAgora] = useState(inicio);
  useEffect(() => { const t0 = performance.now(); setInicio(t0); setAgora(t0); }, [chave]);
  useEffect(() => {
    let raf = 0;
    const tique = () => { setAgora(performance.now()); raf = requestAnimationFrame(tique); };
    raf = requestAnimationFrame(tique);
    return () => cancelAnimationFrame(raf);
  }, [chave]);
  const resta = Math.max(0, 1 - (agora - inicio) / ms);
  return (
    <div className="h-[3px] bg-linha" aria-hidden>
      <div className="h-[3px] bg-rua" style={{ width: `${resta * 100}%` }} />
    </div>
  );
}

export function PainelDecisao({ decisao, protagonista, onResponder }: {
  decisao: DecisaoNoCampo; protagonista?: Ficha; onResponder: (id: string) => void;
}) {
  const forte = decisao.tipo === 'decisivo' || decisao.tipo === 'lesao' || decisao.tipo === 'expulsao';
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto" role="group" aria-label={decisao.titulo}>
      <span className={`self-start px-1.5 py-0.5 font-prova text-[11px] ${forte ? 'bg-rua text-asfalto-27' : 'bg-cal text-asfalto-27'}`}>
        {decisao.titulo}
      </span>
      {protagonista && (
        <div className="flex items-center gap-1.5">
          <Rosto f={protagonista} tam={30} />
          <span className="font-voz text-[17px] leading-none">{protagonista.nome}</span>
        </div>
      )}
      <p className="text-[12px] leading-snug text-papel">{decisao.texto}</p>
      {decisao.prazoMs ? <Prazo chave={decisao.chave} ms={decisao.prazoMs} /> : null}
      {decisao.opcoes.map((o, i) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onResponder(o.id)}
          className={`${BOTAO} ${i === 0 && forte ? 'border-rua bg-rua text-asfalto-27' : 'border-linha bg-concreto text-papel hover:border-papel'}`}
        >
          {o.rotulo}
          {o.detalhe && <span className="block text-mudo">{o.detalhe}</span>}
        </button>
      ))}
    </div>
  );
}

export function PainelTatica({ atual, onEscolher, onFechar }: { atual?: string; onEscolher: (id: string) => void; onFechar: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5" role="group" aria-label={L('Estilo de jogo', 'Playing style')}>
      <div className="flex items-center justify-between">
        <span className="bg-cal px-1.5 py-0.5 font-prova text-[11px] text-asfalto-27">{L('Estilo', 'Style')}</span>
        <button type="button" onClick={onFechar} aria-label={L('Fechar', 'Close')} className="px-1 text-mudo">✕</button>
      </div>
      {ESTILOS.map((e) => (
        <button
          key={e.id}
          type="button"
          aria-pressed={atual === e.id}
          onClick={() => onEscolher(e.id)}
          className={`${BOTAO} ${atual === e.id ? 'border-papel bg-rua text-asfalto-27' : 'border-linha bg-concreto text-papel'}`}
        >
          {e.rotulo}
        </button>
      ))}
      <p className="text-[11px] leading-snug text-mudo">{L('O time muda de forma na hora; o resultado sente nos próximos lances.', 'The team reshapes instantly; the result feels it in the next plays.')}</p>
    </div>
  );
}

function Rosto({ f, tam }: { f: Ficha; tam: number }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full ${f.lado === 'home' ? 'bg-rua' : 'border border-cal bg-asfalto-27'}`}
      style={{ width: tam, height: tam }}
    >
      {f.rosto
        ? <img src={f.rosto} alt="" className="h-[86%] w-[86%] rounded-full object-cover" />
        : <span className={`font-impact ${f.lado === 'home' ? 'text-asfalto-27' : 'text-papel'}`} style={{ fontSize: tam * 0.38 }}>{f.iniciais}</span>}
    </div>
  );
}

export function CartaoFicha({ f, onFechar }: { f: Ficha; onFechar: () => void }) {
  const folego = Math.max(0, 100 - f.fadiga);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Rosto f={f} tam={36} />
        <span className="min-w-0 flex-1 truncate font-voz text-[18px] leading-none">{f.nome}</span>
        <button type="button" onClick={onFechar} aria-label={L('Fechar', 'Close')} className="px-1 text-mudo">✕</button>
      </div>
      {f.classe && (
        <>
          <span className="self-start bg-cal px-1.5 py-0.5 font-prova text-[11px] text-asfalto-27">{nomeDaClasse(f.classe)}</span>
          <p className="text-[11px] leading-snug text-mudo">{DESCRICAO_DA_CLASSE[f.classe] ?? ''}</p>
        </>
      )}
      <div>
        <div className="mb-1 text-suave">{L('Fôlego', 'Stamina')} {folego}%</div>
        <div className="h-1 bg-linha"><div className={`h-1 ${folego > 50 ? 'bg-papel' : 'bg-[#E0703A]'}`} style={{ width: `${folego}%` }} /></div>
      </div>
      <p className="text-[11px] leading-snug text-fio">{f.lado === 'home' ? L('Ordens individuais chegam numa próxima fase.', 'Individual orders come in a later phase.') : L('Adversário', 'Opponent')}</p>
    </div>
  );
}

export function Narracao({ quadro }: { quadro: QuadroAoVivo | null }) {
  return (
    <ol className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden" aria-live="polite">
      {(quadro?.narracao ?? []).map((n, i) => (
        <li key={n.id} className={i === 0 ? 'text-[12px] leading-snug text-papel' : i < 3 ? 'leading-snug text-mudo' : 'leading-snug text-fio'}>
          {i > 0 && <span>{n.minuto}&prime; </span>}{n.texto.replace(/^\d+'\s*—\s*/, '')}
        </li>
      ))}
      {!quadro?.narracao.length && <li className="text-mudo">{L('Bola rolando…', 'Ball rolling…')}</li>}
    </ol>
  );
}

export function LambeDoGol({ quadro, autor, nome }: { quadro: QuadroAoVivo | null; autor?: Ficha; nome: string }) {
  return (
    <div className="mt-1 flex -rotate-3 flex-col items-center bg-cal p-2 text-asfalto-27">
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-rua">
        {autor?.rosto
          ? <img src={autor.rosto} alt="" className="h-[86%] w-[86%] rounded-full object-cover" />
          : <span className="font-impact text-[22px]">{autor?.iniciais ?? iniciais(nome)}</span>}
      </div>
      <span className="mt-1 font-impact text-[38px] leading-[0.95]">{L('GOL', 'GOAL')}</span>
      <span className="font-voz text-[20px] leading-none">{autor?.nome ?? nome}</span>
      <span className="mt-1.5 rotate-3 bg-rua px-1.5 py-0.5 text-[11px]">
        {quadro?.minuto}&prime; · {quadro?.placarCasa} × {quadro?.placarFora}
      </span>
    </div>
  );
}
