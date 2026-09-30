-- ═══════════════════════════════════════════════════════════════════════════
-- ATIVAÇÃO 3× — o checkout de $30 que ativa três contas
--
-- Pedido do fundador (2026-09-30): no checkout do pack de $10, a opção
-- "Ativação 3×": além da conta do comprador, UMA conta de $10 na esquerda e
-- UMA na direita — entrando como primeira conta da perna ou por DERRAMAMENTO
-- abaixo de quem já está lá. Decisões fixadas na mesma conversa:
--   · as duas contas são DO PRÓPRIO COMPRADOR (3 centros; sem login próprio);
--   · cada $10 lateral é um pack COMPLETO: posição de tokens, 10 OLEXP de
--     volume pra cadeia de cima (incluindo o comprador) e receita do ciclo.
--
-- O que isso compra, em números: o comprador sai com 1 direto ativo em cada
-- time (expansao_ativo_interno = true na hora) e 10 OLEXP de volume em cada
-- perna — o primeiro ciclo equipara 10 pontos × $0,25 = $2,50. "Comprar dos
-- dois lados" era o atalho clássico do binário; aqui ele é o produto, com o
-- teto diário de $2.500 e o ponto fixo segurando a emissão.
--
-- 🔑 Receita SEM compra fantasma: são TRÊS linhas de presale_purchase de $10
-- (refs `external_id`, `:s1`, `:s2`) — a receita da janela soma exatamente o
-- que o Pix cobrou. Nada de linha de $30 + 2 de $10 ($50 de um Pix de $30).
--
-- 🔑 A satélite nasce por SQL no molde da migração v1 (20260531000000):
-- tokens do GoTrue como STRING VAZIA (null quebra o scan), instance_id
-- zerado, e SEM auth.identities nem senha — conta que não loga. O profile
-- nasce com club_short null (o trigger de username devolve null) e o
-- username único é gravado depois, fora do alcance do trigger.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── o livro das satélites: de quem é cada conta criada ───────────────────
create table if not exists public.expansao_satelite (
  user_id   uuid primary key references auth.users(id) on delete restrict,
  dono_id   uuid not null references auth.users(id) on delete restrict,
  lado      smallint not null check (lado in (1, 2)),
  ref       text not null unique,
  criado_em timestamptz not null default now()
);
alter table public.expansao_satelite enable row level security;
drop policy if exists expansao_satelite_do_dono on public.expansao_satelite;
create policy expansao_satelite_do_dono on public.expansao_satelite
  for select to authenticated using (dono_id = auth.uid());

-- ─── a origem da entrada ganha 'ativacao_3x' ──────────────────────────────
alter table public.expansao_confirmacao drop constraint if exists expansao_confirmacao_origem_check;
alter table public.expansao_confirmacao add constraint expansao_confirmacao_origem_check
  check (origem in ('convite', 'compra', 'licenca', 'ativacao_3x'));

-- ─── entrar numa PERNA ESPECÍFICA, com derramamento ───────────────────────
-- expansao_entrar escolhe a perna pelo expansao_perna_alvo; aqui a perna é
-- dada. A vaga vem do mesmo BFS (expansao_vaga_na_perna, com paridade TS
-- testada). O retry cobre duas confirmações derramando na mesma vaga: o
-- índice expansao_no_vaga_unica estoura e a próxima volta acha outra.
create or replace function public.expansao_entrar_na_perna(
  p_user uuid, p_patrocinador uuid, p_lado smallint, p_origem text
) returns table (entrou boolean, motivo text, pai uuid, lado smallint)
language plpgsql security definer set search_path = public as $$
declare
  v_vaga record;
  v_username text;
  v_i integer;
begin
  if p_lado not in (1, 2) then raise exception 'lado inválido: %', p_lado; end if;
  if p_user = p_patrocinador then
    return query select false, 'auto_patrocinio', null::uuid, null::smallint; return; end if;
  if exists (select 1 from expansao_no where user_id = p_user) then
    return query select false, 'ja_esta_na_arvore', null::uuid, null::smallint; return; end if;
  if not exists (select 1 from expansao_no where user_id = p_patrocinador) then
    return query select false, 'patrocinador_fora_da_arvore', null::uuid, null::smallint; return; end if;

  for v_i in 1..3 loop
    select * into v_vaga from public.expansao_vaga_na_perna(p_patrocinador, p_lado);
    begin
      perform public.expansao_inserir(p_user, p_patrocinador, v_vaga.pai_id, v_vaga.lado);
      exit;
    exception when unique_violation then
      if v_i = 3 then raise; end if;
    end;
  end loop;

  select p.username into v_username from profiles p where p.id = p_patrocinador;
  insert into expansao_confirmacao (user_id, patrocinador_id, username_convite, origem)
  values (p_user, p_patrocinador, coalesce(v_username, 'origem'), p_origem)
  on conflict (user_id) do nothing;

  return query select true, null::text, v_vaga.pai_id, v_vaga.lado;
