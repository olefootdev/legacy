/**
 * PARTIDA VIVA — encenação dos lances (Fases 1–3).
 *
 * Funções que o `Coreografo` chama quando a Partida Rápida mostra um lance ou
 * um gol. Elas só ENCENAM: o desfecho visual vem do lance mostrado (já com
 * estilo, lenda, formação e momento decisivo aplicados).
 *
 * - Com `cadeia` (servidor contou a jogada, Fase 2): toque a toque, com corte
 *   inicial, receptor atacando o espaço, drible deixando o marcador pra trás.
 * - Sem cadeia (plano antigo): aproximação por zona + canal (Fase 1).
 * - Direção (Fase 3): câmera lenta proporcional ao xG no chute, gol congela,
 *   faixas de cinema nos lances grandes, linha do passe, assinaturas por classe.
 */
import type { CadeiaDeLance, MatchPlanEvent } from '@/match/quickPlanTypes';
import { cronogramaDaCadeia, VEL_CONDUCAO } from './cronograma';
import { C, L, lim, type Corpo } from './fisica';
import type { Coreografo } from './coreografo';
import { L as T } from '@/i18n/L';

/** Teto da jogada de um gol (a comemoração da Partida Rápida some em 5 s). */
const GOL_MAX_S = 4.2;
export type Desfecho = 'gol' | 'defesa' | 'trave' | 'fora';

const desfechoDe = (ev: MatchPlanEvent): Desfecho => {
  const k = ev.kind.replace(/_(home|away)$/, '');
  return k === 'save' ? 'defesa' : k === 'woodwork' ? 'trave' : k === 'goal' ? 'gol' : 'fora';
};
const grande = (ev: MatchPlanEvent) => ev.weight_tier === 'big' || ev.weight_tier === 'epic';

export function encenarLance(co: Coreografo, ev: MatchPlanEvent): void {
  if (ev.cadeia?.acoes.length) {
    const total = encenarCadeia(co, ev.cadeia, ev.actor_side, desfechoDe(ev), ev.xg ?? 0.1);
    if (grande(ev) || ev.cadeia.finalizacao) co.cinemaAte = co.t + total + 1.2;
    return;
  }
  // ── Fase 1: aproximação por zona + canal ──────────────────────────────────
  const lado = ev.actor_side;
  co.posse = lado;
  co.fila = [];
  const dir = lado === 'home' ? 1 : -1;
  const ataque = ev.zone === 'att' ? 0.82 : ev.zone === 'mid' ? 0.55 : 0.28;
  const x = lado === 'home' ? ataque * C : (1 - ataque) * C;
  const z = co.zDoCanal(ev, lado);
  const autor = co.corpos.find((c) => c.f.id === ev.actor_id) ?? co.maisPerto(lado, x, z, true);
  if (!autor) return;
  const marcador = co.maisPerto(lado === 'home' ? 'away' : 'home', x, z, true);
  const goleiro = co.achar(lado === 'home' ? 'away' : 'home', 'gol');
  co.envolvidos = new Set([autor, marcador, goleiro].filter((c): c is Corpo => !!c));
  const chegada = { x: lim(x - dir * 7, 3, C - 3), z };
  autor.alvo = chegada;
  if (co.dono !== autor) co.passar(autor, 0.7, Math.abs((co.dono?.x ?? co.bola.x) - chegada.x) > 25 ? 3 : 0.4);
  co.depois(0.8, () => { autor.alvo = { x, z }; if (marcador) marcador.alvo = { x: x + dir * 2, z: z + 2 }; });
  const k = ev.kind.replace(/_(home|away)$/, '');
  if (['shot', 'save', 'chance', 'woodwork', 'goal', 'penalty'].includes(k)) {
    co.depois(1.5, () => chutar(co, autor, desfechoDe(ev), ev.xg ?? 0.1));
    if (grande(ev)) co.cinemaAte = co.t + 2.8;
  }
}

