/** Ano de época (API `season`) — início da época no hemisfério europeu. */
export function apiFootballSeasonYear(): number {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  return m >= 6 ? y : y - 1;
}
