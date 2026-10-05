import type { CardCollection, PlayerEntity } from '@/entities/types';
import { L } from '@/i18n/L';

/** Soma `cardSupply` de todos os jogadores na coleção (opcionalmente exclui um id ao regravar a mesma carta). */
export function totalMintedInCollection(
  players: Record<string, PlayerEntity>,
  collectionId: string,
  excludePlayerId?: string,
): number {
  let sum = 0;
  for (const [id, p] of Object.entries(players)) {
    if (excludePlayerId && id === excludePlayerId) continue;
    if (p.collectionId !== collectionId) continue;
    const n = p.cardSupply;
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) sum += Math.floor(n);
  }
  return sum;
}

export function remainingCollectionSupply(
  collection: CardCollection,
  players: Record<string, PlayerEntity>,
  excludePlayerId?: string,
): number {
  const used = totalMintedInCollection(players, collection.id, excludePlayerId);
  return Math.max(0, collection.maxSupply - used);
}

export function canMintCardSupply(args: {
  collection: CardCollection;
  players: Record<string, PlayerEntity>;
  requestedSupply: number;
  excludePlayerId?: string;
}): { ok: true } | { ok: false; reason: string } {
  const q = Math.floor(args.requestedSupply);
  if (!Number.isFinite(q) || q < 1) {
    return { ok: false, reason: L('Fornecimento da carta tem de ser um inteiro ≥ 1.', 'Card supply must be an integer ≥ 1.') };
  }
  if (args.collection.maxSupply < 1) {
    return { ok: false, reason: L('maxSupply da coleção tem de ser ≥ 1.', 'Collection maxSupply must be ≥ 1.') };
  }
  const rem = remainingCollectionSupply(args.collection, args.players, args.excludePlayerId);
  if (q > rem) {
    return {
      ok: false,
      reason: L(`Só cabem ${rem} unidade(s) nesta coleção (max ${args.collection.maxSupply}, já mintadas ${args.collection.maxSupply - rem}).`, `Only ${rem} unit(s) fit in this collection (max ${args.collection.maxSupply}, already minted ${args.collection.maxSupply - rem}).`),
    };
  }
  return { ok: true };
}

export function newCollectionId(): string {
  return `col-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