export function encenarGol(co: Coreografo, lado: 'home' | 'away', actorId?: string, cadeia?: CadeiaDeLance, xg = 0.4): void {
  co.cinemaAte = co.t + GOL_MAX_S + 2;
  if (cadeia?.acoes.length) {
    // O filme do gol: grava a jogada inteira pro replay (Fase 5).
    co.gravando = true;
    co.filme = [];
    co.golGravado = { cadeia, autorId: actorId };
    const fim = encenarCadeia(co, cadeia, lado, 'gol', xg, GOL_MAX_S);
    const autor = co.corpos.find((c) => c.f.id === actorId);
    if (autor) co.depois(fim + 0.7, () => comemorar(co, autor, lado));
    return;
  }
  co.fila = [];
  co.posse = lado;
  const autor = co.corpos.find((c) => c.f.id === actorId)
    ?? co.maisPerto(lado, lado === 'home' ? C * 0.85 : C * 0.15, L / 2, true);
  if (!autor) return;
  const gx = lado === 'home' ? C : 0;
  autor.x = autor.px = lim(gx - (lado === 'home' ? 13 : -13), 2, C - 2);
  autor.z = autor.pz = L / 2 + (co.rnd() - 0.5) * 10;
  co.dono = autor;
  chutar(co, autor, 'gol', xg);
  co.festa = autor;
  co.envolvidos = null;
  co.depois(0.7, () => comemorar(co, autor, lado));
}

/** Autor corre pra bandeirinha, o time vai junto; o rival apaga (via `festa`). */
function comemorar(co: Coreografo, autor: Corpo, lado: 'home' | 'away'): void {
  co.gravando = false;
  co.festa = autor;
  co.envolvidos = null;
  autor.alvo = { x: lado === 'home' ? C - 2 : 2, z: autor.z < L / 2 ? 2 : L - 2 };
  const colegas = co.corpos.filter((c) => c.f.lado === lado && c !== autor && c.f.slot !== 'gol');
  colegas.sort((a, b) => Math.hypot(a.x - autor.x, a.z - autor.z) - Math.hypot(b.x - autor.x, b.z - autor.z));
  colegas.slice(0, 6).forEach((c, i) => { c.alvo = { x: (autor.alvo!.x) - (lado === 'home' ? 2 + i * 0.6 : -(2 + i * 0.6)), z: autor.alvo!.z + (i % 2 ? 1.2 : -1.2) * (1 + i * 0.3) }; });
}

