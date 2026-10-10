/**
 * PARTIDA VIVA — a tela deitada.
 *
 * Layout em trilhos (docs/PARTIDA-VIVA-PLANO.md §4.3.1): o campo NÃO divide
 * espaço com nada.
 *   trilho esquerdo → placar, minuto, momento e narração (ou o lambe do gol)
 *   centro          → só o campo (PixiJS) + faixas de cinema nos lances grandes
 *   trilho direito  → modo (Lances/Completa), velocidade, pular, sair
 *
 * Fase 4: Analista, reação, momento decisivo e lesão são decididos NOS
 * TRILHOS (o campo fica à vista; no momento decisivo, congela). O estilo de
 * jogo é comandado daqui (o time muda de forma na hora). Tocar numa ficha abre
 * o cartão dela. Só as telas grandes da Rápida (intervalo, batedor de pênalti,
 * disputa, fim) ainda tiram o palco da frente.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { L } from '@/i18n/L';
import { Coreografo, DT } from './coreografo';
import { PalcoPixi } from './palco';
import { levantarTela, pontoLocal } from './orientacao';
import { CartaoFicha, LambeDoGol, Narracao, PainelDecisao, PainelTatica } from './trilhos';
import type { CanalAoVivo } from './canal';
import { FASES_FORA_DO_CAMPO, type Ficha } from './tipos';
import { desligarSom, ligarSom, pararSom, somLigado, tiqueDoSom, tocar } from './som';
import { ESPERA_ANTES_MS, GIZ_MS, pontosDoGiz, quadroDoReplay, REPLAY_MS, type PontoDoGiz } from './filme';
import type { QuadroDoFilme } from './coreografo';

export type ModoDeAssistir = 'lances' | 'completa';

interface Props {
  canal: CanalAoVivo;
  fichas: Ficha[];
  formacaoCasa: string;
  formacaoFora: string;
  seed: string;
  siglaCasa: string;
  siglaFora: string;
  modo: ModoDeAssistir;
  velocidade: 1 | 2 | 4;
  pulando: boolean;
  onModo: (m: ModoDeAssistir) => void;
  onVelocidade: (v: 1 | 2 | 4) => void;
  onPular: () => void;
  onSair: () => void;
  /** Abriu antes do apito: os times entram em campo (Fase 5). */
  comEntrada?: boolean;
}

const CONGELA_MS = 1100;

function useViewport() {
  const [v, setV] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setV({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); };
  }, []);
  return v;
}

const chance = (xg: number) =>
  xg >= 0.35 ? L('chance clara', 'big chance') : xg >= 0.15 ? L('meia chance', 'half chance') : L('chute difícil', 'tough shot');

function Botao({ ativo, onClick, children, rotulo }: { ativo?: boolean; onClick: () => void; children: React.ReactNode; rotulo?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      aria-label={rotulo}
      className={`flex min-h-[34px] flex-col items-center justify-center border px-1 py-1 font-prova text-[11px] leading-tight ${ativo ? 'border-papel bg-rua text-asfalto-27' : 'border-linha bg-concreto text-papel'}`}
    >
      {children}
    </button>
  );
}

