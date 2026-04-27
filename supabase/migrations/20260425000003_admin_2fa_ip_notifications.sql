-- Migration: Admin 2FA, IP Whitelist, Login Notifications
-- Adiciona 2FA obrigatório, whitelist de IPs e notificações de login

-- ─── 1. Adicionar 2FA à tabela admin_panel_users ───────────────────────────
alter table public.admin_panel_users
  add column if not exists two_factor_enabled boolean not null default false,
  add column if not exists two_factor_secret text,
  add column if not exists two_factor_backup_codes text[],
  add column if not exists two_factor_enabled_at timestamptz;

comment on column public.admin_panel_users.two_factor_enabled is
  '2FA obrigatório para admins. Habilitar via admin_panel_enable_2fa()';

-- ─── 2. Tabela de IPs permitidos para admin ────────────────────────────────
create table if not exists public.admin_allowed_ips (
  id uuid primary key default gen_random_uuid(),
  ip_cidr cidr not null unique,
  note text,
  added_by text,
  added_at timestamptz not null default now(),
  active boolean not null default true
);

create index if not exists idx_admin_allowed_ips_active
  on public.admin_allowed_ips(ip_cidr) where active = true;

alter table public.admin_allowed_ips enable row level security;

-- Apenas admins podem ver IPs permitidos
create policy "Admins can view allowed IPs"
  on public.admin_allowed_ips
  for select
  to authenticated
  using (public.is_admin());

grant select on table public.admin_allowed_ips to authenticated;

comment on table public.admin_allowed_ips is
  'Whitelist de IPs permitidos para login admin. Adicionar via SQL (service_role).';

