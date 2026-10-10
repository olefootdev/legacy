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
import type { DecisaoNoCampo, Ficha, NumerosAoVivo, QuadroAoVivo } from './tipos';
import type { LeituraDaPrancheta } from './prancheta';
import { nomeDaSkill, type SkillEmCampo } from './skills';

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
  const forte = decisao.tipo === 'decisivo' || decisao.tipo === 'lesao' || decisao.tipo === 'expulsao' || decisao.tipo === 'penalti';
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto" role="group" aria-label={decisao.titulo}>
      {decisao.tipo === 'decisivo' ? (
        // O campo congela esperando a escolha: o título diz que é com você (não é trava).
        <span className="-mx-0.5 bg-rua px-1.5 py-1 font-impact text-[20px] uppercase leading-none text-asfalto-27">
          {L('Sua decisão', 'Your call')}
          <span className="block font-prova text-[10px] normal-case">{decisao.titulo}</span>
        </span>
      ) : (
        <span className={`self-start px-1.5 py-0.5 font-prova text-[11px] ${forte ? 'bg-rua text-asfalto-27' : 'bg-cal text-asfalto-27'}`}>
          {decisao.titulo}
        </span>
      )}
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

export const GRITOS: { id: string; rotulo: string; efeito: string }[] = [
  { id: 'incentivar', rotulo: L('Incentivar', 'Fire up'), efeito: L('mais ímpeto · cansa', 'more drive · tires') },
  { id: 'cobrar', rotulo: L('Cobrar', 'Demand'), efeito: L('aperta a saída · mais falta', 'presses · more fouls') },
  { id: 'acalmar', rotulo: L('Acalmar', 'Calm down'), efeito: L('toca a bola · acelera menos', 'keeps the ball · slower') },
];

export const ORDENS: { id: string; rotulo: string }[] = [
  { id: 'segurar', rotulo: L('Segurar posição', 'Hold position') },
  { id: 'atacar_espaco', rotulo: L('Atacar o espaço', 'Attack the space') },
  { id: 'marcar', rotulo: L('Marcar de perto', 'Mark tight') },
];

export function PainelTatica({ atual, onEscolher, onFechar, minuto = 0, grito, gritoLivreEm = 0, onGritar }: {
  atual?: string; onEscolher: (id: string) => void; onFechar: () => void;
  minuto?: number; grito?: { tipo: string; ate: number } | null; gritoLivreEm?: number; onGritar?: (id: string) => void;
}) {
  const falta = Math.max(0, gritoLivreEm - minuto);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto" role="group" aria-label={L('Estilo de jogo', 'Playing style')}>
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
      {onGritar && (
        <>
          <span className="mt-1 self-start bg-cal px-1.5 py-0.5 font-prova text-[11px] text-asfalto-27">
            {L('Grito', 'Shout')}{falta > 0 ? ` · ${falta}′` : ''}
          </span>
          {GRITOS.map((g) => (
            <button
              key={g.id}
              type="button"
              disabled={falta > 0}
              aria-pressed={grito?.tipo === g.id}
              onClick={() => onGritar(g.id)}
              className={`${BOTAO} ${grito?.tipo === g.id ? 'border-papel bg-rua text-asfalto-27' : falta > 0 ? 'border-linha bg-concreto text-fio' : 'border-linha bg-concreto text-papel hover:border-papel'}`}
            >
              {g.rotulo}
              <span className={`block ${grito?.tipo === g.id ? '' : 'text-mudo'}`}>{g.efeito}</span>
            </button>
          ))}
          <p className="text-[11px] leading-snug text-mudo">{L('Vale 10 minutos. Um grito a cada 15.', 'Lasts 10 minutes. One shout every 15.')}</p>
        </>
      )}
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

// (fôlego sempre inteiro na tela — a fadiga do elenco vem com casas decimais)
export function CartaoFicha({ f, onFechar, ordem, onOrdem, onSubstituir, seguindo, onSeguir }: {
  f: Ficha; onFechar: () => void; ordem?: string; onOrdem?: (id: string) => void; onSubstituir?: () => void;
  seguindo?: boolean; onSeguir?: () => void;
}) {
  const folego = Math.round(Math.max(0, 100 - f.fadiga));
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
      {onSeguir && (
        <button type="button" onClick={onSeguir} aria-pressed={seguindo} className={`${BOTAO} ${seguindo ? 'border-papel bg-rua text-asfalto-27' : 'border-linha bg-concreto text-papel'}`}>
          {seguindo ? L('Câmera do jogo', 'Match camera') : L('Câmera do Craque 🎥', 'Star Cam 🎥')}
        </button>
      )}
      {f.lado === 'home' && onOrdem ? (
        <div className="flex flex-col gap-1" role="group" aria-label={L('Ordem individual', 'Individual order')}>
          {ORDENS.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={ordem === o.id}
              onClick={() => onOrdem(o.id)}
              className={`${BOTAO} ${ordem === o.id ? 'border-papel bg-rua text-asfalto-27' : 'border-linha bg-concreto text-papel hover:border-papel'}`}
            >
              {o.rotulo}
            </button>
          ))}
          {onSubstituir && (
            <button type="button" onClick={onSubstituir} className={`${BOTAO} mt-1 border-papel bg-concreto text-papel`}>
              {L('Substituir ⇄', 'Substitute ⇄')}
            </button>
          )}
        </div>
      ) : (
        <p className="text-[11px] leading-snug text-fio">{f.lado === 'home' ? '' : L('Adversário', 'Opponent')}</p>
      )}
    </div>
  );
}

