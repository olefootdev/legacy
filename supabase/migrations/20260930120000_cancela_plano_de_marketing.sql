-- ═══════════════════════════════════════════════════════════════════════════
-- O PLANO DE MARKETING ANTIGO SAI — FICA SÓ A EXPANSÃO
--
-- Decisão do fundador em 2026-09-30: "precisamos cancelar aquele plano de
-- marketing e deixar apenas o plano de expansão atual".
--
-- O plano antigo, e o que ele tinha em produção quando saiu (medido no dia):
--   · comissão de 5% em três níveis sobre compra de card .... 0 comissões
--   · pack de ativação de R$ 125 ........................... 1 ativação
--   · carreira "Cash Only" com bônus em dólar .............. 0 progressos
--   · marcos da rede em EXP ................................. 1 resgate
--   · super-bônus de 5% sobre depósito ...... já desligado na Fase 0
-- Ninguém tem saldo pendente em nenhum deles. O histórico fica nas tabelas,
-- intocado; o que sai é o caminho que GERA e o que RESGATA.
--
-- 🔑 O que NÃO sai, e por quê:
--   · `profiles.referred_by_code` e o código de cadastro: é por eles que quem
--     compra um pack sem convite acha o patrocinador na árvore da expansão.
--   · `get_my_referrals` / `get_my_referral_code`: leituras, sem dinheiro.
--   · `get_my_affiliate_commissions`: o PLAYERVIP lê (e hoje lê zero).
--   · o split do card: é a parte da LENDA na venda, não comissão de rede.
--
-- Revogar em vez de dropar: é reversível com um `grant`, e o histórico dessas
-- tabelas continua explicável pelo código que o escreveu.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── confirmar: sem comissão de card, sem ativação ────────────────────────
create or replace function public.confirm_payment_intent(
  p_intent_id uuid,
  p_abacate_id text default null
)
returns table (
  intent_id uuid,
  status text,
  wallet_credit_id uuid,
  activation_id uuid,
  was_already_paid boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent record;
  v_credit_id uuid;
  v_activation_id uuid;
  v_was_paid boolean := false;
  v_legacy record;
  v_item jsonb;
  v_uid uuid;
  v_pct numeric;
  v_player jsonb;
  v_players jsonb;
  v_pagamento text;
  v_ps jsonb;
  v_r record;
  v_olexp numeric;
  v_bro bigint;
begin
  select * into v_intent from public.payment_intents where id = p_intent_id for update;
  if v_intent is null then
    raise exception 'PAYMENT_INTENT_NOT_FOUND';
  end if;

  -- Idempotência
  if v_intent.status = 'paid' then
    v_was_paid := true;
    select id into v_credit_id from public.wallet_credits
     where user_id = v_intent.user_id and reason = 'pix_payment:' || v_intent.id::text
     order by created_at desc limit 1;
    return query select v_intent.id, v_intent.status, v_credit_id, v_activation_id, v_was_paid;
    return;
  end if;

  -- 🔴 Um pagamento confirma UMA intent. `update_payment_intent_charge` deixa o
  -- dono gravar o id do pagamento na própria intent, então sem esta trava o
  -- mesmo Pix confirmaria duas — a legítima e uma montada à mão. O índice
  -- único `payment_intents_pagamento_unico` garante o mesmo sob concorrência.
  v_pagamento := coalesce(p_abacate_id, v_intent.abacate_id);
  if v_pagamento is not null and exists (
    select 1 from public.payment_intents outra
     where outra.abacate_id = v_pagamento and outra.status = 'paid' and outra.id <> p_intent_id
  ) then
    raise exception 'PAGAMENTO_JA_USADO: % já confirmou outra intent', v_pagamento;
  end if;

  update public.payment_intents
     set status = 'paid', paid_at = now(),
         abacate_id = coalesce(p_abacate_id, abacate_id), updated_at = now()
   where id = p_intent_id;

  -- ─── CARD: split + entrega + comissão do comprador (sem creditar o comprador) ───
  if v_intent.product_kind = 'card' then
    select * into v_legacy from public.legacy_players where id = v_intent.product_ref;
    if v_legacy is null then
      raise exception 'CARD_LEGACY_NOT_FOUND: %', v_intent.product_ref;
    end if;

    -- 3a) Split: credita cada beneficiário com user_id (pendente → cliente coleta)
    for v_item in select value from jsonb_array_elements(coalesce(v_legacy.payment_split, '[]'::jsonb)) loop
      v_uid := nullif(v_item->>'user_id', '')::uuid;
      v_pct := coalesce((v_item->>'percent')::numeric, 0);
      if v_uid is not null and v_pct > 0 then
        insert into public.wallet_credits (user_id, bro_cents, exp_amount, reason, applied_at)
        values (
          v_uid,
          floor(v_intent.amount_cents * v_pct / 100.0)::bigint,
          0,
          'card_split:' || v_intent.id::text || ':' || coalesce(v_item->>'kind', 'x'),
          null
        );
      end if;
    end loop;

    -- 3b) Entrega o jogador no manager_squad do comprador (idempotente por id)
    v_player := v_intent.metadata->'player';
    if v_player is null then
      raise exception 'CARD_PLAYER_MISSING_IN_METADATA';
    end if;
    select players into v_players from public.manager_squad where user_id = v_intent.user_id;
    if v_players is null then
      insert into public.manager_squad (user_id, players, lineup)
      values (v_intent.user_id, jsonb_build_array(v_player), '{}'::jsonb)
      on conflict (user_id) do update set players = jsonb_build_array(v_player), updated_at = now();
    elsif not exists (
      select 1 from jsonb_array_elements(v_players) e where e->>'id' = v_player->>'id'
    ) then
      update public.manager_squad
         set players = v_players || jsonb_build_array(v_player), updated_at = now()
       where user_id = v_intent.user_id;
    end if;

    -- 3c) A comissão de 5% em três níveis na cadeia do comprador SAIU com o
    --     plano de marketing antigo, cancelado pelo fundador em 2026-09-30. A
    --     rede que paga é a expansão, e só compra de pré-venda gera OLEXP.

    -- 3d) Registro da venda p/ camada ao vivo (BEST-EFFORT — nunca quebra o pagamento).
    begin
      -- 🐞 `status` solto era ambíguo com a coluna de retorno: o contador de
      -- vendidos estourava, o `exception` engolia, e a escassez nunca andou.
      update public.legacy_player_lots lote
         set sold = lote.sold + 1
       where lote.legacy_player_id = v_legacy.id and lote.status = 'open';

      insert into public.market_activities
        (type, manager_id, manager_name, club_name, player_name, player_ovr, player_pos, price_exp)
      values (
        'purchase',
        v_intent.user_id,
        coalesce(nullif(v_intent.metadata->>'clubName', ''), 'Um manager'),
        nullif(v_intent.metadata->>'clubName', ''),
        v_legacy.name,
        nullif(v_player->>'mintOverall', '')::int,
        v_player->>'pos',
        v_intent.amount_cents
      );
    exception when others then
      -- escassez/ticker é secundário; o pagamento e a entrega já estão feitos.
      null;
    end;

    return query select v_intent.id, 'paid'::text, null::uuid, null::uuid, false;
    return;
  end if;

  -- ─── PRÉ-VENDA: posição + entrada na árvore + OLEXP. NÃO gera BRO. ───
  -- Os números vêm de `server_data`, que só a service_role escreve. Nunca de
  -- `metadata`: ela entra pelo RPC de criação, que o cliente pode chamar.
  if v_intent.product_kind = 'presale_pack' then
    v_ps := v_intent.server_data -> 'presale';
    if v_ps is null then
      raise exception 'PRESALE_SEM_DADOS_DO_SERVIDOR: intent %', v_intent.id;
    end if;

    select * into v_r from public.presale_creditar(
      v_intent.user_id, v_intent.external_id,
      (v_ps ->> 'usd_cents')::integer, (v_ps ->> 'brl_cents')::bigint,
      (v_ps ->> 'brl_por_usd_micro')::bigint,
      (v_ps ->> 'tokens_entregues')::numeric, (v_ps ->> 'tokens_brutos')::numeric);
    if not v_r.creditou and v_r.motivo is distinct from 'ref_ja_creditado' then
      raise exception 'PRESALE_NAO_CREDITOU: %', v_r.motivo;
    end if;

    -- Entra ANTES de creditar: é a primeira compra que dá volume a quem está
    -- acima, e creditar antes de existir o nó não acharia ancestral nenhum.
    perform public.expansao_entrar_por_compra(v_intent.user_id);

    v_olexp := public.expansao_olexp_da_compra((v_ps ->> 'usd_cents')::integer);
    if v_olexp > 0 then
      perform public.expansao_creditar(
        v_intent.user_id, v_olexp, 'compra_olefoot', v_intent.external_id);
    end if;

    return query select v_intent.id, 'paid'::text, null::uuid, null::uuid, false;
    return;
  end if;

  -- ─── recharge / activation_pack: credita o comprador ───
  -- 1 BRO = 1 dólar. A conversão foi feita pelo servidor na hora em que o
  -- preço apareceu pra pessoa, e está congelada em `server_data`. Sem ela a
  -- função ESTOURA em vez de creditar 1:1 — creditar centavo de real como
  -- centavo de dólar entregaria mais de cinco vezes o que foi pago.
  v_bro := nullif(v_intent.server_data -> 'recarga' ->> 'bro_cents', '')::bigint;
  if v_bro is null or v_bro <= 0 then
    raise exception 'RECARGA_SEM_COTACAO: intent % sem server_data.recarga', v_intent.id;
  end if;
  if v_bro > v_intent.amount_cents then
    raise exception 'RECARGA_ACIMA_DO_PAGO: % BRO por % centavos de real', v_bro, v_intent.amount_cents;
  end if;

  -- 🔑 `applied_at` nasce NULO. O cliente só resgata crédito pendente
  -- (`claim_pending_wallet_credits`); nascendo aplicado, o depósito pago
  -- nunca chegava ao saldo.
  insert into public.wallet_credits (user_id, bro_cents, exp_amount, reason, applied_at)
  values (v_intent.user_id, v_bro, 0, 'pix_payment:' || v_intent.id::text, null)
  returning id into v_credit_id;

  -- O pack de ativação de R$ 125 também saiu com o plano antigo. Uma cobrança
  -- dele criada antes e paga depois vira só depósito em BRO: o dinheiro entra,
  -- a ativação que não existe mais não.

  return query select v_intent.id, 'paid'::text, v_credit_id, v_activation_id, v_was_paid;
