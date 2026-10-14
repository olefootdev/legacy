/**
 * COMANDO DE VOZ (protótipo, 14/10) — o botão no trilho do campo LEGACY.
 *
 * Toque → fala → o campo mostra "Entendi: …" e o comando cai no MESMO canal dos
 * botões (canal.responder). Troca de jogador espera 2,5 s com "Cancelar" antes
 * de valer (troca não se desfaz). O capitão responde em voz se o som estiver
 * ligado. Sem reconhecimento de fala no navegador: abre um campo pra digitar.
 */
import { useEffect, useRef, useState } from 'react';
import { L, idiomaDoJogo } from '@/i18n/L';
import { FORMATIONS } from '@/match/formacoes';
import type { CanalAoVivo } from '../canal';
import type { Ficha, QuadroAoVivo } from '../tipos';
import { entenderComando, type ContextoDaVoz, type Entendido } from './entender';
import { capitaoFala, ouvir, vozDisponivel, type Escuta } from './microfone';

const CONFIRMA_TROCA_MS = 2500;
const AVISO_MS = 3200;

interface Props {
  canal: CanalAoVivo;
  quadro: QuadroAoVivo | null;
  /** Quem está em campo AGORA (com trocas e fôlego), dos dois lados. */
  corpos: () => Ficha[];
  som: boolean;
}

type Aviso = { texto: string; tom: 'ok' | 'duvida' } | null;
type Pendente = { r: Extract<Entendido, { tipo: 'ok' }>; ate: number } | null;

