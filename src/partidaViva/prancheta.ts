/**
 * PARTIDA VIVA — a prancheta (Fase 4c, docs/PARTIDA-VIVA-PLANO.md §5).
 *
 * O manager pausa e o campo vira prancheta: escurece e mostra a LEITURA do
 * momento congelado — tudo calculado das posições que já estão na tela
 * (nada novo é decidido aqui):
 *   - as linhas de cada bloco (defesa e ataque) e o comprimento do bloco;
 *   - os passes do portador: livre (ninguém no caminho) ou fechado;
 *   - o espaço deles: a faixa entre a defesa e o meio adversário
 *     (entrelinhas) e o maior buraco da linha de defesa.
 *
 * Também mora aqui o "auxiliar desenhado": o corredor do Analista em metros.
 */
import { C, L } from './fisica';
import type { Ficha } from './tipos';

export interface JogadorNaPrancheta { f: Ficha; x: number; z: number }

export interface LinhaDoBloco { lado: 'home' | 'away'; tipo: 'defesa' | 'ataque'; x: number; z0: number; z1: number }
export interface PasseNaPrancheta { x0: number; z0: number; x1: number; z1: number; livre: boolean; para: string }
export interface Espaco { x0: number; x1: number; z0: number; z1: number }

export interface LeituraDaPrancheta {
  linhas: LinhaDoBloco[];
  /** Comprimento do bloco (defesa → ataque), em metros. */
  bloco: Record<'home' | 'away', number>;
  passes: PasseNaPrancheta[];
  /** Entrelinhas do adversário (entre a defesa e o meio deles). */
  entrelinhas: Espaco | null;
  /** Maior buraco entre dois defensores deles (corredor pra infiltrar). */
  buraco: Espaco | null;
}

const media = (v: number[]) => v.reduce((s, x) => s + x, 0) / Math.max(1, v.length);

/** Distância do ponto ao segmento (metros). */
function distSeg(px: number, pz: number, x0: number, z0: number, x1: number, z1: number): number {
  const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / L2));
  return Math.hypot(px - (x0 + dx * t), pz - (z0 + dz * t));
}

/**
 * Lê o quadro congelado. `lado` = o time do manager (o espaço é sempre o do
 * adversário dele); `donoId` = quem está com a bola.
 */
