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
export const narrativeMomentRoutes = new Hono();
narrativeMomentRoutes.post('/api/narrative/key-moment', (c) => {
    return c.json({
        ok: false,
        error: 'Endpoint deprecated. Use o catálogo offline em src/gamespirit/narrativeCatalog.ts',
        migratedTo: 'client-side narrative catalog',
    }, 410);
});
//# sourceMappingURL=narrativeMoment.js.map