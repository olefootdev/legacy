import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import { getSupabase } from '@/supabase/client';
import type { HostedMediaDescriptor, PinataUploadApiResponse } from '@/media/hostedMediaTypes';

export type PinataUploadMeta = {
  entityType: string;
  entityId?: string;
  /** Nome sugerido no Pinata (ex.: GEN-001-card.webp) */
  originalName?: string;
  mimeType?: string;
};

export type PinataUploadResult =
  | { ok: true; media: HostedMediaDescriptor }
  | { ok: false; error: string };

/**
 * Envia uma imagem para o Pinata via olefoot-server (JWT Pinata só no servidor).
 * Autenticação: (1) sessão Supabase `Bearer` ou (2) token partilhado `X-Olefoot-Pinata-Upload-Token` quando
 * `VITE_OLEFOOT_PINATA_UPLOAD_TOKEN` + `OLEFOOT_PINATA_UPLOAD_TOKEN` no servidor (útil no /admin sem login).
 */
export async function uploadImageToPinataViaServer(
  file: File | Blob,
  meta: PinataUploadMeta,
): Promise<PinataUploadResult> {
  const sb = getSupabase();
  const devUploadToken = (import.meta.env.VITE_OLEFOOT_PINATA_UPLOAD_TOKEN as string | undefined)?.trim();

  let authHeaders: Record<string, string> = {};
  if (sb) {
    const { data: sessionData, error: sessionErr } = await sb.auth.getSession();
    const jwt = sessionData.session?.access_token;
    if (jwt && !sessionErr) {
      authHeaders = { Authorization: `Bearer ${jwt}` };
    }
  }
  if (!authHeaders.Authorization && devUploadToken && devUploadToken.length >= 16) {
    authHeaders = { 'X-Olefoot-Pinata-Upload-Token': devUploadToken };
  }
  if (!authHeaders.Authorization && !authHeaders['X-Olefoot-Pinata-Upload-Token']) {
    console.warn('[pinataUploadClient] sem Bearer Supabase nem VITE_OLEFOOT_PINATA_UPLOAD_TOKEN');
    return {
      ok: false,
      error:
        'Faz login no OLEFOOT (sessão Supabase) ou, para Admin local, define o mesmo segredo em VITE_OLEFOOT_PINATA_UPLOAD_TOKEN (.env raiz) e OLEFOOT_PINATA_UPLOAD_TOKEN (server/.env).',
    };
  }

  const fd = new FormData();
  const asFile =
    file instanceof File
      ? file
      : new File([file], meta.originalName ?? 'upload.bin', {
          type: meta.mimeType ?? (file.type || 'application/octet-stream'),
        });
  fd.set('file', asFile);
  fd.set('entityType', meta.entityType);
  if (meta.entityId) fd.set('entityId', meta.entityId);
  if (meta.originalName) fd.set('originalName', meta.originalName);
  if (meta.mimeType) fd.set('mimeType', meta.mimeType);

  const base = olefootApiBase();
  let res: Response;
  try {
    res = await fetch(`${base}/api/media/pinata/upload`, {
      method: 'POST',
      headers: authHeaders,
      body: fd,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[pinataUploadClient] fetch', msg);
    return { ok: false, error: 'Sem ligação ao olefoot-server (URL ou rede).' };
  }

  let json: PinataUploadApiResponse | null = null;
  try {
    json = (await res.json()) as PinataUploadApiResponse;
  } catch {
    json = null;
  }

  if (!json) {
    return { ok: false, error: `Resposta inválida do servidor (HTTP ${res.status}).` };
  }
  if (json.ok === false) {
    return { ok: false, error: json.error || `HTTP ${res.status}` };
  }
  return { ok: true, media: json.media };
}
