/**
 * A tela de earnings não guarda número de regra.
 *   npm run test:earnings  (roda depois do self-test das regras)
 *
 * Por que existe: o split da colheita estava COPIADO na OLEWALLET, ao lado do
 * comentário "os mesmos números do servidor". Cópia assim diverge calada — e o
 * split já somou 110% uma vez. A regra mora em `server/src/lib/earningsRegras.ts`
 * e chega pela rede; este teste falha se alguém escrever um percentual, um
 * multiplicador ou um valor em bps dentro dos blocos da carteira.
 *
 * Procura por texto, não por AST: o que se quer barrar é justamente o número
 * digitado à mão numa string ou num JSX.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const listar = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? listar(join(dir, e.name))
    : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []);

// `dex/src` inteira entra na varredura desde a Fase 6: foi de lá que a cópia
// do split saiu, e é pra lá que ela não pode voltar.
const ARQUIVOS = [
  ...listar('src/pages/wallet/dex'),
  'src/pages/wallet/DexTab.tsx',
  ...listar('dex/src'),
];

const PROIBIDO = [
  { nome: 'percentual escrito à mão', re: /\d\s?%/ },
  { nome: 'multiplicador escrito à mão', re: /\d\s?×/ },
  { nome: 'valor em bps escrito à mão', re: /\bbps\s*[:=]\s*\d/ },
  { nome: 'prazo em dias escrito à mão', re: /\b\d+\s?d(ias)?\b(?!\w)/ },
];

// Comentário pode citar número: o que não pode é a TELA desenhar um.
const semComentario = (linha) => linha.replace(/\/\/.*$/, '').replace(/\{\/\*.*?\*\/\}/g, '');

let achados = 0;
for (const arq of ARQUIVOS) {
  let emBloco = false;
  readFileSync(arq, 'utf8').split('\n').forEach((bruta, i) => {
    let linha = bruta;
    if (emBloco) { if (linha.includes('*/')) emBloco = false; return; }
    if (/^\s*\/\*/.test(linha) || /^\s*\{\/\*/.test(linha)) {
      if (!linha.includes('*/')) emBloco = true;
      return;
    }
    if (/^\s*\*/.test(linha)) return;
    linha = semComentario(linha);
    // Classe do Tailwind não é regra de negócio. O clipPath também não: é o
    // recorte do canto do botão, e polígono se escreve em %.
    linha = linha.replace(/className="[^"]*"/g, '').replace(/className=\{`[^`]*`\}/g, '')
                 .replace(/clipPath: '[^']*'/g, '');
    for (const p of PROIBIDO) {
      if (p.re.test(linha)) {
        achados++;
        console.log(`  ❌ ${arq}:${i + 1} — ${p.nome}\n       ${bruta.trim()}`);
      }
    }
  });
}

console.log(achados === 0
  ? `  ✅ ${ARQUIVOS.length} arquivos da tela, nenhum número de regra escrito à mão`
  : `\n🔴 ${achados} número(s) de regra na tela. Eles moram em server/src/lib/earningsRegras.ts.`);
process.exit(achados === 0 ? 0 : 1);
