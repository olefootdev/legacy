import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { rateLimit } from '../lib/rateLimit.js';

export const marketRoutes = new Hono();

/** Fórmula idêntica à do cliente (playerContracts.ts). */
function genesisListingPriceExp(mintOverall: number): number {
  const o = Math.round(Math.max(0, Math.min(99, mintOverall)));
  const t = (Math.max(24, Math.min(72, o)) - 24) / 48;
  const raw = 250_000 + Math.round(t * (1_000_000 - 250_000));
  return Math.round(raw / 5000) * 5000;
}

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
 * POST /api/market/buy
 * Valida e regista a compra de um jogador Genesis.
 * Body: { genesis_catalog_id: string }
 * Auth: Authorization: Bearer <jwt>
 *
 * Responde com { ok: true, price_exp, mint_overall } para o cliente confirmar o dispatch.
 */
marketRoutes.post('/api/market/buy', rateLimit(20), async (c) => {
  const userId = await resolveUser(c.req.header('Authorization'));
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);

  const body = await c.req
    .json<{ genesis_catalog_id?: string }>()
    .catch(() => ({} as { genesis_catalog_id?: string }));
  const genesisId = body.genesis_catalog_id?.trim();
  if (!genesisId) return c.json({ ok: false, error: 'genesis_catalog_id obrigatório.' }, 400);

  // Busca o jogador na fonte autoritativa (Supabase)
  const { data: player, error: fetchErr } = await sb
    .from('genesis_market_players')
    .select('id, mint_overall, listed_on_market')
    .eq('id', genesisId)
    .maybeSingle();

  if (fetchErr || !player) return c.json({ ok: false, error: 'Jogador não encontrado.' }, 404);
  if (!player.listed_on_market) return c.json({ ok: false, error: 'Jogador não está à venda.' }, 409);

  const mintOverall = player.mint_overall as number;
  const priceExp = genesisListingPriceExp(mintOverall);

  // Tenta registar a compra (unique constraint impede duplicados)
  const { error: insertErr } = await sb.from('market_purchases').insert({
    user_id: userId,
    genesis_id: genesisId,
    price_exp: priceExp,
    mint_overall: mintOverall,
  });

  if (insertErr) {
    // Código 23505 = violação de unique (compra duplicada).
    // Cleanup defensivo: a listagem PRECISA ficar listed_on_market=false
    // mesmo nesse caminho — saves antigos podem ter ficado com
    // market_purchases inserido mas listed_on_market ainda true, deixando
    // o jogador aparecendo no mercado e o usuário travado em "já adquirido".
    if (insertErr.code === '23505') {
      await sb
        .from('genesis_market_players')
        .update({ listed_on_market: false })
        .eq('id', genesisId);
      return c.json({
        ok: false,
        error: 'Jogador já adquirido.',
        genesis_id: genesisId,
        price_exp: priceExp,
        mint_overall: mintOverall,
        already_purchased: true,
      }, 409);
    }
    console.error('[market/buy] insert error:', insertErr.message);
    return c.json({ ok: false, error: 'Erro ao registar compra.' }, 500);
  }

  // Tira do mercado pra ninguém mais comprar a mesma carta.
  const { error: unlistErr } = await sb
    .from('genesis_market_players')
    .update({ listed_on_market: false })
    .eq('id', genesisId);
  if (unlistErr) {
    // Compra já está registada — não falhar aqui, só logar.
    console.error('[market/buy] unlist error:', unlistErr.message);
  }

  return c.json({ ok: true, price_exp: priceExp, mint_overall: mintOverall });
});

