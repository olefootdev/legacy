/**
 * Guarda do loop de compartilhamento.
 *
 * O Worker do REVELA roda fora do bundle do React: ele não pode importar
 * `revela/src/data/legends.ts`, então a regra de slug do atleta está escrita
 * DUAS VEZES. Se as duas divergirem, o link que a página gera deixa de casar
 * com o link que o crawler resolve — e o preview quebra exatamente no
 * compartilhamento, que é a única razão do Worker existir.
 *
 * Este teste não precisa de rede nem de banco: carrega as duas implementações e
 * compara em cima de nomes reais do catálogo, incluindo os formatos chatos
 * ("Goncalves98" sem espaço, "Adauto SLV" com sigla, acento, handle nulo).
 *
 *     npm run test:revela-share
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { athleteSlug } from '../revela/src/data/legends';
import { imagemParaCompartilhar } from '../revela/src/data/images';
import type { Legend } from '../revela/src/data/types';

const here = dirname(fileURLToPath(import.meta.url));
const WORKER = join(here, '..', 'revela', 'worker.ts');

let fail = 0;
const bad = (m: string) => {
  fail++;
  console.log(`  ❌ ${m}`);
};

/**
 * Extrai `slugDoAtleta` do worker e avalia. Ler o texto (em vez de importar) é
 * de propósito: o worker declara tipos do runtime Cloudflare que não existem
 * aqui, e importá-lo exigiria carregar aquele ambiente inteiro.
 */
function slugDoWorker(): (l: { name: string; handle: string | null }) => string {
  const src = readFileSync(WORKER, 'utf8');
  const m = src.match(/function slugDoAtleta\(l: LegendRow\): string \{([\s\S]*?)\n\}/);
  if (!m) throw new Error('não achei slugDoAtleta em revela/worker.ts');
  const corpo = m[1].replace(/: LegendRow/g, '');
  // eslint-disable-next-line no-new-func
  return new Function('l', corpo) as (l: { name: string; handle: string | null }) => string;
}

/** Nomes reais do catálogo, incluindo os formatos que já quebraram antes. */
const CASOS: Array<{ name: string; handle: string | null; esperado: string }> = [
  { name: 'Palhinha 93', handle: 'palhinha', esperado: 'palhinha' },
  { name: 'Goncalves98', handle: null, esperado: 'goncalves' }, // sem espaço antes do ano
  { name: 'Adauto SLV', handle: 'adauto', esperado: 'adauto' },
  { name: 'William BSP', handle: 'william', esperado: 'william' },
  { name: 'Nem PR', handle: 'nem', esperado: 'nem' },
  { name: 'Cocito GRE', handle: 'cocito', esperado: 'cocito' },
  { name: 'Johnson ANG', handle: 'johnson', esperado: 'johnson' },
  { name: 'Breno AGS', handle: 'breno', esperado: 'breno' },
  // Sem handle e com acento: o caso do Gonçalves se um dia o nome for corrigido.
  { name: 'Gonçalves 95', handle: null, esperado: 'goncalves' },
  { name: 'Sócrates', handle: null, esperado: 'socrates' },
  // Handle sempre vence o nome — é o identificador canônico.
  { name: 'Qualquer Coisa 77', handle: 'MeuHandle', esperado: 'meuhandle' },
];

console.log('Slug do atleta — página (TS) × worker (edge)\n');

const doWorker = slugDoWorker();

for (const c of CASOS) {
  const daPagina = athleteSlug({ name: c.name, handle: c.handle } as Legend);
  const doEdge = doWorker({ name: c.name, handle: c.handle });

  if (daPagina !== doEdge) {
    bad(`"${c.name}" (handle=${c.handle ?? 'null'}): página "${daPagina}" ≠ worker "${doEdge}"`);
  } else if (daPagina !== c.esperado) {
    bad(`"${c.name}": os dois dizem "${daPagina}", mas o esperado é "${c.esperado}"`);
  } else {
    console.log(`  ✅ ${c.name.padEnd(20)} → ${daPagina}`);
  }
}

// As rotas que o worker trata precisam ser as MESMAS declaradas no App.
const workerSrc = readFileSync(WORKER, 'utf8');
const appSrc = readFileSync(join(here, '..', 'revela', 'src', 'App.tsx'), 'utf8');
const rotasDoApp = [...appSrc.matchAll(/path="\/([a-z]+)\/:slug"/g)].map((m) => m[1]);
const semCobertura = rotasDoApp.filter((r) => !workerSrc.includes(`'${r}'`));

if (semCobertura.length) {
  bad(`rotas sem meta tag no worker: ${semCobertura.map((r) => `/${r}/:slug`).join(', ')}`);
} else {
  console.log(`\n  ✅ as ${rotasDoApp.length} rotas de slug do App têm meta tag no worker`);
}

/* ── O og:image tem que sair otimizado, não o PNG cru ─────────────────────── */
// Medido em 2026-07-23: retrato cru = 2,6 MB; recortado 1200×630 jpeg = 75 KB.
// Crawler desiste de imagem pesada, então mandar o original arrisca o preview.
const PINATA = 'https://maroon-improved-loon-313.mypinata.cloud/ipfs/bafy/x.png';

const doWorkerOg = (() => {
  const m = workerSrc.match(/function paraCompartilhar\(src: string \| null \| undefined\): string \| undefined \{([\s\S]*?)\n\}/);
  if (!m) throw new Error('não achei paraCompartilhar em revela/worker.ts');
  // eslint-disable-next-line no-new-func
  return new Function('src', m[1]) as (s: string) => string | undefined;
})();

const daPaginaOg = imagemParaCompartilhar(PINATA);
const doEdgeOg = doWorkerOg(PINATA);

if (daPaginaOg !== doEdgeOg) {
  bad(`og:image: página "${daPaginaOg}" ≠ worker "${doEdgeOg}"`);
} else {
  const p = new URL(doEdgeOg ?? '').searchParams;
  const faltando = ['img-width', 'img-height', 'img-fit', 'img-format'].filter((k) => !p.get(k));
  if (faltando.length) bad(`og:image sem parâmetro: ${faltando.join(', ')}`);
  else if (p.get('img-format') !== 'jpeg') bad(`og:image em ${p.get('img-format')} — crawler espera jpeg`);
  else console.log(`  ✅ og:image otimizado ${p.get('img-width')}×${p.get('img-height')} ${p.get('img-format')}, igual nos dois lados`);
}

// Host que não é Pinata precisa passar intacto, sem query inventada.
const outro = 'https://exemplo.com/foto.png';
if (imagemParaCompartilhar(outro) !== outro || doWorkerOg(outro) !== outro) {
  bad('host não-Pinata deveria passar intacto');
} else {
  console.log('  ✅ host desconhecido passa intacto');
}

console.log(fail ? `\n❌ ${fail} falha(s)` : '\n✅ tudo certo');
process.exit(fail ? 1 : 0);
