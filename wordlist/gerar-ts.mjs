/**
 * Gera `src/wallet/seed/wordlist.generated.ts` a partir de
 * `wordlist/olefoot-wordlist-en.txt`, que é a FONTE — o arquivo publicado, o
 * que qualquer pessoa usa pra reimplementar a carteira sem a gente.
 *
 * O módulo gerado carrega o sha256 do .txt. O self-test confere: se alguém
 * editar a lista e esquecer de rodar isto, a frase de 12 palavras de ontem
 * deixa de abrir a carteira de hoje, em silêncio. O hash faz barulho.
 *
 * Roda: node wordlist/gerar-ts.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const fonte = join(aqui, 'olefoot-wordlist-en.txt');
const destino = join(aqui, '..', 'src', 'wallet', 'seed', 'wordlist.generated.ts');

const bruto = readFileSync(fonte);
const sha = createHash('sha256').update(bruto).digest('hex');
const palavras = bruto.toString('utf8').split('\n').map((p) => p.trim()).filter(Boolean);

if (palavras.length !== 2048) throw new Error(`a lista tem ${palavras.length} palavras, não 2048`);
if (new Set(palavras).size !== 2048) throw new Error('a lista tem palavra repetida');

const linhas = [];
for (let i = 0; i < palavras.length; i += 8) {
  linhas.push('  ' + palavras.slice(i, i + 8).map((p) => `'${p}'`).join(', ') + ',');
}

writeFileSync(destino, `/**
 * GERADO — não edite à mão.
 *
 * Fonte: wordlist/olefoot-wordlist-en.txt (a lista publicada).
 * Regerar: node wordlist/gerar-ts.mjs
 *
 * Mexer aqui sem mexer na fonte quebra toda carteira já criada, e quebra
 * calado: a frase continua parecendo válida e abre outra carteira.
 */

/** sha256 do .txt que gerou este arquivo. O self-test confere. */
export const WORDLIST_SHA256 = '${sha}';

export const WORDLIST: readonly string[] = [
${linhas.join('\n')}
];

/** palavra → índice, pra validar a frase em O(1). */
export const INDICE_DA_PALAVRA: ReadonlyMap<string, number> = new Map(
  WORDLIST.map((p, i) => [p, i]),
);
`);

console.log(`✅ ${palavras.length} palavras → src/wallet/seed/wordlist.generated.ts`);
console.log(`   sha256 da fonte: ${sha}`);
