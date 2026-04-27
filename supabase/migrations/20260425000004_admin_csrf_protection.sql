-- Migration: CSRF Protection para Admin
-- Adiciona validação de tokens CSRF em operações admin

-- ─── 1. Tabela de tokens CSRF ──────────────────────────────────────────────
create table if not exists public.admin_csrf_tokens (
  token text primary key,
  admin_email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  used boolean not null default false,
  used_at timestamptz
);

create index if not exists idx_admin_csrf_tokens_email
  on public.admin_csrf_tokens(admin_email, created_at desc);

create index if not exists idx_admin_csrf_tokens_expires
  on public.admin_csrf_tokens(expires_at) where not used;

alter table public.admin_csrf_tokens enable row level security;

-- Apenas admins podem ver tokens
create policy "Admins can view CSRF tokens"
  on public.admin_csrf_tokens
  for select
  to authenticated
  using (public.is_admin());

grant select on table public.admin_csrf_tokens to authenticated;

comment on table public.admin_csrf_tokens is
  'Tokens CSRF para proteger operações admin contra ataques cross-site';

-- ─── 2. Função para validar token CSRF ─────────────────────────────────────
create or replace function public.validate_admin_csrf_token(
  p_token text,
  p_admin_email text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token record;
begin
  if p_token is null or length(p_token) < 32 then
    return false;
  end if;

  -- Buscar token
  select * into v_token
    from public.admin_csrf_tokens
   where token = p_token
     and admin_email = lower(trim(p_admin_email))
     and not used
     and expires_at > now();

  if not found then
    return false;
  end if;

  -- Marcar token como usado (one-time use)
  update public.admin_csrf_tokens
     set used = true,
         used_at = now()
   where token = p_token;

  return true;
end;
$$;

grant execute on function public.validate_admin_csrf_token(text, text) to authenticated;

-- ─── 3. Atualizar admin_set_user_status com validação CSRF ─────────────────
create or replace function public.admin_set_user_status(
  p_user_id uuid,
  p_status text,
  p_admin_email text default null,
  p_ip_address text default null,
  p_csrf_token text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_email text;
  v_csrf_valid boolean;
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

  -- Validar CSRF token (obrigatório)
  if p_csrf_token is null then
    raise exception 'CSRF token required';
  end if;

  v_csrf_valid := public.validate_admin_csrf_token(p_csrf_token, v_admin_email);
  if not v_csrf_valid then
    raise exception 'Invalid or expired CSRF token';
  end if;

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

revoke all on function public.admin_set_user_status(uuid, text, text, text, text) from public;
grant execute on function public.admin_set_user_status(uuid, text, text, text, text) to authenticated;

-- ─── 4. Função para limpar tokens CSRF expirados ───────────────────────────
create or replace function public.cleanup_expired_csrf_tokens()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  -- Deletar tokens expirados ou usados há mais de 24h
  delete from public.admin_csrf_tokens
   where expires_at < now()
      or (used and used_at < now() - interval '24 hours');

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.cleanup_expired_csrf_tokens() is
  'Limpa tokens CSRF expirados. Executar via cron a cada hora.';
