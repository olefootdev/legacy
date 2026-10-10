/**
 * PARTIDA VIVA — coreógrafo.
 *
 * Transforma o `QuadroAoVivo` (a verdade que a Partida Rápida está mostrando)
 * em movimento. NUNCA decide nada: só encena o lance que já aconteceu.
 *
 * - Passo fixo de 10 Hz (`DT`), sorteio pela seed do plano (sem Math.random).
 * - Forma do time (Fase 3, `forma.ts`): intenção por time (construção, ataque,
 *   pressão, blocos, transição) + a classe do SMART-PROFILE de cada um.
 * - Movimento natural (`fisica.ts`): inércia, chegada suave, separação.
 * - Lances e gols (`encenacao.ts`): jogada contada pelo servidor (Fase 2),
 *   câmera lenta pelo xG, gol congela, faixas de cinema (Fase 3).
 *
 * O estado é exposto (sem `private`) só pros módulos de encenação.
 */
import { FORMATION_BASES } from '@/match-engine/formations/catalog';
import type { FormationSchemeId } from '@/match-engine/types';
import type { MatchPlanEvent } from '@/match/quickPlanTypes';
import { C, DT, L, esquema, lim, moverCorpo, semente, type Corpo, type Voo } from './fisica';
import { L as T } from '@/i18n/L';
import { ajustarPorEstilo, ajustarPorGrito, alvoNaForma, CLASSES_QUE_PRESSIONAM, formaDe, intencaoDoTime, profundidade, type Forma } from './forma';
import { encenarGol, encenarLance, entrarEmCampo } from './encenacao';
import { aplicarPosse, decidirToque, xDaZona, type PosseDoPlano } from './jogoAmbiente';
import { soltarBolaParada } from './bolaParada';
import type { EventoDeSom } from './som';
import type { SkillEmCampo } from './skills';
import type { Ficha, QuadroAoVivo } from './tipos';

export { DT } from './fisica';

type Ponto = { x: number; z: number };

export interface QuadroDoPalco {
  jogadores: { f: Ficha; x: number; z: number; vx: number; vz: number; apagado: boolean }[];
  bola: { x: number; z: number; h: number };
  rastro: { x: number; z: number; h: number }[];
  dono: Ficha | null;
  camera: { x: number; z: number; zoom: number };
  /** Faixas de cinema (lance grande, jogada que termina em chute, gol). */
  cinema: boolean;
  /** Linha pontilhada: o passe que o portador está vendo. */
  passe: { x0: number; z0: number; x1: number; z1: number } | null;
  /** Arcos de giz (lançamento do regista/maestro), com idade em segundos. */
  arcos: { x0: number; z0: number; x1: number; z1: number; idade: number }[];
  /** Rastro pontilhado do matador atacando a área. */
  trilhaDoMatador: Ponto[];
  /** Fitas coladas no campo (DRIBLE, ROUBOU!, nomes na entrada…). */
  fitas: { x: number; z: number; texto: string; forte: boolean }[];
}

/** Um quadro do filme do gol (pro replay). */
export interface QuadroDoFilme { t: number; pos: number[]; bola: { x: number; z: number; h: number } }

/** Identidade de um lance (minuto, tipo, autor, texto) — sobrevive a JSON. */
export const chaveDoLance = (l: MatchPlanEvent) => `${l.minute}|${l.kind}|${l.actor_id ?? ''}|${l.text ?? ''}`;

/** Número de verdade ou o padrão (NaN/undefined no fôlego congelava o campo inteiro). */
const num = (v: unknown, padrao: number) => (typeof v === 'number' && Number.isFinite(v) ? v : padrao);
/** Ficha com fôlego e velocidade sempre numéricos. */
const fichaSegura = (f: Ficha): Ficha => ({ ...f, fadiga: lim(num(f.fadiga, 0), 0, 100), velocidade: lim(num(f.velocidade, 65), 1, 100) });
/** Passo máximo de cada um (m/s): velocidade da ficha, menos o cansaço. */
const vmaxDe = (f: Ficha) => (5.4 + (f.velocidade / 100) * 3.4) * (1 - f.fadiga * 0.0025);

