/**
 * OLEFOOT — Voice Command Routes
 *
 * Endpoints:
 *   POST /api/voice/transcribe — Whisper fallback para transcrição
 *   POST /api/voice/parse-intent — LLM fallback para parsing de intent
 */

import { Hono } from 'hono';
import OpenAI from 'openai';

const voice = new Hono();

// Inicializa OpenAI apenas se a chave estiver configurada
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
    const audio = formData.get('audio') as File | null;

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
  } catch (err) {
    console.error('[voice] Whisper transcription error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: 'Transcription failed', detail: message }, 500);
  }
});

// ─── LLM Intent Parser ──────────────────────────────────────────────────────

/**
 * POST /api/voice/parse-intent
 *
 * Fallback quando parser determinístico falha. Usa GPT-4o-mini para extrair
 * intents estruturados de frases naturais.
 *
 * Body: {
 *   transcript: string,
 *   context: {
 *     players: Array<{ name: string, num?: number, role?: string }>,
 *     ballCarrier?: string
 *   }
 * }
 *
 * Response: {
 *   commands: Array<{ intent: string, target: string, targetType: string }>
 * }
 */
voice.post('/parse-intent', async (c) => {
  if (!openai) {
    return c.json({ error: 'OPENAI_API_KEY not configured' }, 503);
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
      .map((p: { name: string; num?: number; role?: string }) =>
        `${p.name}${p.num ? ` (#${p.num})` : ''}${p.role ? ` [${p.role}]` : ''}`
      )
      .join(', ');

    const prompt = `Você é um parser de comandos de voz para um jogo de futebol.
Traduza a frase do usuário em comandos estruturados.

INTENTS DISPONÍVEIS (principais):
- invade_box: invadir a área, ir pra área, atacar a área
- dribble_attempt: driblar, passar por ele, encarar
- take_shot: chutar, finalizar, bater pro gol, mandar bala
- cross_ball: cruzar, levantar a bola
- pass_to_player: passar pro [jogador], tocar pro [jogador]
- hold_ball: segurar a bola, ficar com a bola
- quick_pass: toque rápido, tocar rápido
- switch_play: trocar de lado, inverter
- mark_player: marcar o [adversário], colar no [adversário]
- block_advance: segurar ele, fechar o cara
- aggressive_tackle: entrar duro, dividir forte
- tactical_foul: fazer falta, parar com falta
- team_press_high: pressionar alto, marcação alta, pressão alta
- team_retreat: recuar, voltar pra defesa, todos atrás
- team_hold_possession: matar o jogo, segurar o jogo, posse segura
- team_high_line: subir o time, linha alta
- forwards_press_defenders: atacantes pressionam, ataque pressiona
- midfielders_compact: meias fecham o meio, meio compacto
- laterals_cross: laterais cruzam mais
- left_back_overlap: sobe o lateral esquerdo
- break_line: quebrar a linha, furar a linha
- break_zone: quebrar a zona, sair da zona
- run_behind: correr pelas costas, por trás do marcador
- pedal_to_metal: pisar no acelerador, acelerar, forçar
- free_play: se vira, joga livre
- wait_support: espera a chegada, aguarda o apoio
- stretch_team: esticar o time
- hold_small_area: vai pra pequena e segura
- spare_player: poupar o [jogador]
- calm_team: acalmar o time, respirar, calma
- player_substitution: sai [jogador] entra [jogador], substituir [jogador] por [jogador]
- formation_change: mudar pra [formação], trocar pra [formação]

TARGET TYPES:
- player_name: nome do jogador específico
- ball_carrier: o jogador com a bola
- role: atacantes, meias, zagueiros, goleiro
- team: time todo
- shirt_number: número da camisa

CONTEXTO DA PARTIDA:
Jogadores em campo: ${playersList}
Portador da bola: ${context.ballCarrier ?? 'nenhum'}

FRASE DO USUÁRIO:
"${transcript}"

REGRAS:
1. Se a frase mencionar um jogador pelo nome, use target_type: "player_name"
2. Se for comando genérico sem alvo, use "ball_carrier" ou "team"
3. Se mencionar posição (atacantes, meias), use "role"
4. Retorne APENAS comandos que você tem CERTEZA que o usuário quis dizer
5. Se a frase for ambígua ou não reconhecida, retorne array vazio

RESPONDA APENAS COM JSON (sem markdown, sem explicação):
{
  "commands": [
    { "intent": "take_shot", "target": "ball_carrier", "targetType": "ball_carrier" }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 500,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return c.json({ error: 'Empty response from LLM' }, 500);
    }

    const parsed = JSON.parse(content);

    // Validação básica
    if (!parsed.commands || !Array.isArray(parsed.commands)) {
      return c.json({ error: 'Invalid LLM response format' }, 500);
    }

    return c.json(parsed);
  } catch (err) {
    console.error('[voice] LLM intent parsing error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: 'Intent parsing failed', detail: message }, 500);
  }
});

export const voiceRoutes = voice;
