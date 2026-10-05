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
import { L } from '@/i18n/L';

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
  provocador: { label: L('O Provocador', 'The Provoker'), icon: '😤' },
  professor: { label: L('O Professor', 'The Professor'), icon: '📋' },
  retranqueiro: { label: L('O Retranqueiro', 'The Bus Parker'), icon: '🧱' },
  romantico: { label: L('O Romântico', 'The Romantic'), icon: '🎩' },
  matador: { label: L('O Matador', 'The Assassin'), icon: '🗡️' },
  imprevisivel: { label: L('O Imprevisível', 'The Wildcard'), icon: '🎲' },
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
    pre: [L('Vai ser fácil hoje.', 'It\'ll be easy today.'), L('Trouxe até time reserva.', 'Even brought the reserves.')],
    won: [L('Eu avisei. Fácil.', 'Told you. Easy.'), L('Nem suamos a camisa.', 'Barely broke a sweat.')],
    lost: [L('Sorte. Volto ano que vem.', 'Luck. See you next year.'), L('Árbitro decidiu esse jogo.', 'The ref decided this one.')],
    eliminated_you: [L('Tchau. Nem doeu.', 'Bye. Didn\'t even hurt.'), L('Volta pra escolinha.', 'Back to football school.')],
  },
  professor: {
    pre: [L('Estudei cada jogada sua.', 'I studied your every move.'), L('O plano está pronto.', 'The plan is ready.')],
    won: [L('O plano funcionou perfeitamente.', 'The plan worked perfectly.'), L('Xadrez, não futebol.', 'Chess, not football.')],
    lost: [L('Você me surpreendeu. Parabéns.', 'You surprised me. Well done.'), L('Vou rever a tese.', 'I\'ll revise the thesis.')],
    eliminated_you: [L('Aula encerrada. Boa sorte.', 'Class dismissed. Good luck.'), L('Faltou tática. Estude.', 'Lacked tactics. Study.')],
  },
  retranqueiro: {
    pre: [L('Ninguém fura meu muro.', 'Nobody breaks my wall.'), L('Zero espaço pra vocês.', 'Zero space for you.')],
    won: [L('Muro em pé. Sempre.', 'Wall still standing. Always.'), L('Defesa ganha campeonato.', 'Defence wins titles.')],
    lost: [L('Racharam o muro. Raro.', 'They cracked the wall. Rare.'), L('Um erro. Um só.', 'One mistake. Just one.')],
    eliminated_you: [L('O muro te engoliu.', 'The wall swallowed you.'), L('Bateu e voltou.', 'Hit it and bounced off.')],
  },
  romantico: {
    pre: [L('Que vença o futebol.', 'May football win.'), L('Hoje tem espetáculo.', 'Tonight\'s a show.')],
    won: [L('Futebol bonito venceu hoje.', 'Beautiful football won today.'), L('A torcida merecia isso.', 'The fans deserved this.')],
    lost: [L('Perdi jogando bonito. Durmo tranquilo.', 'Lost playing beautifully. I sleep well.'), L('O futebol agradece. Parabéns.', 'Football thanks you. Well done.')],
    eliminated_you: [L('Foi lindo te vencer.', 'Beating you was beautiful.'), L('A poesia seguiu adiante.', 'The poetry goes on.')],
  },
  matador: {
    pre: [L('Uma chance. Um gol.', 'One chance. One goal.'), L('Vim decidir, não jogar.', 'Came to decide, not to play.')],
    won: [L('Cirúrgico. Como sempre.', 'Surgical. As always.'), L('Uma chance bastou.', 'One chance was enough.')],
    lost: [L('Errei a única. Acontece.', 'Missed the only one. Happens.'), L('Hoje a faca falhou.', 'The knife failed today.')],
    eliminated_you: [L('Golpe único. Fim.', 'One blow. Done.'), L('Nem viu de onde veio.', 'Didn\'t see it coming.')],
  },
  imprevisivel: {
    pre: [L('Nem eu sei o plano.', 'Even I don\'t know the plan.'), L('Hoje pode dar tudo.', 'Anything can happen today.')],
    won: [L('Caos venceu a ordem.', 'Chaos beat order.'), L('Ninguém previu. Nem eu.', 'Nobody saw it coming. Not even me.')],
    lost: [L('O caos me traiu hoje.', 'Chaos betrayed me today.'), L('Amanhã invento outra.', 'Tomorrow I\'ll invent another.')],
    eliminated_you: [L('O caos te levou.', 'Chaos took you.'), L('Imprevisível até no adeus.', 'Unpredictable even in goodbye.')],
  },
};

/** Fala da persona pra situação — determinística por (teamId, situação, salt). */
export function personaLine(teamId: string, situation: PersonaSituation, salt = ''): string {
  const persona = coachPersonaFor(teamId);
  const pool = LINES[persona.archetype][situation];
  return pool[hashStr(`line|${teamId}|${situation}|${salt}`) % pool.length]!;
}
