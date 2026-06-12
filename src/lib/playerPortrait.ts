import type { PlayerEntity } from '@/entities/types';

/**
 * Convenção pra legacy players: o card colecionável que aparece no market
 * é `<slug>-olefoot.png` ou variantes; já a foto que vai pro plantel é
 * `<slug>-profile.png`. Reescreve a URL automaticamente para que, depois
 * de comprado, o jogador apareça com a foto de plantel (não a arte do card).
 * Também trata legacies antigos comprados com URLs de token deletadas.
 */
function rewriteLegacyToSquadPortrait(url: string): string {
  // <slug>-olefoot.png → <slug>-profile.png
  if (/-olefoot\.png$/i.test(url)) return url.replace(/-olefoot\.png$/i, '-profile.png');
  // <slug>-token(-fase)?.png → <slug>-profile.png (corrige buys antigos)
  if (/-token(-[a-z]+)?\.png$/i.test(url)) return url.replace(/-token(-[a-z]+)?\.png$/i, '-profile.png');
  return url;
}

/**
 * Nome de exibição: para legacies comprados quando ainda usávamos o nome longo
 * (`José Carlos "Juca" de Andrade — Consolidação`), extrai só o apelido entre aspas.
 * Para o resto, devolve o nome cru.
 */
export function playerDisplayName(
  player: Pick<PlayerEntity, 'name'> & Partial<Pick<PlayerEntity, 'id'>>,
): string {
  const raw = player.name?.trim() ?? '';
  if (!raw) return raw;
  const isLegacy = typeof player.id === 'string' && player.id.startsWith('legacy-');
  if (!isLegacy) return raw;
  const nickMatch = raw.match(/"([^"]+)"/);
  if (nickMatch) return nickMatch[1];
  return raw.split(' — ')[0];
}

/** Retrato do jogador: foto definida no Admin ou fallback picsum por nome. */
export function playerPortraitSrc(
  player: Pick<PlayerEntity, 'name' | 'portraitUrl'> & Partial<Pick<PlayerEntity, 'id'>>,
  w: number,
  h: number,
): string {
  const raw = player.portraitUrl?.trim();
  if (raw) {
    const isLegacy = typeof player.id === 'string' && player.id.startsWith('legacy-');
    return isLegacy ? rewriteLegacyToSquadPortrait(raw) : raw;
  }
  return `https://picsum.photos/seed/${encodeURIComponent(player.name)}/${w}/${h}`;
}

/** Token circular: prioriza crop circular dedicado, fallback para card portrait. */
export function playerTokenSrc(
  player: Pick<PlayerEntity, 'name' | 'portraitUrl' | 'portraitTokenUrl'> & Partial<Pick<PlayerEntity, 'id'>>,
  size: number,
): string {
  if (player.portraitTokenUrl?.trim()) return player.portraitTokenUrl.trim();
  return playerPortraitSrc(player, size, size);
}
