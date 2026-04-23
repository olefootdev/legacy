import type { PlayerEntity } from '@/entities/types';

/** Retrato do jogador: foto definida no Admin ou fallback picsum por nome. */
export function playerPortraitSrc(
  player: Pick<PlayerEntity, 'name' | 'portraitUrl'>,
  w: number,
  h: number,
): string {
  if (player.portraitUrl?.trim()) return player.portraitUrl.trim();
  return `https://picsum.photos/seed/${encodeURIComponent(player.name)}/${w}/${h}`;
}

/** Token circular: prioriza crop circular dedicado, fallback para card portrait. */
export function playerTokenSrc(
  player: Pick<PlayerEntity, 'name' | 'portraitUrl' | 'portraitTokenUrl'>,
  size: number,
): string {
  if (player.portraitTokenUrl?.trim()) return player.portraitTokenUrl.trim();
  return playerPortraitSrc(player, size, size);
}