export class Coreografo {
  corpos: Corpo[] = [];
  bola = { x: C / 2, z: L / 2, h: 0 };
  pbola = { x: C / 2, z: L / 2, h: 0 };
  dono: Corpo | null = null;
  voo: Voo | null = null;
  posse: 'home' | 'away' = 'home';
  /** Momento do plano (0–100, casa) — zona do jogo ambiente e pressão. */
  momento = 50;
  /** Estilo do dock da Rápida (casa) — a forma reage na hora. */
  estiloCasa: string | undefined;
  /** LEGACY (Fase 4b): grito valendo e ordens individuais da casa. */
  gritoCasa: string | undefined;
  /** Passos dados desde o apito — o relógio do filme (Fase 6). */
  passos = 0;
  /** Fase 10: skills com nome que acabaram de acontecer (o palco mostra no trilho). */
  skills: SkillEmCampo[] = [];
  private skillSeq = 0;
  ordens: Record<string, string> = {};
  rnd: () => number;
  t = 0;
  fila: Array<{ em: number; faz: () => void }> = [];
  envolvidos: Set<Corpo> | null = null;
  festa: Corpo | null = null;
  cinemaAte = -1;
  lento: { desde: number; ate: number; fator: number } | null = null;
  congelarPedido = false;
  passesAgendados: { em: number; de: Corpo; x: number; z: number }[] = [];
  arcos: { x0: number; z0: number; x1: number; z1: number; em: number }[] = [];
  /** Sons/vibrações pendentes — o palco consome a cada quadro. */
  sons: EventoDeSom[] = [];
  fitas: { x: number; z: number; texto: string; ate: number; forte: boolean; de?: Corpo }[] = [];
  /** Gravação do gol (replay). */
  gravando = false;
  /** Até quando a entrada em campo manda (lances esperam). */
  entradaAte = -1;
  /** Posição de saída de cada um (o seu campo, na formação) — a foto antes do apito. */
  saida = new Map<Corpo, { x: number; z: number }>();
  /** Fase 12: a posse do minuto, do plano (o jogo entre os lances joga ela). */
  posseDoPlano: PosseDoPlano | null = null;
  /** Quem o plano diz que carregou a bola neste minuto (ainda não recebeu). */
  carregadorDoMinuto: string | null = null;
  /** Lateral / tiro de meta / impedimento em curso: ninguém toca até o reinício. */
  reinicioAte = -1;
  private posseMinuto = -1;
  /** Bola parada: quem está posicionado (escanteio, barreira, pênalti) — o fim da jogada solta. */
  posicionados = new Set<Corpo>();
  /** Pré-apito: todos já na posição de saída; o apito sai no fim da contagem (3, 2, 1). */
  preApito: { limite: number } | null = null;
  private apitoPendente = false;
  filme: QuadroDoFilme[] = [];
  golGravado: { cadeia: import('@/match/quickPlanTypes').CadeiaDeLance; autorId?: string } | null = null;

  private esquemas: Record<'home' | 'away', FormationSchemeId>;
  private centroProf: Record<'home' | 'away', number> = { home: 0.45, away: 0.45 };
  private forma: Record<'home' | 'away', Forma> = { home: formaDe('bloco_medio', '4-3-3'), away: formaDe('bloco_medio', '4-3-3') };
  private possePrev: 'home' | 'away' = 'home';
  private transicaoAte = -1;
  private pressionando = new Set<Corpo>();
  proxToque = 2;
  /** Quem deu o último passe (o jogo ambiente não devolve pra ele — sem pingue-pongue). */
  ultimoPassador: Corpo | null = null;
  /** Desde quando há bola parada montada (válvula: ninguém fica posicionado pra sempre). */
  private posicionadosDesde = -1;
  private ultimoLance: MatchPlanEvent | null = null;
  private ultimoGol: string | null = null;
  private rastro: { x: number; z: number; h: number }[] = [];
  private trilha: Ponto[] = [];
  private camera = { x: C / 2, z: L / 2, zoom: 1 };

