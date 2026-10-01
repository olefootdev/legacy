import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { TOKENS_POR_CENTAVO_USD } from '../lib/presale/packs.js';

/**
 * MERCADO DE ELENCO EM OLEFOOT — "compra por $1, treina, vende por $3".
 *
 * Qualquer jogador do plantel (ou o TIME inteiro) pode ser anunciado pelo
 * preço que o vendedor escolher, em OLEFOOT. O comprador leva o jogador como
 * ele está HOJE — treinado, evoluído — e o valor de REFERÊNCIA (preço
 * dinâmico) vai junto no anúncio pra todo mundo ver o ágio.
 *
 * Divisão de trabalho (migration 20261001150000):
 *   · DINHEIRO: `squad_market_liquidar` no banco — lock + débito/crédito em
 *     wei na MESMA transação. Nada de read-modify-write de saldo em TS.
 *   · PLANTEL: aqui, no padrão do marketOffers (write cirúrgico em
 *     manager_squad). Se falhar, `squad_market_desfazer` devolve o dinheiro.
 *   · O VENDEDOR offline fica com o jogador no estado local até o cliente
 *     dele aplicar a venda (GET /mine → dispatch → POST /ack-sold) — o mesmo
 *     contrato do APPLY_OFFER_SETTLED_AS_SELLER.
 */
export const squadMarketRoutes = new Hono();

/** Preço em OLEFOOT inteiro: de 1 a 100 bilhões (acima disso é dedo no teclado). */
const PRECO_MIN = 1;
const PRECO_MAX = 100_000_000_000;
/** Vender o time inteiro exige um time de verdade. */
const MIN_JOGADORES_TIME = 11;

async function resolveUser(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

type SquadPlayer = {
  id: string;
  name?: string;
  pos?: string;
  age?: number;
  rarity?: string;
  attrs?: Record<string, number>;
  mintOverall?: number;
  marketValueBroCents?: number;
  listedOnMarket?: boolean;
  contractExpired?: boolean;
  [k: string]: unknown;
};

type SquadRow = {
  players: SquadPlayer[];
  lineup: Record<string, string>;
  formation_scheme: string | null;
};

async function lerSquad(userId: string): Promise<SquadRow> {
  const sb = getSupabaseAdmin()!;
  const { data } = await sb
    .from('manager_squad')
    .select('players, lineup, formation_scheme')
    .eq('user_id', userId)
    .maybeSingle();
  return {
    players: Array.isArray(data?.players) ? (data!.players as SquadPlayer[]) : [],
    lineup: (data?.lineup ?? {}) as Record<string, string>,
    formation_scheme: (data?.formation_scheme as string | null) ?? null,
  };
}

async function gravarSquad(userId: string, squad: SquadRow): Promise<string | null> {
  const sb = getSupabaseAdmin()!;
  const { error } = await sb.from('manager_squad').upsert(
    { user_id: userId, players: squad.players, lineup: squad.lineup, formation_scheme: squad.formation_scheme },
    { onConflict: 'user_id' },
  );
  return error ? error.message : null;
}

/** Tira o jogador da escalação (slots que apontam pra ele). */
function limparLineup(lineup: Record<string, string>, ids: ReadonlySet<string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [slot, pid] of Object.entries(lineup)) {
    if (!ids.has(pid)) out[slot] = pid;
  }
  return out;
}

/** Centavos de BRO (≈USD) → OLEFOOT inteiro, pelo preço real da pré-venda. */
function broCentsParaOlefoot(cents: number | undefined | null): number | null {
  if (cents == null || !Number.isFinite(cents) || cents <= 0) return null;
  return Math.round(cents) * Number(TOKENS_POR_CENTAVO_USD);
}

function precoValido(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isInteger(n) || n < PRECO_MIN || n > PRECO_MAX) return null;
  return n;
}

/** Snapshot de VITRINE — o suficiente pro card do anúncio, nada de lixo. */
function snapshotDeVitrine(p: SquadPlayer): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name ?? '',
    pos: p.pos ?? '',
    age: p.age ?? null,
    rarity: p.rarity ?? null,
    attrs: p.attrs ?? {},
    mintOverall: p.mintOverall ?? null,
    marketValueBroCents: p.marketValueBroCents ?? null,
  };
}

