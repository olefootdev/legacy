-- ═══════════════════════════════════════════════════════════════════════════
-- SQUAD MARKET v2 — as mecânicas RPG-PRICE-LIVE (decisão do fundador,
-- 2026-10-01: "executa todas as 7 sugestões")
--
-- Em cima do mercado de elenco (20261001150000) e da fundação LIVE
-- (20261001200000), este arquivo liga quatro economias novas:
--
--   · ROYALTY DE FORMADOR — o PRIMEIRO vendedor de um jogador fica gravado
--     como formador (`player_formador`) e recebe 3% de TODA revenda futura.
--     Treinar deixa de ser flip único e vira renda vitalícia.
--   · COTAS DE CLUBE — o dono vende até 49% do clube (`club_share_offers` →
--     `club_shares`). Os cotistas recebem a fração de TODA venda do clube no
--     mercado, automaticamente, dentro da liquidação (`club_share_dividends`
--     é o extrato). O dono nunca perde a maioria.
--   · SALÁRIO INVERTIDO (yield) — atuação com nota ≥ 7 rende 1 OLEFOOT ao
--     dono, pago em cima dos SNAPSHOTS DE PARTIDA do servidor (migration
--     anterior), com teto de 30/dia. O cliente não informa número nenhum —
--     ele só pede; quem conta é o banco.
--   · EMPRÉSTIMO COM OPÇÃO — anúncio kind='loan': aluguel por N dias em
--     OLEFOOT; a evolução fica NO jogador (ele vive no plantel do locatário
--     e volta treinado); opção de compra a preço travado liquida com o MESMO
--     split de venda (royalty + dividendos).
--   · LEILÃO-RELÂMPAGO DO MVP — o artilheiro das últimas 24h (dados REAIS de
--     player_match_goals) vira uma CÓPIA ÚNICA leiloada por 15 minutos, todo
--     dia às 20h de São Paulo (cron). Lance em OLEFOOT com escrow no banco
--     (debita ao dar lance, devolve ao ser superado). 50% do martelo vai pro
--     DONO do MVP; os outros 50% não são creditados a ninguém — são o sink.
--
-- Tudo que é dinheiro mora em funções SQL (lock + wei na mesma transação,
-- padrão da 20261001150000). O que move plantel continua no Hono.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── anúncios agora conhecem o EMPRÉSTIMO ───────────────────────────────────
alter table public.squad_listings drop constraint if exists squad_listings_kind_check;
alter table public.squad_listings
  add constraint squad_listings_kind_check check (kind in ('player', 'team', 'loan'));
alter table public.squad_listings add column if not exists loan_days integer
  check (loan_days is null or loan_days between 1 and 30);
alter table public.squad_listings add column if not exists buyout_olefoot numeric(78,0)
  check (buyout_olefoot is null or buyout_olefoot > 0);
alter table public.squad_listings drop constraint if exists squad_listings_loan_completo;
alter table public.squad_listings
  add constraint squad_listings_loan_completo
  check (kind <> 'loan' or (game_player_id is not null and loan_days is not null));
-- A liquidação grava aqui COMO o dinheiro foi repartido — é o mapa do desfazer.
alter table public.squad_listings add column if not exists split jsonb;

-- Um jogador não pode estar à venda E pra alugar ao mesmo tempo.
drop index if exists squad_listings_um_por_jogador;
create unique index squad_listings_um_por_jogador
  on public.squad_listings (seller_user_id, game_player_id)
  where status = 'active' and kind in ('player', 'loan');

-- ─── formador ───────────────────────────────────────────────────────────────
create table if not exists public.player_formador (
  game_player_id   text primary key,
  formador_user_id uuid not null references auth.users(id) on delete cascade,
  created_at       timestamptz not null default now()
);
alter table public.player_formador enable row level security;
drop policy if exists player_formador_le on public.player_formador;
create policy player_formador_le on public.player_formador
  for select to authenticated using (true);
grant select on public.player_formador to authenticated, service_role;
grant insert on public.player_formador to service_role;
revoke all on public.player_formador from anon;

-- ─── cotas de clube ─────────────────────────────────────────────────────────
create table if not exists public.club_shares (
  owner_user_id  uuid not null references auth.users(id) on delete cascade,
  holder_user_id uuid not null references auth.users(id) on delete cascade,
  percent_bps    integer not null check (percent_bps > 0),
  updated_at     timestamptz not null default now(),
  primary key (owner_user_id, holder_user_id),
  constraint club_shares_nao_proprio check (owner_user_id <> holder_user_id)
);
create table if not exists public.club_share_offers (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  percent_bps   integer not null check (percent_bps between 100 and 4900),
  price_olefoot numeric(78,0) not null check (price_olefoot > 0),
  status        text not null default 'active' check (status in ('active', 'sold', 'cancelled')),
  buyer_user_id uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  sold_at       timestamptz
);
create index if not exists club_share_offers_vitrine on public.club_share_offers (status, created_at desc);
create table if not exists public.club_share_dividends (
  id             bigserial primary key,
  holder_user_id uuid not null references auth.users(id) on delete cascade,
  owner_user_id  uuid not null references auth.users(id) on delete cascade,
  listing_id     uuid,
  olefoot        numeric(78,0) not null check (olefoot > 0),
  at             timestamptz not null default now()
);
create index if not exists club_share_dividends_holder on public.club_share_dividends (holder_user_id, at desc);

alter table public.club_shares enable row level security;
alter table public.club_share_offers enable row level security;
alter table public.club_share_dividends enable row level security;
drop policy if exists club_shares_partes on public.club_shares;
create policy club_shares_partes on public.club_shares
  for select to authenticated using (owner_user_id = auth.uid() or holder_user_id = auth.uid());
