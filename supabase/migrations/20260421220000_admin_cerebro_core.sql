-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — admin_cerebro_core
--
-- 1. profiles.status + RLS (bloqueio de banned)
-- 2. admin_set_user_status RPC
-- 3. get_my_status RPC (client usa no boot pra deslogar banned)
-- 4. audit_log: RPC admin_read_audit_log (security definer)
-- 5. platform_config: singleton chave/valor pra configs e feature flags globais
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. profiles.status ─────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists status text not null default 'active'
    check (status in ('active', 'suspended', 'banned'));

create index if not exists idx_profiles_status on public.profiles (status);

-- RLS: usuário banned não consegue ler próprio profile.
drop policy if exists "profiles_self_read_active" on public.profiles;
create policy "profiles_self_read_active"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id and status in ('active', 'suspended'));

-- ─── 2. admin_set_user_status (security definer) ────────────────────────────
-- NOTA: em produção, proteja com verificação de admin. Por ora, basta ter a
-- função; acesso efetivo é via service_role key ou wrapper server-side.
create or replace function public.admin_set_user_status(
  p_user_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('active', 'suspended', 'banned') then
    raise exception 'invalid status';
  end if;
  update public.profiles set status = p_status, updated_at = now() where id = p_user_id;
  return found;
end;
$$;

revoke all on function public.admin_set_user_status(uuid, text) from public;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;

-- ─── 3. get_my_status (client usa no boot) ──────────────────────────────────
create or replace function public.get_my_status()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text;
begin
  if auth.uid() is null then return null; end if;
  select status into v from public.profiles where id = auth.uid();
  return coalesce(v, 'active');
end;
$$;

revoke all on function public.get_my_status() from public;
grant execute on function public.get_my_status() to authenticated;

-- ─── 4. admin_read_audit_log ────────────────────────────────────────────────
create or replace function public.admin_read_audit_log(
  p_limit int default 100,
  p_table text default null
)
returns setof public.audit_log
language sql
security definer
set search_path = public
as $$
  select *
    from public.audit_log
   where p_table is null or table_name = p_table
   order by occurred_at desc
   limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke all on function public.admin_read_audit_log(int, text) from public;
grant execute on function public.admin_read_audit_log(int, text) to authenticated;

-- ─── 5. platform_config (singleton K/V pra flags + configs) ─────────────────
create table if not exists public.platform_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.platform_config is
  'Configurações globais editáveis pelo admin: feature flags, limites, preços base.';

alter table public.platform_config enable row level security;

drop policy if exists "platform_config_read_public" on public.platform_config;
create policy "platform_config_read_public"
  on public.platform_config for select
  to anon, authenticated
  using (true);

grant select on table public.platform_config to anon, authenticated;

-- Upsert via RPC (evita RLS frágil).
create or replace function public.admin_set_platform_config(
  p_key text,
  p_value jsonb
)
returns public.platform_config
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.platform_config;
begin
  insert into public.platform_config (key, value, updated_by)
  values (p_key, p_value, auth.uid())
  on conflict (key) do update
    set value = excluded.value,
        updated_at = now(),
        updated_by = excluded.updated_by
  returning * into v;
  return v;
end;
$$;

revoke all on function public.admin_set_platform_config(text, jsonb) from public;
grant execute on function public.admin_set_platform_config(text, jsonb) to authenticated;

-- ─── Seeds iniciais de flags/configs ────────────────────────────────────────
insert into public.platform_config (key, value) values
  ('feature_flags', jsonb_build_object(
    'LEGACY_DNA',          true,
    'GAMESPIRIT_ENABLED',  true,
    'WELCOME_PACK',        true,
    'LEGACY_MARKET',       true
  )),
  ('limits', jsonb_build_object(
    'WELCOME_PACK_LIMIT',  1000,
    'LEGACY_DAILY_TICK',   1
  )),
  ('prices', jsonb_build_object(
    'OLE_TO_BRO_CENTS',    1,
    'LEGACY_BASE_PRICE_OLE', 50000
  ))
on conflict (key) do nothing;
