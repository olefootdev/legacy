/**
 * coachPersona.ts — Persona de treinador dos rivais da Liga Ole.
 *
 * Filosofia Fable: NPC com opinião, não script. Cada time adversário ganha 1
 * de 6 arquétipos de treinador, derivado DETERMINISTICAMENTE do teamId (mesmo
 * rival = mesma persona pra sempre — dá rosto e memória ao confronto).
 *
 * Falas respeitam a regra do analista: ≤5 palavras, sempre pt-BR.
 * PURO — sem Date/Math.random.
 */

export type CoachArchetype =
  | 'provocador'
  | 'professor'
  | 'retranqueiro'
  | 'romantico'
  | 'matador'
  | 'imprevisivel';

export interface CoachPersona {
  archetype: CoachArchetype;
  /** Rótulo editorial ("O Provocador"). */
  label: string;
  /** Emoji curto pra UI compacta. */
  icon: string;
}

const PERSONAS: Record<CoachArchetype, Omit<CoachPersona, 'archetype'>> = {
  provocador: { label: 'O Provocador', icon: '😤' },
  professor: { label: 'O Professor', icon: '📋' },
  retranqueiro: { label: 'O Retranqueiro', icon: '🧱' },
  romantico: { label: 'O Romântico', icon: '🎩' },
  matador: { label: 'O Matador', icon: '🗡️' },
  imprevisivel: { label: 'O Imprevisível', icon: '🎲' },
};

const ORDER: CoachArchetype[] = ['provocador', 'professor', 'retranqueiro', 'romantico', 'matador', 'imprevisivel'];

function hashStr(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** Persona fixa do time — seed pelo teamId (mesmo rival, mesma cara sempre). */
export function coachPersonaFor(teamId: string): CoachPersona {
  const archetype = ORDER[hashStr(`persona|${teamId}`) % ORDER.length]!;
  return { archetype, ...PERSONAS[archetype] };
}

export type PersonaSituation = 'pre' | 'won' | 'lost' | 'eliminated_you';

/** Falas ≤5 palavras por (arquétipo, situação). 'won'/'lost' = do PONTO DE
 *  VISTA DO RIVAL (ele venceu / ele perdeu). */
const LINES: Record<CoachArchetype, Record<PersonaSituation, string[]>> = {
  provocador: {
    pre: ['Vai ser fácil hoje.', 'Trouxe até time reserva.'],
    won: ['Eu avisei. Fácil.', 'Nem suamos a camisa.'],
    lost: ['Sorte. Volto ano que vem.', 'Árbitro decidiu esse jogo.'],
    eliminated_you: ['Tchau. Nem doeu.', 'Volta pra escolinha.'],
  },
  professor: {
    pre: ['Estudei cada jogada sua.', 'O plano está pronto.'],
    won: ['O plano funcionou perfeitamente.', 'Xadrez, não futebol.'],
    lost: ['Você me surpreendeu. Parabéns.', 'Vou rever a tese.'],
    eliminated_you: ['Aula encerrada. Boa sorte.', 'Faltou tática. Estude.'],
  },
  retranqueiro: {
    pre: ['Ninguém fura meu muro.', 'Zero espaço pra vocês.'],
    won: ['Muro em pé. Sempre.', 'Defesa ganha campeonato.'],
    lost: ['Racharam o muro. Raro.', 'Um erro. Um só.'],
    eliminated_you: ['O muro te engoliu.', 'Bateu e voltou.'],
  },
  romantico: {
    pre: ['Que vença o futebol.', 'Hoje tem espetáculo.'],
    won: ['Futebol bonito venceu hoje.', 'A torcida merecia isso.'],
    lost: ['Perdi jogando bonito. Durmo tranquilo.', 'O futebol agradece. Parabéns.'],
    eliminated_you: ['Foi lindo te vencer.', 'A poesia seguiu adiante.'],
  },
  matador: {
    pre: ['Uma chance. Um gol.', 'Vim decidir, não jogar.'],
    won: ['Cirúrgico. Como sempre.', 'Uma chance bastou.'],
    lost: ['Errei a única. Acontece.', 'Hoje a faca falhou.'],
    eliminated_you: ['Golpe único. Fim.', 'Nem viu de onde veio.'],
  },
  imprevisivel: {
    pre: ['Nem eu sei o plano.', 'Hoje pode dar tudo.'],
    won: ['Caos venceu a ordem.', 'Ninguém previu. Nem eu.'],
    lost: ['O caos me traiu hoje.', 'Amanhã invento outra.'],
    eliminated_you: ['O caos te levou.', 'Imprevisível até no adeus.'],
  },
};

/** Fala da persona pra situação — determinística por (teamId, situação, salt). */
export function personaLine(teamId: string, situation: PersonaSituation, salt = ''): string {
  const persona = coachPersonaFor(teamId);
  const pool = LINES[persona.archetype][situation];
  return pool[hashStr(`line|${teamId}|${situation}|${salt}`) % pool.length]!;
}
