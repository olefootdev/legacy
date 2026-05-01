/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Se `true`, ignora o fluxo de cadastro (mesmo fora de `vite dev`). Útil para testar preview/produção local. */
  readonly VITE_SKIP_REGISTRATION?: string;
  /** `1` / `true`: em partida rápida e TESTE 2D, não exige 11+5 no plantel (além do que já é relaxado em `vite dev`). */
  readonly VITE_RELAX_SQUAD_FOR_TEST?: string;
}

declare module '@whisper/web' {
  export class Whisper {
    constructor(opts: { model: string; language?: string });
    load(): Promise<void>;
    transcribe(audio: ArrayBuffer | Float32Array): Promise<{ text: string }>;
  }
}