/** Jogadores que estão NO MEU plantel mas são de outro dono (alugados). */
async function idsAlugadosPorMim(userId: string): Promise<Set<string>> {
  const sb = getSupabaseAdmin()!;
  const { data } = await sb
    .from('squad_loans')
    .select('game_player_id')
    .eq('borrower_user_id', userId)
    .eq('status', 'active');
  return new Set((data ?? []).map((l) => String(l.game_player_id)));
}

/** GET /api/squad-market/listings — a vitrine da comunidade. */
squadMarketRoutes.get('/api/squad-market/listings', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);
  const me = await resolveUser(c.req.header('Authorization'));

  const { data, error } = await sb
    .from('squad_listings')
    .select('id, kind, seller_user_id, game_player_id, player_snapshot, team_snapshot, price_olefoot, ref_olefoot, created_at, loan_days, buyout_olefoot')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return c.json({ ok: false, error: error.message }, 500);
  const linhas = data ?? [];

  const ids = [...new Set(linhas.map((l) => String(l.seller_user_id)))];
  const clubes = new Map<string, { username: string | null; club: string | null }>();
  if (ids.length > 0) {
    const { data: ps } = await sb.from('profiles').select('id, username, club_name').in('id', ids);
    for (const p of ps ?? []) {
      clubes.set(String(p.id), {
        username: (p.username as string | null) ?? null,
        club: (p.club_name as string | null) ?? null,
      });
    }
  }
  return c.json({
    ok: true,
    listings: linhas.map((l) => ({
      id: String(l.id),
      kind: l.kind as 'player' | 'team',
      mine: me != null && String(l.seller_user_id) === me,
      seller: clubes.get(String(l.seller_user_id)) ?? { username: null, club: null },
      gamePlayerId: (l.game_player_id as string | null) ?? null,
      player: l.player_snapshot ?? null,
      team: l.team_snapshot ?? null,
      priceOlefoot: String(l.price_olefoot),
      refOlefoot: l.ref_olefoot == null ? null : String(l.ref_olefoot),
      loanDays: l.loan_days == null ? null : Number(l.loan_days),
      buyoutOlefoot: l.buyout_olefoot == null ? null : String(l.buyout_olefoot),
      createdAt: String(l.created_at),
    })),
  });
});

/**
 * GET /api/squad-market/mine — meus anúncios ativos + vendas que o MEU
 * cliente ainda não aplicou no plantel local (o contrato do vendedor).
 */
