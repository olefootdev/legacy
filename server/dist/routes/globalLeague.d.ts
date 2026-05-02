/**
 * Rotas da liga global — scheduler server-side.
 * O servidor é a fonte de verdade para rodadas automáticas.
 * Admin controla via painel, servidor executa.
 */
import { Hono } from 'hono';
export declare const globalLeagueRoutes: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
