/**
 * Idioma — o mecanismo, compartilhado entre o jogo e a OLEWALLET.
 *
 * Mora em `src/i18n/` e não dentro da carteira de propósito: o token da OLEFOOT
 * na Solana traz gente de fora, e daqui pra frente tela nova nasce nos dois
 * idiomas. Se isto morasse em `dex/`, o jogo teria que inventar o seu próprio —
 * e aí seriam duas formas de dizer "a mesma frase em inglês".
 *
 * Sem biblioteca de propósito. i18next e companhia passam de 40 kB; a OLEWALLET
 * inteira tem 92 kB, e ela existe pra ser pequena. O que este arquivo faz —
 * escolher idioma, lembrar da escolha, avisar quem está na tela — cabe em 60
 * linhas e não tem o que dar errado.
 */

export type Idioma = 'pt' | 'en';
export const IDIOMAS: readonly Idioma[] = ['pt', 'en'];

const CHAVE = 'olefoot.idioma';

/** Um verbete é sempre um par: se faltar um lado, o TypeScript reclama. */
export type Verbete = { readonly pt: string; readonly en: string };
export type Dicionario<K extends string> = Readonly<Record<K, Verbete>>;

function doNavegador(): Idioma {
  if (typeof navigator === 'undefined') return 'pt';
  // pt-BR, pt-PT, pt → pt. Todo o resto do mundo → en.
  return navigator.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export function idiomaAtual(): Idioma {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo === 'pt' || salvo === 'en') return salvo;
  } catch {
    // aba anônima, storage bloqueado: cai no navegador, não quebra
  }
  return doNavegador();
}

type Ouvinte = (i: Idioma) => void;
const ouvintes = new Set<Ouvinte>();

export function definirIdioma(i: Idioma): void {
  try { localStorage.setItem(CHAVE, i); } catch { /* segue sem lembrar */ }
  for (const o of ouvintes) o(i);
}

export function aoMudarIdioma(cb: Ouvinte): () => void {
  ouvintes.add(cb);
  return () => { ouvintes.delete(cb); };
}

/** Traduz com o dicionário dado. `t('chave')` e pronto. */
export function tradutor<K extends string>(dic: Dicionario<K>, idioma: Idioma) {
  return (chave: K): string => dic[chave][idioma];
}