export function lerPrancheta(jogadores: JogadorNaPrancheta[], donoId: string | null, lado: 'home' | 'away' = 'home'): LeituraDaPrancheta {
  const linhas: LinhaDoBloco[] = [];
  const bloco = { home: 0, away: 0 };
  const defesaDe: Record<string, JogadorNaPrancheta[]> = {};
  const meioDe: Record<string, JogadorNaPrancheta[]> = {};
  for (const t of ['home', 'away'] as const) {
    // "prof" = quanto o jogador avançou rumo ao gol adversário (casa ataca +x).
    const prof = (j: JogadorNaPrancheta) => (t === 'home' ? j.x : C - j.x);
    const linha = jogadores.filter((j) => j.f.lado === t && j.f.slot !== 'gol').sort((a, b) => prof(a) - prof(b));
    if (linha.length < 6) continue;
    const def = linha.slice(0, 4), atk = linha.slice(-3), meio = linha.slice(4, -3);
    defesaDe[t] = def; meioDe[t] = meio;
    const xDef = media(def.map((j) => j.x)), xAtk = media(atk.map((j) => j.x));
    linhas.push({ lado: t, tipo: 'defesa', x: xDef, z0: Math.min(...def.map((j) => j.z)) - 2, z1: Math.max(...def.map((j) => j.z)) + 2 });
    linhas.push({ lado: t, tipo: 'ataque', x: xAtk, z0: Math.min(...atk.map((j) => j.z)) - 2, z1: Math.max(...atk.map((j) => j.z)) + 2 });
    bloco[t] = Math.round(Math.abs(xAtk - xDef));
  }

  // Passes do portador: fechado se algum adversário está a menos de 2,2 m da linha.
  const passes: PasseNaPrancheta[] = [];
  const dono = donoId ? jogadores.find((j) => j.f.id === donoId) : undefined;
  if (dono) {
    const rivais = jogadores.filter((j) => j.f.lado !== dono.f.lado);
    for (const c of jogadores) {
      if (c.f.lado !== dono.f.lado || c === dono || c.f.slot === 'gol') continue;
      const d = Math.hypot(c.x - dono.x, c.z - dono.z);
      if (d < 4 || d > 40) continue;
      const livre = !rivais.some((r) => distSeg(r.x, r.z, dono.x, dono.z, c.x, c.z) < 2.2);
      passes.push({ x0: dono.x, z0: dono.z, x1: c.x, z1: c.z, livre, para: c.f.id });
    }
  }

  // O espaço do ADVERSÁRIO do manager.
  const rival = lado === 'home' ? 'away' : 'home';
  let entrelinhas: Espaco | null = null, buraco: Espaco | null = null;
  const def = defesaDe[rival], meio = meioDe[rival];
  if (def && meio?.length) {
    const xDef = media(def.map((j) => j.x)), xMeio = media(meio.map((j) => j.x));
    if (Math.abs(xMeio - xDef) >= 6) {
      entrelinhas = { x0: Math.min(xDef, xMeio), x1: Math.max(xDef, xMeio), z0: Math.max(4, Math.min(...def.map((j) => j.z))), z1: Math.min(L - 4, Math.max(...def.map((j) => j.z))) };
    }
    const zs = def.map((j) => j.z).sort((a, b) => a - b);
    let melhor = 0;
    for (let i = 0; i < zs.length - 1; i++) {
      const vao = zs[i + 1]! - zs[i]!;
      if (vao > melhor) { melhor = vao; buraco = { x0: xDef - 4, x1: xDef + 4, z0: zs[i]! + 1.5, z1: zs[i + 1]! - 1.5 }; }
    }
    if (melhor < 10) buraco = null; // vão normal não é buraco
  }
  return { linhas, bloco, passes, entrelinhas, buraco };
}

/**
 * Corredor do Analista em metros (casa ataca +x). `nosso` = canal da nossa
 * chance, desenhado no campo de ataque; `perigo` = canal do ataque deles
 * (na perspectiva DELES, que atacam −x), no nosso campo de defesa.
 */
export function corredorEmMetros(canal: string, quem: 'nosso' | 'perigo'): Espaco | null {
  const ataque = quem === 'nosso';
  const x = ataque ? { x0: C * 0.58, x1: C - 1 } : { x0: 1, x1: C * 0.42 };
  // Esquerda de quem ataca: casa (rumo +x) tem a esquerda em z baixo; eles (rumo −x), em z alto.
  const esq = ataque ? { z0: 1, z1: L * 0.3 } : { z0: L * 0.7, z1: L - 1 };
  const dir = ataque ? { z0: L * 0.7, z1: L - 1 } : { z0: 1, z1: L * 0.3 };
  switch (canal) {
    case 'corredor_esquerdo': return { ...x, ...esq };
    case 'corredor_direito': return { ...x, ...dir };
    case 'ataque_central':
    case 'finalizacao_vs_gk': return { ...x, z0: L * 0.3, z1: L * 0.7 };
    case 'criacao': return ataque ? { x0: C * 0.45, x1: C * 0.72, z0: L * 0.25, z1: L * 0.75 } : { x0: C * 0.28, x1: C * 0.55, z0: L * 0.25, z1: L * 0.75 };
    case 'bola_parada': return ataque ? { x0: C - 16.5, x1: C - 1, z0: 13.85, z1: 54.15 } : { x0: 1, x1: 16.5, z0: 13.85, z1: 54.15 };
    case 'pressao': return ataque ? { x0: C * 0.5, x1: C * 0.8, z0: 2, z1: L - 2 } : { x0: C * 0.2, x1: C * 0.5, z0: 2, z1: L - 2 };
    default: return null;
  }
}
