/**
 * Upload binário para Pinata Files API v3 (multipart).
 * Alinhado a: https://docs.pinata.cloud/files/uploading-files
 * Referência OpenAPI: https://docs.pinata.cloud/api-reference/endpoint/upload-a-file
 */
const PINATA_UPLOAD_URL = 'https://uploads.pinata.cloud/v3/files';
const MAX_BYTES = 8 * 1024 * 1024;
function gatewayUrlForCid(cid, gatewayPrefix) {
    const base = gatewayPrefix.replace(/\/+$/, '');
    return `${base}/${cid}`;
}
export async function uploadBufferToPinata(input) {
    const { jwt, buffer, filename, mimeType, network = 'public', gatewayPrefix, logContext } = input;
    if (buffer.byteLength > MAX_BYTES) {
        console.warn('[pinata-upload] reject: file too large', buffer.byteLength, logContext);
        return { ok: false, message: 'Ficheiro demasiado grande (máx. 8 MB).' };
    }
    if (!mimeType.startsWith('image/')) {
        return { ok: false, message: 'Apenas imagens são aceites.' };
    }
    const form = new FormData();
    form.set('file', new Blob([buffer], { type: mimeType }), filename);
    form.set('network', network);
    // Nome visível no Pinata (opcional na doc; ajuda na pesquisa no dashboard)
    form.set('name', filename);
    const et = logContext.entityType?.trim();
    const eid = logContext.entityId?.trim();
    if (et || eid) {
        form.set('keyvalues', JSON.stringify({
            keyvalues: {
                ...(et ? { olefoot_entity_type: et } : {}),
                ...(eid ? { olefoot_entity_id: eid } : {}),
            },
        }));
    }
    let res;
    try {
        res = await fetch(PINATA_UPLOAD_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${jwt}` },
            body: form,
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[pinata-upload] fetch error', msg, logContext);
        return { ok: false, message: 'Falha de rede ao contactar Pinata.' };
    }
    const rawText = await res.text();
    let json = null;
    try {
        json = JSON.parse(rawText);
    }
    catch {
        json = null;
    }
    if (!res.ok) {
        const apiMsg = json?.error?.message ?? rawText.slice(0, 200);
        console.warn('[pinata-upload] HTTP', res.status, logContext, apiMsg);
        return {
            ok: false,
            message: res.status === 401 || res.status === 403 ? 'Pinata recusou credenciais.' : 'Pinata rejeitou o upload.',
            status: res.status,
        };
    }
    const row = json?.data;
    const cid = row?.cid?.trim();
    const id = row?.id?.trim();
    if (!row || !cid || !id) {
        console.error('[pinata-upload] missing cid/id in response', logContext, rawText.slice(0, 300));
        return { ok: false, message: 'Resposta Pinata inválida.' };
    }
    const publicUrl = gatewayUrlForCid(cid, gatewayPrefix);
    const sizeBytes = typeof row.size === 'number' && Number.isFinite(row.size) ? Math.round(row.size) : buffer.byteLength;
    const createdAt = typeof row.created_at === 'string' && row.created_at.trim()
        ? row.created_at.trim()
        : new Date().toISOString();
    console.log('[pinata-upload] ok', {
        ...logContext,
        bytes: sizeBytes,
        cid: cid.slice(0, 12) + '…',
    });
    return {
        ok: true,
        publicUrl,
        data: {
            cid,
            pinataFileId: id,
            name: typeof row.name === 'string' && row.name.trim() ? row.name : filename,
            mimeType: typeof row.mime_type === 'string' && row.mime_type.trim() ? row.mime_type : mimeType,
            sizeBytes,
            createdAt,
        },
    };
}
//# sourceMappingURL=uploadToPinata.js.map