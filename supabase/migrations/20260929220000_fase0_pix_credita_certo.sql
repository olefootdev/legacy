-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 0 — O PIX CREDITA CERTO
--
-- Os consertos do caminho do dinheiro, todos medidos em PRODUÇÃO em
-- 2026-09-29 (não só no repositório — as funções de lá diferem das daqui em
-- comentário e quebra de linha, e foram conferidas linha a linha por hash):
--
--  1. `create_payment_intent` recusava `presale_pack`. A migration da pré-venda
--     trocou o CHECK da tabela e esqueceu o `if` de dentro da função: a compra
--     de OLEFOOT morria no primeiro passo com "invalid product_kind".
--  2. O crédito do depósito nascia com `applied_at = now()`, e o cliente só
--     resgata o que está pendente. Depósito pago não chegava ao saldo.
--  3. A pré-venda caía no ramo genérico e TAMBÉM gerava crédito BRO.
--  4. `payment-reconcile` confirma sem chamar `presale_creditar`. Agora a
--     posição é creditada AQUI DENTRO, então quem confirma — webhook ou cron —
--     entrega a mesma coisa.
--  5. O estorno não desfazia posição de pré-venda.
--  6. `expansao_creditar` não tinha chamador: compra nenhuma virava OLEXP.
--  7. Um mesmo pagamento podia confirmar duas intents.
--
-- 🐞 E três defeitos que o teste achou nas funções que JÁ estavam no ar, todos
-- do mesmo tipo: a função devolve uma coluna chamada `status` (ou
-- `wallet_credit_id`) e usa o mesmo nome solto lá dentro, que o plpgsql
-- recusa como ambíguo:
--  8. TODO estorno de intent paga estourava. Zero linhas em payment_refunds
--     até hoje — nunca houve estorno, por isso nunca apareceu.
--  9. A ativação antiga (R$ 125) estourava depois do Pix pago.
-- 10. O contador de cards vendidos por lote nunca andou: o erro caía num
--     `exception when others then null`. Há 1 card pago e a soma é 0.
--
-- E três decisões do fundador, de 2026-09-29:
--  • 1 BRO = 1 dólar, comprado a dólar + 2,5%. Antes o servidor creditava
--    centavo de real como centavo de BRO: R$ 100 viravam 100 BRO "≈ US$ 100".
--  • A comissão de 5% em três níveis sobre DEPÓSITO sai. A de card continua.
--  • Quem compra um pack entra na árvore. $1 comprado = 1 OLEXP.
--
-- 🔴 ORDEM DE DEPLOY: esta migration exige o servidor novo. O antigo cria a
-- intent sem `server_data`, e a confirmação ESTOURA de propósito (ver
-- RECARGA_SEM_COTACAO). O pagamento fica pendente, não some e não credita
-- errado — mas precisa de resgate manual. Publicar o servidor logo em seguida.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── o que só o servidor escreve ──────────────────────────────────────────
-- `metadata` entra por `create_payment_intent`, que é executável por
-- `authenticated`: o cliente pode chamar o RPC direto e pôr o que quiser.
-- Número que vira dinheiro não pode morar ali. `server_data` não tem caminho
-- de escrita pro cliente — a tabela só tem policy de SELECT e nenhum RPC toca
-- nesta coluna.
alter table public.payment_intents add column if not exists server_data jsonb;

comment on column public.payment_intents.server_data is
  'Números autoritativos gravados pela service_role depois de criar a intent '
  '(cotação congelada, BRO a creditar, tokens da pré-venda). '
  'confirm_payment_intent lê DAQUI e nunca de metadata, que o cliente escreve.';

-- ─── um pagamento, uma intent ─────────────────────────────────────────────
create unique index if not exists payment_intents_pagamento_unico
  on public.payment_intents (abacate_id)
  where status = 'paid' and abacate_id is not null;

-- ─── comissão sobre depósito: sai ─────────────────────────────────────────
-- O gatilho pagava 5% em três níveis toda vez que um crédito era RESGATADO.
-- Com o crédito nascendo aplicado ele nunca disparou (0 linhas em
-- affiliate_commissions). O conserto do item 2 o religaria — e a decisão é que
-- a rede nova paga por equiparação, não por depósito.
drop trigger if exists wallet_credits_affiliate_bonus_trg on public.wallet_credits;
drop function if exists public.trg_wallet_credit_affiliate_bonus();

