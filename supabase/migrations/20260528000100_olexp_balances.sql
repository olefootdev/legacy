-- ============================================================
-- OLEXP BALANCES — Ledger server-side de OLEXP
--
-- Por que existe:
--   Antes: OLEXP era apenas Zustand client-side em WalletState.
--   Problema: create_hodl_lock aceitava qualquer amount sem debitar.
--   User podia "travar" 1M OLEXP sem ter saldo e drenar treasury.
--
-- Modelo:
--   - olexp_balances: cache do saldo atual (1 row por user)
--   - olexp_ledger: histórico imutável de débitos/créditos
--   - Funções _credit_olexp / _debit_olexp são security definer,
--     internas (sem grant pra authenticated/anon), só chamadas por
--     outras RPCs (HODL, futuro marketplace, futuro PIX).
-- ============================================================

create table if not exists public.olexp_balances (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric(36, 8) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists olexp_balances_balance_idx
  on public.olexp_balances (balance desc)
  where balance > 0;

alter table public.olexp_balances enable row level security;

drop policy if exists olexp_balances_select_self on public.olexp_balances;
create policy olexp_balances_select_self
  on public.olexp_balances
  for select
  using (user_id = auth.uid());

-- ============================================================
-- Ledger imutável de movimentos OLEXP
-- ============================================================

create table if not exists public.olexp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta numeric(36, 8) not null check (delta <> 0),
  balance_after numeric(36, 8) not null check (balance_after >= 0),
  source text not null check (source in (
    'hodl_lock', 'hodl_matured', 'hodl_daily_reward', 'hodl_lottery',
    'admin_grant', 'admin_debit', 'card_purchase', 'pix_deposit',
    'swap_in', 'swap_out', 'initial_seed'
  )),
  source_ref text,
  created_at timestamptz not null default now()
);

create index if not exists olexp_ledger_user_idx
  on public.olexp_ledger (user_id, created_at desc);

create index if not exists olexp_ledger_source_idx
  on public.olexp_ledger (source, created_at desc);

alter table public.olexp_ledger enable row level security;

drop policy if exists olexp_ledger_select_self on public.olexp_ledger;
create policy olexp_ledger_select_self
  on public.olexp_ledger
  for select
  using (user_id = auth.uid());

-- ============================================================
-- Função interna: _credit_olexp
-- (security definer, sem grant — só chamada por outras RPCs)
-- ============================================================

create or replace function public._credit_olexp(
  p_user_id uuid,
  p_amount numeric,
  p_source text,
  p_source_ref text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance numeric(36, 8);
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT: credit must be positive';
  end if;

  insert into public.olexp_balances (user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id) do update
    set balance = olexp_balances.balance + p_amount,
        updated_at = now()
  returning balance into v_new_balance;

  insert into public.olexp_ledger (user_id, delta, balance_after, source, source_ref)
  values (p_user_id, p_amount, v_new_balance, p_source, p_source_ref);

  return v_new_balance;
end;
$$;

revoke execute on function public._credit_olexp(uuid, numeric, text, text) from anon, authenticated, public;

-- ============================================================
-- Função interna: _debit_olexp
-- Lock row + valida saldo + raise INSUFFICIENT_OLEXP_BALANCE
-- ============================================================

create or replace function public._debit_olexp(
  p_user_id uuid,
  p_amount numeric,
  p_source text,
  p_source_ref text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_balance numeric(36, 8);
  v_new_balance numeric(36, 8);
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT: debit must be positive';
  end if;

  -- Lock row pra evitar race condition em débitos concorrentes
  select balance into v_current_balance
    from public.olexp_balances
   where user_id = p_user_id
   for update;

  if v_current_balance is null then
    raise exception 'INSUFFICIENT_OLEXP_BALANCE: saldo zero';
  end if;

  if v_current_balance < p_amount then
    raise exception 'INSUFFICIENT_OLEXP_BALANCE: saldo % insuficiente para débito de %', v_current_balance, p_amount;
  end if;

  v_new_balance := v_current_balance - p_amount;

  update public.olexp_balances
     set balance = v_new_balance,
         updated_at = now()
   where user_id = p_user_id;

  insert into public.olexp_ledger (user_id, delta, balance_after, source, source_ref)
  values (p_user_id, -p_amount, v_new_balance, p_source, p_source_ref);

  return v_new_balance;
end;
$$;

revoke execute on function public._debit_olexp(uuid, numeric, text, text) from anon, authenticated, public;

-- ============================================================
-- RPC pública: get_my_olexp_balance
-- ============================================================

create or replace function public.get_my_olexp_balance()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(balance, 0)::numeric(36, 8)
    from public.olexp_balances
   where user_id = auth.uid();
$$;

revoke execute on function public.get_my_olexp_balance() from anon, public;
grant execute on function public.get_my_olexp_balance() to authenticated;

-- ============================================================
-- RPC pública: get_my_olexp_ledger (histórico)
-- ============================================================

create or replace function public.get_my_olexp_ledger(p_limit int default 50)
returns table (
  id uuid,
  delta numeric,
  balance_after numeric,
  source text,
  source_ref text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, delta, balance_after, source, source_ref, created_at
    from public.olexp_ledger
   where user_id = auth.uid()
   order by created_at desc
   limit greatest(p_limit, 10);
$$;

revoke execute on function public.get_my_olexp_ledger(int) from anon, public;
grant execute on function public.get_my_olexp_ledger(int) to authenticated;

-- ============================================================
-- RPC admin: admin_credit_olexp / admin_debit_olexp (auditável)
-- ============================================================

create or replace function public.admin_credit_olexp(
  p_target_user_id uuid,
  p_amount numeric,
  p_reason text
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  return public._credit_olexp(p_target_user_id, p_amount, 'admin_grant', p_reason);
end;
$$;

revoke execute on function public.admin_credit_olexp(uuid, numeric, text) from anon, public;
grant execute on function public.admin_credit_olexp(uuid, numeric, text) to authenticated;
