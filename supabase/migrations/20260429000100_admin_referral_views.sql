-- Admin: expõe `referred_by_code` no listing de profiles e um agregado
-- de top referrers (quantos managers cada código indicou).

drop function if exists public.admin_list_profiles();

create or replace function public.admin_list_profiles()
returns table (
  id uuid,
  display_name text,
  club_name text,
  club_short text,
  created_at timestamptz,
  updated_at timestamptz,
  onboarding_data jsonb,
  referred_by_code text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin required';
  end if;
  return query
    select p.id, p.display_name, p.club_name, p.club_short,
           p.created_at, p.updated_at, p.onboarding_data, p.referred_by_code
      from public.profiles p
     order by p.updated_at desc
     limit 500;
end;
$$;

revoke all on function public.admin_list_profiles() from public;
grant execute on function public.admin_list_profiles() to authenticated;

-- Top referrers: código → quantos managers indicados.
create or replace function public.admin_list_top_referrers(p_limit int default 50)
returns table (
  referred_by_code text,
  referred_count bigint,
  first_referral_at timestamptz,
  last_referral_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin required';
  end if;
  return query
    select p.referred_by_code,
           count(*)::bigint as referred_count,
           min(p.created_at) as first_referral_at,
           max(p.created_at) as last_referral_at
      from public.profiles p
     where p.referred_by_code is not null
     group by p.referred_by_code
     order by referred_count desc, last_referral_at desc
     limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

revoke all on function public.admin_list_top_referrers(int) from public;
grant execute on function public.admin_list_top_referrers(int) to authenticated;
