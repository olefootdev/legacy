/**
 * O header que conta ao servidor em que idioma o jogador está. Vai em toda
 * chamada que devolve texto gerado pra tela (coach, narração, assistente) —
 * o servidor manda a IA escrever em inglês quando é 'en'. Ver
 * server/src/lib/idioma.ts.
 */
import { idiomaDoJogo } from './L';

export const CABECALHO_IDIOMA: Readonly<Record<string, string>> = { 'X-Olefoot-Idioma': idiomaDoJogo() };
