import type { UserSettings } from '@/game/types';
import { localCrestUrl } from './crestUrl';

/**
 * Escudo ao lado do "teu" clube em matchday, ligas e partida rápida:
 * usa o logo do time do coração cadastrado.
 *
 * Sempre prefere o caminho local `/crests/{id}.png` sobre o `.logo` salvo
 * em userSettings — assim cadastros antigos (que salvaram URLs do
 * api-sports.io e batem em 403 por hotlink-block) também funcionam sem
 * precisar reescolher o time.
 *
 * Se não houver time cadastrado, alterna entre Corinthians e Manchester
 * City (apenas para visualização durante desenvolvimento).
 */
export function matchdayHomeCrestUrl(
  settings: Pick<UserSettings, 'favoriteRealTeam'>,
): string | null {
  const team = settings.favoriteRealTeam;
  if (team?.id) return localCrestUrl(team.id);
  const heart = team?.logo?.trim();
  if (heart) return heart;

  // Fallback de visualização — Corinthians (131) e Manchester City (50).
  const testCrests = [localCrestUrl(131), localCrestUrl(50)];
  const index = Math.floor(Date.now() / 10000) % testCrests.length;
  return testCrests[index];
}
