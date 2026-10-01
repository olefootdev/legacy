/**
 * Formatação dos painéis de admin da expansão. Os valores chegam como STRING
 * (numeric(78,0) do banco não cabe em number) — tudo aqui passa por BigInt.
 */

/** "2026-09-30T23:05:00Z" → "30/09/2026 20:05" (fuso local do admin). */
export function fmtData(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso.slice(0, 16)
    : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const inteiro = (v: string | number | bigint | null | undefined): bigint => {
  try { return BigInt(String(v ?? '0').split('.')[0] || '0'); } catch { return 0n; }
};

/** Centavos de dólar (string do banco) → "$1.234,56". */
export function dolarCents(v: string | number | null | undefined): string {
  const cents = inteiro(v);
  const sinal = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  return `${sinal}$${(abs / 100n).toLocaleString('pt-BR')},${(abs % 100n).toString().padStart(2, '0')}`;
}

/** Tokens inteiros (string do banco) → "12.345". */
export function tok(v: string | number | null | undefined): string {
  return inteiro(v).toLocaleString('pt-BR');
}
