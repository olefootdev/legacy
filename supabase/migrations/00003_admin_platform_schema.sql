-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — Admin platform & onboarding catalog (00003)
--
-- Relação com o schema existente:
--   • public.clubs / public.profiles / public.players = clube DE JOGO e plantel
--     (motor, partidas). NÃO confundir com sports_* (catálogo real para onboarding).
--   • Competições época (00002) referenciam public.clubs (jogo).
--
-- Escrita ADMIN sensível: preferir service_role ou Edge Function; RLS abaixo
-- permite leitura de catálogo público e dados próprios do utilizador onde aplicável.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── updated_at helper ───────────────────────────────────────────────────
create or replace function public.olefoot_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- A) Catálogo Sports Data / onboarding (ligas + clubes reais)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.sports_leagues (
  id              uuid primary key default gen_random_uuid(),
  external_id     text not null unique,
  name            text not null,
  country         text not null default '',
  season_label    text not null default '',
  metadata        jsonb not null default '{}'::jsonb,
  is_active       boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.sports_leagues is
  'Catálogo curado (Admin / JSON). external_id = id estável do import (ex. seed). Distinto de competições de jogo (00002).';

create index if not exists idx_sports_leagues_active on public.sports_leagues (is_active, sort_order);
create index if not exists idx_sports_leagues_country on public.sports_leagues (country);

create trigger sports_leagues_set_updated_at
  before update on public.sports_leagues
  for each row execute function public.olefoot_set_updated_at();

create table if not exists public.sports_clubs (
  id              uuid primary key default gen_random_uuid(),
  league_id       uuid not null references public.sports_leagues (id) on delete cascade,
  external_id     text not null,
  name            text not null,
  short_name      text not null default '',
  city            text not null default '',
  country         text not null default '',
  logo_url        text,
  colors          jsonb not null default '{}'::jsonb,
  metadata        jsonb not null default '{}'::jsonb,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (league_id, external_id)
);

comment on table public.sports_clubs is
  'Clubes reais por liga; cores em JSONB {primary, secondary}. Liga com profiles.sports_club_id (onboarding).';

create index if not exists idx_sports_clubs_league on public.sports_clubs (league_id);
create index if not exists idx_sports_clubs_active on public.sports_clubs (league_id, is_active);
create index if not exists idx_sports_clubs_name on public.sports_clubs (name);

create trigger sports_clubs_set_updated_at
  before update on public.sports_clubs
  for each row execute function public.olefoot_set_updated_at();

create table if not exists public.sports_data_imports (
  id              uuid primary key default gen_random_uuid(),
  imported_by     uuid references auth.users (id) on delete set null,
  source          text not null default 'admin_json' check (source in ('admin_json', 'api', 'seed', 'manual')),
  leagues_touched int not null default 0 check (leagues_touched >= 0),
  clubs_touched   int not null default 0 check (clubs_touched >= 0),
  errors          jsonb not null default '[]'::jsonb,
  raw_checksum    text,
  created_at      timestamptz not null default now()
);

comment on table public.sports_data_imports is 'Histórico mínimo de imports no Admin (auditoria).';

create index if not exists sports_data_imports_created on public.sports_data_imports (created_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- A) Perfis — extensão de public.profiles (já existe 00001)
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists onboarding_status text not null default 'pending'
    constraint profiles_onboarding_status_check check (
      onboarding_status in ('pending', 'in_progress', 'completed', 'skipped')
    );

alter table public.profiles
  add column if not exists sports_club_id uuid references public.sports_clubs (id) on delete set null;

create index if not exists idx_profiles_sports_club on public.profiles (sports_club_id);
create index if not exists idx_profiles_onboarding on public.profiles (onboarding_status);

comment on column public.profiles.sports_club_id is 'Clube real escolhido no Cadastro; public.clubs é o clube de jogo.';

create table if not exists public.user_settings (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

comment on table public.user_settings is 'Preferências de UI/idioma/notificações; sem dados sensíveis.';

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.olefoot_set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- B) Contas plataforma (painel Admin Usuários — migração futura de localStorage)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.platform_accounts (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid unique references auth.users (id) on delete set null,
  email           text,
  display_name    text not null default '',
  status          text not null default 'active' check (status in ('active', 'suspended')),
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.platform_accounts is
  'Visão operacional Admin: saldos agregados e notas em payload até normalizar (broCents, ole, olexp, …).';

create index if not exists idx_platform_accounts_auth on public.platform_accounts (auth_user_id);
create index if not exists idx_platform_accounts_status on public.platform_accounts (status);

create trigger platform_accounts_set_updated_at
  before update on public.platform_accounts
  for each row execute function public.olefoot_set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- C) Create Player — blueprints (templates Admin; distinto de public.players plantel)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.player_blueprints (
  id               uuid primary key default gen_random_uuid(),
  created_by       uuid references auth.users (id) on delete set null,
  name             text not null,
  display_name     text,
  archetype        text,
  rarity           text,
  creator_type     text,
  attrs            jsonb not null default '{}'::jsonb,
  metadata         jsonb not null default '{}'::jsonb,
  portrait_url     text,
  schema_version   text not null default 'v1',
  status           text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.player_blueprints is
  'Rascunhos/publicações Create Player; attrs/metadata alinhados a PlayerEntity (entidades TS).';

create index if not exists idx_player_blueprints_status on public.player_blueprints (status, updated_at desc);
create index if not exists idx_player_blueprints_created_by on public.player_blueprints (created_by);

create trigger player_blueprints_set_updated_at
  before update on public.player_blueprints
  for each row execute function public.olefoot_set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- D) Game Spirit — perfil + regras + templates + conhecimento (granular + extensível)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.game_spirit_profiles (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  description  text,
  is_default   boolean not null default false,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- No máximo um perfil default (índice parcial único com expressão constante).
create unique index if not exists game_spirit_profiles_one_default
  on public.game_spirit_profiles ((1))
  where is_default = true;

comment on table public.game_spirit_profiles is 'Ambiente narrativo (ex. produção / staging). Apenas um is_default = true.';

create trigger game_spirit_profiles_set_updated_at
  before update on public.game_spirit_profiles
  for each row execute function public.olefoot_set_updated_at();

create table if not exists public.game_spirit_rules (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.game_spirit_profiles (id) on delete cascade,
  code        text not null,
  title       text,
  payload     jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (profile_id, code)
);

create index if not exists idx_game_spirit_rules_profile on public.game_spirit_rules (profile_id, is_active, sort_order);

create trigger game_spirit_rules_set_updated_at
  before update on public.game_spirit_rules
  for each row execute function public.olefoot_set_updated_at();

create table if not exists public.game_spirit_templates (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.game_spirit_profiles (id) on delete cascade,
  template_key text not null,
  locale      text not null default 'pt',
  body        text not null,
  variables   jsonb not null default '{}'::jsonb,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (profile_id, template_key, locale)
);

create index if not exists idx_game_spirit_templates_profile on public.game_spirit_templates (profile_id, locale);

create trigger game_spirit_templates_set_updated_at
  before update on public.game_spirit_templates
  for each row execute function public.olefoot_set_updated_at();

create table if not exists public.game_spirit_knowledge (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.game_spirit_profiles (id) on delete cascade,
  domain      text not null default 'default',
  key         text not null,
  content     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  unique (profile_id, domain, key)
);

create index if not exists idx_game_spirit_knowledge_profile on public.game_spirit_knowledge (profile_id, domain);

create trigger game_spirit_knowledge_set_updated_at
  before update on public.game_spirit_knowledge
  for each row execute function public.olefoot_set_updated_at();

-- Snapshots completos (export/import compatível com localStorage actual)
create table if not exists public.game_spirit_snapshots (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references public.game_spirit_profiles (id) on delete set null,
  label       text not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_game_spirit_snapshots_created on public.game_spirit_snapshots (created_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- E) Saves cloud (utilizador)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.game_saves (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  slot_index      smallint not null check (slot_index >= 0 and slot_index < 32),
  name            text not null default 'Save',
  state           jsonb not null,
  schema_version  text not null default '1',
  checksum        text,
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (user_id, slot_index)
);

comment on table public.game_saves is 'Blob OlefootGameState (ou subset); slot_index alinhado a slots de UI.';

create index if not exists idx_game_saves_user_updated on public.game_saves (user_id, updated_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- F) Banners
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.admin_banners (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  subtitle      text,
  image_url     text,
  link_url      text,
  position      text not null default 'home' check (position in ('home', 'wallet', 'matchday', 'global')),
  priority      int not null default 0,
  status        text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'archived')),
  audience      jsonb not null default '{}'::jsonb,
  starts_at     timestamptz,
  ends_at       timestamptz,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index if not exists idx_admin_banners_active on public.admin_banners (status, priority desc, starts_at, ends_at);

create trigger admin_banners_set_updated_at
  before update on public.admin_banners
  for each row execute function public.olefoot_set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- G) Financeiro (ledger operacional — espelha PlatformLedgerLine em evolução)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.finance_ledger_entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users (id) on delete set null,
  kind             text not null check (
    kind in (
      'fiat_deposit',
      'fiat_withdrawal',
      'treasury_adjust',
      'user_balance_adjust',
      'exp_grant',
      'exp_spend',
      'transfer_fee',
      'other'
    )
  ),
  bro_cents_delta  bigint not null default 0,
  exp_delta        bigint not null default 0,
  currency_note    text,
  target_ref       text,
  flow_status      text check (flow_status is null or flow_status in ('processing', 'completed', 'failed')),
  failure_reason   text,
  metadata         jsonb not null default '{}'::jsonb,
  posted_at        timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null
);