end;
$$;
revoke execute on function public.confirm_payment_intent(uuid, text) from anon, public, authenticated;

-- ─── a carreira antiga não acumula mais ───────────────────────────────────
drop trigger if exists affiliate_commissions_career_progress_trg on public.affiliate_commissions;

-- ─── ninguém resgata nem compra pelo plano antigo ─────────────────────────
do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.claim_network_milestone(integer)',
    'public.network_milestone_exp(integer)',
    'public.get_my_network_status()',
    'public.claim_career_bonus()',
    'public.get_my_career_progress()',
    'public.career_leaderboard(integer)',
    'public.bro_cents_to_career_points(bigint)',
    'public.purchase_activation_pack(bigint, uuid, text)',
    'public.get_my_activation_status()',
    'public.get_my_premium_cards(boolean)',
    'public.redeem_premium_card(uuid)',
    'public.create_hodl_lock(numeric, text)',
    'public.claim_my_affiliate_commissions(text)',
    'public.count_my_active_referrals()'
  ] loop
    if to_regprocedure(v_fn) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', v_fn);
    end if;
  end loop;
end $$;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — roda junto e derruba tudo se falhar
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_fn text;
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'confirm_payment_intent'
                and (p.prosrc ilike '%affiliate_commissions%' or p.prosrc ilike '%activation_packs%')) then
    raise exception 'confirm_payment_intent ainda gera comissão ou ativação';
  end if;
  if exists (select 1 from pg_trigger where tgname = 'affiliate_commissions_career_progress_trg') then
    raise exception 'a carreira antiga continua acumulando';
  end if;
  foreach v_fn in array array[
    'public.claim_network_milestone(integer)', 'public.claim_career_bonus()',
    'public.purchase_activation_pack(bigint, uuid, text)', 'public.claim_my_affiliate_commissions(text)'
  ] loop
    if to_regprocedure(v_fn) is not null
       and (has_function_privilege('authenticated', v_fn, 'execute')
            or has_function_privilege('anon', v_fn, 'execute')) then
      raise exception '% continua executável pelo cliente', v_fn;
    end if;
  end loop;
end $$;
