import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { rateLimit } from '../lib/rateLimit.js';
import { uploadBufferToPinata } from '../services/pinata/uploadToPinata.js';

export const academyArtRoutes = new Hono();

/**
 * Freepik Seedream v4 edit (image-to-image multi-reference).
 *
 * Padrão ASYNC: POST devolve { data: { task_id, status: 'CREATED' } }.
 * Cliente polla GET /v1/ai/text-to-image/seedream-v4-edit/{task_id} até
 * status='COMPLETED' ou timeout.
 */
const FREEPIK_BASE = 'https://api.freepik.com/v1/ai/text-to-image';
const FREEPIK_MODEL_PATH = 'seedream-v4-edit';
const FREEPIK_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 2_500;
const COOLDOWN_MS = 30_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MIN_PROMPT_LEN = 10;

/**
 * PROMPT do entregável.
 * Estrutura tripla: roles dos 3 references → o que fazer → entregável.
 * Cada bloco é explícito porque Seedream responde melhor a instruções
 * estruturadas que a parágrafos.
 */
function buildFreepikPrompt(originalFormPrompt: string): string {
  return [
    '— TASK BRIEF —',
    'You will receive 3 reference images:',
    '  1. SELFIE — the manager\'s face. PRESERVE this face identity exactly. Do not invent a different face. Do not resemble any real famous athlete.',
    '  2. JERSEY — the official Olefoot football shirt the player must be wearing. PRESERVE the jersey colors, logo, and stripe design exactly.',
    '  3. BACKGROUND — the atmospheric backdrop for the card. PRESERVE the visual style and color palette.',
    '',
    '— WHAT TO GENERATE —',
    'A cinematic premium football trading card — EA Sports FIFA Ultimate Team quality.',
    'Compose: the manager from reference #1, wearing the jersey from reference #2, against the background style from reference #3.',
    'Bust + shoulders crop, three-quarter view or front facing, confident gaze, mature adult athlete (22-35 yo).',
    'Photorealistic stylized digital painting / 3D render hybrid.',
    'Dramatic studio lighting: rim light on shoulders, soft key light on face, deep contrast shadows.',
    'Sharp focus on eyes, gradual fall-off to background.',
    'Color grading: cinematic teal-orange, neon yellow (#FBE100) and deep black (#0A0A0A) accents.',
    '',
    '— DELIVERABLE —',
    'Single image. Vertical 3:4 aspect ratio. Ultra-detailed, 8K resolution feel.',
    'Sharp skin texture, fabric weave on jersey, micro-expressions in eyes.',
    'No text overlays. No additional logos beyond what\'s in the jersey reference.',
    'Subject must look like an ADULT (never a minor). Faithful facial features (no distortion, no caricature).',
    'Clean professional sports magazine cover quality.',
    '',
    '— EXTRA CONTEXT FROM FORM —',
    originalFormPrompt,
  ].join('\n');
}

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

interface FreepikTaskResponse {
  data?: {
    task_id?: string;
    status?: 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | string;
    generated?: string[]; // URLs ou base64 quando COMPLETED
  };
  error?: { message?: string };
}

/**
 * POST + polling no Freepik. Aceita 3 reference images.
 * Devolve Buffer da imagem final ou erro descritivo.
 */