/** Jogada contada pelo servidor, toque a toque. Devolve a duração (s). */
function encenarCadeia(co: Coreografo, cad: CadeiaDeLance, lado: 'home' | 'away', desfecho: Desfecho, xg: number, maxDur = Infinity): number {
  co.fila = [];
  co.voo = null;
  co.posse = lado;
  co.passesAgendados = [];
  const por = (id: string | null) => (id ? co.corpos.find((c) => c.f.id === id) ?? null : null);
  const acoes = cad.acoes;
  const crono = cronogramaDaCadeia(cad);
  const escala = Math.min(1, maxDur / crono.total);
  const tempos = crono.tempos.map((t) => ({ ini: t.ini * escala, dur: t.dur * escala }));
  const total = crono.total * escala;
  const envolvidos = new Set<Corpo>();
  const goleiro = co.achar(lado === 'home' ? 'away' : 'home', 'gol');
  if (goleiro) envolvidos.add(goleiro);
  for (const ac of acoes) { const d = por(ac.de), p = por(ac.para); if (d) envolvidos.add(d); if (p) envolvidos.add(p); }
  co.envolvidos = envolvidos;

  // CORTE (como numa transmissão): cada envolvido aparece perto de onde vai
  // agir — o receptor ~4 m antes do ponto, pra ainda atacar o espaço.
  const dir = lado === 'home' ? 1 : -1;
  const posto = new Set<Corpo>();
  const colocar = (c: Corpo | null, x: number, z: number) => {
    if (!c || posto.has(c)) return;
    posto.add(c);
    c.x = c.px = lim(x, 1, C - 1); c.z = c.pz = lim(z, 1, L - 1); c.vx = 0; c.vz = 0;
  };
  const primeiro = por(acoes[0]!.de);
  colocar(primeiro, cad.inicio.x, cad.inicio.z);
  co.bola = { x: cad.inicio.x, z: cad.inicio.z, h: 0 };
  co.pbola = { ...co.bola };
  if (primeiro) co.dono = primeiro;
  acoes.forEach((ac, i) => {
    const de = por(ac.de), p = por(ac.para);
    if (p && ['passe', 'lancamento', 'cruzamento', 'escanteio'].includes(ac.t)) {
      colocar(p, ac.x - dir * 4, ac.z + (p.z > ac.z ? 2 : -2));
      p.alvo = { x: ac.x, z: ac.z }; // o "ataque ao espaço"
    } else if (p && (ac.t === 'drible' || ac.t === 'falta')) {
      colocar(p, ac.x - dir * 6, ac.z);
    } else if (p && ac.t === 'desarme') {
      colocar(p, ac.x - dir * 1.5, ac.z);
    }
    if (de && (ac.t === 'desarme' || ac.t === 'falta' || ac.t === 'desvio')) colocar(de, ac.x + dir * 3, ac.z + 1.5);
    // Linha do passe: o portador "vê" o passe antes de soltar.
    if (de && ['passe', 'lancamento', 'cruzamento'].includes(ac.t)) co.passesAgendados.push({ em: co.t + tempos[i]!.ini, de, x: ac.x, z: ac.z });
  });

  const vmaxOriginal = new Map<Corpo, number>();
  acoes.forEach((ac, i) => {
    const passo = tempos[i]!.dur;
    co.depois(tempos[i]!.ini, () => {
      const de = por(ac.de), para = por(ac.para);
      // Fase 10: a skill com nome aparece no trilho na hora da ação.
      if (ac.skill && de) co.registrarSkill(ac.skill, ac.skill_nota ?? 0, de);
      switch (ac.t) {
        case 'passe': case 'lancamento': case 'cruzamento': case 'escanteio': {
          const alto = ac.t === 'lancamento' || ac.t === 'cruzamento' || ac.t === 'escanteio';
          if (ac.t === 'escanteio' && de) { de.x = de.px = ac.x > C / 2 ? C - 0.5 : 0.5; co.bola = { x: de.x, z: co.bola.z, h: 0 }; }
          // Assinatura do regista/maestro: o lançamento deixa um arco de giz.
          if (de && ac.t === 'lancamento' && (de.f.classe === 'regista' || de.f.classe === 'maestro')) {
            co.arcos.push({ x0: co.bola.x, z0: co.bola.z, x1: ac.x, z1: ac.z, em: co.t });
          }
          co.voo = { x0: co.bola.x, z0: co.bola.z, x1: ac.x, z1: ac.z, t: 0, dur: passo * 0.9, altura: alto ? 2.6 : 0.3, para, fixo: true };
          co.dono = null;
          co.sons.push('passe');
          if (ac.t === 'escanteio') co.fita(T('ESCANTEIO', 'CORNER'), ac.x, ac.z, 1.2);
          break;
        }
        case 'desvio':
          co.voo = { x0: co.bola.x, z0: co.bola.z, x1: ac.x, z1: ac.z, t: 0, dur: passo * 0.8, altura: 1.2, para: null, fixo: true };
          co.dono = null;
          if (de) de.alvo = { x: co.bola.x, z: co.bola.z };
          break;
        case 'conducao':
        case 'drible':
          if (de) {
            co.dono = de;
            de.alvo = { x: ac.x, z: ac.z };
            if (!vmaxOriginal.has(de)) vmaxOriginal.set(de, de.vmax);
            de.vmax = Math.max(de.vmax, (VEL_CONDUCAO * 1.15) / escala);
          }
          if (ac.t !== 'drible') break;
          if (de) co.fita(T('DRIBLE', 'DRIBBLE'), 0, 0, 1.3, false, de);
          if (para) { para.alvo = { x: co.bola.x, z: co.bola.z }; co.depois(passo * 0.6, () => { para.alvo = { x: para.x + (lado === 'home' ? -2.5 : 2.5), z: para.z + 1.5 }; }); }
          break;
        case 'desarme':
          if (de && para) {
            de.alvo = { x: para.x, z: para.z }; co.dono = para;
            co.depois(passo * 0.7, () => { co.dono = de; de.alvo = { x: ac.x, z: ac.z }; co.sons.push('roubada'); co.fita(T('ROUBOU!', 'WON IT!'), 0, 0, 1.4, true, de); });
          }
          break;
        case 'falta':
          if (de) { de.alvo = { x: ac.x, z: ac.z }; co.depois(passo * 0.6, () => co.fita(T('FALTA', 'FOUL'), ac.x, ac.z, 1.3)); }
          break;
        case 'chute': case 'cabeceio': case 'cobranca':
          if (de) {
            if (ac.t === 'cobranca') { de.x = de.px = lado === 'home' ? C - 11 : 11; de.z = de.pz = L / 2; }
            chutar(co, de, desfecho, xg);
          }
          break;
      }
    });
  });
  co.depois(total + 1.4, () => {
    for (const c of envolvidos) c.alvo = null;
    for (const [c, v] of vmaxOriginal) c.vmax = v;
    if (!co.festa) co.envolvidos = null;
  });
  return total;
}

/**
 * O chute. Câmera lenta proporcional ao xG (chance clara ~0,35×, chute
 * difícil quase nada). No gol, o campo congela quando a bola entra.
 */
