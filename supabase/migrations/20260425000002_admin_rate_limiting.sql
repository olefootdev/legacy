-- Migration: Admin Rate Limiting & Security Enhancements
-- Adiciona proteção contra brute force e auditoria de ações admin

-- ─── 1. Tabela de tentativas de login ──────────────────────────────────────
create table if not exists public.admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  attempted_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  success boolean not null default false,
  failure_reason text
);

create index if not exists idx_admin_login_attempts_email_time
  on public.admin_login_attempts(email, attempted_at desc);

create index if not exists idx_admin_login_attempts_ip_time
  on public.admin_login_attempts(ip_address, attempted_at desc)
  where ip_address is not null;

comment on table public.admin_login_attempts is
  'Log de tentativas de login no painel admin para detecção de brute force';

-- ─── 2. Tabela de auditoria de ações admin ─────────────────────────────────
create table if not exists public.admin_action_log (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,
  action text not null,
  target_user_id uuid,
  target_resource text,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_action_log_admin_time
  on public.admin_action_log(admin_email, created_at desc);

create index if not exists idx_admin_action_log_target
  on public.admin_action_log(target_user_id, created_at desc)
  where target_user_id is not null;

comment on table public.admin_action_log is
  'Auditoria de todas as ações executadas por admins no painel';

-- ─── 3. Função auxiliar para verificar rate limit ──────────────────────────
create or replace function public.check_admin_login_rate_limit(
  p_email text,
  p_ip_address text default null
)
returns table (
  blocked boolean,
  reason text,
  retry_after_seconds int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_failed_attempts_email int;
  v_failed_attempts_ip int;
  v_last_attempt timestamptz;
begin
  -- Verificar tentativas falhas por email nas últimas 15 min
  select count(*), max(attempted_at) into v_failed_attempts_email, v_last_attempt
    from public.admin_login_attempts
   where email = v_email
     and attempted_at > now() - interval '15 minutes'
     and success = false;

  -- Bloquear após 5 tentativas falhas por email
  if v_failed_attempts_email >= 5 then
    return query select
      true as blocked,
      'Too many failed login attempts for this email' as reason,
      extract(epoch from (v_last_attempt + interval '15 minutes' - now()))::int as retry_after_seconds;
    return;
  end if;

  -- Verificar tentativas falhas por IP nas últimas 15 min (se fornecido)
  if p_ip_address is not null then
    select count(*) into v_failed_attempts_ip
      from public.admin_login_attempts
     where ip_address = p_ip_address
       and attempted_at > now() - interval '15 minutes'
       and success = false;

    -- Bloquear após 10 tentativas falhas por IP
    if v_failed_attempts_ip >= 10 then
      return query select
        true as blocked,
        'Too many failed login attempts from this IP' as reason,
        extract(epoch from (v_last_attempt + interval '15 minutes' - now()))::int as retry_after_seconds;
      return;
    end if;
  end if;

  -- Não bloqueado
  return query select false as blocked, null::text as reason, 0 as retry_after_seconds;
end;
$$;

grant execute on function public.check_admin_login_rate_limit(text, text) to anon, authenticated;

-- ─── 4. Atualizar admin_panel_login com rate limiting ──────────────────────
create or replace function public.admin_panel_login(
  p_email text,
  p_password text,
  p_ip_address text default null,
  p_user_agent text default null
)
returns table (email text, display_name text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_rate_limit record;
begin
  if p_password is null or length(p_password) = 0 or v_email = '' then
    -- Registrar tentativa inválida
    insert into public.admin_login_attempts (email, ip_address, user_agent, success, failure_reason)
    values (v_email, p_ip_address, p_user_agent, false, 'Empty credentials');
    return;
  end if;

  -- Verificar rate limit
  select * into v_rate_limit from public.check_admin_login_rate_limit(v_email, p_ip_address);

  if v_rate_limit.blocked then
    -- Registrar tentativa bloqueada
    insert into public.admin_login_attempts (email, ip_address, user_agent, success, failure_reason)
    values (v_email, p_ip_address, p_user_agent, false, v_rate_limit.reason);

    raise exception 'Rate limit exceeded: %. Try again in % seconds.',
      v_rate_limit.reason, v_rate_limit.retry_after_seconds;
  end if;

  -- Tentar autenticar
  update public.admin_panel_users au
     set last_login_at = now()
   where au.email = v_email
     and au.active = true
     and au.password_hash = crypt(p_password, au.password_hash);

  if not found then
    -- Registrar falha
    insert into public.admin_login_attempts (email, ip_address, user_agent, success, failure_reason)
    values (v_email, p_ip_address, p_user_agent, false, 'Invalid credentials');
    return;
  end if;

  -- Registrar sucesso
  insert into public.admin_login_attempts (email, ip_address, user_agent, success)
  values (v_email, p_ip_address, p_user_agent, true);

  -- Logar ação de login
  insert into public.admin_action_log (admin_email, action, ip_address, user_agent)
  values (v_email, 'LOGIN', p_ip_address, p_user_agent);

  return query
    select au.email, au.display_name, au.role
      from public.admin_panel_users au
     where au.email = v_email
       and au.active = true
     limit 1;
end;
$$;

revoke all on function public.admin_panel_login(text, text, text, text) from public;
grant execute on function public.admin_panel_login(text, text, text, text) to anon, authenticated;

comment on function public.admin_panel_login(text, text, text, text) is
  'Login admin com rate limiting (5 tentativas/15min por email, 10/15min por IP)';

-- ─── 5. Função para logar ações admin ──────────────────────────────────────
create or replace function public.log_admin_action(
  p_admin_email text,
  p_action text,
  p_target_user_id uuid default null,
  p_target_resource text default null,
  p_details jsonb default null,
  p_ip_address text default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
begin
  insert into public.admin_action_log (
    admin_email, action, target_user_id, target_resource,
    details, ip_address, user_agent
  )
  values (
    p_admin_email, p_action, p_target_user_id, p_target_resource,
    p_details, p_ip_address, p_user_agent
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

grant execute on function public.log_admin_action(text, text, uuid, text, jsonb, text, text) to authenticated;

-- ─── 6. Atualizar admin_set_user_status com auditoria ──────────────────────
create or replace function public.admin_set_user_status(
  p_user_id uuid,
  p_status text,
  p_admin_email text default null,
  p_ip_address text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_email text;
begin
  if not public.is_admin() then
    raise exception 'admin required';
  end if;

  if p_status not in ('active', 'suspended', 'banned') then
    raise exception 'invalid status';
  end if;

  -- Obter email do admin atual
  v_admin_email := coalesce(
    p_admin_email,
    (select email from auth.users where id = auth.uid())
  );

  -- Logar ação
  perform public.log_admin_action(
    v_admin_email,
    'SET_USER_STATUS',
    p_user_id,
    'profiles',
    jsonb_build_object('status', p_status),
    p_ip_address,
    null
  );

  -- Executar ação
  update public.profiles
     set status = p_status, updated_at = now()
   where id = p_user_id;

  return found;
end;
$$;

revoke all on function public.admin_set_user_status(uuid, text, text, text) from public;
grant execute on function public.admin_set_user_status(uuid, text, text, text) to authenticated;

-- ─── 7. Função para limpar logs antigos (manutenção) ───────────────────────
create or replace function public.cleanup_old_admin_logs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Manter últimos 90 dias de tentativas de login
  delete from public.admin_login_attempts
   where attempted_at < now() - interval '90 days';

  -- Manter últimos 365 dias de ações admin
  delete from public.admin_action_log
   where created_at < now() - interval '365 days';
end;
$$;

comment on function public.cleanup_old_admin_logs() is
  'Limpa logs antigos (90d login attempts, 365d action log). Executar via cron.';

-- ─── 8. RLS para novas tabelas ─────────────────────────────────────────────
alter table public.admin_login_attempts enable row level security;
alter table public.admin_action_log enable row level security;

-- Apenas admins podem ver logs
create policy "Admins can view login attempts"
  on public.admin_login_attempts
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can view action log"
  on public.admin_action_log
  for select
  to authenticated
  using (public.is_admin());

-- ─── 9. Grants ──────────────────────────────────────────────────────────────
grant select on table public.admin_login_attempts to authenticated;
grant select on table public.admin_action_log to authenticated;
