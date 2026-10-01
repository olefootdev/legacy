-- ═══════════════════════════════════════════════════════════════════════════
-- MERCADO DE ELENCO EM OLEFOOT — "compra por $1, treina, vende por $3"
--
-- O conceito do fundador (2026-10-01): o manager compra um jogador, TREINA,
-- os atributos sobem (playerEvolution/trainingPlans já fazem isso e o preço
-- dinâmico já responde — marketValue.ts), e ele OFERECE o jogador melhorado
-- por um preço que ELE escolhe, em OLEFOOT. Quem compra leva o jogador como
-- ele está HOJE — treinado. E o time inteiro é um ativo: dá pra listar e
-- vender PRONTO, de uma vez.
--
-- O que havia antes: P2P só de prospects da Academia, em EXP
-- (academy_managers + market_offers). Este arquivo cria o mercado de
-- QUALQUER jogador do elenco, liquidado em OLEFOOT.
--
-- A moeda é o saldo OLEFOOT off-chain (`legacy_olefoot_credits`, wei com 18
-- casas) — o MESMO que a Wallet mostra e que o buy-legacy já debita. Aqui a
-- liquidação sai do TS e vira função SQL: lock de linha, débito e crédito na
-- MESMA transação (o buy-legacy faz read-modify-write em TS; dois cliques
-- simultâneos podiam gastar o mesmo saldo — este caminho novo não herda isso).
--
-- A MUDANÇA DE PLANTEL (manager_squad jsonb) continua no servidor Hono, no
-- padrão do marketOffers; se ela falhar, `squad_market_desfazer` devolve o
-- dinheiro e reativa o anúncio.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── o beneficiário de uma venda pode não ter linha de saldo ────────────────
-- A tabela nasceu pro snapshot v1 e tem NOT NULL em campos de snapshot. Quem
-- entrou no v11 e VENDE um jogador precisa de uma linha nova — os defaults
-- deixam o insert de crédito funcionar sem inventar dados de snapshot.
-- legacy_id tem índice ÚNICO (é o id do snapshot v1): linha nova de vendedor
-- não tem legacy_id — nullable, e NULL não colide no unique.
alter table public.legacy_olefoot_credits alter column legacy_id drop not null;
alter table public.legacy_olefoot_credits alter column legacy_id set default null;
alter table public.legacy_olefoot_credits alter column email set default '';
alter table public.legacy_olefoot_credits alter column wallet_address set default '';
alter table public.legacy_olefoot_credits alter column balance_human set default '0';
alter table public.legacy_olefoot_credits alter column balance_wei set default 0;
alter table public.legacy_olefoot_credits alter column snapshot_at set default now();

-- ─── os anúncios ────────────────────────────────────────────────────────────
create table if not exists public.squad_listings (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('player', 'team')),
  seller_user_id  uuid not null references auth.users(id) on delete cascade,
  -- id do jogador no plantel (kind='player'); null quando é o time inteiro.
  game_player_id  text,
  -- Snapshot pra VITRINE (nome, pos, OVR, atributos no momento da listagem).
  -- A ENTREGA usa o jogador VIVO do plantel na hora da compra — ele continua
  -- treinando e evoluindo enquanto está anunciado, e é isso que se vende.
  player_snapshot jsonb,
  team_snapshot   jsonb,
  -- Preço pedido, em OLEFOOT inteiro (o vendedor escolhe — é o "$1 → $3").
  price_olefoot   numeric(78,0) not null check (price_olefoot > 0),
  -- Valor de REFERÊNCIA (preço dinâmico em OLEFOOT) no momento da listagem,
  -- pro comprador ver o ágio/desconto sem confiar no vendedor.
  ref_olefoot     numeric(78,0),
  status          text not null default 'active'
                    check (status in ('active', 'sold', 'cancelled')),
  created_at      timestamptz not null default now(),
  sold_at         timestamptz,
  buyer_user_id   uuid references auth.users(id),
  -- O cliente do VENDEDOR já tirou o jogador do estado local? (o plantel
  -- local é snapshot — sem este ack, o próximo persist ressuscitaria o
  -- jogador vendido.)
  seller_applied_at timestamptz,
  constraint squad_listings_player_tem_id check (kind <> 'player' or game_player_id is not null)
);