/**
 * Fase 10 — a skill com nome, no trilho (nunca por cima do campo). Altura fixa:
 * o trilho não pula quando ela aparece ou some. Mostra o nome, quem fez e a nota
 * do atributo que justifica (a "inteligência" da skill).
 */
export function SkillNoTrilho({ skill }: { skill: SkillEmCampo | null }) {
  const n = skill ? nomeDaSkill(skill.codigo) : null;
  return (
    <div className="h-[42px] shrink-0" aria-live="polite">
      {skill && n && (
        <div key={skill.id} className={`flex h-full flex-col justify-center border-l-[3px] px-1.5 ${skill.lado === 'home' ? 'border-rua' : 'border-cal'}`}>
          <span className={`truncate font-voz text-[17px] leading-none ${skill.lado === 'home' ? 'text-rua' : 'text-cal'}`}>✦ {n.nome}</span>
          <span className="mt-0.5 truncate text-[10px] leading-none text-mudo">
            {skill.jogador}{skill.nota ? ` · ${n.atributo} ${skill.nota}` : ''}
          </span>
        </div>
      )}
    </div>
  );
}

/** Fase 12 — os números da partida no trilho: compactos, casa × fora. */
export function NumerosNoTrilho({ n }: { n: NumerosAoVivo }) {
  const linha = (rotulo: string, casa: string | number, fora: string | number) => (
    <div className="flex items-baseline justify-between gap-1">
      <span className="text-mudo">{rotulo}</span>
      <span className="tabular-nums text-papel">{casa}<span className="text-mudo"> × </span>{fora}</span>
    </div>
  );
  return (
    <div className="mt-1.5 flex flex-col gap-[1px] font-prova text-[10px] leading-tight" aria-label={L('Números da partida', 'Match stats')}>
      {linha(L('Posse', 'Poss.'), `${n.posse}%`, `${100 - n.posse}%`)}
      {linha(L('Chutes', 'Shots'), n.chutes[0], n.chutes[1])}
      {linha('xG', n.xg[0].toFixed(1), n.xg[1].toFixed(1))}
      {linha(L('Escant.', 'Corners'), n.escanteios[0], n.escanteios[1])}
    </div>
  );
}

export type Reserva = { id: string; nome: string; pos: string; ovr: number; fadiga: number };

const ORDEM_DAS_POSICOES = ['gol', 'ld', 'zag1', 'zag2', 'le', 'vol', 'mc1', 'mc2', 'pe', 'pd', 'ata'];
const SIGLA_DO_SLOT: Record<string, string> = {
  gol: 'GOL', ld: 'LD', zag1: 'ZAG', zag2: 'ZAG', le: 'LE', vol: 'VOL', mc1: 'MC', mc2: 'MC', pe: 'PE', pd: 'PD', ata: 'ATA',
};

/**
 * SUBSTITUIÇÃO (pedido do fundador 10/10): duas listas no trilho —
 * EM CAMPO (por posição, com fôlego) e NO BANCO. Toca em quem sai e em quem
 * entra (qualquer ordem; quem sai também pode ser tocado no campo) → "Trocar".
 * A troca vale na hora no campo e o servidor refaz o futuro com quem entrou.
 */
