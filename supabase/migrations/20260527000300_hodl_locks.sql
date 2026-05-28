-- ============================================================
-- HODL System — Lock-up de 90 dias com 7,5%/mês (0,25%/dia)
--
-- Fluxo:
--   1. Usuário trava OLEXP via create_hodl_lock(amount)
--   2. Recebe instantaneamente 1 Premium Card (premium_cards_grants)
--   3. Edge function diária (hodl-daily-tick) processa:
--        - rewards de cada lock ativo (0,25% diário em OLEXP)
--        - sorteio entre locks ativos (1 winner/dia, prize card)
--        - maturação de locks com end_date passado
--   4. Após end_date, principal volta pra disposição normal do user
--
-- Saldo OLEXP: existe como wallet.olexpPositions client-side. Aqui criamos
-- ledger server-side que reflete LOCKS específicos do HODL (separado dos
-- planos OLEXP convencionais de 90/180/360d).
-- ============================================================

create table if not exists public.hodl_locks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_locked numeric(36, 8) not null check (amount_locked > 0),
  currency text not null default 'OLEXP' check (currency in ('OLEXP', 'BRO', 'USDT')),
  reward_rate_daily numeric(8, 6) not null default 0.0025,
  start_date timestamptz not null default now(),
  end_date timestamptz not null,
  status text not null default 'active' check (status in ('active', 'matured', 'cancelled')),
  total_rewards_paid numeric(36, 8) not null default 0,
  last_reward_date date,
  matured_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hodl_locks_user_idx
  on public.hodl_locks (user_id, status, created_at desc);

create index if not exists hodl_locks_active_idx
  on public.hodl_locks (status, end_date)
  where status = 'active';

alter table public.hodl_locks enable row level security;

drop policy if exists hodl_locks_select_self on public.hodl_locks;
create policy hodl_locks_select_self
  on public.hodl_locks
  for select
  using (user_id = auth.uid());

-- ============================================================
-- hodl_daily_rewards — ledger imutável de payouts diários (idempotência)
-- ============================================================

create table if not exists public.hodl_daily_rewards (
  id uuid primary key default gen_random_uuid(),
  lock_id uuid not null references public.hodl_locks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  paid_for_date date not null,
  amount numeric(36, 8) not null,
  currency text not null,
  created_at timestamptz not null default now(),
  -- 1 payout por (lock, day)
  constraint hodl_daily_rewards_idempotent unique (lock_id, paid_for_date)
);

create index if not exists hodl_daily_rewards_user_idx
  on public.hodl_daily_rewards (user_id, paid_for_date desc);

alter table public.hodl_daily_rewards enable row level security;

drop policy if exists hodl_daily_rewards_select_self on public.hodl_daily_rewards;
create policy hodl_daily_rewards_select_self
  on public.hodl_daily_rewards
  for select
  using (user_id = auth.uid());

-- ============================================================
-- hodl_lottery_draws — sorteio diário
-- ============================================================

create table if not exists public.hodl_lottery_draws (
  id uuid primary key default gen_random_uuid(),
  draw_date date not null,
  winner_user_id uuid references public.profiles(id) on delete set null,
  winner_lock_id uuid references public.hodl_locks(id) on delete set null,
  prize_type text not null check (prize_type in ('premium_card', 'rare_card', 'legendary_card')),
  prize_metadata jsonb not null default '{}'::jsonb,
  eligible_count int not null default 0,
  created_at timestamptz not null default now(),
  constraint hodl_lottery_draws_one_per_day unique (draw_date)
);

create index if not exists hodl_lottery_draws_winner_idx
  on public.hodl_lottery_draws (winner_user_id, draw_date desc);

alter table public.hodl_lottery_draws enable row level security;

drop policy if exists hodl_lottery_draws_select_all on public.hodl_lottery_draws;
create policy hodl_lottery_draws_select_all
  on public.hodl_lottery_draws
  for select
  using (true);

-- ============================================================
-- premium_cards_grants — registro de cards entregues
-- ============================================================

