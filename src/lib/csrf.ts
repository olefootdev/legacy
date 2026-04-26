/**
 * Sistema de CSRF Protection para operações admin.
 * Gera e valida tokens CSRF para prevenir ataques cross-site.
 */

const CSRF_TOKEN_LENGTH = 32;

/**
 * Gera um token CSRF aleatório criptograficamente seguro.
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(CSRF_TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Valida um token CSRF.
 * Em produção, tokens devem ser validados no backend também.
 */
export function validateCsrfToken(token: string, expectedToken: string): boolean {
  if (!token || !expectedToken) return false;
  if (token.length !== CSRF_TOKEN_LENGTH * 2) return false; // hex = 2 chars per byte

  // Constant-time comparison para prevenir timing attacks
  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Middleware para adicionar token CSRF em headers de requests admin.
 */
export function addCsrfHeader(headers: Record<string, string>, csrfToken: string): Record<string, string> {
  return {
    ...headers,
    'X-CSRF-Token': csrfToken,
  };
}