  constructor(fichas: Ficha[], formacaoCasa: string, formacaoFora: string, seed: string, comEntrada = false) {
    this.rnd = semente(seed || 'olefoot');
    this.esquemas = { home: esquema(formacaoCasa), away: esquema(formacaoFora) };
    const bases = { home: FORMATION_BASES[this.esquemas.home], away: FORMATION_BASES[this.esquemas.away] };
    for (const f0 of fichas) {
      const f = fichaSegura(f0);
      const b = bases[f.lado][f.slot] ?? bases[f.lado].mc1!;
      const nx = f.lado === 'home' ? b.nx : 1 - b.nx;
      const nz = f.lado === 'home' ? b.nz : 1 - b.nz;
      // Antes do apito, cada time no seu campo.
      const ax = f.lado === 'home' ? Math.min(nx * C * 0.92, C / 2 - 2) : Math.max(nx * C * 0.92 + C * 0.08, C / 2 + 2);
      const ancora = { x: nx * C, z: nz * L };
      const vmax = vmaxDe(f);
      const corpo: Corpo = { f, x: ax, z: ancora.z, vx: 0, vz: 0, px: ax, pz: ancora.z, ancora, alvo: null, vmax };
      this.corpos.push(corpo);
      this.saida.set(corpo, { x: ax, z: ancora.z });
    }
    this.dono = this.achar('home', 'mc1') ?? this.corpos.find((c) => c.f.lado === 'home') ?? null;
    for (const lado of ['home', 'away'] as const) {
      const linha = this.corpos.filter((c) => c.f.lado === lado && c.f.slot !== 'gol');
      if (linha.length) this.centroProf[lado] = linha.reduce((s, c) => s + profundidade(lado, c.ancora.x), 0) / linha.length;
    }
    // Com entrada: o jogo só começa no APITO (entradaAte = ∞ até lá — ver apitar()).
    if (comEntrada) { entrarEmCampo(this); this.entradaAte = Infinity; }
  }

  /** Recebe o que a Partida Rápida está mostrando agora. */
  receber(q: QuadroAoVivo): void {
    this.momento = q.momento;
    this.estiloCasa = q.estilo;
    this.ouvirComandos(q);
    if (this.t < this.entradaAte) return; // a entrada em campo termina primeiro
    // Gol em cena: o quadro não encena mais nada (repetido ou não) — senão
    // o mesmo quadro entregue duas vezes encenaria o lance na 2ª (e o filme diverge).
    if (q.gol) {
      if (q.gol.chave !== this.ultimoGol) {
        this.ultimoGol = q.gol.chave;
        encenarGol(this, q.gol.lado, q.gol.actorId, q.gol.cadeia, q.gol.xg ?? 0.4);
      }
      return;
    }
    if (!q.gol && this.festa) this.recomecar();
    // Pela CHAVE, não pela referência: o filme (Fase 6) relê os quadros do disco
    // e cada um traz um objeto novo — o mesmo lance não pode ser encenado de novo.
    if (q.lance && chaveDoLance(q.lance) !== (this.ultimoLance && chaveDoLance(this.ultimoLance))) {
      this.ultimoLance = q.lance;
      encenarLance(this, q.lance);
    } else if (!q.lance) {
      this.ultimoLance = null;
      if (this.fila.length === 0) this.envolvidos = null;
      // Fase 12: a posse vem do plano, minuto a minuto (plano antigo: pelo momento).
      if (q.posse) {
        if (q.minuto !== this.posseMinuto) { this.posseMinuto = q.minuto; aplicarPosse(this, q.posse); }
      } else if (q.momento >= 54) this.posse = 'home';
      else if (q.momento <= 46) this.posse = 'away';
    }
  }

