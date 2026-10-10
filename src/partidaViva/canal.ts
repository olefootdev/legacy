/**
 * PARTIDA VIVA — canal entre a Partida Rápida e o palco.
 *
 * O `QuickPlanPlayer` publica o quadro aqui; só o palco re-renderiza. Assim a
 * página da partida (e o próprio player) não re-renderiza a cada lance por
 * causa do campo. O caminho de volta (`responder`) leva as decisões tomadas
 * no campo pra MESMA função que o botão da Rápida chamaria.
 */
import type { QuadroAoVivo } from './tipos';

export interface CanalAoVivo {
  publicar: (q: QuadroAoVivo) => void;
  assinar: (fn: () => void) => () => void;
  ultimo: () => QuadroAoVivo | null;
  /** O palco responde uma decisão / dá um comando (ex.: 'estilo:press'). */
  responder: (id: string) => void;
  /** A Partida Rápida registra quem executa as respostas. */
  registrarResponder: (fn: ((id: string) => void) | null) => void;
}

export function criarCanalAoVivo(): CanalAoVivo {
  let atual: QuadroAoVivo | null = null;
  const ouvintes = new Set<() => void>();
  let executor: ((id: string) => void) | null = null;
  return {
    responder(id) { executor?.(id); },
    registrarResponder(fn) { executor = fn; },
    publicar(q) { atual = q; ouvintes.forEach((f) => f()); },
    assinar(fn) { ouvintes.add(fn); return () => { ouvintes.delete(fn); }; },
    ultimo: () => atual,
  };
}
