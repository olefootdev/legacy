-- ═══════════════════════════════════════════════════════════════════════════
-- CARD NO PIX: O DINHEIRO SAI DO SERVIDOR — EM BRO, NÃO EM REAL
--
-- Dois furos achados em 2026-09-30, os dois no ramo `card` da confirmação:
--
--   A) o split creditava `floor(amount_cents × pct/100)` em `bro_cents` — mas
--      `amount_cents` é centavo de REAL (o Pix), e 1 BRO = 1 dólar desde a
--      Fase 0. Cada venda distribuía ~5,5× o preço do card (a cotação).
--      Medido: card de $5 → R$ 27,68 → 1384 "BRO" na fatia de 50%, quando o
--      certo são 250.
--   B) o jogador entregue saía de `metadata->'player'` — e `metadata` entra
--      pelo RPC `create_payment_intent`, executável por qualquer conta logada:
--      ficha montada pelo cliente, OVR à escolha de quem paga.
--
-- A correção replica o padrão que a Fase 0 fixou pra recarga e pré-venda: o
-- servidor congela `server_data.card` (preço em dólar, cotação, jogador
-- saneado) na criação da intent, com a service_role; a confirmação lê DALI e
-- ESTOURA se faltar. Intent criada pelo servidor antigo fica PENDENTE (o
-- reconcile confirma depois do deploy) — a mesma janela da RECARGA_SEM_COTACAO.
--
-- As duas funções abaixo são cópia da fonte (Regra 3): confirm_payment_intent
-- de 20260930120000, trg_record_card_sale_from_split de 20260717210000 — cada
-- troca aplicada por script casando exatamente 1 vez.
-- ═══════════════════════════════════════════════════════════════════════════

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
  v_card jsonb;
  v_bro_total bigint;
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

  -- ─── CARD: split em BRO + entrega, os dois lidos de server_data ──────────
  if v_intent.product_kind = 'card' then
    select * into v_legacy from public.legacy_players where id = v_intent.product_ref;
    if v_legacy is null then
      raise exception 'CARD_LEGACY_NOT_FOUND: %', v_intent.product_ref;
    end if;

    -- 🔑 Números e jogador vêm de `server_data` (escrita só da service role),
    -- no MESMO padrão da recarga lá embaixo: faltando, a função ESTOURA em vez
    -- de cair em fallback. `amount_cents` é centavo de REAL — o que o Pix
    -- cobrou — e creditá-lo como BRO (= dólar) pagava ~5,5× a mais.
    v_card := v_intent.server_data -> 'card';
    if v_card is null then
      raise exception 'CARD_SEM_DADOS_DO_SERVIDOR: intent %', v_intent.id;
    end if;
    v_bro_total := nullif(v_card ->> 'usd_cents', '')::bigint;
    if v_bro_total is null or v_bro_total <= 0 then
      raise exception 'CARD_SEM_PRECO_EM_DOLAR: intent %', v_intent.id;
    end if;
    -- Sanidade: com dólar acima de R$ 1, o preço em BRO é sempre MENOR que o
    -- valor pago em centavos de real.
    if v_bro_total > v_intent.amount_cents then
      raise exception 'CARD_ACIMA_DO_PAGO: % BRO por % centavos de real', v_bro_total, v_intent.amount_cents;
    end if;

    -- 3a) Split: credita cada beneficiário com user_id (pendente → cliente
    --     coleta), em CENTAVOS DE BRO — fatias do preço do card em dólar.
    for v_item in select value from jsonb_array_elements(coalesce(v_legacy.payment_split, '[]'::jsonb)) loop
      v_uid := nullif(v_item->>'user_id', '')::uuid;
      v_pct := coalesce((v_item->>'percent')::numeric, 0);
      if v_uid is not null and v_pct > 0 then
        insert into public.wallet_credits (user_id, bro_cents, exp_amount, reason, applied_at)
        values (
          v_uid,
          floor(v_bro_total * v_pct / 100.0)::bigint,
          0,
          'card_split:' || v_intent.id::text || ':' || coalesce(v_item->>'kind', 'x'),
          null
        );
      end if;
    end loop;

    -- 3b) Entrega o jogador no manager_squad do comprador (idempotente por
    --     id). A ficha vem de `server_data`: `metadata` entra pelo RPC de
    --     criação, executável por qualquer conta logada — ficha montada pelo
    --     cliente é OVR à escolha do comprador.
    v_player := v_card -> 'player';
    if v_player is null then
      raise exception 'CARD_PLAYER_SEM_DADOS_DO_SERVIDOR: intent %', v_intent.id;
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


-- ─── card_sales: o bruto da venda em BRO de verdade ───────────────────────
create or replace function public.trg_record_card_sale_from_split()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_intent uuid;
  v_role text;
  v_pi record;
  v_collection text;
begin
  if new.reason is null or new.reason not like 'card_split:%' then
    return new;
  end if;
  v_role := split_part(new.reason, ':', 3);
  -- olefoot/community entram agora: são a receita da plataforma, e sem elas o
  -- painel nunca fecha com o valor bruto da venda.
  if v_role not in ('player', 'facilitator', 'olefoot', 'community') then
    return new;
  end if;

  begin
    v_intent := split_part(new.reason, ':', 2)::uuid;
  exception when others then
    return new;
  end;

  select * into v_pi from public.payment_intents where id = v_intent;
  if v_pi is null then return new; end if;

  select collection_id into v_collection from public.legacy_players where id = v_pi.product_ref;

  insert into public.card_sales (
    legacy_player_id, collection_id, beneficiary_user_id, buyer_user_id,
    currency, gross_cents, owner_cents, payment_method, role, source_ref
  ) values (
    v_pi.product_ref, v_collection, new.user_id, v_pi.user_id,
    -- O bruto é o preço do card em dólar (= BRO), congelado em server_data;
    -- venda antiga (sem server_data) fica com o amount_cents da época.
    'BRO', coalesce(nullif(v_pi.server_data -> 'card' ->> 'usd_cents', '')::bigint, v_pi.amount_cents),
    new.bro_cents, 'pix', v_role,
    'pixcard:' || v_intent::text || ':' || v_role || ':' || new.user_id::text
  ) on conflict (source_ref) do nothing;

  return new;