  /**
   * Substituição (Fase 4c): quem entra assume o slot de quem sai e chega
   * correndo da linha lateral, perto do banco. Devolve a ficha nova (o palco
   * troca o desenho) ou null se quem sai não está em campo.
   */
  trocar(saiId: string, entra: Ficha): Ficha | null {
    const c = this.corpos.find((k) => k.f.id === saiId);
    if (!c) return null;
    const nova: Ficha = fichaSegura({ ...entra, lado: c.f.lado, slot: c.f.slot });
    c.f = nova;
    c.x = c.px = C / 2 - 4;
    c.z = c.pz = L + 0.5;
    c.vx = c.vz = 0;
    c.alvo = null;
    c.vmax = vmaxDe(nova);
    if (this.dono === c) this.dono = this.maisPerto(c.f.lado, this.bola.x, this.bola.z, false);
    this.fita(T(`ENTRA ${nova.nome}`, `ON ${nova.nome}`), c.x, c.z, 2.4, true, c);
    return nova;
  }

  /** Grito novo → fita no meio do time; ordem nova → fita presa no jogador. */
  private ouvirComandos(q: QuadroAoVivo): void {
    const grito = q.grito?.tipo;
    if (grito && grito !== this.gritoCasa) {
      const casa = this.corpos.filter((c) => c.f.lado === 'home');
      const cx = casa.reduce((s, c) => s + c.x, 0) / Math.max(1, casa.length);
      const texto = { incentivar: T('VAMO!', 'COME ON!'), cobrar: T('APERTA!', 'PRESS!'), acalmar: T('CALMA!', 'EASY!') }[grito] ?? '';
      if (texto) this.fita(texto, cx, L / 2, 2.2, true);
    }
    this.gritoCasa = grito;
    for (const [id, ordem] of Object.entries(q.ordens ?? {})) {
      if (this.ordens[id] === ordem) continue;
      const c = this.corpos.find((k) => k.f.id === id);
      const texto = { segurar: T('SEGURA', 'HOLD'), atacar_espaco: T('ESPAÇO', 'SPACE'), marcar: T('MARCA', 'MARK') }[ordem] ?? '';
      if (c && texto) this.fita(texto, c.x, c.z, 1.8, false, c);
    }
    this.ordens = { ...(q.ordens ?? {}) };
  }

  /**
   * O apito inicial: todos na posição de saída (ou estourou o limite). A bola
   * no centro com o atacante da casa, e a partida começa (o palco avisa a Rápida).
   */
  apitar(): void {
    this.preApito = null;
    for (const c of this.corpos) c.alvo = null;
    this.bola = { x: C / 2, z: L / 2, h: 0 };
    this.dono = this.achar('home', 'ata') ?? this.achar('home', 'mc1');
    this.sons.push('apito');
    this.entradaAte = this.t;
    this.apitoPendente = true;
  }

  /** Contagem antes do apito (3, 2, 1) — null quando a bola já rola. */
  contagem(): number | null {
    return this.preApito ? Math.max(1, Math.ceil(this.preApito.limite - this.t - 1e-6)) : null;
  }

  /** O apito inicial acabou de soar (uma vez). */
  consumirApito(): boolean {
    const a = this.apitoPendente;
    this.apitoPendente = false;
    return a;
  }

  passo(): void {
    this.passos++;
    // Todos já estão na posição: o apito sai quando a contagem (3, 2, 1) acaba.
    if (this.preApito && this.t >= this.preApito.limite) this.apitar();
    this.t += DT;
    while (this.fila.length && this.fila[0]!.em <= this.t) this.fila.shift()!.faz();
    for (const c of this.corpos) { c.px = c.x; c.pz = c.z; }
    this.pbola = { ...this.bola };
    // Antes do apito a bola não rola (entradaAte = ∞ durante a entrada).
    // Bola parada montada (pênalti esperando o batedor): ninguém toca na bola.
    if (!this.voo && !this.festa && this.fila.length === 0 && this.t >= this.proxToque && this.t >= this.entradaAte && this.posicionados.size === 0 && this.t >= this.reinicioAte) this.toqueAmbiente();
    this.lerOJogo();
    for (const c of this.corpos) moverCorpo(c, this.alvoDaForma(c), this.corpos);
    this.moverBola();
    this.moverCamera();
    this.registrarAssinaturas();
    this.sanear();
    if (this.gravando) this.filme.push({ t: this.t, pos: this.corpos.flatMap((c) => [c.x, c.z]), bola: { ...this.bola } });
  }

