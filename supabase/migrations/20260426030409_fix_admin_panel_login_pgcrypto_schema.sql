-- Fix admin_panel_login to use pgcrypto from extensions schema

create or replace function public.admin_panel_login(
  p_email text,
  p_password text,
  p_ip_address text default null,
  p_user_agent text default null,
  p_two_factor_code text default null
)
returns table (email text, display_name text, role text, two_factor_enabled boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if p_password is null or length(p_password) = 0 or v_email = '' then
    return;
  end if;

  update public.admin_panel_users au
     set last_login_at = now()
   where au.email = v_email
     and au.active = true
     and au.password_hash = extensions.crypt(p_password, au.password_hash);

  if not found then
    return;
  end if;

  return query
    select au.email, au.display_name, au.role, false as two_factor_enabled
      from public.admin_panel_users au
     where au.email = v_email
       and au.active = true
     limit 1;
end;
$$;

grant execute on function public.admin_panel_login(text, text, text, text, text) to anon, authenticated;
