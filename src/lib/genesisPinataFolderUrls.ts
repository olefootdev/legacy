/** Base típica do gateway Pinata público (sem barra final). */
export const DEFAULT_PINATA_IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

/**
 * Normaliza base do gateway (ex.: `https://gateway.pinata.cloud/ipfs`).
 * Aceita entrada com ou sem barra final.
 */
export function normalizeIpfsGatewayBase(raw: string | undefined): string {
  const t = (raw ?? DEFAULT_PINATA_IPFS_GATEWAY).trim().replace(/\/+$/, '');
  return t || DEFAULT_PINATA_IPFS_GATEWAY;
}

/**
 * URLs públicas do card e token quando os ficheiros estão numa pasta IPFS com este CID
 * e nomes `GEN-xxx-card.<ext>` / `GEN-xxx-token.<ext>`.
 */
export function portraitUrlsUnderFolderCid(params: {
  folderCid: string;
  playerId: string;
  ext: string;
  gatewayBase?: string;
}): { cardUrl: string; tokenUrl: string } {
  const base = normalizeIpfsGatewayBase(params.gatewayBase);
  const cid = params.folderCid.trim();
  const id = params.playerId.trim();
  const ext = params.ext.replace(/^\./, '');
  return {
    cardUrl: `${base}/${cid}/${id}-card.${ext}`,
    tokenUrl: `${base}/${cid}/${id}-token.${ext}`,
  };
}

export function pinataFolderMediaRefs(params: {
  folderCid: string;
  playerId: string;
  ext: string;
  gatewayBase?: string;
  cardUrl: string;
  tokenUrl: string;
}): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    provider: 'pinata',
    source: 'pinata_folder_cid',
    folderCid: params.folderCid.trim(),
    ext: params.ext.replace(/^\./, ''),
    gatewayBase: normalizeIpfsGatewayBase(params.gatewayBase),
    cardPublicUrl: params.cardUrl,
    tokenPublicUrl: params.tokenUrl,
    recordedAt: now,
  };
}

/**
 * Quando só `portrait_public_url` ficou preenchida (URL do card no Pinata) e token/refs estão vazios:
 * deriva o URL do token substituindo `-card.` por `-token.` e monta `portrait_media_refs` mínimo.
 * Devolve null se o URL do card não seguir esse padrão.
 */
export function repairPinataPortraitFromCardUrl(cardUrl: string): {
  tokenUrl: string;
  mediaRefs: Record<string, unknown>;
} | null {
  const u = cardUrl.trim();
  if (!u.includes('-card.')) return null;
  const tokenUrl = u.replace(/-card\./, '-token.');
  if (tokenUrl === u) return null;
  const folderCidMatch = u.match(/\/ipfs\/([^/]+)\//);
  const folderCid = folderCidMatch?.[1]?.trim() ?? '';
  const extMatch = u.match(/-card\.([a-z0-9]+)(?:\?|#|$)/i);
  const ext = extMatch?.[1] ?? 'webp';
  const now = new Date().toISOString();
  return {
    tokenUrl,
    mediaRefs: {
      provider: 'pinata',
      source: 'repair_from_card_public_url',
      ...(folderCid ? { folderCid } : {}),
      ext,
      cardPublicUrl: u,
      tokenPublicUrl: tokenUrl,
      recordedAt: now,
    },
  };
}
