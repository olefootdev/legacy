-- Sistema de comissão EXP sobre indicados (5% de todo EXP ganho pelo indicado).
--
-- Como funciona:
--   1. Cliente sincroniza `profiles.exp_lifetime_earned` em eventos críticos
--      (login + pós-partida) com o valor de `finance.expLifetimeEarned` local
--   2. Trigger AFTER UPDATE detecta delta positivo
--   3. Se o profile tem `referred_by_code` → resolve o referrer e cria entry
--      em `referral_exp_commissions` com round(delta * 0.05)
--   4. RPC `get_my_referrals` agrega o total recebido por cada indicado
--
-- O credit automático no saldo do referrer fica como próxima iteração.
-- Esta migration entrega o LEDGER + DISPLAY (decisão de produto, 2026-05-26).

-- ============================================================
-- 1. Coluna pra rastrear lifetime EXP no profile
-- ============================================================

alter table public.profiles
  add column if not exists exp_lifetime_earned bigint not null default 0;

create index if not exists profiles_exp_lifetime_idx
  on public.profiles (exp_lifetime_earned)
  where exp_lifetime_earned > 0;

-- ============================================================
-- 2. Tabela ledger de comissões
-- ============================================================

create table if not exists public.referral_exp_commissions (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  exp_amount bigint not null check (exp_amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists referral_exp_commissions_referrer_idx
  on public.referral_exp_commissions (referrer_id, created_at desc);

create index if not exists referral_exp_commissions_referred_idx
  on public.referral_exp_commissions (referred_id);

alter table public.referral_exp_commissions enable row level security;

-- Só o referrer pode ler suas próprias comissões.
drop policy if exists referral_exp_commissions_select_referrer on public.referral_exp_commissions;
create policy referral_exp_commissions_select_referrer
  on public.referral_exp_commissions
  for select
  using (referrer_id = auth.uid());

-- Inserts vêm só do trigger (service_role contexto). Sem policy de INSERT
-- pra clientes autenticados — eles não devem criar comissão diretamente.

-- ============================================================
-- 3. Trigger: credita comissão no ledger quando indicado ganha EXP
-- ============================================================

create or replace function public.trg_referral_exp_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta bigint;
  v_referrer_id uuid;
  v_commission bigint;
begin
  -- Só age se exp_lifetime_earned aumentou
  v_delta := coalesce(new.exp_lifetime_earned, 0) - coalesce(old.exp_lifetime_earned, 0);
  if v_delta <= 0 then
    return new;
  end if;

  -- Sem referrer → sem comissão
  if new.referred_by_code is null then
    return new;
  end if;

  -- Resolve o referrer
  select p.id into v_referrer_id
    from public.profiles p
   where p.my_referral_code = new.referred_by_code
   limit 1;

  if v_referrer_id is null or v_referrer_id = new.id then
    return new;
  end if;

  -- 5% sobre o delta
  v_commission := round(v_delta * 0.05);
  if v_commission <= 0 then
    return new;
  end if;

  insert into public.referral_exp_commissions (referrer_id, referred_id, exp_amount)
  values (v_referrer_id, new.id, v_commission);

  return new;
end;
$$;

revoke execute on function public.trg_referral_exp_commission() from anon, authenticated, public;

drop trigger if exists profiles_referral_exp_commission_trg on public.profiles;
create trigger profiles_referral_exp_commission_trg
  after update of exp_lifetime_earned on public.profiles
  for each row
  execute function public.trg_referral_exp_commission();

-- ============================================================
-- 4. RPC pra sincronizar exp_lifetime_earned do client
-- ============================================================

create or replace function public.sync_my_exp_lifetime(p_amount bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;
  if p_amount is null or p_amount < 0 then
    return;
  end if;

  -- Monotonic: nunca regredir o lifetime (defende contra client com state stale)
  update public.profiles
     set exp_lifetime_earned = greatest(exp_lifetime_earned, p_amount)
   where id = v_uid
     and exp_lifetime_earned < p_amount;
end;
$$;

revoke execute on function public.sync_my_exp_lifetime(bigint) from anon, public;
grant execute on function public.sync_my_exp_lifetime(bigint) to authenticated;

-- ============================================================
-- 5. RPC get_my_referrals: retorna lifetime + commission agregada
-- ============================================================

drop function if exists public.get_my_referrals();

create or replace function public.get_my_referrals()
returns table (
  id uuid,
  display_name text,
  club_name text,
  club_short text,
  created_at timestamptz,
  exp_lifetime_earned bigint,
  commission_earned bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_my_code text;
  v_my_id uuid := auth.uid();
begin
  if v_my_id is null then
    return;
  end if;

  select p.my_referral_code into v_my_code
    from public.profiles p
   where p.id = v_my_id;

  if v_my_code is null then
    return;
  end if;

  return query
    select
      p.id,
      p.display_name,
      p.club_name,
      p.club_short,
      p.created_at,
      coalesce(p.exp_lifetime_earned, 0)::bigint as exp_lifetime_earned,
      coalesce((
        select sum(c.exp_amount)::bigint
          from public.referral_exp_commissions c
         where c.referrer_id = v_my_id
           and c.referred_id = p.id
      ), 0)::bigint as commission_earned
    from public.profiles p
   where p.referred_by_code = v_my_code
   order by p.created_at desc;
end;
$$;

revoke execute on function public.get_my_referrals() from anon, public;
grant execute on function public.get_my_referrals() to authenticated;
