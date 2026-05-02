/**
 * Rota do assistente IA — processa perguntas usando knowledge base do código.
 * Sistema de busca local sem dependência de APIs externas.
 */
import { Hono } from 'hono';
export declare const assistantRoutes: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
