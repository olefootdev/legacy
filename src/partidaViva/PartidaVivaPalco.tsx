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
import { track } from '@/analytics/track';
import { BotaoDeVoz } from './voz/BotaoDeVoz';
import { chaveDoLance, Coreografo, DT } from './coreografo';
import { PalcoPixi } from './palco';
import { deitarTela, ehIOS, ladoDoEntalhe, levantarTela, podeTelaCheia, pontoLocal, semBarras } from './orientacao';
import { CartaoFicha, LambeDoGol, Narracao, PainelCamera, PainelSubstituicao, NumerosNoTrilho, PainelDecisao, PainelPrancheta, PainelTatica, SkillNoTrilho } from './trilhos';
import type { SkillEmCampo } from './skills';
import { corredorEmMetros, lerPrancheta } from './prancheta';
import { iniciais } from './escalacao';
import { entregarQuadro, type Entrega } from './gravacao';
import type { CanalAoVivo } from './canal';
import { FASES_FORA_DO_CAMPO, type Ficha, type QuadroAoVivo } from './tipos';
import { desligarSom, ligarSom, pararSom, somLigado, tiqueDoSom, tocar } from './som';
import { ESPERA_ANTES_MS, GIZ_MS, pontosDoGiz, quadroDoReplay, REPLAY_MS, type PontoDoGiz } from './filme';
import type { QuadroDoFilme } from './coreografo';
import { encenarParalelo, quadroDoParalelo, type Paralelo } from './mundoParalelo';

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
  /** O apito inicial soou no campo (todos na posição de saída): a Rápida pode começar. */
  onApito?: () => void;
  /** Fase 8: a Câmera do Craque já abre seguindo este jogador (a lenda do atleta). */
  seguirAoAbrir?: string;
}

let montagens = 0;

const CONGELA_MS = 1100;