  /** Uma skill com nome aconteceu (só registro — não mexe no jogo). */
  registrarSkill(codigo: string, nota: number, de: Corpo): void {
    this.skills.push({ codigo, nota, jogador: de.f.nome, lado: de.f.lado, id: ++this.skillSeq });
  }

  consumirSkills(): SkillEmCampo[] {
    const s = this.skills;
    this.skills = [];
    return s;
  }

  /** Sons e vibrações desde o último quadro. */
  consumirSons(): EventoDeSom[] {
    const s = this.sons;
    this.sons = [];
    return s;
  }

  /** Cola uma fita no campo por `seg` segundos (presa ao jogador, se houver). */
  fita(texto: string, x: number, z: number, seg = 1.4, forte = false, de?: Corpo): void {
    this.fitas.push({ texto, x, z, ate: this.t + seg, forte, de });
  }

  /** Câmera lenta (0,32–1): o palco multiplica o tempo real por isto. */
  escalaDoTempo(): number {
    return this.lento && this.t < this.lento.ate ? this.lento.fator : 1;
  }

  /** O gol acabou de entrar: o palco congela a imagem (uma vez por gol). */
  consumirCongelamento(): boolean {
    const p = this.congelarPedido;
    this.congelarPedido = false;
    return p;
  }

  quadro(alpha: number): QuadroDoPalco {
    const a = lim(alpha, 0, 1);
    const prox = this.dono ? this.passesAgendados.find((p) => p.de === this.dono && p.em > this.t - 0.05) : undefined;
    return {
      jogadores: this.corpos.map((c) => ({
        f: c.f,
        x: c.px + (c.x - c.px) * a,
        z: c.pz + (c.z - c.pz) * a,
        vx: c.vx,
        vz: c.vz,
        apagado: (this.envolvidos !== null && !this.envolvidos.has(c)) || (this.festa !== null && c.f.lado !== this.festa.f.lado),
      })),
      bola: {
        x: this.pbola.x + (this.bola.x - this.pbola.x) * a,
        z: this.pbola.z + (this.bola.z - this.pbola.z) * a,
        h: this.pbola.h + (this.bola.h - this.pbola.h) * a,
      },
      rastro: this.rastro,
      dono: this.dono?.f ?? null,
      camera: this.camera,
      cinema: this.t < this.cinemaAte,
      passe: prox ? { x0: this.bola.x, z0: this.bola.z, x1: prox.x, z1: prox.z } : null,
      arcos: this.arcos.map((r) => ({ ...r, idade: this.t - r.em })),
      trilhaDoMatador: this.trilha,
      fitas: this.fitas.filter((f) => f.ate > this.t).map((f) => ({ x: f.de ? f.de.x : f.x, z: f.de ? f.de.z : f.z, texto: f.texto, forte: f.forte })),
    };
  }

  // ── leitura do jogo ──────────────────────────────────────────────────────