comment on table public.finance_ledger_entries is
  'Movimentos administrativos; bro_cents_delta / exp_delta conforme produto. user_id opcional (ajuste global).';

create index if not exists finance_ledger_user on public.finance_ledger_entries (user_id, posted_at desc);
create index if not exists finance_ledger_kind on public.finance_ledger_entries (kind, posted_at desc);
create index if not exists finance_ledger_flow on public.finance_ledger_entries (flow_status) where flow_status is not null;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — mínimo viável; service_role ignora RLS.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.sports_leagues enable row level security;
alter table public.sports_clubs enable row level security;
alter table public.sports_data_imports enable row level security;
alter table public.user_settings enable row level security;
alter table public.platform_accounts enable row level security;
alter table public.player_blueprints enable row level security;
alter table public.game_spirit_profiles enable row level security;
alter table public.game_spirit_rules enable row level security;
alter table public.game_spirit_templates enable row level security;
alter table public.game_spirit_knowledge enable row level security;
alter table public.game_spirit_snapshots enable row level security;
alter table public.game_saves enable row level security;
alter table public.admin_banners enable row level security;
alter table public.finance_ledger_entries enable row level security;

-- Catálogo desportivo: leitura pública (onboarding pode ser pré-login)
create policy sports_leagues_select_public on public.sports_leagues
  for select to anon, authenticated using (is_active = true);