create table if not exists public.premium_cards_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_tier text not null default 'premium' check (card_tier in ('premium', 'rare', 'legendary')),
  source text not null check (source in ('hodl_lock', 'hodl_lottery', 'career_bonus', 'admin')),
  source_ref text not null,
  card_metadata jsonb not null default '{}'::jsonb,
  redeemed_at timestamptz,
  granted_at timestamptz not null default now(),
  constraint premium_cards_grants_idempotent unique (source, source_ref)
);

create index if not exists premium_cards_grants_user_idx
  on public.premium_cards_grants (user_id, granted_at desc);

create index if not exists premium_cards_grants_pending_idx
  on public.premium_cards_grants (user_id)
  where redeemed_at is null;

alter table public.premium_cards_grants enable row level security;

drop policy if exists premium_cards_grants_select_self on public.premium_cards_grants;
create policy premium_cards_grants_select_self
  on public.premium_cards_grants
  for select
  using (user_id = auth.uid());

-- ============================================================
-- RPC create_hodl_lock — cria lock + dispara premium card
-- ============================================================

create or replace function public.create_hodl_lock(
  p_amount numeric,
  p_currency text default 'OLEXP'
)
returns table (
  lock_id uuid,
  premium_card_id uuid,
  end_date timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lock_id uuid;
  v_card_id uuid;
  v_end_date timestamptz;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  if p_currency not in ('OLEXP', 'BRO', 'USDT') then
    raise exception 'unsupported currency: %', p_currency;
  end if;

  v_end_date := now() + interval '90 days';

  insert into public.hodl_locks (user_id, amount_locked, currency, end_date)
  values (v_uid, p_amount, p_currency, v_end_date)
  returning id into v_lock_id;

  -- Premium card instantâneo
  insert into public.premium_cards_grants (user_id, card_tier, source, source_ref, card_metadata)
  values (
    v_uid,
    'premium',
    'hodl_lock',
    v_lock_id::text,
    jsonb_build_object(
      'lock_amount', p_amount,
      'lock_currency', p_currency,
      'lock_end_date', v_end_date
    )
  )
  returning id into v_card_id;

  return query select v_lock_id, v_card_id, v_end_date;
end;
$$;

revoke execute on function public.create_hodl_lock(numeric, text) from anon, public;
grant execute on function public.create_hodl_lock(numeric, text) to authenticated;

-- ============================================================
-- RPC get_my_hodl_locks
-- ============================================================

create or replace function public.get_my_hodl_locks()
returns table (
  id uuid,
  amount_locked numeric,
  currency text,
  reward_rate_daily numeric,
  start_date timestamptz,
  end_date timestamptz,
  status text,
  total_rewards_paid numeric,
  days_remaining int,
  projected_total_rewards numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    l.amount_locked,
    l.currency,
    l.reward_rate_daily,
    l.start_date,
    l.end_date,
    l.status,
    l.total_rewards_paid,
    greatest(0, extract(day from (l.end_date - now()))::int) as days_remaining,
    round(l.amount_locked * l.reward_rate_daily * 90, 8) as projected_total_rewards
  from public.hodl_locks l
  where l.user_id = auth.uid()
  order by l.created_at desc;
$$;

revoke execute on function public.get_my_hodl_locks() from anon, public;
grant execute on function public.get_my_hodl_locks() to authenticated;

-- ============================================================
-- RPC get_my_premium_cards — cards pendentes de redenção
-- ============================================================

create or replace function public.get_my_premium_cards(p_only_pending boolean default true)
returns table (
  id uuid,
  card_tier text,
  source text,
  card_metadata jsonb,
  granted_at timestamptz,
  redeemed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, card_tier, source, card_metadata, granted_at, redeemed_at
    from public.premium_cards_grants
   where user_id = auth.uid()
     and (not p_only_pending or redeemed_at is null)
   order by granted_at desc;
$$;

revoke execute on function public.get_my_premium_cards(boolean) from anon, public;
grant execute on function public.get_my_premium_cards(boolean) to authenticated;

-- ============================================================
-- RPC redeem_premium_card — marca card como usado
-- ============================================================

create or replace function public.redeem_premium_card(p_card_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_updated int;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  update public.premium_cards_grants
     set redeemed_at = now()
   where id = p_card_id
     and user_id = v_uid
     and redeemed_at is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke execute on function public.redeem_premium_card(uuid) from anon, public;
grant execute on function public.redeem_premium_card(uuid) to authenticated;

-- ============================================================
-- RPC process_hodl_daily_tick — núcleo do cron diário
--
-- Para cada lock 'active':
--   - se end_date passou → status='matured'
--   - senão → cria 1 hodl_daily_rewards (idempotente por dia)
--
-- Faz 1 sorteio diário entre locks ativos (1 premium card pro vencedor).
--
-- IMPORTANTE: chamada via service_role (edge function). Idempotente por dia.
-- ============================================================

create or replace function public.process_hodl_daily_tick(
  p_target_date date default current_date
)
returns table (
  rewards_paid int,
  locks_matured int,
  lottery_winner uuid,
  lottery_eligible int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rewards_paid int := 0;
  v_matured int := 0;
  v_winner_user_id uuid;
  v_winner_lock_id uuid;
  v_eligible int := 0;
  v_lock record;
  v_daily_reward numeric;
begin
  -- 1. Maturar locks vencidos
  update public.hodl_locks
     set status = 'matured', updated_at = now()
   where status = 'active'
     and end_date <= now();
  get diagnostics v_matured = row_count;

  -- 2. Pagar rewards a todos locks ativos (idempotente por lock+date)
  for v_lock in
    select id, user_id, amount_locked, reward_rate_daily, currency
      from public.hodl_locks
     where status = 'active'
       and (last_reward_date is null or last_reward_date < p_target_date)
  loop
    v_daily_reward := round(v_lock.amount_locked * v_lock.reward_rate_daily, 8);
    if v_daily_reward <= 0 then continue; end if;

    insert into public.hodl_daily_rewards (
      lock_id, user_id, paid_for_date, amount, currency
    ) values (
      v_lock.id, v_lock.user_id, p_target_date, v_daily_reward, v_lock.currency
    )
    on conflict (lock_id, paid_for_date) do nothing;

    if found then
      update public.hodl_locks
         set total_rewards_paid = total_rewards_paid + v_daily_reward,
             last_reward_date = p_target_date,
             updated_at = now()
       where id = v_lock.id;
      v_rewards_paid := v_rewards_paid + 1;
    end if;
  end loop;

  -- 3. Sorteio diário (1 vez por dia, idempotente via UNIQUE draw_date)
  if not exists (select 1 from public.hodl_lottery_draws where draw_date = p_target_date) then
    select count(*)::int into v_eligible
      from public.hodl_locks
     where status = 'active';

    if v_eligible > 0 then
      -- Pega 1 lock aleatório entre os ativos (peso uniforme por lock)
      select id, user_id into v_winner_lock_id, v_winner_user_id
        from public.hodl_locks
       where status = 'active'
       order by random()
       limit 1;

      insert into public.hodl_lottery_draws (
        draw_date, winner_user_id, winner_lock_id, prize_type,
        prize_metadata, eligible_count
      ) values (
        p_target_date, v_winner_user_id, v_winner_lock_id, 'premium_card',
        jsonb_build_object('drawn_at', now()), v_eligible
      );

      -- Entrega o prêmio (premium card)
      insert into public.premium_cards_grants (
        user_id, card_tier, source, source_ref, card_metadata
      ) values (
        v_winner_user_id, 'premium', 'hodl_lottery', p_target_date::text,
        jsonb_build_object('draw_date', p_target_date, 'lock_id', v_winner_lock_id)
      )
      on conflict (source, source_ref) do nothing;
    end if;
  end if;

  return query select v_rewards_paid, v_matured, v_winner_user_id, v_eligible;
end;
$$;

revoke execute on function public.process_hodl_daily_tick(date) from anon, public, authenticated;
-- Apenas service_role (via edge function) executa o tick

-- ============================================================
-- pg_cron schedule (executa 00:05 UTC todo dia)
-- ============================================================

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('hodl-daily-tick');
    perform cron.schedule(
      'hodl-daily-tick',
      '5 0 * * *',
      $cron$
        select public.process_hodl_daily_tick(current_date);
      $cron$
    );
  end if;
exception when others then
  -- Se pg_cron não está disponível, ignora — edge function ainda pode chamar
  null;
end;
$$;
