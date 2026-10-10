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
 *
 * Fase 4c: Banco (arrastar o reserva até quem sai), Prancheta (pausa: o campo
 * escurece e mostra a leitura) e o Analista desenhado no campo (corredores).
 *
 * Fase 6: o FILME. Ao vivo, cada quadro entregue ao coreógrafo é gravado com o
 * passo em que chegou (`gravar`). Com `roteiro`, o palco toca o filme: entrega
 * os mesmos quadros nos mesmos passos — a partida volta idêntica. Câmera do
 * Craque: a câmera segue um jogador (só o desenho; o jogo não muda).
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { L } from '@/i18n/L';
import { chaveDoLance, Coreografo, DT } from './coreografo';
import { PalcoPixi } from './palco';
import { levantarTela, pontoLocal } from './orientacao';
import { CartaoFicha, LambeDoGol, Narracao, PainelBanco, PainelCamera, PainelDecisao, PainelPrancheta, PainelTatica } from './trilhos';
import { corredorEmMetros, lerPrancheta } from './prancheta';
import { iniciais } from './escalacao';
import { entregarQuadro, type Entrega } from './gravacao';
import type { CanalAoVivo } from './canal';
import { FASES_FORA_DO_CAMPO, type Ficha, type QuadroAoVivo } from './tipos';
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
  /** Fase 4c: fichas dos reservas (rosto) — quem entra assume o slot de quem sai. */
  banco?: Ficha[];
  /** Fase 6: grava cada entrega (montagem do palco, passo, quadro) pro filme. */
  gravar?: (montagem: { id: number; comEntrada: boolean }, passo: number, q: QuadroAoVivo) => void;
  /** Fase 6: toca um filme — entrega estes quadros nos passos gravados. */
  roteiro?: Entrega[];
  onFimDoFilme?: () => void;
  /** Fase 7: de que lado está quem assiste (o adversário vê o time DELE em amarelo). */
  ladoDeQuemAssiste?: 'home' | 'away';
  /** Fase 8: a Câmera do Craque já abre seguindo este jogador (a lenda do atleta). */
  seguirAoAbrir?: string;
}

