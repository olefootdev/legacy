import { Hono } from 'hono';
/** Mantém o mesmo contrato que `src/media/hostedMediaTypes.ts` (ok + media). */
export type HostedMediaDescriptor = {
    provider: 'pinata';
    cid: string;
    publicUrl: string;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: string;
    entityType: string;
    entityId?: string;
    pinataFileId: string;
    uploadStatus: 'success' | 'error';
    errorMessage?: string;
};
export type PinataUploadApiResponse = {
    ok: true;
    media: HostedMediaDescriptor;
} | {
    ok: false;
    error: string;
    uploadStatus?: 'error';
};
export declare const pinataMediaRoutes: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