function useViewport() {
  // A área VISÍVEL (visualViewport): com as barras do navegador aparecendo e
  // sumindo, innerHeight mente e o palco ficava cortado embaixo.
  const medir = () => ({ w: Math.round(window.visualViewport?.width ?? window.innerWidth), h: Math.round(window.visualViewport?.height ?? window.innerHeight) });
  const [v, setV] = useState(medir);
  useEffect(() => {
    const on = () => setV(medir());
    const tarde = () => { on(); window.setTimeout(on, 350); }; // a rotação termina depois do evento
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', tarde);
    document.addEventListener('fullscreenchange', tarde);
    window.visualViewport?.addEventListener('resize', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', tarde);
      document.removeEventListener('fullscreenchange', tarde);
      window.visualViewport?.removeEventListener('resize', on);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      className={`flex min-h-[34px] min-w-0 flex-col items-center justify-center overflow-hidden border px-0.5 py-1 font-prova text-[clamp(9px,2.6vh,11px)] leading-tight whitespace-nowrap ${ativo ? 'border-papel bg-rua text-asfalto-27' : 'border-linha bg-concreto text-papel'}`}
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
  const [painel, setPainel] = useState<'tatica' | 'banco' | 'camera' | 'telaCheia' | null>(null);
  // TELA CHEIA (pedido do fundador 10/10: deitado, as barras do navegador achatavam o campo).
  const [telaCheia, setTelaCheia] = useState(semBarras);
  useEffect(() => {
    const on = () => setTelaCheia(semBarras());
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const ofereceTelaCheia = !telaCheia && (podeTelaCheia() || ehIOS());
  const pedirTelaCheia = () => {
    if (podeTelaCheia()) { void deitarTela(); return; }
    setPainel(painel === 'telaCheia' ? null : 'telaCheia'); // iPhone: só instalando na tela de início
  };
  const noFilme = !!p.roteiro;
  const montagemRef = useRef<{ id: number; comEntrada: boolean } | null>(null);
  const apitoRef = useRef(p.onApito);
  apitoRef.current = p.onApito;
  if (!montagemRef.current) montagemRef.current = { id: ++montagens, comEntrada: !!p.comEntrada };
  /** Câmera do Craque: quem a câmera segue (null = câmera do jogo). */
  const [seguindo, setSeguindo] = useState<string | null>(p.seguirAoAbrir ?? null);
  const seguindoRef = useRef<string | null>(null);
  seguindoRef.current = seguindo;
  /** Banco: reserva escolhido (toque) e quem sai (escolhido no cartão). */
  const [entraEscolhido, setEntraEscolhido] = useState<string | null>(null);
  const [saiEscolhido, setSaiEscolhido] = useState<string | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  const [, setVersao] = useState(0);
  const [leitura, setLeitura] = useState<ReturnType<typeof lerPrancheta> | null>(null);
  /**
   * CRONOLOGIA (feedback 10/10): o placar, o lambe do gol e a narração só
   * aparecem quando o CAMPO mostra o lance — nada de "GOL" antes da bola entrar.
   * `pendente` guarda o quadro mais novo; o laço libera quando a encenação acaba
   * (ou, no gol, quando a bola entra).
   */
  type Mostrado = { placarCasa: number; placarFora: number; narracao: QuadroAoVivo['narracao']; golVisto: string | null; numeros?: QuadroAoVivo['numeros'] };
  const [mostrado, setMostrado] = useState<Mostrado>({ placarCasa: 0, placarFora: 0, narracao: [], golVisto: null });
  const pendenteRef = useRef<{ q: QuadroAoVivo; desde: number } | null>(null);
  const golVistoRef = useRef<string | null>(null);
  /** Fase 10: a última skill com nome (some sozinha depois de ~3 s). */
  const [skill, setSkill] = useState<SkillEmCampo | null>(null);
  useEffect(() => {
    if (!skill) return undefined;
    const t = window.setTimeout(() => setSkill(null), 3200);
    return () => window.clearTimeout(t);
  }, [skill]);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const coreoRef = useRef<Coreografo | null>(null);
  if (!coreoRef.current) coreoRef.current = new Coreografo(fichas, formacaoCasa, formacaoFora, seed, p.comEntrada);
  const replayRef = useRef<HTMLSpanElement>(null);
  /** Fase 3 — Mundo Paralelo pedido no trilho (o laço toca quando o campo estiver livre). */
  const paraleloPedidoRef = useRef<Paralelo | null>(null);
  const [paralelosVistos, setParalelosVistos] = useState<ReadonlySet<string>>(() => new Set());
  const [paraleloNaTela, setParaleloNaTela] = useState<string | null>(null);
  /** Contagem antes do apito (3, 2, 1) — os times já estão na posição. */
  const [contagem, setContagem] = useState<number | null>(null);
  const pularFilmeRef = useRef(false);
  const [som, setSom] = useState(somLigado());
  const { w, h } = useViewport();
  const retrato = h > w;
  // Margem do entalhe SÓ do lado da câmera (o iPhone reserva dos dois): o outro lado vira campo.
  const entalhe = useMemo(() => ladoDoEntalhe(), [w, h]); // eslint-disable-line react-hooks/exhaustive-deps
  const margemEsq = entalhe === 'dir' ? 'min(env(safe-area-inset-left, 0px), 8px)' : 'env(safe-area-inset-left, 0px)';
  const margemDir = entalhe === 'esq' ? 'min(env(safe-area-inset-right, 0px), 8px)' : 'env(safe-area-inset-right, 0px)';

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
          pendenteRef.current = { q: e.q, desde: performance.now() };
        }
      };
      const passosAte = (achar: (e: Entrega) => boolean) => {
        if (!roteiro) return 0;
        const alvo = roteiro.slice(proxima).find(achar);
        return alvo ? Math.max(0, alvo.p - co.passos) : 0;
      };
      // Roteiro do gol (Fase 5): comemoração → REPLAY → jogada a giz → a Rápida segue.
      type Filme = { fase: 'espera' | 'replay' | 'giz' | 'semCadeia' | 'paralelo'; ini: number; frames: QuadroDoFilme[]; autorId?: string; pontos: PontoDoGiz[]; par?: Paralelo };
      let filme: Filme | null = null;
      let golAtendido: unknown = null;
      const terminarFilme = () => {
        const eraParalelo = filme?.fase === 'paralelo';
        filme = null;
        if (replayRef.current) { replayRef.current.style.opacity = '0'; replayRef.current.textContent = 'REPLAY'; }
        if (eraParalelo) {
          // Fim do Mundo Paralelo: o jogo de verdade volta de onde parou.
          onde.style.filter = '';
          setParaleloNaTela(null);
          canal.responder('retomar');
          return;
        }
        co.golGravado = null;
        canal.responder('seguir');
      };
      // O laço NUNCA morre (bug do fundador 10/10: o campo travou no 16' e o
      // relógio seguiu): o próximo quadro é pedido antes, e um erro vira registro.
      let errosNoLaco = 0;
      let contagemVista: number | null = null;
      const laco = (agora: number) => {
        raf = requestAnimationFrame(laco);
        try { umQuadro(agora); } catch (e) {
          if (errosNoLaco++ < 3) {
            console.error('[partida viva] erro no quadro', e);
            track('partida_viva_erro', { msg: String((e as Error)?.message ?? e).slice(0, 120), passo: co.passos });
          }
          acumulado = 0;
        }
      };
      const umQuadro = (agora: number) => {
        const real = Math.min(0.25, Math.max(0, (agora - antes) / 1000));
        antes = agora;
        // Fase 3 — o MUNDO PARALELO pedido no trilho: o jogo está pausado; tocam os quadros sem o comando.
        if (paraleloPedidoRef.current && !filme && !co.festa) {
          const par = paraleloPedidoRef.current;
          paraleloPedidoRef.current = null;
          filme = { fase: 'paralelo', ini: agora, frames: par.frames, pontos: [], par };
          if (replayRef.current) { replayRef.current.textContent = L('MUNDO PARALELO', 'PARALLEL WORLD'); replayRef.current.style.opacity = '1'; }
          onde.style.filter = 'grayscale(0.75) sepia(0.3)';
        }
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
        else if (filme?.fase === 'paralelo' && agora - filme.ini > (filme.par?.duracao ?? 0) * 1000 + 600) terminarFilme();
        const rodando = !filme || filme.fase === 'espera' || filme.fase === 'semCadeia';
        if (rodando && agora >= congeladoAte) {
          if (onde.style.filter) onde.style.filter = '';
          // No momento decisivo o campo congela até o manager escolher.
          // Contínuo (feedback 10/10): o momento decisivo é CÂMERA LENTA, não congelado;
          // só a prancheta (pausa pedida pelo manager) para o quadro.
          const ult0 = canal.ultimo();
          const fator = ult0?.pausado ? 0 : ult0?.decisao?.tipo === 'decisivo' ? 0.18 : 1;
          acumulado += real * velRef.current * co.escalaDoTempo() * fator;
          if (!Number.isFinite(acumulado)) acumulado = 0; // NaN aqui parava o campo pra sempre
          let guarda = 0;
          while (acumulado >= DT && guarda++ < 4000) {
            entregarPendentes();
            co.passo();
            acumulado -= DT;
            if (co.consumirCongelamento()) { congeladoAte = agora + CONGELA_MS; onde.style.filter = 'grayscale(1) contrast(1.15)'; acumulado = 0; break; }
          }
        }
        const replay = filme?.fase === 'replay' ? quadroDoReplay(filme.frames, fichas, filme.autorId, (agora - filme.ini) / REPLAY_MS)
          : filme?.fase === 'paralelo' && filme.par ? quadroDoParalelo(filme.par, co.corpos.map((c) => c.f), (agora - filme.ini) / 1000) : null;
        let q = replay ?? co.quadro(acumulado / DT);
        // Câmera do Craque: só o enquadramento muda (o jogo não sabe que é seguido).
        const alvo = !replay && seguindoRef.current ? q.jogadores.find((j) => j.f.id === seguindoRef.current) : undefined;
        // Fase 9 — o duelo do momento decisivo: a câmera enquadra os dois, o resto apaga.
        const duelo = canal.ultimo()?.decisao?.tipo === 'decisivo' ? canal.ultimo()?.decisao?.duelo : undefined;
        const nosso = duelo ? q.jogadores.find((j) => j.f.id === duelo.nosso.id) : undefined;
        const deles = duelo ? q.jogadores.find((j) => j.f.id === duelo.deles.id) : undefined;
        if (!replay && nosso && deles) {
          const mx = (nosso.x + deles.x) / 2, mz = (nosso.z + deles.z) / 2;
          const zoom = Math.max(1.2, Math.min(2.3, 62 / Math.max(12, Math.hypot(nosso.x - deles.x, nosso.z - deles.z))));
          cam.x += (mx - cam.x) * 0.15; cam.z += (mz - cam.z) * 0.15; cam.zoom += (zoom - cam.zoom) * 0.1;
          q = {
            ...q,
            camera: { ...cam },
            jogadores: q.jogadores.map((j) => ({ ...j, apagado: j !== nosso && j !== deles })),
            fitas: [
              ...q.fitas,
              { x: nosso.x, z: nosso.z, texto: duelo!.nosso.nome, forte: true },
              { x: deles.x, z: deles.z, texto: duelo!.deles.nome, forte: false },
              { x: mx, z: mz - 3, texto: '×', forte: true },
            ],
          };
        } else if (alvo) {
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
        const cont = co.contagem();
        if (cont !== contagemVista) { contagemVista = cont; setContagem(cont); if (cont != null) tocar('passe'); }
        if (co.consumirApito()) apitoRef.current?.();
        // Cronologia: libera placar/narração/lambe quando o campo mostrou o lance.
        const pend = pendenteRef.current;
        if (pend) {
          const q = pend.q;
          const golAinda = q.gol && q.gol.chave !== golVistoRef.current;
          const pronto = golAinda ? !!co.festa : (co.fila.length === 0 && !co.voo);
          if (pronto || agora - pend.desde > 9000) {
            if (golAinda) golVistoRef.current = q.gol!.chave;
            pendenteRef.current = null;
            setMostrado({ placarCasa: q.placarCasa, placarFora: q.placarFora, narracao: q.narracao, golVisto: golVistoRef.current, numeros: q.numeros });
          }
        }
        const skills = co.consumirSkills();
        if (skills.length) setSkill(skills[skills.length - 1]!);
        // Som: torcida sobe com o perigo, cala na câmera lenta; eventos viram som/vibração.
        for (const e of co.consumirSons()) tocar(e);
        const perto = Math.min(q.bola.x, 105 - q.bola.x);
        // Telas da Rápida (intervalo, pênaltis, fim) por cima: a torcida cala.
        const fora = FASES_FORA_DO_CAMPO.has(canal.ultimo()?.fase ?? 'playing');
        tiqueDoSom(q.cinema ? 0.8 : 1 - Math.min(perto, 40) / 40, co.escalaDoTempo() < 0.9, real, fora);
        const cinema = !!filme && filme.fase !== 'semCadeia' || q.cinema || ['decisivo', 'lesao', 'expulsao', 'penalti'].includes(canal.ultimo()?.decisao?.tipo ?? '');
        if (cinema !== cinemaAntes) {
          cinemaAntes = cinema;
          const alt = cinema ? '11%' : '0';
          if (faixaCimaRef.current) faixaCimaRef.current.style.height = alt;
          if (faixaBaixoRef.current) faixaBaixoRef.current.style.height = alt;
        }
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
    pendenteRef.current = { q: quadro, desde: performance.now() };
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
  const foraDoCampo = !noFilme && !!quadro && FASES_FORA_DO_CAMPO.has(quadro.fase);
  const decisao = quadro?.decisao ?? null;
  const gol = quadro?.gol ?? null;
  // As fichas vivas vêm do coreógrafo (quem entrou do banco já está lá).
  const fichaSel = selecionada ? coreoRef.current?.corpos.find((c) => c.f.id === selecionada)?.f : undefined;
  const protagonista = decisao?.protagonista ? coreoRef.current?.corpos.map((c) => c.f).find((f) => f.nome === decisao.protagonista || decisao.protagonista!.startsWith(f.nome)) : undefined;
  useEffect(() => { palcoRef.current?.selecionar(selecionada); }, [selecionada]);
  // Quem vai sair fica marcado no campo enquanto a substituição está aberta.
  useEffect(() => { palcoRef.current?.marcarAlvoDaTroca(painel === 'banco' ? saiEscolhido : null); }, [painel, saiEscolhido]);

  /** Toque no campo → ficha (o palco pode estar girado 90° por CSS). */
  const tocarNoCampo = (e: React.PointerEvent<HTMLDivElement>) => {
    const { x, y } = pontoLocal(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), retrato);
    const id = palcoRef.current?.fichaEm(x, y) ?? null;
    // Substituição aberta: tocar em alguém da casa no campo = escolher quem SAI.
    if (painel === 'banco') {
      const sai = fichaDaCasaEm(e.clientX, e.clientY);
      if (sai) { setSaiEscolhido(saiEscolhido === sai ? null : sai); return; }
    }
    setSelecionada(id && id !== selecionada ? id : null);
    if (id) setPainel(null);
  };
  const autorDoGol = gol ? coreoRef.current?.corpos.find((c) => c.f.id === gol.actorId)?.f ?? fichas.find((f) => f.id === gol.actorId) : undefined;
  const segmentos = Math.round(((quadro?.momento ?? 50) / 100) * 10);
  const xgDoLance = quadro?.lance?.xg ?? gol?.xg;
  // Momento decisivo: a faixa de baixo chama a decisão (o campo congelado não é trava).
  const narracaoMostrada = mostrado.narracao;
  const golNaTela = !!gol && mostrado.golVisto === gol.chave && !(decisao && !noFilme);
  const legenda = decisao?.tipo === 'decisivo' && !noFilme
    ? L('SUA DECISÃO ← escolha no painel', 'YOUR CALL ← choose on the left')
    : narracaoMostrada[0]?.texto.replace(/^\d+'\s*—\s*/, '') ?? '';
  // Toque + vibração quando a decisão chega.
  const decisivoChave = decisao?.tipo === 'decisivo' ? decisao.chave : null;
  useEffect(() => { if (decisivoChave && !noFilme) tocar('alerta'); }, [decisivoChave, noFilme]);
  // Telemetria (Fase 3): a oferta do Mundo Paralelo, uma vez por prova — a base pra comparar quem viu com quem não viu.
  const paraleloOferecido = !noFilme ? quadro?.paralelo?.chave ?? null : null;
  useEffect(() => {
    if (paraleloOferecido) track('mundo_paralelo_oferecido', { minuto: quadro?.minuto ?? 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paraleloOferecido]);

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

      <div
        className="grid h-full w-full"
        style={{ gridTemplateColumns: `calc(clamp(100px, 18%, 156px) + ${margemEsq}) minmax(0, 1fr) calc(clamp(66px, 8.5%, 92px) + ${margemDir})` }}
      >
        {/* TRILHO ESQUERDO */}
        <aside className="flex min-h-0 flex-col gap-2 overflow-hidden border-r border-linha p-2 font-prova text-[11px]" style={{ paddingLeft: `max(0.5rem, ${margemEsq})` }}>
          <div>
            {/* O RELÓGIO grande (feedback 10/10: tempo no futebol é muito importante). */}
            <div className="flex items-end justify-between gap-1">
              <span className={`font-spray font-black leading-[0.85] text-rua tabular-nums ${quadro?.acrescimo ? 'text-[32px]' : 'text-[40px]'}`} aria-label={L(`Minuto ${quadro?.minuto ?? 0}`, `Minute ${quadro?.minuto ?? 0}`)}>
                {quadro?.minuto ?? 0}{quadro?.acrescimo ? `+${quadro.acrescimo}` : ''}&prime;
              </span>
              <span className="pb-0.5 font-prova text-[10px] uppercase text-mudo">
                {(quadro?.minuto ?? 0) <= 45 ? L('1º tempo', '1st half') : L('2º tempo', '2nd half')}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
              <span className="font-impact text-[15px] tracking-wide">{siglaCasa}</span>
              <span className="font-spray text-[22px] font-black leading-none text-papel tabular-nums">
                {mostrado.placarCasa} × {mostrado.placarFora}
              </span>
              <span className="font-impact text-[15px] tracking-wide text-suave">{siglaFora}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <div className="flex gap-[2px]" aria-label={L('Momento da partida', 'Match momentum')}>
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className={`h-1 w-[5px] ${i < segmentos ? 'bg-rua' : 'bg-cal'}`} />
                ))}
              </div>
            </div>
            {/* Fase 12 — os números ao vivo (dos lances mostrados + posse do fluxo). */}
            {/* No gol o cabeçalho recolhe: o lambe ocupa o trilho. */}
            {mostrado.numeros && !golNaTela && !painel && <NumerosNoTrilho n={mostrado.numeros} />}
          </div>

          {noFilme && <span className="self-start bg-cal px-1.5 py-0.5 font-prova text-[11px] text-asfalto-27">{L('Filme', 'Film')}</span>}
          {!golNaTela && !painel && <SkillNoTrilho skill={skill} />}
          {decisao && !noFilme ? (
            <PainelDecisao decisao={decisao} protagonista={protagonista} onResponder={canal.responder} />
          ) : gol && mostrado.golVisto === gol.chave ? (
            <LambeDoGol quadro={quadro ? { ...quadro, placarCasa: mostrado.placarCasa, placarFora: mostrado.placarFora } : quadro} autor={autorDoGol} nome={gol.nome} />
          ) : painel === 'telaCheia' ? (
            <div className="flex min-h-0 flex-col gap-2 overflow-y-auto border-t border-linha pt-2 font-prova text-[11px] leading-snug text-papel">
              <span className="self-start -rotate-2 bg-rua px-1.5 font-impact text-[14px] text-asfalto-27">{L('Tela cheia', 'Full screen')}</span>
              <p>{L('No iPhone, o Safari não deixa site nenhum esconder as barras. O jogo instalado abre sem elas:', 'On iPhone, Safari never hides its bars for websites. The installed game opens without them:')}</p>
              <ol className="flex flex-col gap-1">
                <li><b className="text-rua">1</b> {L('Toque em Compartilhar', 'Tap Share')} <span aria-hidden>⎙</span></li>
                <li><b className="text-rua">2</b> {L('Adicionar à Tela de Início', 'Add to Home Screen')}</li>
                <li><b className="text-rua">3</b> {L('Abra o OLEFOOT pelo ícone', 'Open OLEFOOT from the icon')}</li>
              </ol>
              <button type="button" onClick={() => setPainel(null)} className="self-start border border-linha bg-concreto px-2 py-1 text-papel">{L('Entendi', 'Got it')}</button>
            </div>
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
            <PainelSubstituicao
              emCampo={coreoRef.current?.corpos.filter((c) => c.f.lado === 'home').map((c) => c.f) ?? []}
              banco={quadro.banco}
              rostos={rostosDoBanco}
              restantes={quadro.subsRestantes ?? 0}
              sai={saiEscolhido}
              entra={entraEscolhido}
              onSai={(id) => setSaiEscolhido(saiEscolhido === id ? null : id)}
              onEntra={(id) => setEntraEscolhido(entraEscolhido === id ? null : id)}
              onTrocar={() => { if (saiEscolhido && entraEscolhido) trocar(saiEscolhido, entraEscolhido); }}
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
          ) : pausado && !noFilme && !paraleloNaTela ? (
            <PainelPrancheta leitura={leitura} onVoltar={() => canal.responder('retomar')} />
          ) : (
            <>
              {quadro?.paralelo && !noFilme && !paralelosVistos.has(quadro.paralelo.chave) && !paraleloNaTela && (
                <button
                  type="button"
                  onClick={() => {
                    const co = coreoRef.current;
                    const pedido = quadro.paralelo;
                    if (!co || !pedido) return;
                    setParalelosVistos((v) => new Set(v).add(pedido.chave));
                    track('mundo_paralelo_visto', { minuto: quadro.minuto, causa: pedido.prova.causa.tipo });
                    const par = encenarParalelo(co.corpos.map((c) => c.f), formacaoCasa, formacaoFora, seed, pedido.prova);
                    if (!par) return;
                    canal.responder('pausar');
                    paraleloPedidoRef.current = par;
                    setParaleloNaTela(pedido.chave);
                  }}
                  className="self-stretch border-l-[3px] border-rua bg-concreto px-2 py-1.5 text-left font-prova text-[11px] leading-snug text-papel"
                >
                  <span className="block font-impact text-[14px] uppercase leading-tight text-rua">{L('E se eu não tivesse mandado?', 'What if I hadn’t called it?')}</span>
                  <span className="block text-mudo">{L(`Mundo paralelo · sem ${quadro.paralelo.rotulo}`, `Parallel world · without ${quadro.paralelo.rotulo}`)}</span>
                </button>
              )}
              {paraleloNaTela && (
                <p className="font-prova text-[11px] leading-snug text-cal">
                  {L('O mesmo jogo, os mesmos dados — sem o seu comando. O jogo de verdade espera.', 'Same match, same dice — without your call. The real match is waiting.')}
                </p>
              )}
              <Narracao quadro={quadro ? { ...quadro, narracao: mostrado.narracao } : quadro} />
            </>
          )}
        </aside>

        {/* CENTRO — só o campo (+ faixas de cinema nos lances grandes) */}
        <div className="relative min-w-0 overflow-hidden">
          <div ref={campoRef} onPointerDown={tocarNoCampo} className="absolute inset-0 cursor-pointer transition-[filter] duration-200" />
          {contagem != null && !noFilme && (
            <div className="pointer-events-none absolute inset-0 z-[3] flex flex-col items-center justify-center gap-2">
              <span
                key={contagem}
                className="bg-rua px-6 font-impact text-[clamp(72px,18vh,160px)] leading-none text-asfalto-27 shadow-[6px_6px_0_var(--color-asfalto-27)]"
                style={{ animation: 'pv-contagem 1s ease-out forwards' }}
              >
                {contagem}
              </span>
              <span className="-rotate-2 bg-asfalto-27 px-2 font-prova text-[11px] uppercase tracking-[0.2em] text-cal">{L('Bola no centro', 'Kick-off')}</span>
            </div>
          )}
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
        <aside className="flex min-h-0 flex-col items-stretch gap-1 overflow-y-auto border-l border-linha p-1 [justify-content:safe_center]" style={{ paddingRight: `max(0.25rem, ${margemDir})` }}>
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
              {L('Trocas', 'Subs')} {quadro.subsRestantes ?? 0}
            </Botao>
          )}
          {quadro?.pausado !== undefined && !noFilme && (
            <Botao ativo={pausado} onClick={() => canal.responder(pausado ? 'retomar' : 'pausar')} rotulo={L('Prancheta', 'Tactics board')}>
              {pausado ? L('▶ Jogo', '▶ Play') : L('Prancheta', 'Board')}
            </Botao>
          )}
          {/* COMANDO DE VOZ (protótipo 14/10): só na partida ao vivo do LEGACY (não no filme). */}
          {!noFilme && quadro?.subsRestantes !== undefined && (
            <BotaoDeVoz canal={canal} quadro={quadro} corpos={() => coreoRef.current?.corpos.map((c) => c.f) ?? fichas} som={som} />
          )}
          {ofereceTelaCheia && (
            <Botao ativo={painel === 'telaCheia'} onClick={pedirTelaCheia} rotulo={L('Tela cheia', 'Full screen')}>
              <span aria-hidden className="text-[14px] leading-none">⛶</span>
              {L('Tela', 'Full')}
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