let montagens = 0;

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
  const [painel, setPainel] = useState<'tatica' | 'banco' | 'camera' | null>(null);
  const noFilme = !!p.roteiro;
  const montagemRef = useRef<{ id: number; comEntrada: boolean } | null>(null);
  if (!montagemRef.current) montagemRef.current = { id: ++montagens, comEntrada: !!p.comEntrada };
  /** Câmera do Craque: quem a câmera segue (null = câmera do jogo). */
  const [seguindo, setSeguindo] = useState<string | null>(p.seguirAoAbrir ?? null);
  const seguindoRef = useRef<string | null>(null);
  seguindoRef.current = seguindo;
  /** Banco: reserva escolhido (toque) e quem sai (escolhido no cartão). */
  const [entraEscolhido, setEntraEscolhido] = useState<string | null>(null);
  const [saiEscolhido, setSaiEscolhido] = useState<string | null>(null);
  const [arrasto, setArrasto] = useState<{ id: string; x: number; y: number; moveu: boolean } | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  const [, setVersao] = useState(0);
  const [leitura, setLeitura] = useState<ReturnType<typeof lerPrancheta> | null>(null);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const coreoRef = useRef<Coreografo | null>(null);
  if (!coreoRef.current) coreoRef.current = new Coreografo(fichas, formacaoCasa, formacaoFora, seed, p.comEntrada);
  const replayRef = useRef<HTMLSpanElement>(null);
  const pularFilmeRef = useRef(false);
  const [som, setSom] = useState(somLigado());
  const { w, h } = useViewport();
  const retrato = h > w;

  /** Entrega um quadro (ao vivo ou do filme) e troca o desenho de quem entrou. */
  const aplicarRef = useRef<(q: QuadroAoVivo) => void>(() => {});
  aplicarRef.current = (q: QuadroAoVivo) => {
    const co = coreoRef.current;
    if (!co) return;
    const feitas = entregarQuadro(co, q, p.banco ?? []);
    for (const t of feitas) {
      palcoRef.current?.trocarFicha(t.sai, t.nova);
      if (selecionada === t.sai) setSelecionada(null);
      if (seguindoRef.current === t.sai) setSeguindo(t.nova.id);
    }
    if (feitas.length) setVersao((v) => v + 1);
  };

  // PixiJS + laço: passo fixo de 10 Hz, desenho interpolado a cada quadro.
  // O tempo real é multiplicado pela velocidade escolhida e pela câmera lenta;
  // quando o gol entra, a imagem congela em P&B por um instante.
  useEffect(() => {
    const onde = campoRef.current;
    if (!onde) return undefined;
    const palco = new PalcoPixi();
    palcoRef.current = palco;
    // Prancheta: lida UMA vez quando o jogo para — o desenho e o painel mostram a mesma leitura.
    let lida: ReturnType<typeof lerPrancheta> | null = null;
    const lerAPrancheta = (pausadoAgora: boolean, q: { jogadores: Parameters<typeof lerPrancheta>[0]; dono: { id: string } | null }) => {
      if (!pausadoAgora) { if (lida) { lida = null; setLeitura(null); } return undefined; }
      if (!lida) { lida = lerPrancheta(q.jogadores, q.dono?.id ?? null); setLeitura(lida); }
      return lida;
    };
    let cam = { x: 52.5, z: 34, zoom: 1 };
    let raf = 0, acumulado = 0, antes = performance.now(), parado = false, congeladoAte = 0, cinemaAntes = false;
    void palco.iniciar(onde).then(() => {
      // Desmontou antes do PixiJS terminar (StrictMode monta duas vezes):
      // destrói aqui, senão sobra um canvas morto por cima do certo.
      if (parado) { palco.destruir(); return; }
      const co = coreoRef.current!;
      // Quem está em campo AGORA (alguém pode ter entrado antes do PixiJS ficar pronto).
      palco.destaque = p.ladoDeQuemAssiste ?? 'home';
      palco.montarFichas(co.corpos.map((c) => c.f));
      // FILME: entrega o roteiro nos passos gravados; trechos parados (intervalo,
      // pênaltis) passam direto; "Pular" vai ao próximo lance.
      const roteiro = p.roteiro;
      let proxima = 0, fimAvisado = false;
      const entregarPendentes = () => {
        while (roteiro && proxima < roteiro.length && roteiro[proxima]!.p <= co.passos) {
          const e = roteiro[proxima++]!;
          aplicarRef.current(e.q);
          canal.publicar(e.q);
        }
      };
      const passosAte = (achar: (e: Entrega) => boolean) => {
        if (!roteiro) return 0;
        const alvo = roteiro.slice(proxima).find(achar);
        return alvo ? Math.max(0, alvo.p - co.passos) : 0;
      };
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
        if (roteiro) {
          entregarPendentes();
          const ult = canal.ultimo();
          // Telas fora do campo (intervalo, pênaltis) não têm o que ver: passa direto.
          if (ult && FASES_FORA_DO_CAMPO.has(ult.fase)) acumulado += passosAte(() => true) * DT;
          if (pularFilmeRef.current && !filme) {
            const atual = ult?.lance ? chaveDoLance(ult.lance) : null;
            acumulado += Math.max(0, passosAte((e) => (!!e.q.lance && chaveDoLance(e.q.lance) !== atual) || !!e.q.gol) - 8) * DT;
          }
          if (!fimAvisado && proxima >= roteiro.length && co.passos > (roteiro[roteiro.length - 1]?.p ?? 0) + 40 && !filme) {
            fimAvisado = true;
            p.onFimDoFilme?.();
          }
        }
        if (filme && pularFilmeRef.current) terminarFilme();
        pularFilmeRef.current = false;
        if (filme?.fase === 'espera' && agora - filme.ini > ESPERA_ANTES_MS) { filme = { ...filme, fase: 'replay', ini: agora }; if (replayRef.current) replayRef.current.style.opacity = '1'; }
        else if (filme?.fase === 'replay' && agora - filme.ini > REPLAY_MS) { filme = { ...filme, fase: 'giz', ini: agora }; if (replayRef.current) replayRef.current.style.opacity = '0'; }
        else if ((filme?.fase === 'giz' && agora - filme.ini > GIZ_MS) || (filme?.fase === 'semCadeia' && agora - filme.ini > 2600)) terminarFilme();
        const rodando = !filme || filme.fase === 'espera' || filme.fase === 'semCadeia';
        if (rodando && agora >= congeladoAte) {
          if (onde.style.filter) onde.style.filter = '';
          // No momento decisivo o campo congela até o manager escolher.
          // Na prancheta (pausa) também: o quadro fica parado pra ser lido.
          const congelaDecisivo = canal.ultimo()?.decisao?.tipo === 'decisivo' || !!canal.ultimo()?.pausado;
          acumulado += congelaDecisivo ? 0 : real * velRef.current * co.escalaDoTempo();
          let guarda = 0;
          while (acumulado >= DT && guarda++ < 4000) {
            entregarPendentes();
            co.passo();
            acumulado -= DT;
            if (co.consumirCongelamento()) { congeladoAte = agora + CONGELA_MS; onde.style.filter = 'grayscale(1) contrast(1.15)'; acumulado = 0; break; }
          }
        }
        const replay = filme?.fase === 'replay' ? quadroDoReplay(filme.frames, fichas, filme.autorId, (agora - filme.ini) / REPLAY_MS) : null;
        let q = replay ?? co.quadro(acumulado / DT);
        // Câmera do Craque: só o enquadramento muda (o jogo não sabe que é seguido).
        const alvo = !replay && seguindoRef.current ? q.jogadores.find((j) => j.f.id === seguindoRef.current) : undefined;
        if (alvo) {
          cam.x += (alvo.x - cam.x) * 0.12; cam.z += (alvo.z - cam.z) * 0.12; cam.zoom += (1.75 - cam.zoom) * 0.08;
          q = { ...q, camera: { ...cam } };
        } else cam = { ...q.camera };
        const ult = canal.ultimo();
        const corr = ult?.decisao?.tipo === 'analista' ? ult.decisao.corredores : undefined;
        palco.desenhar(
          q,
          filme?.fase === 'giz' ? { pontos: filme.pontos, progresso: Math.min(1, (agora - filme.ini) / (GIZ_MS * 0.7)) } : undefined,
          {
            prancheta: lerAPrancheta(!!ult?.pausado && !replay, q),
            corredores: corr ? { nosso: corredorEmMetros(corr.nosso, 'nosso'), perigo: corredorEmMetros(corr.perigo, 'perigo') } : undefined,
          },
        );
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

  // Ao vivo: cada quadro novo é gravado (com o passo em que chegou) e entregue.
  // No filme quem entrega é o laço, no passo gravado.
  useEffect(() => {
    if (!quadro || noFilme) return;
    const co = coreoRef.current;
    if (co) p.gravar?.(montagemRef.current!, co.passos, quadro);
    aplicarRef.current(quadro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quadro]);

  const pausado = !!quadro?.pausado;
  const rostosDoBanco = useMemo(() => new Map((p.banco ?? []).map((f) => [f.id, f])), [p.banco]);
  const trocar = (sai: string, entra: string) => {
    canal.responder(`sub:${sai}|${entra}`);
    setEntraEscolhido(null); setSaiEscolhido(null); setSelecionada(null); setPainel(null);
  };
  const fichaDaCasaEm = (clientX: number, clientY: number): string | null => {
    const campo = campoRef.current;
    if (!campo) return null;
    const caixa = campo.getBoundingClientRect();
    const { x, y } = pontoLocal(clientX, clientY, caixa, retrato);
    if (x < 0 || y < 0 || x > (retrato ? caixa.height : caixa.width) || y > (retrato ? caixa.width : caixa.height)) return null;
    // As fichas se mexem: o alvo é o da casa mais perto do dedo (até ~44 px).
    return palcoRef.current?.fichaDoLadoEm(x, y, 'home', 44) ?? null;
  };
  /** Arrastar do banco: a ficha fantasma segue o dedo; soltou em cima de quem sai → troca. */
  const comecarArrasto = (id: string, e: React.PointerEvent) => {
    const raiz = raizRef.current;
    if (!raiz) return;
    const caixa = raiz.getBoundingClientRect();
    const ini = pontoLocal(e.clientX, e.clientY, caixa, retrato);
    let moveu = false;
    setArrasto({ id, ...ini, moveu });
    const mover = (ev: PointerEvent) => {
      const pt = pontoLocal(ev.clientX, ev.clientY, caixa, retrato);
      moveu = moveu || Math.hypot(pt.x - ini.x, pt.y - ini.y) > 10;
      setArrasto({ id, ...pt, moveu });
      palcoRef.current?.marcarAlvoDaTroca(moveu ? fichaDaCasaEm(ev.clientX, ev.clientY) : null);
    };
    const soltar = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
      setArrasto(null);
      palcoRef.current?.marcarAlvoDaTroca(null);
      if (moveu && ev.type === 'pointerup') {
        const sai = fichaDaCasaEm(ev.clientX, ev.clientY);
        if (sai) trocar(sai, id);
      }
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
  };

  const foraDoCampo = !noFilme && !!quadro && FASES_FORA_DO_CAMPO.has(quadro.fase);
  const decisao = quadro?.decisao ?? null;
  const gol = quadro?.gol ?? null;
  // As fichas vivas vêm do coreógrafo (quem entrou do banco já está lá).
  const fichaSel = selecionada ? coreoRef.current?.corpos.find((c) => c.f.id === selecionada)?.f : undefined;
  const saiFicha = saiEscolhido ? coreoRef.current?.corpos.find((c) => c.f.id === saiEscolhido)?.f : undefined;
  const protagonista = decisao?.protagonista ? coreoRef.current?.corpos.map((c) => c.f).find((f) => f.nome === decisao.protagonista || decisao.protagonista!.startsWith(f.nome)) : undefined;
  useEffect(() => { palcoRef.current?.selecionar(selecionada); }, [selecionada]);

  /** Toque no campo → ficha (o palco pode estar girado 90° por CSS). */
  const tocarNoCampo = (e: React.PointerEvent<HTMLDivElement>) => {
    const { x, y } = pontoLocal(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), retrato);
    const id = palcoRef.current?.fichaEm(x, y) ?? null;
    // Banco aberto com um reserva escolhido: tocar em alguém da casa = ele sai.
    if (painel === 'banco' && entraEscolhido) {
      const sai = fichaDaCasaEm(e.clientX, e.clientY);
      if (sai) { trocar(sai, entraEscolhido); return; }
    }
    setSelecionada(id && id !== selecionada ? id : null);
    if (id) setPainel(null);
  };
  const autorDoGol = gol ? coreoRef.current?.corpos.find((c) => c.f.id === gol.actorId)?.f ?? fichas.find((f) => f.id === gol.actorId) : undefined;
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
      ref={raizRef}
      className="fixed left-0 top-0 z-[10000] overflow-hidden bg-asfalto-27 text-papel"
      style={{ ...estiloPalco, visibility: foraDoCampo ? 'hidden' : 'visible' }}
    >
      {arrasto?.moveu && (() => {
        const f = rostosDoBanco.get(arrasto.id);
        const nome = quadro?.banco?.find((b) => b.id === arrasto.id)?.nome ?? '';
        return (
          <div
            aria-hidden
            className="pointer-events-none absolute z-[3] flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-2 border-papel bg-rua"
            style={{ left: arrasto.x, top: arrasto.y }}
          >
            {f?.rosto ? <img src={f.rosto} alt="" className="h-full w-full object-cover" /> : <span className="font-impact text-[12px] text-asfalto-27">{iniciais(nome)}</span>}
          </div>
        );
      })()}
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

          {noFilme && <span className="self-start bg-cal px-1.5 py-0.5 font-prova text-[11px] text-asfalto-27">{L('Filme', 'Film')}</span>}
          {decisao && !noFilme ? (
            <PainelDecisao decisao={decisao} protagonista={protagonista} onResponder={canal.responder} />
          ) : gol ? (
            <LambeDoGol quadro={quadro} autor={autorDoGol} nome={gol.nome} />
          ) : painel === 'camera' ? (
            <PainelCamera
              fichas={coreoRef.current?.corpos.map((c) => c.f) ?? fichas}
              seguindo={seguindo}
              onSeguir={(id) => { setSeguindo(id); setPainel(null); }}
              onFechar={() => setPainel(null)}
            />
          ) : painel === 'tatica' && !noFilme ? (
            <PainelTatica
              atual={quadro?.estilo}
              onEscolher={(id) => canal.responder(`estilo:${id}`)}
              onFechar={() => setPainel(null)}
              minuto={quadro?.minuto}
              grito={quadro?.grito}
              gritoLivreEm={quadro?.gritoLivreEm}
              onGritar={quadro?.gritoLivreEm !== undefined ? (id) => canal.responder(`grito:${id}`) : undefined}
            />
          ) : painel === 'banco' && quadro?.banco ? (
            <PainelBanco
              banco={quadro.banco}
              rostos={rostosDoBanco}
              restantes={quadro.subsRestantes ?? 0}
              sai={saiFicha}
              escolhido={entraEscolhido}
              onEscolher={(id) => {
                if (saiEscolhido) trocar(saiEscolhido, id);
                else setEntraEscolhido(entraEscolhido === id ? null : id);
              }}
              onArrastar={comecarArrasto}
              onFechar={() => { setPainel(null); setEntraEscolhido(null); setSaiEscolhido(null); }}
            />
          ) : fichaSel ? (
            <CartaoFicha
              f={fichaSel}
              onFechar={() => setSelecionada(null)}
              ordem={noFilme ? undefined : quadro?.ordens?.[fichaSel.id]}
              onOrdem={quadro?.ordens && !noFilme ? (id) => canal.responder(`ordem:${fichaSel.id}:${id}`) : undefined}
              seguindo={seguindo === fichaSel.id}
              onSeguir={() => { setSeguindo(seguindo === fichaSel.id ? null : fichaSel.id); setSelecionada(null); }}
              onSubstituir={!noFilme && quadro?.banco?.length && (quadro.subsRestantes ?? 0) > 0
                ? () => { setSaiEscolhido(fichaSel.id); setEntraEscolhido(null); setPainel('banco'); }
                : undefined}
            />
          ) : pausado && !noFilme ? (
            <PainelPrancheta leitura={leitura} onVoltar={() => canal.responder('retomar')} />
          ) : (
            <Narracao quadro={quadro} />
          )}
        </aside>

        {/* CENTRO — só o campo (+ faixas de cinema nos lances grandes) */}
        <div className="relative min-w-0 overflow-hidden">
          <div ref={campoRef} onPointerDown={tocarNoCampo} className="absolute inset-0 cursor-pointer transition-[filter] duration-200" />
          {seguindo && (
            <button
              type="button"
              onClick={() => setSeguindo(null)}
              className="absolute left-2 top-2 z-[3] -rotate-2 bg-rua px-2 py-0.5 font-prova text-[11px] text-asfalto-27"
            >
              {L('Câmera do Craque', 'Star Cam')} · {coreoRef.current?.corpos.find((c) => c.f.id === seguindo)?.f.nome ?? ''} ✕
            </button>
          )}
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
          {!noFilme && (
            <Botao onClick={() => p.onModo(modo === 'lances' ? 'completa' : 'lances')} rotulo={L('Modo de assistir', 'Viewing mode')}>
              {modo === 'lances' ? L('Lances', 'Plays') : L('Completa', 'Full')}
            </Botao>
          )}
          <Botao
            onClick={() => p.onVelocidade(velocidade === 1 ? 2 : velocidade === 2 ? 4 : 1)}
            rotulo={L(`Velocidade ${velocidade}×`, `Speed ${velocidade}×`)}
          >
            <span className="font-impact text-[15px] leading-none">{velocidade}×</span>
          </Botao>
          {noFilme ? (
            <Botao ativo={painel === 'camera' || !!seguindo} onClick={() => { setPainel(painel === 'camera' ? null : 'camera'); setSelecionada(null); }}>{L('Câmera', 'Camera')}</Botao>
          ) : (
            <Botao ativo={painel === 'tatica'} onClick={() => { setPainel(painel === 'tatica' ? null : 'tatica'); setSelecionada(null); }}>{L('Tática', 'Tactics')}</Botao>
          )}
          {quadro?.banco && !noFilme && (
            <Botao ativo={painel === 'banco'} onClick={() => { setPainel(painel === 'banco' ? null : 'banco'); setSelecionada(null); setSaiEscolhido(null); setEntraEscolhido(null); }}>
              {L('Banco', 'Bench')} {quadro.subsRestantes ?? 0}
            </Botao>
          )}
          {quadro?.pausado !== undefined && !noFilme && (
            <Botao ativo={pausado} onClick={() => canal.responder(pausado ? 'retomar' : 'pausar')} rotulo={L('Prancheta', 'Tactics board')}>
              {pausado ? L('▶ Jogo', '▶ Play') : L('Prancheta', 'Board')}
            </Botao>
          )}
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
