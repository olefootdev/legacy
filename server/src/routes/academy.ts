import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { rateLimit } from '../lib/rateLimit.js';
import { researchLegendTemplate, type Attributes } from '../services/anthropic/legendResearch.js';

export const academyRoutes = new Hono();

/** OVR máximo na criação — espelha MANAGER_PROSPECT_CREATE_MAX_OVR do cliente. */
const MAX_CREATE_OVR = 60;
/**
 * Gate de criação: só cria quem tem ≥N indicados ATIVOS (já jogaram e geraram
 * EXP: profiles.exp_lifetime_earned > 0). Decisão do fundador 2026-06-17 —
 * filtra demanda do card manual + vira motor de indicação. Ver memória
 * project-player-creation-gacha.
 */
const MIN_ACTIVE_REFERRALS_TO_CREATE = 5;
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

/**
 * Conta indicados ATIVOS do usuário (já jogaram → exp_lifetime_earned > 0).
 * Service-role: não depende de auth.uid() (isso é a RPC count_my_active_referrals
 * do frontend). Retorna 0 se não tiver código ou em qualquer falha (fail-closed).
 */
async function countActiveReferrals(userId: string): Promise<number> {
  const sb = getSupabaseAdmin();
  if (!sb) return 0;
  const { data: prof, error: profErr } = await sb
    .from('profiles')
    .select('my_referral_code')
    .eq('id', userId)
    .maybeSingle();
  if (profErr || !prof?.my_referral_code) return 0;
  const { count, error } = await sb
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('referred_by_code', prof.my_referral_code)
    .gt('exp_lifetime_earned', 0);
  if (error) return 0;
  return count ?? 0;
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

  // 0) Gate: ≥5 indicados ativos (já jogaram). Enforcement real é aqui;
  //    o cliente também checa, mas o servidor é a fonte da verdade.
  const activeReferrals = await countActiveReferrals(userId);
  if (activeReferrals < MIN_ACTIVE_REFERRALS_TO_CREATE) {
    return c.json(
      {
        ok: false,
        error: `Precisas de ${MIN_ACTIVE_REFERRALS_TO_CREATE} indicados ativos (que já jogaram) pra criar um jogador. Tens ${activeReferrals}.`,
        active_referrals: activeReferrals,
        required: MIN_ACTIVE_REFERRALS_TO_CREATE,
        code: 'REFERRAL_GATE',
      },
      403,
    );
  }

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

// ─── Sorteio de craque (gacha de época) ──────────────────────────────────────

interface DrawConfigRow {
  rarity_tier: string;
  probability_pct: number;
  ovr_floor: number;
  ovr_ceiling: number;
  sort_order: number;
}

/** Rola uma raridade pelas probabilidades do config (server-side, anti-trapaça). */
function rollRarity(config: DrawConfigRow[]): DrawConfigRow {
  const total = config.reduce((s, r) => s + Number(r.probability_pct), 0) || 1;
  let roll = Math.random() * total;
  for (const row of config) {
    roll -= Number(row.probability_pct);
    if (roll <= 0) return row;
  }
  return config[config.length - 1]!;
}

/**
 * POST /api/academy/draw
 *
 * Coração do novo sistema de criação: manager escolhe posição + ano, o servidor
 * rola a raridade e um agente pesquisa um craque real do calibre, derivando os
 * 10 atributos pela metodologia Olefoot. Resultado cacheado em attribute_templates
 * (banco que cresce) e logado em academy_draws (1 por manager, sem re-roll).
 *
 * Body: { pos: string, year: number }
 * Auth: Authorization: Bearer <jwt>
 */
academyRoutes.post('/api/academy/draw', rateLimit(6), async (c) => {
  const userId = await resolveUser(c.req.header('Authorization'));
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);

  // 1) Gate ≥5 indicados ativos
  const activeReferrals = await countActiveReferrals(userId);
  if (activeReferrals < MIN_ACTIVE_REFERRALS_TO_CREATE) {
    return c.json(
      {
        ok: false,
        error: `Precisas de ${MIN_ACTIVE_REFERRALS_TO_CREATE} indicados ativos (que já jogaram) pra criar um jogador. Tens ${activeReferrals}.`,
        active_referrals: activeReferrals,
        required: MIN_ACTIVE_REFERRALS_TO_CREATE,
        code: 'REFERRAL_GATE',
      },
      403,
    );
  }

  // 2) Sorteio único — sem re-roll (decisão do fundador)
  const { data: existing } = await sb
    .from('academy_draws')
    .select('id, player_name, rolled_tier, position, year, status')
    .eq('user_id', userId)
    .neq('status', 'discarded')
    .maybeSingle();
  if (existing) {
    return c.json(
      { ok: false, error: 'Já fizeste o teu sorteio — é único por manager.', code: 'ALREADY_DREW', draw: existing },
      409,
    );
  }

  // 3) Valida entrada
  const body = await c.req.json<{ pos?: string; year?: number }>().catch(() => ({} as { pos?: string; year?: number }));
  const pos = String(body.pos ?? '').toUpperCase();
  if (!VALID_POSITIONS.has(pos)) return c.json({ ok: false, error: 'Posição inválida.' }, 400);
  const year = Math.round(Number(body.year));
  if (!Number.isFinite(year) || year < 1950 || year > 2100) {
    return c.json({ ok: false, error: 'Ano inválido (1950–2100).' }, 400);
  }

  // 4) Carrega config + rola raridade
  const { data: configRows, error: cfgErr } = await sb
    .from('academy_draw_config')
    .select('*')
    .order('sort_order', { ascending: true });
  if (cfgErr || !configRows?.length) {
    return c.json({ ok: false, error: 'Config de sorteio ausente.' }, 503);
  }
  const tierRow = rollRarity(configRows as DrawConfigRow[]);
  const tier = tierRow.rarity_tier;

  // 5) Cache: reusa template existente (pos, ano, tier) — selado primeiro
  let templateId: string | null = null;
  let playerName = '';
  let attributes: Attributes | null = null;
  let overall = 0;
  let bio = '';
  let sources: string[] = [];

  const { data: cached } = await sb
    .from('attribute_templates')
    .select('id, player_name, attributes, overall, bio_snippet, sources, status')
    .eq('position', pos)
    .eq('year', year)
    .eq('rarity_tier', tier)
    .order('status', { ascending: false }) // 'sealed' > 'draft'
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached) {
    templateId = cached.id;
    playerName = cached.player_name;
    attributes = cached.attributes as Attributes;
    overall = cached.overall;
    bio = cached.bio_snippet ?? '';
    sources = Array.isArray(cached.sources) ? (cached.sources as string[]) : [];
  } else {
    // 6) Cache miss → pesquisa
    const research = await researchLegendTemplate({
      position: pos,
      year,
      rarityTier: tier,
      ovrFloor: tierRow.ovr_floor,
      ovrCeiling: tierRow.ovr_ceiling,
    });
    if (!research.ok) {
      return c.json({ ok: false, error: `Pesquisa falhou: ${research.error}` }, 502);
    }
    const t = research.template;
    playerName = t.playerName;
    attributes = t.attributes;
    overall = t.overall;
    bio = t.bioSnippet;
    sources = t.sources;

    const { data: inserted, error: insErr } = await sb
      .from('attribute_templates')
      .upsert(
        {
          player_slug: t.playerSlug,
          player_name: t.playerName,
          year,
          position: pos,
          rarity_tier: tier,
          attributes: t.attributes,
          overall: t.overall,
          bio_snippet: t.bioSnippet,
          sources: t.sources,
          methodology_ver: t.methodologyVer,
          status: 'draft',
        },
        { onConflict: 'player_slug,year' },
      )
      .select('id')
      .maybeSingle();
    if (insErr) {
      console.error('[academy/draw] insert template error:', insErr.message);
    } else {
      templateId = inserted?.id ?? null;
    }
  }

  // 7) Loga o sorteio (unique index garante 1 por manager)
  const { error: drawErr } = await sb.from('academy_draws').insert({
    user_id: userId,
    position: pos,
    year,
    rolled_tier: tier,
    template_id: templateId,
    player_name: playerName,
    status: 'revealed',
  });
  if (drawErr) {
    // Corrida: alguém já sorteou entre o check e o insert.
    return c.json({ ok: false, error: 'Já fizeste o teu sorteio.', code: 'ALREADY_DREW' }, 409);
  }

  return c.json({
    ok: true,
    rarity: tier,
    position: pos,
    year,
    player_name: playerName,
    overall,
    attributes,
    bio,
    sources,
  });
});

/**
 * POST /api/academy/confirm-draw
 * Marca o sorteio do usuário como confirmado (após criar o player no cliente).
 * Best-effort: não bloqueia nada se falhar.
 */
academyRoutes.post('/api/academy/confirm-draw', rateLimit(10), async (c) => {
  const userId = await resolveUser(c.req.header('Authorization'));
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401);
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);
  const { error } = await sb
    .from('academy_draws')
    .update({ status: 'confirmed' })
    .eq('user_id', userId)
    .eq('status', 'revealed');
  if (error) {
    console.error('[academy/confirm-draw] update error:', error.message);
    return c.json({ ok: false, error: error.message }, 500);
  }
  return c.json({ ok: true });
});
