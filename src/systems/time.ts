/** 1 hora real ↔ 10 minutos no mundo do jogo */
export const REAL_MS_PER_GAME_MINUTE = (60 * 60 * 1000) / 10;

export function gameMinutesFromRealMs(elapsedMs: number): number {
  return elapsedMs / REAL_MS_PER_GAME_MINUTE;
}