export function PartidaVivaPalco(p: Props) {
  const { canal, fichas, formacaoCasa, formacaoFora, seed, siglaCasa, siglaFora, modo, velocidade, pulando } = p;
  const quadro = useSyncExternalStore(canal.assinar, canal.ultimo);
  const campoRef = useRef<HTMLDivElement>(null);
  const faixaCimaRef = useRef<HTMLDivElement>(null);
  const faixaBaixoRef = useRef<HTMLDivElement>(null);
  const velRef = useRef(velocidade);
  velRef.current = velocidade;
  const palcoRef = useRef<PalcoPixi | null>(null);
  const [painel, setPainel] = useState<'tatica' | null>(null);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const coreoRef = useRef<Coreografo | null>(null);
  if (!coreoRef.current) coreoRef.current = new Coreografo(fichas, formacaoCasa, formacaoFora, seed, p.comEntrada);
  const replayRef = useRef<HTMLSpanElement>(null);
  const pularFilmeRef = useRef(false);
  const [som, setSom] = useState(somLigado());
  const { w, h } = useViewport();
  const retrato = h > w;

  // PixiJS + laço: passo fixo de 10 Hz, desenho interpolado a cada quadro.
  // O tempo real é multiplicado pela velocidade escolhida e pela câmera lenta;
  // quando o gol entra, a imagem congela em P&B por um instante.
  useEffect(() => {
    const onde = campoRef.current;
    if (!onde) return undefined;
    const palco = new PalcoPixi();
    palcoRef.current = palco;
    let raf = 0, acumulado = 0, antes = performance.now(), parado = false, congeladoAte = 0, cinemaAntes = false;
    void palco.iniciar(onde).then(() => {
      // Desmontou antes do PixiJS terminar (StrictMode monta duas vezes):
      // destrói aqui, senão sobra um canvas morto por cima do certo.
      if (parado) { palco.destruir(); return; }
      palco.montarFichas(fichas);
      const co = coreoRef.current!;
      // Roteiro do gol (Fase 5): comemoração → REPLAY → jogada a giz → a Rápida segue.
      type Filme = { fase: 'espera' | 'replay' | 'giz' | 'semCadeia'; ini: number; frames: QuadroDoFilme[]; autorId?: string; pontos: PontoDoGiz[] };
      let filme: Filme | null = null;
      let golAtendido: unknown = null;
      const terminarFilme = () => {
        filme = null;
        co.golGravado = null;
        if (replayRef.current) replayRef.current.style.opacity = '0';
        canal.responder('seguir');
      };
      const laco = (agora: number) => {
        const real = Math.min(0.25, (agora - antes) / 1000);
        antes = agora;
        if (co.festa && co.festa !== golAtendido && !filme) {
          golAtendido = co.festa;
          filme = co.golGravado && co.filme.length
            ? { fase: 'espera', ini: agora, frames: [...co.filme], autorId: co.golGravado.autorId, pontos: pontosDoGiz(co.golGravado.cadeia, fichas) }
            : { fase: 'semCadeia', ini: agora, frames: [], pontos: [] };
        }
        if (!co.festa) golAtendido = null;
        if (filme && pularFilmeRef.current) terminarFilme();
        pularFilmeRef.current = false;
        if (filme?.fase === 'espera' && agora - filme.ini > ESPERA_ANTES_MS) { filme = { ...filme, fase: 'replay', ini: agora }; if (replayRef.current) replayRef.current.style.opacity = '1'; }
        else if (filme?.fase === 'replay' && agora - filme.ini > REPLAY_MS) { filme = { ...filme, fase: 'giz', ini: agora }; if (replayRef.current) replayRef.current.style.opacity = '0'; }
        else if ((filme?.fase === 'giz' && agora - filme.ini > GIZ_MS) || (filme?.fase === 'semCadeia' && agora - filme.ini > 2600)) terminarFilme();
        const rodando = !filme || filme.fase === 'espera' || filme.fase === 'semCadeia';
        if (rodando && agora >= congeladoAte) {
          if (onde.style.filter) onde.style.filter = '';
          // No momento decisivo o campo congela até o manager escolher.
          const congelaDecisivo = canal.ultimo()?.decisao?.tipo === 'decisivo';
          acumulado += congelaDecisivo ? 0 : real * velRef.current * co.escalaDoTempo();
          while (acumulado >= DT) {
            co.passo();
            acumulado -= DT;
            if (co.consumirCongelamento()) { congeladoAte = agora + CONGELA_MS; onde.style.filter = 'grayscale(1) contrast(1.15)'; acumulado = 0; break; }
          }
        }
        const replay = filme?.fase === 'replay' ? quadroDoReplay(filme.frames, fichas, filme.autorId, (agora - filme.ini) / REPLAY_MS) : null;
        const q = replay ?? co.quadro(acumulado / DT);
        palco.desenhar(q, filme?.fase === 'giz' ? { pontos: filme.pontos, progresso: Math.min(1, (agora - filme.ini) / (GIZ_MS * 0.7)) } : undefined);
        // Som: torcida sobe com o perigo, cala na câmera lenta; eventos viram som/vibração.
        for (const e of co.consumirSons()) tocar(e);
        const perto = Math.min(q.bola.x, 105 - q.bola.x);
        // Telas da Rápida (intervalo, pênaltis, fim) por cima: a torcida cala.
        const fora = FASES_FORA_DO_CAMPO.has(canal.ultimo()?.fase ?? 'playing');
        tiqueDoSom(q.cinema ? 0.8 : 1 - Math.min(perto, 40) / 40, co.escalaDoTempo() < 0.9, real, fora);
        const cinema = !!filme && filme.fase !== 'semCadeia' || q.cinema || ['decisivo', 'lesao', 'expulsao'].includes(canal.ultimo()?.decisao?.tipo ?? '');
        if (cinema !== cinemaAntes) {
          cinemaAntes = cinema;
          const alt = cinema ? '11%' : '0';
          if (faixaCimaRef.current) faixaCimaRef.current.style.height = alt;
          if (faixaBaixoRef.current) faixaBaixoRef.current.style.height = alt;
        }
        raf = requestAnimationFrame(laco);
      };
      raf = requestAnimationFrame(laco);
    });
    // Saiu do campo (fim de jogo, "Sair", troca de página): o som PARA junto.
    return () => { parado = true; cancelAnimationFrame(raf); palco.destruir(); pararSom(); };
    // fichas/seed fixos durante a partida (o palco remonta numa partida nova)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (quadro) coreoRef.current?.receber(quadro); }, [quadro]);

  const foraDoCampo = !!quadro && FASES_FORA_DO_CAMPO.has(quadro.fase);
  const decisao = quadro?.decisao ?? null;
  const gol = quadro?.gol ?? null;
  const fichaSel = selecionada ? fichas.find((f) => f.id === selecionada) : undefined;
  const protagonista = decisao?.protagonista ? fichas.find((f) => f.nome === decisao.protagonista || decisao.protagonista!.startsWith(f.nome)) : undefined;
  useEffect(() => { palcoRef.current?.selecionar(selecionada); }, [selecionada]);

  /** Toque no campo → ficha (o palco pode estar girado 90° por CSS). */
  const tocarNoCampo = (e: React.PointerEvent<HTMLDivElement>) => {
    const { x, y } = pontoLocal(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), retrato);
    const id = palcoRef.current?.fichaEm(x, y) ?? null;
    setSelecionada(id && id !== selecionada ? id : null);
    if (id) setPainel(null);
  };
  const autorDoGol = gol ? fichas.find((f) => f.id === gol.actorId) : undefined;
  const segmentos = Math.round(((quadro?.momento ?? 50) / 100) * 10);
  const xgDoLance = quadro?.lance?.xg ?? gol?.xg;
  const legenda = quadro?.narracao[0]?.texto.replace(/^\d+'\s*—\s*/, '') ?? '';

  // Celular em retrato: o palco é sempre horizontal e gira 90° por CSS.
  const larg = retrato ? h : w;
  const alt = retrato ? w : h;
  // maxWidth/maxHeight: o CSS global limita blocos a 100% da tela, o que cortaria o palco girado.
  const estiloPalco: React.CSSProperties = retrato
    ? { width: larg, height: alt, maxWidth: 'none', maxHeight: 'none', transform: `rotate(90deg) translateY(-100%)`, transformOrigin: 'top left' }
    : { width: larg, height: alt, maxWidth: 'none', maxHeight: 'none' };

  const sair = () => { void levantarTela(); p.onSair(); };
  const faixa = 'absolute left-0 right-0 z-[2] flex h-0 items-center justify-center overflow-hidden bg-black transition-[height] duration-500';

  // z-[10000]: acima da comemoração da Rápida (z-[9999]) — no gol o palco mostra o próprio lambe.
  // Portal no <body>: o layout da página anima com transform, e `fixed` dentro
  // de ancestral transformado deixa de ocupar a tela inteira.
  return createPortal(
    <div
      role="dialog"
      aria-label={L('Partida ao vivo em campo', 'Live match on the pitch')}
      className="fixed left-0 top-0 z-[10000] overflow-hidden bg-asfalto-27 text-papel"
      style={{ ...estiloPalco, visibility: foraDoCampo ? 'hidden' : 'visible' }}
    >
      <div
        className="grid h-full w-full"
        style={{ gridTemplateColumns: `clamp(104px, 21%, 168px) minmax(0, 1fr) clamp(76px, 10%, 104px)` }}
      >
        {/* TRILHO ESQUERDO */}
        <aside className="flex min-h-0 flex-col gap-2 overflow-hidden border-r border-linha p-2 pl-[max(0.5rem,env(safe-area-inset-left))] font-prova text-[11px]">
          <div>
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-impact text-[15px] tracking-wide">{siglaCasa}</span>
              <span className="font-spray text-[24px] font-black leading-none text-rua tabular-nums">
                {quadro?.placarCasa ?? 0} × {quadro?.placarFora ?? 0}
              </span>
              <span className="font-impact text-[15px] tracking-wide text-suave">{siglaFora}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="bg-rua px-1.5 text-asfalto-27">{quadro?.minuto ?? 0}&prime;</span>
              <div className="flex gap-[2px]" aria-label={L('Momento da partida', 'Match momentum')}>
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className={`h-1 w-[5px] ${i < segmentos ? 'bg-rua' : 'bg-cal'}`} />
                ))}
              </div>
            </div>
          </div>

          {decisao ? (
            <PainelDecisao decisao={decisao} protagonista={protagonista} onResponder={canal.responder} />
          ) : gol ? (
            <LambeDoGol quadro={quadro} autor={autorDoGol} nome={gol.nome} />
          ) : painel === 'tatica' ? (
            <PainelTatica atual={quadro?.estilo} onEscolher={(id) => canal.responder(`estilo:${id}`)} onFechar={() => setPainel(null)} />
          ) : fichaSel ? (
            <CartaoFicha f={fichaSel} onFechar={() => setSelecionada(null)} />
          ) : (
            <Narracao quadro={quadro} />
          )}
        </aside>

        {/* CENTRO — só o campo (+ faixas de cinema nos lances grandes) */}
        <div className="relative min-w-0 overflow-hidden">
          <div ref={campoRef} onPointerDown={tocarNoCampo} className="absolute inset-0 cursor-pointer transition-[filter] duration-200" />
          <div ref={faixaCimaRef} className={`${faixa} top-0`}>
            <span ref={replayRef} className="absolute left-3 -rotate-3 bg-rua px-2 font-impact text-[16px] leading-tight text-asfalto-27 opacity-0 transition-opacity">REPLAY</span>
            {xgDoLance != null && xgDoLance > 0 && (
              <span className="font-prova text-[11px] text-cal">{chance(xgDoLance)} · xG {xgDoLance.toFixed(2).replace('.', ',')}</span>
            )}
          </div>
          <div ref={faixaBaixoRef} className={`${faixa} bottom-0`}>
            <span className="truncate px-3 font-prova text-[12px] text-cal">{legenda}</span>
          </div>
        </div>

        {/* TRILHO DIREITO — comandos de assistir */}
        <aside className="flex flex-col items-stretch justify-center gap-1 border-l border-linha p-1.5 pr-[max(0.375rem,env(safe-area-inset-right))]">
          <Botao ativo={modo === 'lances'} onClick={() => p.onModo('lances')}>{L('Lances', 'Plays')}</Botao>
          <Botao ativo={modo === 'completa'} onClick={() => p.onModo('completa')}>{L('Completa', 'Full')}</Botao>
          <Botao
            onClick={() => p.onVelocidade(velocidade === 1 ? 2 : velocidade === 2 ? 4 : 1)}
            rotulo={L(`Velocidade ${velocidade}×`, `Speed ${velocidade}×`)}
          >
            <span className="font-impact text-[15px] leading-none">{velocidade}×</span>
          </Botao>
          <Botao ativo={painel === 'tatica'} onClick={() => { setPainel(painel === 'tatica' ? null : 'tatica'); setSelecionada(null); }}>{L('Tática', 'Tactics')}</Botao>
          <Botao ativo={som} onClick={() => { if (som) { desligarSom(); setSom(false); } else setSom(ligarSom()); }} rotulo={L('Som', 'Sound')}>
            {som ? L('Som ●', 'Sound ●') : L('Som ○', 'Sound ○')}
          </Botao>
          <Botao ativo={pulando} onClick={() => { pularFilmeRef.current = true; p.onPular(); }}>{pulando ? L('Pulando…', 'Skipping…') : L('Pular ▸', 'Skip ▸')}</Botao>
          <Botao onClick={sair}>
            <span aria-hidden className="text-[13px] leading-none">✕</span>
            {L('Sair', 'Leave')}
          </Botao>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
