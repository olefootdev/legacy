import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAdminToken } from '../lib/adminAuth.js';
import { callAnthropic, hasAnthropicKey } from '../lib/anthropic.js';

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

/* ══ PROVAS DE DIVULGAÇÃO — o print do Instagram ═══════════════════════════ */

/**
 * O que a IA responde ao olhar o print.
 *
 * `real` é o veredito; `confianca` é o que decide se aprova sozinho ou manda
 * pra fila humana. Modelo incerto NÃO reprova ninguém — só pede olho humano.
 */
interface VereditoIa {
  real: boolean;
  confianca: number;
  motivo: string;
}

const O_QUE_PROCURAR: Record<string, string> = {
  insta_post:
    'um POST ou REELS do Instagram em que a conta @olefootgame aparece marcada — na legenda, num comentário ou na foto',
  insta_story:
    'um STORY do Instagram em que a conta @olefootgame aparece marcada com a etiqueta de menção',
  highlight:
    'um vídeo curto de futebol publicado pelo próprio atleta (treino, jogo, lance)',
};

/**
 * Pergunta ao modelo se o print é o que ele diz ser.
 *
 * Prompt calibrado pra ERRAR PRO LADO DA DÚVIDA: em caso de imagem cortada,
 * borrada ou ambígua, ele devolve confiança baixa e a prova cai na fila humana.
 * O custo de um falso positivo aqui é OLEKO — que não é dinheiro. O custo de um
 * falso negativo é um garoto que divulgou de verdade e foi chamado de mentiroso.
 */
async function conferirPrint(mission: string, imageUrl: string): Promise<VereditoIa | null> {
  if (!hasAnthropicKey()) return null;

  const alvo = O_QUE_PROCURAR[mission] ?? O_QUE_PROCURAR.insta_post;

  const r = await callAnthropic<VereditoIa>({
    model: 'haiku',
    system:
      'Você confere prints de divulgação para a Olefoot. Responde SOMENTE com JSON: ' +
      '{"real": boolean, "confianca": number entre 0 e 1, "motivo": "uma frase curta em português"}. ' +
      'Na dúvida (imagem cortada, borrada, texto ilegível), devolva confianca abaixo de 0.6 — ' +
      'existe um humano na fila para esses casos, e acusar alguém injustamente é o pior erro possível.',
    user:
      `A imagem é um print de tela. Ela mostra ${alvo}?\n` +
      'Considere real=true se você consegue LER a marcação/menção no print. ' +
      'Considere real=false apenas se a imagem claramente não é isso (foto aleatória, meme, tela em branco).',
    imageUrls: [imageUrl],
    expectJson: true,
    maxTokens: 300,
    temperature: 0.2,
    timeoutMs: 25_000,
  });

  if (!r.ok || !r.json) return null;
  const v = r.json;
  return {
    real: Boolean(v.real),
    confianca: Math.max(0, Math.min(1, Number(v.confianca) || 0)),
    motivo: typeof v.motivo === 'string' ? v.motivo.slice(0, 200) : '',
  };
}

/** Acima disto a IA aprova sozinha. Abaixo, vai pra fila humana. */
const CONFIANCA_PRA_APROVAR = 0.75;

/**
 * GET /api/revela-admin/provas — a fila do que a IA não resolveu sozinha.
 */
revelaAdminRoutes.get('/provas', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);

  const { data, error } = await sb.rpc('revela_provas_fila', { p_limit: 100 });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ provas: data ?? [] });
});

/**
 * POST /api/revela-admin/provas/analisar — roda a IA nas provas pendentes.
 *
 * body: { ids?: string[] }  (sem ids, analisa a fila inteira)
 *
 * Aprova sozinha o que ela reconhece com confiança; o resto continua na fila
 * com o veredito anotado, pra um humano bater o olho em segundos em vez de
 * abrir cada imagem do zero.
 */
revelaAdminRoutes.post('/provas/analisar', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);
  if (!hasAnthropicKey()) return c.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, 503);

  const { data, error } = await sb.rpc('revela_provas_fila', { p_limit: 50 });
  if (error) return c.json({ error: error.message }, 500);

  const fila = (data ?? []) as Array<{
    id: string;
    userId: string;
    mission: string;
    semana: string;
    imageUrl: string;
  }>;

  const resultado: Array<Record<string, unknown>> = [];

  for (const p of fila) {
    const v = await conferirPrint(p.mission, p.imageUrl);
    if (!v) {
      resultado.push({ id: p.id, acao: 'sem_veredito' });
      continue;
    }

    const anotacao = `IA: ${v.real ? 'real' : 'não confere'} (${Math.round(v.confianca * 100)}%) — ${v.motivo}`;

    if (v.real && v.confianca >= CONFIANCA_PRA_APROVAR) {
      const def = OLEKO_MISSOES[p.mission];
      if (!def) {
        resultado.push({ id: p.id, acao: 'missao_desconhecida' });
        continue;
      }
      await sb.rpc('revela_prova_revisar', { p_id: p.id, p_status: 'approved', p_ia: anotacao });
      // A semana vem da PROVA, não do relógio de agora: uma fila analisada na
      // segunda de manhã ainda credita a semana em que a pessoa postou.
      await sb.rpc('revela_oleko_grant', {
        p_user_id: p.userId,
        p_mission: def.semanal ? `${p.mission}:${p.semana}` : p.mission,
        p_oleko: def.oleko,
        p_note: anotacao,
      });
      resultado.push({ id: p.id, acao: 'aprovada', oleko: def.oleko, veredito: anotacao });
      continue;
    }

    // Não reprova: anota e deixa pro humano. Ver comentário em conferirPrint.
    await sb
      .from('revela_oleko_provas')
      .update({ ia_veredito: anotacao })
      .eq('id', p.id)
      .eq('status', 'pending');
    resultado.push({ id: p.id, acao: 'fila_humana', veredito: anotacao });
  }

  return c.json({ analisadas: resultado.length, resultado });
});

/**
 * POST /api/revela-admin/provas/review — a palavra final do humano.
 * body: { id, status: 'approved' | 'rejected', note? }
 */
revelaAdminRoutes.post('/provas/review', async (c) => {
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

  const status = b.status === 'approved' || b.status === 'rejected' ? b.status : null;
  if (!status) return c.json({ error: 'status inválido.' }, 400);

  const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 300) : null;

  const { data, error } = await sb.rpc('revela_prova_revisar', {
    p_id: id,
    p_status: status,
    p_note: note,
  });
  if (error) return c.json({ error: error.message }, 500);

  const r = (data ?? {}) as { ok?: boolean; userId?: string; mission?: string; semana?: string };
  if (!r.ok || status === 'rejected') return c.json(r);

  const def = r.mission ? OLEKO_MISSOES[r.mission] : undefined;
  if (!def) return c.json({ ...r, oleko: 0 });

  await sb.rpc('revela_oleko_grant', {
    p_user_id: r.userId,
    p_mission: def.semanal ? `${r.mission}:${r.semana}` : r.mission,
    p_oleko: def.oleko,
    p_note: note ?? 'Aprovado pelo OLE SCOUT',
  });
  return c.json({ ...r, oleko: def.oleko });
});
