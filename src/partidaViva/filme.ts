/**
 * PARTIDA VIVA — o filme do gol (Fase 5).
 *
 * Depois da comemoração: REPLAY dos últimos instantes da jogada, em câmera
 * lenta e colado no autor; em seguida, A JOGADA A GIZ — o campo escurece e o
 * caminho da bola aparece toque a toque, numerado, com o nome de quem tocou.
 *
 * A gravação é a própria encenação (que segue a cadeia determinística do
 * servidor); este módulo só remonta quadros pro palco.
 */
import type { CadeiaDeLance } from '@/match/quickPlanTypes';
import type { QuadroDoFilme, QuadroDoPalco } from './coreografo';
import type { Ficha } from './tipos';

/** Quanto da jogada o replay mostra (s de jogo) e em que velocidade. */
export const REPLAY_TRECHO_S = 2.2;
export const REPLAY_MS = 4000;
export const GIZ_MS = 2600;
export const ESPERA_ANTES_MS = 1600;

/** Quadro do replay em `p` (0–1), com a câmera colada no autor. */
export function quadroDoReplay(frames: QuadroDoFilme[], fichas: Ficha[], autorId: string | undefined, p: number): QuadroDoPalco | null {
  if (!frames.length) return null;
  const fim = frames[frames.length - 1]!.t;
  const t = fim - REPLAY_TRECHO_S + Math.min(1, Math.max(0, p)) * REPLAY_TRECHO_S;
  let i = frames.findIndex((f) => f.t >= t);
  if (i < 0) i = frames.length - 1;
  const f = frames[i]!;
  const iAutor = fichas.findIndex((x) => x.id === autorId);
  const ax = iAutor >= 0 ? f.pos[iAutor * 2]! : f.bola.x;
  const az = iAutor >= 0 ? f.pos[iAutor * 2 + 1]! : f.bola.z;
  return {
    jogadores: fichas.map((ficha, k) => ({ f: ficha, x: f.pos[k * 2]!, z: f.pos[k * 2 + 1]!, vx: 0, vz: 0, apagado: false })),
    bola: f.bola,
    rastro: [],
    dono: null,
    camera: { x: ax - 3, z: az, zoom: 1.6 },
    cinema: true,
    passe: null,
    arcos: [],
    trilhaDoMatador: [],
    fitas: [],
  };
}

export interface PontoDoGiz { x: number; z: number; numero: number | null; nome: string | null; gol: boolean }

/** Caminho da bola pra desenhar a giz: início, cada ação (numerada) e o GOL. */
export function pontosDoGiz(cad: CadeiaDeLance, fichas: Ficha[]): PontoDoGiz[] {
  const nome = (id: string | null) => (id ? fichas.find((f) => f.id === id)?.nome ?? null : null);
  const pts: PontoDoGiz[] = [{ x: cad.inicio.x, z: cad.inicio.z, numero: 1, nome: nome(cad.acoes[0]?.de ?? null), gol: false }];
  let n = 1, ultimo = pts[0]!.nome;
  for (const ac of cad.acoes) {
    // Ações do rival (falta/desvio) e chutes não ganham número próprio.
    const fim = ac.t === 'chute' || ac.t === 'cabeceio' || ac.t === 'cobranca';
    const quem = ac.t === 'falta' || ac.t === 'desvio' ? null : nome(ac.para ?? ac.de);
    if (fim) { pts.push({ x: ac.x, z: ac.z, numero: null, nome: null, gol: true }); continue; }
    n += 1;
    pts.push({ x: ac.x, z: ac.z, numero: n, nome: quem && quem !== ultimo ? quem : null, gol: false });
    if (quem) ultimo = quem;
  }
  return pts;
}