/**
 * POST /api/market/buy-prospect
 *
 * Compra atômica de uma listagem de Academia OLE (jogador `mgr_*` criado por
 * outro manager). Atravessa dois usuários — comprador (auth) e vendedor
 * (dono da listagem em academy_managers.club_id).
 *
 * Sequência:
 *   1. Resolve buyer_user_id pelo JWT.
 *   2. Busca listing em academy_managers (precisa estar listed_on_market=true).
 *   3. Resolve seller_user_id pela tabela profiles (profiles.club_id = listing.club_id).
 *   4. Rejeita auto-compra.
 *   5. LOCK: flip listed_on_market = false WHERE listing_id AND listed_on_market=true.
 *      Se afetar 0 linhas, alguém comprou primeiro → 409 stale.
 *   6. Adiciona player_snapshot ao manager_squad do comprador (upsert).
 *   7. Remove jogador (mesmo id) do manager_squad do vendedor (se ele tinha
 *      o save persistido).
 *   8. Insere wallet_credits row pro vendedor (EXP a creditar quando ele logar).
 *   9. Retorna o snapshot + price_exp pro cliente dispatchar BUY_MANAGER_PROSPECT
 *      localmente (debita EXP, adiciona ao state.players).
 *
 * Falha parcial: se passo 6/7/8 falhar depois do lock, tentamos rollback do lock
 * (restaurar listed_on_market=true). Não é uma transação real (Supabase JS não
 * suporta multi-statement), mas o lock idempotente é o ponto-chave anti-race.
 *
 * Body: { listing_id: string }
 * Auth: Authorization: Bearer <jwt>
 */
marketRoutes.post('/api/market/buy-prospect', rateLimit(20), async (c) => {
  const buyerId = await resolveUser(c.req.header('Authorization'));
  if (!buyerId) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);

  const body = await c.req
    .json<{ listing_id?: string }>()
    .catch(() => ({} as { listing_id?: string }));
  const listingId = body.listing_id?.trim();
  if (!listingId) return c.json({ ok: false, error: 'listing_id obrigatório.' }, 400);

  // 1) Busca a listagem
  const { data: listing, error: fetchErr } = await sb
    .from('academy_managers')
    .select('id, listing_id, club_id, game_player_id, price_exp, player_snapshot, listed_on_market')
    .eq('listing_id', listingId)
    .maybeSingle();
  if (fetchErr || !listing) {
    return c.json({ ok: false, error: 'Listagem não encontrada.' }, 404);
  }
  if (!listing.listed_on_market) {
    return c.json({ ok: false, error: 'Listagem já não está disponível.' }, 409);
  }

  // 2) Resolve seller_user_id via profiles
  const { data: sellerProfile, error: sellerErr } = await sb
    .from('profiles')
    .select('id')
    .eq('club_id', listing.club_id)
    .maybeSingle();
  if (sellerErr || !sellerProfile?.id) {
    return c.json({ ok: false, error: 'Vendedor não encontrado.' }, 404);
  }
  const sellerId = sellerProfile.id as string;
  if (sellerId === buyerId) {
    return c.json({ ok: false, error: 'Não dá pra comprar tua própria listagem.' }, 400);
  }

  const priceExp = Number(listing.price_exp);
  const gamePlayerId = String(listing.game_player_id);
  const snapshot = listing.player_snapshot as Record<string, unknown> & { id: string };

  // 3) LOCK atômico — só vence se ainda estava listed_on_market=true
  const { data: locked, error: lockErr } = await sb
    .from('academy_managers')
    .update({ listed_on_market: false })
    .eq('listing_id', listingId)
    .eq('listed_on_market', true)
    .select('id');
  if (lockErr) {
    return c.json({ ok: false, error: 'Erro ao reservar listagem.', detail: lockErr.message }, 500);
  }
  if (!locked || locked.length === 0) {
    return c.json({ ok: false, error: 'Listagem já vendida.' }, 409);
  }

  // Helper rollback se uma etapa pós-lock falhar
  const rollbackLock = async () => {
    await sb.from('academy_managers').update({ listed_on_market: true }).eq('listing_id', listingId);
  };

  // 4) Adiciona o snapshot ao manager_squad do comprador
  const { data: buyerSquad } = await sb
    .from('manager_squad')
    .select('players, lineup, formation_scheme')
    .eq('user_id', buyerId)
    .maybeSingle();
  const buyerPlayers = Array.isArray(buyerSquad?.players) ? (buyerSquad!.players as Array<{ id: string }>) : [];
  if (buyerPlayers.some((p) => p.id === gamePlayerId)) {
    // Comprador já tem o jogador no save remoto — só destrava a listagem
    // e devolve sucesso "idempotente". Frontend self-heal cobre o resto.
    return c.json({
      ok: true,
      already_owned: true,
      player_snapshot: snapshot,
      price_exp: priceExp,
      seller_user_id: sellerId,
    });
  }
  const newBuyerPlayers = [...buyerPlayers, snapshot];
  const { error: addBuyerErr } = await sb.from('manager_squad').upsert(
    {
      user_id: buyerId,
      players: newBuyerPlayers,
      lineup: buyerSquad?.lineup ?? {},
      formation_scheme: buyerSquad?.formation_scheme ?? null,
    },
    { onConflict: 'user_id' },
  );
  if (addBuyerErr) {
    await rollbackLock();
    return c.json({ ok: false, error: 'Falha ao adicionar ao plantel do comprador.', detail: addBuyerErr.message }, 500);
  }

  // 5) Remove o snapshot do manager_squad do vendedor (best-effort)
  const { data: sellerSquad } = await sb
    .from('manager_squad')
    .select('players, lineup, formation_scheme')
    .eq('user_id', sellerId)
    .maybeSingle();
  if (sellerSquad) {
    const sellerPlayers = Array.isArray(sellerSquad.players) ? (sellerSquad.players as Array<{ id: string }>) : [];
    const sellerLineup = (sellerSquad.lineup ?? {}) as Record<string, string>;
    const nextSellerPlayers = sellerPlayers.filter((p) => p.id !== gamePlayerId);
    const nextSellerLineup: Record<string, string> = {};
    for (const [slot, pid] of Object.entries(sellerLineup)) {
      if (pid !== gamePlayerId) nextSellerLineup[slot] = pid;
    }
    const { error: removeSellerErr } = await sb.from('manager_squad').upsert(
      {
        user_id: sellerId,
        players: nextSellerPlayers,
        lineup: nextSellerLineup,
        formation_scheme: sellerSquad.formation_scheme ?? null,
      },
      { onConflict: 'user_id' },
    );
    if (removeSellerErr) {
      console.error('[market/buy-prospect] remove from seller failed:', removeSellerErr.message);
      // Não rollbackeamos — comprador já recebeu. Vendedor terá entrada extra
      // até logar de novo (a row de academy_managers já está listed=false).
    }
  }

  // 6) Credita EXP pro vendedor via wallet_credits (aplicado quando ele logar)
  const { error: creditErr } = await sb.from('wallet_credits').insert({
    user_id: sellerId,
    bro_cents: 0,
    exp_amount: priceExp,
    reason: `academy_sale:${listingId}`,
  });
  if (creditErr) {
    console.error('[market/buy-prospect] credit seller failed:', creditErr.message);
    // Não rollbackeamos a venda — preferimos logar e investigar manualmente.
  }

  return c.json({
    ok: true,
    player_snapshot: snapshot,
    price_exp: priceExp,
    seller_user_id: sellerId,
  });
});

