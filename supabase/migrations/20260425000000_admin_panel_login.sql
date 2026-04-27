-- Login dedicado pro painel admin.
-- Separa a identidade do admin do auth.users do jogo: o admin pode ter uma
-- conta de jogo totalmente diferente (ou nenhuma) e ainda ter painel.
--
-- Fluxo: cliente chama `admin_panel_login(email, senha)`. Se bateu, grava
-- sessão em localStorage (frontend) — o painel abre.
-- Segurança real das operações continua em `is_admin()` nas RPCs de admin_*.

create extension if not exists pgcrypto;

create table if not exists public.admin_panel_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  display_name text,
  role text not null default 'admin',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table public.admin_panel_users enable row level security;

-- Tudo bloqueado via policy — só acesso via RPCs definidas abaixo.
drop policy if exists apu_no_direct on public.admin_panel_users;
create policy apu_no_direct on public.admin_panel_users
  for all
  using (false)
  with check (false);

-- ─── RPC: login (valida email+senha, atualiza last_login_at) ───────────
create or replace function public.admin_panel_login(p_email text, p_password text)
returns table (email text, display_name text, role text)
language plpgsql
security definer
set search_path = public
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
     and au.password_hash = crypt(p_password, au.password_hash);

  if not found then
    return;  -- credenciais inválidas → retorna 0 linhas
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

comment on function public.admin_panel_login(text, text) is
  'Gate de UI pro painel admin. Separado do auth.users. DB-side a segurança real continua em is_admin().';

-- ─── RPC: setar/trocar senha (exige admin atual autenticado) ───────────
create or replace function public.admin_panel_set_password(
  p_email text,
  p_new_password text,
  p_display_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_hash text := crypt(p_new_password, gen_salt('bf'));
begin
  if not public.is_admin() then
    raise exception 'admin required';
  end if;
  if p_new_password is null or length(p_new_password) < 12 then
    raise exception 'password must be at least 12 chars';
  end if;

  -- Validar complexidade da senha
  if p_new_password !~ '^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])' then
    raise exception 'password must contain uppercase, lowercase, number and special character (@$!%*?&)';
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

comment on function public.admin_panel_set_password(text, text, text) is
  'Cria ou atualiza credencial de acesso ao painel admin. Exige sessão auth já admin.';

-- ─── Seed inicial — IMPORTANTE ─────────────────────────────────────────
-- Rode isto manualmente no SQL Editor após a migration pra criar a primeira
-- credencial de painel. Troque os valores por algo forte:
--
--   insert into public.admin_panel_users (email, password_hash, display_name)
--   values (
--     'olefootdev@gmail.com',
--     crypt('TROQUE_ESTA_SENHA', gen_salt('bf')),
--     'Olefoot Admin'
--   )
--   on conflict (email) do update set
--     password_hash = crypt('TROQUE_ESTA_SENHA', gen_salt('bf')),
--     active = true;