end;
$$;

-- Replace preserva as portas, mas a regra é dizê-las: confirmação e trigger
-- são do servidor; nenhum cliente executa.
revoke all on function public.confirm_payment_intent(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_payment_intent(uuid, text) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — uma venda REAL de card num savepoint que termina em raise.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_chegou boolean := false;
  v_comprador uuid;
  v_ref text;
  v_split jsonb;
  v_i1 uuid;
  v_i2 uuid;
  v_esperado numeric;
  v_soma numeric;
begin
  select p.id into v_comprador from public.profiles p
   where exists (select 1 from auth.users u where u.id = p.id)
   limit 1;
  if v_comprador is null then
    raise notice 'sem conta neste ambiente: verificação do card pulada';
    return;
  end if;

  begin
    -- Um card com split de verdade: o que existir; senão, um de verificação.
    select l.id, l.payment_split into v_ref, v_split
      from public.legacy_players l
     where l.payment_split is not null
       and exists (select 1 from jsonb_array_elements(l.payment_split) e
                    where nullif(e->>'user_id', '') is not null
                      and coalesce((e->>'percent')::numeric, 0) > 0)
     limit 1;
    if v_ref is null then
      insert into public.legacy_players (id, name, payment_split)
      values ('verifica-card-bro', 'Verificação', jsonb_build_array(
        jsonb_build_object('kind', 'player', 'percent', 50, 'user_id', v_comprador),
        jsonb_build_object('kind', 'olefoot', 'percent', 50, 'user_id', v_comprador)))
      returning id, payment_split into v_ref, v_split;
    end if;

    -- Pagou R$ 27,68 por um card de $5: o split reparte 500, nunca 2768 — e a
    -- entrega ignora o player que o metadata (cliente) tentou empurrar.
    insert into public.payment_intents
      (user_id, external_id, product_kind, product_ref, amount_cents, metadata, server_data)
    values
      (v_comprador, 'verifica-card-bro-1', 'card', v_ref, 2768,
       jsonb_build_object('player', jsonb_build_object('id', 'verifica-metadata-nao-entrega', 'mintOverall', '99')),
       jsonb_build_object('card', jsonb_build_object('usd_cents', '500',
         'player', jsonb_build_object('id', 'verifica-server-data', 'name', 'Verificação'))))
    returning id into v_i1;

    perform * from public.confirm_payment_intent(v_i1, null);

    select coalesce(sum(floor(500 * (e->>'percent')::numeric / 100.0)), 0) into v_esperado
      from jsonb_array_elements(v_split) e
     where nullif(e->>'user_id', '') is not null and coalesce((e->>'percent')::numeric, 0) > 0;
    select coalesce(sum(bro_cents), 0) into v_soma from public.wallet_credits
     where reason like 'card_split:' || v_i1::text || ':%';
    if v_soma is distinct from v_esperado or v_soma <= 0 then
      raise exception 'split em BRO errado: esperava %, veio %', v_esperado, v_soma;
    end if;

    if not exists (select 1 from public.manager_squad ms, jsonb_array_elements(ms.players) e
                    where ms.user_id = v_comprador and e->>'id' = 'verifica-server-data') then
      raise exception 'o jogador do server_data não foi entregue';
    end if;
    if exists (select 1 from public.manager_squad ms, jsonb_array_elements(ms.players) e
                where ms.user_id = v_comprador and e->>'id' = 'verifica-metadata-nao-entrega') then
      raise exception 'a entrega leu o metadata do cliente';
    end if;
    if to_regclass('public.card_sales') is not null then
      if exists (select 1 from public.card_sales
                  where source_ref like 'pixcard:' || v_i1::text || ':%' and gross_cents <> 500) then
        raise exception 'card_sales gravou o bruto em real, não em BRO';
      end if;
    end if;

    -- Sem server_data o Pix fica PENDENTE: estoura, nunca credita 1:1.
    insert into public.payment_intents
      (user_id, external_id, product_kind, product_ref, amount_cents, metadata)
    values (v_comprador, 'verifica-card-bro-2', 'card', v_ref, 2768,
            jsonb_build_object('player', jsonb_build_object('id', 'x')))
    returning id into v_i2;
    begin
      perform * from public.confirm_payment_intent(v_i2, null);
      raise exception 'intent sem server_data confirmou';
    exception when others then
      if sqlerrm not like 'CARD_SEM_DADOS_DO_SERVIDOR%' then raise; end if;
    end;

    v_chegou := true;
    raise exception 'DESFAZ_A_VERIFICACAO';
  exception when others then
    if sqlerrm <> 'DESFAZ_A_VERIFICACAO' then raise; end if;
  end;

  if not v_chegou then raise exception 'a verificação não chegou ao fim'; end if;
  if exists (select 1 from public.payment_intents where external_id like 'verifica-card-bro-%') then
    raise exception 'a verificação deixou rastro';
  end if;
end $$;
