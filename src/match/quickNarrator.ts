/**
 * Narrador reativo (quick-match-revolution.md §6 — "mexe com o jogador").
 *
 * Camada emocional LOCAL-FIRST: reage à decisão do manager e aos lances-chave
 * com personalidade — cutuca no erro, exalta no acerto, lembra o padrão ("de
 * novo o carrinho, manager?"). NÃO é o feed cru (esse descreve o lance); é o
 * julgamento com peso. Reusa o espírito de narrativeTemplates.ts, mas aqui o
 * gancho é a AGÊNCIA (sua escolha) e o CONTRASTE (crítica + elogio).
 *
 * Determinístico via `pick` injetável (default Math.random) → testável.
 */

import type { QuickMomentType } from '@/match/quickInteractiveMoments';

export type NarratorTone =
  | 'exalta' // acerto / gol nosso — explode
  | 'cutuca' // erro / decisão furada — zoeira
  | 'frieza' // consequência dura (vermelho nosso, gol sofrido decisivo)
  | 'tensao' // perigo chegando
  | 'alivio' // escapou / quase-gol contra
  | 'neutro';

export interface NarratorLine {
  text: string;
  tone: NarratorTone;
  /** Palavra-clímax opcional, renderizada em destaque (legenda cinética). */
  punch?: string;
}

export interface NarratorScoreCtx {
  minute: number;
  homeScore: number;
  awayScore: number;
}

/** Memória do padrão do manager — quantas vezes ERROU cada tipo de decisão. */
export type NarratorMemory = Record<string, number>;

type Pick = (n: number) => number;
const defaultPick: Pick = (n) => Math.floor(Math.random() * n);

function choose(pool: string[], pick: Pick): string {
  if (pool.length === 0) return '';
  return pool[Math.min(pool.length - 1, Math.max(0, pick(pool.length)))]!;
}

// ─── Reação a GOL ────────────────────────────────────────────────────────────

const GOAL_FOR_LEAD = ['GOOOL! Que time é esse?', 'É DELES! Passou por cima.', 'Coloca na conta!'];
const GOAL_FOR_EQUAL = ['GOOOL! Empatou e empilhou!', 'A casa responde na lata!', 'Tá vivo! GOOOL!'];
const GOAL_FOR_BEHIND = ['GOOOL! Reagiu, manager!', 'Diminuiu! Tem jogo ainda.', 'A virada começa AGORA.'];
const GOAL_AGAINST_LEAD = ['Tomou, mas tá na frente.', 'Levou um susto. Segura.', 'Visitante desconta. Atenção.'];
const GOAL_AGAINST_EQUAL = ['Empate dos outros. Acordou?', 'Levou o empate. Doeu.', 'Visitante iguala. E agora?'];
const GOAL_AGAINST_BEHIND = ['Tá perdendo, manager. Reage.', 'Mais um. Cadê a marcação?', 'Visitante atropela. Faz algo.'];

export function reactToGoal(
  side: 'home' | 'away',
  ctx: NarratorScoreCtx,
  pick: Pick = defaultPick,
): NarratorLine {
  // Placar JÁ inclui este gol.
  const diff = ctx.homeScore - ctx.awayScore;
  if (side === 'home') {
    const pool = diff > 0 ? GOAL_FOR_LEAD : diff === 0 ? GOAL_FOR_EQUAL : GOAL_FOR_BEHIND;
    return { text: choose(pool, pick), tone: 'exalta', punch: 'GOOOL' };
  }
  const pool = diff < 0 ? GOAL_AGAINST_LEAD : diff === 0 ? GOAL_AGAINST_EQUAL : GOAL_AGAINST_BEHIND;
  // Gol sofrido tarde e que tira a vantagem → frieza (consequência pesada).
  const late = ctx.minute >= 75 && diff <= 0;
  return { text: choose(pool, pick), tone: late ? 'frieza' : 'cutuca' };
}

// ─── Reação a CARTÃO VERMELHO ────────────────────────────────────────────────

const RED_OURS = [
  'Expulso! Agora se vira com dez.',
  'Vermelho nosso. Precipitou feio.',
  'Tá com um a menos. Decisão burra.',
];
const RED_THEIRS = [
  'Vermelho neles! Um a mais — usa.',
  'Expulsaram o adversário. Aproveita!',
  'Visitante com dez. Aperta agora.',
];

