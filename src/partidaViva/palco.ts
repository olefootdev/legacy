/**
 * PARTIDA VIVA — palco em PixiJS v8 (Fase 1).
 *
 * Só desenha. Recebe o `QuadroDoPalco` do coreógrafo e posiciona:
 * - campo (gramado listrado + linhas) em metros, desenhado UMA vez;
 * - 22 fichas em espaço de tela (tamanho constante): rosto real recortado em
 *   círculo ou iniciais, anel na cor do time, anel de fôlego, sombra;
 * - bola com sombra, altura e rastro; rótulo do dono da bola.
 * DS 2027: cor chapada, sem brilho, sem glow.
 */
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Ficha } from './tipos';
import type { QuadroDoPalco } from './coreografo';
import type { PontoDoGiz } from './filme';
import { L as T } from '@/i18n/L';

const C = 105;
const L = 68;
const L_GOL = T('GOL', 'GOAL');
const COR = {
  gramaA: 0x336829, gramaB: 0x2e5e27, fora: 0x22441e, linha: 0xeee9df,
  rua: 0xf2e61e, cal: 0xe9e2d0, concreto: 0x1c1c1a, asfalto: 0x0d0d0c, papel: 0xeee9df, alerta: 0xe0703a,
};

interface FichaVisual { raiz: Container; folego: Graphics; ultimaFadiga: number }

export class PalcoPixi {
  private app = new Application();
  private mundo = new Container();
  private camadaFichas = new Container();
  private bolaG = new Graphics();
  private sombraBola = new Graphics();
  private rastroG = new Graphics();
  /** Leitura de jogo e assinaturas: linha do passe, giz do regista, rastro do matador, velocidade. */
  private desenhoG = new Graphics();
  private rotulo!: Text;
  private fichas = new Map<string, FichaVisual>();
  private vivo = false;
  /** Onde cada ficha foi desenhada (pra achar quem foi tocado). */
  private naTela = new Map<string, { x: number; y: number; r: number }>();
  private selecionada: string | null = null;
  /** Etiquetas reaproveitadas (fitas no campo, números e nomes do giz). */
  private camadaEtiquetas = new Container();
  private etiquetas: { raiz: Container; fundo: Graphics; texto: Text }[] = [];
  private usadas = 0;

