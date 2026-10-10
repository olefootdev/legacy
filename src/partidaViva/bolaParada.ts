/**
 * PARTIDA VIVA — bola parada (feedback do fundador, 10/10).
 *
 * "Quando sai um escanteio a bola vai até o canto e, sem ninguém ir lá, é
 * cruzada na área." Agora, antes de cada bola parada o jogo PARA e os dois
 * times se posicionam, como na TV:
 *   - ESCANTEIO: o cobrador corre até a bandeirinha; atacantes no 1º pau, no
 *     2º pau, na marca do pênalti e na entrada da área, cada um com o seu
 *     marcador colado (do lado do gol); goleiro na linha; um zagueiro no 1º pau;
 *     dois de cada lado lá atrás, de olho no contra-ataque.
 *   - FALTA: barreira a 9,15 m da bola, na linha do gol; goleiro cobrindo o
 *     outro canto; o cobrador toma distância; gente na área pro cruzamento.
 *   - PÊNALTI: todo mundo fora da área (na meia-lua e na linha da grande área);
 *     goleiro na linha; o batedor na marca, tomando distância.
 *
 * Só ALVOS (pra onde cada um corre) — o movimento continua sendo o do
 * coreógrafo, determinístico (o filme da partida continua idêntico).
 */
import type { AcaoDeLance } from '@/match/quickPlanTypes';
import { C, L, lim, type Corpo } from './fisica';
import type { Coreografo } from './coreografo';

export type TipoDeBolaParada = 'escanteio' | 'falta' | 'penalti';

const BARREIRA_M = 9.15;
const ORDEM_DE_AREA = ['zag1', 'zag2', 'ata', 'mc1', 'pe', 'pd', 'mc2', 'vol', 'le', 'ld'];

/** Coloca o ALVO e registra o jogador como posicionado (o fim da jogada solta). */
function ir(co: Coreografo, c: Corpo | null | undefined, x: number, z: number): void {
  if (!c) return;
  c.alvo = { x: lim(x, 0.6, C - 0.6), z: lim(z, 0.6, L - 0.6) };
  // Corte de TV: quem está longe aparece a 12 m do seu lugar e corre o resto à vista.
  aproximar(c, c.alvo, 12);
  co.posicionados.add(c);
}

/**
 * CORTE (como na TV): quem vai cobrar e está longe demais pra chegar na
 * preparação aparece a `perto` metros da bola — e corre o resto, à vista.
 */
function aproximar(c: Corpo | null, ponto: { x: number; z: number }, perto: number): void {
  if (!c) return;
  const d = Math.hypot(c.x - ponto.x, c.z - ponto.z);
  if (d <= perto + 2) return;
  const k = perto / d;
  c.x = c.px = ponto.x + (c.x - ponto.x) * k;
  c.z = c.pz = ponto.z + (c.z - ponto.z) * k;
  c.vx = c.vz = 0;
}

/** Atacantes que vão pra área, na ordem de quem sobe pro cabeceio. */
function praArea(time: Corpo[], fora: Set<Corpo>, n: number): Corpo[] {
  const livres = time.filter((c) => !fora.has(c) && c.f.slot !== 'gol');
  livres.sort((a, b) => {
    const ia = ORDEM_DE_AREA.indexOf(a.f.slot), ib = ORDEM_DE_AREA.indexOf(b.f.slot);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return livres.slice(0, n);
}

/** Marcação: cada atacante pega o defensor mais perto (sem repetir). */
function marcar(co: Coreografo, atacantes: { c: Corpo; x: number; z: number }[], defensores: Corpo[], dirGol: number): Set<Corpo> {
  const usados = new Set<Corpo>();
  for (const a of atacantes) {
    const d = defensores.filter((k) => !usados.has(k)).sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z))[0];
    if (!d) break;
    usados.add(d);
    ir(co, d, a.x + dirGol * 1.1, a.z + 0.6); // colado, do lado do gol
  }
  return usados;
}

/**
 * Monta a bola parada que a ação `i` vai cobrar. `lado` = quem cobra (ataca).
 * Devolve onde a bola fica parada.
 */
