/**
 * POST /api/classic/coach-reading
 *
 * Análise tática inteligente para o modo CLASSIC. NÃO é chat — é uma
 * leitura proativa que aparece quando o Coach AI tem algo relevante a
 * dizer (manager toca no botão pra ver, ou ignora).
 *
 * Recebe snapshot da partida (placar, posse, fadigas críticas, último
 * evento, mentalidade ativa) e retorna 3 partes:
 *   - headline   (Moret italic — manchete editorial)
 *   - reading    (Inter — 1 frase descrevendo o estado atual)
 *   - suggestion (Agency uppercase — comando de ação curto)
 *
 * Usa Claude Haiku 4.5 — rápido (~700ms) e barato (~$0.0003 / leitura).
 */
import { Hono } from 'hono';
export declare const classicCoachRoutes: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
