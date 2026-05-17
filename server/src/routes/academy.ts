import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { rateLimit } from '../lib/rateLimit.js';

export const academyRoutes = new Hono();

/** OVR máximo na criação — espelha MANAGER_PROSPECT_CREATE_MAX_OVR do cliente. */
const MAX_CREATE_OVR = 70;
/** Cooldown por usuário entre criações (em ms). */
const COOLDOWN_MS = 30_000;
/** Mínimo de caracteres do nome (espelha cliente). */
const MIN_NAME_LEN = 2;
/** Mínimo de caracteres do originText do heritage (espelha cliente). */
const MIN_ORIGIN_TEXT_LEN = 8;
/** Posições válidas (subset de PlayerPosition do cliente). */
const VALID_POSITIONS = new Set(['GOL', 'ZAG', 'LE', 'LD', 'VOL', 'MC', 'MEI', 'PE', 'PD', 'ATA']);
/** Tiers de contrato aceitos (espelha MANAGER_PROSPECT_CONTRACT_GAMES). */
const VALID_CONTRACT_TIERS = new Set([10, 70, 150, 250]);
/** Regiões de heritage aceitas (espelha ManagerProspectPortraitStyleRegion). */
const VALID_HERITAGE_REGIONS = new Set([
  'europa',
  'africa_subsariana',
  'americas_sul',
  'americas_outras',
  'mena',
  'asia',
  'oceania',
]);

/**
 * Cooldown in-memory por user_id. Resetado em restart do server — aceitável
 * pra MVP. Migração futura pra DB se precisar persistir entre deploys.
 */
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

interface CreateAcademyBody {
  name?: string;
  pos?: string;
  overall?: number;
  contract_tier?: number;
  heritage?: {
    portraitStyleRegion?: string;
    originText?: string;
    originTags?: unknown;
  };
}

/**
 * POST /api/academy/create
 *
 * Valida server-side a criação de um prospect da Academia OLE antes do
 * cliente dispatchar CREATE_MANAGER_PROSPECT. Cobre P3 (validação) e P4
 * (cooldown) do audit.
 *
 * Não cria o player no plantel — isso continua client-side via reducer.
 * Apenas valida payload, aplica cooldown por usuário, e loga em audit_log.
 *
 * EXP balance NÃO é validado aqui (finance é local-only no game state).
 * Cap de 5 slots TAMBÉM é client-side (no reducer). Esse endpoint é uma
 * camada extra contra console exploits e abuso de rate.
 *
 * Body: { name, pos, overall, contract_tier, heritage: { portraitStyleRegion, originText, originTags } }
 * Auth: Authorization: Bearer <jwt>
 */
academyRoutes.post('/api/academy/create', rateLimit(10), async (c) => {
  const userId = await resolveUser(c.req.header('Authorization'));
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  // 1) Cooldown por usuário (anti-spam)
  const now = Date.now();
  const last = userCooldown.get(userId) ?? 0;
  if (now - last < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
    return c.json(
      { ok: false, error: `Aguarda ${remaining}s antes de criar outro prospect.`, cooldown_seconds: remaining },
      429,
    );
  }

  // 2) Validação de payload
  const body = await c.req.json<CreateAcademyBody>().catch(() => ({} as CreateAcademyBody));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < MIN_NAME_LEN) {
    return c.json({ ok: false, error: 'Nome inválido (mínimo 2 caracteres).' }, 400);
  }
  if (!body.pos || !VALID_POSITIONS.has(String(body.pos).toUpperCase())) {
    return c.json({ ok: false, error: 'Posição inválida.' }, 400);
  }
  if (typeof body.overall !== 'number' || !Number.isFinite(body.overall)) {
    return c.json({ ok: false, error: 'OVR inválido.' }, 400);
  }
  if (body.overall > MAX_CREATE_OVR) {
    return c.json({ ok: false, error: `OVR de criação máximo é ${MAX_CREATE_OVR}.` }, 400);
  }
  if (body.overall < 0) {
    return c.json({ ok: false, error: 'OVR inválido.' }, 400);
  }
  if (typeof body.contract_tier !== 'number' || !VALID_CONTRACT_TIERS.has(body.contract_tier)) {
    return c.json({ ok: false, error: 'Tier de contrato inválido (10 / 70 / 150 / 250).' }, 400);
  }
  const heritage = body.heritage;
  if (!heritage || typeof heritage !== 'object') {
    return c.json({ ok: false, error: 'Heritage obrigatório.' }, 400);
  }
  if (!heritage.portraitStyleRegion || !VALID_HERITAGE_REGIONS.has(String(heritage.portraitStyleRegion))) {
    return c.json({ ok: false, error: 'Região de heritage inválida.' }, 400);
  }
  const originText = typeof heritage.originText === 'string' ? heritage.originText.trim() : '';
  if (originText.length < MIN_ORIGIN_TEXT_LEN) {
    return c.json({ ok: false, error: `Origem precisa de pelo menos ${MIN_ORIGIN_TEXT_LEN} caracteres.` }, 400);
  }

  // 3) Marca cooldown ANTES de logar (em caso de falha de DB, ainda protegemos contra spam)
  userCooldown.set(userId, now);

  // 4) Audit log (best-effort, não bloqueia resposta)
  const sb = getSupabaseAdmin();
  if (sb) {
    void sb
      .from('audit_log')
      .insert({
        operation: 'CREATE',
        table_name: 'academy_prospect',
        row_id: `${userId}:${now}`,
        user_id: userId,
        new_data: {
          name,
          pos: String(body.pos).toUpperCase(),
          overall: Math.round(body.overall),
          contract_tier: body.contract_tier,
          heritage_region: heritage.portraitStyleRegion,
        },
      })
      .then(({ error }) => {
        if (error) console.error('[academy/create] audit log error:', error.message);
      });
  }

  return c.json({ ok: true });
});
