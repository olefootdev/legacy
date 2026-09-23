/**
 * O cofre: a frase guardada no aparelho, cifrada com a senha da pessoa.
 *
 * A carteira precisa lembrar quem é entre uma aba e outra, e a única forma
 * honesta de fazer isso sem custódia é guardar a frase CIFRADA e exigir a senha
 * pra abrir. A chave derivada nunca é gravada — ela nasce da frase toda vez que
 * o cofre é aberto, e vive só em memória.
 *
 * O desenho, e o porquê de cada parte:
 *
 *   PBKDF2-SHA256, 600.000 voltas — é o piso que a OWASP recomenda hoje pra
 *     PBKDF2-SHA256. Senha de gente é fraca; a única defesa contra alguém que
 *     copiou o blob é fazer cada tentativa custar caro.
 *   Sal de 16 bytes por cofre — sem ele, uma tabela pronta quebra todo mundo de
 *     uma vez.
 *   AES-GCM 256 — cifra E autentica. Adulterar um byte do blob faz o decifrar
 *     ESTOURAR, em vez de devolver lixo que viraria uma frase inválida (ou,
 *     pior, outra frase válida).
 *   IV de 12 bytes, novo a cada gravação — reusar IV em GCM é o erro clássico
 *     que vaza o texto claro.
 *
 * O que este arquivo NUNCA faz, e não pode passar a fazer: gravar a frase ou a
 * chave em claro, mandar qualquer um dos dois pra rede, ou escrever a senha em
 * algum lugar. O blob que sai daqui é inútil sem a senha, e é por isso que ele
 * pode morar no localStorage.
 */

const VOLTAS = 600_000;
const BYTES_SAL = 16;
const BYTES_IV = 12;

/** O que vai pro disco. Sem a senha, é ruído. */
export interface Cofre {
  readonly v: 1;
  /** base64 */
  readonly sal: string;
  /** base64 */
  readonly iv: string;
  /** base64 — frase cifrada e autenticada */
  readonly blob: string;
  readonly voltas: number;
  readonly criadoEm: string;
}

export class SenhaErrada extends Error {
  constructor() {
    super('Senha errada, ou o cofre foi alterado.');
    this.name = 'SenhaErrada';
  }
}

function webcrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error('sem WebCrypto — recuso guardar frase sem cifra de verdade');
  return c;
}

const b64 = (b: Uint8Array): string => {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};

const deB64 = (s: string): Uint8Array =>
  Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));

async function chaveDaSenha(senha: string, sal: Uint8Array, voltas: number): Promise<CryptoKey> {
  const c = webcrypto();
  const base = await c.subtle.importKey(
    'raw',
    new TextEncoder().encode(senha.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return c.subtle.deriveKey(
    { name: 'PBKDF2', salt: sal as BufferSource, iterations: voltas, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Regra mínima da senha. Curta demais torna as 600 mil voltas inúteis. */
export function senhaFraca(senha: string): string | null {
  if (senha.length < 8) return 'A senha precisa de pelo menos 8 caracteres.';
  if (/^\d+$/.test(senha)) return 'Só números é fácil demais. Misture letras.';
  return null;
}

/** Fecha a frase no cofre. */
export async function fechar(palavras: readonly string[], senha: string): Promise<Cofre> {
  const fraca = senhaFraca(senha);
  if (fraca) throw new RangeError(fraca);
  if (palavras.length === 0) throw new RangeError('cofre vazio não faz sentido');

  const c = webcrypto();
  const sal = c.getRandomValues(new Uint8Array(BYTES_SAL));
  const iv = c.getRandomValues(new Uint8Array(BYTES_IV));
  const chave = await chaveDaSenha(senha, sal, VOLTAS);
  const claro = new TextEncoder().encode(palavras.join(' '));
  const cifrado = await c.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, chave, claro);
  claro.fill(0);

  return {
    v: 1,
    sal: b64(sal),
    iv: b64(iv),
    blob: b64(new Uint8Array(cifrado)),
    voltas: VOLTAS,
    criadoEm: new Date().toISOString(),
  };
}

/**
 * Abre o cofre. Senha errada ou blob adulterado estouram `SenhaErrada` — o
 * GCM não devolve "quase certo".
 */
export async function abrir(cofre: Cofre, senha: string): Promise<string[]> {
  if (cofre?.v !== 1) throw new RangeError('formato de cofre desconhecido');
  const c = webcrypto();
  const chave = await chaveDaSenha(senha, deB64(cofre.sal), cofre.voltas);
  let claro: ArrayBuffer;
  try {
    claro = await c.subtle.decrypt(
      { name: 'AES-GCM', iv: deB64(cofre.iv) as BufferSource },
      chave,
      deB64(cofre.blob) as BufferSource,
    );
  } catch {
    throw new SenhaErrada();
  }
  return new TextDecoder().decode(claro).split(' ').filter(Boolean);
}

// ------------------------------------------------------------- no aparelho ---

const CHAVE_LOCAL = 'olefoot.carteira.cofre.v1';

/**
 * localStorage pode estourar (aba anônima, site bloqueado) e pode voltar
 * vazio. Quem chama tem que aguentar os dois — e por isso `ler` devolve null
 * em vez de explodir.
 */
export function guardar(cofre: Cofre): void {
  try {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(cofre));
  } catch {
    throw new Error('Não consegui guardar no aparelho. Anote a frase — ela é a única cópia.');
  }
}

export function ler(): Cofre | null {
  try {
    const cru = localStorage.getItem(CHAVE_LOCAL);
    if (!cru) return null;
    const c = JSON.parse(cru) as Cofre;
    return c?.v === 1 && c.sal && c.iv && c.blob ? c : null;
  } catch {
    return null;
  }
}

export function existeCofre(): boolean {
  return ler() !== null;
}

/** Apaga o cofre DESTE aparelho. Sem a frase escrita, não volta. */
export function esquecer(): void {
  try { localStorage.removeItem(CHAVE_LOCAL); } catch { /* nada a fazer */ }
}