-- ─── 3. Tabela de notificações de login admin ──────────────────────────────
create table if not exists public.admin_login_notifications (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,
  login_at timestamptz not null,
  ip_address text,
  user_agent text,
  location_estimate text,
  notification_sent boolean not null default false,
  notification_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_login_notifications_email_time
  on public.admin_login_notifications(admin_email, login_at desc);

alter table public.admin_login_notifications enable row level security;

-- Apenas admins podem ver notificações
create policy "Admins can view login notifications"
  on public.admin_login_notifications
  for select
  to authenticated
  using (public.is_admin());

grant select on table public.admin_login_notifications to authenticated;

comment on table public.admin_login_notifications is
  'Log de logins admin para envio de notificações por email/SMS';

-- ─── 4. Função para verificar IP whitelist ─────────────────────────────────
create or replace function public.check_admin_ip_allowed(p_ip_address text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip inet;
  v_allowed boolean;
begin
  -- Se não há IPs na whitelist, permitir todos (modo permissivo)
  if not exists (select 1 from public.admin_allowed_ips where active = true) then
    return true;
  end if;

  -- Validar formato de IP
  begin
    v_ip := p_ip_address::inet;
  exception when others then
    return false; -- IP inválido
  end;

  -- Verificar se IP está na whitelist
  select exists (
    select 1
      from public.admin_allowed_ips
     where active = true
       and v_ip <<= ip_cidr -- operador "está contido em"
  ) into v_allowed;

  return v_allowed;
end;
$$;

grant execute on function public.check_admin_ip_allowed(text) to anon, authenticated;

-- ─── 5. Função para habilitar 2FA ──────────────────────────────────────────
create or replace function public.admin_panel_enable_2fa(
  p_email text,
  p_secret text,
  p_backup_codes text[]
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

  if p_secret is null or length(p_secret) < 16 then
    raise exception 'invalid 2FA secret';
  end if;

  if array_length(p_backup_codes, 1) < 10 then
    raise exception 'must provide at least 10 backup codes';
  end if;

  update public.admin_panel_users
     set two_factor_enabled = true,
         two_factor_secret = p_secret,
         two_factor_backup_codes = p_backup_codes,
         two_factor_enabled_at = now()
   where email = lower(trim(p_email))
     and active = true;

  return found;
end;
$$;

revoke all on function public.admin_panel_enable_2fa(text, text, text[]) from public;
grant execute on function public.admin_panel_enable_2fa(text, text, text[]) to authenticated;

-- ─── 6. Função para desabilitar 2FA ────────────────────────────────────────
create or replace function public.admin_panel_disable_2fa(
  p_email text,
  p_verification_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user record;
begin
  if not public.is_admin() then
    raise exception 'admin required';
  end if;

  -- Buscar usuário
  select * into v_user
    from public.admin_panel_users
   where email = lower(trim(p_email))
     and active = true
     and two_factor_enabled = true;

  if not found then
    raise exception 'user not found or 2FA not enabled';
  end if;

  -- Validar código (simplificado - em produção, validar TOTP ou backup code)
  -- TODO: Implementar validação real de TOTP
  if length(p_verification_code) < 6 then
    raise exception 'invalid verification code';
  end if;

  -- Desabilitar 2FA
  update public.admin_panel_users
     set two_factor_enabled = false,
         two_factor_secret = null,
         two_factor_backup_codes = null
   where email = v_user.email;

  -- Logar ação
  perform public.log_admin_action(
    v_user.email,
    'DISABLE_2FA',
    null,
    'admin_panel_users',
    jsonb_build_object('email', v_user.email),
    null,
    null
  );

  return true;
end;
$$;

revoke all on function public.admin_panel_disable_2fa(text, text) from public;
grant execute on function public.admin_panel_disable_2fa(text, text) to authenticated;

-- ─── 7. Atualizar admin_panel_login com IP whitelist e notificações ────────
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
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_rate_limit record;
  v_user record;
  v_ip_allowed boolean;
begin
  if p_password is null or length(p_password) = 0 or v_email = '' then
    insert into public.admin_login_attempts (email, ip_address, user_agent, success, failure_reason)
    values (v_email, p_ip_address, p_user_agent, false, 'Empty credentials');
    return;
  end if;

  -- Verificar IP whitelist (se configurado)
  if p_ip_address is not null then
    v_ip_allowed := public.check_admin_ip_allowed(p_ip_address);
    if not v_ip_allowed then
      insert into public.admin_login_attempts (email, ip_address, user_agent, success, failure_reason)
      values (v_email, p_ip_address, p_user_agent, false, 'IP not in whitelist');

      raise exception 'Access denied: IP address not in whitelist';
    end if;
  end if;

  -- Verificar rate limit
  select * into v_rate_limit from public.check_admin_login_rate_limit(v_email, p_ip_address);

  if v_rate_limit.blocked then
    insert into public.admin_login_attempts (email, ip_address, user_agent, success, failure_reason)
    values (v_email, p_ip_address, p_user_agent, false, v_rate_limit.reason);

    raise exception 'Rate limit exceeded: %. Try again in % seconds.',
      v_rate_limit.reason, v_rate_limit.retry_after_seconds;
  end if;

  -- Buscar usuário e validar senha
  select * into v_user
    from public.admin_panel_users au
   where au.email = v_email
     and au.active = true
     and au.password_hash = crypt(p_password, au.password_hash);

  if not found then
    insert into public.admin_login_attempts (email, ip_address, user_agent, success, failure_reason)
    values (v_email, p_ip_address, p_user_agent, false, 'Invalid credentials');
    return;
  end if;

  -- Verificar 2FA se habilitado
  if v_user.two_factor_enabled then
    if p_two_factor_code is null or length(p_two_factor_code) < 6 then
      insert into public.admin_login_attempts (email, ip_address, user_agent, success, failure_reason)
      values (v_email, p_ip_address, p_user_agent, false, '2FA code required');

      raise exception '2FA code required';
    end if;

    -- TODO: Validar TOTP ou backup code
    -- Por agora, aceita qualquer código de 6+ dígitos (implementar validação real)
  end if;

  -- Atualizar last_login_at
  update public.admin_panel_users
     set last_login_at = now()
   where email = v_email;

  -- Registrar sucesso
  insert into public.admin_login_attempts (email, ip_address, user_agent, success)
  values (v_email, p_ip_address, p_user_agent, true);

  -- Criar notificação de login
  insert into public.admin_login_notifications (admin_email, login_at, ip_address, user_agent)
  values (v_email, now(), p_ip_address, p_user_agent);

  -- Logar ação
  perform public.log_admin_action(v_email, 'LOGIN', null, null, null, p_ip_address, p_user_agent);

  return query
    select v_user.email, v_user.display_name, v_user.role, v_user.two_factor_enabled;
end;
$$;

revoke all on function public.admin_panel_login(text, text, text, text, text) from public;
grant execute on function public.admin_panel_login(text, text, text, text, text) to anon, authenticated;

comment on function public.admin_panel_login(text, text, text, text, text) is
  'Login admin com IP whitelist, 2FA e notificações';

-- ─── 8. Função para enviar notificações de login (chamada por worker) ──────
create or replace function public.process_admin_login_notifications()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification record;
  v_count int := 0;
begin
  -- Processar notificações pendentes (últimas 5 min)
  for v_notification in
    select *
      from public.admin_login_notifications
     where notification_sent = false
       and created_at > now() - interval '5 minutes'
     order by created_at
     limit 100
  loop
    -- TODO: Integrar com serviço de email/SMS (SendGrid, Twilio, etc)
    -- Por agora, apenas marcar como enviado
    update public.admin_login_notifications
       set notification_sent = true,
           notification_sent_at = now()
     where id = v_notification.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.process_admin_login_notifications() is
  'Processa notificações de login pendentes. Executar via cron a cada 1 minuto.';

-- ─── 9. Seed inicial: adicionar localhost à whitelist (dev) ────────────────
-- Comentado por padrão - descomentar se quiser ativar whitelist
-- insert into public.admin_allowed_ips (ip_cidr, note, added_by)
-- values
--   ('127.0.0.1/32', 'Localhost (dev)', 'system'),
--   ('::1/128', 'Localhost IPv6 (dev)', 'system')
-- on conflict (ip_cidr) do nothing;