squadMarketRoutes.get('/api/squad-market/mine', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);
  const me = await resolveUser(c.req.header('Authorization'));
  if (!me) return c.json({ ok: false, error: 'Sessão expirada.' }, 401);

  // ── EMPRÉSTIMOS VENCIDOS: processa aqui (lazy), antes de responder. ──────
  // O jogador volta TREINADO: pega o objeto VIVO do plantel do locatário.
  const { data: vencidos } = await sb
    .from('squad_loans')
    .select('id, game_player_id, owner_user_id, borrower_user_id')
    .eq('status', 'active')
    .lt('ends_at', new Date().toISOString())
    .or(`owner_user_id.eq.${me},borrower_user_id.eq.${me}`);
  for (const emprestimo of vencidos ?? []) {
    const ownerId = String(emprestimo.owner_user_id);
    const borrowerId = String(emprestimo.borrower_user_id);
    const [deles, doDono] = await Promise.all([lerSquad(borrowerId), lerSquad(ownerId)]);
    const vivo = deles.players.find((p) => p?.id === emprestimo.game_player_id);
    if (vivo) {
      const semEle = new Set([String(emprestimo.game_player_id)]);
      const errB = await gravarSquad(borrowerId, {
        players: deles.players.filter((p) => p?.id !== emprestimo.game_player_id),
        lineup: limparLineup(deles.lineup, semEle),
        formation_scheme: deles.formation_scheme,
      });
      if (errB) continue; // tenta de novo na próxima visita
      if (!doDono.players.some((p) => p?.id === emprestimo.game_player_id)) {
        await gravarSquad(ownerId, {
          players: [...doDono.players, { ...vivo, listedOnMarket: false }],
          lineup: doDono.lineup,
          formation_scheme: doDono.formation_scheme,
        });
      }
    }
    // Sem o jogador vivo (estado inconsistente), fecha mesmo assim — o
    // contrato venceu; deixar aberto travaria o anúncio pra sempre.
    await sb.rpc('squad_loan_marcar_devolvido', { p_loan: emprestimo.id });
  }

  const [{ data: loans }, { data: devolvidos }] = await Promise.all([
    sb.from('squad_loans')
      .select('id, game_player_id, owner_user_id, borrower_user_id, rent_olefoot, buyout_olefoot, ends_at, status')
      .eq('status', 'active')
      .or(`owner_user_id.eq.${me},borrower_user_id.eq.${me}`)
      .order('ends_at', { ascending: true })
      .limit(50),
    // Devoluções que o MEU cliente (locatário) ainda não aplicou no estado local.
    sb.from('squad_loans')
      .select('id, game_player_id')
      .eq('status', 'returned')
      .eq('borrower_user_id', me)
      .is('borrower_applied_at', null)
      .limit(50),
  ]);

  const { data, error } = await sb
    .from('squad_listings')
    .select('id, kind, game_player_id, player_snapshot, team_snapshot, price_olefoot, ref_olefoot, status, created_at, sold_at, buyer_user_id, seller_applied_at')
    .eq('seller_user_id', me)
    .in('status', ['active', 'sold'])
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return c.json({ ok: false, error: error.message }, 500);

  const linhas = data ?? [];
  const compradorIds = [...new Set(linhas.map((l) => l.buyer_user_id).filter(Boolean).map(String))];
  const clubes = new Map<string, string>();
  if (compradorIds.length > 0) {
    const { data: ps } = await sb.from('profiles').select('id, club_name, username').in('id', compradorIds);
    for (const p of ps ?? []) clubes.set(String(p.id), (p.club_name as string) || (p.username as string) || 'outro clube');
  }
  return c.json({
    ok: true,
    ativos: linhas.filter((l) => l.status === 'active').map((l) => ({
      id: String(l.id),
      kind: l.kind,
      gamePlayerId: (l.game_player_id as string | null) ?? null,
      player: l.player_snapshot ?? null,
      team: l.team_snapshot ?? null,
      priceOlefoot: String(l.price_olefoot),
      createdAt: String(l.created_at),
    })),
    vendidosNaoAplicados: linhas
      .filter((l) => l.status === 'sold' && l.seller_applied_at == null)
      .map((l) => ({
        id: String(l.id),
        kind: l.kind,
        gamePlayerId: (l.game_player_id as string | null) ?? null,
        player: l.player_snapshot ?? null,
        team: l.team_snapshot ?? null,
        priceOlefoot: String(l.price_olefoot),
        buyerClub: clubes.get(String(l.buyer_user_id ?? '')) ?? 'outro clube',
        soldAt: l.sold_at ? String(l.sold_at) : null,
      })),
    emprestimos: (loans ?? []).map((l) => ({
      id: String(l.id),
      gamePlayerId: String(l.game_player_id),
      papel: String(l.owner_user_id) === me ? ('dono' as const) : ('locatario' as const),
      rentOlefoot: String(l.rent_olefoot),
      buyoutOlefoot: l.buyout_olefoot == null ? null : String(l.buyout_olefoot),
      endsAt: String(l.ends_at),
    })),
    devolucoesNaoAplicadas: (devolvidos ?? []).map((l) => ({
      id: String(l.id),
      gamePlayerId: String(l.game_player_id),
    })),
  });
});

