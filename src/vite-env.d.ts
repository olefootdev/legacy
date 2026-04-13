/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Se `true`, ignora o fluxo de cadastro (mesmo fora de `vite dev`). Útil para testar preview/produção local. */
  readonly VITE_SKIP_REGISTRATION?: string;
  /** `1` / `true`: em partida rápida e TESTE 2D, não exige 11+5 no plantel (além do que já é relaxado em `vite dev`). */
  readonly VITE_RELAX_SQUAD_FOR_TEST?: string;
}

/** Definido em `vite.config.ts` — indica se `API_FOOTBALL_KEY` ou `VITE_API_FOOTBALL_KEY` existem no `.env` (build-time). */
declare const __OLEFOOT_API_FOOTBALL_KEY_SET__: boolean;
