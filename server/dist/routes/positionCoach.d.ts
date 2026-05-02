/**
 * Agentes de posição com DNA de lenda.
 * Chamados APENAS durante sessões de treino (entre partidas).
 * Zero tokens durante a partida — o resultado é persistido no jogador.
 */
import { Hono } from 'hono';
export declare const positionCoachRoutes: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