-- Um anúncio ativo por jogador; um anúncio de TIME por vendedor.
create unique index if not exists squad_listings_um_por_jogador
  on public.squad_listings (seller_user_id, game_player_id)
  where status = 'active' and kind = 'player';
create unique index if not exists squad_listings_um_time
  on public.squad_listings (seller_user_id)
  where status = 'active' and kind = 'team';
create index if not exists squad_listings_vitrine
  on public.squad_listings (status, created_at desc);

alter table public.squad_listings enable row level security;
-- Vitrine pública pra quem está logado; as PARTES veem as próprias vendidas.
drop policy if exists squad_listings_vitrine on public.squad_listings;
create policy squad_listings_vitrine on public.squad_listings
  for select to authenticated
  using (status = 'active' or seller_user_id = auth.uid() or buyer_user_id = auth.uid());
-- Grants EXPLÍCITOS (não confiar nos defaults do Supabase): logado lê a
-- vitrine pela policy; escrever é só o servidor.
grant select on public.squad_listings to authenticated, service_role;
grant insert, update, delete on public.squad_listings to service_role;
revoke all on public.squad_listings from anon;
revoke insert, update, delete on public.squad_listings from authenticated;

-- ─── saldo: ajuste atômico em wei ───────────────────────────────────────────
-- balance_wei é a verdade; balance_human é recalculado SEMPRE a partir dele
-- (inteiro + 18 casas), então tela e débito nunca divergem.
create or replace function public.squad_market_ajustar_saldo_interno(p_user uuid, p_delta_wei numeric)
returns numeric language plpgsql security definer set search_path = public
as $$
declare
  v_wei numeric;
begin
  -- Garante a linha (vendedor novo) e TRAVA pra ninguém gastar junto.
  insert into legacy_olefoot_credits (user_id, source)
  values (p_user, 'squad-market')
  on conflict (user_id) do nothing;

  select balance_wei into v_wei
    from legacy_olefoot_credits
   where user_id = p_user
   for update;

  v_wei := coalesce(v_wei, 0) + p_delta_wei;
  if v_wei < 0 then
    raise exception 'SALDO_INSUFICIENTE';
  end if;

  update legacy_olefoot_credits
     set balance_wei = v_wei,
         balance_human = floor(v_wei / 1000000000000000000)::numeric(78,0)::text
           || '.' || lpad(mod(v_wei, 1000000000000000000)::numeric(78,0)::text, 18, '0')
   where user_id = p_user;
  return v_wei;
end;
$$;
revoke all on function public.squad_market_ajustar_saldo_interno(uuid, numeric) from public, anon, authenticated;
grant execute on function public.squad_market_ajustar_saldo_interno(uuid, numeric) to service_role;

-- ─── liquidar: o dinheiro muda de mão numa transação só ────────────────────
-- Motivos (sem exceção pra fluxo): indisponivel · propria_listagem ·
-- saldo_insuficiente. ok=true já deixa o anúncio 'sold' — a entrega do
-- jogador vem em seguida (servidor Hono), com `desfazer` como compensação.
create or replace function public.squad_market_liquidar(p_listing uuid, p_buyer uuid)
returns table (ok boolean, motivo text, seller uuid, kind text, game_player_id text, price_olefoot numeric)
language plpgsql security definer set search_path = public
as $$
declare
  v_l record;
