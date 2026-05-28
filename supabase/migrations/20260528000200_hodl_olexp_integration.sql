-- ============================================================
-- HODL ↔ OLEXP INTEGRATION
--
-- Antes: create_hodl_lock criava lock sem debitar saldo. BUG grave.
-- Agora: debita via _debit_olexp atomicamente. Rewards diários creditam.
-- Lock maturado libera principal de volta ao saldo.
--
-- TUDO atômico — qualquer falha rola back o lock inteiro.
-- ============================================================

-- ============================================================
-- 1. SUBSTITUI create_hodl_lock — agora debita saldo OLEXP
-- ============================================================

create or replace function public.create_hodl_lock(
  p_amount numeric,
  p_currency text default 'OLEXP'
)
returns table (
  lock_id uuid,
  premium_card_id uuid,
  end_date timestamptz,
  new_olexp_balance numeric
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
  v_new_balance numeric(36, 8);
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;

  if not public.is_user_activated(v_uid) then
    raise exception 'ACTIVATION_REQUIRED: compre o pack de $25 para participar do HODL';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  -- Atualmente só OLEXP. Quando suportarmos BRO/USDT, expandir aqui.
  if p_currency <> 'OLEXP' then
    raise exception 'unsupported currency for HODL: % (only OLEXP for now)', p_currency;
  end if;

  v_end_date := now() + interval '90 days';

  -- 1. DEBITA OLEXP do user (raises se saldo insuficiente — toda transação rola back)
  insert into public.hodl_locks (user_id, amount_locked, currency, end_date)
  values (v_uid, p_amount, p_currency, v_end_date)
  returning id into v_lock_id;

  v_new_balance := public._debit_olexp(v_uid, p_amount, 'hodl_lock', v_lock_id::text);

  -- 2. Premium card instantâneo
  insert into public.premium_cards_grants (user_id, card_tier, source, source_ref, card_metadata)
  values (
    v_uid, 'premium', 'hodl_lock', v_lock_id::text,
    jsonb_build_object('lock_amount', p_amount, 'lock_currency', p_currency, 'lock_end_date', v_end_date)
  )
  returning id into v_card_id;

  return query select v_lock_id, v_card_id, v_end_date, v_new_balance;
end;
$$;

revoke execute on function public.create_hodl_lock(numeric, text) from anon, public;
grant execute on function public.create_hodl_lock(numeric, text) to authenticated;

-- ============================================================
-- 2. SUBSTITUI process_hodl_daily_tick — credita rewards no OLEXP balance
-- ============================================================

create or replace function public.process_hodl_daily_tick(
  p_target_date date default current_date
)
returns table (
  rewards_paid int,
  locks_matured int,
  lottery_winner uuid,
  lottery_eligible int,
  total_olexp_credited numeric
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
  v_total_credited numeric := 0;
begin
  -- 1. Maturar locks vencidos + LIBERAR principal de volta ao saldo OLEXP
  for v_lock in
    select id, user_id, amount_locked
      from public.hodl_locks
     where status = 'active'
       and end_date <= now()
  loop
    update public.hodl_locks
       set status = 'matured',
           matured_claimed_at = now(),
           updated_at = now()
     where id = v_lock.id;

    -- LIBERA principal: credita de volta ao saldo OLEXP do user
    perform public._credit_olexp(v_lock.user_id, v_lock.amount_locked, 'hodl_matured', v_lock.id::text);

    v_matured := v_matured + 1;
    v_total_credited := v_total_credited + v_lock.amount_locked;
  end loop;

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
      -- Credita reward direto no saldo OLEXP do user
      perform public._credit_olexp(v_lock.user_id, v_daily_reward, 'hodl_daily_reward', v_lock.id::text || ':' || p_target_date::text);

      update public.hodl_locks
         set total_rewards_paid = total_rewards_paid + v_daily_reward,
             last_reward_date = p_target_date,
             updated_at = now()
       where id = v_lock.id;

      v_rewards_paid := v_rewards_paid + 1;
      v_total_credited := v_total_credited + v_daily_reward;
    end if;
  end loop;

  -- 3. Sorteio diário (1 vez por dia, idempotente)
  if not exists (select 1 from public.hodl_lottery_draws where draw_date = p_target_date) then
    select count(*)::int into v_eligible
      from public.hodl_locks
     where status = 'active';

    if v_eligible > 0 then
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

      insert into public.premium_cards_grants (
        user_id, card_tier, source, source_ref, card_metadata
      ) values (
        v_winner_user_id, 'premium', 'hodl_lottery', p_target_date::text,
        jsonb_build_object('draw_date', p_target_date, 'lock_id', v_winner_lock_id)
      )
      on conflict (source, source_ref) do nothing;
    end if;
  end if;

  return query select v_rewards_paid, v_matured, v_winner_user_id, v_eligible, v_total_credited;
end;
$$;

revoke execute on function public.process_hodl_daily_tick(date) from anon, public, authenticated;

-- ============================================================
-- 3. NOVO RPC — get_hodl_rewards_for_lock (histórico de rewards de 1 lock)
-- ============================================================

create or replace function public.get_hodl_rewards_for_lock(p_lock_id uuid)
returns table (
  paid_for_date date,
  amount numeric,
  currency text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.paid_for_date, r.amount, r.currency, r.created_at
    from public.hodl_daily_rewards r
    join public.hodl_locks l on l.id = r.lock_id
   where r.lock_id = p_lock_id
     and l.user_id = auth.uid()
   order by r.paid_for_date desc;
$$;

revoke execute on function public.get_hodl_rewards_for_lock(uuid) from anon, public;
grant execute on function public.get_hodl_rewards_for_lock(uuid) to authenticated;

-- ============================================================
-- 4. NOVO RPC — get_recent_lottery_draws (feed público)
-- ============================================================

create or replace function public.get_recent_lottery_draws(p_limit int default 10)
returns table (
  draw_date date,
  winner_user_id uuid,
  winner_display_name text,
  winner_club_short text,
  prize_type text,
  eligible_count int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.draw_date,
    d.winner_user_id,
    p.display_name,
    p.club_short,
    d.prize_type,
    d.eligible_count
  from public.hodl_lottery_draws d
  left join public.profiles p on p.id = d.winner_user_id
  order by d.draw_date desc
  limit greatest(p_limit, 5);
$$;

revoke execute on function public.get_recent_lottery_draws(int) from anon, public;
grant execute on function public.get_recent_lottery_draws(int) to authenticated;
