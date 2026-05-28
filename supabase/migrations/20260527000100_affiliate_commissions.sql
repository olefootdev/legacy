-- ============================================================
-- affiliate_commissions — ledger multinível L1/L2/L3
--
-- Super-Bônus de Depósito: 5% L1 + 5% L2 + 5% L3 sobre todo wallet_credits
-- que carregar BRO/EXP e for marcado applied_at.
--
-- Por que ESSA arquitetura:
--   - Hook em wallet_credits.applied_at: qualquer caminho de depósito (admin,
--     gateway futuro, edge function de webhook) termina marcando applied_at.
--     Plugamos UMA vez, vale pra sempre.
--   - Tabela genérica (currency + source + level) suporta BRO, OLEXP, USDT no
--     futuro sem migration nova.
--   - Idempotência via UNIQUE (source_ref, level): nunca paga 2x pelo mesmo
--     wallet_credit.
-- ============================================================

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  level smallint not null check (level between 1 and 3),
  source text not null check (source in ('deposit', 'purchase', 'match_reward', 'manual')),
  source_ref text not null,
  currency text not null check (currency in ('BRO', 'EXP', 'OLEXP', 'USDT', 'USD')),
  -- BRO/EXP em unidades inteiras (cents pra BRO, EXP inteiro); OLEXP/USDT em numeric
  amount_cents bigint,
  amount_numeric numeric(36, 8),
  rate numeric(6, 4) not null default 0.0500,
  base_amount_cents bigint,
  base_amount_numeric numeric(36, 8),
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'reversed')),
  transaction_hash text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),

  -- Idempotência: 1 entry por (source_ref, level)
  constraint affiliate_commissions_idempotent unique (source_ref, level)
);

create index if not exists affiliate_commissions_referrer_idx
  on public.affiliate_commissions (referrer_id, created_at desc);

create index if not exists affiliate_commissions_referred_idx
  on public.affiliate_commissions (referred_id);

create index if not exists affiliate_commissions_pending_idx
  on public.affiliate_commissions (referrer_id, currency)
  where claimed_at is null;

alter table public.affiliate_commissions enable row level security;

drop policy if exists affiliate_commissions_select_referrer on public.affiliate_commissions;
create policy affiliate_commissions_select_referrer
  on public.affiliate_commissions
  for select
  using (referrer_id = auth.uid());

-- ============================================================
-- Helper: resolve cadeia L1/L2/L3 de um user pelo referred_by_code
-- ============================================================