end;
$$;
revoke all on function public.expansao_entrar_na_perna(uuid, uuid, smallint, text) from public, anon, authenticated;
grant execute on function public.expansao_entrar_na_perna(uuid, uuid, smallint, text) to service_role;

-- ─── criar a conta-satélite: usuário + profile + posição na árvore ────────
create or replace function public.expansao_criar_satelite(p_dono uuid, p_lado smallint, p_ref text)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare
  v_sat uuid;
  v_tag text;
  v_dono record;
  v_r record;
begin
  -- Idempotente por ref: a mesma confirmação nunca cria duas.
  select s.user_id into v_sat from public.expansao_satelite s where s.ref = p_ref;
  if v_sat is not null then return v_sat; end if;

  if not exists (select 1 from auth.users u where u.id = p_dono) then
    raise exception 'SATELITE_SEM_DONO: %', p_dono;
  end if;

  v_sat := gen_random_uuid();
  v_tag := left(replace(v_sat::text, '-', ''), 8);

  -- Molde da v1: tokens '' (GoTrue não aceita null), sem senha e sem
  -- auth.identities — a satélite não loga; entregar a conta a alguém no
  -- futuro é fluxo de admin.
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    aud, role, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    v_sat, '00000000-0000-0000-0000-000000000000'::uuid,
    'satelite-' || v_tag || '@olefoot.ai', '', now(),
    'authenticated', 'authenticated',
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('conta_satelite', true, 'dono', p_dono::text, 'time', p_lado),
    now(), now(), '', '', '', ''
  );

  select p.username, p.display_name into v_dono from public.profiles p where p.id = p_dono;
  -- club_short null → o trigger de username devolve null; o único vem depois.
  insert into public.profiles (id, display_name)
  values (v_sat, coalesce(v_dono.display_name, 'Conta') || ' · Time ' || p_lado);
  update public.profiles
     set username = coalesce(v_dono.username, 'satelite') || '-t' || p_lado || '-' || left(v_tag, 4)
   where id = v_sat;

  select * into v_r from public.expansao_entrar_na_perna(v_sat, p_dono, p_lado, 'ativacao_3x');
  if not v_r.entrou then raise exception 'SATELITE_NAO_ENTROU: %', v_r.motivo; end if;

  insert into public.expansao_satelite (user_id, dono_id, lado, ref)
  values (v_sat, p_dono, p_lado, p_ref);

  return v_sat;
end;
$$;
revoke all on function public.expansao_criar_satelite(uuid, smallint, text) from public, anon, authenticated;
grant execute on function public.expansao_criar_satelite(uuid, smallint, text) to service_role;

-- ─── a confirmação ganha o bloco 3× (cópia da fonte 20260930200000) ───────
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
  v_3x jsonb;
  v_lado3 smallint;
  v_ref3 text;
  v_sat_uid uuid;
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

    -- ─── ATIVAÇÃO 3×: duas contas-satélite do comprador, uma por perna ────
    -- Números de `server_data` (service role), nunca de `metadata`. Cada
    -- satélite é um pack COMPLETO de $10: linha própria em presale_purchase
    -- (a receita da janela fecha com o total que entrou — sem compra
    -- fantasma), posição própria de tokens, e 10 OLEXP subindo a cadeia por
    -- expansao_creditar — o que inclui o comprador, DE PROPÓSITO: é o
    -- produto. "Comprar dos dois lados" era o atalho clássico do binário;
    -- aqui ele vira ativação paga, e quem segura a emissão continua sendo o
    -- teto diário de $2.500 e o valor fixo do ponto.
    v_3x := v_intent.server_data -> 'ativacao_3x';
    if v_3x is not null then
      for v_item in select value from jsonb_array_elements(coalesce(v_3x -> 'satelites', '[]'::jsonb)) loop
        v_lado3 := (v_item ->> 'lado')::smallint;
        v_ref3 := v_intent.external_id || ':s' || v_lado3;
        v_sat_uid := public.expansao_criar_satelite(v_intent.user_id, v_lado3, v_ref3);
        select * into v_r from public.presale_creditar(
          v_sat_uid, v_ref3,
          (v_item ->> 'usd_cents')::integer, (v_item ->> 'brl_cents')::bigint,
          (v_item ->> 'brl_por_usd_micro')::bigint,
          (v_item ->> 'tokens_entregues')::numeric, (v_item ->> 'tokens_brutos')::numeric);
        if not v_r.creditou and v_r.motivo is distinct from 'ref_ja_creditado' then
          raise exception 'SATELITE_NAO_CREDITOU: %', v_r.motivo;
        end if;
        v_olexp := public.expansao_olexp_da_compra((v_item ->> 'usd_cents')::integer);
        if v_olexp > 0 then
          perform public.expansao_creditar(v_sat_uid, v_olexp, 'compra_olefoot', v_ref3);
        end if;
      end loop;
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