async function callFreepikSeedream(opts: {
  apiKey: string;
  prompt: string;
  referenceImagesBase64: string[]; // [selfie, jersey, background]
}): Promise<{ ok: true; imageBuffer: Buffer } | { ok: false; error: string; status?: number }> {
  const postUrl = `${FREEPIK_BASE}/${FREEPIK_MODEL_PATH}`;
  const startedAt = Date.now();

  // 1) POST inicial → task_id
  let taskId: string;
  try {
    const r = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-freepik-api-key': opts.apiKey,
      },
      body: JSON.stringify({
        prompt: opts.prompt,
        reference_images: opts.referenceImagesBase64,
        aspect_ratio: 'portrait_3_4',
        num_images: 1,
      }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      return { ok: false, error: `Freepik POST ${r.status}: ${body.slice(0, 300)}`, status: r.status };
    }
    const json = (await r.json()) as FreepikTaskResponse;
    const tid = json.data?.task_id;
    if (!tid) {
      return { ok: false, error: 'Freepik POST sem task_id. Endpoint pode estar errado.' };
    }
    taskId = tid;
  } catch (e) {
    return { ok: false, error: `Freepik POST falhou: ${e instanceof Error ? e.message : String(e)}` };
  }

  // 2) Poll GET até COMPLETED, FAILED ou timeout
  const getUrl = `${postUrl}/${taskId}`;
  while (Date.now() - startedAt < FREEPIK_TIMEOUT_MS) {
    await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
    try {
      const r = await fetch(getUrl, {
        headers: { 'x-freepik-api-key': opts.apiKey },
      });
      if (!r.ok) {
        const body = await r.text().catch(() => '');
        return { ok: false, error: `Freepik GET ${r.status}: ${body.slice(0, 200)}`, status: r.status };
      }
      const json = (await r.json()) as FreepikTaskResponse;
      const status = json.data?.status;
      if (status === 'COMPLETED') {
        const generated = json.data?.generated;
        if (!generated || generated.length === 0) {
          return { ok: false, error: 'Freepik COMPLETED mas sem imagem em `generated`.' };
        }
        const first = generated[0];
        // generated[0] pode ser URL https ou base64 — testar
        if (first.startsWith('http')) {
          try {
            const imgRes = await fetch(first);
            if (!imgRes.ok) {
              return { ok: false, error: `Falha ao baixar imagem do Freepik: ${imgRes.status}` };
            }
            const buf = Buffer.from(await imgRes.arrayBuffer());
            return { ok: true, imageBuffer: buf };
          } catch (e) {
            return { ok: false, error: `Falha ao baixar imagem: ${e instanceof Error ? e.message : String(e)}` };
          }
        }
        // base64
        return { ok: true, imageBuffer: Buffer.from(first, 'base64') };
      }
      if (status === 'FAILED') {
        return { ok: false, error: `Freepik task FAILED: ${json.error?.message ?? 'sem detalhes'}` };
      }
      // CREATED / IN_PROGRESS — continua polling
    } catch (e) {
      // Erros de rede em poll: tenta de novo até timeout
      console.warn('[academy/generate-portrait] poll error (retrying):', e instanceof Error ? e.message : String(e));
    }
  }

  return { ok: false, error: `Timeout (${FREEPIK_TIMEOUT_MS / 1000}s) esperando Freepik gerar arte.` };
}

/**
 * POST /api/academy/generate-portrait
 *
 * Multipart com 3 imagens separadas. Server combina como reference_images
 * pro Freepik Seedream v4 edit (multi-reference i2i). Async polling.
 * Output vai pro Pinata.
 *
 * Body multipart:
 *   - selfie_image     (File)   — face do manager
 *   - jersey_image     (File)   — camisa OLE de referência
 *   - background_image (File)   — fundo do card de referência
 *   - prompt           (string) — buildProspectAdminArtPrompt do form
 *   - prospect_meta    (string JSON opcional)
 *
 * Auth: Bearer Supabase. env: FREEPIK_API_KEY, PINATA_JWT.
 */
/**
 * POST /api/academy/upload-selfie
 *
 * Modo CONCIERGE — só faz upload da selfie do manager no Pinata. NÃO chama
 * Freepik. A arte final é gerada manualmente pelo admin (qualidade premium
 * curada) e uploadeada via AdminProspectArtPanel.
 *
 * Mais leve que /generate-portrait: 1 file, sem polling, sem custo Freepik.
 * Trade-off: latência humana (admin) em vez de IA instantânea.
 *
 * Body multipart:
 *   - selfie_image  (File)   — face do manager
 *   - prospect_meta (string JSON opcional) — { name, pos } pra audit
 *
 * Auth: Bearer Supabase. env: PINATA_JWT.
 */
academyArtRoutes.post('/api/academy/upload-selfie', rateLimit(10), async (c) => {
  const pinataJwt = process.env.PINATA_JWT?.trim();
  if (!pinataJwt) return c.json({ ok: false, error: 'PINATA_JWT não configurada.' }, 503);

  const userId = await resolveUser(c.req.header('Authorization'));
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const now = Date.now();

  let body: Record<string, string | File>;
  try {
    body = (await c.req.parseBody()) as Record<string, string | File>;
  } catch (e) {
    return c.json({ ok: false, error: `Corpo multipart inválido: ${e instanceof Error ? e.message : ''}` }, 400);
  }

  const selfie = body.selfie_image;
  if (!(selfie instanceof File)) return c.json({ ok: false, error: 'selfie_image obrigatório.' }, 400);
  if (selfie.size > MAX_IMAGE_BYTES) {
    return c.json({ ok: false, error: `selfie muito grande (${Math.round(selfie.size / 1024)} KB, máx. ${MAX_IMAGE_BYTES / 1024 / 1024} MB).` }, 413);
  }

  let prospectMeta: { name?: string; pos?: string } = {};
  if (typeof body.prospect_meta === 'string' && body.prospect_meta.trim()) {
    try { prospectMeta = JSON.parse(body.prospect_meta) as typeof prospectMeta; } catch { /* ignore */ }
  }

  const filename = `academy_selfie_${userId.slice(0, 8)}_${now}.jpg`;
  const ab = await selfie.arrayBuffer();
  const gatewayPrefix = (process.env.PINATA_GATEWAY_PREFIX?.trim() || 'https://gateway.pinata.cloud/ipfs/').replace(/\/?$/, '/');
  const upload = await uploadBufferToPinata({
    jwt: pinataJwt,
    buffer: ab,
    filename,
    mimeType: selfie.type || 'image/jpeg',
    network: 'public',
    gatewayPrefix,
    logContext: { entityType: 'academy_prospect_selfie', entityId: userId },
  });
  if (!upload.ok) {
    console.error('[academy/upload-selfie] Pinata upload failed:', upload.message);
    return c.json({ ok: false, error: `Falha no upload: ${upload.message}` }, 502);
  }

  // Audit log
  const sb = getSupabaseAdmin();
  if (sb) {
    void sb.from('audit_log').insert({
      operation: 'CREATE',
      table_name: 'academy_prospect_selfie',
      row_id: `${userId}:${now}`,
      user_id: userId,
      new_data: {
        name: prospectMeta.name,
        pos: prospectMeta.pos,
        pinata_cid: upload.data.cid,
        selfie_url: upload.publicUrl,
      },
    }).then(({ error }) => {
      if (error) console.error('[academy/upload-selfie] audit log error:', error.message);
    });
  }

  return c.json({
    ok: true,
    selfie_url: upload.publicUrl,
    pinata_cid: upload.data.cid,
  });
});