create policy sports_clubs_select_public on public.sports_clubs
  for select to anon, authenticated using (is_active = true);

-- sports_data_imports: sem policies = sem acesso via anon key; service_role ignora RLS.

-- user_settings: dono
create policy user_settings_own on public.user_settings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- platform_accounts: dono quando ligado a auth; senão sem acesso cliente (admin API)
create policy platform_accounts_select_own on public.platform_accounts
  for select to authenticated using (auth_user_id = auth.uid());

-- player_blueprints: criador
create policy player_blueprints_select_own on public.player_blueprints
  for select to authenticated using (created_by = auth.uid());
create policy player_blueprints_insert_own on public.player_blueprints
  for insert to authenticated with check (created_by = auth.uid());
create policy player_blueprints_update_own on public.player_blueprints
  for update to authenticated using (created_by = auth.uid());
create policy player_blueprints_delete_own on public.player_blueprints
  for delete to authenticated using (created_by = auth.uid());

-- Game Spirit: leitura para clientes autenticados (conteúdo publicado); refinamento futuro por profile
create policy game_spirit_profiles_select_auth on public.game_spirit_profiles
  for select to authenticated using (true);
create policy game_spirit_rules_select_auth on public.game_spirit_rules
  for select to authenticated using (is_active = true);
create policy game_spirit_templates_select_auth on public.game_spirit_templates
  for select to authenticated using (true);
create policy game_spirit_knowledge_select_auth on public.game_spirit_knowledge
  for select to authenticated using (true);
create policy game_spirit_snapshots_select_auth on public.game_spirit_snapshots
  for select to authenticated using (true);

-- Saves: dono
create policy game_saves_own on public.game_saves
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Banners: activos no período
create policy admin_banners_select_active on public.admin_banners
  for select to anon, authenticated using (
    status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

-- Ledger: utilizador vê linhas onde é alvo; ajustes globais (user_id null) só backend
create policy finance_ledger_select_own on public.finance_ledger_entries
  for select to authenticated using (user_id = auth.uid());

-- Grants API
grant select on public.sports_leagues to anon, authenticated;
grant select on public.sports_clubs to anon, authenticated;
grant select on public.admin_banners to anon, authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;
grant select on public.platform_accounts to authenticated;
grant select, insert, update, delete on public.player_blueprints to authenticated;
grant select on public.game_spirit_profiles to authenticated;
grant select on public.game_spirit_rules to authenticated;
grant select on public.game_spirit_templates to authenticated;
grant select on public.game_spirit_knowledge to authenticated;
grant select on public.game_spirit_snapshots to authenticated;
grant select, insert, update, delete on public.game_saves to authenticated;
grant select on public.finance_ledger_entries to authenticated;
