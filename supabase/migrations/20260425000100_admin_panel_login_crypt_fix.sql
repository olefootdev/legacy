-- Fix: `crypt()` do pgcrypto está no schema `extensions` no Supabase, e o
-- `set search_path = public` das RPCs não o resolve → função não encontrada.
-- Recria as RPCs qualificando `extensions.crypt` / `extensions.gen_salt`
-- (ou adicionando extensions ao search_path).

create or replace function public.admin_panel_login(p_email text, p_password text)
returns table (email text, display_name text, role text)
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
    select au.email, au.display_name, au.role
      from public.admin_panel_users au
     where au.email = v_email
       and au.active = true
     limit 1;
end;
$$;

revoke all on function public.admin_panel_login(text, text) from public;
grant execute on function public.admin_panel_login(text, text) to anon, authenticated;


create or replace function public.admin_panel_set_password(
  p_email text,
  p_new_password text,
  p_display_name text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(p_email));
  v_hash text := extensions.crypt(p_new_password, extensions.gen_salt('bf'));
begin
  if not public.is_admin() then
    raise exception 'admin required';
  end if;
  if p_new_password is null or length(p_new_password) < 8 then
    raise exception 'password must be at least 8 chars';
  end if;

  insert into public.admin_panel_users (email, password_hash, display_name)
  values (v_email, v_hash, p_display_name)
  on conflict (email) do update set
    password_hash = v_hash,
    display_name = coalesce(p_display_name, public.admin_panel_users.display_name),
    active = true;
end;
$$;

revoke all on function public.admin_panel_set_password(text, text, text) from public;
grant execute on function public.admin_panel_set_password(text, text, text) to authenticated;
