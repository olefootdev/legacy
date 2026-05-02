/**
 * Upload binário para Pinata Files API v3 (multipart).
 * Alinhado a: https://docs.pinata.cloud/files/uploading-files
 * Referência OpenAPI: https://docs.pinata.cloud/api-reference/endpoint/upload-a-file
 */
export type PinataNetwork = 'public' | 'private';
export type PinataUploadOk = {
    cid: string;
    pinataFileId: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
};
export declare function uploadBufferToPinata(input: {
    jwt: string;
    buffer: ArrayBuffer;
    filename: string;
    mimeType: string;
    network?: PinataNetwork;
    gatewayPrefix: string;
    logContext: {
        entityType?: string;
        entityId?: string;
    };
}): Promise<{
    ok: true;
    data: PinataUploadOk;
    publicUrl: string;
} | {
    ok: false;
    message: string;
    status?: number;
}>;