/** POST /api/squad-market/ack-loan { loanIds } — o locatário aplicou a devolução. */
squadMarketRoutes.post('/api/squad-market/ack-loan', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);
  const me = await resolveUser(c.req.header('Authorization'));
  if (!me) return c.json({ ok: false, error: 'Sessão expirada.' }, 401);
  const body = await c.req.json<{ loanIds?: unknown }>().catch(() => ({} as { loanIds?: unknown }));
  const ids = Array.isArray(body.loanIds) ? body.loanIds.filter((x): x is string => typeof x === 'string').slice(0, 50) : [];
  if (ids.length === 0) return c.json({ ok: false, error: 'loanIds obrigatório.' }, 400);
  const { error } = await sb
    .from('squad_loans')
    .update({ borrower_applied_at: new Date().toISOString() })
    .in('id', ids)
    .eq('borrower_user_id', me)
    .eq('status', 'returned')
    .is('borrower_applied_at', null);
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true });
});

/** POST /api/squad-market/list { playerId, priceOlefoot } — anuncia UM jogador. */
squadMarketRoutes.post('/api/squad-market/list', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);
  const me = await resolveUser(c.req.header('Authorization'));
  if (!me) return c.json({ ok: false, error: 'Sessão expirada.' }, 401);

  const body = await c.req.json<{ playerId?: string; priceOlefoot?: unknown }>()
    .catch(() => ({} as { playerId?: string; priceOlefoot?: unknown }));
  const playerId = typeof body.playerId === 'string' ? body.playerId.trim() : '';
  const preco = precoValido(body.priceOlefoot);
  if (!playerId) return c.json({ ok: false, error: 'playerId obrigatório.' }, 400);
  if (preco == null) return c.json({ ok: false, error: `Preço em OLEFOOT inteiro, de ${PRECO_MIN} a ${PRECO_MAX.toLocaleString('pt-BR')}.` }, 400);

  const squad = await lerSquad(me);
  const player = squad.players.find((p) => p?.id === playerId);
  if (!player) return c.json({ ok: false, error: 'Este jogador não está no teu plantel.' }, 404);
  if (player.contractExpired) return c.json({ ok: false, error: 'Contrato esgotado — renova antes de vender.' }, 409);
  if ((await idsAlugadosPorMim(me)).has(playerId)) {
    return c.json({ ok: false, error: 'Este jogador está EMPRESTADO a ti — não é teu pra vender.' }, 409);
  }

  const { data, error } = await sb
    .from('squad_listings')
    .insert({
      kind: 'player',
      seller_user_id: me,
      game_player_id: playerId,
      player_snapshot: snapshotDeVitrine(player),
      price_olefoot: preco,
      ref_olefoot: broCentsParaOlefoot(player.marketValueBroCents),
    })
    .select('id')
    .single();
  if (error) {
    if (error.message.includes('squad_listings_um_por_jogador')) {
      return c.json({ ok: false, error: 'Este jogador já está anunciado.' }, 409);
    }
    return c.json({ ok: false, error: error.message }, 500);
  }
  return c.json({ ok: true, listingId: String(data.id) });
});

/** POST /api/squad-market/list-team { priceOlefoot } — anuncia o TIME inteiro. */
squadMarketRoutes.post('/api/squad-market/list-team', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);
  const me = await resolveUser(c.req.header('Authorization'));
  if (!me) return c.json({ ok: false, error: 'Sessão expirada.' }, 401);

  const body = await c.req.json<{ priceOlefoot?: unknown }>()
    .catch(() => ({} as { priceOlefoot?: unknown }));
  const preco = precoValido(body.priceOlefoot);
  if (preco == null) return c.json({ ok: false, error: `Preço em OLEFOOT inteiro, de ${PRECO_MIN} a ${PRECO_MAX.toLocaleString('pt-BR')}.` }, 400);

  const squad = await lerSquad(me);
  if (squad.players.length < MIN_JOGADORES_TIME) {
    return c.json({ ok: false, error: `Time pronto tem pelo menos ${MIN_JOGADORES_TIME} jogadores (tens ${squad.players.length}).` }, 409);
  }
  const alugados = await idsAlugadosPorMim(me);
  if (squad.players.some((p) => alugados.has(p.id))) {
    return c.json({ ok: false, error: 'Tens jogador EMPRESTADO no plantel — devolve (ou compra) antes de vender o time.' }, 409);
  }

  const refTotal = squad.players.reduce((s, p) => s + (broCentsParaOlefoot(p.marketValueBroCents) ?? 0), 0);
  const { data, error } = await sb
    .from('squad_listings')
    .insert({
      kind: 'team',
      seller_user_id: me,
      team_snapshot: {
        jogadores: squad.players.length,
        destaques: squad.players.slice(0, 5).map((p) => ({ name: p.name ?? '', pos: p.pos ?? '' })),
        refOlefoot: refTotal > 0 ? String(refTotal) : null,
      },
      price_olefoot: preco,
      ref_olefoot: refTotal > 0 ? refTotal : null,
    })
    .select('id')
    .single();
  if (error) {
    if (error.message.includes('squad_listings_um_time')) {
      return c.json({ ok: false, error: 'O teu time já está anunciado.' }, 409);
    }
    return c.json({ ok: false, error: error.message }, 500);
  }
  return c.json({ ok: true, listingId: String(data.id) });
});

