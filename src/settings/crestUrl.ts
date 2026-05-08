/**
 * Resolve o caminho local do brasão de um clube/seleção.
 *
 * Os PNGs vivem em `public/crests/{id}.png` e são populados rodando
 * `npm run crests:download` (script em `scripts/download-crests.mjs`).
 * Os IDs seguem a numeração do API-Sports.
 */
export function localCrestUrl(id: number): string {
  return `/crests/${id}.png`;
}
