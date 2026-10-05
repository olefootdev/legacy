/**
 * O jogo em dois idiomas — a forma CURTA, pra texto escrito no próprio arquivo.
 *
 *   L('Salvar', 'Save')
 *   L(`${n} jogadores`, `${n} players`)
 *
 * O par fica junto, na linha onde o texto aparece: quem lê a tela lê as duas
 * versões, e não existe chave de dicionário pra cair fora de sincronia. A
 * OLEWALLET usa `Dicionario` (idioma.ts) porque é pequena; o jogo tem milhares
 * de frases e o par inline é o que cabe.
 *
 * 🔴 O idioma é lido UMA vez, no load. Trocar de idioma recarrega a página
 * (`trocarIdiomaDoJogo`). Por isso `L()` pode ser usado em constante de módulo,
 * em engine, em narração — fora do React — sem ficar com o idioma velho.
 *
 * 🔴 `L()` é só pra TEXTO QUE A PESSOA LÊ. Nunca pra valor que o código compara,
 * grava no banco, usa de chave ou manda pro servidor.
 */
import { definirIdioma, idiomaAtual, type Idioma } from './idioma';

const IDIOMA_DO_LOAD: Idioma = idiomaAtual();

export const idiomaDoJogo = (): Idioma => IDIOMA_DO_LOAD;
export const emIngles = (): boolean => IDIOMA_DO_LOAD === 'en';

export function L(pt: string, en: string): string {
  return IDIOMA_DO_LOAD === 'en' ? en : pt;
}

/** Locale pra toLocaleString / Intl: 'pt-BR' ou 'en-US'. */
export const LOCALE: 'pt-BR' | 'en-US' = IDIOMA_DO_LOAD === 'en' ? 'en-US' : 'pt-BR';

/** Grava a escolha e recarrega — todo texto do jogo volta no idioma novo. */
export function trocarIdiomaDoJogo(i: Idioma): void {
  if (i === IDIOMA_DO_LOAD) return;
  definirIdioma(i);
  window.location.reload();
}

if (typeof document !== 'undefined') document.documentElement.lang = LOCALE;
