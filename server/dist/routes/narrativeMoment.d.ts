/**
 * DEPRECATED — endpoint mantido como stub.
 *
 * A narração de momentos-chave foi movida pro catálogo offline gerado via
 * Anthropic Haiku em batch (ver `src/gamespirit/narrativeCatalog.ts` e a
 * tabela Supabase `narrative_templates`). O cliente agora chama
 * `fetchKeyMomentNarration()` que usa o catálogo localmente — zero I/O de
 * rede por beat.
 *
 * Esta rota é mantida retornando 410 Gone pra avisar callers antigos
 * durante o deploy gradual. Remover após confirmar que nenhum cliente ainda
 * bate aqui.
 */
import { Hono } from 'hono';
export declare const narrativeMomentRoutes: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