begin
  select * into v_l from squad_listings l
   where l.id = p_listing and l.status = 'active'
   for update;
  if not found then
    return query select false, 'indisponivel'::text, null::uuid, null::text, null::text, null::numeric;
    return;
  end if;
  if v_l.seller_user_id = p_buyer then
    return query select false, 'propria_listagem'::text, null::uuid, null::text, null::text, null::numeric;
    return;
  end if;

  begin
    perform public.squad_market_ajustar_saldo_interno(p_buyer, -(v_l.price_olefoot * 1000000000000000000));
  exception when others then
    if sqlerrm = 'SALDO_INSUFICIENTE' then
      return query select false, 'saldo_insuficiente'::text, null::uuid, null::text, null::text, null::numeric;
      return;
    end if;
    raise;
  end;
  perform public.squad_market_ajustar_saldo_interno(v_l.seller_user_id, v_l.price_olefoot * 1000000000000000000);

  update squad_listings
     set status = 'sold', buyer_user_id = p_buyer, sold_at = now()
   where id = p_listing;

  return query select true, null::text, v_l.seller_user_id, v_l.kind, v_l.game_player_id, v_l.price_olefoot;
end;
$$;

-- ─── desfazer: a entrega falhou, o dinheiro volta ───────────────────────────
create or replace function public.squad_market_desfazer(p_listing uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
declare
  v_l record;
begin
  select * into v_l from squad_listings l
   where l.id = p_listing and l.status = 'sold' and l.seller_applied_at is null
   for update;
  if not found then return false; end if;

  -- Ordem inversa da liquidação: tira do vendedor, devolve ao comprador.
  perform public.squad_market_ajustar_saldo_interno(v_l.seller_user_id, -(v_l.price_olefoot * 1000000000000000000));
  perform public.squad_market_ajustar_saldo_interno(v_l.buyer_user_id, v_l.price_olefoot * 1000000000000000000);

  update squad_listings
     set status = 'active', buyer_user_id = null, sold_at = null
   where id = p_listing;
  return true;
end;
$$;

revoke all on function public.squad_market_liquidar(uuid, uuid) from public, anon, authenticated;
revoke all on function public.squad_market_desfazer(uuid) from public, anon, authenticated;
grant execute on function public.squad_market_liquidar(uuid, uuid) to service_role;
grant execute on function public.squad_market_desfazer(uuid) to service_role;

comment on table public.squad_listings is
  'Mercado de elenco em OLEFOOT: qualquer jogador do plantel (ou o time
   inteiro) anunciado pelo preço que o vendedor escolher. Vitrine usa o
   snapshot; a entrega usa o jogador VIVO (continua treinando anunciado).
   Dinheiro muda de mão em squad_market_liquidar (lock + wei na mesma
   transação); plantel muda no Hono com squad_market_desfazer de compensação.';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — savepoint que termina em raise; não deixa rastro.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_chegou boolean := false;
  v_vend uuid;
  v_comp uuid;
  v_id uuid;
  v_r record;
  v_wei numeric;
