/**
 * OLEFOOT — Voice Command Routes
 *
 * Endpoints:
 *   POST /api/voice/transcribe — Whisper fallback para transcrição
 *   POST /api/voice/parse-intent — Claude fallback para parsing de intent
 */
import { Hono } from 'hono';
export declare const voiceRoutes: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
