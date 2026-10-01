import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { adminQuemAge, requireAdminFresco, requireAdminToken } from '../lib/adminAuth.js';
import { idPorUsername, usernamesDe } from '../lib/perfilLookup.js';

/**
 * SUPORTE — P1 do raio-x 30/09: as duas ferramentas que o atendimento não
 * tinha.
 *
 *   GET  /suporte/pin                       — quem tem PIN e quem está TRAVADO agora
 *   POST /suporte/pin/:username/destravar   — zera as tentativas (step-up)
 *   GET  /suporte/card-sales                — vendas de card em BRO, com resumo
 *
 * Destravar é a ÚNICA ação sobre o PIN: remover o PIN de alguém por pedido é
 * exatamente o golpe de engenharia social que o PIN existe pra impedir — quem
 * esqueceu entra de novo com a senha da conta e define outro (regra fixada na
 * migration 20260930180000).
 */
export const adminSuporteRoutes = new Hono();

adminSuporteRoutes.use('*', async (c, next) => {
  const authErr = await requireAdminToken(c);
  if (authErr) return authErr;
  await next();
});

/** GET /suporte/pin — travados agora (5 erros/15 min) + quem tem PIN. */
adminSuporteRoutes.get('/suporte/pin', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);

  const corte = new Date(Date.now() - 15 * 60_000).toISOString();
  const [pins, tentativas] = await Promise.all([
    sb.from('carteira_pin').select('user_id, criado_em, trocado_em').order('criado_em', { ascending: false }).limit(500),
    sb.from('carteira_pin_tentativa').select('user_id, em').gt('em', corte).order('em', { ascending: false }).limit(2000),
  ]);
  if (pins.error) return c.json({ error: pins.error.message }, 500);
  if (tentativas.error) return c.json({ error: tentativas.error.message }, 500);

  // A MESMA régua de carteira_pin_trava_interno: 5+ erros na janela = travado.
  const porUser = new Map<string, { erros: number; ultimo: string }>();
  for (const t of tentativas.data ?? []) {
    const id = String(t.user_id);
    const atual = porUser.get(id) ?? { erros: 0, ultimo: String(t.em) };
    atual.erros += 1;
    if (String(t.em) > atual.ultimo) atual.ultimo = String(t.em);
    porUser.set(id, atual);
  }
  const nomes = await usernamesDe(sb, [
    ...(pins.data ?? []).map((p) => String(p.user_id)),
    ...porUser.keys(),
  ]);
  const travados = [...porUser.entries()]
    .filter(([, v]) => v.erros >= 5)
    .map(([id, v]) => ({
      username: nomes.get(id) || null,
      userId: id,
      erros: v.erros,
      destravaEm: new Date(new Date(v.ultimo).getTime() + 15 * 60_000).toISOString(),
    }));
  return c.json({
    travados,
    comErroRecente: [...porUser.entries()]
      .filter(([, v]) => v.erros > 0 && v.erros < 5)
      .map(([id, v]) => ({ username: nomes.get(id) || null, userId: id, erros: v.erros })),
    comPin: (pins.data ?? []).map((p) => ({
      username: nomes.get(String(p.user_id)) || null,
      criadoEm: String(p.criado_em),
      trocadoEm: p.trocado_em ? String(p.trocado_em) : null,
    })),
  });
});

/** POST /suporte/pin/:username/destravar — zera a trava. O PIN continua o mesmo. */
adminSuporteRoutes.post('/suporte/pin/:username/destravar', async (c) => {
  // 🔒 Destravar encurta a defesa de brute-force de um PIN de 6 dígitos:
  // exige login recente, e fica escrito quem destravou.
  const fresco = await requireAdminFresco(c);
  if (fresco) return fresco;
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);
  const username = c.req.param('username');
  const userId = await idPorUsername(sb, username);
  if (!userId) return c.json({ error: `Não existe o usuário @${username.replace(/^@/, '')}.` }, 404);

  const { error, count } = await sb
    .from('carteira_pin_tentativa')
    .delete({ count: 'exact' })
    .eq('user_id', userId);
  if (error) return c.json({ error: error.message }, 500);
  console.log(`[admin/suporte] PIN de @${username.replace(/^@/, '')} destravado por ${await adminQuemAge(c)} (${count ?? 0} tentativas apagadas)`);
  return c.json({ ok: true, apagadas: count ?? 0 });
});

const int = (v: unknown) => BigInt(String(v ?? '0').split('.')[0] || '0');

/** GET /suporte/card-sales?limite=200 — vendas de card com resumo por card. */
adminSuporteRoutes.get('/suporte/card-sales', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);
  const limite = Math.min(Math.max(Number(c.req.query('limite')) || 200, 1), 1000);

  const { data, error } = await sb
    .from('card_sales')
    .select('id, legacy_player_id, beneficiary_user_id, buyer_user_id, currency, gross_cents, owner_cents, payment_method, role, source_ref, created_at')
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) return c.json({ error: error.message }, 500);
  const vendas = data ?? [];

  const [nomes, lendas] = await Promise.all([
    usernamesDe(sb, vendas.flatMap((v) => [String(v.beneficiary_user_id ?? ''), String(v.buyer_user_id ?? '')])),
    (async () => {
      const ids = [...new Set(vendas.map((v) => String(v.legacy_player_id)).filter(Boolean))];
      const mapa = new Map<string, string>();
      if (ids.length > 0) {
        const { data: ls } = await sb.from('legacy_players').select('id, name').in('id', ids);
        for (const l of ls ?? []) mapa.set(String(l.id), String(l.name ?? l.id));
      }
      return mapa;
    })(),
  ]);

  // Resumo por card e por moeda, na janela carregada.
  const porCard = new Map<string, { nome: string; vendas: number; grossCents: bigint; ownerCents: bigint; moeda: string }>();
  for (const v of vendas) {
    const chave = `${v.legacy_player_id}|${v.currency}`;
    const atual = porCard.get(chave) ?? {
      nome: lendas.get(String(v.legacy_player_id)) ?? String(v.legacy_player_id),
      vendas: 0, grossCents: 0n, ownerCents: 0n, moeda: String(v.currency),
    };
    atual.vendas += 1;
    atual.grossCents += int(v.gross_cents);
    atual.ownerCents += int(v.owner_cents);
    porCard.set(chave, atual);
  }

  return c.json({
    vendas: vendas.map((v) => ({
      ...v,
      card: lendas.get(String(v.legacy_player_id)) ?? String(v.legacy_player_id),
      beneficiario: nomes.get(String(v.beneficiary_user_id ?? '')) || null,
      comprador: nomes.get(String(v.buyer_user_id ?? '')) || null,
    })),
    resumo: [...porCard.values()]
      .sort((a, b) => (b.grossCents > a.grossCents ? 1 : -1))
      .map((r) => ({ ...r, grossCents: String(r.grossCents), ownerCents: String(r.ownerCents) })),
  });
});