drop policy if exists club_share_offers_vitrine on public.club_share_offers;
create policy club_share_offers_vitrine on public.club_share_offers
  for select to authenticated
  using (status = 'active' or owner_user_id = auth.uid() or buyer_user_id = auth.uid());
drop policy if exists club_share_dividends_partes on public.club_share_dividends;
create policy club_share_dividends_partes on public.club_share_dividends
  for select to authenticated using (owner_user_id = auth.uid() or holder_user_id = auth.uid());
grant select on public.club_shares, public.club_share_offers, public.club_share_dividends to authenticated, service_role;
grant all on public.club_shares, public.club_share_offers, public.club_share_dividends to service_role;
grant usage on sequence public.club_share_dividends_id_seq to service_role;
revoke all on public.club_shares, public.club_share_offers, public.club_share_dividends from anon;
revoke insert, update, delete on public.club_shares, public.club_share_offers, public.club_share_dividends from authenticated;

/** Quanto do clube de p_owner já está comprometido (cotas vendidas + ofertas vivas). */
create or replace function public.club_share_comprometido_interno(p_owner uuid)
returns integer language sql stable security definer set search_path = public
as $$
  select coalesce((select sum(percent_bps) from club_shares where owner_user_id = p_owner), 0)::int
       + coalesce((select sum(percent_bps) from club_share_offers
                    where owner_user_id = p_owner and status = 'active'), 0)::int;
$$;
revoke all on function public.club_share_comprometido_interno(uuid) from public, anon, authenticated;
grant execute on function public.club_share_comprometido_interno(uuid) to service_role;

create or replace function public.club_share_ofertar(p_bps integer, p_price numeric)
returns table (ok boolean, motivo text, offer_id uuid)
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;
  if p_bps is null or p_bps < 100 or p_bps > 4900 then
    return query select false, 'bps_invalido'::text, null::uuid; return;
  end if;
  if p_price is null or p_price <= 0 or p_price <> floor(p_price) then
    return query select false, 'preco_invalido'::text, null::uuid; return;
  end if;
  -- O dono NUNCA perde a maioria: vendido + em oferta + este ≤ 49%.
  if public.club_share_comprometido_interno(v_uid) + p_bps > 4900 then
    return query select false, 'passa_de_49'::text, null::uuid; return;
  end if;
  insert into club_share_offers (owner_user_id, percent_bps, price_olefoot)
  values (v_uid, p_bps, p_price) returning id into v_id;
  return query select true, null::text, v_id;
end;
$$;

