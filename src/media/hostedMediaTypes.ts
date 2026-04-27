/**
 * Contrato de resposta do upload via olefoot-server → Pinata.
 * Manter alinhado com `server/src/routes/pinataMedia.ts`.
 */

export type HostedMediaProvider = 'pinata';

export type HostedMediaUploadStatus = 'success' | 'error';

export interface HostedMediaDescriptor {
  provider: HostedMediaProvider;
  cid: string;
  publicUrl: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  entityType: string;
  entityId?: string;
  pinataFileId: string;
  uploadStatus: HostedMediaUploadStatus;
  errorMessage?: string;
}

export type PinataUploadApiResponse =
  | { ok: true; media: HostedMediaDescriptor }
  | { ok: false; error: string; uploadStatus?: 'error' };

/** Variante persistida em `portrait_media_refs` (Genesis). */
export interface HostedMediaStoredVariant {
  cid: string;
  publicUrl: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  pinataFileId: string;
  status: HostedMediaUploadStatus;
  errorMessage?: string;
}

export interface GenesisPortraitMediaRefs {
  provider: 'pinata';
  entityType: string;
  entityId: string;
  uploadedAt: string;
  card: HostedMediaStoredVariant;
  token: HostedMediaStoredVariant;
}

export function hostedMediaDescriptorToStoredVariant(m: HostedMediaDescriptor): HostedMediaStoredVariant {
  return {
    cid: m.cid,
    publicUrl: m.publicUrl,
    originalFileName: m.originalFileName,
    mimeType: m.mimeType,
    sizeBytes: m.sizeBytes,
    uploadedAt: m.uploadedAt,
    pinataFileId: m.pinataFileId,
    status: m.uploadStatus,
    ...(m.errorMessage ? { errorMessage: m.errorMessage } : {}),
  };
}
