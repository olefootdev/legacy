-- Fecha o loop da comissão de indicação: ledger → claim → saldo.
--
-- Adiciona claimed_at no ledger e RPC pra resgatar.
-- get_my_referrals agora retorna commission_pending (claimable) e
-- commission_total (histórico cumulativo).

-- ============================================================
-- 1. Coluna claimed_at no ledger (nullable: null = pendente)
-- ============================================================

alter table public.referral_exp_commissions
  add column if not exists claimed_at timestamptz;

create index if not exists referral_exp_commissions_pending_idx
  on public.referral_exp_commissions (referrer_id)
  where claimed_at is null;

-- ============================================================
-- 2. RPC claim: marca como claimed e retorna o total resgatado
-- ============================================================

create or replace function public.claim_my_referral_commissions(
  p_referred_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_total bigint;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  with claimed as (
    update public.referral_exp_commissions
       set claimed_at = now()
     where referrer_id = v_uid
       and claimed_at is null
       and (p_referred_id is null or referred_id = p_referred_id)
    returning exp_amount
  )
  select coalesce(sum(exp_amount), 0)::bigint into v_total from claimed;

  return v_total;
end;
$$;

revoke execute on function public.claim_my_referral_commissions(uuid) from anon, public;
grant execute on function public.claim_my_referral_commissions(uuid) to authenticated;

-- ============================================================
-- 3. Update get_my_referrals: separa pending vs total
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
  commission_pending bigint,
  commission_total bigint
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
           and c.claimed_at is null
      ), 0)::bigint as commission_pending,
      coalesce((
        select sum(c.exp_amount)::bigint
          from public.referral_exp_commissions c
         where c.referrer_id = v_my_id
           and c.referred_id = p.id
      ), 0)::bigint as commission_total
    from public.profiles p
   where p.referred_by_code = v_my_code
   order by p.created_at desc;
end;
$$;

revoke execute on function public.get_my_referrals() from anon, public;
grant execute on function public.get_my_referrals() to authenticated;
