import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { rateLimit } from '../lib/rateLimit.js';
import { semTabela, sincronizarFichas } from '../lib/smartProfile/sincronizar.js';
import { compararPartida, lerRelato } from '../lib/smartProfile/sombra.js';
import type { Ficha } from '../lib/smartProfile/tipos.js';

/**
 * SMART-PROFILE — as fichas do jogador (sessão do manager).
 *
 *   GET /api/player-profiles                     sincroniza com o elenco e devolve as fichas ativas
 *   GET /api/player-profiles/:playerId/memoria   o histórico (Memória) de um jogador
 *   POST /api/player-profiles/sombra/partida     modo sombra (Fase 2A): compara a evolução do celular com a do servidor
 *
 * O manager só vê as próprias fichas: o dono vem do JWT, nunca da URL.
 */
export const playerProfilesRoutes = new Hono();

async function donoDoPedido(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

playerProfilesRoutes.get('/api/player-profiles', rateLimit(30), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, erro: 'banco indisponível' }, 503);
  const dono = await donoDoPedido(c.req.header('Authorization'));
  if (!dono) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  try {
    const r = await sincronizarFichas(sb, dono);
    return c.json({
      ok: true,
      fichas: r.fichas,
      sync: { criadas: r.criadas, atualizadas: r.atualizadas, inativadas: r.inativadas, eventos: r.eventos },
    });
  } catch (e) {
    // Antes da migration rodar, o jogo segue normal: só não há ficha ainda.
    if (semTabela(e as { code?: string; message?: string })) return c.json({ ok: true, fichas: [], indisponivel: true });
    console.error('[player-profiles]', e instanceof Error ? e.message : e);
    return c.json({ ok: false, erro: 'falha ao montar as fichas' }, 500);
  }
});

playerProfilesRoutes.get('/api/player-profiles/:playerId/memoria', rateLimit(60), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, erro: 'banco indisponível' }, 503);
  const dono = await donoDoPedido(c.req.header('Authorization'));
  if (!dono) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  const playerId = c.req.param('playerId') ?? '';
  if (!/^[\w-]{1,120}$/.test(playerId)) return c.json({ ok: false, erro: 'jogador inválido' }, 400);
  const { data, error } = await sb.from('player_profile_events')
    .select('tipo, dados, criado_em').eq('owner_id', dono).eq('player_id', playerId)
    .order('criado_em', { ascending: false }).limit(100);
  if (error) {
    if (semTabela(error)) return c.json({ ok: true, memoria: [], indisponivel: true });
    return c.json({ ok: false, erro: 'falha ao ler a memória' }, 500);
  }
  return c.json({ ok: true, memoria: data ?? [] });
});

/**
 * MODO SOMBRA — o celular relata a evolução que aplicou numa Partida Rápida; o
 * servidor refaz a conta e grava a comparação em `evolucao_sombra`. Não muda
 * nada no jogo. Sempre responde rápido: o celular não espera por isso.
 */
playerProfilesRoutes.post('/api/player-profiles/sombra/partida', rateLimit(30), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false }, 503);
  const dono = await donoDoPedido(c.req.header('Authorization'));
  if (!dono) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  const relato = lerRelato(await c.req.json().catch(() => null));
  if (!relato) return c.json({ ok: false, erro: 'relato inválido' }, 400);

  const { data: fichas } = await sb.from('player_profiles').select('player_id, atributos')
    .eq('owner_id', dono).in('player_id', relato.jogadores.map((j) => j.id));
  const porId = new Map((fichas ?? []).map((f) => [f.player_id as string, f as unknown as Pick<Ficha, 'atributos'>]));
  const cmp = compararPartida(relato, porId);

  const { error } = await sb.from('evolucao_sombra').upsert(
    { owner_id: dono, seed: relato.seed, ...cmp },
    { onConflict: 'owner_id,seed', ignoreDuplicates: true },
  );
  if (error && !semTabela(error) && !/evolucao_sombra/.test(error.message)) {
    console.error('[sombra]', error.message);
  }
  if (cmp.divergencias > 0) console.warn(`[sombra] ${cmp.divergencias}/${cmp.jogadores} divergência(s) seed=${relato.seed}`);
  return c.json({ ok: true, divergencias: cmp.divergencias, jogadores: cmp.jogadores });
});