  /** Uma vez por passo: intenção e forma de cada time + quem sai pra pressionar. */
  private lerOJogo(): void {
    if (this.posse !== this.possePrev) { this.transicaoAte = this.t + 3.5; this.possePrev = this.posse; }
    const ultimo = this.ultimoLance?.kind.replace(/_(home|away)$/, '') ?? '';
    for (const lado of ['home', 'away'] as const) {
      const intencao = intencaoDoTime({
        comBola: this.posse === lado,
        profBola: profundidade(this.posse, this.bola.x),
        emTransicao: this.t < this.transicaoAte,
        ultimoLanceChute: ['shot', 'save', 'chance', 'woodwork'].includes(ultimo),
        dominio: lado === 'home' ? this.momento : 100 - this.momento,
      });
      const base = formaDe(intencao, this.esquemas[lado]);
      this.forma[lado] = lado === 'home' ? ajustarPorGrito(ajustarPorEstilo(base, this.estiloCasa, this.posse === lado), this.gritoCasa, this.posse === lado) : base;
    }
    // Pressão no portador: o mais perto sai (se a forma pede, ou se é de classe que pressiona).
    this.pressionando.clear();
    if (this.envolvidos || this.festa || !this.dono) return;
    const defende = this.posse === 'home' ? 'away' : 'home';
    const perto = this.corpos
      .filter((c) => c.f.lado === defende && c.f.slot !== 'gol' && !c.alvo)
      .map((c) => ({ c, d: Math.hypot(c.x - this.bola.x, c.z - this.bola.z) }))
      .filter((o) => o.d < 18)
      .sort((a, b) => a.d - b.d);
    const gatilho = this.forma[defende].pressao;
    perto.slice(0, 2).forEach(({ c }, i) => {
      if (i === 0 && (gatilho > 0.35 || CLASSES_QUE_PRESSIONAM.has(c.f.classe ?? ''))) this.pressionando.add(c);
      else if (i === 1 && gatilho > 0.6) this.pressionando.add(c);
    });
  }

  private alvoDaForma(c: Corpo): Ponto {
    if (c.alvo) return c.alvo;
    const dir = c.f.lado === 'home' ? 1 : -1;
    if (c.f.slot === 'gol') {
      const base = c.f.lado === 'home' ? 3 : C - 3;
      return { x: base + dir * Math.max(0, (this.bola.x - (c.f.lado === 'home' ? 0 : C)) * dir * 0.06), z: L / 2 + (this.bola.z - L / 2) * 0.25 };
    }
    // Quem pressiona fecha a linha entre o portador e o próprio gol.
    if (this.pressionando.has(c)) return { x: this.bola.x - dir * 1.6, z: this.bola.z + (c.z > this.bola.z ? 1 : -1) };
    return alvoNaForma({
      lado: c.f.lado,
      ancoraProf: profundidade(c.f.lado, c.ancora.x),
      ancoraZ: c.ancora.z,
      centroProf: this.centroProf[c.f.lado],
      forma: this.forma[c.f.lado],
      bola: this.bola,
      comBola: this.posse === c.f.lado,
      classe: c.f.classe,
      ordem: c.f.lado === 'home' ? this.ordens[c.f.id] : undefined,
      oscilacao: { x: Math.sin(this.t * 0.7 + c.ancora.z) * 0.6, z: Math.cos(this.t * 0.5 + c.ancora.x) * 0.5 },
    });
  }

  // ── jogo ambiente (sem lance) ────────────────────────────────────────────

  /**
   * CENA LIMPA antes de um lance novo (bug do fundador 10/10: o campo "travou
   * no loop de uma jogada"). Zerar a fila jogava fora as limpezas pendentes —
   * do lance anterior E do jogo ambiente (drible, lateral, tiro de meta,
   * impedimento) — e quem estava nelas ficava PRESO no alvo pra sempre, com a
   * velocidade do lance. Agora ninguém fica preso: alvos soltos, velocidade
   * de volta, bola parada desmontada, e só então a fila zera.
   */
  limparCena(): void {
    this.fila = [];
    this.voo = null;
    for (const c of this.corpos) { c.alvo = null; c.vmax = vmaxDe(c.f); }
    this.posicionados.clear();
    this.reinicioAte = -1;
  }

  private recomecar(): void {
    const sofreu = this.festa?.f.lado === 'home' ? 'away' : 'home';
    this.festa = null;
    this.limparCena();
    this.voo = null;
    this.envolvidos = null;
    this.passesAgendados = [];
    for (const c of this.corpos) c.alvo = null;
    this.posicionados.clear();
    this.bola = { x: C / 2, z: L / 2, h: 0 };
    this.posse = sofreu;
    this.dono = this.achar(sofreu, 'ata') ?? this.achar(sofreu, 'mc1');
    if (this.dono) { this.dono.x = C / 2 + (sofreu === 'home' ? -1 : 1); this.dono.z = L / 2; }
    this.proxToque = this.t + 1.2;
    this.sons.push('apito');
  }

