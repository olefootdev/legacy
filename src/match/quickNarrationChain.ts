/**
 * Motor de CADEIA de narração (quick-match-revolution.md §3.2).
 *
 * Reconstrói a jogada de trás pra frente: o FIM real vem do scout (artilheiro /
 * assistente), o MEIO é preenchido por quem está em campo, escalado por posição.
 * Saída = sequência de legendas cinéticas curtas (3–5 palavras), cadência
 * crescente, terminando num CLÍMAX visual (GOOOL / NA TRAVE! / DEFENDEÇÃO! / PRA
 * FORA!). Local-first: templates + jogadores em campo, sem API no caminho crítico.
 */

import type { PitchPlayerState } from '@/engine/types';

export type ChainClimax = 'goal' | 'post' | 'save' | 'wide';

export interface ChainBeat {
  text: string;
  /** 'build' = legenda de construção; 'climax' = palavra que explode. */
  kind: 'build' | 'climax';
}

export interface NarrationChain {
  beats: ChainBeat[];
  climaxWord: string;
  climax: ChainClimax;
}

type Pick = (n: number) => number;
const defaultPick: Pick = (n) => Math.floor(Math.random() * n);

function choose<T>(pool: T[], pick: Pick): T {
  return pool[Math.min(pool.length - 1, Math.max(0, pick(pool.length)))]!;
}

function firstName(name: string | undefined): string {
  if (!name) return 'O time';
  const t = name.trim().split(/\s+/);
  return t.length > 1 ? t[0]! : name;
}

function byRole(players: PitchPlayerState[], role: NonNullable<PitchPlayerState['role']>): PitchPlayerState[] {
  return players.filter((p) => p.role === role);
}

/** Pega um nome de jogador do papel pedido (fallback: qualquer não-GK). */
function pickName(players: PitchPlayerState[], role: NonNullable<PitchPlayerState['role']>, pick: Pick): string | undefined {
  const pool = byRole(players, role);
  const list = pool.length ? pool : players.filter((p) => p.role !== 'gk');
  if (!list.length) return undefined;
  return firstName(choose(list, pick).name);
}

const CLIMAX_WORD: Record<ChainClimax, string> = {
  goal: 'GOOOL',
  post: 'NA TRAVE!',
  save: 'DEFENDEÇÃO!',
  wide: 'PRA FORA!',
};

const BUILD_START = [
  'Roubada no meio.',
  'Bola recuperada.',
  'Sai jogando de trás.',
  'Tabela rápida.',
];

function midBeat(name: string | undefined, pick: Pick): string {
  const n = name ?? 'O camisa 10';
  return choose([`${n} conduz.`, `${n} arma a jogada.`, `${n} acha o espaço.`, `${n} parte pra cima.`], pick);
}

function wingBeat(name: string | undefined, pick: Pick): string {
  const n = name ?? 'A ponta';
  return choose([`${n} cruza rasteiro.`, `${n} rola pra trás.`, `${n} dá o passe.`, `${n} levanta na área.`], pick);
}

/** Cadeia de GOL: build-up por posição → linha do artilheiro → GOOOL. */
export function buildGoalChain(
  opts: { scorerName?: string; assistName?: string; players?: PitchPlayerState[]; pick?: Pick },
): NarrationChain {
  const pick = opts.pick ?? defaultPick;
  const players = opts.players ?? [];
  const scorer = firstName(opts.scorerName);
  const assist = opts.assistName ? firstName(opts.assistName) : pickName(players, 'mid', pick);

  const beats: ChainBeat[] = [
    { text: choose(BUILD_START, pick), kind: 'build' },
    { text: midBeat(assist ?? pickName(players, 'mid', pick), pick), kind: 'build' },
    { text: wingBeat(pickName(players, 'attack', pick), pick), kind: 'build' },
    { text: `${scorer} finaliza…`, kind: 'build' },
    { text: CLIMAX_WORD.goal, kind: 'climax' },
  ];
  return { beats, climaxWord: CLIMAX_WORD.goal, climax: 'goal' };
}

const NEAR_BUILD: Record<Exclude<ChainClimax, 'goal'>, string[]> = {
  post: ['Que chance!', 'Subiu a área toda.', 'Bola viajando…'],
  save: ['Cara a cara!', 'Chute pra marcar…', 'Ia ser o gol…'],
  wide: ['Chegou com tudo.', 'Espaço pra finalizar…', 'Última jogada…'],
};

/** Cadeia de QUASE-GOL (§3.3): mesma build de suspense, desfecho diferente. */
export function buildNearMissChain(
  opts: { kind: Exclude<ChainClimax, 'goal'>; finisherName?: string; players?: PitchPlayerState[]; pick?: Pick },
): NarrationChain {
  const pick = opts.pick ?? defaultPick;
  const finisher = opts.finisherName
    ? firstName(opts.finisherName)
    : pickName(opts.players ?? [], 'attack', pick);
  const beats: ChainBeat[] = [
    { text: choose(NEAR_BUILD[opts.kind], pick), kind: 'build' },
    { text: `${finisher ?? 'O atacante'} arrisca…`, kind: 'build' },
    { text: CLIMAX_WORD[opts.kind], kind: 'climax' },
  ];
  return { beats, climaxWord: CLIMAX_WORD[opts.kind], climax: opts.kind };
}

export { CLIMAX_WORD };