/** POST /api/squad-market/unlist { listingId } — tira o anúncio do ar. */
squadMarketRoutes.post('/api/squad-market/unlist', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);
  const me = await resolveUser(c.req.header('Authorization'));
  if (!me) return c.json({ ok: false, error: 'Sessão expirada.' }, 401);
  const body = await c.req.json<{ listingId?: string }>().catch(() => ({} as { listingId?: string }));
  const id = typeof body.listingId === 'string' ? body.listingId.trim() : '';
  if (!id) return c.json({ ok: false, error: 'listingId obrigatório.' }, 400);

  const { data, error } = await sb
    .from('squad_listings')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('seller_user_id', me)
    .eq('status', 'active')
    .select('id');
  if (error) return c.json({ ok: false, error: error.message }, 500);
  if (!data || data.length === 0) return c.json({ ok: false, error: 'Anúncio não está mais ativo.' }, 409);
  return c.json({ ok: true });
});

/**
 * POST /api/squad-market/buy { listingId }
 * 1) dinheiro no banco (atômico);  2) plantel aqui;  3) falhou → desfazer.
 */
squadMarketRoutes.post('/api/squad-market/buy', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);
  const me = await resolveUser(c.req.header('Authorization'));
  if (!me) return c.json({ ok: false, error: 'Sessão expirada.' }, 401);
  const body = await c.req.json<{ listingId?: string }>().catch(() => ({} as { listingId?: string }));
  const id = typeof body.listingId === 'string' ? body.listingId.trim() : '';
  if (!id) return c.json({ ok: false, error: 'listingId obrigatório.' }, 400);

  const { data: liq, error: liqErr } = await sb.rpc('squad_market_liquidar', { p_listing: id, p_buyer: me });
  if (liqErr) return c.json({ ok: false, error: liqErr.message }, 500);
  const r = (Array.isArray(liq) ? liq[0] : liq) as
    | { ok: boolean; motivo: string | null; seller: string | null; kind: string | null; game_player_id: string | null; price_olefoot: string | null }
    | null;
  if (!r) return c.json({ ok: false, error: 'Resposta vazia do banco.' }, 500);
  if (!r.ok) {
    const mapa: Record<string, { msg: string; status: 402 | 409 }> = {
      indisponivel: { msg: 'Este anúncio não está mais disponível.', status: 409 },
      propria_listagem: { msg: 'Não dá pra comprar o próprio anúncio.', status: 409 },
      saldo_insuficiente: { msg: 'Saldo OLEFOOT insuficiente.', status: 402 },
    };
    const e = mapa[r.motivo ?? ''] ?? { msg: r.motivo ?? 'Falha na liquidação.', status: 409 as const };
    return c.json({ ok: false, error: e.msg }, e.status);
  }

  // Dinheiro já mudou de mão. Daqui pra baixo, QUALQUER falha desfaz.
  const desfazer = async (motivo: string, status: 409 | 500) => {
    await sb.rpc('squad_market_desfazer', { p_listing: id });
    return c.json({ ok: false, error: motivo }, status);
  };

  const sellerId = String(r.seller);
  const [sellerSquad, buyerSquad] = await Promise.all([lerSquad(sellerId), lerSquad(me)]);

  let entregues: SquadPlayer[];
  let sellerRestantes: SquadPlayer[];
  if (r.kind === 'player') {
    const alvo = sellerSquad.players.find((p) => p?.id === r.game_player_id);
    if (!alvo) return desfazer('O jogador saiu do plantel do vendedor — dinheiro devolvido.', 409);
    entregues = [{ ...alvo, listedOnMarket: false }];
    sellerRestantes = sellerSquad.players.filter((p) => p?.id !== r.game_player_id);
  } else {
    // Jogador que o vendedor ALUGOU de terceiro não é dele — fica com ele.
    const alugadosDoVendedor = await idsAlugadosPorMim(sellerId);
    const proprios = sellerSquad.players.filter((p) => !alugadosDoVendedor.has(p.id));
    if (proprios.length === 0) return desfazer('O plantel do vendedor está vazio — dinheiro devolvido.', 409);
    entregues = proprios.map((p) => ({ ...p, listedOnMarket: false }));
    sellerRestantes = sellerSquad.players.filter((p) => alugadosDoVendedor.has(p.id));
  }

  const meusIds = new Set(buyerSquad.players.map((p) => p?.id));
  if (entregues.some((p) => meusIds.has(p.id))) {
    return desfazer('Já tens um jogador com o mesmo id no plantel — dinheiro devolvido.', 409);
  }

  const idsVendidos = new Set(entregues.map((p) => p.id));
  const errVend = await gravarSquad(sellerId, {
    players: sellerRestantes,
    lineup: limparLineup(sellerSquad.lineup, idsVendidos),
    formation_scheme: sellerSquad.formation_scheme,
  });
  if (errVend) return desfazer(`Falha ao atualizar o vendedor: ${errVend}`, 500);

  const errComp = await gravarSquad(me, {
    players: [...buyerSquad.players, ...entregues],
    lineup: buyerSquad.lineup,
    formation_scheme: buyerSquad.formation_scheme,
  });
  if (errComp) {
    // Devolve os jogadores ao vendedor antes de devolver o dinheiro.
    await gravarSquad(sellerId, sellerSquad);
    return desfazer(`Falha ao entregar: ${errComp}`, 500);
  }

  // Time vendido leva junto os anúncios individuais do vendedor.
  if (r.kind === 'team') {
    await sb
      .from('squad_listings')
      .update({ status: 'cancelled' })
      .eq('seller_user_id', sellerId)
      .eq('status', 'active')
      .eq('kind', 'player');
  }

  return c.json({ ok: true, players: entregues, priceOlefoot: String(r.price_olefoot), kind: r.kind });
});

