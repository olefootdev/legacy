/**
 * Poder do Clube — evolução do TIME por mérito na Liga Global.
 *
 * Espelho EXATO da Edge `global-league-tick` (`clubPowerModifier`): quem JOGA
 * mais + VENCE mais soma OVR efetivo, até +12. NÃO mexe no OVR dos jogadores
 * (Genesis segue capado) — é o clube que cresce. Use pra UI mostrar o ganho.
 */
export const CLUB_POWER_CAP = 12;

export function clubPowerOvr(allTimeMatchesPlayed: number, allTimeWins: number): number {
  const fromMatches = Math.floor(Math.max(0, allTimeMatchesPlayed) / 150); // joga mais
  const fromWins = Math.floor(Math.max(0, allTimeWins) / 60);              // vence mais
  return Math.min(CLUB_POWER_CAP, fromMatches + fromWins);
}
