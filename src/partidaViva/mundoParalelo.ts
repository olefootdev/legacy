/**
 * PARTIDA VIVA — o MUNDO PARALELO (Fase 3, docs/MOTOR-DE-POSSES.md §3).
 *
 * "E se eu não tivesse mandado?" A Prova de Causa (servidor) traz as jogadas e
 * os lances das 10 posses SEM o comando, com os mesmos dados. Aqui um
 * coreógrafo novo encena esse outro jogo a partir do minuto antes do momento
 * que só existiu sem o comando (o cruzamento que teria saído, o chute que não
 * houve) e grava os quadros; o palco toca esses quadros por cima do jogo, que
 * fica pausado. Nada é sorteado: as mesmas jogadas dão o mesmo paralelo.
 */
import type { JogadaDoPlano, MatchPlanEvent } from '@/match/quickPlanTypes';
import type { MomentoDaJanela, ProvaDeCausa } from '@/match/provaDeCausa';
import { Coreografo, DT, type QuadroDoFilme, type QuadroDoPalco } from './coreografo';
import { comprimirEventos } from './compressao';
import { msParaMostrar } from './cronograma';
import type { Ficha, QuadroAoVivo } from './tipos';

/** Teto do paralelo na tela (s): é um vislumbre, não outra partida. */
export const PARALELO_MAX_S = 14;

export interface Paralelo { frames: QuadroDoFilme[]; foco: MomentoDaJanela; duracao: number }

/** O momento que vale mostrar: o primeiro que só aconteceu SEM o comando. */
export function focoDoParalelo(p: ProvaDeCausa): MomentoDaJanela | null {
  return p.so_sem[0] ?? null;
}

/**
 * Encena o mundo sem o comando: do minuto antes do foco até a jogada do foco
 * acabar. `fichas` = quem está em campo AGORA (trocas incluídas), na ordem do palco.
 */
export function encenarParalelo(fichas: Ficha[], formacaoCasa: string, formacaoFora: string, seed: string, p: ProvaDeCausa): Paralelo | null {
  const foco = focoDoParalelo(p);
  if (!foco) return null;
  const jogadas = new Map(((p.jogadas_sem ?? []) as JogadaDoPlano[]).map((j) => [j.m, j] as const));
  const eventos = comprimirEventos((p.eventos_sem ?? []) as MatchPlanEvent[]);
  const co = new Coreografo(fichas, formacaoCasa, formacaoFora, `${seed}|paralelo|${foco.m}`);
  for (let i = 0; i < 12; i++) co.passo(); // os times se ajeitam na forma
  co.gravando = true;
  co.filme = [];
  const base = { fase: 'playing' as const, placarCasa: 0, placarFora: 0, momento: 50, gol: null, narracao: [] };
  const passos = (n: number) => { for (let i = 0; i < n; i++) co.passo(); };
  const ini = Math.max(p.janela[0], foco.m - 1);
  for (let m = ini; m <= foco.m; m++) {
    const lances = eventos.filter((e) => e.minute === m && e.cadeia && /^(goal|shot|chance|save|woodwork|corner|buildup|counter|penalty)_/.test(e.kind));
    if (lances.length) {
      for (const ev of lances) {
        co.receber({ ...base, minuto: m, lance: ev } as QuadroAoVivo);
        passos(Math.round(msParaMostrar(ev.cadeia) / 1000 / DT));
      }
    } else {
      co.receber({ ...base, minuto: m, lance: null, jogada: jogadas.get(m) ?? null } as QuadroAoVivo);
      passos(m === foco.m ? 30 : 18);
    }
  }
  const frames = co.filme;
  if (frames.length < 5) return null;
  const duracao = Math.min(PARALELO_MAX_S, frames[frames.length - 1]!.t - frames[0]!.t);
  return { frames, foco, duracao };
}

/** O quadro do paralelo no segundo `t` (desde o começo), com a câmera na bola. */
export function quadroDoParalelo(par: Paralelo, fichas: Ficha[], t: number): QuadroDoPalco {
  const ultimo = par.frames[par.frames.length - 1]!;
  // Mais longo que o teto: mostra o FIM (o momento que importa).
  const t0 = Math.max(par.frames[0]!.t, ultimo.t - PARALELO_MAX_S);
  const alvo = t0 + Math.max(0, t);
  let i = par.frames.findIndex((f) => f.t >= alvo);
  if (i < 0) i = par.frames.length - 1;
  const f = par.frames[i]!;
  return {
    jogadores: fichas.map((ficha, k) => ({ f: ficha, x: f.pos[k * 2] ?? 52.5, z: f.pos[k * 2 + 1] ?? 34, vx: 0, vz: 0, apagado: false })),
    bola: f.bola,
    rastro: [],
    dono: null,
    camera: { x: f.bola.x, z: f.bola.z, zoom: 1.25 },
    cinema: true,
    passe: null,
    arcos: [],
    trilhaDoMatador: [],
    fitas: [],
  };
}
