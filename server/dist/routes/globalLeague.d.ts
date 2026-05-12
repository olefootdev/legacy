/**
 * Rotas da liga global — proxy read-only para as tabelas relacionais.
 *
 * A Edge Function global-league-tick é autoritativa. Este server apenas
 * expõe endpoints de leitura para clientes que não têm acesso direto ao
 * Supabase (ex: integrações externas, admin CLI).
 *
 * A tabela admin_global_league_snapshot foi descontinuada — não é escrita
 * pela Edge Function e não reflete o estado real da liga.
 */
import { Hono } from 'hono';
export declare const globalLeagueRoutes: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