export function BotaoDeVoz({ canal, quadro, corpos, som }: Props) {
  const lang = idiomaDoJogo();
  const [ouvindo, setOuvindo] = useState(false);
  const [parcial, setParcial] = useState('');
  const [digitando, setDigitando] = useState(false);
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, setPendente] = useState<Pendente>(null);
  const escuta = useRef<Escuta | null>(null);
  const quadroRef = useRef(quadro);
  quadroRef.current = quadro;

  const contexto = (): ContextoDaVoz => {
    const q = quadroRef.current;
    const todos = corpos();
    const emCampo = q?.emCampo;
    return {
      casa: todos.filter((f) => f.lado === 'home' && (!emCampo || emCampo.includes(f.id))).map((f) => ({ id: f.id, nome: f.nome, slot: f.slot, fadiga: f.fadiga })),
      fora: todos.filter((f) => f.lado === 'away').map((f) => ({ id: f.id, nome: f.nome, slot: f.slot, fadiga: f.fadiga })),
      banco: (q?.banco ?? []).map((b) => ({ id: b.id, nome: b.nome, pos: b.pos })),
      subsRestantes: q?.subsRestantes ?? 0,
      decisao: q?.decisao ? { tipo: q.decisao.tipo, opcoes: q.decisao.opcoes } : null,
      formacoes: FORMATIONS,
      lendas: q?.lendas ?? [],
    };
  };

  const mostrar = (a: Aviso) => setAviso(a);
  useEffect(() => {
    if (!aviso) return undefined;
    const t = window.setTimeout(() => setAviso(null), AVISO_MS);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const executar = (r: Extract<Entendido, { tipo: 'ok' }>) => {
    canal.responder(r.id);
    mostrar({ texto: L(`Entendi: ${r.entendi}`, `Got it: ${r.entendi}`), tom: 'ok' });
    if (som) capitaoFala(r.fala, lang);
  };

  // Troca: confirma sozinha em 2,5 s (ou some com "Cancelar").
  useEffect(() => {
    if (!pendente) return undefined;
    const t = window.setTimeout(() => { executar(pendente.r); setPendente(null); }, Math.max(0, pendente.ate - Date.now()));
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendente]);

  const tratar = (alternativas: string[]) => {
    if (!alternativas.length) { mostrar({ texto: L('Não ouvi nada. Toque e fale de novo.', "Didn't hear anything. Tap and speak again."), tom: 'duvida' }); return; }
    const ctx = contexto();
    let primeiraDuvida: Entendido | null = null;
    for (const a of alternativas) {
      const r = entenderComando(a, ctx);
      if (r.tipo === 'ok') {
        if (r.confirmar) setPendente({ r, ate: Date.now() + CONFIRMA_TROCA_MS });
        else executar(r);
        return;
      }
      primeiraDuvida ??= r;
    }
    if (primeiraDuvida?.tipo === 'duvida') mostrar({ texto: primeiraDuvida.texto, tom: 'duvida' });
  };

  const tocar = () => {
    if (ouvindo) { escuta.current?.parar(); return; }
    if (!vozDisponivel()) { setDigitando((d) => !d); return; }
    setParcial('');
    const e = ouvir(lang, {
      parcial: setParcial,
      final: (alts) => { setOuvindo(false); setParcial(''); tratar(alts); },
      erro: (motivo) => {
        setOuvindo(false); setParcial('');
        mostrar({ texto: motivo === 'not-allowed' || motivo === 'service-not-allowed'
          ? L('O microfone está bloqueado. Libere nas permissões do navegador.', 'The microphone is blocked. Allow it in the browser settings.')
          : L('Não deu pra ouvir. Tente de novo.', "Couldn't hear you. Try again."), tom: 'duvida' });
      },
    });
    if (!e) { setDigitando(true); return; }
    escuta.current = e;
    setOuvindo(true);
  };

  const exemplos = L('"sai o Caio, entra o Pedro" · "Lucas marca o 10" · "ataque total" · "chuta!"', '"sub Caio for Pedro" · "Lucas mark the 10" · "all out attack" · "shoot!"');

  return (
    <>
      <button
        type="button"
        onClick={tocar}
        aria-pressed={ouvindo}
        aria-label={L('Comando de voz', 'Voice command')}
        className={`flex min-h-[34px] min-w-0 flex-col items-center justify-center overflow-hidden border px-0.5 py-1 font-prova text-[clamp(9px,2.6vh,11px)] leading-tight whitespace-nowrap ${ouvindo ? 'animate-pulse border-papel bg-rua text-asfalto-27' : 'border-rua bg-concreto text-rua'}`}
      >
        <span aria-hidden className="text-[14px] leading-none">🎙</span>
        {ouvindo ? L('Ouvindo…', 'Listening…') : L('Voz', 'Voice')}
      </button>

      {(ouvindo || digitando || aviso || pendente) && (
        <div className="pointer-events-none fixed bottom-3 left-1/2 z-[10001] w-[min(92vw,520px)] -translate-x-1/2">
          <div className="pointer-events-auto border-l-[3px] border-rua bg-asfalto-27/95 px-3 py-2 font-prova text-[12px] text-papel shadow-lg">
            {ouvindo && (
              <p>
                <span className="font-impact text-[14px] uppercase text-rua">{L('Fale o comando', 'Say the command')}</span>
                <span className="mt-0.5 block text-suave">{parcial || exemplos}</span>
              </p>
            )}
            {pendente && (
              <div className="flex items-center justify-between gap-3">
                <p>
                  <span className="font-impact text-[15px] uppercase text-rua">{L('Troca', 'Sub')}: </span>
                  {pendente.r.entendi}
                </p>
                <button type="button" onClick={() => { setPendente(null); mostrar({ texto: L('Troca cancelada.', 'Sub cancelled.'), tom: 'duvida' }); }} className="min-h-[36px] shrink-0 border border-linha px-3 text-[12px]">
                  {L('Cancelar', 'Cancel')}
                </button>
              </div>
            )}
            {!pendente && !ouvindo && aviso && <p className={aviso.tom === 'ok' ? 'text-papel' : 'text-cal'}>{aviso.texto}</p>}
            {digitando && !ouvindo && (
              <form
                className="mt-1 flex gap-2"
                onSubmit={(e) => { e.preventDefault(); const t = texto.trim(); if (t) { tratar([t]); setTexto(''); } }}
              >
                <input
                  autoFocus
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={L('Digite o comando (sem microfone aqui)', 'Type the command (no microphone here)')}
                  className="min-h-[36px] min-w-0 flex-1 border border-linha bg-concreto px-2 text-[13px] text-papel"
                />
                <button type="submit" className="min-h-[36px] shrink-0 bg-rua px-3 font-impact text-[14px] uppercase text-asfalto-27">{L('Mandar', 'Send')}</button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