export function PainelSubstituicao({ emCampo, banco, rostos, restantes, sai, entra, onSai, onEntra, onTrocar, onFechar }: {
  emCampo: Ficha[]; banco: Reserva[]; rostos: Map<string, Ficha>; restantes: number;
  sai: string | null; entra: string | null;
  onSai: (id: string) => void; onEntra: (id: string) => void; onTrocar: () => void; onFechar: () => void;
}) {
  const ordenados = [...emCampo].sort((a, b) => ORDEM_DAS_POSICOES.indexOf(a.slot) - ORDEM_DAS_POSICOES.indexOf(b.slot));
  const quemSai = emCampo.find((f) => f.id === sai);
  const quemEntra = banco.find((b) => b.id === entra);
  const linha = 'flex w-full items-center gap-1.5 border px-1.5 py-1 text-left';
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5" role="group" aria-label={L('Substituição', 'Substitution')}>
      <div className="flex items-center justify-between">
        <span className="bg-cal px-1.5 py-0.5 font-prova text-[11px] text-asfalto-27">{L('Trocas', 'Subs')} · {restantes}</span>
        <button type="button" onClick={onFechar} aria-label={L('Fechar', 'Close')} className="px-1 text-mudo">✕</button>
      </div>
      {quemSai && quemEntra ? (
        <button type="button" onClick={onTrocar} className="border border-papel bg-rua px-1.5 py-1.5 text-left font-prova text-[11px] leading-tight text-asfalto-27 shadow-[3px_3px_0_var(--color-papel)]">
          <span className="block font-impact text-[15px] uppercase">⇄ {L('Trocar', 'Swap')}</span>
          <span className="block truncate">{quemSai.nome} → {quemEntra.nome}</span>
        </button>
      ) : (
        <p className="text-[11px] leading-snug text-mudo">
          {restantes <= 0 ? L('Sem trocas.', 'No subs left.') : L('Toque em quem sai e em quem entra.', 'Tap who comes off and who goes on.')}
        </p>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden">
        <span className="font-prova text-[10px] uppercase tracking-wider text-mudo">{L('Em campo', 'On field')}</span>
        {ordenados.map((f) => {
          const folego = Math.round(Math.max(0, 100 - f.fadiga));
          const marcado = sai === f.id;
          return (
            <button key={f.id} type="button" disabled={restantes <= 0} aria-pressed={marcado} onClick={() => onSai(f.id)}
              className={`${linha} ${marcado ? 'border-papel bg-cal text-asfalto-27' : 'border-linha bg-concreto text-papel'}`}>
              <span className={`w-7 shrink-0 font-prova text-[10px] ${marcado ? '' : 'text-mudo'}`}>{SIGLA_DO_SLOT[f.slot] ?? f.slot}</span>
              <span className="min-w-0 flex-1 truncate text-[11px]">{f.nome}</span>
              <span className={`shrink-0 text-[10px] tabular-nums ${folego < 50 ? 'text-[#E0703A]' : marcado ? '' : 'text-mudo'}`}>{folego}%</span>
            </button>
          );
        })}
        <span className="mt-1 font-prova text-[10px] uppercase tracking-wider text-mudo">{L('No banco', 'On bench')}</span>
        {banco.map((b) => {
          const f = rostos.get(b.id);
          const marcado = entra === b.id;
          return (
            <button key={b.id} type="button" disabled={restantes <= 0} aria-pressed={marcado} onClick={() => onEntra(b.id)}
              className={`${linha} ${marcado ? 'border-papel bg-rua text-asfalto-27' : 'border-linha bg-concreto text-papel'}`}>
              {f ? <Rosto f={f} tam={20} /> : <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rua font-impact text-[9px] text-asfalto-27">{iniciais(b.nome)}</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] leading-tight">{b.nome}</span>
                <span className={`block text-[10px] leading-tight ${marcado ? '' : 'text-mudo'}`}>{b.pos} · {Math.round(b.ovr)} · {Math.round(Math.max(0, 100 - b.fadiga))}%</span>
              </span>
            </button>
          );
        })}
        {!banco.length && <span className="text-[11px] text-mudo">{L('Ninguém no banco.', 'Bench is empty.')}</span>}
      </div>
    </div>
  );
}

/** Câmera do Craque (Fase 6): escolha quem a câmera segue a partida inteira. */
export function PainelCamera({ fichas, seguindo, onSeguir, onFechar }: {
  fichas: Ficha[]; seguindo: string | null; onSeguir: (id: string | null) => void; onFechar: () => void;
}) {
  const ordem = [...fichas].sort((a, b) => (a.lado === b.lado ? 0 : a.lado === 'home' ? -1 : 1));
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5" role="group" aria-label={L('Câmera do Craque', 'Star Cam')}>
      <div className="flex items-center justify-between">
        <span className="bg-cal px-1.5 py-0.5 font-prova text-[11px] text-asfalto-27">{L('Câmera do Craque', 'Star Cam')}</span>
        <button type="button" onClick={onFechar} aria-label={L('Fechar', 'Close')} className="px-1 text-mudo">✕</button>
      </div>
      <button type="button" onClick={() => onSeguir(null)} aria-pressed={!seguindo} className={`${BOTAO} ${!seguindo ? 'border-papel bg-rua text-asfalto-27' : 'border-linha bg-concreto text-papel'}`}>
        {L('Câmera do jogo', 'Match camera')}
      </button>
      <ol className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {ordem.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              aria-pressed={seguindo === f.id}
              onClick={() => onSeguir(f.id)}
              className={`flex w-full items-center gap-1.5 border px-1.5 py-1 text-left ${seguindo === f.id ? 'border-papel bg-rua text-asfalto-27' : 'border-linha bg-concreto text-papel'}`}
            >
              <Rosto f={f} tam={22} />
              <span className="min-w-0 flex-1 truncate text-[11px]">{f.nome}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Prancheta (Fase 4c): o jogo parado, a leitura em palavras, e a volta. */
export function PainelPrancheta({ leitura, onVoltar }: { leitura: LeituraDaPrancheta | null; onVoltar: () => void }) {
  const livres = leitura?.passes.filter((p) => p.livre).length ?? 0;
  const total = leitura?.passes.length ?? 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5" role="group" aria-label={L('Prancheta', 'Tactics board')}>
      <span className="self-start bg-rua px-1.5 py-0.5 font-prova text-[11px] text-asfalto-27">{L('Prancheta · jogo parado', 'Board · paused')}</span>
      {leitura && (
        <ul className="flex flex-col gap-1 text-[11px] leading-snug">
          <li>{L(`Nosso bloco: ${leitura.bloco.home} m`, `Our block: ${leitura.bloco.home} m`)}</li>
          <li>{L(`Bloco deles: ${leitura.bloco.away} m`, `Their block: ${leitura.bloco.away} m`)}</li>
          {total > 0 && <li>{L(`Passes livres: ${livres} de ${total}`, `Open passes: ${livres} of ${total}`)}</li>}
          {leitura.entrelinhas && <li className="text-rua">{L(`Entrelinhas deles: ${Math.round(leitura.entrelinhas.x1 - leitura.entrelinhas.x0)} m`, `Their gap between lines: ${Math.round(leitura.entrelinhas.x1 - leitura.entrelinhas.x0)} m`)}</li>}
          {leitura.buraco && <li className="text-rua">{L('Buraco na linha de defesa deles', 'Gap in their back line')}</li>}
        </ul>
      )}
      <p className="text-[11px] leading-snug text-mudo">{L('Mexa na Tática, no Banco ou toque num jogador. O jogo espera.', 'Use Tactics, Bench or tap a player. The game waits.')}</p>
      <button type="button" onClick={onVoltar} className={`${BOTAO} mt-auto border-rua bg-rua text-center text-asfalto-27`}>
        {L('Voltar ao jogo ▶', 'Back to the game ▶')}
      </button>
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

/**
 * O LAMBE DO GOL (DS 2027 "rua"): papel cal colado torto no muro, sombra DURA
 * deslocada (sem blur), foto do autor no selo redondo, GOL em Anton, nome na voz,
 * fita amarela com minuto e placar. Ocupa o trilho inteiro enquanto o gol é
 * celebrado (o cabeçalho recolhe) — nunca espremido nem cortado.
 */
export function LambeDoGol({ quadro, autor, nome }: { quadro: QuadroAoVivo | null; autor?: Ficha; nome: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-start justify-center pt-1">
      <div className="relative flex w-[94%] -rotate-3 flex-col items-center bg-cal px-2 pb-3 pt-2.5 text-asfalto-27 shadow-[4px_4px_0_var(--color-rua)]">
        <div className="flex aspect-square w-[62%] max-w-[88px] items-center justify-center overflow-hidden rounded-full border-[3px] border-asfalto-27 bg-rua">
          {autor?.rosto
            ? <img src={autor.rosto} alt="" className="h-full w-full object-cover grayscale" />
            : <span className="font-impact text-[26px]">{autor?.iniciais ?? iniciais(nome)}</span>}
        </div>
        <span className="mt-1 font-impact leading-[0.9]" style={{ fontSize: 'clamp(28px, 2.6vw, 44px)' }}>{L('GOL', 'GOAL')}</span>
        <span className="max-w-full truncate font-voz text-[19px] leading-none">{autor?.nome ?? nome}</span>
        <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 rotate-3 whitespace-nowrap bg-rua px-2 py-0.5 font-prova text-[11px] font-bold">
          {quadro?.minuto}&prime; · {quadro?.placarCasa} × {quadro?.placarFora}
        </span>
      </div>
    </div>
  );
}