export function montarBolaParada(
  co: Coreografo, tipo: TipoDeBolaParada, acoes: readonly AcaoDeLance[], i: number, lado: 'home' | 'away',
  por: (id: string | null) => Corpo | null,
): { x: number; z: number } {
  const ac = acoes[i]!;
  const casa = lado === 'home';
  const dirGol = casa ? 1 : -1;
  const gx = casa ? C : 0;                 // linha do gol que se ataca
  const mx = (dist: number) => gx - dirGol * dist; // x a `dist` metros da linha do gol
  const atacam = co.corpos.filter((c) => c.f.lado === lado);
  const defendem = co.corpos.filter((c) => c.f.lado !== lado);
  const goleiro = co.achar(casa ? 'away' : 'home', 'gol');
  const cobrador = por(ac.de);
  co.voo = null;
  co.dono = null;

  if (tipo === 'penalti') {
    const marca = { x: mx(11), z: L / 2 };
    co.bola = { x: marca.x, z: marca.z, h: 0 };
    aproximar(cobrador, marca, 9);
    ir(co, cobrador, marca.x - dirGol * 2.2, marca.z - 0.8);
    ir(co, goleiro, mx(0.4), L / 2);
    // Todo o resto fora da área: na linha da grande área e na meia-lua, intercalados.
    const resto = co.corpos.filter((c) => c !== cobrador && c !== goleiro && c.f.slot !== 'gol');
    // Metade na linha da grande área (espalhada), metade em volta da meia-lua — sem fila única.
    resto.forEach((c, k) => {
      if (k % 2 === 0) {
        const j = k / 2;
        ir(co, c, mx(18.2) - dirGol * ((j % 2) * 1.2), 15 + j * (38 / 9));
      } else {
        const j = (k - 1) / 2, ang = -1.1 + j * (2.2 / 9);
        ir(co, c, mx(11 + 12.5 * Math.cos(ang)) - dirGol * ((j % 3) * 1.5), L / 2 + 12.5 * Math.sin(ang) * 1.6);
      }
    });
    // O goleiro de quem cobra fica no gol dele.
    const meuGoleiro = co.achar(lado, 'gol');
    if (meuGoleiro) ir(co, meuGoleiro, casa ? 4 : C - 4, L / 2);
    return marca;
  }

  if (tipo === 'escanteio') {
    // A bandeirinha do lado por onde a bola saiu (o desvio anterior), senão pelo alvo do cruzamento.
    const saiu = acoes[i - 1]?.t === 'desvio' ? acoes[i - 1]! : ac;
    const zCanto = saiu.z < L / 2 ? 0.6 : L - 0.6;
    const canto = { x: gx - dirGol * 0.6, z: zCanto };
    co.bola = { x: canto.x, z: canto.z, h: 0 };
    aproximar(cobrador, canto, 12);
    ir(co, cobrador, canto.x - dirGol * 0.4, canto.z + (zCanto < L / 2 ? 0.8 : -0.8));
    const perto = zCanto < L / 2 ? -1 : 1; // sinal do 1º pau
    const pontos = [
      { x: mx(5), z: L / 2 + perto * 4 },    // 1º pau
      { x: mx(6.5), z: L / 2 - perto * 5 },  // 2º pau
      { x: mx(8), z: L / 2 },                // no meio da pequena área
      { x: mx(11), z: L / 2 - perto * 2 },   // marca do pênalti
      { x: mx(17), z: L / 2 + perto * 3 },   // entrada da área (rebote)
    ];
    const autor = por(acoes[i]?.para ?? null);
    const fora = new Set<Corpo>([cobrador, co.achar(lado, 'gol')].filter((c): c is Corpo => !!c));
    const naArea = praArea(atacam, fora, pontos.length);
    // Quem vai cabecear fica no ponto mais perto de onde a bola vai cair.
    if (autor && !naArea.includes(autor) && autor !== cobrador) naArea[naArea.length - 1] = autor;
    const alvoDoCruzamento = { x: ac.x, z: ac.z };
    const ordenados = [...pontos].sort((a, b) => Math.hypot(a.x - alvoDoCruzamento.x, a.z - alvoDoCruzamento.z) - Math.hypot(b.x - alvoDoCruzamento.x, b.z - alvoDoCruzamento.z));
    const fila = autor && naArea.includes(autor) ? [autor, ...naArea.filter((c) => c !== autor)] : naArea;
    const posicoes = fila.map((c, k) => ({ c, ...ordenados[k]! }));
    for (const p of posicoes) ir(co, p.c, p.x, p.z);
    const defensores = defendem.filter((c) => c !== goleiro);
    const marcadores = marcar(co, posicoes.slice(0, 4), defensores, dirGol);
    ir(co, goleiro, mx(0.6), L / 2 + perto * 1.5);
    const sobra = defensores.filter((c) => !marcadores.has(c));
    ir(co, sobra[0], mx(1.2), L / 2 + perto * 4.6);   // zagueiro no 1º pau
    ir(co, sobra[1], mx(18), L / 2 - perto * 4);      // rebote
    // Lá atrás: os outros de cada time perto do meio-campo (contra-ataque).
    sobra.slice(2).forEach((c, k) => ir(co, c, C / 2 + dirGol * (6 + k * 3), L / 2 + (k % 2 ? 12 : -12)));
    atacam.filter((c) => !fora.has(c) && !fila.includes(c) && c.f.slot !== 'gol')
      .forEach((c, k) => ir(co, c, C / 2 - dirGol * (2 + k * 4), L / 2 + (k % 2 ? 10 : -10)));
    return canto;
  }

  // FALTA: a bola onde houve a falta (a ação anterior), barreira na linha do gol.
  const lugar = acoes[i - 1]?.t === 'falta' ? acoes[i - 1]! : ac;
  const bola = { x: lugar.x, z: lugar.z };
  co.bola = { x: bola.x, z: bola.z, h: 0 };
  const gol = { x: gx, z: L / 2 };
  const dist = Math.hypot(gol.x - bola.x, gol.z - bola.z) || 1;
  const u = { x: (gol.x - bola.x) / dist, z: (gol.z - bola.z) / dist };
  const p = { x: -u.z, z: u.x };
  aproximar(cobrador, bola, 10);
  ir(co, cobrador, bola.x - u.x * 2.4, bola.z - u.z * 2.4);
  const defensores = defendem.filter((c) => c !== goleiro);
  const nBarreira = dist < 24 ? 4 : 3;
  const centroBarreira = { x: bola.x + u.x * BARREIRA_M, z: bola.z + u.z * BARREIRA_M };
  const barreira = [...defensores].sort((a, b) => Math.hypot(a.x - centroBarreira.x, a.z - centroBarreira.z) - Math.hypot(b.x - centroBarreira.x, b.z - centroBarreira.z)).slice(0, nBarreira);
  barreira.forEach((c, k) => {
    const off = (k - (nBarreira - 1) / 2) * 0.75;
    ir(co, c, centroBarreira.x + p.x * off, centroBarreira.z + p.z * off);
  });
  // Goleiro cobre o canto que a barreira não tapa.
  ir(co, goleiro, gx - dirGol * 0.6, L / 2 + lim((L / 2 - bola.z) * 0.12, -2.2, 2.2));
  // Gente na área pro cruzamento (ou pro rebote), cada um marcado.
  const fora = new Set<Corpo>([cobrador, co.achar(lado, 'gol')].filter((c): c is Corpo => !!c));
  const area = praArea(atacam, fora, 3).map((c, k) => ({ c, x: mx(k === 2 ? 12 : 8), z: L / 2 + (k === 0 ? -5 : k === 1 ? 5 : 0) }));
  for (const a of area) ir(co, a.c, a.x, a.z);
  marcar(co, area, defensores.filter((c) => !barreira.includes(c)), dirGol);
  return bola;
}

/** Fim da bola parada: todo mundo volta a jogar (alvos soltos). */
export function soltarBolaParada(co: Coreografo): void {
  for (const c of co.posicionados) c.alvo = null;
  co.posicionados.clear();
}
