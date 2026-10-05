/**
 * O idioma do jogador, do lado do servidor.
 *
 * O jogo manda `X-Olefoot-Idioma: en` em toda chamada que devolve texto pra
 * tela (coach, narração, assistente). Sem o header, ou com qualquer outro valor,
 * é português — que é como tudo funcionava antes do jogo ser bilíngue.
 *
 * Os prompts continuam escritos em português (são a regra do agente, não o que
 * a pessoa lê). Em inglês, `instrucaoDeIdioma` acrescenta ao system prompt a
 * ordem de escrever em inglês — e de NÃO traduzir chaves, ids e enums do JSON,
 * que o jogo compara.
 */
import type { Context } from 'hono';

export type Idioma = 'pt' | 'en';

export const CABECALHO_IDIOMA = 'X-Olefoot-Idioma';

export function idiomaDoPedido(c: Context): Idioma {
  return c.req.header(CABECALHO_IDIOMA)?.trim().toLowerCase() === 'en' ? 'en' : 'pt';
}

export function instrucaoDeIdioma(idioma: Idioma | undefined): string {
  if (idioma !== 'en') return '';
  return [
    '',
    'LANGUAGE — OVERRIDES ANY LANGUAGE RULE ABOVE:',
    '- The player is playing in ENGLISH. Write every piece of text the player will read in natural English,',
    '  in international football language (British commentary style when narrating). Never answer in Portuguese.',
    '- Keep JSON keys, ids, codes and enum values EXACTLY as specified above (they are not translated).',
    '- Keep proper names as they are (players, clubs, OLEFOOT, OLE, EXP, BRO).',
  ].join('\n');
}

/** Par de texto fixo do servidor (fallbacks, erros que a tela mostra). */
export const T = (idioma: Idioma | undefined, pt: string, en: string): string => (idioma === 'en' ? en : pt);