revoke all on function public.confirm_payment_intent(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_payment_intent(uuid, text) to service_role;

comment on table public.expansao_satelite is
  'Contas-satélite da Ativação 3×: criadas na confirmação do Pix, pertencem ao
   dono, uma por perna, sem login. Cada uma é um pack completo de $10.';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — uma Ativação 3× REAL num savepoint que termina em raise.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_chegou boolean := false;
  v_comprador uuid;
  v_raiz uuid;
  v_i1 uuid;
  v_i2 uuid;
  v_r record;
  v_antes numeric;
  v_n numeric;
  v_sat1 uuid;
  v_sat2 uuid;
  v_hora timestamptz := date_trunc('hour', now());
begin
  if has_function_privilege('authenticated', 'public.expansao_criar_satelite(uuid,smallint,text)', 'execute')
     or has_function_privilege('anon', 'public.expansao_criar_satelite(uuid,smallint,text)', 'execute')
     or has_function_privilege('authenticated', 'public.expansao_entrar_na_perna(uuid,uuid,smallint,text)', 'execute') then
    raise exception 'uma função da 3× ficou aberta ao cliente';
  end if;

  select user_id into v_raiz from public.expansao_no
   where pai_id is null order by criado_em, y_ordem limit 1;
  select p.id into v_comprador from public.profiles p
   where exists (select 1 from auth.users u where u.id = p.id)
     and not exists (select 1 from public.expansao_no n where n.user_id = p.id)
     and not exists (select 1 from public.presale_purchase c where c.user_id = p.id)
   limit 1;
  if v_comprador is null or v_raiz is null then
    raise notice 'sem conta livre ou sem raiz neste ambiente: verificação da 3× pulada';
    return;
  end if;

  begin
    v_antes := public.expansao_receita_da_janela(v_hora, v_hora + interval '1 hour');

    -- Um Pix de $30: pack próprio + 2 satélites, tudo em server_data.
    insert into public.payment_intents
      (user_id, external_id, product_kind, amount_cents, metadata, server_data)
    values
      (v_comprador, 'verifica-3x-1', 'presale_pack', 16800, '{}'::jsonb,
       jsonb_build_object(
         'presale', jsonb_build_object('usd_cents', 1000, 'brl_cents', '5600',
           'brl_por_usd_micro', '5600000', 'tokens_entregues', '80000000000000',
           'tokens_brutos', '84210526315790'),
         'ativacao_3x', jsonb_build_object('satelites', jsonb_build_array(
           jsonb_build_object('lado', 1, 'usd_cents', 1000, 'brl_cents', '5600',
             'brl_por_usd_micro', '5600000', 'tokens_entregues', '80000000000000',
             'tokens_brutos', '84210526315790'),
           jsonb_build_object('lado', 2, 'usd_cents', 1000, 'brl_cents', '5600',
             'brl_por_usd_micro', '5600000', 'tokens_entregues', '80000000000000',
             'tokens_brutos', '84210526315790')))))
    returning id into v_i1;

    perform * from public.confirm_payment_intent(v_i1, null);

    -- As duas satélites existem, são do comprador, uma em cada perna dele.
    select s.user_id into v_sat1 from public.expansao_satelite s where s.ref = 'verifica-3x-1:s1';
    select s.user_id into v_sat2 from public.expansao_satelite s where s.ref = 'verifica-3x-1:s2';
    if v_sat1 is null or v_sat2 is null then raise exception 'satélite não nasceu'; end if;
    if not exists (select 1 from public.expansao_no n where n.user_id = v_sat1
                     and n.patrocinador_id = v_comprador and n.pai_id = v_comprador and n.lado = 1)
       or not exists (select 1 from public.expansao_no n where n.user_id = v_sat2
                     and n.patrocinador_id = v_comprador and n.pai_id = v_comprador and n.lado = 2) then
      raise exception 'as satélites não entraram uma em cada perna do comprador';
    end if;
    if not public.expansao_ativo_interno(v_comprador) then
      raise exception 'a 3× não ativou o comprador (1 em cada time)';
    end if;

    -- Volume: 10 OLEXP de equiparação em CADA perna do comprador.
    if (select count(*) from public.expansao_perna
         where user_id = v_comprador and trilho = 'equiparacao' and volume = 10) <> 2 then
      raise exception 'o volume das satélites não chegou às duas pernas do comprador';
    end if;

    -- Receita: exatamente $30 a mais — três compras de $10, sem fantasma.
    v_n := public.expansao_receita_da_janela(v_hora, v_hora + interval '1 hour');
    if v_n - v_antes <> 3000 then
      raise exception 'a receita da janela subiu % (esperava 3000)', v_n - v_antes;
    end if;
    if (select count(*) from public.presale_purchase
         where ref in ('verifica-3x-1', 'verifica-3x-1:s1', 'verifica-3x-1:s2')
           and status = 'pago' and usd_cents = 1000) <> 3 then
      raise exception 'não são três compras de $10';
    end if;
    -- Posições: a do comprador e a de cada satélite, cada uma com seus tokens.
    if (select count(*) from public.presale_position
         where user_id in (v_comprador, v_sat1, v_sat2) and tokens_totais > 0) <> 3 then
      raise exception 'as três posições não existem';
    end if;

    -- Confirmar de novo não duplica nada.
    perform * from public.confirm_payment_intent(v_i1, null);
    if (select count(*) from public.expansao_satelite where dono_id = v_comprador) <> 2 then
      raise exception 'a reconfirmação criou satélite de novo';
    end if;

    -- Segunda 3×: DERRAMAMENTO — as novas entram abaixo das primeiras.
    insert into public.payment_intents
      (user_id, external_id, product_kind, amount_cents, metadata, server_data)
    values
      (v_comprador, 'verifica-3x-2', 'presale_pack', 16800, '{}'::jsonb,
       jsonb_build_object(
         'presale', jsonb_build_object('usd_cents', 1000, 'brl_cents', '5600',
           'brl_por_usd_micro', '5600000', 'tokens_entregues', '80000000000000',
           'tokens_brutos', '84210526315790'),
         'ativacao_3x', jsonb_build_object('satelites', jsonb_build_array(
           jsonb_build_object('lado', 1, 'usd_cents', 1000, 'brl_cents', '5600',
             'brl_por_usd_micro', '5600000', 'tokens_entregues', '80000000000000',
             'tokens_brutos', '84210526315790'),
           jsonb_build_object('lado', 2, 'usd_cents', 1000, 'brl_cents', '5600',
             'brl_por_usd_micro', '5600000', 'tokens_entregues', '80000000000000',
             'tokens_brutos', '84210526315790')))))
    returning id into v_i2;
    perform * from public.confirm_payment_intent(v_i2, null);
    if not exists (select 1 from public.expansao_satelite s join public.expansao_no n on n.user_id = s.user_id
                    where s.ref = 'verifica-3x-2:s1' and n.pai_id = v_sat1)
       or not exists (select 1 from public.expansao_satelite s join public.expansao_no n on n.user_id = s.user_id
                    where s.ref = 'verifica-3x-2:s2' and n.pai_id = v_sat2) then
      raise exception 'a segunda 3× não derramou abaixo das primeiras';
    end if;

    v_chegou := true;
    raise exception 'DESFAZ_A_VERIFICACAO';
  exception when others then
    if sqlerrm <> 'DESFAZ_A_VERIFICACAO' then raise; end if;
  end;

  if not v_chegou then raise exception 'a verificação da 3× não chegou ao fim'; end if;
  if exists (select 1 from public.expansao_satelite where ref like 'verifica-3x%')
     or exists (select 1 from public.presale_purchase where ref like 'verifica-3x%')
     or exists (select 1 from public.payment_intents where external_id like 'verifica-3x%') then
    raise exception 'a verificação da 3× deixou rastro';
  end if;
end $$;
