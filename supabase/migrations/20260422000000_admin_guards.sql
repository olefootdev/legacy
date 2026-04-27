-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — admin_guards
--
-- Fecha o gap crítico pré-deploy: qualquer usuário autenticado conseguia chamar
-- RPCs `admin_*` porque estavam com `grant execute ... to authenticated` e
-- sem verificação de permissão. Agora:
--
--   1. Tabela `admin_users` (lista de UUIDs aprovados)
--   2. Função `is_admin()` (retorna bool pra auth.uid() atual)
--   3. Recria RPCs admin_* com guard `if not is_admin() then raise exception`
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. admin_users ─────────────────────────────────────────────────────────
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  note text
);

alter table public.admin_users enable row level security;

-- Só admins enxergam a tabela (read); escrita só via service_role.
drop policy if exists "admin_users_admin_read" on public.admin_users;
create policy "admin_users_admin_read"
  on public.admin_users for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_users au where au.user_id = auth.uid()
    )
  );

grant select on table public.admin_users to authenticated;

comment on table public.admin_users is
  'Managers com privilégio de admin. Escrita manual via SQL (service_role) — não expor RPC.';

-- ─── 2. is_admin() ──────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to authenticated;

comment on function public.is_admin() is
  'Verifica se o auth.uid() atual pertence a admin_users. Retorna false se não autenticado.';

-- ─── 3. Guardar RPCs existentes ─────────────────────────────────────────────
-- Estratégia: recriar cada RPC admin_* injetando check `if not is_admin()`.

-- admin_set_user_status
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
  if not public.is_admin() then
    raise exception 'admin required';
  end if;
  if p_status not in ('active', 'suspended', 'banned') then
    raise exception 'invalid status';
  end if;
  update public.profiles set status = p_status, updated_at = now() where id = p_user_id;
  return found;
end;
$$;

revoke all on function public.admin_set_user_status(uuid, text) from public;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;

-- admin_read_audit_log
create or replace function public.admin_read_audit_log(
  p_limit int default 100,
  p_table text default null
)
returns setof public.audit_log
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin required';
  end if;
  return query
    select *
      from public.audit_log
     where p_table is null or table_name = p_table
     order by occurred_at desc
     limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function public.admin_read_audit_log(int, text) from public;
grant execute on function public.admin_read_audit_log(int, text) to authenticated;

-- admin_set_platform_config
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
  if not public.is_admin() then
    raise exception 'admin required';
  end if;
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

-- admin_send_broadcast
create or replace function public.admin_send_broadcast(
  p_title text,
  p_body text,
  p_category text default 'CONTA',
  p_deep_link text default null,
  p_expires_at timestamptz default null
)
returns public.admin_broadcasts
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.admin_broadcasts;
begin
  if not public.is_admin() then
    raise exception 'admin required';
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
    raise exception 'title and body required';
  end if;
  insert into public.admin_broadcasts (title, body, category, deep_link, created_by, expires_at)
  values (p_title, p_body, p_category, p_deep_link, auth.uid(), p_expires_at)
  returning * into v;
  return v;
end;
$$;

revoke all on function public.admin_send_broadcast(text, text, text, text, timestamptz) from public;
grant execute on function public.admin_send_broadcast(text, text, text, text, timestamptz) to authenticated;

-- admin_broadcast_stats
create or replace function public.admin_broadcast_stats(p_limit int default 50)
returns table (
  id uuid,
  title text,
  category text,
  created_at timestamptz,
  active boolean,
  deliveries bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin required';
  end if;
  return query
    select b.id, b.title, b.category, b.created_at, b.active,
           (select count(*) from public.broadcast_deliveries d where d.broadcast_id = b.id) as deliveries
      from public.admin_broadcasts b
     order by b.created_at desc
     limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

revoke all on function public.admin_broadcast_stats(int) from public;
grant execute on function public.admin_broadcast_stats(int) to authenticated;

-- ─── 4. Update seed de feature flags ────────────────────────────────────────
-- Adiciona TUTORIAL_ENABLED e ASSISTANT_ENABLED ao seed global.
update public.platform_config
   set value = value
     || jsonb_build_object('TUTORIAL_ENABLED', true)
     || jsonb_build_object('ASSISTANT_ENABLED', true)
 where key = 'feature_flags';