  /** Faixa do campo onde o time com a bola joga agora (o momento do plano empurra). */
  private zonaDeJogo(lado: 'home' | 'away'): number {
    return xDaZona(this, lado);
  }

  private toqueAmbiente(): void {
    const lado = this.posse;
    const outro = lado === 'home' ? 'away' : 'home';
    const daVez = this.dono && this.dono.f.lado === lado ? this.dono : this.maisPerto(lado, this.bola.x, this.bola.z, false);
    if (!daVez) return;
    // Roubada ambiente (só plano antigo, sem fluxo): quem domina perde menos a bola.
    const dominio = lado === 'home' ? this.momento : 100 - this.momento;
    if (!this.posseDoPlano && this.rnd() < 0.2 - dominio * 0.0012) {
      const ladrao = this.maisPerto(outro, this.bola.x, this.bola.z, true);
      if (ladrao) {
        ladrao.alvo = { x: this.bola.x, z: this.bola.z };
        this.depois(0.6, () => { ladrao.alvo = null; this.dono = ladrao; this.posse = outro; this.sons.push('roubada'); });
        this.proxToque = this.t + 1.8;
        return;
      }
    }
    // Fase 12: o portador DECIDE pelo perfil (encarar, inverter, profundidade, tocar curto).
    if (!decidirToque(this, daVez)) this.proxToque = this.t + 1;
  }

  // ── bola, câmera, assinaturas ────────────────────────────────────────────

  passar(para: Corpo, dur: number, altura: number): void {
    this.ultimoPassador = this.dono;
    this.voo = { x0: this.bola.x, z0: this.bola.z, x1: para.x, z1: para.z, t: 0, dur, altura, para };
    this.dono = null;
  }

  private moverBola(): void {
    if (this.voo) {
      const v = this.voo;
      v.t += DT;
      if (v.para && !v.fixo) { v.x1 = v.para.x; v.z1 = v.para.z; }
      const e = Math.min(1, v.t / v.dur);
      this.bola = { x: v.x0 + (v.x1 - v.x0) * e, z: v.z0 + (v.z1 - v.z0) * e, h: Math.sin(Math.PI * e) * v.altura };
      if (v.altura > 0.6) { this.rastro.push({ ...this.bola }); if (this.rastro.length > 8) this.rastro.shift(); }
      if (e >= 1) { this.voo = null; this.dono = v.para; if (v.para) this.posse = v.para.f.lado; }
    } else if (this.dono) {
      const c = this.dono, s = Math.hypot(c.vx, c.vz);
      const dir = c.f.lado === 'home' ? 1 : -1;
      this.bola = { x: c.x + (s > 0.5 ? (c.vx / s) * 0.8 : dir * 0.8), z: c.z + (s > 0.5 ? (c.vz / s) * 0.8 : 0), h: 0 };
    }
    if (!this.voo || this.voo.altura <= 0.6) { if (this.rastro.length) this.rastro.shift(); }
  }

  private moverCamera(): void {
    const perigo = this.bola.x > C * 0.76 || this.bola.x < C * 0.24 || this.envolvidos !== null || this.festa !== null;
    const zoom = this.festa ? 1.45 : perigo ? 1.3 : 1;
    const tx = C / 2 + (this.bola.x - C / 2) * (zoom > 1 ? 0.7 : 0.3);
    const tz = L / 2 + (this.bola.z - L / 2) * (zoom > 1 ? 0.45 : 0.15);
    const k = Math.min(1, DT * 1.8);
    this.camera = { x: this.camera.x + (tx - this.camera.x) * k, z: this.camera.z + (tz - this.camera.z) * k, zoom: this.camera.zoom + (zoom - this.camera.zoom) * k };
  }

