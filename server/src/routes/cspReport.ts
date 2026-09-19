/**
 * Destino dos relatórios da CSP (A VIRADA · E2).
 *
 * A CSP do jogo (public/_headers) roda em Report-Only desde 2026-09-18, mas
 * sem `report-uri` — os relatórios não chegavam a lugar nenhum e não havia como
 * saber quando é seguro passar a bloquear. A tela das palavras da carteira
 * embutida (C4) só pode existir com a CSP bloqueando.
 *
 * Aceita os dois formatos que os navegadores mandam:
 *   - `report-uri`  → { "csp-report": { ... } }            (application/csp-report)
 *   - `report-to`   → [{ type: "csp-violation", body }]     (application/reports+json)
 *
 * Grava só o necessário pra decidir: diretiva, ORIGEM do recurso bloqueado,
 * CAMINHO da página (sem query — pode ter token), e agrega por dia via RPC
 * `record_csp_report`. Sempre responde 204: relatório não tem resposta útil.
 */
import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { rateLimit } from '../lib/rateLimit.js';

export const cspReportRoutes = new Hono();

const MAX_BODY = 32_768;
const MAX_REPORTS = 20;

type NormalizedReport = {
  directive: string;
  blocked: string;
  documentPath: string;
  source: string;
  disposition: string;
};

function clip(s: unknown, n: number): string {
  return typeof s === 'string' ? s.slice(0, n) : '';
}

/** URL vira só a origem; palavra-chave (inline, eval, data…) fica como veio. */
function originOf(raw: unknown): string {
  const s = clip(raw, 300);
  if (!s) return '';
  try {
    const u = new URL(s);
    if (u.protocol === 'data:' || u.protocol === 'blob:') return u.protocol.slice(0, -1);
    return u.origin;
  } catch {
    return s.slice(0, 60);
  }
}

function pathOf(raw: unknown): string {
  const s = clip(raw, 500);
  if (!s) return '';
  try {
    return new URL(s).pathname.slice(0, 200);
  } catch {
    return s.split(/[?#]/)[0].slice(0, 200);
  }
}

function sourceOf(raw: unknown): string {
  const s = clip(raw, 500);
  if (!s) return '';
  try {
    const u = new URL(s);
    return `${u.origin}${u.pathname}`.slice(0, 200);
  } catch {
    return s.split(/[?#]/)[0].slice(0, 200);
  }
}

function normalize(payload: unknown): NormalizedReport[] {
  const out: NormalizedReport[] = [];
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'csp-report' in payload) {
    const r = (payload as Record<string, Record<string, unknown>>)['csp-report'] ?? {};
    out.push({
      directive: clip(r['effective-directive'] || String(r['violated-directive'] ?? '').split(' ')[0], 60),
      blocked: originOf(r['blocked-uri']),
      documentPath: pathOf(r['document-uri']),
      source: sourceOf(r['source-file']),
      disposition: clip(r['disposition'] || 'report', 20),
    });
  } else if (Array.isArray(payload)) {
    for (const item of payload.slice(0, MAX_REPORTS)) {
      if (!item || typeof item !== 'object' || (item as { type?: unknown }).type !== 'csp-violation') continue;
      const b = ((item as { body?: Record<string, unknown> }).body ?? {}) as Record<string, unknown>;
      out.push({
        directive: clip(b.effectiveDirective, 60),
        blocked: originOf(b.blockedURL),
        documentPath: pathOf(b.documentURL ?? (item as { url?: unknown }).url),
        source: sourceOf(b.sourceFile),
        disposition: clip(b.disposition || 'report', 20),
      });
    }
  }
  return out.filter((r) => r.directive);
}

cspReportRoutes.post('/api/csp-report', rateLimit(30), async (c) => {
  const raw = await c.req.text().catch(() => '');
  if (!raw || raw.length > MAX_BODY) return c.body(null, 204);

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return c.body(null, 204);
  }

  const reports = normalize(payload);
  if (reports.length === 0) return c.body(null, 204);

  const sb = getSupabaseAdmin();
  for (const r of reports) {
    console.warn('[csp]', JSON.stringify(r));
    if (!sb) continue;
    const { error } = await sb.rpc('record_csp_report', {
      p_directive: r.directive,
      p_blocked: r.blocked,
      p_document_path: r.documentPath,
      p_source: r.source,
      p_disposition: r.disposition,
    });
    if (error) console.error('[csp] record_csp_report falhou:', error.message);
  }
  return c.body(null, 204);
});