export function reactToRed(side: 'home' | 'away', pick: Pick = defaultPick): NarratorLine {
  if (side === 'home') return { text: choose(RED_OURS, pick), tone: 'frieza', punch: 'VERMELHO' };
  return { text: choose(RED_THEIRS, pick), tone: 'exalta', punch: 'VERMELHO' };
}

// ─── Reação à DECISÃO do manager (o coração do §6) ───────────────────────────

const DECISION_LABEL: Record<QuickMomentType, string> = {
  counter_attack: 'contra-ataque',
  set_piece: 'bola parada',
  defensive_choice: 'leitura defensiva',
  sub_timing: 'troca',
  squad_decision: 'jogada do time',
};

const SUCCESS_LINES: Record<QuickMomentType, string[]> = {
  counter_attack: ['QUE LEITURA! Saiu como pediu.', 'Contra-ataque mortal! Boa, manager.'],
  set_piece: ['Na mosca! Bola parada ensaiada.', 'Cobrança magistral — você mandou bem.'],
  defensive_choice: ['Defesa cirúrgica! Leu o lance.', 'Fechou tudo! Comando perfeito.'],
  sub_timing: ['Troca de mestre! Mudou o jogo.', 'Sangue novo decidiu. Tá ligado.'],
  squad_decision: ['QUE JOGADA! Você leu o time certo.', 'Saiu redondo! Boa pedida, manager.'],
};

const FAIL_LINES: Record<QuickMomentType, string[]> = {
  counter_attack: ['Apressou e perdeu. Calma.', 'Contra-ataque jogado fora. Eita.'],
  set_piece: ['Cobrou na barreira. Ai, ai.', 'Bola parada desperdiçada. Doeu.'],
  defensive_choice: ['Se expôs e tomou perigo.', 'Leitura furada. Quase custou caro.'],
  sub_timing: ['Troca no momento errado. Hmm.', 'Mexeu e piorou. Paciência.'],
  squad_decision: ['Pediu o que o time não tem. Eita.', 'Jogada forçada — não saiu. Calma.'],
};

const REPEAT_FAIL_LINES: Record<QuickMomentType, string> = {
  counter_attack: 'De novo o contra-ataque afobado, manager?',
  set_piece: 'Mesma cobrança furada de novo? Aprende.',
  defensive_choice: 'Toda vez a mesma leitura errada, hein.',
  squad_decision: 'De novo forçando o que o elenco não dá?',
  sub_timing: 'De novo a troca no escuro? Repensa.',
};

export interface DecisionReactInput {
  momentType: QuickMomentType;
  success: boolean;
  /** Memória mutável de erros por tipo — a função LÊ e ATUALIZA. */
  memory: NarratorMemory;
}

/**
 * Reage à escolha do manager com contraste e memória. No 2º erro do mesmo tipo
 * de decisão, a zoeira fica pessoal ("de novo o carrinho?") — intimidade/vínculo.
 */
export function reactToDecision(input: DecisionReactInput, pick: Pick = defaultPick): NarratorLine {
  const { momentType, success, memory } = input;
  if (success) {
    return { text: choose(SUCCESS_LINES[momentType], pick), tone: 'exalta', punch: 'BOA' };
  }
  const fails = (memory[momentType] ?? 0) + 1;
  memory[momentType] = fails;
  if (fails >= 2) {
    return { text: REPEAT_FAIL_LINES[momentType], tone: 'cutuca' };
  }
  return { text: choose(FAIL_LINES[momentType], pick), tone: 'cutuca' };
}

// ─── Reação a QUASE-GOL (mesma emoção, desfecho diferente — §3.3) ────────────

const NEAR_FOR = ['NA TRAVE! Por pouco, manager.', 'UUUH! Quase o golaço.', 'Faltou o tapa final.'];
const NEAR_AGAINST = ['Passou raspando o nosso! Ufa.', 'Que susto — saiu por um fio.', 'A trave salvou. Respira.'];

export function reactToNearMiss(side: 'home' | 'away', pick: Pick = defaultPick): NarratorLine {
  if (side === 'home') return { text: choose(NEAR_FOR, pick), tone: 'tensao' };
  return { text: choose(NEAR_AGAINST, pick), tone: 'alivio' };
}

export { DECISION_LABEL };