-- ─── criar a intent ───────────────────────────────────────────────────────
create or replace function public.create_payment_intent(
  p_product_kind text,
  p_product_ref text default null,
  p_amount_cents bigint default 12500,
  p_customer_name text default null,
  p_customer_email text default null,
  p_customer_tax_id text default null,
  p_customer_cellphone text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  intent_id uuid,
  external_id text,
  amount_cents bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_intent_id uuid;
  v_external text;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  if p_amount_cents <= 0 then
    raise exception 'amount must be positive';
  end if;

  if p_product_kind not in ('activation_pack', 'card', 'recharge', 'presale_pack') then
    raise exception 'invalid product_kind: %', p_product_kind;
  end if;

  -- external_id determinístico: user + product_kind + timestamp + product_ref
  v_external := 'olefoot_' || v_uid::text || '_' || p_product_kind || '_' ||
                extract(epoch from now())::bigint::text ||
                coalesce('_' || p_product_ref, '');

  insert into public.payment_intents (
    user_id, external_id, product_kind, product_ref,
    amount_cents, customer_name, customer_email, customer_tax_id, customer_cellphone,
    metadata
  )
  values (
    v_uid, v_external, p_product_kind, p_product_ref,
    p_amount_cents, p_customer_name, p_customer_email, p_customer_tax_id, p_customer_cellphone,
    p_metadata
  )
  returning id into v_intent_id;

  return query select v_intent_id, v_external, p_amount_cents;
end;
$$;

-- ─── $1 comprado = 1 OLEXP ────────────────────────────────────────────────
-- Espelha `olexpDaCompra` em server/src/lib/expansao/unidade.ts. Centavo que
-- sobra não vira fração: OLEXP é inteiro, e arredonda pra BAIXO.
create or replace function public.expansao_olexp_da_compra(p_usd_cents integer)
returns numeric language sql immutable set search_path = public
as $$
  select case when p_usd_cents is null or p_usd_cents < 0 then 0::numeric
              else floor(p_usd_cents::numeric / 100) end;
$$;

revoke all on function public.expansao_olexp_da_compra(integer) from public, anon, authenticated;
grant execute on function public.expansao_olexp_da_compra(integer) to service_role;

-- ─── como a pessoa entrou na árvore ───────────────────────────────────────
-- A confirmação guardava um SIM dado num link. Quem entra por compra não deu
-- sim a convite nenhum, e o registro tem que dizer isso em vez de fingir.
alter table public.expansao_confirmacao
  add column if not exists origem text not null default 'convite'
    check (origem in ('convite', 'compra'));

-- ─── quem compra entra na árvore ──────────────────────────────────────────
-- Decisão do fundador: todo mundo que comprar um pack aparece na árvore.
--
-- Embaixo de quem: sobe a indicação do JOGO (`referred_by_code`) até achar o
-- primeiro que já está na árvore E pode convidar. Não achou ninguém → entra
-- sob a raiz. O lado e a vaga saem das mesmas funções do convite
-- (`expansao_entrar`), então o derramamento é o mesmo.
--
-- ⚠️ Quem já está na árvore não é movido: posição é permanente.
create or replace function public.expansao_entrar_por_compra(p_user uuid)
returns table (entrou boolean, motivo text, patrocinador uuid)
language plpgsql security definer set search_path = public
as $$
declare
  v_pat uuid;
  v_pat_username text;
  v_elo record;
  v_r record;
begin
  if exists (select 1 from expansao_no where user_id = p_user) then
    return query select false, 'ja_esta_na_arvore'::text, null::uuid; return;
  end if;

  for v_elo in
    select referrer_id from public.get_referral_chain(p_user, 25) order by level
  loop
    if exists (select 1 from expansao_no where user_id = v_elo.referrer_id)
       and public.expansao_pode_convidar_interno(v_elo.referrer_id) then
      v_pat := v_elo.referrer_id;
      exit;
    end if;
  end loop;

  if v_pat is null then
    select user_id into v_pat from expansao_no
     where pai_id is null order by criado_em, y_ordem limit 1;
  end if;
  if v_pat is null then
    return query select false, 'arvore_sem_raiz'::text, null::uuid; return;
  end if;

  select * into v_r from public.expansao_entrar(p_user, v_pat);
  if not v_r.entrou then
    return query select false, v_r.motivo, v_pat; return;
  end if;

  select username into v_pat_username from profiles where id = v_pat;
  insert into expansao_confirmacao (user_id, patrocinador_id, username_convite, origem)
  values (p_user, v_pat, coalesce(v_pat_username, 'origem'), 'compra')
  on conflict (user_id) do nothing;

  return query select true, null::text, v_pat;
end;
$$;

revoke all on function public.expansao_entrar_por_compra(uuid) from public, anon, authenticated;
grant execute on function public.expansao_entrar_por_compra(uuid) to service_role;

-- ─── confirmar ────────────────────────────────────────────────────────────
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
  v_chain record;
  v_comm bigint;
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

    -- 3c) Comissão de afiliado 5% por nível na cadeia do COMPRADOR
    v_comm := floor(v_intent.amount_cents * 0.05)::bigint;
    if v_comm > 0 then
      for v_chain in select * from public.get_referral_chain(v_intent.user_id, 3) loop
        insert into public.affiliate_commissions (
          referrer_id, referred_id, level, source, source_ref,
          currency, amount_cents, rate, base_amount_cents, status
        ) values (
          v_chain.referrer_id, v_intent.user_id, v_chain.level, 'purchase',
          'card_purchase:' || v_intent.id::text,
          'BRO', v_comm, 0.05, v_intent.amount_cents, 'confirmed'
        ) on conflict (source_ref, level) do nothing;
      end loop;
    end if;

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

  if v_intent.product_kind = 'activation_pack' then
    if not public.is_user_activated(v_intent.user_id) then
      insert into public.activation_packs (
        user_id, amount_cents, currency, source, wallet_credit_id, activated_at
      ) values (v_intent.user_id, 2500, 'BRO', 'purchase', v_credit_id, now())
      -- 🐞 `on conflict (wallet_credit_id)` era ambíguo com a coluna de retorno
      -- e derrubava a ativação inteira depois do Pix pago.
      on conflict do nothing
      returning id into v_activation_id;
    end if;
  end if;

  return query select v_intent.id, 'paid'::text, v_credit_id, v_activation_id, v_was_paid;
