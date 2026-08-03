import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAdminToken } from '../lib/adminAuth.js';

/**
 * Rotas admin do OLE SCOUT — a fila de talentos do REVELA e a revisão.
 *
 * POR QUE EXISTEM: `revela_admin_queue()` e `revela_admin_review_talent()` são
 * SECURITY DEFINER **sem grant** pra anon/authenticated — de propósito, porque a
 * fila carrega PII (telefone, e-mail, e dados de responsável quando o atleta é
 * menor). Só a service role executa. Até hoje isso significava aprovar talento
 * digitando SQL no editor do Supabase, um por um, com os 10 atributos na mão.
 *
 * Estas rotas são a ponte: o gate de admin roda no servidor, a service role fica
 * no servidor, e o navegador nunca vê nem a chave nem a PII de quem não foi
 * aprovado.
 */
export const revelaAdminRoutes = new Hono();

/** Gate em TUDO deste router — rota nova aqui já nasce protegida. */
revelaAdminRoutes.use('*', async (c, next) => {
  const authErr = await requireAdminToken(c);
  if (authErr) return authErr;
  await next();
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** As 10 chaves canônicas do `PlayerAttributes`. A ficha do REVELA é a mesma do jogo. */
const ATTR_KEYS = [
  'passe',
  'marcacao',
  'velocidade',
  'drible',
  'finalizacao',
  'fisico',
  'tatico',
  'mentalidade',
  'confianca',
  'fairPlay',
] as const;

const STATUS_VALIDOS = new Set(['pending', 'in_review', 'approved', 'rejected', 'carded']);

/**
 * Missões da Trajetória creditadas à mão.
 *
 * São exatamente as que NÃO dá pra derivar do banco: ninguém sabe se a pessoa
 * marcou @olefootgame olhando pra nossa tabela. O valor mora AQUI e não vem do
 * cliente — senão o admin poderia digitar 90.000 OLEKO num campo e coroar
 * alguém sem querer.
 *
 * (O webhook `mentions` da Meta automatiza post e comentário, mas exige App
 * Review — fica pra temporada 2. Ver docs/REVELA_TRAJETORIA_PLANO.md §5.)
 */
const OLEKO_MISSOES: Record<string, { oleko: number; semanal: boolean }> = {
  insta_post: { oleko: 1000, semanal: true },
  insta_story: { oleko: 500, semanal: true },
  insta_follow: { oleko: 300, semanal: false },
  highlight: { oleko: 300, semanal: true },
  alta_semana_1: { oleko: 3000, semanal: true },
  alta_semana_2: { oleko: 2000, semanal: true },
  alta_semana_3: { oleko: 1000, semanal: true },
};

/** Semana ISO — é o sufixo que faz o `unique` da missão valer por semana. */
function semanaIso(d = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const inicio = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const n = Math.ceil(((t.getTime() - inicio.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(n).padStart(2, '0')}`;
}

/**
 * GET /api/revela-admin/queue
 * A fila do OLE SCOUT. Devolve tudo que `revela_admin_queue()` traz, inclusive
 * contato — é uma tela de admin atrás do gate, e o scout precisa do telefone
 * pra confirmar o atleta.
 */
revelaAdminRoutes.get('/queue', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);

  const { data, error } = await sb.rpc('revela_admin_queue');
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ talents: data ?? [] });
});

/**
 * POST /api/revela-admin/review
 * body: { id, status, attributes?, note? }
 *
 * `overall` NÃO é aceito de propósito: quem calcula é `revela_ovr(pos, attrs)`
 * no banco, com os pesos por posição. Deixar o cliente mandar OVR abriria uma
 * segunda fonte de verdade que divergiria da do jogo.
 */
revelaAdminRoutes.post('/review', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'JSON inválido.' }, 400);
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const id = typeof b.id === 'string' ? b.id.trim() : '';
  if (!UUID_RE.test(id)) return c.json({ error: 'id inválido.' }, 400);

  const status = typeof b.status === 'string' ? b.status.trim() : '';
  if (!STATUS_VALIDOS.has(status)) return c.json({ error: 'status inválido.' }, 400);

  // Atributos só fazem sentido ao aprovar/cardar. Fora disso vão como null.
  let attributes: Record<string, number> | null = null;
  if (status === 'approved' || status === 'carded') {
    const raw = (b.attributes ?? {}) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const k of ATTR_KEYS) {
      const n = Number(raw[k]);
      if (!Number.isFinite(n)) return c.json({ error: `atributo ausente ou inválido: ${k}` }, 400);
      // Mesma faixa do jogo. Sem clamp silencioso: valor fora da faixa é erro do
      // operador, e engolir isso viraria ficha errada no card.
      if (n < 1 || n > 99) return c.json({ error: `${k} fora da faixa 1–99.` }, 400);
      out[k] = Math.round(n);
    }
    attributes = out;
  }

  const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 500) : null;

  const { data, error } = await sb.rpc('revela_admin_review_talent', {
    p_id: id,
    p_status: status,
    p_attributes: attributes,
    p_note: note,
  });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? { ok: true });
});

/**
 * POST /api/revela-admin/oleko
 * body: { userId, mission }
 *
 * Credita uma missão da Trajetória depois da conferência humana (o print do
 * story, a marcação no post). O VALOR não é aceito do cliente — vem da tabela
 * acima. Missão semanal ganha o sufixo da semana, então a mesma pessoa pode
 * receber de novo na segunda seguinte, e não duas vezes na mesma.
 */
revelaAdminRoutes.post('/oleko', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'JSON inválido.' }, 400);
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const userId = typeof b.userId === 'string' ? b.userId.trim() : '';
  if (!UUID_RE.test(userId)) return c.json({ error: 'userId inválido.' }, 400);

  const missionKey = typeof b.mission === 'string' ? b.mission.trim() : '';
  const def = OLEKO_MISSOES[missionKey];
  if (!def) return c.json({ error: 'missão desconhecida.' }, 400);

  const mission = def.semanal ? `${missionKey}:${semanaIso()}` : missionKey;
  const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 300) : null;

  const { data, error } = await sb.rpc('revela_oleko_grant', {
    p_user_id: userId,
    p_mission: mission,
    p_oleko: def.oleko,
    p_note: note,
  });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ...(data ?? { ok: true }), mission, oleko: def.oleko });
});

/** As missões creditáveis — a tela de admin monta os botões a partir daqui. */
revelaAdminRoutes.get('/oleko/catalogo', (c) =>
  c.json({
    semana: semanaIso(),
    missoes: Object.entries(OLEKO_MISSOES).map(([id, d]) => ({ id, ...d })),
  }),
);
