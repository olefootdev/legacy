/** Retrato estável para partida rápida (mesmo padrão que Team.tsx / picsum). */
export function quickMatchPortraitSrc(seed: string, w = 128, h?: number): string {
  const hh = h ?? w;
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${hh}`;
}