begin
  if has_function_privilege('authenticated', 'public.squad_market_liquidar(uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.squad_market_desfazer(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.squad_market_ajustar_saldo_interno(uuid,numeric)', 'execute')
     or has_table_privilege('authenticated', 'public.squad_listings', 'insert')
     or has_table_privilege('authenticated', 'public.squad_listings', 'update')
     or not has_table_privilege('authenticated', 'public.squad_listings', 'select') then
    raise exception 'uma porta do squad_market ficou errada';
  end if;

  select u1.id, u2.id into v_vend, v_comp
    from auth.users u1
    join auth.users u2 on u2.id <> u1.id
   where not exists (select 1 from public.squad_listings s
                      where s.seller_user_id in (u1.id, u2.id) or s.buyer_user_id in (u1.id, u2.id))
   limit 1;
  if v_vend is null or v_comp is null then
    raise notice 'sem duas contas neste ambiente: verificação do squad_market pulada';
    return;
  end if;

  begin
    -- Comprador nasce com 24.000 OLEFOOT e meia fração; vendedor sem linha.
    insert into public.legacy_olefoot_credits (user_id, balance_wei, balance_human, source)
    values (v_comp, 24000.5e18, '24000.500000000000000000', 'verificacao')
    on conflict (user_id) do update set balance_wei = excluded.balance_wei,
      balance_human = excluded.balance_human;
    delete from public.legacy_olefoot_credits where user_id = v_vend;

    insert into public.squad_listings (kind, seller_user_id, game_player_id, player_snapshot, price_olefoot, ref_olefoot)
    values ('player', v_vend, 'zag-teste', '{"name":"Zagueiro Teste"}'::jsonb, 24000, 8000)
    returning id into v_id;

    -- Um segundo anúncio ativo do MESMO jogador tem que esbarrar no índice.
    begin
      insert into public.squad_listings (kind, seller_user_id, game_player_id, price_olefoot)
      values ('player', v_vend, 'zag-teste', 1);
      raise exception 'aceitou dois anúncios ativos do mesmo jogador';
    exception when unique_violation then null;
    end;

    -- Auto-compra não.
    select * into v_r from public.squad_market_liquidar(v_id, v_vend);
    if v_r.ok or v_r.motivo <> 'propria_listagem' then
      raise exception 'auto-compra devia falhar, veio %', v_r.motivo; end if;

    -- Liquida: comprador paga 24.000 (sobra a fração), vendedor recebe.
    select * into v_r from public.squad_market_liquidar(v_id, v_comp);
    if not v_r.ok or v_r.seller <> v_vend or v_r.price_olefoot <> 24000 then
      raise exception 'liquidar falhou: %', v_r.motivo; end if;
    select balance_wei into v_wei from public.legacy_olefoot_credits where user_id = v_comp;
    if v_wei <> 0.5e18 then raise exception 'débito errado do comprador: %', v_wei; end if;
    select balance_wei into v_wei from public.legacy_olefoot_credits where user_id = v_vend;
    if v_wei <> 24000e18 then raise exception 'crédito errado do vendedor: %', v_wei; end if;
    if (select balance_human from public.legacy_olefoot_credits where user_id = v_comp)
       <> '0.500000000000000000' then
      raise exception 'balance_human do comprador divergiu do wei'; end if;

    -- Vendido não liquida de novo; sem saldo não liquida.
    select * into v_r from public.squad_market_liquidar(v_id, v_comp);
    if v_r.ok or v_r.motivo <> 'indisponivel' then
      raise exception 'revenda do vendido devia falhar, veio %', v_r.motivo; end if;

    -- Desfazer devolve o dinheiro e reativa.
    if not public.squad_market_desfazer(v_id) then raise exception 'desfazer devolveu false'; end if;
    select balance_wei into v_wei from public.legacy_olefoot_credits where user_id = v_comp;
    if v_wei <> 24000.5e18 then raise exception 'desfazer não devolveu: %', v_wei; end if;
    if (select status from public.squad_listings where id = v_id) <> 'active' then
      raise exception 'desfazer não reativou o anúncio'; end if;

    -- Comprador sem saldo suficiente.
    update public.legacy_olefoot_credits set balance_wei = 10e18, balance_human = '10.000000000000000000'
     where user_id = v_comp;
    select * into v_r from public.squad_market_liquidar(v_id, v_comp);
    if v_r.ok or v_r.motivo <> 'saldo_insuficiente' then
      raise exception 'sem saldo devia falhar, veio %', v_r.motivo; end if;
    if (select status from public.squad_listings where id = v_id) <> 'active' then
      raise exception 'falha de saldo não pode travar o anúncio'; end if;

    v_chegou := true;
    raise exception 'DESFAZ_A_VERIFICACAO';
  exception when others then
    if sqlerrm <> 'DESFAZ_A_VERIFICACAO' then raise; end if;
  end;

  if not v_chegou then raise exception 'a verificação não chegou ao fim'; end if;
  if exists (select 1 from public.squad_listings where seller_user_id = v_vend) then
    raise exception 'a verificação deixou rastro';
  end if;
end $$;
