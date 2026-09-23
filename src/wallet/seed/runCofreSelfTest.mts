/**
 * Self-test do cofre — o único lugar do projeto que grava segredo em disco.
 *
 * O que está sendo guardado é a frase que ABRE A CARTEIRA. Um erro aqui não
 * derruba tela nenhuma: ele grava, funciona, e deixa a frase legível pra quem
 * abrir o DevTools ou copiar o localStorage.
 *
 * Por isso o teste mais importante deste arquivo não é o round-trip — é o que
 * procura as 12 palavras dentro do blob que vai pro disco.
 *
 * Roda: npm run test:wallet-cofre
 */
import { SenhaErrada, abrir, esquecer, existeCofre, fechar, guardar, ler, senhaFraca, type Cofre } from './cofre.js';
import { fraseParaChave } from './derive.js';
import { gerarFrase } from './mnemonic.js';

let pass = 0, fail = 0;
const check = (nome: string, cond: boolean, det = '') => {
  if (cond) { pass++; console.log(`  ✅ ${nome}`); } else { fail++; console.log(`  ❌ ${nome} ${det}`); }
};
const recusaAsync = async (nome: string, fn: () => Promise<unknown>, tipo?: new (...a: never[]) => Error) => {
  try { await fn(); check(nome, false, '(não recusou)'); }
  catch (e) { check(nome, !tipo || e instanceof tipo, `(erro errado: ${(e as Error).name})`); }
};

// localStorage não existe no Node; o cofre só pede setItem/getItem/removeItem.
const memoria = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => memoria.get(k) ?? null,
    setItem: (k: string, v: string) => { memoria.set(k, v); },
    removeItem: (k: string) => { memoria.delete(k); },
  },
});

const SENHA = 'guarda-redes-88';

console.log('\n🔒 cofre — a frase no aparelho, cifrada\n');

const frase = gerarFrase();

{
  const cofre = await fechar(frase, SENHA);
  const volta = await abrir(cofre, SENHA);
  check('fecha e abre com a senha certa', volta.join(' ') === frase.join(' '));
  check('e a chave derivada é a mesma carteira',
    fraseParaChave(volta).endereco === fraseParaChave(frase).endereco);
}

// ⭐ O teste que justifica o arquivo: nada de frase em claro no que vai pro disco.
{
  const cofre = await fechar(frase, SENHA);
  const noDisco = JSON.stringify(cofre);
  const vazadas = frase.filter((p) => noDisco.includes(p));
  check('NENHUMA das 12 palavras aparece em claro no disco', vazadas.length === 0,
    `vazaram: ${vazadas.join(', ')}`);
  check('e a senha também não está lá', !noDisco.includes(SENHA));
}

{
  const cofre = await fechar(frase, SENHA);
  await recusaAsync('senha errada é recusada', () => abrir(cofre, SENHA + 'x'), SenhaErrada);
  await recusaAsync('senha vazia é recusada', () => abrir(cofre, ''), SenhaErrada);
}

// AES-GCM autentica: um byte trocado tem que ESTOURAR, não devolver lixo.
// Se devolvesse lixo, viraria "frase inválida" — ou, pior, outra frase válida.
{
  const cofre = await fechar(frase, SENHA);
  const trocaUmByte = (s: string) => {
    const b = Buffer.from(s, 'base64');
    b[Math.floor(b.length / 2)] = (b[Math.floor(b.length / 2)] as number) ^ 0xff;
    return b.toString('base64');
  };
  await recusaAsync('blob adulterado é recusado', () => abrir({ ...cofre, blob: trocaUmByte(cofre.blob) }, SENHA), SenhaErrada);
  await recusaAsync('IV adulterado é recusado', () => abrir({ ...cofre, iv: trocaUmByte(cofre.iv) }, SENHA), SenhaErrada);
  await recusaAsync('sal adulterado é recusado', () => abrir({ ...cofre, sal: trocaUmByte(cofre.sal) }, SENHA), SenhaErrada);
  await recusaAsync('formato desconhecido é recusado', () => abrir({ ...cofre, v: 2 } as unknown as Cofre, SENHA));
}

// Sal e IV novos a cada gravação: dois cofres da MESMA frase e MESMA senha têm
// que sair diferentes. Iguais significaria IV reusado — o erro clássico do GCM.
{
  const a = await fechar(frase, SENHA);
  const b = await fechar(frase, SENHA);
  check('dois cofres da mesma frase saem diferentes', a.blob !== b.blob && a.iv !== b.iv && a.sal !== b.sal);
  check('mas os dois abrem', (await abrir(a, SENHA)).join(' ') === (await abrir(b, SENHA)).join(' '));
}

{
  check('senha curta é barrada antes de cifrar', senhaFraca('abc123') !== null);
  check('só números é barrado', senhaFraca('12345678') !== null);
  check('senha decente passa', senhaFraca(SENHA) === null);
  await recusaAsync('fechar com senha fraca é recusado', () => fechar(frase, 'abc'), RangeError);
}

{
  const cofre = await fechar(frase, SENHA);
  check('antes de guardar, não existe cofre', !existeCofre());
  guardar(cofre);
  check('depois de guardar, existe', existeCofre());
  check('e o que volta abre igual', (await abrir(ler() as Cofre, SENHA)).join(' ') === frase.join(' '));
  esquecer();
  check('esquecer apaga do aparelho', !existeCofre() && ler() === null);

  memoria.set('olefoot.carteira.cofre.v1', '{isso não é json');
  check('JSON corrompido devolve null em vez de estourar', ler() === null);
  memoria.clear();
}

console.log(`\n${fail === 0 ? '🟢' : '🔴'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
