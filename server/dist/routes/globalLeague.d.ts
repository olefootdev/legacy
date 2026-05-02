/**
 * Rotas da liga global — scheduler server-side.
 * Usa tabela admin_global_league_snapshot (JSONB) separada da
 * tabela global_league_state (schema relacional existente).
 */
import { Hono } from 'hono';
export declare const globalLeagueRoutes: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
