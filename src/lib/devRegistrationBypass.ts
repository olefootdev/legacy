/**
 * Em `vite dev`, o jogo abre sem passar pelo cadastro (útil para testes locais).
 * Para builds (`vite build` + preview) ou produção, defina `VITE_SKIP_REGISTRATION=true` no `.env`.
 */
export function isDevRegistrationBypassed(): boolean {
  return import.meta.env.DEV === true || import.meta.env.VITE_SKIP_REGISTRATION === 'true';
}
