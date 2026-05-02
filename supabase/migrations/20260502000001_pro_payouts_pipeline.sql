-- Pipeline de distribuição de vendas pro PRO.
-- Quando um market_purchases insert acontece, lê o payment_split do player
-- e credita cada beneficiário (user_id) em pro_payouts proporcional ao percent.
-- Valores em EXP (mesma unidade de price_exp). Conversão p/ BRL fica pra WALLET.

create table if not exists public.pro_payouts (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  purchase_id     uuid references public.market_purchases(id) on delete set null,
  player_id       text not null,
  player_name     text,
  split_kind      text not null,
  percent         numeric(5,2) not null,
  amount_exp      bigint not null check (amount_exp >= 0),
  created_at      timestamptz not null default now()
);
create index if not exists pro_payouts_user_idx on public.pro_payouts (user_id, created_at desc);
create index if not exists pro_payouts_player_idx on public.pro_payouts (player_id);

alter table public.pro_payouts enable row level security;
drop policy if exists "user reads own pro_payouts" on public.pro_payouts;
create policy "user reads own pro_payouts"
  on public.pro_payouts for select
  using (auth.uid() = user_id);

create or replace function public.distribute_player_sale(
  p_purchase_id uuid,
  p_player_id text,
  p_price_exp bigint
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_split jsonb;
  v_name text;
  v_entry jsonb;
  v_pct numeric;
  v_uid uuid;
  v_kind text;
  v_amount bigint;
begin
  select payment_split, name into v_split, v_name
    from public.genesis_market_players where id = p_player_id;
  if v_split is null then
    select payment_split, name into v_split, v_name
      from public.legacy_players where id = p_player_id;
  end if;
  if v_split is null or jsonb_typeof(v_split) <> 'array' then return; end if;

  for v_entry in select * from jsonb_array_elements(v_split) loop
    v_pct := coalesce((v_entry->>'percent')::numeric, 0);
    v_kind := coalesce(v_entry->>'kind', 'unknown');
    v_amount := floor(p_price_exp * v_pct / 100)::bigint;
    if v_amount <= 0 then continue; end if;
    begin v_uid := (v_entry->>'user_id')::uuid;
    exception when others then v_uid := null;
    end;
    if v_uid is null then continue; end if;
    insert into public.pro_payouts (
      user_id, purchase_id, player_id, player_name, split_kind, percent, amount_exp
    ) values (
      v_uid, p_purchase_id, p_player_id, v_name, v_kind, v_pct, v_amount
    );
  end loop;
end;
$$;
revoke all on function public.distribute_player_sale(uuid, text, bigint) from public;
grant execute on function public.distribute_player_sale(uuid, text, bigint) to authenticated;

create or replace function public.trg_market_purchase_distribute()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.distribute_player_sale(new.id, new.genesis_id, new.price_exp);
  return new;
end; $$;
drop trigger if exists market_purchases_distribute on public.market_purchases;
create trigger market_purchases_distribute
  after insert on public.market_purchases
  for each row execute function public.trg_market_purchase_distribute();

create or replace function public.get_my_pro_summary()
returns table (balance_exp bigint, total_sales int, last_sale_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  return query
    select coalesce(sum(p.amount_exp), 0)::bigint,
           count(distinct p.purchase_id)::int,
           max(p.created_at)
      from public.pro_payouts p where p.user_id = v_uid;
end; $$;
revoke all on function public.get_my_pro_summary() from public;
grant execute on function public.get_my_pro_summary() to authenticated;

create or replace function public.get_my_pro_payouts(p_limit int default 50)
returns table (
  id bigint, player_id text, player_name text, split_kind text,
  percent numeric, amount_exp bigint, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  return query
    select p.id, p.player_id, p.player_name, p.split_kind, p.percent, p.amount_exp, p.created_at
      from public.pro_payouts p where p.user_id = v_uid
     order by p.created_at desc
     limit greatest(coalesce(p_limit, 50), 1);
end; $$;
revoke all on function public.get_my_pro_payouts(int) from public;
grant execute on function public.get_my_pro_payouts(int) to authenticated;