academyArtRoutes.post('/api/academy/generate-portrait', rateLimit(5), async (c) => {
  const freepikKey = process.env.FREEPIK_API_KEY?.trim();
  const pinataJwt = process.env.PINATA_JWT?.trim();
  if (!freepikKey) return c.json({ ok: false, error: 'FREEPIK_API_KEY não configurada.' }, 503);
  if (!pinataJwt) return c.json({ ok: false, error: 'PINATA_JWT não configurada.' }, 503);

  const userId = await resolveUser(c.req.header('Authorization'));
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const now = Date.now();
  const last = userCooldown.get(userId) ?? 0;
  if (now - last < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
    return c.json(
      { ok: false, error: `Aguarda ${remaining}s antes de gerar outra arte.`, cooldown_seconds: remaining },
      429,
    );
  }

  let body: Record<string, string | File>;
  try {
    body = (await c.req.parseBody()) as Record<string, string | File>;
  } catch (e) {
    return c.json({ ok: false, error: `Corpo multipart inválido: ${e instanceof Error ? e.message : ''}` }, 400);
  }

  const selfie = body.selfie_image;
  const jersey = body.jersey_image;
  const background = body.background_image;
  if (!(selfie instanceof File)) return c.json({ ok: false, error: 'selfie_image obrigatório.' }, 400);
  if (!(jersey instanceof File)) return c.json({ ok: false, error: 'jersey_image obrigatório.' }, 400);
  if (!(background instanceof File)) return c.json({ ok: false, error: 'background_image obrigatório.' }, 400);
  for (const [name, f] of [['selfie', selfie], ['jersey', jersey], ['background', background]] as const) {
    if (f.size > MAX_IMAGE_BYTES) {
      return c.json({ ok: false, error: `${name} muito grande (${Math.round(f.size / 1024)} KB, máx. ${MAX_IMAGE_BYTES / 1024 / 1024} MB).` }, 413);
    }
  }

  const formPrompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (formPrompt.length < MIN_PROMPT_LEN) {
    return c.json({ ok: false, error: 'Campo "prompt" obrigatório (>= 10 chars).' }, 400);
  }

  let prospectMeta: { name?: string; pos?: string } = {};
  if (typeof body.prospect_meta === 'string' && body.prospect_meta.trim()) {
    try { prospectMeta = JSON.parse(body.prospect_meta) as typeof prospectMeta; } catch { /* ignore */ }
  }

  // Marca cooldown ANTES de gerar (custo $ acontece mesmo se falhar)
  userCooldown.set(userId, now);

  // Converte os 3 files pra base64
  const [selfieB64, jerseyB64, bgB64] = await Promise.all([
    selfie.arrayBuffer().then((b) => Buffer.from(b).toString('base64')),
    jersey.arrayBuffer().then((b) => Buffer.from(b).toString('base64')),
    background.arrayBuffer().then((b) => Buffer.from(b).toString('base64')),
  ]);

  const fullPrompt = buildFreepikPrompt(formPrompt);

  const generated = await callFreepikSeedream({
    apiKey: freepikKey,
    prompt: fullPrompt,
    referenceImagesBase64: [selfieB64, jerseyB64, bgB64],
  });
  if (!generated.ok) {
    console.error('[academy/generate-portrait] Freepik failed:', generated.error);
    return c.json({ ok: false, error: `Falha na geração: ${generated.error}`, detail: generated.error }, 502);
  }

  // Upload Pinata
  const filename = `academy_${userId.slice(0, 8)}_${now}.png`;
  const ab = generated.imageBuffer.buffer.slice(
    generated.imageBuffer.byteOffset,
    generated.imageBuffer.byteOffset + generated.imageBuffer.byteLength,
  ) as ArrayBuffer;
  const gatewayPrefix = (process.env.PINATA_GATEWAY_PREFIX?.trim() || 'https://gateway.pinata.cloud/ipfs/').replace(/\/?$/, '/');
  const upload = await uploadBufferToPinata({
    jwt: pinataJwt,
    buffer: ab,
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

  // Audit (best-effort)
  const sb = getSupabaseAdmin();
  if (sb) {
    void sb.from('audit_log').insert({
      operation: 'CREATE',
      table_name: 'academy_prospect_portrait',
      row_id: `${userId}:${now}`,
      user_id: userId,
      new_data: {
        name: prospectMeta.name,
        pos: prospectMeta.pos,
        pinata_cid: upload.data.cid,
        portrait_url: upload.publicUrl,
        freepik_endpoint: FREEPIK_MODEL_PATH,
      },
    }).then(({ error }) => {
      if (error) console.error('[academy/generate-portrait] audit log error:', error.message);
    });
  }

  return c.json({
    ok: true,
    portrait_url: upload.publicUrl,
    pinata_cid: upload.data.cid,
  });
});

/**
 * POST /api/academy/upload-admin-image
 *
 * Upload genérico pelo admin do PNG/JPG final da arte do jogador.
 * Usado no AdminProspectArtPanel quando o admin gerou a arte em ferramenta
 * externa (Freepik web, Midjourney, etc) e quer só hospedar pra colar URL.
 *
 * Body multipart:
 *   - image       (File)   — PNG/JPG da arte final
 *   - kind        (string) — 'portrait' | 'promo' (só pra naming/audit)
 *   - request_id  (string opcional) — managerProspectArtQueue[].id pra audit
 *
 * Auth: Bearer Supabase. env: PINATA_JWT.
 */
academyArtRoutes.post('/api/academy/upload-admin-image', rateLimit(20), async (c) => {
  const pinataJwt = process.env.PINATA_JWT?.trim();
  if (!pinataJwt) return c.json({ ok: false, error: 'PINATA_JWT não configurada.' }, 503);

  const userId = await resolveUser(c.req.header('Authorization'));
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const now = Date.now();

  let body: Record<string, string | File>;
  try {
    body = (await c.req.parseBody()) as Record<string, string | File>;
  } catch (e) {
    return c.json({ ok: false, error: `Corpo multipart inválido: ${e instanceof Error ? e.message : ''}` }, 400);
  }

  const image = body.image;
  if (!(image instanceof File)) return c.json({ ok: false, error: 'image obrigatório.' }, 400);
  if (image.size > MAX_IMAGE_BYTES) {
    return c.json({ ok: false, error: `imagem muito grande (${Math.round(image.size / 1024)} KB, máx. ${MAX_IMAGE_BYTES / 1024 / 1024} MB).` }, 413);
  }

  const kindRaw = typeof body.kind === 'string' ? body.kind.trim().toLowerCase() : '';
  const kind: 'portrait' | 'promo' = kindRaw === 'promo' ? 'promo' : 'portrait';
  const requestId = typeof body.request_id === 'string' ? body.request_id.trim() : '';

  const ext = (image.type === 'image/png' ? 'png' : 'jpg');
  const filename = `academy_admin_${kind}_${userId.slice(0, 8)}_${now}.${ext}`;
  const ab = await image.arrayBuffer();
  const gatewayPrefix = (process.env.PINATA_GATEWAY_PREFIX?.trim() || 'https://gateway.pinata.cloud/ipfs/').replace(/\/?$/, '/');
  const upload = await uploadBufferToPinata({
    jwt: pinataJwt,
    buffer: ab,
    filename,
    mimeType: image.type || 'image/jpeg',
    network: 'public',
    gatewayPrefix,
    logContext: { entityType: `academy_admin_${kind}`, entityId: requestId || userId },
  });
  if (!upload.ok) {
    console.error('[academy/upload-admin-image] Pinata upload failed:', upload.message);
    return c.json({ ok: false, error: `Falha no upload: ${upload.message}` }, 502);
  }

  const sb = getSupabaseAdmin();
  if (sb) {
    void sb.from('audit_log').insert({
      operation: 'CREATE',
      table_name: `academy_admin_${kind}`,
      row_id: `${userId}:${now}`,
      user_id: userId,
      new_data: {
        kind,
        request_id: requestId || null,
        pinata_cid: upload.data.cid,
        url: upload.publicUrl,
      },
    }).then(({ error }) => {
      if (error) console.error('[academy/upload-admin-image] audit log error:', error.message);
    });
  }

  return c.json({
    ok: true,
    url: upload.publicUrl,
    pinata_cid: upload.data.cid,
    kind,
  });
});