  /** Rastro do matador atacando a área; arcos de giz envelhecem. */
  private registrarAssinaturas(): void {
    this.arcos = this.arcos.filter((r) => this.t - r.em < 3.5);
    this.fitas = this.fitas.filter((f) => f.ate > this.t);
    const matador = this.envolvidos ? [...this.envolvidos].find((c) => c.f.classe === 'matador' && Math.hypot(c.vx, c.vz) > 2.5) : undefined;
    if (matador && Math.round(this.t * 10) % 2 === 0) { this.trilha.push({ x: matador.x, z: matador.z }); if (this.trilha.length > 24) this.trilha.shift(); }
    else if (!this.envolvidos && this.trilha.length) this.trilha.shift();
  }

  /**
   * VÁLVULAS (bug do fundador 10/10: "no 16' travou no loop de uma jogada").
   * Nada pode deixar o campo preso: número que não é número volta pro lugar,
   * passe que não chega termina, bola parada esquecida solta.
   */
  private sanear(): void {
    for (const c of this.corpos) {
      if (Number.isFinite(c.x) && Number.isFinite(c.z) && Number.isFinite(c.vx) && Number.isFinite(c.vz)) continue;
      c.x = c.px = num(c.ancora.x, C / 2); c.z = c.pz = num(c.ancora.z, L / 2);
      c.vx = c.vz = 0;
      c.alvo = null;
      if (!Number.isFinite(c.vmax)) c.vmax = 6;
    }
    const v = this.voo;
    if (v && (!Number.isFinite(v.x0 + v.z0 + v.x1 + v.z1 + v.dur + v.t) || v.t > v.dur + 2)) {
      this.voo = null;
      this.dono = v.para ?? this.maisPerto(this.posse, this.bola.x, this.bola.z, false);
    }
    if (!Number.isFinite(this.bola.x + this.bola.z + this.bola.h)) {
      this.bola = this.dono ? { x: this.dono.x, z: this.dono.z, h: 0 } : { x: C / 2, z: L / 2, h: 0 };
    }
    if (this.lento && !Number.isFinite(this.lento.fator)) this.lento = null;
    if (this.posicionados.size) {
      if (this.posicionadosDesde < 0) this.posicionadosDesde = this.t;
      // Pênalti esperando o batedor tem 10 s de prazo na Rápida; 25 s é esquecido.
      else if (this.t - this.posicionadosDesde > 25 && !this.festa) { soltarBolaParada(this); this.posicionadosDesde = -1; }
    } else this.posicionadosDesde = -1;
  }

  // ── utilidades (usadas também pela encenação) ────────────────────────────

  depois(seg: number, faz: () => void): void {
    this.fila.push({ em: this.t + seg, faz });
    this.fila.sort((a, b) => a.em - b.em);
  }

  achar(lado: 'home' | 'away', slot: string): Corpo | null {
    return this.corpos.find((c) => c.f.lado === lado && c.f.slot === slot) ?? null;
  }

  maisPerto(lado: 'home' | 'away', x: number, z: number, semGoleiro: boolean): Corpo | null {
    let melhor: Corpo | null = null, md = Infinity;
    for (const c of this.corpos) {
      if (c.f.lado !== lado || (semGoleiro && c.f.slot === 'gol')) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < md) { md = d; melhor = c; }
    }
    return melhor;
  }

  zDoCanal(ev: MatchPlanEvent, lado: 'home' | 'away'): number {
    const esp = (z: number) => (lado === 'home' ? z : L - z);
    switch (ev.channel) {
      case 'corredor_esquerdo': return esp(12);
      case 'corredor_direito': return esp(56);
      case 'bola_parada': return esp(this.rnd() < 0.5 ? 8 : 60);
      case 'criacao': return L / 2 + (this.rnd() - 0.5) * 16;
      default: return L / 2 + (this.rnd() - 0.5) * 10;
    }
  }
}
