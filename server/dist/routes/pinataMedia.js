import { createClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { uploadBufferToPinata } from '../services/pinata/uploadToPinata.js';
const DEFAULT_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';
function bearerFromAuthHeader(h) {
    if (!h || !h.startsWith('Bearer '))
        return null;
    const t = h.slice(7).trim();
    return t.length ? t : null;
}
/** Admin local / dev: mesmo valor que `VITE_OLEFOOT_PINATA_UPLOAD_TOKEN` no cliente (mín. 16 chars). */
const UPLOAD_TOKEN_HEADER = 'x-olefoot-pinata-upload-token';
function uploadTokenBypassOk(serverSecret, clientHeader) {
    const s = serverSecret?.trim();
    const c = clientHeader?.trim();
    if (!s || !c || s.length < 16)
        return false;
    return s === c;
}
export const pinataMediaRoutes = new Hono();
pinataMediaRoutes.post('/api/media/pinata/upload', async (c) => {
    const pinataJwt = process.env.PINATA_JWT?.trim();
    if (!pinataJwt) {
        return c.json({ ok: false, error: 'PINATA_JWT não configurado no servidor.', uploadStatus: 'error' }, 503);
    }
    const bypassSecret = process.env.OLEFOOT_PINATA_UPLOAD_TOKEN?.trim();
    const clientUploadToken = c.req.header(UPLOAD_TOKEN_HEADER);
    const usedBypass = uploadTokenBypassOk(bypassSecret, clientUploadToken);
    if (!usedBypass) {
        const supabaseUrl = process.env.SUPABASE_URL?.trim();
        const supabaseAnon = process.env.SUPABASE_ANON_KEY?.trim();
        if (!supabaseUrl || !supabaseAnon) {
            return c.json({
                ok: false,
                error: 'SUPABASE_URL + SUPABASE_ANON_KEY em falta no servidor, ou usa OLEFOOT_PINATA_UPLOAD_TOKEN + header X-Olefoot-Pinata-Upload-Token (dev).',
                uploadStatus: 'error',
            }, 503);
        }
        const accessToken = bearerFromAuthHeader(c.req.header('Authorization'));
        if (!accessToken) {
            return c.json({
                ok: false,
                error: 'Sessão Supabase em falta (faz login no app) ou define OLEFOOT_PINATA_UPLOAD_TOKEN no servidor e VITE_OLEFOOT_PINATA_UPLOAD_TOKEN no cliente para o Admin local.',
                uploadStatus: 'error',
            }, 401);
        }
        const sb = createClient(supabaseUrl, supabaseAnon, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: authErr } = await sb.auth.getUser(accessToken);
        if (authErr || !userData?.user) {
            console.warn('[pinata-upload] auth failed', authErr?.message ?? 'no user');
            return c.json({ ok: false, error: 'Sessão inválida ou expirada.', uploadStatus: 'error' }, 401);
        }
    }
    else {
        console.log('[pinata-upload] auth=upload-token (admin/dev, sem JWT Supabase)');
    }
    // Validar tamanho antes de parsear (previne DoS via uploads gigantes)
    const contentLength = Number(c.req.header('content-length') ?? 0);
    const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB
    if (contentLength > MAX_UPLOAD_SIZE) {
        return c.json({ ok: false, error: 'Arquivo muito grande (máx. 10 MB).', uploadStatus: 'error' }, 413);
    }
    let body;
    try {
        body = (await c.req.parseBody());
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : 'parseBody failed';
        console.warn('[pinata-upload] multipart parse', msg);
        return c.json({ ok: false, error: 'Corpo multipart inválido.', uploadStatus: 'error' }, 400);
    }
    const file = body.file;
    if (!file || typeof file === 'string' || !(file instanceof File)) {
        return c.json({ ok: false, error: 'Campo "file" obrigatório (ficheiro).', uploadStatus: 'error' }, 400);
    }
    const entityType = typeof body.entityType === 'string' ? body.entityType.trim() : 'unknown';
    const entityId = typeof body.entityId === 'string' ? body.entityId.trim() : undefined;
    const originalNameOverride = typeof body.originalName === 'string' ? body.originalName.trim() : '';
    const mimeOverride = typeof body.mimeType === 'string' ? body.mimeType.trim() : '';
    const originalFileName = originalNameOverride || file.name || 'upload.bin';
    const mimeType = mimeOverride || file.type || 'application/octet-stream';
    const buf = await file.arrayBuffer();
    const gatewayPrefix = (process.env.PINATA_GATEWAY_PREFIX?.trim() || DEFAULT_GATEWAY).replace(/\/?$/, '/');
    const up = await uploadBufferToPinata({
        jwt: pinataJwt,
        buffer: buf,
        filename: originalFileName,
        mimeType,
        network: 'public',
        gatewayPrefix,
        logContext: { entityType, entityId },
    });
    if (!up.ok) {
        const st = up.status;
        const status = st === 400 || st === 401 || st === 403 || st === 413 || st === 502 || st === 503 ? st : 502;
        return c.json({ ok: false, error: up.message, uploadStatus: 'error' }, status);
    }
    const media = {
        provider: 'pinata',
        cid: up.data.cid,
        publicUrl: up.publicUrl,
        originalFileName: up.data.name || originalFileName,
        mimeType: up.data.mimeType,
        sizeBytes: up.data.sizeBytes,
        uploadedAt: up.data.createdAt,
        entityType,
        entityId,
        pinataFileId: up.data.pinataFileId,
        uploadStatus: 'success',
    };
    return c.json({ ok: true, media });
});
//# sourceMappingURL=pinataMedia.js.map