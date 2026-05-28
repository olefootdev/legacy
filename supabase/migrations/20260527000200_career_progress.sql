-- ============================================================
-- career_progress — Plano de Carreira "Cash Only" da OLEFOOT
--
-- 1 BRO (≈ 1 USD) ganho em comissão = 1 ponto vitalício.
--
-- Ranks (cumulativo, pago UMA vez por nível):
--   10.000 pts  → Júnior   ($50)
--   50.000      → Pro      ($250)
--   100.000     → Diretor  ($500)
--   250.000     → Campeão  ($2.500)
--   500.000     → Legend   ($5.000)
--
-- Trigger sobre affiliate_commissions: cada comissão confirmada em moeda
-- USD-equivalente (BRO ou USDT) soma pontos.
-- ============================================================

create table if not exists public.career_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  lifetime_points bigint not null default 0,
  current_rank text not null default 'rookie' check (current_rank in (
    'rookie', 'junior', 'pro', 'diretor', 'campeao', 'legend'
  )),
  total_commissions_cents bigint not null default 0,
  unlocked_rewards jsonb not null default '[]'::jsonb,
  pending_bonus_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists career_progress_rank_idx
  on public.career_progress (current_rank, lifetime_points desc);

alter table public.career_progress enable row level security;

drop policy if exists career_progress_select_self on public.career_progress;
create policy career_progress_select_self
  on public.career_progress
  for select
  using (user_id = auth.uid());

-- Leaderboard público (top N) — leitura agregada permitida via RPC, não policy

-- ============================================================
-- Função: rank a partir de pontos
-- ============================================================

create or replace function public.get_rank_for_points(p_points bigint)
returns text
language sql
immutable
as $$
  select case
    when p_points >= 500000 then 'legend'
    when p_points >= 250000 then 'campeao'
    when p_points >= 100000 then 'diretor'
    when p_points >= 50000  then 'pro'
    when p_points >= 10000  then 'junior'
    else 'rookie'
  end;
$$;

create or replace function public.get_rank_bonus_cents(p_rank text)
returns bigint
language sql
immutable
as $$
  select case p_rank
    when 'junior'  then 5000
    when 'pro'     then 25000
    when 'diretor' then 50000
    when 'campeao' then 250000
    when 'legend'  then 500000
    else 0
  end::bigint;
$$;

create or replace function public.get_rank_threshold(p_rank text)
returns bigint
language sql
immutable
as $$
  select case p_rank
    when 'junior'  then 10000
    when 'pro'     then 50000
    when 'diretor' then 100000
    when 'campeao' then 250000
    when 'legend'  then 500000
    else 0
  end::bigint;
$$;

-- ============================================================
-- Trigger: ao confirmar comissão de afiliado USD-equivalente, soma pontos
-- ============================================================

create or replace function public.trg_career_progress_accrue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points_delta bigint;
  v_new_total bigint;
  v_new_rank text;
  v_old_rank text;
begin
  -- Só conta comissão confirmada em moeda fiat-equivalent (1:1 USD)
  if new.status <> 'confirmed' then
    return new;
  end if;

  if new.currency not in ('BRO', 'USDT', 'USD') then
    return new;
  end if;

  -- 1 BRO cent = 0.01 ponto → 100 cents = 1 ponto
  v_points_delta := public.bro_cents_to_career_points(new.amount_cents);
  if v_points_delta <= 0 then
    return new;
  end if;

  insert into public.career_progress (user_id, lifetime_points, total_commissions_cents)
  values (new.referrer_id, v_points_delta, new.amount_cents)
  on conflict (user_id) do update
    set lifetime_points = career_progress.lifetime_points + v_points_delta,
        total_commissions_cents = career_progress.total_commissions_cents + new.amount_cents,
        updated_at = now()
  returning lifetime_points, current_rank into v_new_total, v_old_rank;

  v_new_rank := public.get_rank_for_points(v_new_total);

  if v_new_rank <> v_old_rank then
    update public.career_progress
       set current_rank = v_new_rank,
           pending_bonus_cents = pending_bonus_cents + public.get_rank_bonus_cents(v_new_rank),
           updated_at = now()
     where user_id = new.referrer_id;
  end if;

  return new;
