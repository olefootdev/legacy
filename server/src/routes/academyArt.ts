import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { rateLimit } from '../lib/rateLimit.js';
import { uploadBufferToPinata } from '../services/pinata/uploadToPinata.js';

export const academyArtRoutes = new Hono();

/**
 * Endpoint da Freepik image-to-image (Seedream v4).
 *
 * Confirmar via dashboard Freepik se for outro nome — esse é o padrão dos
 * endpoints recentes ("text-to-image/<model>-edit" pra edição/i2i).
 *
 * Resposta esperada (sync): { data: [{ base64 }] }
 * Resposta esperada (async): { data: { task_id, status } } — implementar
 * polling em sprint futuro se Freepik mudar pra async.
 */
const FREEPIK_I2I_ENDPOINT = 'https://api.freepik.com/v1/ai/text-to-image/seedream-v4-edit';
const FREEPIK_TIMEOUT_MS = 60_000;
const COOLDOWN_MS = 30_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * CINEMATIC PROMPT — esse é o "poder comercial" do produto. Direciona o
 * Freepik Seedream pra produzir um cartão premium de nível EA Sports / FIFA
 * Ultimate Team, usando a composta como referência (rosto + camisa + fundo).
 *
 * Estrutura: setup técnico → uso da referência → estilo visual → lighting
 * → background → composição → mood → qualidade.
 */
const CINEMATIC_PROMPT_ADDENDUM = [
  '',
  '— CINEMATIC PREMIUM SPORTS CARD STYLE —',
  'Generate a photorealistic stylized digital portrait — quality of EA Sports FIFA Ultimate Team / Pro Evolution Soccer top-tier trading card.',
  '',
  'REFERENCE USAGE (CRITICAL):',
  '- Use the reference image as base composition: PRESERVE the manager\'s face from the photo, PRESERVE the jersey design and color, PRESERVE the background palette.',
  '- The subject in the reference IS the player — do NOT replace the face. Enhance it: better lighting, sharper details, pro retouching, but same identity.',
  '- Compose subject in three-quarter or front view, confident gaze, mature athletic look.',
  '',
  'LIGHTING:',
  '- Dramatic studio lighting with rim light on shoulders/hair.',
  '- Soft key light on face from front-right, deep contrast on opposite cheek.',
  '- Subtle volumetric haze for cinematic depth.',
  '',
  'COLOR & MOOD:',
  '- Match the reference jersey colors faithfully.',
  '- Background: stadium atmosphere, soft motion blur of crowd/lights, deep blacks (#0A0A0A) and accent neon yellow (#FBE100) — Olefoot brand.',
  '- Color grading: cinematic teal-and-orange undertones, premium magazine cover feel.',
  '',
  'COMPOSITION:',
  '- Subject occupies upper 60% of frame, bust + shoulders crop.',
  '- Sharp focus on eyes, gradual focus fall-off to background.',
  '- Symmetric, hero-shot framing.',
  '',
  'QUALITY:',
  '- 8K resolution feel, ultra-detailed skin texture, fabric weave on jersey, micro-expressions in eyes.',
  '- Professional retouching, no plastic look, no over-smoothing.',
  '- Output: vertical aspect 3:4 like a collectible card.',
].join('\n');

/**
 * Addendum de safety. Aplicado SEMPRE em conjunto com o cinematográfico.
 * Cobre as 4 regras do produto:
 *   1. Adulto (18+)
 *   2. Sem rosto de jogador famoso
 *   3. Sem distorção
 *   4. Sem palavrões / conteúdo NSFW
 */
const SAFETY_PROMPT_ADDENDUM = [
  '',
  '— STRICT SAFETY REQUIREMENTS (NON-NEGOTIABLE) —',
  '- Subject must appear as an adult athlete, 22-35 years old, with mature facial features. Never depict a minor.',
  '- DO NOT make the subject resemble any real famous athlete (Cristiano Ronaldo, Messi, Neymar, Pelé, Mbappé, Haaland, etc), sports celebrity, or public figure. The face must be the reference manager\'s face only.',
  '- Preserve the reference photo facial features faithfully — no distortion, no caricature, no exaggeration of proportions, no surreal warping.',
  '- No profanity, no offensive symbols, no NSFW content, no weapons, no political imagery.',
].join('\n');

