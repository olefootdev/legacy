-- RPC pra o painel admin listar todos os profiles com métricas básicas.
-- Somente admin (is_admin() check) pode chamar.

drop function if exists public.admin_list_profiles();

create function public.admin_list_profiles()
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
