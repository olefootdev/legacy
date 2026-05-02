/**
 * Controller para tick de partida Quick Match (server-side anti-cheat).
 *
 * STUB: a implementação original importava lógica do GameSpirit do /src do
 * front, que não está disponível no container do Railway (root_dir=server
 * exclui o resto do repo). Front tem fallback local — ao receber 501, ele
 * roda o tick em runtime no cliente.
 *
 * Para reativar o anti-cheat server-side: portar GameSpirit/buildSpiritContext
 * para uma pasta compartilhada (ex: /shared/gamespirit) acessível tanto pelo
 * front quanto pelo server, OU mover o tick inteiro para Edge Function
 * Supabase (mesmo padrão do global-league-tick).
 */
import type { Context } from 'hono';
export declare function postMatchTick(c: Context): Promise<Response & import("hono").TypedResponse<{
    ok: false;
    error: string;
    message: string;
}, 501, "json">>;