create or replace function public.club_share_cancelar(p_offer uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;
  update club_share_offers set status = 'cancelled'
   where id = p_offer and owner_user_id = v_uid and status = 'active';
  return found;
end;
$$;

create or replace function public.club_share_comprar(p_offer uuid)
returns table (ok boolean, motivo text, percent_bps integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_o record;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;
  select * into v_o from club_share_offers o
   where o.id = p_offer and o.status = 'active' for update;
  if not found then
    return query select false, 'indisponivel'::text, null::integer; return;
  end if;
  if v_o.owner_user_id = v_uid then
    return query select false, 'propria_oferta'::text, null::integer; return;
  end if;
  begin
    perform public.squad_market_ajustar_saldo_interno(v_uid, -(v_o.price_olefoot * 1000000000000000000));
  exception when others then
    if sqlerrm = 'SALDO_INSUFICIENTE' then
      return query select false, 'saldo_insuficiente'::text, null::integer; return;
    end if;
    raise;
  end;
  perform public.squad_market_ajustar_saldo_interno(v_o.owner_user_id, v_o.price_olefoot * 1000000000000000000);
  insert into club_shares (owner_user_id, holder_user_id, percent_bps)
  values (v_o.owner_user_id, v_uid, v_o.percent_bps)
  on conflict (owner_user_id, holder_user_id)
    do update set percent_bps = club_shares.percent_bps + excluded.percent_bps, updated_at = now();
  update club_share_offers set status = 'sold', buyer_user_id = v_uid, sold_at = now()
   where id = p_offer;
  return query select true, null::text, v_o.percent_bps;
end;
$$;

revoke all on function public.club_share_ofertar(integer, numeric) from public, anon;
revoke all on function public.club_share_cancelar(uuid) from public, anon;
revoke all on function public.club_share_comprar(uuid) from public, anon;
grant execute on function public.club_share_ofertar(integer, numeric) to authenticated, service_role;
grant execute on function public.club_share_cancelar(uuid) to authenticated, service_role;
grant execute on function public.club_share_comprar(uuid) to authenticated, service_role;

-- ─── o SPLIT de venda: formador 3% → cotistas → vendedor ────────────────────
-- Devolve o mapa do que pagou (vai pro `squad_listings.split`, e é ele que o
-- desfazer usa pra reverter EXATAMENTE o que aconteceu).
create or replace function public.squad_market_split_interno(
  p_seller uuid, p_price numeric, p_game_player_id text, p_listing uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_formador uuid;
  v_royalty numeric := 0;
  v_dividendos jsonb := '[]'::jsonb;
  v_div_total numeric := 0;
  v_h record;
  v_d numeric;
  v_liquido numeric;
begin
  -- Royalty: só quando o jogador TEM formador e não é o próprio vendedor.
  if p_game_player_id is not null then
    select formador_user_id into v_formador
      from player_formador where game_player_id = p_game_player_id;
    if v_formador is not null and v_formador <> p_seller then
      v_royalty := floor(p_price * 3 / 100);
      if v_royalty > 0 then
        perform public.squad_market_ajustar_saldo_interno(v_formador, v_royalty * 1000000000000000000);
      end if;
    else
      v_formador := null;
    end if;
  end if;

  -- Cotistas do clube VENDEDOR: fração do que sobrou após o royalty.
  for v_h in select holder_user_id, percent_bps from club_shares where owner_user_id = p_seller loop
    v_d := floor((p_price - v_royalty) * v_h.percent_bps / 10000);
    if v_d > 0 then
      perform public.squad_market_ajustar_saldo_interno(v_h.holder_user_id, v_d * 1000000000000000000);
      insert into club_share_dividends (holder_user_id, owner_user_id, listing_id, olefoot)
      values (v_h.holder_user_id, p_seller, p_listing, v_d);
      v_div_total := v_div_total + v_d;
      v_dividendos := v_dividendos || jsonb_build_object('holder', v_h.holder_user_id, 'olefoot', v_d);
    end if;
  end loop;

  v_liquido := p_price - v_royalty - v_div_total;
  perform public.squad_market_ajustar_saldo_interno(p_seller, v_liquido * 1000000000000000000);

  return jsonb_build_object(
    'formador', case when v_formador is null then null else jsonb_build_object('user', v_formador, 'olefoot', v_royalty) end,
    'dividendos', v_dividendos,
    'vendedor_liquido', v_liquido);
end;
$$;
revoke all on function public.squad_market_split_interno(uuid, numeric, text, uuid) from public, anon, authenticated;
grant execute on function public.squad_market_split_interno(uuid, numeric, text, uuid) to service_role;

/** Reverte um split gravado (desfazer / compensação). */
create or replace function public.squad_market_split_reverter_interno(p_seller uuid, p_price numeric, p_split jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare v_d jsonb;
begin
  if p_split is null then
    -- Venda liquidada antes do v2 (split inteiro pro vendedor).
    perform public.squad_market_ajustar_saldo_interno(p_seller, -(p_price * 1000000000000000000));
    return;
  end if;
  perform public.squad_market_ajustar_saldo_interno(
    p_seller, -((p_split ->> 'vendedor_liquido')::numeric * 1000000000000000000));
  if p_split -> 'formador' is not null and p_split ->> 'formador' <> 'null' then
    perform public.squad_market_ajustar_saldo_interno(
      (p_split -> 'formador' ->> 'user')::uuid,
      -((p_split -> 'formador' ->> 'olefoot')::numeric * 1000000000000000000));
  end if;
  for v_d in select * from jsonb_array_elements(coalesce(p_split -> 'dividendos', '[]'::jsonb)) loop
    perform public.squad_market_ajustar_saldo_interno(
      (v_d ->> 'holder')::uuid, -((v_d ->> 'olefoot')::numeric * 1000000000000000000));
  end loop;
end;
$$;
revoke all on function public.squad_market_split_reverter_interno(uuid, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.squad_market_split_reverter_interno(uuid, numeric, jsonb) to service_role;

-- ─── liquidar v2: agora com split (e só pra venda; aluguel tem a dele) ──────
create or replace function public.squad_market_liquidar(p_listing uuid, p_buyer uuid)
returns table (ok boolean, motivo text, seller uuid, kind text, game_player_id text, price_olefoot numeric)
language plpgsql security definer set search_path = public
as $$
-- O ON CONFLICT (game_player_id) abaixo colide com a coluna homônima do
-- RETURNS TABLE; dentro de SQL, coluna vence.
#variable_conflict use_column
declare
  v_l record;
  v_split jsonb;
begin
  select * into v_l from squad_listings l
   where l.id = p_listing and l.status = 'active' and l.kind in ('player', 'team')
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

  v_split := public.squad_market_split_interno(
    v_l.seller_user_id, v_l.price_olefoot,
    case when v_l.kind = 'player' then v_l.game_player_id else null end,
    p_listing);

  -- O PRIMEIRO vendedor de um jogador fica gravado como formador dele.
  if v_l.kind = 'player' then
    insert into player_formador (game_player_id, formador_user_id)
    values (v_l.game_player_id, v_l.seller_user_id)
    on conflict (game_player_id) do nothing;
  end if;

  update squad_listings
     set status = 'sold', buyer_user_id = p_buyer, sold_at = now(), split = v_split
   where id = p_listing;

  return query select true, null::text, v_l.seller_user_id, v_l.kind, v_l.game_player_id, v_l.price_olefoot;
end;
$$;

-- desfazer v2: reverte o split gravado, não só o vendedor.
create or replace function public.squad_market_desfazer(p_listing uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_l record;
begin
  select * into v_l from squad_listings l
   where l.id = p_listing and l.status = 'sold' and l.seller_applied_at is null
   for update;
  if not found then return false; end if;

  perform public.squad_market_split_reverter_interno(v_l.seller_user_id, v_l.price_olefoot, v_l.split);
  perform public.squad_market_ajustar_saldo_interno(v_l.buyer_user_id, v_l.price_olefoot * 1000000000000000000);

  update squad_listings
     set status = 'active', buyer_user_id = null, sold_at = null, split = null
   where id = p_listing;
  return true;
end;
$$;

-- ─── salário invertido (yield): o banco CONTA, o cliente só pede ────────────
create table if not exists public.yield_diario (
  user_id    uuid not null references auth.users(id) on delete cascade,
  dia        date not null,
  contado    integer not null default 0,
  olefoot    numeric(78,0) not null default 0,
  atualizado timestamptz not null default now(),
  primary key (user_id, dia)
);
alter table public.yield_diario enable row level security;
drop policy if exists yield_diario_proprio on public.yield_diario;
create policy yield_diario_proprio on public.yield_diario
  for select to authenticated using (user_id = auth.uid());
grant select on public.yield_diario to authenticated, service_role;
grant all on public.yield_diario to service_role;
revoke all on public.yield_diario from anon;
revoke insert, update, delete on public.yield_diario from authenticated;

create or replace function public.yield_reivindicar()
returns table (ok boolean, pago numeric, atuacoes_hoje integer, teto integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
  v_n integer;
  v_ja integer;
  v_delta integer;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;

  -- Atuações de HOJE com nota ≥ 7, contadas nos snapshots de PARTIDA do
  -- próprio servidor. Teto duro de 30/dia (≈ $0,004 — psicológico, não econômico).
  select count(*)::int into v_n
    from player_value_snapshots s
   where s.user_id = v_uid and s.source = 'match' and s.rating >= 7
     and (s.at at time zone 'America/Sao_Paulo')::date = v_dia;

  select contado into v_ja from yield_diario where user_id = v_uid and dia = v_dia for update;
  v_delta := least(v_n, 30) - coalesce(v_ja, 0);
  if v_delta <= 0 then
    return query select true, 0::numeric, v_n, 30; return;
  end if;

  perform public.squad_market_ajustar_saldo_interno(v_uid, v_delta::numeric * 1000000000000000000);
  insert into yield_diario (user_id, dia, contado, olefoot)
  values (v_uid, v_dia, least(v_n, 30), v_delta)
  on conflict (user_id, dia)
    do update set contado = excluded.contado,
                  olefoot = yield_diario.olefoot + excluded.olefoot,
                  atualizado = now();
  return query select true, v_delta::numeric, v_n, 30;
end;
$$;
revoke all on function public.yield_reivindicar() from public, anon;
grant execute on function public.yield_reivindicar() to authenticated, service_role;

-- ─── empréstimo com opção de compra ─────────────────────────────────────────
create table if not exists public.squad_loans (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid not null unique references public.squad_listings(id),
  game_player_id  text not null,
  owner_user_id   uuid not null references auth.users(id),
  borrower_user_id uuid not null references auth.users(id),
  rent_olefoot    numeric(78,0) not null check (rent_olefoot > 0),
  buyout_olefoot  numeric(78,0) check (buyout_olefoot is null or buyout_olefoot > 0),
  ends_at         timestamptz not null,
  status          text not null default 'active' check (status in ('active', 'returned', 'bought')),
  created_at      timestamptz not null default now(),
  returned_at     timestamptz,
  -- O cliente do LOCATÁRIO já tirou o devolvido do estado local? Sem este
  -- ack, o persist dele ressuscitaria o jogador no plantel errado (o mesmo
  -- contrato do seller_applied_at das vendas).
  borrower_applied_at timestamptz
);
create index if not exists squad_loans_partes on public.squad_loans (owner_user_id, status);
create index if not exists squad_loans_borrower on public.squad_loans (borrower_user_id, status);
alter table public.squad_loans enable row level security;
drop policy if exists squad_loans_partes on public.squad_loans;
create policy squad_loans_partes on public.squad_loans
  for select to authenticated using (owner_user_id = auth.uid() or borrower_user_id = auth.uid());
grant select on public.squad_loans to authenticated, service_role;
grant all on public.squad_loans to service_role;
revoke all on public.squad_loans from anon;
revoke insert, update, delete on public.squad_loans from authenticated;

/** Aluguel: dinheiro + contrato. O Hono move o jogador em seguida. */
create or replace function public.squad_loan_liquidar(p_listing uuid, p_buyer uuid)
returns table (ok boolean, motivo text, loan_id uuid, owner uuid, game_player_id text,
               rent numeric, ends_at timestamptz)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_l record;
  v_loan uuid;
  v_fim timestamptz;
begin
  select * into v_l from squad_listings l
   where l.id = p_listing and l.status = 'active' and l.kind = 'loan'
   for update;
  if not found then
    return query select false, 'indisponivel'::text, null::uuid, null::uuid, null::text, null::numeric, null::timestamptz;
    return;
  end if;
  if v_l.seller_user_id = p_buyer then
    return query select false, 'propria_listagem'::text, null::uuid, null::uuid, null::text, null::numeric, null::timestamptz;
    return;
  end if;
  begin
    perform public.squad_market_ajustar_saldo_interno(p_buyer, -(v_l.price_olefoot * 1000000000000000000));
  exception when others then
    if sqlerrm = 'SALDO_INSUFICIENTE' then
      return query select false, 'saldo_insuficiente'::text, null::uuid, null::uuid, null::text, null::numeric, null::timestamptz;
      return;
    end if;
    raise;
  end;
  -- Aluguel é renda direta do dono (sem royalty/dividendos — não é venda).
  perform public.squad_market_ajustar_saldo_interno(v_l.seller_user_id, v_l.price_olefoot * 1000000000000000000);

  v_fim := now() + make_interval(days => v_l.loan_days);
  insert into squad_loans (listing_id, game_player_id, owner_user_id, borrower_user_id,
                           rent_olefoot, buyout_olefoot, ends_at)
  values (p_listing, v_l.game_player_id, v_l.seller_user_id, p_buyer,
          v_l.price_olefoot, v_l.buyout_olefoot, v_fim)
  returning id into v_loan;

  update squad_listings set status = 'sold', buyer_user_id = p_buyer, sold_at = now()
   where id = p_listing;

  return query select true, null::text, v_loan, v_l.seller_user_id, v_l.game_player_id,
                      v_l.price_olefoot, v_fim;
end;
$$;

/** A entrega do alugado falhou: devolve o aluguel e reativa o anúncio. */
create or replace function public.squad_loan_desfazer(p_loan uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_e record;
begin
  select * into v_e from squad_loans e where e.id = p_loan and e.status = 'active' for update;
  if not found then return false; end if;
  perform public.squad_market_ajustar_saldo_interno(v_e.owner_user_id, -(v_e.rent_olefoot * 1000000000000000000));
  perform public.squad_market_ajustar_saldo_interno(v_e.borrower_user_id, v_e.rent_olefoot * 1000000000000000000);
  update squad_listings set status = 'active', buyer_user_id = null, sold_at = null
   where id = v_e.listing_id;
  delete from squad_loans where id = p_loan;
  return true;
end;
$$;

/** Opção de compra: o locatário fica com o jogador (já está no plantel dele). */
create or replace function public.squad_loan_buyout(p_loan uuid)
returns table (ok boolean, motivo text, price numeric)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_e record;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;
  select * into v_e from squad_loans e where e.id = p_loan and e.status = 'active' for update;
  if not found then
    return query select false, 'indisponivel'::text, null::numeric; return;
  end if;
  if v_e.borrower_user_id <> v_uid then
    return query select false, 'nao_e_o_locatario'::text, null::numeric; return;
  end if;
  if v_e.buyout_olefoot is null then
    return query select false, 'sem_opcao_de_compra'::text, null::numeric; return;
  end if;
  if now() > v_e.ends_at then
    return query select false, 'emprestimo_vencido'::text, null::numeric; return;
  end if;
  begin
    perform public.squad_market_ajustar_saldo_interno(v_uid, -(v_e.buyout_olefoot * 1000000000000000000));
  exception when others then
    if sqlerrm = 'SALDO_INSUFICIENTE' then
      return query select false, 'saldo_insuficiente'::text, null::numeric; return;
    end if;
    raise;
  end;
  -- Compra é compra: royalty do formador + dividendos dos cotistas do dono.
  perform public.squad_market_split_interno(v_e.owner_user_id, v_e.buyout_olefoot, v_e.game_player_id, v_e.listing_id);
  insert into player_formador (game_player_id, formador_user_id)
  values (v_e.game_player_id, v_e.owner_user_id)
  on conflict (game_player_id) do nothing;

  update squad_loans set status = 'bought', returned_at = now() where id = p_loan;
  return query select true, null::text, v_e.buyout_olefoot;
end;
$$;

/** O Hono devolveu o jogador ao dono: fecha o contrato. */
create or replace function public.squad_loan_marcar_devolvido(p_loan uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  update squad_loans set status = 'returned', returned_at = now()
   where id = p_loan and status = 'active' and now() >= ends_at;
  return found;
end;
$$;

revoke all on function public.squad_loan_liquidar(uuid, uuid) from public, anon, authenticated;
revoke all on function public.squad_loan_desfazer(uuid) from public, anon, authenticated;
revoke all on function public.squad_loan_marcar_devolvido(uuid) from public, anon, authenticated;
revoke all on function public.squad_loan_buyout(uuid) from public, anon;
grant execute on function public.squad_loan_liquidar(uuid, uuid) to service_role;
grant execute on function public.squad_loan_desfazer(uuid) to service_role;
grant execute on function public.squad_loan_marcar_devolvido(uuid) to service_role;
grant execute on function public.squad_loan_buyout(uuid) to authenticated, service_role;

-- ─── leilão-relâmpago do MVP ────────────────────────────────────────────────
create table if not exists public.mvp_auctions (
  id              uuid primary key default gen_random_uuid(),
  dia             date not null unique,
  game_player_id  text not null,
  player_name     text not null,
  player_snapshot jsonb not null,
  origem_user_id  uuid references auth.users(id),
  min_bid_olefoot numeric(78,0) not null check (min_bid_olefoot > 0),
  bid_olefoot     numeric(78,0),
  bidder_user_id  uuid references auth.users(id),
  starts_at       timestamptz not null default now(),
  ends_at         timestamptz not null,
  status          text not null default 'open' check (status in ('open', 'settled', 'void')),
  entregue_em     timestamptz,
  created_at      timestamptz not null default now()
);
alter table public.mvp_auctions enable row level security;
drop policy if exists mvp_auctions_le on public.mvp_auctions;
create policy mvp_auctions_le on public.mvp_auctions
  for select to authenticated using (true);
grant select on public.mvp_auctions to authenticated, service_role;
grant all on public.mvp_auctions to service_role;
revoke all on public.mvp_auctions from anon;
revoke insert, update, delete on public.mvp_auctions from authenticated;

/** Cria o leilão do dia: artilheiro REAL das últimas 24h, cópia única, 15 min. */
create or replace function public.mvp_auction_criar()
returns boolean language plpgsql security definer set search_path = public
as $$
declare
  v_top record;
  v_owner uuid;
  v_snap jsonb;
  v_ref numeric;
begin
  if exists (select 1 from mvp_auctions where dia = (now() at time zone 'America/Sao_Paulo')::date) then
    return false;
  end if;
  select g.player_id, g.name, g.pos, g.club_id, sum(g.goals) as gols
    into v_top
    from player_match_goals g
   where g.created_at > now() - interval '24 hours' and g.goals > 0
   group by g.player_id, g.name, g.pos, g.club_id
   order by sum(g.goals) desc, max(g.created_at) desc
   limit 1;
  if v_top is null or v_top.player_id is null then return false; end if;

  select p.id into v_owner from profiles p where p.club_id = v_top.club_id limit 1;
  if v_owner is null then return false; end if;

  select j into v_snap
    from manager_squad ms, jsonb_array_elements(ms.players) j
   where ms.user_id = v_owner and j ->> 'id' = v_top.player_id::text
   limit 1;
  if v_snap is null then return false; end if;

  v_ref := coalesce(nullif((v_snap ->> 'marketValueBroCents'), '')::numeric, 0) * 80;
  insert into mvp_auctions (dia, game_player_id, player_name, player_snapshot,
                            origem_user_id, min_bid_olefoot, ends_at)
  values ((now() at time zone 'America/Sao_Paulo')::date, v_top.player_id::text,
          coalesce(v_top.name, 'MVP'), v_snap, v_owner,
          greatest(1000, floor(v_ref / 2)), now() + interval '15 minutes');
  return true;
end;
$$;
revoke all on function public.mvp_auction_criar() from public, anon, authenticated;
grant execute on function public.mvp_auction_criar() to service_role;

/** Lance com escrow: debita já; o lance anterior volta inteiro pro superado. */
create or replace function public.mvp_bid(p_auction uuid, p_valor numeric)
returns table (ok boolean, motivo text, bid numeric, minimo numeric)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_a record;
  v_min numeric;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;
  select * into v_a from mvp_auctions a where a.id = p_auction and a.status = 'open' for update;
  if not found or now() < v_a.starts_at then
    return query select false, 'indisponivel'::text, null::numeric, null::numeric; return;
  end if;
  if now() >= v_a.ends_at then
    return query select false, 'encerrado'::text, v_a.bid_olefoot, null::numeric; return;
  end if;
  v_min := case when v_a.bid_olefoot is null then v_a.min_bid_olefoot
                else ceil(v_a.bid_olefoot * 105 / 100) end;
  if p_valor is null or p_valor <> floor(p_valor) or p_valor < v_min then
    return query select false, 'lance_baixo'::text, v_a.bid_olefoot, v_min; return;
  end if;
  if v_a.bidder_user_id = v_uid then
    return query select false, 'ja_es_o_maior'::text, v_a.bid_olefoot, v_min; return;
  end if;
  begin
    perform public.squad_market_ajustar_saldo_interno(v_uid, -(p_valor * 1000000000000000000));
  exception when others then
    if sqlerrm = 'SALDO_INSUFICIENTE' then
      return query select false, 'saldo_insuficiente'::text, v_a.bid_olefoot, v_min; return;
    end if;
    raise;
  end;
  if v_a.bidder_user_id is not null then
    perform public.squad_market_ajustar_saldo_interno(v_a.bidder_user_id, v_a.bid_olefoot * 1000000000000000000);
  end if;
  update mvp_auctions set bid_olefoot = p_valor, bidder_user_id = v_uid where id = p_auction;
  return query select true, null::text, p_valor, null::numeric;
end;
$$;
revoke all on function public.mvp_bid(uuid, numeric) from public, anon;
grant execute on function public.mvp_bid(uuid, numeric) to authenticated, service_role;

/** Liquida pro VENCEDOR: 50% ao dono do MVP, 50% é sink. Hono entrega a cópia. */
create or replace function public.mvp_auction_liquidar(p_auction uuid, p_winner uuid)
returns table (ok boolean, motivo text, player_snapshot jsonb, dia date, bid numeric)
language plpgsql security definer set search_path = public
as $$
declare v_a record; v_metade numeric;
begin
  select * into v_a from mvp_auctions a where a.id = p_auction and a.status = 'open' for update;
  if not found then
    return query select false, 'indisponivel'::text, null::jsonb, null::date, null::numeric; return;
  end if;
  if now() < v_a.ends_at then
    return query select false, 'ainda_aberto'::text, null::jsonb, null::date, null::numeric; return;
  end if;
  if v_a.bidder_user_id is null then
    update mvp_auctions set status = 'void' where id = p_auction;
    return query select false, 'sem_lances'::text, null::jsonb, null::date, null::numeric; return;
  end if;
  if v_a.bidder_user_id <> p_winner then
    return query select false, 'nao_e_o_vencedor'::text, null::jsonb, null::date, null::numeric; return;
  end if;

  v_metade := floor(v_a.bid_olefoot / 2);
  if v_a.origem_user_id is not null and v_metade > 0 then
    perform public.squad_market_ajustar_saldo_interno(v_a.origem_user_id, v_metade * 1000000000000000000);
  end if;
  -- A outra metade NÃO é creditada a ninguém — é o sink do leilão.
  update mvp_auctions set status = 'settled', entregue_em = now() where id = p_auction;
  return query select true, null::text, v_a.player_snapshot, v_a.dia, v_a.bid_olefoot;
end;
$$;

/** A entrega da cópia falhou: devolve o lance e anula (o dia não volta). */
create or replace function public.mvp_auction_desfazer(p_auction uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_a record; v_metade numeric;
begin
  select * into v_a from mvp_auctions a
   where a.id = p_auction and a.status = 'settled' for update;
  if not found then return false; end if;
  v_metade := floor(v_a.bid_olefoot / 2);
  if v_a.origem_user_id is not null and v_metade > 0 then
    perform public.squad_market_ajustar_saldo_interno(v_a.origem_user_id, -(v_metade * 1000000000000000000));
  end if;
  perform public.squad_market_ajustar_saldo_interno(v_a.bidder_user_id, v_a.bid_olefoot * 1000000000000000000);
  update mvp_auctions set status = 'void', entregue_em = null where id = p_auction;
  return true;
end;
$$;
revoke all on function public.mvp_auction_liquidar(uuid, uuid) from public, anon, authenticated;
revoke all on function public.mvp_auction_desfazer(uuid) from public, anon, authenticated;
grant execute on function public.mvp_auction_liquidar(uuid, uuid) to service_role;
grant execute on function public.mvp_auction_desfazer(uuid) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'mvp-auction-daily') then
      perform cron.unschedule('mvp-auction-daily');
    end if;
    -- 23:00 UTC = 20:00 em São Paulo — o horário nobre do leilão.
    perform cron.schedule('mvp-auction-daily', '0 23 * * *', 'select public.mvp_auction_criar()');
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — savepoint que termina em raise.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_chegou boolean := false;
  v_vend uuid; v_comp uuid; v_cot uuid;
  v_id uuid; v_r record; v_saldo numeric; v_loan uuid;
begin
  if has_function_privilege('anon', 'public.club_share_comprar(uuid)', 'execute')
     or has_function_privilege('anon', 'public.yield_reivindicar()', 'execute')
     or has_function_privilege('anon', 'public.mvp_bid(uuid,numeric)', 'execute')
     or has_function_privilege('authenticated', 'public.squad_market_split_interno(uuid,numeric,text,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.mvp_auction_criar()', 'execute')
     or not has_function_privilege('authenticated', 'public.squad_loan_buyout(uuid)', 'execute') then
    raise exception 'uma porta do squad_market_v2 ficou errada';
  end if;

  select u1.id, u2.id, u3.id into v_vend, v_comp, v_cot
    from auth.users u1
    join auth.users u2 on u2.id <> u1.id
    join auth.users u3 on u3.id not in (u1.id, u2.id)
   where not exists (select 1 from public.squad_listings s
                      where s.seller_user_id in (u1.id, u2.id, u3.id) or s.buyer_user_id in (u1.id, u2.id, u3.id))
   limit 1;
  if v_vend is null then
    raise notice 'sem três contas neste ambiente: verificação do v2 pulada';
    return;
  end if;

  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_comp, 'role', 'authenticated')::text, true);

    -- Saldos de teste.
    insert into public.legacy_olefoot_credits (user_id, balance_wei, balance_human, source)
    values (v_comp, 100000e18, '100000.000000000000000000', 'verificacao')
    on conflict (user_id) do update set balance_wei = excluded.balance_wei, balance_human = excluded.balance_human;
    delete from public.legacy_olefoot_credits where user_id in (v_vend, v_cot);

    -- COTAS: o comprador (logado) compra 20% do clube do vendedor por 1000.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_vend, 'role', 'authenticated')::text, true);
    select * into v_r from public.club_share_ofertar(2000, 1000);
    if not v_r.ok then raise exception 'ofertar cotas falhou: %', v_r.motivo; end if;
    v_id := v_r.offer_id;
    select * into v_r from public.club_share_ofertar(3000, 1);
    if v_r.ok or v_r.motivo <> 'passa_de_49' then
      raise exception '20%% + 30%% devia passar de 49%%, veio %', v_r.motivo; end if;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_comp, 'role', 'authenticated')::text, true);
    select * into v_r from public.club_share_comprar(v_id);
    if not v_r.ok or v_r.percent_bps <> 2000 then raise exception 'comprar cotas falhou: %', v_r.motivo; end if;

    -- VENDA com formador + dividendos:
    -- 1ª venda registra o vendedor como FORMADOR; cotista leva 20%.
    insert into public.squad_listings (kind, seller_user_id, game_player_id, player_snapshot, price_olefoot)
    values ('player', v_vend, 'zag-v2', '{"name":"Zagueiro V2"}'::jsonb, 10000)
    returning id into v_id;
    select * into v_r from public.squad_market_liquidar(v_id, v_comp);
    if not v_r.ok then raise exception '1ª venda falhou: %', v_r.motivo; end if;
    if (select formador_user_id from public.player_formador where game_player_id = 'zag-v2') <> v_vend then
      raise exception 'formador não foi registrado'; end if;
    -- Sem royalty (formador = vendedor); cotista do VENDEDOR leva 20% de 10000 = 2000.
    -- Saldo do comprador-cotista: 100000 − 1000 (cota) − 10000 (compra) + 2000 (dividendo).
    select balance_wei into v_saldo from public.legacy_olefoot_credits where user_id = v_comp;
    if v_saldo <> 91000e18 then
      raise exception 'dividendo do cotista errado: %', v_saldo; end if;
    -- Vendedor: 1000 (venda da cota) + 8000 (líquido da venda).
    if (select balance_wei from public.legacy_olefoot_credits where user_id = v_vend) <> 9000e18 then
      raise exception 'líquido do vendedor errado'; end if;

    -- 2ª venda (comprador revende ao cotista): royalty de 3% volta pro formador.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_cot, 'role', 'authenticated')::text, true);
    insert into public.legacy_olefoot_credits (user_id, balance_wei, balance_human, source)
    values (v_cot, 50000e18, '50000.000000000000000000', 'verificacao')
    on conflict (user_id) do update set balance_wei = excluded.balance_wei, balance_human = excluded.balance_human;
    insert into public.squad_listings (kind, seller_user_id, game_player_id, price_olefoot)
    values ('player', v_comp, 'zag-v2', 20000) returning id into v_id;
    select * into v_r from public.squad_market_liquidar(v_id, v_cot);
    if not v_r.ok then raise exception '2ª venda falhou: %', v_r.motivo; end if;
    -- Formador (v_vend) ganha 3% de 20000 = 600, além dos 9000 que tinha.
    if (select balance_wei from public.legacy_olefoot_credits where user_id = v_vend) <> 9600e18 then
      raise exception 'royalty do formador errado'; end if;

    -- DESFAZER da 2ª venda reverte royalty e vendedor, e devolve o comprador.
    if not public.squad_market_desfazer(v_id) then raise exception 'desfazer v2 falhou'; end if;
    if (select balance_wei from public.legacy_olefoot_credits where user_id = v_vend) <> 9000e18 then
      raise exception 'desfazer não reverteu o royalty'; end if;
    if (select balance_wei from public.legacy_olefoot_credits where user_id = v_cot) <> 50000e18 then
      raise exception 'desfazer não devolveu o comprador v2'; end if;

    -- EMPRÉSTIMO: aluga por 500, 7 dias, buyout 9000.
    insert into public.squad_listings (kind, seller_user_id, game_player_id, price_olefoot, loan_days, buyout_olefoot)
    values ('loan', v_cot, 'mei-loan', 500, 7, 9000) returning id into v_id;
    select * into v_r from public.squad_loan_liquidar(v_id, v_comp);
    if not v_r.ok or v_r.rent <> 500 then raise exception 'aluguel falhou: %', v_r.motivo; end if;
    v_loan := v_r.loan_id;
    -- Dono recebeu o aluguel inteiro (sem split).
    if (select balance_wei from public.legacy_olefoot_credits where user_id = v_cot) <> 50500e18 then
      raise exception 'aluguel não chegou inteiro no dono'; end if;
    -- BUYOUT pelo locatário: vira venda (formador do mei-loan nasce = dono).
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_comp, 'role', 'authenticated')::text, true);
    select * into v_r from public.squad_loan_buyout(v_loan);
    if not v_r.ok or v_r.price <> 9000 then raise exception 'buyout falhou: %', v_r.motivo; end if;
    if (select status from public.squad_loans where id = v_loan) <> 'bought' then
      raise exception 'buyout não fechou o contrato'; end if;
    if (select formador_user_id from public.player_formador where game_player_id = 'mei-loan') <> v_cot then
      raise exception 'buyout devia registrar o formador'; end if;

    -- YIELD: 2 atuações nota ≥ 7 hoje pagam 2; reivindicar de novo paga 0.
    insert into public.player_value_snapshots (user_id, game_player_id, name, ovr, market_bro_cents, rating, source)
    values (v_comp, 'a', 'A', 70, 1000, 7.4, 'match'),
           (v_comp, 'b', 'B', 70, 1000, 8.0, 'match'),
           (v_comp, 'c', 'C', 70, 1000, 6.9, 'match');
    select * into v_r from public.yield_reivindicar();
    if not v_r.ok or v_r.pago <> 2 or v_r.atuacoes_hoje <> 2 then
      raise exception 'yield devia pagar 2, veio % (%)', v_r.pago, v_r.atuacoes_hoje; end if;
    select * into v_r from public.yield_reivindicar();
    if v_r.pago <> 0 then raise exception 'yield pagou duas vezes'; end if;

    -- MVP: leilão com escrow — lance debita, lance maior devolve o anterior.
    insert into public.mvp_auctions (dia, game_player_id, player_name, player_snapshot,
                                     origem_user_id, min_bid_olefoot, ends_at)
    values ('2001-01-01', 'mvp-x', 'MVP X', '{"id":"mvp-x","name":"MVP X"}'::jsonb,
            v_vend, 1000, now() + interval '15 minutes')
    returning id into v_id;
    select balance_wei into v_saldo from public.legacy_olefoot_credits where user_id = v_comp;
    select * into v_r from public.mvp_bid(v_id, 999);
    if v_r.ok or v_r.motivo <> 'lance_baixo' then raise exception 'lance abaixo do mínimo passou'; end if;
    select * into v_r from public.mvp_bid(v_id, 1000);
    if not v_r.ok then raise exception 'lance mínimo falhou: %', v_r.motivo; end if;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_cot, 'role', 'authenticated')::text, true);
    select * into v_r from public.mvp_bid(v_id, 1050);
    if not v_r.ok then raise exception 'sobrelance falhou: %', v_r.motivo; end if;
    -- O superado recebeu o lance de volta.
    if (select balance_wei from public.legacy_olefoot_credits where user_id = v_comp) <> v_saldo - 1000e18 + 1000e18 then
      raise exception 'escrow não devolveu o lance superado'; end if;
    -- Liquidar antes do fim: não. Depois do fim: 50% pro dono do MVP.
    select * into v_r from public.mvp_auction_liquidar(v_id, v_cot);
    if v_r.ok or v_r.motivo <> 'ainda_aberto' then raise exception 'liquidou leilão aberto'; end if;
    update public.mvp_auctions set ends_at = now() - interval '1 minute' where id = v_id;
    select balance_wei into v_saldo from public.legacy_olefoot_credits where user_id = v_vend;
    select * into v_r from public.mvp_auction_liquidar(v_id, v_cot);
    if not v_r.ok then raise exception 'liquidar MVP falhou: %', v_r.motivo; end if;
    if (select balance_wei from public.legacy_olefoot_credits where user_id = v_vend) <> v_saldo + 525e18 then
      raise exception 'o dono do MVP devia receber 525 (50%% de 1050)'; end if;

    v_chegou := true;
    raise exception 'DESFAZ_A_VERIFICACAO';
  exception when others then
    if sqlerrm <> 'DESFAZ_A_VERIFICACAO' then raise; end if;
  end;

  perform set_config('request.jwt.claims', '', true);
  if not v_chegou then raise exception 'a verificação não chegou ao fim'; end if;
  if exists (select 1 from public.player_formador where game_player_id in ('zag-v2', 'mei-loan')) then
    raise exception 'a verificação deixou rastro';
  end if;
end $$;