/**
 * POST /api/market/buy-legacy
 * Compra de um legacy player com dedução de OLE ATÔMICA no servidor (autoritativa).
 * Evita a corrida do client-only, onde o player grudava no manager_squad mas o
 * desconto no manager_game_state.finance se perdia. Espelha buy-prospect.
 *
 * Body: { legacy_id, player } — player é o PlayerEntity já montado no client
 * (atributos vêm da row); o servidor valida PREÇO e unicidade e debita o OLE.
 */
marketRoutes.post('/api/market/buy-legacy', rateLimit(20), async (c) => {
  const buyerId = await resolveUser(c.req.header('Authorization'));
  if (!buyerId) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);

  const body = await c.req
    .json<{ legacy_id?: string; player?: Record<string, unknown> & { id?: string }; clubName?: string }>()
    .catch(() => ({} as { legacy_id?: string; player?: { id?: string }; clubName?: string }));
  const legacyId = body.legacy_id?.trim();
  const player = body.player;
  const clubName = typeof body.clubName === 'string' ? body.clubName.trim().slice(0, 40) : '';
  if (!legacyId || !player?.id) return c.json({ ok: false, error: 'legacy_id e player obrigatórios.' }, 400);
  if (player.id !== legacyId) return c.json({ ok: false, error: 'player.id não confere com legacy_id.' }, 400);

  // 1) Row do legacy — PREÇO autoritativo + disponibilidade
  const { data: row, error: rowErr } = await sb
    .from('legacy_players')
    .select('id, name, price_bro_cents, currency, listed_on_market, beneficiary_user_id, payment_split')
    .eq('id', legacyId)
    .maybeSingle();
  if (rowErr || !row) return c.json({ ok: false, error: 'Legacy não encontrado.' }, 404);
  if (!row.listed_on_market) return c.json({ ok: false, error: 'Não está à venda.' }, 409);

  // Card em USDT se compra por PIX e nasce com price_bro_cents = 0 (o import só
  // espelha o preço quando a moeda é OLEFOOT). Sem esta guarda, um card de US$5
  // caía no piso de 1 unidade e era vendido por 1 OLEFOOT.
  const currency = (row as { currency?: string | null }).currency ?? 'OLEFOOT';
  if (currency !== 'OLEFOOT') {
    return c.json({ ok: false, error: 'Este card é vendido via PIX, não por OLEFOOT.' }, 409);
  }
  const price = Math.round(Number(row.price_bro_cents));
  if (!Number.isFinite(price) || price <= 0) {
    return c.json({ ok: false, error: 'Preço indisponível para este card.' }, 409);
  }

  // 2) Já possui? (idempotente) — lê o squad
  const { data: sq } = await sb
    .from('manager_squad')
    .select('players, lineup, formation_scheme')
    .eq('user_id', buyerId)
    .maybeSingle();
  const players = Array.isArray(sq?.players) ? (sq!.players as Array<{ id: string }>) : [];
  if (players.some((p) => p.id === legacyId)) {
    return c.json({ ok: true, already_owned: true, price });
  }

  // 3) Saldo OLEFOOT — a moeda dos legacies é o OLEFOOT (=OLE) do snapshot v1
  //    (legacy_olefoot_credits, 18 decimais em wei). É o saldo que a Wallet
  //    mostra como "Olefoot". EXP (manager_game_state.finance.ole) é OUTRA moeda
  //    e NÃO é tocada aqui.
  const { data: credit } = await sb
    .from('legacy_olefoot_credits')
    .select('balance_human')
    .eq('user_id', buyerId)
    .maybeSingle();
  const balanceHuman = String(credit?.balance_human ?? '0');
  const [intRaw, fracRaw = ''] = balanceHuman.split('.');
  const intPart = BigInt(intRaw || '0');
  const fracPart = (fracRaw + '0'.repeat(18)).slice(0, 18); // normaliza p/ 18 casas
  const origWei = (intPart * 10n ** 18n + BigInt(fracPart)).toString();
  if (!credit || intPart < BigInt(price)) {
    return c.json({ ok: false, error: 'Saldo OLEFOOT insuficiente.', olefoot: balanceHuman, price }, 402);
  }

  // 4) ATÔMICO-ish: debita OLEFOOT e entrega o player. Rollback se o squad falhar.
  const newInt = intPart - BigInt(price);
  const newHuman = `${newInt.toString()}.${fracPart}`;
  const newWei = (newInt * 10n ** 18n + BigInt(fracPart)).toString();
  const { error: credErr } = await sb
    .from('legacy_olefoot_credits')
    .update({ balance_human: newHuman, balance_wei: newWei })
    .eq('user_id', buyerId);
  if (credErr) return c.json({ ok: false, error: 'Falha ao debitar OLEFOOT.', detail: credErr.message }, 500);

  const { error: sqErr } = await sb.from('manager_squad').upsert(
    {
      user_id: buyerId,
      players: [...players, { ...player, listedOnMarket: false }],
      lineup: (sq?.lineup ?? {}) as Record<string, string>,
      formation_scheme: sq?.formation_scheme ?? null,
    },
    { onConflict: 'user_id' },
  );
  if (sqErr) {
    // Rollback do débito OLEFOOT — o player não foi entregue.
    await sb
      .from('legacy_olefoot_credits')
      .update({ balance_human: balanceHuman, balance_wei: origWei })
      .eq('user_id', buyerId);
    return c.json({ ok: false, error: 'Falha ao entregar o jogador.', detail: sqErr.message }, 500);
  }

  // 4b) PONTE 1+3 — repasse ao DONO da lenda + registro canônico da venda.
  //     Na compra por OLEFOOT o dono não recebia nada. Agora: credita a fatia
  //     'player' do payment_split no saldo OLEFOOT do beneficiário e materializa
  //     a venda em card_sales (fonte confiável por card+dono do PLAYERVIP).
  //     Best-effort: nunca bloqueia a entrega já concluída (card_sales é o ledger).
  const splitArr = Array.isArray(row.payment_split) ? (row.payment_split as Array<{ kind?: string; percent?: number }>) : [];
  const playerPct = Number(splitArr.find((e) => e.kind === 'player')?.percent ?? 50);
  const ownerCut = Math.floor((price * playerPct) / 100);
  const beneficiaryId = (row as { beneficiary_user_id?: string | null }).beneficiary_user_id ?? null;
  if (beneficiaryId && ownerCut > 0) {
    try {
      const { data: ownerCredit } = await sb
        .from('legacy_olefoot_credits')
        .select('balance_human')
        .eq('user_id', beneficiaryId)
        .maybeSingle();
      const ownerHuman = String(ownerCredit?.balance_human ?? '0');
      const [oInt, oFrac = ''] = ownerHuman.split('.');
      const oIntPart = BigInt(oInt || '0');
      const oFracPart = (oFrac + '0'.repeat(18)).slice(0, 18);
      const newOwnerInt = oIntPart + BigInt(ownerCut);
      const newOwnerHuman = `${newOwnerInt.toString()}.${oFracPart}`;
      const newOwnerWei = (newOwnerInt * 10n ** 18n + BigInt(oFracPart)).toString();
      await sb
        .from('legacy_olefoot_credits')
        .upsert(
          { user_id: beneficiaryId, balance_human: newOwnerHuman, balance_wei: newOwnerWei },
          { onConflict: 'user_id' },
        );
    } catch (e) {
      console.warn('[buy-legacy] repasse OLEFOOT ao dono falhou (ignorado):', e);
    }
  }
  try {
    await sb.rpc('record_olefoot_card_sale', {
      p_legacy_player_id: legacyId,
      p_beneficiary: beneficiaryId,
      p_buyer: buyerId,
      p_gross_cents: price,
      p_owner_cents: ownerCut,
    });
  } catch (e) {
    console.warn('[buy-legacy] record_olefoot_card_sale falhou (ignorado):', e);
  }

  // 5) Registro da venda (best-effort — NUNCA bloqueia a entrega já concluída).
  //    Torna a "camada ao vivo" do mercado REAL: (a) incrementa o lote aberto,
  //    fazendo a escassez andar e disparando emit_next_lot ao esgotar; (b) grava
  //    atividade real pro ticker (substitui o feed NPC por compras de verdade).
  try {
    const { data: lot } = await sb
      .from('legacy_player_lots')
      .select('lot_id, sold')
      .eq('legacy_player_id', legacyId)
      .eq('status', 'open')
      .maybeSingle();
    if (lot) {
      await sb
        .from('legacy_player_lots')
        .update({ sold: (Number((lot as { sold?: number }).sold) || 0) + 1 })
        .eq('lot_id', (lot as { lot_id: string }).lot_id);
    }
  } catch (e) {
    console.warn('[buy-legacy] sold++ falhou (ignorado):', e);
  }
  try {
    const ovr = Number((player as { mintOverall?: number }).mintOverall) || null;
    const pos = typeof (player as { pos?: string }).pos === 'string' ? (player as { pos: string }).pos : null;
    await sb.from('market_activities').insert({
      type: 'purchase',
      manager_id: buyerId,
      manager_name: clubName || 'Um manager',
      club_name: clubName || null,
      player_name: row.name,
      player_ovr: ovr,
      player_pos: pos,
      price_exp: price,
      legacy_player_id: legacyId,
    });
  } catch (e) {
    console.warn('[buy-legacy] activity insert falhou (ignorado):', e);
  }

  return c.json({ ok: true, olefoot: newHuman, price, player });
});