/**
 * POST /api/squad-market/list-loan { playerId, priceOlefoot, loanDays, buyoutOlefoot? }
 * Anuncia um jogador PRA ALUGAR: aluguel por N dias, opção de compra opcional.
 */
squadMarketRoutes.post('/api/squad-market/list-loan', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);
  const me = await resolveUser(c.req.header('Authorization'));
  if (!me) return c.json({ ok: false, error: 'Sessão expirada.' }, 401);

  const body = await c.req
    .json<{ playerId?: string; priceOlefoot?: unknown; loanDays?: unknown; buyoutOlefoot?: unknown }>()
    .catch(() => ({} as { playerId?: string; priceOlefoot?: unknown; loanDays?: unknown; buyoutOlefoot?: unknown }));
  const playerId = typeof body.playerId === 'string' ? body.playerId.trim() : '';
  const aluguel = precoValido(body.priceOlefoot);
  const dias = Number(body.loanDays);
  const buyout = body.buyoutOlefoot == null || body.buyoutOlefoot === '' ? null : precoValido(body.buyoutOlefoot);
  if (!playerId) return c.json({ ok: false, error: 'playerId obrigatório.' }, 400);
  if (aluguel == null) return c.json({ ok: false, error: 'Aluguel em OLEFOOT inteiro.' }, 400);
  if (!Number.isInteger(dias) || dias < 1 || dias > 30) return c.json({ ok: false, error: 'Empréstimo de 1 a 30 dias.' }, 400);
  if (body.buyoutOlefoot != null && body.buyoutOlefoot !== '' && buyout == null) {
    return c.json({ ok: false, error: 'Opção de compra em OLEFOOT inteiro (ou em branco).' }, 400);
  }

  const squad = await lerSquad(me);
  const player = squad.players.find((p) => p?.id === playerId);
  if (!player) return c.json({ ok: false, error: 'Este jogador não está no teu plantel.' }, 404);
  if (player.contractExpired) return c.json({ ok: false, error: 'Contrato esgotado — renova antes de emprestar.' }, 409);
  if ((await idsAlugadosPorMim(me)).has(playerId)) {
    return c.json({ ok: false, error: 'Este jogador já está EMPRESTADO a ti — não dá pra re-emprestar.' }, 409);
  }

  const { data, error } = await sb
    .from('squad_listings')
    .insert({
      kind: 'loan',
      seller_user_id: me,
      game_player_id: playerId,
      player_snapshot: snapshotDeVitrine(player),
      price_olefoot: aluguel,
      ref_olefoot: broCentsParaOlefoot(player.marketValueBroCents),
      loan_days: dias,
      buyout_olefoot: buyout,
    })
    .select('id')
    .single();
  if (error) {
    if (error.message.includes('squad_listings_um_por_jogador')) {
      return c.json({ ok: false, error: 'Este jogador já está anunciado.' }, 409);
    }
    return c.json({ ok: false, error: error.message }, 500);
  }
  return c.json({ ok: true, listingId: String(data.id) });
});