end;
$$;

revoke execute on function public.confirm_payment_intent(uuid, text) from anon, public, authenticated;

-- ─── estornar ─────────────────────────────────────────────────────────────
create or replace function public.reverse_payment_intent(
  p_intent_id uuid,
  p_mp_payment_id text default null,
  p_reason text default 'refund'
)
returns table (
  intent_id uuid,
  status text,
  commissions_reversed int,
  credits_voided int,
  needs_manual boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent record;
  v_credit_id uuid;
  v_comm_reversed int := 0;
  v_credits_voided int := 0;
  v_needs_manual boolean := false;
  v_compra record;
  v_posicao record;
begin
  select * into v_intent from public.payment_intents where id = p_intent_id for update;
  if v_intent is null then
    raise exception 'PAYMENT_INTENT_NOT_FOUND';
  end if;

  -- Idempotência: já estornado → no-op
  if v_intent.status = 'refunded' then
    return query select v_intent.id, v_intent.status, 0, 0, false;
    return;
  end if;

  -- Se não estava paga, não há o que reverter: só cancela a pendente.
  if v_intent.status <> 'paid' then
    update public.payment_intents pi
       set status = 'cancelled', cancelled_at = now(), updated_at = now()
     where pi.id = p_intent_id and pi.status = 'pending';
    insert into public.payment_refunds (intent_id, mp_payment_id, reason, amount_cents, auto_reversed, needs_manual, note)
    values (p_intent_id, p_mp_payment_id, p_reason, v_intent.amount_cents, false, false,
            'intent_nao_estava_paga:' || coalesce(v_intent.status, 'null'));
    return query select v_intent.id, 'cancelled'::text, 0, 0, false;
    return;
  end if;

  -- Marca estornada
  update public.payment_intents
     set status = 'refunded', updated_at = now()
   where id = p_intent_id;

  if v_intent.product_kind = 'card' then
    -- Comissões do comprador (source='purchase')
    -- 🐞 `status` solto era ambíguo com a coluna de retorno: todo estorno de
    -- intent paga estourava aqui. Nunca apareceu porque nunca houve estorno.
    update public.affiliate_commissions ac
       set status = 'reversed'
     where ac.status = 'confirmed'
       and ac.source_ref = 'card_purchase:' || v_intent.id::text;
    get diagnostics v_comm_reversed = row_count;

    -- Splits ainda não coletados → void; coletados → manual
    update public.wallet_credits
       set voided_at = now()
     where reason like 'card\_split:' || v_intent.id::text || ':%'
       and applied_at is null
       and voided_at is null;
    get diagnostics v_credits_voided = row_count;

    if exists (
      select 1 from public.wallet_credits
       where reason like 'card\_split:' || v_intent.id::text || ':%'
         and applied_at is not null
    ) then
      v_needs_manual := true;
    end if;

    -- Jogador já entregue no manager_squad → remoção é decisão do admin.
    v_needs_manual := true;
  elsif v_intent.product_kind = 'presale_pack' then
    -- A compra volta a não existir: sai da posição e do total vendido.
    select c.* into v_compra from public.presale_purchase c
     where c.ref = v_intent.external_id and c.status = 'pago' for update;
    if found then
      select p.* into v_posicao from public.presale_position p
       where p.user_id = v_compra.user_id for update;
      -- Só desconta o que ainda cabe. Se parte já foi liberada ou sacada,
      -- descontar estouraria as travas da posição: fica pro admin.
      if found
         and v_posicao.tokens_totais - v_compra.tokens_entregues
             >= greatest(v_posicao.liberado_por_compra, v_posicao.liberado_por_tempo, v_posicao.sacado)
         and v_posicao.compra_original_usd_cents >= v_compra.usd_cents then
        update public.presale_position
           set tokens_totais = tokens_totais - v_compra.tokens_entregues,
               compra_original_usd_cents = compra_original_usd_cents - v_compra.usd_cents,
               versao = versao + 1, atualizado_em = now()
         where user_id = v_compra.user_id;
        update public.presale_config
           set tokens_vendidos = greatest(tokens_vendidos - v_compra.tokens_entregues, 0),
               atualizado_em = now()
         where id;
        update public.presale_purchase set status = 'estornado'
         where ref = v_intent.external_id;
        v_credits_voided := 1;
      end if;
    end if;
    -- 🔴 O OLEXP NÃO é desfeito aqui. O livro é append-only e o volume já
    -- pode ter sido equiparado num ciclo. Todo estorno de pré-venda vai
    -- pra revisão manual, com a posição na árvore mantida.
    v_needs_manual := true;
  else
    -- recharge / activation_pack: crédito do comprador
    select id into v_credit_id
      from public.wallet_credits
     where user_id = v_intent.user_id
       and reason = 'pix_payment:' || v_intent.id::text
     order by created_at desc
     limit 1;

    if v_credit_id is not null then
      update public.affiliate_commissions ac
         set status = 'reversed'
       where ac.status = 'confirmed'
         and ac.source_ref in (
           'wallet_credit:' || v_credit_id::text || ':BRO',
           'wallet_credit:' || v_credit_id::text || ':EXP'
         );
      get diagnostics v_comm_reversed = row_count;

      -- O crédito nasce pendente. Se o cliente já resgatou → o BRO entrou no
      -- saldo e o clawback é manual. Se ainda não → void.
      if exists (select 1 from public.wallet_credits where id = v_credit_id and applied_at is not null) then
        v_needs_manual := true;
      else
        update public.wallet_credits set voided_at = now()
         where id = v_credit_id and voided_at is null;
        get diagnostics v_credits_voided = row_count;
      end if;
    end if;
  end if;

  insert into public.payment_refunds (intent_id, mp_payment_id, reason, amount_cents, auto_reversed, needs_manual, note)
  values (
    p_intent_id, p_mp_payment_id, p_reason, v_intent.amount_cents, true, v_needs_manual,
    format('comm_reversed=%s credits_voided=%s kind=%s', v_comm_reversed, v_credits_voided, v_intent.product_kind)
  );

  return query select v_intent.id, 'refunded'::text, v_comm_reversed, v_credits_voided, v_needs_manual;
end;
$$;

revoke execute on function public.reverse_payment_intent(uuid, text, text) from anon, public, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — roda junto e derruba tudo se falhar
-- ════════════════════════════════════════════════════════════════════════════
-- Faz uma compra de pré-venda, um depósito e um estorno DE VERDADE, com uma
-- conta que existe, e confere o que cada um deixou. Depois desfaz tudo: o bloco
-- de dentro termina num `raise` que volta o savepoint, então nem o livro
-- append-only fica com linha de teste. As variáveis sobrevivem ao rollback, e
-- é por elas que o bloco de fora sabe se chegou ao fim.
do $$
declare
  v_chegou boolean := false;
  v_user uuid;
  v_raiz uuid;
  v_i uuid;
  v_r record;
  v_n numeric;
  v_antes numeric;
  v_estourou boolean;
  v_veio text;
begin
  if exists (select 1 from pg_trigger where tgname = 'wallet_credits_affiliate_bonus_trg') then
    raise exception 'o gatilho de comissão sobre depósito continua ligado';
  end if;

  select user_id into v_raiz from public.expansao_no
   where pai_id is null order by criado_em, y_ordem limit 1;
  select p.id into v_user from public.profiles p
   where not exists (select 1 from public.expansao_no n where n.user_id = p.id)
     and not exists (select 1 from public.presale_purchase c where c.user_id = p.id)
     and exists (select 1 from auth.users u where u.id = p.id)
   limit 1;
  if v_user is null or v_raiz is null then
    raise notice 'sem conta livre ou sem raiz neste ambiente: verificação do Pix pulada';
    return;
  end if;

  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

    -- 1. a intent de pré-venda é aceita
    select intent_id into v_i from public.create_payment_intent(
      'presale_pack', null, 5535, 'Verifica', 'verifica@olefoot.ai', '00000000000', null, '{}'::jsonb);
    if v_i is null then raise exception 'create_payment_intent não criou a pré-venda'; end if;

    -- 2. sem server_data a confirmação ESTOURA — nada de confiar em metadata
    v_estourou := false;
    begin
      perform public.confirm_payment_intent(v_i, 'verifica-pg-1');
      v_veio := 'não estourou';
    exception when others then
      v_veio := sqlerrm;
      v_estourou := sqlerrm like 'PRESALE_SEM_DADOS_DO_SERVIDOR%';
    end;
    if not v_estourou then raise exception 'pré-venda sem server_data: esperava recusa, veio: %', v_veio; end if;

    -- 3. com server_data: posição, árvore, OLEXP, e NENHUM BRO
    update public.payment_intents set server_data = jsonb_build_object('presale', jsonb_build_object(
      'usd_cents', 1000, 'brl_cents', '5535', 'brl_por_usd_micro', '5535000',
      'tokens_entregues', '80000000000000', 'tokens_brutos', '84210526315790')) where id = v_i;
    select coalesce(sum(volume), 0) into v_antes from public.expansao_perna
     where user_id = v_raiz and trilho = 'equiparacao';

    perform public.confirm_payment_intent(v_i, 'verifica-pg-1');

    select tokens_totais into v_n from public.presale_position where user_id = v_user;
    if v_n is distinct from 80000000000000 then raise exception 'posição errada: %', v_n; end if;
    if not exists (select 1 from public.expansao_no where user_id = v_user) then
      raise exception 'quem comprou NÃO entrou na árvore';
    end if;
    if not exists (select 1 from public.expansao_confirmacao
                    where user_id = v_user and origem = 'compra') then
      raise exception 'a entrada por compra não ficou registrada como compra';
    end if;
    select olexp into v_n from public.expansao_olexp where user_id = v_user;
    if v_n is distinct from 10 then raise exception '$10 tinham que dar 10 OLEXP, deram %', v_n; end if;
    select coalesce(sum(volume), 0) into v_n from public.expansao_perna
     where user_id = v_raiz and trilho = 'equiparacao';
    if v_n - v_antes <> 10 then
      raise exception 'a raiz tinha que ganhar 10 de volume, ganhou %', v_n - v_antes;
    end if;
    if exists (select 1 from public.wallet_credits where reason = 'pix_payment:' || v_i::text) then
      raise exception 'a pré-venda gerou crédito BRO';
    end if;
    if not public.expansao_pode_convidar_interno(v_user) then
      raise exception 'o pack de $10 não liberou o convite';
    end if;

    -- 4. confirmar de novo não credita de novo
    perform public.confirm_payment_intent(v_i, 'verifica-pg-1');
    select tokens_totais into v_n from public.presale_position where user_id = v_user;
    if v_n is distinct from 80000000000000 then raise exception 'confirmar duas vezes dobrou a posição'; end if;

    -- 5. o mesmo pagamento não confirma outra intent
    select intent_id into v_i from public.create_payment_intent(
      'recharge', 'verifica-dup', 10000, 'Verifica', 'verifica@olefoot.ai', '00000000000', null, '{}'::jsonb);
    update public.payment_intents
       set server_data = '{"recarga":{"bro_cents":"1806","brl_por_usd_micro":"5535000"}}'::jsonb
     where id = v_i;
    v_estourou := false;
    begin
      perform public.confirm_payment_intent(v_i, 'verifica-pg-1');
      v_veio := 'não estourou';
    exception when others then
      v_veio := sqlerrm;
      v_estourou := sqlerrm like 'PAGAMENTO_JA_USADO%';
    end;
    if not v_estourou then raise exception 'pagamento repetido: esperava recusa, veio: %', v_veio; end if;

    -- 6. depósito: credita o BRO convertido, PENDENTE, e o resgate devolve
    perform public.confirm_payment_intent(v_i, 'verifica-pg-2');
    select bro_cents, applied_at into v_r from public.wallet_credits
     where reason = 'pix_payment:' || v_i::text;
    if v_r.bro_cents is distinct from 1806 then raise exception 'BRO errado: %', v_r.bro_cents; end if;
    if v_r.applied_at is not null then raise exception 'o crédito nasceu aplicado'; end if;
    select bro_cents_total into v_n from public.claim_pending_wallet_credits();
    if v_n < 1806 then raise exception 'o resgate não devolveu o depósito (veio %)', v_n; end if;

    -- 7. depósito sem cotação ESTOURA em vez de creditar 1:1
    select intent_id into v_i from public.create_payment_intent(
      'recharge', 'verifica-sem', 10000, 'Verifica', 'verifica@olefoot.ai', '00000000000', null,
      '{"recarga":{"bro_cents":"999999"}}'::jsonb);
    v_estourou := false;
    begin
      perform public.confirm_payment_intent(v_i, 'verifica-pg-3');
      v_veio := 'não estourou';
    exception when others then
      v_veio := sqlerrm;
      v_estourou := sqlerrm like 'RECARGA_SEM_COTACAO%';
    end;
    if not v_estourou then raise exception 'depósito sem cotação: esperava recusa, veio: %', v_veio; end if;

    -- 8. estorno da pré-venda desfaz a posição e pede revisão
    select id into v_i from public.payment_intents
     where user_id = v_user and product_kind = 'presale_pack' and status = 'paid';
    select * into v_r from public.reverse_payment_intent(v_i, 'verifica-pg-1', 'refunded');
    if not v_r.needs_manual then raise exception 'estorno de pré-venda não pediu revisão'; end if;
    select tokens_totais into v_n from public.presale_position where user_id = v_user;
    if v_n is distinct from 0 then raise exception 'estorno deixou % na posição', v_n; end if;
    if not exists (select 1 from public.presale_purchase
                    where user_id = v_user and status = 'estornado') then
      raise exception 'a compra estornada não mudou de status';
    end if;

    v_chegou := true;
    raise exception 'DESFAZ_A_VERIFICACAO';
  exception when others then
    if sqlerrm <> 'DESFAZ_A_VERIFICACAO' then raise; end if;
  end;

  perform set_config('request.jwt.claims', '', true);
  if not v_chegou then raise exception 'a verificação não chegou ao fim'; end if;

  -- O que o bloco de dentro escreveu tem que ter sumido.
  if exists (select 1 from public.expansao_no where user_id = v_user)
     or exists (select 1 from public.presale_purchase where user_id = v_user) then
    raise exception 'a verificação deixou rastro na conta %', v_user;
  end if;
end $$;
