/** Chave YYYY-MM-DD para reset diário. */
export function getDailyResetKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Chave ano-semana ISO (aprox.) para reset semanal. */
export function getWeeklyResetKey(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
