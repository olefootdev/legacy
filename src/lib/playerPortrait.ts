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