create or replace function public.get_referral_chain(
  p_user_id uuid,
  p_max_levels int default 3
)
returns table (
  level smallint,
  referrer_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cur_id uuid := p_user_id;
  v_cur_code text;
  v_next_referrer uuid;
  v_level smallint := 1;
begin
  while v_level <= p_max_levels loop
    select p.referred_by_code into v_cur_code
      from public.profiles p
     where p.id = v_cur_id;

    if v_cur_code is null or v_cur_code = '' then
      return;
    end if;

    select p.id into v_next_referrer
      from public.profiles p
     where p.my_referral_code = v_cur_code
     limit 1;

    if v_next_referrer is null or v_next_referrer = p_user_id then
      return;
    end if;

    level := v_level;
    referrer_id := v_next_referrer;
    return next;

    v_cur_id := v_next_referrer;
    v_level := v_level + 1;
  end loop;
end;
$$;

revoke execute on function public.get_referral_chain(uuid, int) from anon, public;

-- ============================================================
-- Trigger: ao aplicar wallet_credit, paga 5%-5%-5% nos 3 níveis
-- ============================================================

create or replace function public.trg_wallet_credit_affiliate_bonus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate numeric := 0.05;
  v_bro_bonus bigint;
  v_exp_bonus bigint;
  v_chain record;
begin
  -- Só dispara quando applied_at vira NOT NULL (ou seja, depósito confirmado)
  if new.applied_at is null then
    return new;
  end if;
  if old.applied_at is not null then
    return new; -- já tinha applied_at, não dispara de novo
  end if;

  -- Calcula bônus 5% sobre o crédito aplicado
  v_bro_bonus := coalesce(floor(new.bro_cents * v_rate), 0)::bigint;
  v_exp_bonus := coalesce(floor(coalesce(new.exp_amount, 0) * v_rate), 0)::bigint;

  if v_bro_bonus <= 0 and v_exp_bonus <= 0 then
    return new;
  end if;

  -- Itera cadeia L1/L2/L3
  for v_chain in select * from public.get_referral_chain(new.user_id, 3) loop
    if v_bro_bonus > 0 then
      insert into public.affiliate_commissions (
        referrer_id, referred_id, level, source, source_ref,
        currency, amount_cents, rate, base_amount_cents, status
      ) values (
        v_chain.referrer_id, new.user_id, v_chain.level, 'deposit',
        'wallet_credit:' || new.id::text || ':BRO',
        'BRO', v_bro_bonus, v_rate, new.bro_cents, 'confirmed'
      )
      on conflict (source_ref, level) do nothing;
    end if;

    if v_exp_bonus > 0 then
      insert into public.affiliate_commissions (
        referrer_id, referred_id, level, source, source_ref,
        currency, amount_cents, rate, base_amount_cents, status
      ) values (
        v_chain.referrer_id, new.user_id, v_chain.level, 'deposit',
        'wallet_credit:' || new.id::text || ':EXP',
        'EXP', v_exp_bonus, v_rate, new.exp_amount, 'confirmed'
      )
      on conflict (source_ref, level) do nothing;
    end if;
  end loop;

  return new;
end;
$$;

revoke execute on function public.trg_wallet_credit_affiliate_bonus() from anon, authenticated, public;

drop trigger if exists wallet_credits_affiliate_bonus_trg on public.wallet_credits;
create trigger wallet_credits_affiliate_bonus_trg
  after update of applied_at on public.wallet_credits
  for each row
  execute function public.trg_wallet_credit_affiliate_bonus();

-- ============================================================
-- RPC get_my_affiliate_commissions — agregado por nível + currency
-- ============================================================

create or replace function public.get_my_affiliate_commissions()
returns table (
  level smallint,
  currency text,
  total_pending_cents bigint,
  total_claimed_cents bigint,
  entry_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.level,
    c.currency,
    coalesce(sum(case when c.claimed_at is null then c.amount_cents else 0 end), 0)::bigint as total_pending_cents,
    coalesce(sum(case when c.claimed_at is not null then c.amount_cents else 0 end), 0)::bigint as total_claimed_cents,
    count(*)::bigint as entry_count
  from public.affiliate_commissions c
  where c.referrer_id = auth.uid()
    and c.status = 'confirmed'
  group by c.level, c.currency
  order by c.level, c.currency;
$$;

revoke execute on function public.get_my_affiliate_commissions() from anon, public;
grant execute on function public.get_my_affiliate_commissions() to authenticated;

-- ============================================================
-- RPC claim_my_affiliate_commissions — marca claimed_at + retorna totais
-- ============================================================

create or replace function public.claim_my_affiliate_commissions(
  p_currency text default null
)
returns table (
  currency text,
  total_cents bigint
)
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

  return query
  with claimed as (
    update public.affiliate_commissions
       set claimed_at = now()
     where referrer_id = v_uid
       and claimed_at is null
       and status = 'confirmed'
       and (p_currency is null or currency = p_currency)
    returning currency, amount_cents
  )
  select c.currency, coalesce(sum(c.amount_cents), 0)::bigint
    from claimed c
   group by c.currency;
end;
$$;

revoke execute on function public.claim_my_affiliate_commissions(text) from anon, public;
grant execute on function public.claim_my_affiliate_commissions(text) to authenticated;