/** Cooldown in-memory por user_id pra geração de arte (caro: ~10-30s + custo $). */
const userCooldown = new Map<string, number>();

async function resolveUser(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

interface FreepikI2iResponse {
  data?:
    | Array<{ base64?: string; url?: string }>
    | { task_id?: string; status?: string }
    | { generated?: Array<{ base64?: string; url?: string }> };
}

/**
 * Chama Freepik i2i. Trata tanto resposta sync (data: [...]) quanto async
 * (task_id) — pra async retorna o task_id pro caller decidir o que fazer
 * (MVP só lida com sync; async seria sprint extra).
 */
async function callFreepikI2i(opts: {
  apiKey: string;
  prompt: string;
  referenceImageBase64: string;
}): Promise<{ ok: true; imageBuffer: Buffer } | { ok: false; error: string; status?: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FREEPIK_TIMEOUT_MS);
  try {
    const r = await fetch(FREEPIK_I2I_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-freepik-api-key': opts.apiKey,
      },
      body: JSON.stringify({
        prompt: opts.prompt,
        reference_images: [opts.referenceImageBase64],
        aspect_ratio: 'square_1_1',
        num_images: 1,
      }),
      signal: controller.signal,
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      return { ok: false, error: `Freepik ${r.status}: ${body.slice(0, 300)}`, status: r.status };
    }
    const json = (await r.json()) as FreepikI2iResponse;
    const arr = Array.isArray(json.data) ? json.data : (json.data as { generated?: unknown[] } | undefined)?.generated;
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0] as { base64?: string };
      if (first.base64) {
        return { ok: true, imageBuffer: Buffer.from(first.base64, 'base64') };
      }
    }
    // Async path (task_id) ainda não suportado no MVP
    return { ok: false, error: 'Resposta Freepik sem imagem sync — endpoint pode estar em modo async.' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Freepik call failed: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST /api/academy/generate-portrait
 *
 * Pipeline atômico (do ponto de vista do cliente):
 *   1. Recebe a foto composta (selfie + camisa + fundo) do cliente
 *   2. Augmenta o adminArtPrompt com SAFETY_PROMPT_ADDENDUM
 *   3. Chama Freepik i2i passando a composta como reference
 *   4. Upload do output pro Pinata
 *   5. Devolve URL pública pro cliente dispatchar CREATE_MANAGER_PROSPECT
 *
 * Body multipart:
 *   - composed_image (File): a composição feita no canvas do cliente
 *   - prompt (string): o adminArtPrompt do passo 3 do modal
 *   - prospect_meta (string JSON, opcional): { name, pos } pra audit
 *
 * Auth: Authorization: Bearer <jwt>
 * env requerido: FREEPIK_API_KEY, PINATA_JWT
 */
academyArtRoutes.post('/api/academy/generate-portrait', rateLimit(5), async (c) => {
  const freepikKey = process.env.FREEPIK_API_KEY?.trim();
  const pinataJwt = process.env.PINATA_JWT?.trim();
  if (!freepikKey) return c.json({ ok: false, error: 'FREEPIK_API_KEY não configurada.' }, 503);
  if (!pinataJwt) return c.json({ ok: false, error: 'PINATA_JWT não configurada.' }, 503);

  const userId = await resolveUser(c.req.header('Authorization'));
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  // Cooldown por usuário (anti-spam de geração cara)
  const now = Date.now();
  const last = userCooldown.get(userId) ?? 0;
  if (now - last < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
    return c.json(
      { ok: false, error: `Aguarda ${remaining}s antes de gerar outra arte.`, cooldown_seconds: remaining },
      429,
    );
  }

  const contentLength = Number(c.req.header('content-length') ?? 0);
  if (contentLength > MAX_IMAGE_BYTES) {
    return c.json({ ok: false, error: 'Imagem muito grande (máx. 8 MB).' }, 413);
  }

  let body: Record<string, string | File>;
  try {
    body = (await c.req.parseBody()) as Record<string, string | File>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'parseBody failed';
    return c.json({ ok: false, error: `Corpo multipart inválido: ${msg}` }, 400);
  }

  const composedImage = body.composed_image;
  if (!composedImage || typeof composedImage === 'string' || !(composedImage instanceof File)) {
    return c.json({ ok: false, error: 'Campo "composed_image" obrigatório (file).' }, 400);
  }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (prompt.length < 10) {
    return c.json({ ok: false, error: 'Campo "prompt" obrigatório (mínimo 10 caracteres).' }, 400);
  }

  let prospectMeta: { name?: string; pos?: string } = {};
  if (typeof body.prospect_meta === 'string' && body.prospect_meta.trim()) {
    try {
      prospectMeta = JSON.parse(body.prospect_meta) as typeof prospectMeta;
    } catch {
      // Não bloqueia se meta vier malformada — só é usado pra log/nome
    }
  }

  // Marca cooldown ANTES de chamar Freepik (custo: 1 imagem ainda assim conta)
  userCooldown.set(userId, now);

  // Augmenta prompt: prompt original do form + cinematográfico (qualidade) +
  // safety (não-negociável). Ordem importa: safety por último pra ter peso.
  const augmentedPrompt = `${prompt}\n${CINEMATIC_PROMPT_ADDENDUM}\n${SAFETY_PROMPT_ADDENDUM}`;

  // Converte composta pra base64 pra Freepik
  const refBuffer = Buffer.from(await composedImage.arrayBuffer());
  const refBase64 = refBuffer.toString('base64');

  const generated = await callFreepikI2i({
    apiKey: freepikKey,
    prompt: augmentedPrompt,
    referenceImageBase64: refBase64,
  });
  if (!generated.ok) {
    console.error('[academy/generate-portrait] Freepik failed:', generated.error);
    return c.json({ ok: false, error: `Falha na geração: ${generated.error}` }, 502);
  }

  // Upload do resultado pro Pinata
  const filename = `academy_${userId.slice(0, 8)}_${now}.png`;
  const arrayBufferOut = generated.imageBuffer.buffer.slice(
    generated.imageBuffer.byteOffset,
    generated.imageBuffer.byteOffset + generated.imageBuffer.byteLength,
  ) as ArrayBuffer;
  const gatewayPrefix = (process.env.PINATA_GATEWAY_PREFIX?.trim() || 'https://gateway.pinata.cloud/ipfs/').replace(
    /\/?$/,
    '/',
  );
  const upload = await uploadBufferToPinata({
    jwt: pinataJwt,
    buffer: arrayBufferOut,
    filename,
    mimeType: 'image/png',
    network: 'public',
    gatewayPrefix,
    logContext: { entityType: 'academy_prospect_portrait', entityId: userId },
  });
  if (!upload.ok) {
    console.error('[academy/generate-portrait] Pinata upload failed:', upload.message);
    return c.json({ ok: false, error: `Falha no upload da imagem: ${upload.message}` }, 502);
  }

  // Audit log (best-effort, não bloqueia resposta)
  const sb = getSupabaseAdmin();
  if (sb) {
    void sb
      .from('audit_log')
      .insert({
        operation: 'CREATE',
        table_name: 'academy_prospect_portrait',
        row_id: `${userId}:${now}`,
        user_id: userId,
        new_data: {
          name: prospectMeta.name,
          pos: prospectMeta.pos,
          pinata_cid: upload.data.cid,
          portrait_url: upload.publicUrl,
        },
      })
      .then(({ error }) => {
        if (error) console.error('[academy/generate-portrait] audit log error:', error.message);
      });
  }

  return c.json({
    ok: true,
    portrait_url: upload.publicUrl,
    pinata_cid: upload.data.cid,
  });
});