end;
$$;

revoke execute on function public.trg_career_progress_accrue() from anon, authenticated, public;

drop trigger if exists affiliate_commissions_career_progress_trg on public.affiliate_commissions;
create trigger affiliate_commissions_career_progress_trg
  after insert on public.affiliate_commissions
  for each row
  execute function public.trg_career_progress_accrue();

-- ============================================================
-- RPC get_my_career_progress
-- ============================================================

create or replace function public.get_my_career_progress()
returns table (
  user_id uuid,
  lifetime_points bigint,
  current_rank text,
  next_rank text,
  next_rank_threshold bigint,
  progress_pct numeric,
  total_commissions_cents bigint,
  unlocked_rewards jsonb,
  pending_bonus_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;

  -- Garante row existente
  insert into public.career_progress (user_id) values (v_uid)
  on conflict (user_id) do nothing;

  return query
  select
    cp.user_id,
    cp.lifetime_points,
    cp.current_rank,
    case cp.current_rank
      when 'rookie'  then 'junior'
      when 'junior'  then 'pro'
      when 'pro'     then 'diretor'
      when 'diretor' then 'campeao'
      when 'campeao' then 'legend'
      else 'legend'
    end as next_rank,
    case cp.current_rank
      when 'rookie'  then 10000
      when 'junior'  then 50000
      when 'pro'     then 100000
      when 'diretor' then 250000
      when 'campeao' then 500000
      else 500000
    end::bigint as next_rank_threshold,
    case
      when cp.current_rank = 'legend' then 100::numeric
      else round((cp.lifetime_points::numeric / nullif(
        case cp.current_rank
          when 'rookie'  then 10000
          when 'junior'  then 50000
          when 'pro'     then 100000
          when 'diretor' then 250000
          when 'campeao' then 500000
          else 1
        end, 0
      )) * 100, 2)
    end as progress_pct,
    cp.total_commissions_cents,
    cp.unlocked_rewards,
    cp.pending_bonus_cents
  from public.career_progress cp
  where cp.user_id = v_uid;
end;
$$;

revoke execute on function public.get_my_career_progress() from anon, public;
grant execute on function public.get_my_career_progress() to authenticated;

-- ============================================================
-- RPC claim_career_bonus — paga bônus pendente pra wallet_credits
-- ============================================================

create or replace function public.claim_career_bonus()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pending bigint;
  v_rank text;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  -- Lock row pra evitar race condition
  select pending_bonus_cents, current_rank into v_pending, v_rank
    from public.career_progress
   where user_id = v_uid
   for update;

  if v_pending is null or v_pending <= 0 then
    return 0;
  end if;

  -- Cria wallet_credit já aplicado (entra no SPOT do user via trigger normal)
  insert into public.wallet_credits (user_id, bro_cents, exp_amount, reason, applied_at)
  values (
    v_uid,
    v_pending,
    0,
    'career_bonus:' || v_rank,
    null
  );

  -- Marca histórico
  update public.career_progress
     set unlocked_rewards = unlocked_rewards || jsonb_build_object(
       'rank', v_rank,
       'amount_cents', v_pending,
       'claimed_at', now()
     ),
     pending_bonus_cents = 0,
     updated_at = now()
   where user_id = v_uid;

  return v_pending;
end;
$$;

revoke execute on function public.claim_career_bonus() from anon, public;
grant execute on function public.claim_career_bonus() to authenticated;

-- ============================================================
-- RPC career_leaderboard — top 50 por pontos
-- ============================================================

create or replace function public.career_leaderboard(p_limit int default 50)
returns table (
  display_name text,
  club_short text,
  current_rank text,
  lifetime_points bigint,
  rank_position bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.display_name,
    p.club_short,
    cp.current_rank,
    cp.lifetime_points,
    row_number() over (order by cp.lifetime_points desc)::bigint as rank_position
  from public.career_progress cp
  join public.profiles p on p.id = cp.user_id
  where cp.lifetime_points > 0
  order by cp.lifetime_points desc
  limit greatest(p_limit, 10);
$$;

revoke execute on function public.career_leaderboard(int) from anon, public;
grant execute on function public.career_leaderboard(int) to authenticated;