/**
 * POST /api/squad-market/rent { listingId }
 * Aluga: dinheiro no banco → jogador VIVO muda pro plantel do locatário.
 */
squadMarketRoutes.post('/api/squad-market/rent', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);
  const me = await resolveUser(c.req.header('Authorization'));
  if (!me) return c.json({ ok: false, error: 'Sessão expirada.' }, 401);
  const body = await c.req.json<{ listingId?: string }>().catch(() => ({} as { listingId?: string }));
  const id = typeof body.listingId === 'string' ? body.listingId.trim() : '';
  if (!id) return c.json({ ok: false, error: 'listingId obrigatório.' }, 400);

  const { data: liq, error: liqErr } = await sb.rpc('squad_loan_liquidar', { p_listing: id, p_buyer: me });
  if (liqErr) return c.json({ ok: false, error: liqErr.message }, 500);
  const r = (Array.isArray(liq) ? liq[0] : liq) as
    | { ok: boolean; motivo: string | null; loan_id: string | null; owner: string | null; game_player_id: string | null; rent: string | null; ends_at: string | null }
    | null;
  if (!r) return c.json({ ok: false, error: 'Resposta vazia do banco.' }, 500);
  if (!r.ok) {
    const mapa: Record<string, { msg: string; status: 402 | 409 }> = {
      indisponivel: { msg: 'Este anúncio não está mais disponível.', status: 409 },
      propria_listagem: { msg: 'Não dá pra alugar o próprio jogador.', status: 409 },
      saldo_insuficiente: { msg: 'Saldo OLEFOOT insuficiente.', status: 402 },
    };
    const e = mapa[r.motivo ?? ''] ?? { msg: r.motivo ?? 'Falha no aluguel.', status: 409 as const };
    return c.json({ ok: false, error: e.msg }, e.status);
  }

  const desfazer = async (motivo: string, status: 409 | 500) => {
    await sb.rpc('squad_loan_desfazer', { p_loan: r.loan_id });
    return c.json({ ok: false, error: motivo }, status);
  };

  const ownerId = String(r.owner);
  const [doDono, meu] = await Promise.all([lerSquad(ownerId), lerSquad(me)]);
  const vivo = doDono.players.find((p) => p?.id === r.game_player_id);
  if (!vivo) return desfazer('O jogador saiu do plantel do dono — aluguel devolvido.', 409);
  if (meu.players.some((p) => p?.id === r.game_player_id)) {
    return desfazer('Já tens um jogador com o mesmo id — aluguel devolvido.', 409);
  }

  const semEle = new Set([String(r.game_player_id)]);
  const errDono = await gravarSquad(ownerId, {
    players: doDono.players.filter((p) => p?.id !== r.game_player_id),
    lineup: limparLineup(doDono.lineup, semEle),
    formation_scheme: doDono.formation_scheme,
  });
  if (errDono) return desfazer(`Falha ao atualizar o dono: ${errDono}`, 500);
  const errMeu = await gravarSquad(me, {
    players: [...meu.players, { ...vivo, listedOnMarket: false }],
    lineup: meu.lineup,
    formation_scheme: meu.formation_scheme,
  });
  if (errMeu) {
    await gravarSquad(ownerId, doDono);
    return desfazer(`Falha ao entregar: ${errMeu}`, 500);
  }
  return c.json({
    ok: true,
    player: { ...vivo, listedOnMarket: false },
    loanId: String(r.loan_id),
    rentOlefoot: String(r.rent),
    endsAt: String(r.ends_at),
  });
});

