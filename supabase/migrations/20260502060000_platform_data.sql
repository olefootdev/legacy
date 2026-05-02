-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — platform_data
--
-- Dados globais de plataforma que o admin configura e todos os managers recebem:
-- shop_catalog, admin_leagues, gamespirit_knowledge, coach_templates.
-- Usa platform_config (já existente) para shop_catalog e gamespirit_knowledge.
-- Nova tabela admin_leagues para ligas (queryável individualmente).
-- ═══════════════════════════════════════════════════════════════════════════

-- Ligas admin (tabela própria para ser queryável)
create table if not exists public.admin_leagues (
  id          text primary key,
  config      jsonb not null,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.admin_leagues enable row level security;

-- Todos os managers autenticados podem ler as ligas
create policy "admin_leagues_select_authenticated"
  on public.admin_leagues for select
  to authenticated using (true);

-- Só service_role escreve (admin usa RPC)
grant select on table public.admin_leagues to authenticated;

comment on table public.admin_leagues is
  'Competições criadas pelo admin. Lidas por todos os managers no boot.';

-- Trigger updated_at
create or replace function public.touch_admin_leagues_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_touch_admin_leagues on public.admin_leagues;
create trigger trg_touch_admin_leagues
  before update on public.admin_leagues
  for each row execute function public.touch_admin_leagues_updated_at();

-- RPC para upsert de liga (requer is_admin)
create or replace function public.admin_upsert_league(
  p_id      text,
  p_config  jsonb,
  p_primary boolean default false
)
returns public.admin_leagues
language plpgsql security definer set search_path = public
as $$
declare v public.admin_leagues;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  -- Se marcando como primary, desmarcar as outras
  if p_primary then
    update public.admin_leagues set is_primary = false where is_primary = true;
  end if;
  insert into public.admin_leagues (id, config, is_primary)
  values (p_id, p_config, p_primary)
  on conflict (id) do update
    set config = excluded.config,
        is_primary = excluded.is_primary,
        updated_at = now()
  returning * into v;
  return v;
end;
$$;
revoke all on function public.admin_upsert_league(text, jsonb, boolean) from public;
grant execute on function public.admin_upsert_league(text, jsonb, boolean) to authenticated;

-- RPC para remover liga
create or replace function public.admin_remove_league(p_id text)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  delete from public.admin_leagues where id = p_id;
  return found;
end;
$$;
revoke all on function public.admin_remove_league(text) from public;
grant execute on function public.admin_remove_league(text) to authenticated;

-- RPC para set primary league
create or replace function public.admin_set_primary_league(p_id text)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  update public.admin_leagues set is_primary = false where is_primary = true;
  update public.admin_leagues set is_primary = true where id = p_id;
  return found;
end;
$$;
revoke all on function public.admin_set_primary_league(text) from public;
grant execute on function public.admin_set_primary_league(text) to authenticated;

-- Tabela para coach templates globais (coaches que o admin cria como templates)
create table if not exists public.coach_templates (
  id          text primary key,
  coach       jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.coach_templates enable row level security;

create policy "coach_templates_select_authenticated"
  on public.coach_templates for select
  to authenticated using (true);

grant select on table public.coach_templates to authenticated;

comment on table public.coach_templates is
  'Templates de Coach Agent criados pelo admin. Managers podem escolher um no onboarding.';

-- Coluna evolution_rate em legacy_players
alter table public.legacy_players
  add column if not exists evolution_rate float not null default 1.0;

comment on column public.legacy_players.evolution_rate is
  'Multiplicador de evolução por partida (0.25–3.0). Configurado pelo admin.';

-- Coluna skills em genesis_market_players
alter table public.genesis_market_players
  add column if not exists skills jsonb;

comment on column public.genesis_market_players.skills is
  'Skills equipadas pelo admin antes da venda. Array de skill IDs.';
