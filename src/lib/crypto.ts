/**
 * Utilitários de criptografia para dados sensíveis no browser.
 * Usa Web Crypto API (nativa do browser, sem dependências).
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits para AES-GCM

/**
 * Deriva uma chave de criptografia a partir de uma senha.
 * Em produção, a senha deve vir de variável de ambiente do build.
 */
async function deriveKey(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Importar senha como chave base
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derivar chave AES-GCM
  // Salt fixo (não ideal, mas suficiente para localStorage)
  // Em produção ideal: salt único por usuário armazenado separadamente
  const salt = encoder.encode('olefoot-admin-salt-v1');

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Criptografa um texto usando AES-GCM.
 * Retorna base64 com formato: iv.ciphertext
 */
export async function encrypt(plaintext: string, password: string): Promise<string> {
  try {
    const key = await deriveKey(password);
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Gerar IV aleatório
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Criptografar
    const ciphertext = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      data
    );

    // Combinar IV + ciphertext e converter para base64
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (e) {
    console.error('[crypto] encrypt failed:', e);
    throw new Error('Encryption failed');
  }
}

/**
 * Descriptografa um texto criptografado com encrypt().
 */
export async function decrypt(ciphertext: string, password: string): Promise<string> {
  try {
    const key = await deriveKey(password);

    // Decodificar base64
    const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));

    // Separar IV e ciphertext
    const iv = combined.slice(0, IV_LENGTH);
    const data = combined.slice(IV_LENGTH);

    // Descriptografar
    const plaintext = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      data
    );

    const decoder = new TextDecoder();
    return decoder.decode(plaintext);
  } catch (e) {
    console.error('[crypto] decrypt failed:', e);
    throw new Error('Decryption failed');
  }
}

/**
 * Gera uma chave de criptografia aleatória para uso em produção.
 * Executar uma vez e armazenar em variável de ambiente.
 */
export function generateEncryptionKey(): string {
  const array = new Uint8Array(32); // 256 bits
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}