/**
 * POST /api/squad-market/mvp/claim { auctionId }
 * O vencedor retira a CÓPIA ÚNICA do MVP: liquida (50% pro dono do MVP) e a
 * cópia entra no plantel com id próprio — colecionável jogável.
 */
squadMarketRoutes.post('/api/squad-market/mvp/claim', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);
  const me = await resolveUser(c.req.header('Authorization'));
  if (!me) return c.json({ ok: false, error: 'Sessão expirada.' }, 401);
  const body = await c.req.json<{ auctionId?: string }>().catch(() => ({} as { auctionId?: string }));
  const id = typeof body.auctionId === 'string' ? body.auctionId.trim() : '';
  if (!id) return c.json({ ok: false, error: 'auctionId obrigatório.' }, 400);

  const { data: liq, error: liqErr } = await sb.rpc('mvp_auction_liquidar', { p_auction: id, p_winner: me });
  if (liqErr) return c.json({ ok: false, error: liqErr.message }, 500);
  const r = (Array.isArray(liq) ? liq[0] : liq) as
    | { ok: boolean; motivo: string | null; player_snapshot: SquadPlayer | null; dia: string | null; bid: string | null }
    | null;
  if (!r) return c.json({ ok: false, error: 'Resposta vazia do banco.' }, 500);
  if (!r.ok) {
    const mapa: Record<string, string> = {
      indisponivel: 'Leilão não encontrado ou já retirado.',
      ainda_aberto: 'O leilão ainda está aberto.',
      sem_lances: 'O leilão terminou sem lances.',
      nao_e_o_vencedor: 'Só o vencedor retira o card.',
    };
    return c.json({ ok: false, error: mapa[r.motivo ?? ''] ?? r.motivo ?? 'Falha ao retirar.' }, 409);
  }

  const copia: SquadPlayer = {
    ...(r.player_snapshot as SquadPlayer),
    id: `mvp-${r.dia}-${Math.random().toString(36).slice(2, 8)}`,
    listedOnMarket: false,
  };
  const meu = await lerSquad(me);
  const errMeu = await gravarSquad(me, {
    players: [...meu.players, copia],
    lineup: meu.lineup,
    formation_scheme: meu.formation_scheme,
  });
  if (errMeu) {
    await sb.rpc('mvp_auction_desfazer', { p_auction: id });
    return c.json({ ok: false, error: `Falha ao entregar a cópia (lance devolvido): ${errMeu}` }, 500);
  }
  return c.json({ ok: true, player: copia, bidOlefoot: String(r.bid) });
});

/** POST /api/squad-market/ack-sold { listingIds } — o cliente do vendedor aplicou. */
squadMarketRoutes.post('/api/squad-market/ack-sold', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);
  const me = await resolveUser(c.req.header('Authorization'));
  if (!me) return c.json({ ok: false, error: 'Sessão expirada.' }, 401);
  const body = await c.req.json<{ listingIds?: unknown }>().catch(() => ({} as { listingIds?: unknown }));
  const ids = Array.isArray(body.listingIds) ? body.listingIds.filter((x): x is string => typeof x === 'string').slice(0, 50) : [];
  if (ids.length === 0) return c.json({ ok: false, error: 'listingIds obrigatório.' }, 400);

  const { error } = await sb
    .from('squad_listings')
    .update({ seller_applied_at: new Date().toISOString() })
    .in('id', ids)
    .eq('seller_user_id', me)
    .eq('status', 'sold')
    .is('seller_applied_at', null);
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true });
});