  async iniciar(onde: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: onde,
      background: COR.fora,
      antialias: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
    });
    if (!onde.isConnected) { this.app.destroy(true); return; }
    onde.appendChild(this.app.canvas);
    this.app.canvas.style.display = 'block';
    this.desenharCampo();
    this.camadaFichas.sortableChildren = true;
    this.app.stage.addChild(this.mundo, this.desenhoG, this.rastroG, this.camadaFichas, this.sombraBola, this.bolaG, this.camadaEtiquetas);
    this.rotulo = new Text({ text: '', style: { fontFamily: 'Geist Mono, monospace', fontSize: 11, fill: COR.papel } });
    const fundoRotulo = new Graphics();
    const caixa = new Container();
    caixa.addChild(fundoRotulo, this.rotulo);
    caixa.label = 'rotulo';
    this.app.stage.addChild(caixa);
    this.vivo = true;
  }

  destruir(): void {
    if (!this.vivo) return;
    this.vivo = false;
    this.app.destroy(true, { children: true, texture: true });
  }

  montarFichas(fichas: Ficha[]): void {
    if (!this.vivo) return;
    for (const f of fichas) {
      const raiz = new Container();
      const sombra = new Graphics().ellipse(2, 8, 9, 3.5).fill({ color: 0x000000, alpha: 0.32 });
      const trilho = new Graphics().circle(0, 0, 15).stroke({ width: 2, color: COR.papel, alpha: 0.18 });
      const folego = new Graphics();
      // Identidade forte dos times: casa = anel amarelo; adversário = anel escuro
      // com contorno creme (os retratos do Genesis têm fundo amarelo).
      const anel = f.lado === 'home'
        ? new Graphics().circle(0, 0, 13).fill(COR.rua).stroke({ width: 1, color: COR.asfalto })
        : new Graphics().circle(0, 0, 13).fill(COR.asfalto).stroke({ width: 1.5, color: COR.cal });
      const miolo = new Graphics().circle(0, 0, 10).fill(f.lado === 'home' ? COR.cal : COR.concreto);
      const ini = new Text({
        text: f.iniciais,
        style: { fontFamily: 'Anton, Impact, sans-serif', fontSize: 11, fill: f.lado === 'home' ? COR.asfalto : COR.papel },
      });
      ini.anchor.set(0.5);
      raiz.addChild(sombra, trilho, folego, anel, miolo, ini);
      this.camadaFichas.addChild(raiz);
      const vis: FichaVisual = { raiz, folego, ultimaFadiga: -1 };
      this.fichas.set(f.id, vis);
      if (f.rosto) this.carregarRosto(f.rosto, raiz, ini);
    }
  }

  desenhar(q: QuadroDoPalco, giz?: { pontos: PontoDoGiz[]; progresso: number }): void {
    if (!this.vivo) return;
    this.usadas = 0;
    const W = this.app.screen.width, H = this.app.screen.height;
    const base = Math.min((W - 8) / (C + 4), (H - 8) / (L + 4));
    const s = base * q.camera.zoom;
    const ox = W / 2 - q.camera.x * s, oz = H / 2 - q.camera.z * s;
    this.mundo.scale.set(s);
    this.mundo.position.set(ox, oz);
    const tela = (x: number, z: number) => ({ x: ox + x * s, y: oz + z * s });
    const escala = Math.max(0.75, Math.min(1.35, (H / 320) * Math.sqrt(q.camera.zoom)));

    // fichas (as mais de baixo por cima, pra profundidade)
    const ordem = [...q.jogadores].sort((a, b) => a.z - b.z);
    ordem.forEach((j, i) => {
      const vis = this.fichas.get(j.f.id);
      if (!vis) return;
      const p = tela(j.x, j.z);
      this.naTela.set(j.f.id, { x: p.x, y: p.y, r: 15 * escala });
      vis.raiz.position.set(p.x, p.y);
      vis.raiz.scale.set(escala);
      vis.raiz.alpha = j.apagado ? 0.3 : 1;
      vis.raiz.zIndex = i;
      if (vis.ultimaFadiga !== j.f.fadiga) {
        vis.ultimaFadiga = j.f.fadiga;
        const folego = Math.max(0.05, 1 - j.f.fadiga / 100);
        vis.folego.clear()
          .arc(0, 0, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * folego)
          .stroke({ width: 2, color: folego > 0.5 ? COR.papel : COR.alerta });
      }
    });

    // leitura de jogo + assinaturas por classe (traço chapado, sem brilho)
    const d = this.desenhoG.clear();
    const tracejar = (a: { x: number; y: number }, b: { x: number; y: number }, cor: number, alpha: number, traco = 5, vao = 4) => {
      const L2 = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / L2, uy = (b.y - a.y) / L2;
      for (let p = 0; p < L2; p += traco + vao) {
        const q = Math.min(L2, p + traco);
        d.moveTo(a.x + ux * p, a.y + uy * p).lineTo(a.x + ux * q, a.y + uy * q);
      }
      d.stroke({ width: 1.6, color: cor, alpha });
    };
    const sel = this.selecionada ? this.naTela.get(this.selecionada) : undefined;
    if (sel) {
      // anel tracejado da ficha tocada
      const rr = sel.r + 5;
      for (let k = 0; k < 16; k += 2) {
        const a0 = (k / 16) * Math.PI * 2, a1 = ((k + 1) / 16) * Math.PI * 2;
        d.moveTo(sel.x + rr * Math.cos(a0), sel.y + rr * Math.sin(a0)).arc(sel.x, sel.y, rr, a0, a1);
      }
      d.stroke({ width: 1.6, color: COR.rua });
    }
    if (q.passe) tracejar(tela(q.passe.x0, q.passe.z0), tela(q.passe.x1, q.passe.z1), COR.papel, 0.65, 3, 5);
    for (const arco of q.arcos) {
      const a = tela(arco.x0, arco.z0), b = tela(arco.x1, arco.z1);
      const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.18, my = (a.y + b.y) / 2 - (b.x - a.x) * 0.18;
      d.moveTo(a.x, a.y).quadraticCurveTo(mx, my, b.x, b.y).stroke({ width: 2, color: COR.cal, alpha: Math.max(0, 0.75 * (1 - arco.idade / 3.5)) });
    }
    q.trilhaDoMatador.forEach((p, i) => {
      if (i % 2) return;
      const t = tela(p.x, p.z);
      d.circle(t.x, t.y, 1.6 * escala).fill({ color: COR.rua, alpha: 0.35 + 0.5 * (i / q.trilhaDoMatador.length) });
    });
    for (const j of q.jogadores) {
      const v = Math.hypot(j.vx, j.vz);
      if (j.apagado || v < 6.2 || (j.f.classe !== 'velocista' && j.f.classe !== 'ponta_driblador')) continue;
      const p = tela(j.x, j.z), ux = j.vx / v, uz = j.vz / v, r = 16 * escala;
      for (const o of [-5, 0, 5]) {
        const bx = p.x - ux * r - uz * o, by = p.y - uz * r + ux * o;
        d.moveTo(bx, by).lineTo(bx - ux * 12 * escala, by - uz * 12 * escala);
      }
      d.stroke({ width: 1.5, color: COR.papel, alpha: 0.6 });
    }

    // rastro
    this.rastroG.clear();
    q.rastro.forEach((r, i) => {
      if (i === 0) return;
      const a = tela(q.rastro[i - 1]!.x, q.rastro[i - 1]!.z), b = tela(r.x, r.z);
      this.rastroG.moveTo(a.x, a.y - q.rastro[i - 1]!.h * s * 0.5).lineTo(b.x, b.y - r.h * s * 0.5)
        .stroke({ width: 2.5 * (i / q.rastro.length), color: COR.papel, alpha: 0.6 * (i / q.rastro.length) });
    });

    // bola
    const b = tela(q.bola.x, q.bola.z);
    const rb = 3.6 * escala;
    this.sombraBola.clear().ellipse(b.x + 1, b.y + 2, rb, rb * 0.5).fill({ color: 0x000000, alpha: 0.4 });
    this.bolaG.clear().circle(b.x, b.y - q.bola.h * s * 0.5, rb).fill(0xffffff).stroke({ width: 1, color: COR.asfalto });

    // rótulo do dono da bola
    const caixa = this.app.stage.getChildByLabel('rotulo') as Container | null;
    if (caixa) {
      const dono = q.dono ? q.jogadores.find((j) => j.f.id === q.dono!.id) : undefined;
      caixa.visible = !!dono;
      if (dono) {
        this.rotulo.text = dono.f.nome;
        const fundo = caixa.children[0] as Graphics;
        const w = this.rotulo.width + 10;
        fundo.clear().rect(-w / 2, -9, w, 17).fill(COR.asfalto);
        this.rotulo.position.set(-this.rotulo.width / 2, -7.5);
        const p = tela(dono.x, dono.z);
        caixa.position.set(p.x, p.y - 26 * escala);
      }
    }
    if (giz) {
      // a jogada a giz: campo escurece, só o caminho da bola fica
      this.camadaFichas.alpha = 0.35;
      d.rect(0, 0, W, H).fill({ color: COR.asfalto, alpha: 0.45 });
    } else this.camadaFichas.alpha = 1;
    this.desenharFitasEGiz(q, tela, escala, giz);
  }

  /** Uma etiqueta do pool, posicionada (fita: inclinada como lambe). */
  private etiqueta(texto: string, x: number, y: number, tom: 'cal' | 'rua' | 'asfalto', inclinada: boolean, tamanho = 11): void {
    if (this.usadas >= this.etiquetas.length) {
      const raiz = new Container(), fundo = new Graphics();
      const t = new Text({ text: '', style: { fontFamily: 'Geist Mono, monospace', fontSize: 11, fill: COR.asfalto } });
      raiz.addChild(fundo, t);
      this.camadaEtiquetas.addChild(raiz);
      this.etiquetas.push({ raiz, fundo, texto: t });
    }
    const e = this.etiquetas[this.usadas++]!;
    e.raiz.visible = true;
    e.texto.text = texto;
    e.texto.style.fontSize = tamanho;
    e.texto.style.fill = tom === 'asfalto' ? COR.cal : COR.asfalto;
    const w = e.texto.width + 12, h = tamanho + 7;
    e.fundo.clear().rect(-w / 2, -h / 2, w, h).fill(tom === 'rua' ? COR.rua : tom === 'cal' ? COR.cal : COR.asfalto);
    e.texto.position.set(-e.texto.width / 2, -e.texto.height / 2);
    e.raiz.position.set(x, y);
    e.raiz.rotation = inclinada ? -0.1 : 0;
  }

  private desenharFitasEGiz(q: QuadroDoPalco, tela: (x: number, z: number) => { x: number; y: number }, escala: number, giz?: { pontos: PontoDoGiz[]; progresso: number }): void {
    for (const f of q.fitas) {
      const p = tela(f.x, f.z);
      this.etiqueta(f.texto, p.x, p.y + 28 * escala, f.forte ? 'rua' : 'cal', true);
    }
    if (giz && giz.pontos.length > 1) {
      const d = this.desenhoG;
      const pts = giz.pontos.map((p) => tela(p.x, p.z));
      const ate = giz.progresso * (pts.length - 1);
      for (let i = 0; i < pts.length - 1 && i < ate; i++) {
        const a = pts[i]!, b = pts[i + 1]!, f = Math.min(1, ate - i);
        const fx = a.x + (b.x - a.x) * f, fy = a.y + (b.y - a.y) * f;
        const L2 = Math.hypot(fx - a.x, fy - a.y) || 1, ux = (fx - a.x) / L2, uy = (fy - a.y) / L2;
        for (let s2 = 0; s2 < L2; s2 += 12) d.moveTo(a.x + ux * s2, a.y + uy * s2).lineTo(a.x + ux * Math.min(L2, s2 + 7), a.y + uy * Math.min(L2, s2 + 7));
      }
      d.stroke({ width: 2.5, color: COR.cal, alpha: 0.95 });
      giz.pontos.forEach((p, i) => {
        if (i > ate + 0.01) return;
        const t = pts[i]!;
        if (p.gol) { this.etiqueta(L_GOL, t.x - 24, t.y - 16, 'rua', true, 13); return; }
        d.circle(t.x, t.y, 9).fill(COR.rua);
        if (p.numero != null) this.etiqueta(String(p.numero), t.x, t.y, 'rua', false, 11);
        if (p.nome) this.etiqueta(p.nome, t.x, t.y + 20, 'asfalto', false);
      });
    }
    for (let i = this.usadas; i < this.etiquetas.length; i++) this.etiquetas[i]!.raiz.visible = false;
  }

  /** Ficha mais perto do ponto tocado (coordenadas do canvas), até ~1,4 raio. */
  fichaEm(x: number, y: number): string | null {
    let melhor: string | null = null, md = Infinity;
    for (const [id, p] of this.naTela) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < p.r * 1.4 && d < md) { md = d; melhor = id; }
    }
    return melhor;
  }

  selecionar(id: string | null): void {
    this.selecionada = id;
  }

  private desenharCampo(): void {
    const g = new Graphics();
    g.rect(-6, -6, C + 12, L + 12).fill(COR.fora);
    for (let i = 0; i < 10; i++) g.rect(i * 10.5, 0, 10.5, L).fill(i % 2 ? COR.gramaB : COR.gramaA);
    const linha = { width: 0.32, color: COR.linha, alpha: 0.75 };
    g.rect(0, 0, C, L).stroke(linha);
    g.moveTo(C / 2, 0).lineTo(C / 2, L).stroke(linha);
    g.circle(C / 2, L / 2, 9.15).stroke(linha);
    g.circle(C / 2, L / 2, 0.45).fill({ color: COR.linha, alpha: 0.75 });
    g.rect(0, 13.85, 16.5, 40.3).stroke(linha);
    g.rect(C - 16.5, 13.85, 16.5, 40.3).stroke(linha);
    g.rect(0, 24.85, 5.5, 18.3).stroke(linha);
    g.rect(C - 5.5, 24.85, 5.5, 18.3).stroke(linha);
    g.circle(11, L / 2, 0.4).fill({ color: COR.linha, alpha: 0.75 });
    g.circle(C - 11, L / 2, 0.4).fill({ color: COR.linha, alpha: 0.75 });
    g.rect(-1.8, 30.34, 1.8, 7.32).stroke({ width: 0.5, color: COR.linha });
    g.rect(C, 30.34, 1.8, 7.32).stroke({ width: 0.5, color: COR.linha });
    // bandeirinhas
    for (const [x, z] of [[0, 0], [0, L], [C, 0], [C, L]] as const) g.moveTo(x, z).lineTo(x, z - 2.2).stroke({ width: 0.4, color: COR.rua });
    this.mundo.addChild(g);
  }

  private carregarRosto(url: string, raiz: Container, ini: Text): void {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!this.vivo) return;
      try {
        const tex = Texture.from(img);
        const sp = new Sprite(tex);
        sp.anchor.set(0.5);
        const lado = Math.min(img.width, img.height) || 1;
        sp.scale.set(20 / lado);
        const mascara = new Graphics().circle(0, 0, 10).fill(0xffffff);
        sp.mask = mascara;
        raiz.addChild(mascara, sp);
        ini.visible = false;
      } catch {
        /* sem CORS: fica com as iniciais */
      }
    };
    img.src = url;
  }
}