export function chutar(co: Coreografo, autor: Corpo, como: Desfecho, xg: number): void {
  const gx = autor.f.lado === 'home' ? C + 1.5 : -1.5;
  const goleiro = co.achar(autor.f.lado === 'home' ? 'away' : 'home', 'gol');
  const zAlvo = como === 'trave' ? L / 2 + 3.66 : como === 'fora' ? L / 2 + (co.rnd() < 0.5 ? -6 : 6) : L / 2 + (co.rnd() - 0.5) * 5;
  let x1 = como === 'defesa' && goleiro ? goleiro.x : gx;
  const z1 = lim(como === 'defesa' && goleiro ? goleiro.z : zAlvo, 0, L);
  if (como === 'trave') x1 = autor.f.lado === 'home' ? C : 0;
  if (goleiro && como !== 'fora') goleiro.alvo = { x: goleiro.x, z: lim(zAlvo, L / 2 - 4, L / 2 + 4) };
  co.bola = { x: autor.x, z: autor.z, h: 0 };
  co.voo = { x0: autor.x, z0: autor.z, x1, z1, t: 0, dur: 0.45, altura: 0.9, para: como === 'defesa' ? (goleiro ?? null) : null };
  co.dono = null;
  co.lento = { desde: co.t - 0.25, ate: co.t + 0.6, fator: lim(1 - xg * 1.45, 0.32, 1) };
  co.sons.push('chute');
  co.depois(0.45, () => {
    if (como === 'gol') { co.congelarPedido = true; co.sons.push('gol'); }
    else if (como === 'trave') { co.sons.push('trave'); co.fita(T('NA TRAVE', 'OFF THE POST'), x1, z1, 1.4, true); }
    else if (como === 'defesa' && goleiro) { co.sons.push('defesa'); co.fita(T('DEFESA', 'SAVE'), 0, 0, 1.4, true, goleiro); }
  });
  co.depois(1.2, () => {
    if (goleiro) goleiro.alvo = null;
    if (como === 'trave' || como === 'fora') {
      // tiro de meta / rebote: a bola volta pro goleiro adversário
      const g = co.achar(autor.f.lado === 'home' ? 'away' : 'home', 'gol');
      if (g && !co.festa) { co.bola = { x: g.x, z: g.z, h: 0 }; co.dono = g; co.posse = g.f.lado; }
    }
    autor.alvo = null;
  });
}

/**
 * ENTRADA EM CAMPO (Fase 5): os times saem do túnel, se alinham no meio, os
 * seus jogadores são apresentados um a um e, no apito, cada um vai pra sua
 * posição. ~5 s — a Partida Rápida segura a contagem enquanto isso.
 */
export function entrarEmCampo(co: Coreografo): void {
  const casa = co.corpos.filter((c) => c.f.lado === 'home');
  const fora = co.corpos.filter((c) => c.f.lado === 'away');
  // 1) Túnel: saem em fila do meio da lateral de cima.
  co.corpos.forEach((c, i) => {
    c.x = c.px = C / 2 + (c.f.lado === 'home' ? -1.4 : 1.4);
    c.z = c.pz = -2 - (i % 11) * 1.4;
  });
  // 2) Perfilados no meio, cada time de um lado da linha — os da casa apresentados um a um.
  const fila = (time: Corpo[], z: number) => time.forEach((c, i) => { c.alvo = { x: C / 2 - 18 + i * 3.6, z }; });
  fila(casa, L / 2 - 4);
  fila(fora, L / 2 + 4);
  co.dono = null;
  co.bola = { x: C / 2, z: L / 2, h: 0 };
  casa.forEach((c, i) => co.depois(1.4 + i * 0.26, () => co.fita(`${c.f.nome}`, 0, 0, 0.3, false, c)));
  // 3) Cada um pra sua posição de saída (o seu campo, na formação); o atacante da casa na bola.
  //    O apito sai quando TODOS chegam (Coreografo.passo → apitar), no máximo em 6 s.
  co.depois(4.4, () => {
    for (const c of co.corpos) {
      const s = co.saida.get(c);
      if (s) c.alvo = { ...s };
    }
    const atacante = co.achar('home', 'ata') ?? co.achar('home', 'mc1');
    if (atacante) {
      const centro = { x: C / 2 - 0.8, z: L / 2 };
      co.saida.set(atacante, centro);
      atacante.alvo = { ...centro };
    }
    co.preApito = { limite: co.t + 6 };
  });
}
