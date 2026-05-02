/**
 * OLEFOOT — Voice Command Routes
 *
 * Endpoints:
 *   POST /api/voice/transcribe — Whisper fallback para transcrição
 *   POST /api/voice/parse-intent — Claude fallback para parsing de intent
 */
import { Hono } from 'hono';
import OpenAI from 'openai';
import { callAnthropic, hasAnthropicKey, jsonSystemPrompt } from '../lib/anthropic.js';
const voice = new Hono();
// OpenAI apenas para Whisper (transcrição de áudio)
const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;
// ─── Whisper Transcription ─────────────────────────────────────────────────
/**
 * POST /api/voice/transcribe
 *
 * Fallback quando Web Speech API falha ou não é suportado (Firefox, offline).
 * Recebe audio blob (webm/ogg/mp3), retorna transcript + confidence.
 *
 * Body: multipart/form-data
 *   - audio: File (webm/ogg/mp3, max 25MB)
 *
 * Response: { transcript: string, confidence: number }
 */
voice.post('/transcribe', async (c) => {
    if (!openai) {
        return c.json({ error: 'OPENAI_API_KEY not configured' }, 503);
    }
    try {
        const formData = await c.req.formData();
        const audio = formData.get('audio');
        if (!audio) {
            return c.json({ error: 'Missing audio file' }, 400);
        }
        // Whisper aceita até 25MB
        if (audio.size > 25 * 1024 * 1024) {
            return c.json({ error: 'Audio file too large (max 25MB)' }, 400);
        }
        const transcription = await openai.audio.transcriptions.create({
            file: audio,
            model: 'whisper-1',
            language: 'pt',
            response_format: 'json',
            prompt: 'Comando de futebol: chuta, passa, pressiona, recua, invade, cruza, marca, dribla',
        });
        return c.json({
            transcript: transcription.text,
            confidence: 0.95, // Whisper não retorna confidence, usar fixo alto
        });
    }
    catch (err) {
        console.error('[voice] Whisper transcription error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return c.json({ error: 'Transcription failed', detail: message }, 500);
    }
});
// ─── Claude Intent Parser ──────────────────────────────────────────────────
/**
 * POST /api/voice/parse-intent
 *
 * Fallback semântico quando o parser determinístico falha.
 * Usa Claude Haiku para interpretar frases naturais de futebol em pt-BR.
 *
 * Body: {
 *   transcript: string,
 *   context: {
 *     players: Array<{ name: string, num?: number, role?: string }>,
 *     ballCarrier?: string,
 *     minute?: number,
 *     homeScore?: number,
 *     awayScore?: number
 *   }
 * }
 *
 * Response: {
 *   commands: Array<{ intent: string, target: string, targetType: string }>,
 *   narrative: string  // o que o Claude entendeu, para feedback na UI
 * }
 */
voice.post('/parse-intent', async (c) => {
    if (!hasAnthropicKey()) {
        return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 503);
    }
    try {
        const body = await c.req.json();
        const { transcript, context } = body;
        if (!transcript || typeof transcript !== 'string') {
            return c.json({ error: 'Missing or invalid transcript' }, 400);
        }
        if (!context || !Array.isArray(context.players)) {
            return c.json({ error: 'Missing or invalid context' }, 400);
        }
        const playersList = context.players
            .map((p) => `${p.name}${p.num ? ` (#${p.num})` : ''}${p.role ? ` [${p.role}]` : ''}`)
            .join(', ');
        const scoreCtx = (context.homeScore !== undefined && context.awayScore !== undefined)
            ? `Placar: ${context.homeScore}×${context.awayScore}` : '';
        const minuteCtx = context.minute !== undefined ? `Minuto: ${context.minute}'` : '';
        const system = jsonSystemPrompt(`Você é o intérprete de comandos de voz do Olefoot, um jogo de futebol brasileiro.
Seu trabalho é entender o que o manager está tentando dizer ao time — mesmo que ele use gírias, expressões coloquiais ou frases incompletas — e traduzir para um comando estruturado.

Pense como um assistente técnico que ouve o treinador na beira do campo e repassa ao time.
"abre mais o jogo" = stretch_team
"vai pra cima" = team_press_high ou invade_box dependendo do contexto
"manda o lateral subir" = left_back_overlap
"toca e corre" = quick_pass
"segura o resultado" = team_hold_possession
"vai com tudo" = pedal_to_metal

INTENTS DISPONÍVEIS:
invade_box, dribble_attempt, take_shot, cross_ball, pass_to_player, hold_ball, quick_pass,
switch_play, mark_player, block_advance, aggressive_tackle, tactical_foul,
team_press_high, team_retreat, team_hold_possession, team_high_line,
forwards_press_defenders, midfielders_compact, laterals_cross, left_back_overlap,
break_line, break_zone, run_behind, pedal_to_metal, free_play, wait_support,
stretch_team, hold_small_area, spare_player, calm_team, player_substitution, formation_change

TARGET TYPES: player_name, ball_carrier, role, team, shirt_number`, `{"commands":[{"intent":"string","target":"string","targetType":"string"}],"narrative":"string"}`);
        const user = `Jogadores em campo: ${playersList}
Portador da bola: ${context.ballCarrier ?? 'nenhum'}
${minuteCtx} ${scoreCtx}

Comando do manager: "${transcript}"

Interprete o comando. Se mencionar jogador pelo nome, use targetType "player_name".
Se for coletivo, use "team". Se mencionar posição (atacantes, meias), use "role".
Em "narrative", escreva em 1 frase curta o que você entendeu (ex: "Esticar o time para abrir espaços").
Se não conseguir interpretar com confiança, retorne commands vazio.`;
        const result = await callAnthropic({
            model: 'haiku',
            system,
            user,
            maxTokens: 300,
            temperature: 0.2,
            expectJson: true,
            timeoutMs: 5000,
        });
        if (!result.ok || !result.json) {
            return c.json({ error: result.error ?? 'Claude parse failed', commands: [] }, 500);
        }
        const parsed = result.json;
        if (!Array.isArray(parsed.commands)) {
            return c.json({ error: 'Invalid response format', commands: [] }, 500);
        }
        return c.json(parsed);
    }
    catch (err) {
        console.error('[voice] Claude intent parsing error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return c.json({ error: 'Intent parsing failed', detail: message, commands: [] }, 500);
    }
});
export const voiceRoutes = voice;
//# sourceMappingURL=voice.js.map