/**
 * Upload de Buffer/ArrayBuffer pra Supabase Storage.
 * Bucket privado → retorna signed URL com TTL (em segundos).
 * Bucket público → retorna URL pública direta.
 *
 * Usa service_role via getSupabaseAdmin (bypass RLS pra upload server-side).
 */
import { getSupabaseAdmin } from '../../lib/supabaseAdmin.js';

const MAX_BYTES = 8 * 1024 * 1024;

export type SupabaseStorageUploadOk = {
  bucket: string;
  path: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
};

export async function uploadToSupabaseStorage(input: {
  buffer: ArrayBuffer;
  filename: string;
  mimeType: string;
  bucket: string;
  /** Subpasta opcional dentro do bucket. Default: raiz. */
  pathPrefix?: string;
  /** Pra buckets privados: TTL do signed URL em segundos. Default 7 dias. */
  signedUrlTtlSeconds?: number;
  /** Marca como upsert pra permitir reupload no mesmo path. */
  upsert?: boolean;
}): Promise<
  | { ok: true; data: SupabaseStorageUploadOk }
  | { ok: false; message: string; status?: number }
> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, message: 'Supabase admin não configurado.' };

  const { buffer, filename, mimeType, bucket, pathPrefix, signedUrlTtlSeconds = 7 * 24 * 3600, upsert = false } = input;

  if (buffer.byteLength > MAX_BYTES) {
    return { ok: false, message: `Ficheiro demasiado grande (máx. ${MAX_BYTES / 1024 / 1024} MB).` };
  }
  if (!mimeType.startsWith('image/')) {
    return { ok: false, message: 'Apenas imagens são aceites.' };
  }

  const cleanPrefix = (pathPrefix ?? '').trim().replace(/^\/+|\/+$/g, '');
  const path = cleanPrefix ? `${cleanPrefix}/${filename}` : filename;

  const { error: uploadError } = await sb.storage.from(bucket).upload(path, buffer, {
    contentType: mimeType,
    upsert,
    cacheControl: '3600',
  });

  if (uploadError) {
    console.error('[supabaseStorage] upload failed', { bucket, path, message: uploadError.message });
    return { ok: false, message: `Supabase Storage rejeitou: ${uploadError.message}` };
  }

  // Tenta URL pública (bucket público). Se for privado, gera signed URL.
  const publicData = sb.storage.from(bucket).getPublicUrl(path);
  const publicUrl = publicData.data.publicUrl;

  let finalUrl = publicUrl;
  // Bucket privado → publicUrl ainda existe mas dá 400. Geramos signed URL.
  const isLikelyPrivate = bucket.includes('privat') || bucket.includes('selfie');
  if (isLikelyPrivate) {
    const { data: signed, error: signedErr } = await sb.storage.from(bucket).createSignedUrl(path, signedUrlTtlSeconds);
    if (signedErr || !signed?.signedUrl) {
      console.error('[supabaseStorage] signed URL failed', signedErr?.message);
      return { ok: false, message: `Falha ao gerar signed URL: ${signedErr?.message ?? 'desconhecido'}` };
    }
    finalUrl = signed.signedUrl;
  }

  return {
    ok: true,
    data: {
      bucket,
      path,
      url: finalUrl,
      mimeType,
      sizeBytes: buffer.byteLength,
    },
  };
}

/**
 * Deleta um objeto do bucket. Usado quando admin "Launch" o jogador — não
 * precisamos mais da selfie depois disso. Erros são logados mas não bloqueiam.
 */
export async function deleteFromSupabaseStorage(bucket: string, path: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: 'Supabase admin não configurado.' };
  const { error } = await sb.storage.from(bucket).remove([path]);
  if (error) {
    console.error('[supabaseStorage] delete failed', { bucket, path, message: error.message });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
