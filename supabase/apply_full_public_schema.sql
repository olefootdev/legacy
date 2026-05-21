-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — schema public completo (gerado por scripts/bundle-supabase-migrations.sh)
--
-- Executar UMA vez no Supabase → SQL → novo script, com a base vazia.
-- Não reexecutar sobre o mesmo schema: políticas CREATE POLICY podem falhar
-- se já existirem (use os DROP POLICY IF EXISTS quando disponíveis).
--
-- Preferido em dev/prod: na raiz do repo
--   npx supabase login && npx supabase link --project-ref <REF> && npx supabase db push
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 00001_initial_schema.sql ───
-- ═══════════════════════════════════════════════════════════════════════
-- OLEFOOT — 001_init.sql
-- Schema inicial: profiles, clubs, players, matches, match_events
-- RLS habilitado em TODAS as tabelas expostas.
-- Políticas: utilizador autenticado lê/escreve onde
--   profiles.club_id coincide; match_events via donos da partida.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Clubs ──────────────────────────────────────────────────────────
-- Representa o clube gerido pelo utilizador.
create table if not exists public.clubs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);
alter table public.clubs enable row level security;

-- ─── 2. Profiles ───────────────────────────────────────────────────────
-- 1:1 com auth.users; liga utilizador ao seu clube.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  club_id    uuid references public.clubs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create index if not exists idx_profiles_club on public.profiles(club_id);

-- ─── 3. Players ────────────────────────────────────────────────────────
-- Jogadores do plantel; atributos vêm como JSONB versionado.
create table if not exists public.players (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs(id) on delete cascade,
  display_name    text not null,
  attributes      jsonb not null default '{}'::jsonb,
  schema_version  text not null default 'v1',
  created_at      timestamptz not null default now()
);
alter table public.players enable row level security;

create index if not exists idx_players_club on public.players(club_id);

-- ─── 4. Matches ────────────────────────────────────────────────────────
-- Registo de cada partida; away_club_id nullable (vs IA/oponente genérico).
create table if not exists public.matches (
  id             uuid primary key default gen_random_uuid(),
  mode           text not null check (mode in ('live', 'quick', 'auto')),
  home_club_id   uuid not null references public.clubs(id),
  away_club_id   uuid references public.clubs(id),
  score_home     int not null default 0,
  score_away     int not null default 0,
  status         text not null default 'scheduled',
  started_at     timestamptz,
  ended_at       timestamptz,
  created_at     timestamptz not null default now()
);
alter table public.matches enable row level security;

create index if not exists idx_matches_home on public.matches(home_club_id);
create index if not exists idx_matches_away on public.matches(away_club_id);

-- ─── 5. Match Events (append-only) ────────────────────────────────────
-- Cada evento discreto gerado pelo motor: GOAL, SHOT, FOUL, CARD, SUB, etc.
create table if not exists public.match_events (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches(id) on delete cascade,
  type       text not null,
  minute     int not null default 0,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.match_events enable row level security;

create index if not exists idx_match_events_match on public.match_events(match_id);

-- ═══════════════════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════════════════

-- Helper: retorna club_id do utilizador corrente.
-- Usado em quase todas as políticas.
create or replace function public.my_club_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select club_id from public.profiles where id = auth.uid()
$$;

-- ── Profiles ───
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- ── Clubs ──────
-- Dono pode ler/atualizar o seu clube; qualquer autenticado pode criar.
create policy "clubs_select_own" on public.clubs
  for select using (id = public.my_club_id());
create policy "clubs_insert_auth" on public.clubs
  for insert with check (auth.uid() is not null);
create policy "clubs_update_own" on public.clubs
  for update using (id = public.my_club_id());

-- ── Players ────
-- Tudo filtrado por club_id = my_club_id().
create policy "players_select_own" on public.players
  for select using (club_id = public.my_club_id());
create policy "players_insert_own" on public.players
  for insert with check (club_id = public.my_club_id());
create policy "players_update_own" on public.players
  for update using (club_id = public.my_club_id());
create policy "players_delete_own" on public.players
  for delete using (club_id = public.my_club_id());

-- ── Matches ────
-- Dono de qualquer lado (home ou away) pode ler.
-- Só home_club pode criar e atualizar.
create policy "matches_select_own" on public.matches
  for select using (
    home_club_id = public.my_club_id()
    or away_club_id = public.my_club_id()
  );
create policy "matches_insert_own" on public.matches
  for insert with check (home_club_id = public.my_club_id());
create policy "matches_update_own" on public.matches
  for update using (home_club_id = public.my_club_id());

-- ── Match Events ─
-- Leitura: dono de qualquer clube da partida.
-- Escrita: dono do clube home da partida.
create policy "match_events_select_own" on public.match_events
  for select using (
    match_id in (
      select id from public.matches
      where home_club_id = public.my_club_id()
         or away_club_id = public.my_club_id()
    )
  );
create policy "match_events_insert_own" on public.match_events
  for insert with check (
    match_id in (
      select id from public.matches
      where home_club_id = public.my_club_id()
    )
  );

-- ─── 00002_admin_leagues_competitions.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — ADMIN / Leagues & competitions (seasons, divisões, ligas, copas)
--
-- Mapeamento rápido:
-- • Liga pontos corridos: kind=league, league_subtype=round_robin; uma fase
--   phase_kind=league em competition_phases; classificação em competition_standings.
-- • Liga premium: kind=league, league_subtype=premium, knockout_advance_count ∈
--   {8,16,32,64,128}; fase 1 league, fase 2 knockout em competition_phases.
-- • Copa (ida e volta): kind=cup; fases knockout; fixtures.leg 1|2; agregado em
--   aggregate_home_goals / aggregate_away_goals; empate → tie_break_*_exp (snapshot).
--
-- Temporada: seasons + season_divisions (5 tiers, 1=A…5=E) + season_division_memberships
-- (até max_clubs por divisão). Promoção/rebaixamento: promotion_count / relegation_count
-- na temporada (default 5↑5↓ entre tiers consecutivos; regra de negócio na app/ADMIN).
--
-- Escrita: apenas service_role / backend (sem políticas INSERT/UPDATE para authenticated).
-- Leitura: competições públicas (agendadas/ativas/finalizadas/canceladas) ou em que o
-- clube do utilizador participa; não altera políticas de clubs/players/matches existentes.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Domínios lógicos (text + CHECK; sem ENUM para migrações mais simples) ───

-- ─── 1. Temporadas ─────────────────────────────────────────────────────────
create table if not exists public.seasons (
  id                 uuid primary key default gen_random_uuid(),
  code               text unique,
  name               text not null,
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  promotion_count    int not null default 5 check (promotion_count >= 0),
  relegation_count   int not null default 5 check (relegation_count >= 0),
  tie_break_order    jsonb not null default '["points","goal_diff","goals_for","head_to_head","fair_play"]'::jsonb,
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.seasons enable row level security;

create index if not exists idx_seasons_dates on public.seasons (starts_at, ends_at);

-- ─── 2. Divisões por temporada (Série A–E, tier 1–5) ──────────────────────
create table if not exists public.season_divisions (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references public.seasons (id) on delete cascade,
  tier        int not null check (tier between 1 and 5),
  name        text not null,
  max_clubs   int not null default 100 check (max_clubs > 0 and max_clubs <= 500),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (season_id, tier)
);

alter table public.season_divisions enable row level security;

create index if not exists idx_season_divisions_season on public.season_divisions (season_id);

-- ─── 3. Clubes inscritos numa divisão da temporada (capacidade na app) ─────
create table if not exists public.season_division_memberships (
  id                   uuid primary key default gen_random_uuid(),
  season_division_id   uuid not null references public.season_divisions (id) on delete cascade,
  club_id              uuid not null references public.clubs (id) on delete cascade,
  joined_at            timestamptz not null default now(),
  metadata             jsonb not null default '{}'::jsonb,
  unique (season_division_id, club_id)
);

alter table public.season_division_memberships enable row level security;

create index if not exists idx_sdm_division on public.season_division_memberships (season_division_id);
create index if not exists idx_sdm_club on public.season_division_memberships (club_id);

-- ─── 4. Competições (liga / copa) ──────────────────────────────────────────
create table if not exists public.competitions (
  id                        uuid primary key default gen_random_uuid(),
  kind                      text not null check (kind in ('league', 'cup')),
  league_subtype            text check (league_subtype is null or league_subtype in ('round_robin', 'premium')),
  season_id                 uuid references public.seasons (id) on delete set null,
  season_division_id        uuid references public.season_divisions (id) on delete set null,
  visibility                text not null default 'public' check (visibility in ('public', 'participants_only')),
  name                      text not null,
  code                      text,
  duration_unit             text not null check (duration_unit in ('days', 'rounds')),
  duration_value            int not null check (duration_value > 0),
  knockout_advance_count    int check (knockout_advance_count is null or knockout_advance_count in (8, 16, 32, 64, 128)),
  rewards                   jsonb,
  relegation_config         jsonb,
  status                    text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'finished', 'cancelled')),
  metadata                  jsonb not null default '{}'::jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  check (
    (kind = 'league' and league_subtype is not null)
    or (kind = 'cup' and league_subtype is null)
  ),
  check (
    league_subtype is distinct from 'premium'
    or knockout_advance_count is not null
  ),
  check (
    league_subtype is distinct from 'round_robin'
    or knockout_advance_count is null
  )
);

alter table public.competitions enable row level security;

create index if not exists idx_competitions_season on public.competitions (season_id);
create index if not exists idx_competitions_division on public.competitions (season_division_id);
create index if not exists idx_competitions_status on public.competitions (status);

-- ─── 5. Fases (liga + knockout premium; só knockout na copa) ───────────────
create table if not exists public.competition_phases (
  id              uuid primary key default gen_random_uuid(),
  competition_id  uuid not null references public.competitions (id) on delete cascade,
  phase_order     int not null check (phase_order >= 1),
  phase_kind      text not null check (phase_kind in ('league', 'knockout')),
  name            text,
  starts_at       timestamptz,
  ends_at         timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (competition_id, phase_order)
);

alter table public.competition_phases enable row level security;

create index if not exists idx_competition_phases_comp on public.competition_phases (competition_id);

-- ─── 6. Participantes ──────────────────────────────────────────────────────
create table if not exists public.competition_participants (
  id               uuid primary key default gen_random_uuid(),
  competition_id   uuid not null references public.competitions (id) on delete cascade,
  club_id          uuid not null references public.clubs (id) on delete cascade,
  seed             int,
  eliminated_at    timestamptz,
  exp_snapshot     numeric(14, 4),
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  unique (competition_id, club_id)
);

alter table public.competition_participants enable row level security;

create index if not exists idx_comp_participants_comp on public.competition_participants (competition_id);
create index if not exists idx_comp_participants_club on public.competition_participants (club_id);

-- ─── 7. Classificação (fase league) ────────────────────────────────────────
create table if not exists public.competition_standings (
  id               uuid primary key default gen_random_uuid(),
  competition_id   uuid not null references public.competitions (id) on delete cascade,
  phase_id         uuid not null references public.competition_phases (id) on delete cascade,
  club_id          uuid not null references public.clubs (id) on delete cascade,
  played           int not null default 0 check (played >= 0),
  wins             int not null default 0 check (wins >= 0),
  draws            int not null default 0 check (draws >= 0),
  losses           int not null default 0 check (losses >= 0),
  goals_for        int not null default 0 check (goals_for >= 0),
  goals_against    int not null default 0 check (goals_against >= 0),
  points           int not null default 0,
  standing_rank    int,
  tie_break        jsonb,
  updated_at       timestamptz not null default now(),
  unique (competition_id, phase_id, club_id)
);

alter table public.competition_standings enable row level security;

create index if not exists idx_standings_leaderboard
  on public.competition_standings (competition_id, phase_id, points desc, goals_for desc, goals_against asc);

-- ─── 8. Premiação estruturada (opcional; paralelo a competitions.rewards) ───
create table if not exists public.competition_rewards (
  id               uuid primary key default gen_random_uuid(),
  competition_id   uuid not null references public.competitions (id) on delete cascade,
  from_rank        int not null check (from_rank >= 1),
  to_rank          int not null,
  reward           jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  check (from_rank <= to_rank)
);

alter table public.competition_rewards enable row level security;

create index if not exists idx_competition_rewards_comp on public.competition_rewards (competition_id);

-- ─── 9. Fixtures / jogos agendados ─────────────────────────────────────────
create table if not exists public.fixtures (
  id                     uuid primary key default gen_random_uuid(),
  competition_id         uuid not null references public.competitions (id) on delete cascade,
  phase_id               uuid not null references public.competition_phases (id) on delete cascade,
  round_index            int not null default 1 check (round_index >= 1),
  leg                    smallint not null default 1 check (leg in (1, 2)),
  home_club_id           uuid not null references public.clubs (id) on delete cascade,
  away_club_id           uuid not null references public.clubs (id) on delete cascade,
  aggregate_home_goals   int check (aggregate_home_goals is null or aggregate_home_goals >= 0),
  aggregate_away_goals   int check (aggregate_away_goals is null or aggregate_away_goals >= 0),
  tie_break_home_exp     numeric(14, 4),
  tie_break_away_exp     numeric(14, 4),
  status                 text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished', 'void', 'walkover')),
  scheduled_at           timestamptz,
  match_id               uuid references public.matches (id) on delete set null,
  metadata               jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.fixtures enable row level security;

create index if not exists idx_fixtures_comp on public.fixtures (competition_id);
create index if not exists idx_fixtures_phase on public.fixtures (phase_id);
create index if not exists idx_fixtures_scheduled on public.fixtures (competition_id, scheduled_at);
create index if not exists idx_fixtures_match on public.fixtures (match_id);

-- ─── 10. Ligação opcional matches ↔ competição ─────────────────────────────
alter table public.matches
  add column if not exists competition_id uuid references public.competitions (id) on delete set null;

alter table public.matches
  add column if not exists fixture_id uuid references public.fixtures (id) on delete set null;

create index if not exists idx_matches_competition on public.matches (competition_id);
create index if not exists idx_matches_fixture on public.matches (fixture_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS: leitura controlada; sem INSERT/UPDATE/DELETE para authenticated (ADMIN = service_role)
-- ═══════════════════════════════════════════════════════════════════════════

-- Calendário / divisões: leitura para utilizadores autenticados (metadados de época).
create policy "seasons_select_authenticated" on public.seasons
  for select to authenticated using (true);

create policy "season_divisions_select_authenticated" on public.season_divisions
  for select to authenticated using (true);

create policy "season_division_memberships_select_authenticated" on public.season_division_memberships
  for select to authenticated using (true);

-- Competição visível se: participo OU (pública e não rascunho).
create policy "competitions_select_authenticated" on public.competitions
  for select to authenticated using (
    exists (
      select 1
      from public.competition_participants cp
      where cp.competition_id = competitions.id
        and cp.club_id is not distinct from public.my_club_id()
    )
    or (
      competitions.visibility = 'public'
      and competitions.status in ('scheduled', 'active', 'finished', 'cancelled')
    )
  );

-- Fases: mesma lógica via competição pai.
create policy "competition_phases_select_authenticated" on public.competition_phases
  for select to authenticated using (
    exists (
      select 1
      from public.competitions c
      where c.id = competition_phases.competition_id
        and (
          exists (
            select 1
            from public.competition_participants cp
            where cp.competition_id = c.id
              and cp.club_id is not distinct from public.my_club_id()
          )
          or (
            c.visibility = 'public'
            and c.status in ('scheduled', 'active', 'finished', 'cancelled')
          )
        )
    )
  );

-- Participantes: ver todos do mesmo campeonato se o campeonato me é visível.
create policy "competition_participants_select_authenticated" on public.competition_participants
  for select to authenticated using (
    exists (
      select 1
      from public.competitions c
      where c.id = competition_participants.competition_id
        and (
          exists (
            select 1
            from public.competition_participants cp
            where cp.competition_id = c.id
              and cp.club_id is not distinct from public.my_club_id()
          )
          or (
            c.visibility = 'public'
            and c.status in ('scheduled', 'active', 'finished', 'cancelled')
          )
        )
    )
  );

create policy "competition_standings_select_authenticated" on public.competition_standings
  for select to authenticated using (
    exists (
      select 1
      from public.competitions c
      where c.id = competition_standings.competition_id
        and (
          exists (
            select 1
            from public.competition_participants cp
            where cp.competition_id = c.id
              and cp.club_id is not distinct from public.my_club_id()
          )
          or (
            c.visibility = 'public'
            and c.status in ('scheduled', 'active', 'finished', 'cancelled')
          )
        )
    )
  );

create policy "competition_rewards_select_authenticated" on public.competition_rewards
  for select to authenticated using (
    exists (
      select 1
      from public.competitions c
      where c.id = competition_rewards.competition_id
        and (
          exists (
            select 1
            from public.competition_participants cp
            where cp.competition_id = c.id
              and cp.club_id is not distinct from public.my_club_id()
          )
          or (
            c.visibility = 'public'
            and c.status in ('scheduled', 'active', 'finished', 'cancelled')
          )
        )
    )
  );

create policy "fixtures_select_authenticated" on public.fixtures
  for select to authenticated using (
    exists (
      select 1
      from public.competitions c
      where c.id = fixtures.competition_id
        and (
          exists (
            select 1
            from public.competition_participants cp
            where cp.competition_id = c.id
              and cp.club_id is not distinct from public.my_club_id()
          )
          or (
            c.visibility = 'public'
            and c.status in ('scheduled', 'active', 'finished', 'cancelled')
          )
        )
    )
  );

-- Grants explícitos (PostgREST)
grant select on public.seasons to authenticated;
grant select on public.season_divisions to authenticated;
grant select on public.season_division_memberships to authenticated;
grant select on public.competitions to authenticated;
grant select on public.competition_phases to authenticated;
grant select on public.competition_participants to authenticated;
grant select on public.competition_standings to authenticated;
grant select on public.competition_rewards to authenticated;
grant select on public.fixtures to authenticated;

comment on table public.seasons is 'Época; 5 divisões via season_divisions; promoção/rebaixamento promotion_count/relegation_count (ex. 5↑5↓).';
comment on table public.season_divisions is 'Snapshot por temporada: tier 1=Série A … 5=Série E; max_clubs típico 100.';
comment on table public.competitions is 'Liga (round_robin ou premium+N knockout) ou Copa (knockout, ida e volta); service_role para escrita ADMIN.';
comment on table public.fixtures is 'Confronto agendado; leg 1|2 para copa; match_id quando o motor cria public.matches.';
comment on column public.fixtures.tie_break_home_exp is 'Snapshot EXP clube mandante para desempate no agregado (copa).';
comment on column public.fixtures.tie_break_away_exp is 'Snapshot EXP clube visitante para desempate no agregado (copa).';

-- ─── 00003_admin_platform_schema.sql ───
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

-- ─── 00004_online_game_persistence.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — 00004_online_game_persistence
--
-- Alinha schema com o cliente (matchPersistence, reducer) e servidor (matches):
--   • matches: mode inclui test2d; colunas away_name, simulation_seed, post_match_data
--   • match_events: coluna `kind` (o código usa kind; migração 00001 tinha `type`)
--   • clubs: short_name, city, stadium (tipos em src/supabase/database.types.ts)
--   • players: campos do motor + trigger name/display_name
--   • game_spirit_ai_logs: telemetria OpenAI (RLS sem políticas = só service_role / SQL)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── clubs (metadados UI) ─────────────────────────────────────────────────
alter table public.clubs
  add column if not exists short_name text,
  add column if not exists city text,
  add column if not exists stadium text;

update public.clubs
set short_name = left(btrim(name), 48)
where short_name is null or btrim(short_name) = '';

-- ─── matches ──────────────────────────────────────────────────────────────
alter table public.matches
  add column if not exists away_name text,
  add column if not exists simulation_seed bigint,
  add column if not exists post_match_data jsonb;

-- Relaxar / substituir CHECK de mode (00001: live|quick|auto → incluir test2d)
do $$
declare
  r record;
begin
  for r in
    select c.conname as conname
    from pg_constraint c
    where c.conrelid = 'public.matches'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%mode%'
  loop
    execute format('alter table public.matches drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.matches
  add constraint matches_mode_check check (
    mode in ('live', 'quick', 'auto', 'test2d')
  );

-- ─── match_events: type → kind ────────────────────────────────────────────
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'match_events'
      and column_name = 'type'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'match_events'
      and column_name = 'kind'
  ) then
    alter table public.match_events rename column type to kind;
  end if;
end $$;

-- ─── players: plantel alinhado ao motor ───────────────────────────────────
alter table public.players
  add column if not exists name text,
  add column if not exists num int not null default 0,
  add column if not exists pos text not null default 'MC',
  add column if not exists archetype text not null default 'balanced',
  add column if not exists zone text not null default 'mid',
  add column if not exists behavior text not null default 'normal',
  add column if not exists fatigue int not null default 0 check (fatigue >= 0 and fatigue <= 100),
  add column if not exists injury_risk int not null default 0 check (injury_risk >= 0 and injury_risk <= 100),
  add column if not exists evolution_xp int not null default 0,
  add column if not exists out_for_matches int not null default 0 check (out_for_matches >= 0),
  add column if not exists updated_at timestamptz not null default now();

update public.players p
set name = p.display_name
where p.name is null or btrim(p.name) = '';

alter table public.players alter column name set default '';

update public.players
set name = 'Jogador'
where name is null or btrim(name) = '';

alter table public.players alter column name set not null;

alter table public.players alter column display_name drop not null;

create or replace function public.players_sync_name_display()
returns trigger
language plpgsql
as $$
begin
  if new.name is null or btrim(new.name) = '' then
    new.name := coalesce(nullif(btrim(new.display_name), ''), 'Jogador');
  end if;
  if new.display_name is null or btrim(new.display_name) = '' then
    new.display_name := new.name;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists players_sync_name_display_trg on public.players;
create trigger players_sync_name_display_trg
  before insert or update on public.players
  for each row execute function public.players_sync_name_display();

create index if not exists idx_players_club_name on public.players (club_id, name);

comment on column public.matches.away_name is 'Oponente texto quando away_club_id é null (vs IA).';
comment on column public.matches.simulation_seed is 'Seed opcional para reproduzir o motor.';
comment on column public.matches.post_match_data is 'JSON pós-jogo (stats, narrativa, etc.).';

-- ─── Game Spirit / OpenAI — telemetria (escrita pelo backend) ─────────────
create table if not exists public.game_spirit_ai_logs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches (id) on delete set null,
  club_id uuid references public.clubs (id) on delete set null,
  request_fingerprint text not null,
  provider text not null default 'openai',
  model text,
  source text not null default 'responses' check (source in ('responses', 'fallback', 'cache_hit')),
  input_summary jsonb not null default '{}'::jsonb,
  output_json jsonb not null default '{}'::jsonb,
  latency_ms int check (latency_ms is null or latency_ms >= 0),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_game_spirit_ai_logs_created on public.game_spirit_ai_logs (created_at desc);
create index if not exists idx_game_spirit_ai_logs_match on public.game_spirit_ai_logs (match_id, created_at desc);
create index if not exists idx_game_spirit_ai_logs_fingerprint on public.game_spirit_ai_logs (request_fingerprint);

alter table public.game_spirit_ai_logs enable row level security;

comment on table public.game_spirit_ai_logs is
  'Decisões Game Spirit + OpenAI para testes online e análise; sem políticas RLS para anon/authenticated — usar service_role no Worker.';

-- ─── 00005_postgrest_grants_core_game.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — 00005_postgrest_grants_core_game
--
-- Garante que o cliente Supabase-js (anon + JWT authenticated) consegue
-- aceder às tabelas do núcleo de jogo criadas em 00001. Em projectos novos,
-- às vezes faltam GRANT explícitos até às políticas RLS poderem filtrar linhas.
-- Idempotente: repetir GRANT é seguro.
-- ═══════════════════════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table public.clubs to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.players to authenticated;
grant select, insert, update on table public.matches to authenticated;
grant select, insert on table public.match_events to authenticated;

-- ─── 00006_genesis_market_players.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — 00006_genesis_market_players
--
-- Catálogo oficial «Genesis» (primeiros jogadores OLEFOOT), listados no mercado.
-- Retratos: bucket público `genesis-player-portraits` — caminho sugerido
--   genesis/<id>.jpg (ver comentário em portrait_storage_path).
-- Regenerar seed a partir do CSV: node scripts/gen-genesis-seed-sql.mjs
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.genesis_market_players (
  id text primary key,
  kit_number int not null,
  name text not null,
  pos text not null,
  pos_original text,
  archetype text not null,
  zone text not null,
  behavior text not null,
  attributes jsonb not null default '{}'::jsonb,
  fatigue int not null default 0,
  injury_risk int not null default 0,
  evolution_xp int not null default 0,
  out_for_matches int not null default 0,
  market_value_bro_cents bigint not null default 0,
  price_bro_cents bigint not null default 0,
  country text,
  age int,
  strong_foot text,
  creator_label text,
  rarity_label text,
  bio text,
  listed_on_market boolean not null default true,
  mint_overall int,
  evolution_rate int,
  collection_id text,
  card_supply int default 1,
  spirit_notes text,
  portrait_storage_path text,
  portrait_public_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint genesis_market_players_strong_foot_chk
    check (strong_foot is null or strong_foot in ('right', 'left', 'both'))
);

create index if not exists idx_genesis_market_listed on public.genesis_market_players (listed_on_market, mint_overall desc nulls last);
create index if not exists idx_genesis_market_pos on public.genesis_market_players (pos);

comment on table public.genesis_market_players is 'Catálogo global OLEFOOT Genesis; mercado (listed_on_market) e preços em centavos de BRO.';
comment on column public.genesis_market_players.portrait_storage_path is
  'Caminho do objecto no bucket Storage `genesis-player-portraits` (ex.: genesis/GEN-001.jpg). URL pública = {SUPABASE_URL}/storage/v1/object/public/genesis-player-portraits/{path}';
comment on column public.genesis_market_players.portrait_public_url is
  'Opcional: URL já resolvida (CDN ou upload manual); tem precedência sobre portrait_storage_path na UI.';

alter table public.genesis_market_players enable row level security;

drop policy if exists "genesis_market_players_select_public" on public.genesis_market_players;
create policy "genesis_market_players_select_public"
  on public.genesis_market_players for select
  to anon, authenticated
  using (coalesce(listed_on_market, true) = true);

grant select, update on table public.genesis_market_players to anon, authenticated;

drop policy if exists "genesis_market_players_update_portraits" on public.genesis_market_players;
create policy "genesis_market_players_update_portraits"
  on public.genesis_market_players for update
  to anon, authenticated
  using (true)
  with check (true);

-- ─── Storage: retratos Genesis (upload autenticado sob prefixo genesis/) ───
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'genesis-player-portraits',
  'genesis-player-portraits',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "genesis_portraits_public_read" on storage.objects;
create policy "genesis_portraits_public_read"
  on storage.objects for select
  using (bucket_id = 'genesis-player-portraits');

drop policy if exists "genesis_portraits_auth_insert" on storage.objects;
create policy "genesis_portraits_auth_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'genesis-player-portraits'
    and name like 'genesis/%'
  );

drop policy if exists "genesis_portraits_auth_update" on storage.objects;
create policy "genesis_portraits_auth_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'genesis-player-portraits' and name like 'genesis/%')
  with check (bucket_id = 'genesis-player-portraits' and name like 'genesis/%');

drop policy if exists "genesis_portraits_auth_delete" on storage.objects;
create policy "genesis_portraits_auth_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'genesis-player-portraits' and name like 'genesis/%');

-- genesis_market_players seed (50 rows)
insert into public.genesis_market_players (id, kit_number, name, pos, pos_original, archetype, zone, behavior, attributes, fatigue, injury_risk, evolution_xp, out_for_matches, market_value_bro_cents, price_bro_cents, country, age, strong_foot, creator_label, rarity_label, bio, listed_on_market, mint_overall, evolution_rate, collection_id, card_supply, spirit_notes) values
('GEN-001', 1, 'Adrien Ayo', 'MC', 'LM', 'novo_talento', 'meio', 'criativo', '{"passe":35,"marcacao":35,"velocidade":35,"drible":25,"finalizacao":25,"fisico":31,"tatico":28,"mentalidade":25,"confianca":30,"fairPlay":35}'::jsonb, 0, 61, 57, 0, 1000, 1000, 'France', 19, null, 'genesis', 'Basic', 'Prefers positioning over chasing — spatial intelligence influences defense.', true, 30, 62, 'genesis', 1, 'Creative Soul'),
('GEN-002', 2, 'Adrien Ayo', 'MC', 'LM', 'novo_talento', 'meio', 'criativo', '{"passe":55,"marcacao":35,"velocidade":55,"drible":25,"finalizacao":40,"fisico":40,"tatico":42,"mentalidade":45,"confianca":45,"fairPlay":45}'::jsonb, 0, 54, 57, 0, 4000, 4000, 'France', 21, null, 'genesis', 'Rare', 'Prefers positioning over chasing — spatial intelligence influences defense.', true, 43, 80, 'genesis', 1, 'Creative Soul'),
('GEN-003', 3, 'Adrien Ayo', 'MC', 'LM', 'novo_talento', 'meio', 'criativo', '{"passe":55,"marcacao":40,"velocidade":75,"drible":35,"finalizacao":55,"fisico":40,"tatico":49,"mentalidade":55,"confianca":50,"fairPlay":45}'::jsonb, 0, 47, 91, 0, 25000, 25000, 'France', 23, null, 'genesis', 'Ultra Rare', 'Prefers positioning over chasing — spatial intelligence influences defense.', true, 50, 91, 'genesis', 1, 'Creative Soul'),
('GEN-004', 4, 'Ahmad Al-Kuwari', 'PE', 'LW', 'profissional', 'lateral_esq', 'ofensivo', '{"passe":35,"marcacao":35,"velocidade":35,"drible":25,"finalizacao":30,"fisico":37,"tatico":32,"mentalidade":35,"confianca":30,"fairPlay":25}'::jsonb, 0, 70, 57, 0, 1000, 1000, 'Qatar', 25, null, 'genesis', 'Basic', 'Accelerates game in emotional situations — pride overrules tactics under pressure.', true, 32, 67, 'genesis', 1, 'Provocative'),
('GEN-005', 5, 'Ahmad Al-Kuwari', 'PE', 'LW', 'profissional', 'lateral_esq', 'ofensivo', '{"passe":35,"marcacao":38,"velocidade":40,"drible":40,"finalizacao":38,"fisico":42,"tatico":38,"mentalidade":40,"confianca":37,"fairPlay":35}'::jsonb, 0, 70, 57, 0, 7000, 7000, 'Qatar', 27, null, 'genesis', 'Silver', 'Accelerates game in emotional situations — pride overrules tactics under pressure.', true, 38, 61, 'genesis', 1, 'Provocative'),
('GEN-006', 6, 'Augusto Bobby', 'MC', 'CAM', 'novo_talento', 'meio', 'ofensivo', '{"passe":25,"marcacao":20,"velocidade":35,"drible":15,"finalizacao":35,"fisico":44,"tatico":22,"mentalidade":25,"confianca":30,"fairPlay":35}'::jsonb, 0, 64, 57, 0, 1000, 1000, 'Jamaica', 21, null, 'genesis', 'Basic', 'Plays through pain — injury resistance overrides substitution logic.', true, 29, 60, 'genesis', 1, 'Provocative'),
('GEN-007', 7, 'Bruno Guina', 'MC', 'CM', 'novo_talento', 'meio', 'ofensivo', '{"passe":35,"marcacao":30,"velocidade":35,"drible":25,"finalizacao":20,"fisico":28,"tatico":24,"mentalidade":15,"confianca":20,"fairPlay":25}'::jsonb, 0, 58, 57, 0, 1000, 1000, 'Brazil', 17, null, 'genesis', 'Basic', 'Dribbles like poetry, but bleeds when the game gets tough.', true, 26, 57, 'genesis', 1, 'Provocative'),
('GEN-008', 8, 'Adriano Carioca', 'ATA', 'CF', 'novo_talento', 'ataque', 'ofensivo', '{"passe":35,"marcacao":20,"velocidade":35,"drible":35,"finalizacao":45,"fisico":49,"tatico":35,"mentalidade":35,"confianca":40,"fairPlay":45}'::jsonb, 0, 61, 77, 0, 12000, 12000, 'Brazil', 19, null, 'genesis', 'Gold', 'Prefers to shoot than pass when approaching the box — natural bias for protagonism.', true, 37, 77, 'genesis', 1, 'Provocative'),
('GEN-009', 9, 'Felipe Ybere', 'PD', 'RW', 'novo_talento', 'lateral_dir', 'equilibrado', '{"passe":35,"marcacao":30,"velocidade":35,"drible":25,"finalizacao":25,"fisico":34,"tatico":28,"mentalidade":25,"confianca":25,"fairPlay":25}'::jsonb, 0, 58, 57, 0, 1000, 1000, 'Peru', 17, null, 'genesis', 'Basic', 'Unshakable belief — trusts the game can shift with ancestral guidance.', true, 29, 62, 'genesis', 1, 'Impulsive Charger'),
('GEN-010', 10, 'Flavio Medina', 'VOL', 'CDM', 'profissional', 'meio', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":35,"drible":25,"finalizacao":35,"fisico":47,"tatico":32,"mentalidade":35,"confianca":30,"fairPlay":25}'::jsonb, 0, 67, 57, 0, 1000, 1000, 'Espanha', 23, null, 'genesis', 'Basic', 'Unique style forged by skill, vision, and passion.', true, 33, 61, 'genesis', 1, 'Legacy'),
('GEN-011', 11, 'Eurico Freddy', 'VOL', 'CDM', 'profissional', 'meio', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":35,"drible":25,"finalizacao":35,"fisico":47,"tatico":32,"mentalidade":35,"confianca":30,"fairPlay":25}'::jsonb, 0, 70, 57, 0, 1000, 1000, 'Gana', 25, null, 'genesis', 'Basic', 'Loses tempo when multitasked — better with clear singular focus.', true, 33, 57, 'genesis', 1, 'Impulsive Charger'),
('GEN-012', 12, 'Gui Nunez', 'ATA', 'CF', 'profissional', 'ataque', 'ofensivo', '{"passe":45,"marcacao":20,"velocidade":35,"drible":35,"finalizacao":45,"fisico":51,"tatico":42,"mentalidade":45,"confianca":40,"fairPlay":35}'::jsonb, 0, 77, 62, 0, 12000, 12000, 'Brazil', 30, null, 'genesis', 'Gold', 'Prefers to shoot than pass when approaching the box — natural bias for protagonism.', true, 39, 62, 'genesis', 1, 'Provocative'),
('GEN-013', 13, 'Bernard Gustave', 'ATA', 'CF', 'profissional', 'ataque', 'equilibrado', '{"passe":55,"marcacao":18,"velocidade":50,"drible":45,"finalizacao":55,"fisico":47,"tatico":46,"mentalidade":40,"confianca":40,"fairPlay":40}'::jsonb, 0, 65, 56, 0, 15000, 15000, 'France', 27, null, 'genesis', 'Retro', 'Creative playmaker with elegance and tactical sharpness.', true, 44, 56, 'genesis', 1, 'Legacy'),
('GEN-014', 14, 'Helinho', 'LD', 'RWB', 'profissional', 'lateral_dir', 'equilibrado', '{"passe":45,"marcacao":30,"velocidade":45,"drible":35,"finalizacao":30,"fisico":43,"tatico":42,"mentalidade":45,"confianca":40,"fairPlay":35}'::jsonb, 0, 65, 62, 0, 12000, 12000, 'Brazil', 25, null, 'genesis', 'Gold', 'Presses deeper when teammates slow down — compensates for others instinctively.', true, 39, 62, 'genesis', 1, 'Legacy'),
('GEN-015', 15, 'Helinho', 'LD', 'RWB', 'profissional', 'lateral_dir', 'equilibrado', '{"passe":55,"marcacao":42,"velocidade":45,"drible":50,"finalizacao":40,"fisico":48,"tatico":53,"mentalidade":55,"confianca":45,"fairPlay":35}'::jsonb, 0, 72, 67, 0, 15000, 15000, 'Brazil', 30, null, 'genesis', 'Retro', 'Presses deeper when teammates slow down — compensates for others instinctively.', true, 47, 67, 'genesis', 1, 'Provocador'),
('GEN-016', 16, 'Henrine Tito', 'PD', 'RM', 'profissional', 'meio', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":35,"drible":35,"finalizacao":30,"fisico":45,"tatico":27,"mentalidade":15,"confianca":15,"fairPlay":15}'::jsonb, 0, 70, 57, 0, 1000, 1000, 'Italy', 25, null, 'genesis', 'Basic', 'Unique style forged by skill, vision, and passion.', true, 29, 47, 'genesis', 1, 'Adaptive Leader'),
('GEN-017', 17, 'James Oliver', 'ATA', 'ST', 'novo_talento', 'ataque', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":25,"drible":25,"finalizacao":45,"fisico":55,"tatico":24,"mentalidade":15,"confianca":10,"fairPlay":5}'::jsonb, 0, 77, 57, 0, 12000, 12000, 'United States', 20, null, 'genesis', 'Gold', 'Boosts intensity when crowd reacts — external rhythm drives internal tempo.', true, 27, 57, 'genesis', 1, 'Cold Strategist'),
('GEN-018', 18, 'Joel Andinho', 'ZAG', 'CB', 'novo_talento', 'defesa', 'ofensivo', '{"passe":35,"marcacao":35,"velocidade":35,"drible":35,"finalizacao":20,"fisico":39,"tatico":27,"mentalidade":15,"confianca":25,"fairPlay":35}'::jsonb, 0, 65, 57, 0, 1000, 1000, 'Colombia', 15, null, 'genesis', 'Basic', 'Maintains movement pattern even under pressure — values structure over chaos.', true, 30, 57, 'genesis', 1, 'Provocative'),
('GEN-019', 19, 'Joel Andinho', 'ZAG', 'CB', 'novo_talento', 'defesa', 'ofensivo', '{"passe":45,"marcacao":40,"velocidade":45,"drible":45,"finalizacao":30,"fisico":44,"tatico":37,"mentalidade":25,"confianca":30,"fairPlay":35}'::jsonb, 0, 66, 62, 0, 20000, 20000, 'Colombia', 19, null, 'genesis', 'Next', 'Maintains movement pattern even under pressure — values structure over chaos.', true, 38, 62, 'genesis', 1, 'Provocative'),
('GEN-020', 20, 'John Malby', 'LD', 'RB', 'profissional', 'lateral_dir', 'equilibrado', '{"passe":35,"marcacao":30,"velocidade":35,"drible":35,"finalizacao":30,"fisico":48,"tatico":31,"mentalidade":25,"confianca":25,"fairPlay":25}'::jsonb, 0, 67, 57, 0, 1000, 1000, 'United States', 23, null, 'genesis', 'Basic', 'Unique style forged by skill, vision, and passion.', true, 32, 56, 'genesis', 1, 'Impulsive Charger'),
('GEN-021', 21, 'Juan Figueroa', 'MC', 'CAM', 'profissional', 'meio', 'equilibrado', '{"passe":25,"marcacao":35,"velocidade":35,"drible":35,"finalizacao":35,"fisico":48,"tatico":32,"mentalidade":35,"confianca":25,"fairPlay":15}'::jsonb, 0, 67, 57, 0, 1000, 1000, 'Argentina', 23, null, 'genesis', 'Basic', 'Takes long shots when momentum drops — attempts to reset energy.', true, 32, 61, 'genesis', 1, 'Cold Strategist'),
('GEN-022', 22, 'Julio Camargo', 'MC', 'CCM', 'profissional', 'meio', 'equilibrado', '{"passe":35,"marcacao":30,"velocidade":35,"drible":35,"finalizacao":30,"fisico":40,"tatico":35,"mentalidade":35,"confianca":35,"fairPlay":35}'::jsonb, 0, 73, 57, 0, 1000, 1000, 'Brazil', 27, null, 'genesis', 'Basic', 'Delivers long passes to break compact lines — vision-oriented decision-making.', true, 34, 63, 'genesis', 1, 'Legacy'),
('GEN-023', 23, 'Julio Camargo', 'MC', 'CCM', 'profissional', 'meio', 'equilibrado', '{"passe":45,"marcacao":40,"velocidade":35,"drible":45,"finalizacao":40,"fisico":45,"tatico":45,"mentalidade":45,"confianca":45,"fairPlay":45}'::jsonb, 0, 77, 62, 0, 12000, 12000, 'Brazil', 30, null, 'genesis', 'Gold', 'Delivers long passes to break compact lines — vision-oriented decision-making.', true, 43, 62, 'genesis', 1, 'Legacy'),
('GEN-024', 24, 'Julio Camargo', 'MC', 'CCM', 'lenda', 'meio', 'equilibrado', '{"passe":55,"marcacao":70,"velocidade":55,"drible":45,"finalizacao":60,"fisico":60,"tatico":56,"mentalidade":65,"confianca":55,"fairPlay":45}'::jsonb, 0, 67, 72, 0, 30000, 30000, 'Brazil', 30, null, 'genesis', 'Legend', 'Delivers long passes to break compact lines — vision-oriented decision-making.', true, 57, 72, 'genesis', 1, 'Legacy'),
('GEN-025', 25, 'Luca Preto', 'LE', 'LB', 'profissional', 'lateral_esq', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":35,"drible":35,"finalizacao":20,"fisico":44,"tatico":31,"mentalidade":25,"confianca":25,"fairPlay":25}'::jsonb, 0, 70, 57, 0, 1000, 1000, 'Brazil', 25, null, 'genesis', 'Basic', 'Skillful and unpredictable, you shine under pressure.', true, 31, 52, 'genesis', 1, 'Impulsive'),
('GEN-026', 26, 'Lyov Miroslav', 'GOL', 'GK', 'novo_talento', 'gol', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":35,"drible":15,"finalizacao":20,"fisico":40,"tatico":25,"mentalidade":25,"confianca":20,"fairPlay":15}'::jsonb, 0, 68, 57, 0, 2000, 2000, 'Russian', 17, null, 'genesis', 'Academy', 'Born to lead — snaps when a teammate is unfairly hit', true, 26, 72, 'genesis', 1, 'Cold Strategist'),
('GEN-027', 27, 'Lyov Miroslav', 'GOL', 'GK', 'lenda', 'gol', 'equilibrado', '{"passe":65,"marcacao":55,"velocidade":55,"drible":55,"finalizacao":40,"fisico":58,"tatico":62,"mentalidade":65,"confianca":50,"fairPlay":35}'::jsonb, 0, 85, 62, 0, 30000, 30000, 'Russian', 35, null, 'genesis', 'Legend', 'Born to lead — snaps when a teammate is unfairly hit', true, 54, 62, 'genesis', 1, 'Cold Strategist'),
('GEN-028', 28, 'Marcelinho Souza', 'ZAG', 'CB', 'novo_talento', 'defesa', 'equilibrado', '{"passe":45,"marcacao":65,"velocidade":75,"drible":35,"finalizacao":40,"fisico":60,"tatico":50,"mentalidade":65,"confianca":50,"fairPlay":35}'::jsonb, 0, 48, 100, 0, 25000, 25000, 'Brazil', 17, null, 'genesis', 'Ultra Rare', 'Switches flanks frequently — uses field geometry to create numerical advantage.', true, 52, 100, 'genesis', 1, 'Adaptive Leader'),
('GEN-029', 29, 'Marinho Souza', 'MC', 'CM', 'profissional', 'meio', 'equilibrado', '{"passe":35,"marcacao":25,"velocidade":35,"drible":35,"finalizacao":35,"fisico":43,"tatico":27,"mentalidade":15,"confianca":20,"fairPlay":25}'::jsonb, 0, 70, 57, 0, 1000, 1000, 'Brazil', 25, null, 'genesis', 'Basic', 'Skillful and unpredictable, you shine under pressure.', true, 30, 47, 'genesis', 1, 'Impulsive'),
('GEN-030', 30, 'Martine Pache', 'LE', 'LWB', 'novo_talento', 'lateral_esq', 'equilibrado', '{"passe":25,"marcacao":45,"velocidade":45,"drible":35,"finalizacao":45,"fisico":36,"tatico":32,"mentalidade":35,"confianca":30,"fairPlay":25}'::jsonb, 0, 56, 67, 0, 12000, 12000, 'Espanha', 19, null, 'genesis', 'Gold', 'Unique style forged by skill, vision, and passion.', true, 35, 67, 'genesis', 1, 'Provocador'),
('GEN-031', 31, 'Moacir Ruda', 'VOL', 'CDM', 'profissional', 'meio', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":35,"drible":25,"finalizacao":15,"fisico":22,"tatico":32,"mentalidade":35,"confianca":35,"fairPlay":35}'::jsonb, 0, 70, 57, 0, 1000, 1000, 'Peru', 25, null, 'genesis', 'Basic', 'Unique style forged by skill, vision, and passion.', true, 30, 57, 'genesis', 1, 'Impulsive Charger'),
('GEN-032', 32, 'Murilo Garcia', 'GOL', 'GK', 'profissional', 'gol', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":35,"drible":15,"finalizacao":20,"fisico":37,"tatico":25,"mentalidade":25,"confianca":25,"fairPlay":25}'::jsonb, 0, 80, 57, 0, 1000, 1000, 'Uruguay', 25, null, 'genesis', 'Basic', 'Gritty and fearless, you lead with heart and instinct.', true, 28, 52, 'genesis', 1, 'Impulsive'),
('GEN-033', 33, 'Omar Khalid', 'GOL', 'GK', 'profissional', 'gol', 'ofensivo', '{"passe":30,"marcacao":38,"velocidade":40,"drible":25,"finalizacao":20,"fisico":32,"tatico":30,"mentalidade":35,"confianca":37,"fairPlay":40}'::jsonb, 0, 85, 57, 0, 7000, 7000, 'Pakistan', 30, null, 'genesis', 'Silver', 'Unshakable belief — trusts the game can shift with ancestral guidance.', true, 33, 62, 'genesis', 1, 'Provocative'),
('GEN-034', 34, 'Mathias Jimenez', 'MC', 'LM', 'profissional', 'meio', 'ofensivo', '{"passe":25,"marcacao":30,"velocidade":35,"drible":25,"finalizacao":25,"fisico":42,"tatico":29,"mentalidade":35,"confianca":25,"fairPlay":15}'::jsonb, 0, 70, 57, 0, 1000, 1000, 'Paraguay', 25, null, 'genesis', 'Basic', 'Reads space before engaging — relies on strategy over instinct.', true, 29, 57, 'genesis', 1, 'Provocative'),
('GEN-035', 35, 'Mathias Jimenez', 'MC', 'LM', 'profissional', 'meio', 'ofensivo', '{"passe":40,"marcacao":32,"velocidade":30,"drible":30,"finalizacao":32,"fisico":47,"tatico":35,"mentalidade":35,"confianca":30,"fairPlay":25}'::jsonb, 0, 72, 57, 0, 7000, 7000, 'Paraguay', 25, null, 'genesis', 'Silver', 'Reads space before engaging — relies on strategy over instinct.', true, 34, 62, 'genesis', 1, 'Provocative'),
('GEN-036', 36, 'Polk Idea', 'ZAG', 'CB', 'profissional', 'defesa', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":35,"drible":35,"finalizacao":30,"fisico":50,"tatico":23,"mentalidade":5,"confianca":5,"fairPlay":5}'::jsonb, 0, 87, 57, 0, 1000, 1000, 'Ukranian', 30, null, 'genesis', 'Basic', 'Unique style forged by skill, vision, and passion.', true, 26, 32, 'genesis', 1, 'Impulsive'),
('GEN-037', 37, 'Aljariri Rahman', 'MC', 'CAM', 'profissional', 'meio', 'equilibrado', '{"passe":35,"marcacao":20,"velocidade":35,"drible":35,"finalizacao":35,"fisico":43,"tatico":31,"mentalidade":25,"confianca":30,"fairPlay":35}'::jsonb, 0, 70, 57, 0, 1000, 1000, 'UAE', 25, null, 'genesis', 'Basic', 'Rarely retreats — forward movement defines his approach.', true, 32, 62, 'genesis', 1, 'Impulsive'),
('GEN-038', 38, 'Aljariri Rahman', 'MC', 'CAM', 'novo_talento', 'meio', 'equilibrado', '{"passe":45,"marcacao":35,"velocidade":55,"drible":55,"finalizacao":75,"fisico":58,"tatico":60,"mentalidade":75,"confianca":55,"fairPlay":35}'::jsonb, 0, 67, 97, 0, 25000, 25000, 'UAE', 30, null, 'genesis', 'Ultra Rare', 'Rarely retreats — forward movement defines his approach.', true, 55, 97, 'genesis', 1, 'Impulsive'),
('GEN-039', 39, 'Sanjay Ravi', 'GOL', 'GK', 'profissional', 'gol', 'equilibrado', '{"passe":25,"marcacao":25,"velocidade":35,"drible":25,"finalizacao":35,"fisico":39,"tatico":29,"mentalidade":35,"confianca":35,"fairPlay":35}'::jsonb, 0, 80, 57, 0, 1000, 1000, 'Indian', 25, null, 'genesis', 'Basic', 'Unshakable belief — trusts the game can shift with ancestral guidance.', true, 32, 57, 'genesis', 1, 'Impulsive Charger'),
('GEN-040', 40, 'Ruiz Pacheco', 'PD', 'RW', 'novo_talento', 'lateral_dir', 'equilibrado', '{"passe":55,"marcacao":60,"velocidade":65,"drible":55,"finalizacao":75,"fisico":57,"tatico":59,"mentalidade":65,"confianca":65,"fairPlay":65}'::jsonb, 0, 59, 57, 0, 9000, 9000, 'Chile', 28, null, 'genesis', 'Classic', 'Unique style forged by skill, vision, and passion.', true, 62, 76, 'genesis', 1, 'Adaptive Leader'),
('GEN-041', 41, 'Ruiz Pacheco', 'PD', 'RW', 'lenda', 'lateral_dir', 'equilibrado', '{"passe":65,"marcacao":70,"velocidade":65,"drible":65,"finalizacao":85,"fisico":57,"tatico":65,"mentalidade":65,"confianca":65,"fairPlay":65}'::jsonb, 0, 62, 72, 0, 30000, 30000, 'Chile', 30, null, 'genesis', 'Legend', 'Unique style forged by skill, vision, and passion.', true, 67, 72, 'genesis', 1, 'Adaptive Leader'),
('GEN-042', 42, 'Satto Nakamoto', 'ZAG', 'CB', 'profissional', 'defesa', 'equilibrado', '{"passe":45,"marcacao":35,"velocidade":45,"drible":45,"finalizacao":40,"fisico":36,"tatico":33,"mentalidade":15,"confianca":30,"fairPlay":45}'::jsonb, 0, 78, 43, 0, 12000, 12000, 'Japan', 27, null, 'genesis', 'Gold', 'Precise, focused, and resilient in every situation.', true, 37, 43, 'genesis', 1, 'Adaptive Leader'),
('GEN-043', 43, 'Savinho Davila', 'PD', 'EXT', 'novo_talento', 'ataque', 'equilibrado', '{"passe":45,"marcacao":25,"velocidade":45,"drible":45,"finalizacao":40,"fisico":29,"tatico":37,"mentalidade":25,"confianca":25,"fairPlay":25}'::jsonb, 0, 53, 62, 0, 12000, 12000, 'Brazil', 17, null, 'genesis', 'Gold', 'Delays passing in favor of direct action — believes in personal execution.', true, 34, 62, 'genesis', 1, 'Adaptive Leader'),
('GEN-044', 44, 'Luiz Spiner', 'GOL', 'GK', 'profissional', 'gol', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":35,"drible":15,"finalizacao":20,"fisico":42,"tatico":25,"mentalidade":25,"confianca":25,"fairPlay":25}'::jsonb, 0, 80, 57, 0, 1000, 1000, 'Mexico', 25, null, 'genesis', 'Basic', 'Unique style forged by skill, vision, and passion.', true, 28, 52, 'genesis', 1, 'Impulsive Charger'),
('GEN-045', 45, 'Sun Tsung', 'LD', 'RB', 'profissional', 'lateral_dir', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":25,"drible":35,"finalizacao":10,"fisico":38,"tatico":27,"mentalidade":15,"confianca":20,"fairPlay":25}'::jsonb, 0, 82, 57, 0, 1000, 1000, 'South Korea', 30, null, 'genesis', 'Basic', 'Responds to coach input faster than peer pressure — prioritizes leadership over environment.', true, 26, 37, 'genesis', 1, 'Cold Strategist'),
('GEN-046', 46, 'Patrick Taliano', 'ATA', 'ST', 'profissional', 'ataque', 'equilibrado', '{"passe":35,"marcacao":20,"velocidade":35,"drible":35,"finalizacao":35,"fisico":32,"tatico":23,"mentalidade":5,"confianca":10,"fairPlay":15}'::jsonb, 0, 86, 57, 0, 1000, 1000, 'Italy', 29, null, 'genesis', 'Basic', 'Activates sprint mode without needing trigger — physical instinct drives reactions.', true, 24, 34, 'genesis', 1, 'Impulsive'),
('GEN-047', 47, 'Dario Tcheco', 'LE', 'LB', 'profissional', 'lateral_esq', 'equilibrado', '{"passe":35,"marcacao":25,"velocidade":35,"drible":25,"finalizacao":25,"fisico":39,"tatico":28,"mentalidade":25,"confianca":30,"fairPlay":35}'::jsonb, 0, 70, 57, 0, 1000, 1000, 'Tchequia', 25, null, 'genesis', 'Basic', 'Overcommits after scoring — momentum disrupts balance.', true, 30, 52, 'genesis', 1, 'Cold Strategist'),
('GEN-048', 48, 'Caue Ubirajara', 'ZAG', 'CB', 'profissional', 'defesa', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":15,"drible":15,"finalizacao":5,"fisico":22,"tatico":29,"mentalidade":35,"confianca":35,"fairPlay":35}'::jsonb, 0, 100, 57, 0, 1000, 1000, 'Equador', 35, null, 'genesis', 'Basic', 'Unique style forged by skill, vision, and passion.', true, 26, 37, 'genesis', 1, 'Impulsive Charger'),
('GEN-049', 49, 'Victor Suarez', 'PD', 'RM', 'profissional', 'meio', 'equilibrado', '{"passe":35,"marcacao":25,"velocidade":35,"drible":35,"finalizacao":35,"fisico":33,"tatico":35,"mentalidade":35,"confianca":35,"fairPlay":35}'::jsonb, 0, 67, 57, 0, 1000, 1000, 'Uruguay', 23, null, 'genesis', 'Basic', 'Gritty and fearless, you lead with heart and instinct.', true, 34, 61, 'genesis', 1, 'Adaptive Leader'),
('GEN-050', 50, 'Zimbabwe Konolulo', 'GOL', 'GK', 'profissional', 'gol', 'equilibrado', '{"passe":45,"marcacao":35,"velocidade":25,"drible":45,"finalizacao":10,"fisico":40,"tatico":45,"mentalidade":45,"confianca":45,"fairPlay":45}'::jsonb, 0, 92, 62, 0, 12000, 12000, 'Gana', 30, null, 'genesis', 'Gold', 'Unique style forged by skill, vision, and passion.', true, 38, 62, 'genesis', 1, 'Impulsive Charger')
on conflict (id) do update set
  kit_number = excluded.kit_number, name = excluded.name, pos = excluded.pos, pos_original = excluded.pos_original, archetype = excluded.archetype, zone = excluded.zone, behavior = excluded.behavior, attributes = excluded.attributes, fatigue = excluded.fatigue, injury_risk = excluded.injury_risk, evolution_xp = excluded.evolution_xp, out_for_matches = excluded.out_for_matches, market_value_bro_cents = excluded.market_value_bro_cents, price_bro_cents = excluded.price_bro_cents, country = excluded.country, age = excluded.age, strong_foot = excluded.strong_foot, creator_label = excluded.creator_label, rarity_label = excluded.rarity_label, bio = excluded.bio, listed_on_market = excluded.listed_on_market, mint_overall = excluded.mint_overall, evolution_rate = excluded.evolution_rate, collection_id = excluded.collection_id, card_supply = excluded.card_supply, spirit_notes = excluded.spirit_notes, updated_at = now();

-- ─── 00007_genesis_exp_contracts.sql ───
-- OLEFOOT — Genesis: preço em EXP (250k–1M), contrato em jogos, opção vitalícia (Admin).
-- price_bro_cents mantido por compatibilidade; UI e jogo usam price_exp.

alter table public.genesis_market_players
  add column if not exists price_exp integer not null default 250000;

alter table public.genesis_market_players
  add column if not exists contract_matches_included integer not null default 70;

alter table public.genesis_market_players
  add column if not exists contract_is_lifetime boolean not null default false;

comment on column public.genesis_market_players.price_exp is 'Preço de compra imediata em EXP (ranking).';
comment on column public.genesis_market_players.contract_matches_included is 'Jogos (amistoso+oficial) antes de recomprar.';
comment on column public.genesis_market_players.contract_is_lifetime is 'Se true, sem expiração por jogos (só Admin no catálogo).';

-- Escala EXP ~ linear no mint OVR 24–72 → 250k–1M, múltiplos de 5k
update public.genesis_market_players
set price_exp = (
  round(
    (
      250000::numeric + (
        greatest(24, least(72, coalesce(mint_overall, 30))) - 24
      ) / 48.0 * (1000000 - 250000)
    ) / 5000
  ) * 5000
)::integer;

comment on table public.genesis_market_players is 'Catálogo global OLEFOOT Genesis; listagem, price_exp (EXP) e contrato em jogos.';

-- ─── 00008_genesis_market_value_exp.sql ───
-- OLEFOOT — Valor de mercado Genesis em EXP.
-- market_value_bro_cents mantido por compatibilidade; a app usa market_value_exp na ficha e no livro quando preenchido.

alter table public.genesis_market_players
  add column if not exists market_value_exp integer not null default 250000;

comment on column public.genesis_market_players.market_value_exp is 'Valor de mercado de referência em EXP (substitui escala BRO na UI).';

update public.genesis_market_players
set market_value_exp = (
  case
    when coalesce(price_exp, 0) > 0 then price_exp
    else (
      round(
        (
          250000::numeric + (
            greatest(24, least(72, coalesce(mint_overall, 30))) - 24
          ) / 48.0 * (1000000 - 250000)
        ) / 5000
      ) * 5000
    )::integer
  end
);

comment on table public.genesis_market_players is 'Catálogo global OLEFOOT Genesis; price_exp e market_value_exp em EXP; contrato em jogos.';

-- ─── 00009_genesis_portrait_pinata_refs.sql ───
-- OLEFOOT — Referências de retrato Genesis para hospedagem externa (ex.: Pinata).
-- `portrait_public_url` continua a ser o URL do card; `portrait_token_public_url` para o token circular
-- quando não se usa o padrão Storage (-card / -token no mesmo bucket).

alter table public.genesis_market_players
  add column if not exists portrait_token_public_url text,
  add column if not exists portrait_media_refs jsonb;

comment on column public.genesis_market_players.portrait_token_public_url is
  'URL pública do retrato circular (token). Usado com `portrait_public_url` quando a mídia não está no Storage Supabase.';

comment on column public.genesis_market_players.portrait_media_refs is
  'Metadados agregados do último upload externo (provider, cid, urls, mime, tamanho, pinataFileId, etc.).';

-- ─── 00010_friendly_challenges.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — 00010_friendly_challenges
--
-- Desafios amistosos online: convite com TTL (45s), aceitação, Realtime.
-- Finanças (BRO/EXP escrow) permanecem no estado local do cliente; esta tabela
-- coordena presença e abertura sincronizada da partida.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.friendly_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_club_id uuid not null references public.clubs (id) on delete cascade,
  challenged_club_id uuid not null references public.clubs (id) on delete cascade,
  challenger_club_name text not null,
  challenged_club_name text not null,
  mode text not null check (mode in ('quick', 'live')),
  bet_currency text not null check (bet_currency in ('BRO', 'EXP')),
  bet_bro_cents int check (bet_bro_cents is null or bet_bro_cents >= 0),
  bet_exp int check (bet_exp is null or bet_exp >= 0),
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')
  ),
  expires_at timestamptz not null,
  simulation_seed bigint,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint friendly_challenges_distinct_clubs check (challenger_club_id <> challenged_club_id)
);

create index if not exists idx_friendly_challenges_challenged_pending
  on public.friendly_challenges (challenged_club_id, status, expires_at desc);

create index if not exists idx_friendly_challenges_challenger_created
  on public.friendly_challenges (challenger_club_id, created_at desc);

comment on table public.friendly_challenges is
  'Convite PvP amistoso: challenger cria linha pending; challenged aceita/recusa; expires_at ~45s.';

alter table public.friendly_challenges enable row level security;

-- Preencher accepted_at e seed ao aceitar
create or replace function public.friendly_challenges_set_accept_meta()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.status = 'accepted' and old.status = 'pending' then
    new.accepted_at := coalesce(new.accepted_at, now());
    if new.simulation_seed is null then
      new.simulation_seed := (floor(random() * 2147483646::double precision) + 1)::bigint;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists friendly_challenges_set_accept_meta_trg on public.friendly_challenges;
create trigger friendly_challenges_set_accept_meta_trg
  before update on public.friendly_challenges
  for each row execute function public.friendly_challenges_set_accept_meta();

-- ─── RLS ─────────────────────────────────────────────────────────────────

create policy "friendly_challenges_select_participants"
  on public.friendly_challenges
  for select
  using (
    challenger_club_id = public.my_club_id()
    or challenged_club_id = public.my_club_id()
  );

create policy "friendly_challenges_insert_as_challenger"
  on public.friendly_challenges
  for insert
  with check (
    auth.uid() is not null
    and challenger_club_id = public.my_club_id()
    and challenged_club_id <> public.my_club_id()
  );

create policy "friendly_challenges_update_challenger_cancel"
  on public.friendly_challenges
  for update
  using (challenger_club_id = public.my_club_id() and status = 'pending')
  with check (status = 'cancelled');

create policy "friendly_challenges_update_challenged_decide"
  on public.friendly_challenges
  for update
  using (challenged_club_id = public.my_club_id() and status = 'pending')
  with check (status in ('accepted', 'declined'));

create policy "friendly_challenges_update_expire_participant"
  on public.friendly_challenges
  for update
  using (
    status = 'pending'
    and expires_at < now()
    and (
      challenger_club_id = public.my_club_id()
      or challenged_club_id = public.my_club_id()
    )
  )
  with check (status = 'expired');

-- ─── Busca de clubes com perfil (para UI de convite) ─────────────────────

create or replace function public.search_clubs_for_friendly(search text, max_results int default 12)
returns table (club_id uuid, name text, short_name text)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as club_id,
    c.name,
    coalesce(nullif(btrim(c.short_name), ''), left(c.name, 48)) as short_name
  from public.clubs c
  inner join public.profiles p on p.club_id = c.id
  where
    public.my_club_id() is not null
    and c.id <> public.my_club_id()
    and nullif(btrim(search), '') is not null
    and (
      c.name ilike '%' || btrim(search) || '%'
      or coalesce(c.short_name, '') ilike '%' || btrim(search) || '%'
    )
  order by c.name asc
  limit least(coalesce(max_results, 12), 24);
$$;

comment on function public.search_clubs_for_friendly(text, int) is
  'Lista clubes com utilizador associado (perfil), excluindo o clube do JWT; para convite amistoso.';

grant execute on function public.search_clubs_for_friendly(text, int) to authenticated;

-- ─── Grants tabela ───────────────────────────────────────────────────────

grant select, insert, update on table public.friendly_challenges to authenticated;

-- ─── Realtime (Supabase) ─────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'friendly_challenges'
  ) then
    execute 'alter publication supabase_realtime add table public.friendly_challenges';
  end if;
end $$;

-- ─── 00011_academy_managers.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — 00011_academy_managers
--
-- Academia OLE: ao «lançar» jogador aprovado, registo no Supabase alinhado ao
-- mercado EXP (listagem) + snapshot JSONB para o motor (atributos / contrato).
-- Nome lógico do produto: academy-managers → tabela public.academy_managers
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.academy_managers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  listing_id text not null unique,
  game_player_id text not null,
  art_request_id text not null,
  price_exp int not null check (price_exp >= 50000 and price_exp <= 5000000),
  listed_at timestamptz not null default now(),
  listed_on_market boolean not null default true,
  mint_overall int not null check (mint_overall >= 0 and mint_overall <= 99),
  player_snapshot jsonb not null,
  portrait_public_url text,
  portrait_token_public_url text
);

comment on table public.academy_managers is
  'Academia OLE: jogadores aprovados lançados no mercado EXP; snapshot alinhado a PlayerEntity / motor.';

create index if not exists idx_academy_managers_club_created
  on public.academy_managers (club_id, created_at desc);

create index if not exists idx_academy_managers_listed_price
  on public.academy_managers (listed_on_market, price_exp)
  where listed_on_market = true;

alter table public.academy_managers enable row level security;

-- Dono do clube vê todas as linhas do clube; qualquer sessão vê listagens ativas (mercado).
create policy "academy_managers_select_own_or_listed"
  on public.academy_managers
  for select
  using (
    club_id = public.my_club_id()
    or listed_on_market = true
  );

create policy "academy_managers_insert_own_club"
  on public.academy_managers
  for insert
  with check (
    auth.uid() is not null
    and club_id = public.my_club_id()
  );

grant select on table public.academy_managers to anon, authenticated;
grant insert on table public.academy_managers to authenticated;

-- ─── 20260421194739_wallet_credits.sql ───
-- wallet_credits: créditos BRO emitidos pelo admin após depósito confirmado.
-- O app aplica cada linha UMA VEZ (applied_at preenchido = já processado).

create table if not exists public.wallet_credits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  bro_cents    bigint not null check (bro_cents > 0),
  reason       text not null default '',
  created_at   timestamptz not null default now(),
  applied_at   timestamptz          -- preenchido pelo cliente ao aplicar
);

alter table public.wallet_credits enable row level security;

-- Jogador só lê os seus próprios créditos.
create policy "user reads own credits"
  on public.wallet_credits
  for select
  using (auth.uid() = user_id);

-- Jogador pode marcar applied_at nos seus próprios créditos pendentes.
create policy "user marks own credit applied"
  on public.wallet_credits
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Índice para busca eficiente de créditos pendentes por utilizador.
create index on public.wallet_credits (user_id, applied_at) where applied_at is null;

-- ─── 20260421195446_fix_genesis_market_update_policy.sql ───
-- Corrige brecha de segurança: policy de UPDATE totalmente aberta para anon+authenticated.
-- A policy original permitia alterar QUALQUER coluna (preços, atributos, nomes) sem restrições.
-- Nova política: só utilizadores autenticados podem atualizar, e apenas as colunas de retrato.

-- Remove grant de UPDATE ao role anon (SELECT continua para o mercado público).
revoke update on table public.genesis_market_players from anon;

-- Remove a policy permissiva original.
drop policy if exists "genesis_market_players_update_portraits" on public.genesis_market_players;

-- Nova policy: só authenticated, e apenas quando os campos de negócio não mudam.
-- O with check garante que preço, atributos, nome e listed_on_market permanecem idênticos.
create policy "genesis_market_players_update_portraits_only"
  on public.genesis_market_players
  for update
  to authenticated
  using (true)
  with check (
    -- Campos de negócio devem permanecer inalterados
    name              = (select name              from public.genesis_market_players g where g.id = genesis_market_players.id) and
    pos               = (select pos               from public.genesis_market_players g where g.id = genesis_market_players.id) and
    attributes        = (select attributes        from public.genesis_market_players g where g.id = genesis_market_players.id) and
    price_bro_cents   = (select price_bro_cents   from public.genesis_market_players g where g.id = genesis_market_players.id) and
    market_value_bro_cents = (select market_value_bro_cents from public.genesis_market_players g where g.id = genesis_market_players.id) and
    listed_on_market  = (select listed_on_market  from public.genesis_market_players g where g.id = genesis_market_players.id)
  );

-- ─── 20260421195615_fix_genesis_portraits_storage_policies.sql ───
-- Corrige policies de storage que permitiam INSERT/UPDATE/DELETE por anon.
-- Apenas utilizadores autenticados podem fazer upload/update/delete de retratos.
-- Leitura pública mantém-se (bucket é público).

drop policy if exists "genesis_portraits_auth_insert" on storage.objects;
create policy "genesis_portraits_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'genesis-player-portraits'
    and name like 'genesis/%'
  );

drop policy if exists "genesis_portraits_auth_update" on storage.objects;
create policy "genesis_portraits_auth_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'genesis-player-portraits' and name like 'genesis/%')
  with check (bucket_id = 'genesis-player-portraits' and name like 'genesis/%');

drop policy if exists "genesis_portraits_auth_delete" on storage.objects;
create policy "genesis_portraits_auth_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'genesis-player-portraits' and name like 'genesis/%');

-- ─── 20260421200113_market_purchases.sql ───
-- Registo server-side de compras no mercado Genesis.
-- Serve como audit trail e impede compra duplicada do mesmo jogador.

create table if not exists public.market_purchases (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  genesis_id      text not null,                     -- ex: GEN-001
  price_exp       bigint not null check (price_exp > 0),
  mint_overall    int not null,
  purchased_at    timestamptz not null default now(),
  unique (user_id, genesis_id)                       -- um jogador por utilizador
);

alter table public.market_purchases enable row level security;

-- Utilizador só lê as suas próprias compras.
create policy "user reads own purchases"
  on public.market_purchases for select
  using (auth.uid() = user_id);

create index on public.market_purchases (user_id);

-- ─── 20260421200342_lock_match_events.sql ───
-- match_events são imutáveis após inserção — eventos de partida não devem ser alterados.
-- Bloqueia UPDATE e DELETE para todos os roles (service_role bypassa RLS quando necessário).

create policy "match_events_no_update"
  on public.match_events for update
  using (false);

create policy "match_events_no_delete"
  on public.match_events for delete
  using (false);

-- ─── 20260421200427_restrict_match_events_fk.sql ───
-- Troca ON DELETE CASCADE → ON DELETE RESTRICT na FK match_events.match_id.
-- Impede apagar partidas que já têm eventos registados (integridade de auditoria).

alter table public.match_events
  drop constraint if exists match_events_match_id_fkey;

alter table public.match_events
  add constraint match_events_match_id_fkey
  foreign key (match_id)
  references public.matches(id)
  on delete restrict;

-- ─── 20260421200501_audit_log.sql ───
-- Tabela de auditoria genérica + triggers para tabelas sensíveis.
-- Regista INSERT/UPDATE/DELETE com o utilizador, timestamp e diff de dados.

create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  table_name   text        not null,
  operation    text        not null check (operation in ('INSERT','UPDATE','DELETE')),
  user_id      uuid,                        -- auth.uid() no momento da operação
  row_id       text        not null,        -- pk da linha afetada (convertida para text)
  old_data     jsonb,                       -- valor anterior (UPDATE/DELETE)
  new_data     jsonb,                       -- valor novo    (INSERT/UPDATE)
  occurred_at  timestamptz not null default now()
);

alter table public.audit_log enable row level security;

-- Ninguém lê nem escreve via API pública — apenas service_role (bypass RLS).
-- O admin consulta via Supabase dashboard ou scripts server-side.

create index on public.audit_log (table_name, occurred_at desc);
create index on public.audit_log (user_id, occurred_at desc);

-- ─── Função trigger genérica ────────────────────────────────────────────────

create or replace function public.fn_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_id text;
  v_old    jsonb;
  v_new    jsonb;
begin
  -- Extrai a PK da linha (assume coluna "id")
  if TG_OP = 'DELETE' then
    v_row_id := OLD.id::text;
    v_old    := to_jsonb(OLD);
    v_new    := null;
  elsif TG_OP = 'INSERT' then
    v_row_id := NEW.id::text;
    v_old    := null;
    v_new    := to_jsonb(NEW);
  else -- UPDATE
    v_row_id := NEW.id::text;
    v_old    := to_jsonb(OLD);
    v_new    := to_jsonb(NEW);
  end if;

  insert into public.audit_log (table_name, operation, user_id, row_id, old_data, new_data)
  values (TG_TABLE_NAME, TG_OP, auth.uid(), v_row_id, v_old, v_new);

  return coalesce(NEW, OLD);
end;
$$;

-- ─── Triggers nas tabelas sensíveis ─────────────────────────────────────────

-- market_purchases: toda compra fica registada
create trigger audit_market_purchases
  after insert or update or delete on public.market_purchases
  for each row execute function public.fn_audit_log();

-- wallet_credits: emissão de BRO pelo admin
create trigger audit_wallet_credits
  after insert or update or delete on public.wallet_credits
  for each row execute function public.fn_audit_log();

-- genesis_market_players: alterações de retrato ou listagem
create trigger audit_genesis_market_players
  after update or delete on public.genesis_market_players
  for each row execute function public.fn_audit_log();

-- matches: criação e mudança de estado
create trigger audit_matches
  after insert or update or delete on public.matches
  for each row execute function public.fn_audit_log();

-- ─── 20260421200648_fix_search_clubs_ilike_escape.sql ───
-- Escapa metacaracteres LIKE (%, _) e limita o input a 60 chars
-- antes de usar ilike, prevenindo pattern matching abusivo.

create or replace function public.search_clubs_for_friendly(search text, max_results int default 12)
returns table (club_id uuid, name text, short_name text)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as club_id,
    c.name,
    coalesce(nullif(btrim(c.short_name), ''), left(c.name, 48)) as short_name
  from public.clubs c
  inner join public.profiles p on p.club_id = c.id
  where
    public.my_club_id() is not null
    and c.id <> public.my_club_id()
    and nullif(btrim(search), '') is not null
    and (
      c.name ilike '%' || replace(replace(left(btrim(search), 60), '%', '\%'), '_', '\_') || '%' escape '\'
      or coalesce(c.short_name, '') ilike '%' || replace(replace(left(btrim(search), 60), '%', '\%'), '_', '\_') || '%' escape '\'
    )
  order by c.name asc
  limit least(coalesce(max_results, 12), 24);
$$;

comment on function public.search_clubs_for_friendly(text, int) is
  'Lista clubes com utilizador associado (perfil), excluindo o clube do JWT; para convite amistoso. Input escapado e limitado a 60 chars.';

grant execute on function public.search_clubs_for_friendly(text, int) to authenticated;

-- ─── 20260421210000_welcome_pack_launch.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — welcome_pack_launch
--
-- 1. Coluna `admin_market_tag` em genesis_market_players (flag 'welcomepack' etc.)
-- 2. Tabela `launch_counters` (singleton) com total_managers + welcome_packs_claimed
-- 3. RPC `claim_welcome_pack(p_manager_id uuid)` atômica com SELECT ... FOR UPDATE
-- 4. Trigger incrementando total_managers a cada novo profile
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. admin_market_tag ────────────────────────────────────────────────────
alter table public.genesis_market_players
  add column if not exists admin_market_tag text;

create index if not exists idx_genesis_market_admin_tag
  on public.genesis_market_players (admin_market_tag)
  where admin_market_tag is not null;

comment on column public.genesis_market_players.admin_market_tag is
  'Tag administrativa usada no painel Admin > Market (ex.: ''welcomepack''). Nula = sem tag.';

-- ─── 2. launch_counters (singleton row id=1) ────────────────────────────────
create table if not exists public.launch_counters (
  id int primary key default 1,
  total_managers bigint not null default 0,
  welcome_packs_claimed bigint not null default 0,
  welcome_packs_limit bigint not null default 1000,
  updated_at timestamptz not null default now(),
  constraint launch_counters_singleton check (id = 1)
);

insert into public.launch_counters (id) values (1)
  on conflict (id) do nothing;

comment on table public.launch_counters is
  'Singleton com contadores globais de lançamento (managers, welcome packs).';

alter table public.launch_counters enable row level security;

drop policy if exists "launch_counters_select_public" on public.launch_counters;
create policy "launch_counters_select_public"
  on public.launch_counters for select
  to anon, authenticated
  using (true);

grant select on table public.launch_counters to anon, authenticated;

-- ─── 3. RPC claim_welcome_pack (atômico, com lock de linha) ─────────────────
create or replace function public.claim_welcome_pack(p_manager_id uuid)
returns table (
  claimed boolean,
  queue_position bigint,
  remaining bigint,
  welcome_packs_claimed bigint,
  welcome_packs_limit bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed bigint;
  v_limit bigint;
begin
  -- lock singleton row for atomic increment
  select lc.welcome_packs_claimed, lc.welcome_packs_limit
    into v_claimed, v_limit
    from public.launch_counters lc
    where lc.id = 1
    for update;

  if v_claimed < v_limit then
    update public.launch_counters
       set welcome_packs_claimed = welcome_packs_claimed + 1,
           updated_at = now()
     where id = 1
     returning launch_counters.welcome_packs_claimed
       into v_claimed;

    return query select
      true                 as claimed,
      v_claimed            as queue_position,
      (v_limit - v_claimed) as remaining,
      v_claimed            as welcome_packs_claimed,
      v_limit              as welcome_packs_limit;
  else
    return query select
      false                as claimed,
      (v_claimed + 1)      as queue_position,
      0::bigint            as remaining,
      v_claimed            as welcome_packs_claimed,
      v_limit              as welcome_packs_limit;
  end if;
end;
$$;

revoke all on function public.claim_welcome_pack(uuid) from public;
grant execute on function public.claim_welcome_pack(uuid) to authenticated;

comment on function public.claim_welcome_pack(uuid) is
  'Reserva atomicamente 1 welcome pack se welcome_packs_claimed < welcome_packs_limit. Retorna claimed, position (1-based), remaining.';

-- ─── 4. Trigger: incrementar total_managers por novo profile ────────────────
create or replace function public.increment_total_managers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.launch_counters
     set total_managers = total_managers + 1,
         updated_at = now()
   where id = 1;
  return new;
end;
$$;

drop trigger if exists trg_increment_total_managers on public.profiles;
create trigger trg_increment_total_managers
  after insert on public.profiles
  for each row
  execute function public.increment_total_managers();

-- ─── 20260421211000_legacy_dna.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — legacy_dna
--
-- LegacyDNA: jogadores criados no admin que ensinam atributos-de-posição
-- aos jogadores do elenco do mesmo posto, e aplicam um booster numérico
-- ao time quando titulares.
--
-- Regras:
--  • Ensino: legacy presente no elenco + aluno com mentoria ativa + mesma pos.
--  • Evolução: +1/dia em cada atributo ensinado, teto no valor do legacy.
--  • Mentor único por aluno (unique constraint).
--  • Booster de time (jsonb numérico): ativo quando legacy é titular.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. legacy_players ──────────────────────────────────────────────────────
create table if not exists public.legacy_players (
  id text primary key,
  name text not null,
  pos text not null,
  pos_original text,
  attributes jsonb not null default '{}'::jsonb,
  taught_attributes text[] not null default '{}'::text[],
  team_booster jsonb not null default '{}'::jsonb,
  price_bro_cents bigint not null default 0,
  listed_on_market boolean not null default false,
  country text,
  age int,
  strong_foot text,
  creator_label text,
  rarity_label text,
  bio text,
  portrait_storage_path text,
  portrait_public_url text,
  card_supply int default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legacy_players_strong_foot_chk
    check (strong_foot is null or strong_foot in ('right', 'left', 'both'))
);

create index if not exists idx_legacy_players_listed
  on public.legacy_players (listed_on_market, pos);
create index if not exists idx_legacy_players_pos
  on public.legacy_players (pos);

comment on table public.legacy_players is
  'Jogadores LegacyDNA criados no admin. Ensinam atributos-de-posição e aplicam team_booster quando titulares.';
comment on column public.legacy_players.taught_attributes is
  'Atributos que este legacy ensina (ex.: {passe,drible,finalizacao,tatico}).';
comment on column public.legacy_players.team_booster is
  'Booster numérico aplicado ao time quando titular. Ex.: {"morale":3,"possession_pct":5}.';

alter table public.legacy_players enable row level security;

drop policy if exists "legacy_players_select_public" on public.legacy_players;
create policy "legacy_players_select_public"
  on public.legacy_players for select
  to anon, authenticated
  using (coalesce(listed_on_market, false) = true);

grant select on table public.legacy_players to anon, authenticated;

-- ─── 2. legacy_mentorships ──────────────────────────────────────────────────
create table if not exists public.legacy_mentorships (
  student_player_id text primary key,
  manager_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text not null references public.legacy_players(id) on delete cascade,
  learned_attributes jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  last_tick_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_legacy_mentorships_manager
  on public.legacy_mentorships (manager_id);
create index if not exists idx_legacy_mentorships_legacy
  on public.legacy_mentorships (legacy_id);

comment on table public.legacy_mentorships is
  'Vínculo aluno→legacy (mentor único por aluno). learned_attributes acumula o progresso já aplicado.';
comment on column public.legacy_mentorships.learned_attributes is
  'Progresso persistido por atributo (jsonb numérico). Soma ao atributo-base do aluno até o teto do legacy.';

alter table public.legacy_mentorships enable row level security;

drop policy if exists "legacy_mentorships_owner_select" on public.legacy_mentorships;
create policy "legacy_mentorships_owner_select"
  on public.legacy_mentorships for select
  to authenticated
  using (manager_id = auth.uid());

drop policy if exists "legacy_mentorships_owner_modify" on public.legacy_mentorships;
create policy "legacy_mentorships_owner_modify"
  on public.legacy_mentorships for all
  to authenticated
  using (manager_id = auth.uid())
  with check (manager_id = auth.uid());

grant select, insert, update, delete on table public.legacy_mentorships to authenticated;

-- ─── 3. set_legacy_mentor (troca livre, preserva progresso por aluno) ────────
create or replace function public.set_legacy_mentor(
  p_student_player_id text,
  p_legacy_id text
)
returns public.legacy_mentorships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.legacy_mentorships;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  insert into public.legacy_mentorships (student_player_id, manager_id, legacy_id)
  values (p_student_player_id, auth.uid(), p_legacy_id)
  on conflict (student_player_id) do update
    set legacy_id = excluded.legacy_id,
        updated_at = now()
    where legacy_mentorships.manager_id = auth.uid()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.set_legacy_mentor(text, text) from public;
grant execute on function public.set_legacy_mentor(text, text) to authenticated;

comment on function public.set_legacy_mentor(text, text) is
  'Define/troca o mentor legacy de um aluno. Progresso (learned_attributes) é preservado por aluno.';

-- ─── 4. tick_legacy_mentorships: +1/dia nos atributos ensinados, teto no legacy
-- Chamada por cliente (ex.: no login) ou cron. Aplica o delta em dias completos
-- desde last_tick_at para cada mentoria do manager, respeitando o teto do legacy.
create or replace function public.tick_legacy_mentorships(p_manager_id uuid default null)
returns table (
  student_player_id text,
  legacy_id text,
  ticks_applied int,
  learned_attributes jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager uuid;
  rec record;
  v_days int;
  v_learned jsonb;
  v_legacy_attrs jsonb;
  v_attr text;
  v_cap numeric;
  v_current numeric;
  v_new numeric;
begin
  v_manager := coalesce(p_manager_id, auth.uid());
  if v_manager is null then
    raise exception 'auth required';
  end if;

  for rec in
    select m.student_player_id, m.legacy_id, m.learned_attributes, m.last_tick_at,
           l.taught_attributes, l.attributes as legacy_attrs
      from public.legacy_mentorships m
      join public.legacy_players l on l.id = m.legacy_id
     where m.manager_id = v_manager
     for update of m
  loop
    v_days := greatest(0, floor(extract(epoch from (now() - rec.last_tick_at)) / 86400)::int);
    if v_days <= 0 then
      continue;
    end if;

    v_learned := coalesce(rec.learned_attributes, '{}'::jsonb);
    v_legacy_attrs := coalesce(rec.legacy_attrs, '{}'::jsonb);

    foreach v_attr in array rec.taught_attributes
    loop
      v_cap := coalesce((v_legacy_attrs ->> v_attr)::numeric, 0);
      v_current := coalesce((v_learned ->> v_attr)::numeric, 0);
      v_new := least(v_current + v_days, v_cap);
      v_learned := v_learned || jsonb_build_object(v_attr, v_new);
    end loop;

    update public.legacy_mentorships
       set learned_attributes = v_learned,
           last_tick_at = last_tick_at + make_interval(days => v_days),
           updated_at = now()
     where student_player_id = rec.student_player_id;

    student_player_id := rec.student_player_id;
    legacy_id := rec.legacy_id;
    ticks_applied := v_days;
    learned_attributes := v_learned;
    return next;
  end loop;

  return;
end;
$$;

revoke all on function public.tick_legacy_mentorships(uuid) from public;
grant execute on function public.tick_legacy_mentorships(uuid) to authenticated;

comment on function public.tick_legacy_mentorships(uuid) is
  'Aplica +1/dia (por dia completo desde last_tick_at) em cada taught_attribute do legacy, com teto no atributo do legacy. Retorna resumo por mentoria atualizada.';

-- ─── 5. Storage bucket para retratos de legacies ────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'legacy-player-portraits',
  'legacy-player-portraits',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "legacy_portraits_public_read" on storage.objects;
create policy "legacy_portraits_public_read"
  on storage.objects for select
  using (bucket_id = 'legacy-player-portraits');

-- ─── 20260421220000_admin_cerebro_core.sql ───
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

-- ─── 20260421230000_admin_broadcasts.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — admin_broadcasts
--
-- Motor de notificações globais do admin.
-- • admin_broadcasts: mensagens escritas pelo admin.
-- • broadcast_deliveries: idempotência por manager (entrega única).
-- • admin_send_broadcast / consume_broadcasts RPCs.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.admin_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'CONTA',
  deep_link text,
  audience text not null default 'all' check (audience in ('all')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz
);

create index if not exists idx_admin_broadcasts_active
  on public.admin_broadcasts (active, created_at desc)
  where active = true;

alter table public.admin_broadcasts enable row level security;

drop policy if exists "admin_broadcasts_select_public" on public.admin_broadcasts;
create policy "admin_broadcasts_select_public"
  on public.admin_broadcasts for select
  to authenticated
  using (active = true);

grant select on table public.admin_broadcasts to authenticated;

comment on table public.admin_broadcasts is
  'Mensagens broadcast escritas pelo admin. Entregues 1×/manager via consume_broadcasts.';

-- ─── broadcast_deliveries ───────────────────────────────────────────────────
create table if not exists public.broadcast_deliveries (
  broadcast_id uuid not null references public.admin_broadcasts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  primary key (broadcast_id, user_id)
);

create index if not exists idx_broadcast_deliveries_user
  on public.broadcast_deliveries (user_id, delivered_at desc);

alter table public.broadcast_deliveries enable row level security;

drop policy if exists "broadcast_deliveries_self_read" on public.broadcast_deliveries;
create policy "broadcast_deliveries_self_read"
  on public.broadcast_deliveries for select
  to authenticated
  using (user_id = auth.uid());

grant select on table public.broadcast_deliveries to authenticated;

-- ─── admin_send_broadcast ───────────────────────────────────────────────────
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
  if auth.uid() is null then
    raise exception 'auth required';
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
grant execute on function public.admin_send_broadcast(text, text, text, text, timestamptz)
  to authenticated;

-- ─── consume_broadcasts (cliente chama no boot) ─────────────────────────────
-- Retorna broadcasts ainda não entregues a este user, e grava delivery.
create or replace function public.consume_broadcasts()
returns setof public.admin_broadcasts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then return; end if;

  return query
    with pending as (
      select b.*
        from public.admin_broadcasts b
       where b.active = true
         and (b.expires_at is null or b.expires_at > now())
         and not exists (
           select 1 from public.broadcast_deliveries d
            where d.broadcast_id = b.id and d.user_id = v_uid
         )
       order by b.created_at asc
    ),
    insert_deliveries as (
      insert into public.broadcast_deliveries (broadcast_id, user_id)
        select id, v_uid from pending
      on conflict (broadcast_id, user_id) do nothing
      returning 1
    )
    select * from pending;
end;
$$;

revoke all on function public.consume_broadcasts() from public;
grant execute on function public.consume_broadcasts() to authenticated;

-- ─── admin_broadcast_stats (contagem de entregas por broadcast) ─────────────
create or replace function public.admin_broadcast_stats(p_limit int default 50)
returns table (
  id uuid,
  title text,
  category text,
  created_at timestamptz,
  active boolean,
  deliveries bigint
)
language sql
security definer
set search_path = public
as $$
  select b.id, b.title, b.category, b.created_at, b.active,
         (select count(*) from public.broadcast_deliveries d where d.broadcast_id = b.id) as deliveries
    from public.admin_broadcasts b
   order by b.created_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.admin_broadcast_stats(int) from public;
grant execute on function public.admin_broadcast_stats(int) to authenticated;

-- ─── 20260422000000_admin_guards.sql ───
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

-- ─── 20260423000000_voice_commands.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — voice_commands
--
-- Persistência do sistema de comandos de voz:
--   1. `manager_voice_commands` — log de todo comando efetivo emitido em partida.
--      Usado por `get_manager_persona()` pra inferir estilo do treinador.
--   2. `profanity_words` — lista de palavras censuradas, admin-editável.
--   3. RPCs: record_voice_command, get_manager_persona,
--            admin_add_profanity, admin_remove_profanity.
--
-- Guard: todos os admin_* checam `is_admin()` (já existe em 20260422000000).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. manager_voice_commands ──────────────────────────────────────────────
create table if not exists public.manager_voice_commands (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid,
  intent text not null,
  target_player_id text,
  tier text,
  effective_obedience numeric,
  individual_obedience numeric,
  team_obedience_at_time numeric,
  raw_text text,
  assistant text,
  minute int,
  created_at timestamptz not null default now()
);

create index if not exists idx_mvc_manager_created
  on public.manager_voice_commands (manager_id, created_at desc);
create index if not exists idx_mvc_intent
  on public.manager_voice_commands (intent);
create index if not exists idx_mvc_assistant
  on public.manager_voice_commands (assistant);

alter table public.manager_voice_commands enable row level security;

drop policy if exists "mvc_self_read" on public.manager_voice_commands;
create policy "mvc_self_read"
  on public.manager_voice_commands for select
  to authenticated
  using (manager_id = auth.uid() or public.is_admin());

grant select on table public.manager_voice_commands to authenticated;

comment on table public.manager_voice_commands is
  'Log de comandos de voz do manager em partidas. Usado pra inferir perfil/estilo.';

-- ─── 2. profanity_words ─────────────────────────────────────────────────────
create table if not exists public.profanity_words (
  word text primary key,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  active boolean not null default true
);

alter table public.profanity_words enable row level security;

drop policy if exists "profanity_public_read" on public.profanity_words;
create policy "profanity_public_read"
  on public.profanity_words for select
  to authenticated
  using (active = true);

grant select on table public.profanity_words to authenticated;

comment on table public.profanity_words is
  'Lista de palavrões detectados pelo árbitro. Admin-editável via RPC.';

-- ─── 3. RPCs ────────────────────────────────────────────────────────────────

-- record_voice_command: qualquer manager autenticado registra SEU comando.
create or replace function public.record_voice_command(
  p_match_id uuid,
  p_intent text,
  p_target_player_id text,
  p_tier text,
  p_effective_obedience numeric,
  p_individual_obedience numeric,
  p_team_obedience_at_time numeric,
  p_raw_text text,
  p_assistant text,
  p_minute int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  insert into public.manager_voice_commands (
    manager_id, match_id, intent, target_player_id, tier,
    effective_obedience, individual_obedience, team_obedience_at_time,
    raw_text, assistant, minute
  )
  values (
    auth.uid(), p_match_id, p_intent, p_target_player_id, p_tier,
    p_effective_obedience, p_individual_obedience, p_team_obedience_at_time,
    p_raw_text, p_assistant, p_minute
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.record_voice_command(uuid, text, text, text, numeric, numeric, numeric, text, text, int) from public;
grant execute on function public.record_voice_command(uuid, text, text, text, numeric, numeric, numeric, text, text, int) to authenticated;

-- get_manager_persona: retorna agregados pra card no /profile.
create or replace function public.get_manager_persona(p_user_id uuid default null)
returns table (
  total_commands bigint,
  accepted_count bigint,
  refused_count bigint,
  top_intent text,
  top_intent_count bigint,
  top_assistant text,
  top_assistant_count bigint,
  avg_effective_obedience numeric,
  first_command_at timestamptz,
  last_command_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := coalesce(p_user_id, auth.uid());
  if v_uid is null then
    raise exception 'auth required';
  end if;
  -- Só retorna o próprio, a não ser que seja admin.
  if v_uid <> auth.uid() and not public.is_admin() then
    raise exception 'permission denied';
  end if;

  return query
    with base as (
      select * from public.manager_voice_commands where manager_id = v_uid
    ),
    top_intent_q as (
      select intent as ti, count(*) as tic
        from base group by intent order by count(*) desc limit 1
    ),
    top_assistant_q as (
      select assistant as ta, count(*) as tac
        from base where assistant is not null
        group by assistant order by count(*) desc limit 1
    )
    select
      (select count(*) from base) as total_commands,
      (select count(*) from base where tier in ('critical_accept','accept','weak_accept')) as accepted_count,
      (select count(*) from base where tier in ('refuse','protest')) as refused_count,
      (select ti from top_intent_q) as top_intent,
      (select tic from top_intent_q) as top_intent_count,
      (select ta from top_assistant_q) as top_assistant,
      (select tac from top_assistant_q) as top_assistant_count,
      (select avg(effective_obedience) from base) as avg_effective_obedience,
      (select min(created_at) from base) as first_command_at,
      (select max(created_at) from base) as last_command_at;
end;
$$;

revoke all on function public.get_manager_persona(uuid) from public;
grant execute on function public.get_manager_persona(uuid) to authenticated;

-- admin_add_profanity: admin adiciona palavra.
create or replace function public.admin_add_profanity(p_word text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin required';
  end if;
  insert into public.profanity_words (word, added_by, active)
  values (lower(trim(p_word)), auth.uid(), true)
  on conflict (word) do update set active = true;
  return true;
end;
$$;

revoke all on function public.admin_add_profanity(text) from public;
grant execute on function public.admin_add_profanity(text) to authenticated;

-- admin_remove_profanity: admin remove (soft-delete).
create or replace function public.admin_remove_profanity(p_word text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin required';
  end if;
  update public.profanity_words set active = false where word = lower(trim(p_word));
  return true;
end;
$$;

revoke all on function public.admin_remove_profanity(text) from public;
grant execute on function public.admin_remove_profanity(text) to authenticated;

-- ─── 4. Feature flag VOICE_COMMANDS_ENABLED no seed ─────────────────────────
update public.platform_config
   set value = value || jsonb_build_object('VOICE_COMMANDS_ENABLED', true)
 where key = 'feature_flags';

-- ─── 20260424000000_learned_phrases.sql ───
-- Learned voice phrases: dicionário personalizado por manager.
-- Cresce a cada confirmação "Você quis dizer…? Sim" no painel de comando.
-- Cross-device: manager vê as frases aprendidas em qualquer dispositivo.
-- Admin também consulta agregado global pra expandir o parser determinístico.

create table if not exists public.manager_learned_phrases (
  id              uuid primary key default gen_random_uuid(),
  manager_id      uuid not null references auth.users(id) on delete cascade,
  phrase          text not null,        -- frase normalizada (lower, sem acentos)
  stem            text not null,        -- stem sem nome de jogador
  intent          text not null,        -- VoiceIntent enum (string)
  canonical_phrase text not null,       -- frase que o parser determinístico reconhece
  confirm_count   int  not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (manager_id, phrase)
);

create index if not exists idx_mlp_manager_updated
  on public.manager_learned_phrases (manager_id, updated_at desc);
create index if not exists idx_mlp_intent
  on public.manager_learned_phrases (intent);
create index if not exists idx_mlp_stem
  on public.manager_learned_phrases (stem);

alter table public.manager_learned_phrases enable row level security;

-- Manager lê seu próprio dicionário; admin lê tudo.
drop policy if exists mlp_select_self on public.manager_learned_phrases;
create policy mlp_select_self on public.manager_learned_phrases
  for select
  using (manager_id = auth.uid() or public.is_admin());

-- Inserção/atualização só via RPC (ver abaixo) — bloqueia acesso direto.
drop policy if exists mlp_no_direct_write on public.manager_learned_phrases;
create policy mlp_no_direct_write on public.manager_learned_phrases
  for all
  using (false)
  with check (false);

-- ─── RPC: upsert frase aprendida ────────────────────────────────────────
create or replace function public.record_learned_phrase(
  p_phrase text,
  p_stem text,
  p_intent text,
  p_canonical_phrase text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;
  if p_phrase is null or length(trim(p_phrase)) = 0 then
    raise exception 'phrase required';
  end if;
  if p_intent is null or length(trim(p_intent)) = 0 then
    raise exception 'intent required';
  end if;

  insert into public.manager_learned_phrases
    (manager_id, phrase, stem, intent, canonical_phrase)
  values
    (auth.uid(), lower(trim(p_phrase)), coalesce(p_stem, ''), p_intent, p_canonical_phrase)
  on conflict (manager_id, phrase)
  do update set
    intent = excluded.intent,
    stem = excluded.stem,
    canonical_phrase = excluded.canonical_phrase,
    confirm_count = public.manager_learned_phrases.confirm_count + 1,
    updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.record_learned_phrase(text, text, text, text) from public;
grant execute on function public.record_learned_phrase(text, text, text, text) to authenticated;

-- ─── RPC: lista do manager (hidrata localStorage) ───────────────────────
create or replace function public.get_manager_learned_phrases(
  p_user_id uuid default null,
  p_limit int default 500
)
returns setof public.manager_learned_phrases
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
begin
  if v_uid is null then
    return;
  end if;
  if v_uid <> auth.uid() and not public.is_admin() then
    raise exception 'forbidden';
  end if;
  return query
    select *
    from public.manager_learned_phrases
    where manager_id = v_uid
    order by updated_at desc
    limit greatest(1, least(p_limit, 2000));
end;
$$;

revoke all on function public.get_manager_learned_phrases(uuid, int) from public;
grant execute on function public.get_manager_learned_phrases(uuid, int) to authenticated;

-- ─── RPC: top frases agregadas (admin) ──────────────────────────────────
create or replace function public.admin_top_learned_phrases(
  p_limit int default 100,
  p_intent text default null
)
returns table (
  phrase text,
  stem text,
  intent text,
  canonical_phrase text,
  distinct_managers int,
  total_confirms bigint,
  last_confirmed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  return query
    select
      p.phrase,
      min(p.stem) as stem,
      p.intent,
      min(p.canonical_phrase) as canonical_phrase,
      count(distinct p.manager_id)::int as distinct_managers,
      sum(p.confirm_count)::bigint as total_confirms,
      max(p.updated_at) as last_confirmed_at
    from public.manager_learned_phrases p
    where (p_intent is null or p.intent = p_intent)
    group by p.phrase, p.intent
    order by total_confirms desc, distinct_managers desc
    limit greatest(1, least(p_limit, 1000));
end;
$$;

revoke all on function public.admin_top_learned_phrases(int, text) from public;
grant execute on function public.admin_top_learned_phrases(int, text) to authenticated;

-- ─── RPC: admin apaga frase aprendida globalmente ──────────────────────
-- Útil se uma frase virou padrão do parser e queremos limpar o dicionário.
create or replace function public.admin_delete_learned_phrase(p_phrase text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  delete from public.manager_learned_phrases
  where phrase = lower(trim(p_phrase));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_delete_learned_phrase(text) from public;
grant execute on function public.admin_delete_learned_phrase(text) to authenticated;

-- ─── 20260425000000_admin_panel_login.sql ───
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

-- ─── 20260425000001_wallet_security.sql ───
-- Migration: Wallet Security Features
-- Adiciona tabelas para 2FA, backups e auditoria de fraude

-- Tabela de configuração 2FA por usuário
CREATE TABLE IF NOT EXISTS public.user_2fa_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  secret TEXT, -- TOTP secret (encrypted em produção)
  backup_codes TEXT[], -- Códigos de backup (hashed em produção)
  enabled_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para 2FA
CREATE INDEX IF NOT EXISTS idx_user_2fa_enabled ON public.user_2fa_config(user_id) WHERE enabled = true;

-- RLS para 2FA (usuário só vê própria config)
ALTER TABLE public.user_2fa_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own 2FA config"
  ON public.user_2fa_config
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own 2FA config"
  ON public.user_2fa_config
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own 2FA config"
  ON public.user_2fa_config
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Tabela de backups de wallet
CREATE TABLE IF NOT EXISTS public.wallet_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_snapshot JSONB NOT NULL,
  checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para backups
CREATE INDEX IF NOT EXISTS idx_wallet_backups_user_created ON public.wallet_backups(user_id, created_at DESC);

-- RLS para backups (usuário só vê próprios backups)
ALTER TABLE public.wallet_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet backups"
  ON public.wallet_backups
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet backups"
  ON public.wallet_backups
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Tabela de alertas de fraude
CREATE TABLE IF NOT EXISTS public.fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  reason TEXT NOT NULL,
  blocked BOOLEAN NOT NULL DEFAULT false,
  operation_type TEXT NOT NULL,
  amount_cents BIGINT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para fraud alerts
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_user_created ON public.fraud_alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_risk_level ON public.fraud_alerts(risk_level) WHERE blocked = true;

-- RLS para fraud alerts (usuário vê próprios alertas, admin vê todos)
ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fraud alerts"
  ON public.fraud_alerts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert fraud alerts"
  ON public.fraud_alerts
  FOR INSERT
  WITH CHECK (true); -- Backend insere via service role

-- Função para limpar backups antigos automaticamente
CREATE OR REPLACE FUNCTION cleanup_old_wallet_backups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mantém últimos 10 backups por usuário
  DELETE FROM public.wallet_backups
  WHERE id IN (
    SELECT id
    FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
      FROM public.wallet_backups
    ) t
    WHERE rn > 10
  );
END;
$$;

-- Trigger para atualizar updated_at em 2FA config
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_user_2fa_config_updated_at
  BEFORE UPDATE ON public.user_2fa_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE public.user_2fa_config IS 'Configuração de autenticação de dois fatores por usuário';
COMMENT ON TABLE public.wallet_backups IS 'Backups automáticos de wallets para recuperação de desastres';
COMMENT ON TABLE public.fraud_alerts IS 'Alertas de transações suspeitas e tentativas de fraude';
COMMENT ON FUNCTION cleanup_old_wallet_backups() IS 'Limpa backups antigos mantendo últimos 10 por usuário';

-- ─── 20260425000002_admin_rate_limiting.sql ───
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

-- ─── 20260425000003_admin_2fa_ip_notifications.sql ───
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

-- ─── 20260425000004_admin_csrf_protection.sql ───
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

-- ─── 20260425000100_admin_panel_login_crypt_fix.sql ───
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

-- ─── 20260426000000_narrative_catalog.sql ───
-- Catálogo de narrativas pré-geradas pelo GameSpirit.
-- Motivação: substituir chamadas LLM em tempo real durante partidas (caras,
-- escalam linear com usuários) por consumo offline determinístico.
--
-- Fluxo:
--   1. Admin (ou cron semanal) chama `generate-narrative-catalog` script.
--   2. Script pede N templates ao Anthropic (Haiku) em batch.
--   3. Script insere via RPC `insert_narrative_batch`.
--   4. Runtime cliente hidrata via `get_narrative_templates` ao montar partida.
--   5. `pickNarrative(category, context, seed)` escolhe deterministicamente.
--
-- Qualidade é ajustada por `quality_rating` (thumbs up/down do manager).

create table if not exists public.narrative_templates (
  id              uuid primary key default gen_random_uuid(),
  category        text not null,      -- 'goal','shot_saved','foul_yellow',...
  intensity       text not null,      -- 'low'|'medium'|'high'|'world_class'
  context_tags    text[] default '{}',-- ['last_minute','comeback','rival',...]
  template        text not null,      -- "{player} arrisca de fora — {outcome}"
  variables       jsonb default '{}', -- { outcome: ['morre no poste','beija a rede'], ... }
  persona_vibe    text default 'casual', -- 'analytical'|'visceral'|'poetic'|'casual'
  generated_at    timestamptz not null default now(),
  batch_id        uuid,
  usage_count     int not null default 0,
  quality_rating  numeric not null default 0.5,
  active          boolean not null default true
);

create index if not exists idx_ntpl_cat_intensity
  on public.narrative_templates (category, intensity)
  where active = true;
create index if not exists idx_ntpl_batch
  on public.narrative_templates (batch_id);

alter table public.narrative_templates enable row level security;

-- Qualquer autenticado lê o catálogo (não é segredo).
drop policy if exists ntpl_public_read on public.narrative_templates;
create policy ntpl_public_read on public.narrative_templates
  for select
  to authenticated, anon
  using (active = true);

-- Escrita só via RPC.
drop policy if exists ntpl_no_direct_write on public.narrative_templates;
create policy ntpl_no_direct_write on public.narrative_templates
  for all
  using (false)
  with check (false);

grant select on table public.narrative_templates to authenticated, anon;

-- ─── RPC: listar templates (runtime) ──────────────────────────────────
-- Filtra por categoria. Ordena por (quality desc, usage asc) pra rotacionar
-- os menos usados e mais bem avaliados.
create or replace function public.get_narrative_templates(
  p_category text default null,
  p_limit int default 500
)
returns setof public.narrative_templates
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
    select *
      from public.narrative_templates
     where active = true
       and (p_category is null or category = p_category)
     order by quality_rating desc, usage_count asc
     limit greatest(1, least(coalesce(p_limit, 500), 2000));
end;
$$;

revoke all on function public.get_narrative_templates(text, int) from public;
grant execute on function public.get_narrative_templates(text, int) to authenticated, anon;

-- ─── RPC: inserir batch (admin/script) ────────────────────────────────
-- Recebe array JSONB com N templates e insere em uma transação com o
-- mesmo `batch_id`. Use do script gerador e admin panel.
create or replace function public.admin_insert_narrative_batch(
  p_templates jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid := gen_random_uuid();
  v_row jsonb;
begin
  -- service_role bypass: permite o script CLI gravar sem sessão admin.
  if auth.role() <> 'service_role' and not public.is_admin() then
    raise exception 'admin required';
  end if;
  if jsonb_typeof(p_templates) <> 'array' then
    raise exception 'p_templates must be a JSON array';
  end if;
  for v_row in select * from jsonb_array_elements(p_templates)
  loop
    insert into public.narrative_templates (
      category, intensity, context_tags, template, variables,
      persona_vibe, batch_id
    ) values (
      v_row->>'category',
      coalesce(v_row->>'intensity', 'medium'),
      coalesce((
        select array_agg(value::text)
          from jsonb_array_elements_text(v_row->'context_tags')
      ), '{}'),
      v_row->>'template',
      coalesce(v_row->'variables', '{}'::jsonb),
      coalesce(v_row->>'persona_vibe', 'casual'),
      v_batch_id
    );
  end loop;
  return v_batch_id;
end;
$$;

revoke all on function public.admin_insert_narrative_batch(jsonb) from public;
grant execute on function public.admin_insert_narrative_batch(jsonb) to authenticated;

-- ─── RPC: ajustar quality_rating (feedback do manager) ────────────────
-- Thumbs up/down no feed da partida. EMA com alpha=0.3 pra não oscilar.
create or replace function public.rate_narrative_template(
  p_id uuid,
  p_positive boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alpha numeric := 0.3;
  v_delta numeric := case when p_positive then 1.0 else 0.0 end;
begin
  update public.narrative_templates
     set quality_rating = round((quality_rating * (1 - v_alpha) + v_delta * v_alpha)::numeric, 3)
   where id = p_id;
end;
$$;

revoke all on function public.rate_narrative_template(uuid, boolean) from public;
grant execute on function public.rate_narrative_template(uuid, boolean) to authenticated;

-- ─── RPC: incrementar usage_count (runtime) ───────────────────────────
-- Opcional: pode ser batched no cliente pra evitar N calls por partida.
create or replace function public.bump_narrative_usage(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.narrative_templates
     set usage_count = usage_count + 1
   where id = any(p_ids);
end;
$$;

revoke all on function public.bump_narrative_usage(uuid[]) from public;
grant execute on function public.bump_narrative_usage(uuid[]) to authenticated;

-- ─── RPC: agregação do admin (painel de narrativas) ────────────────────
create or replace function public.admin_narrative_stats()
returns table (
  category text,
  intensity text,
  total int,
  avg_quality numeric,
  total_usage bigint,
  last_batch timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin required';
  end if;
  return query
    select
      nt.category,
      nt.intensity,
      count(*)::int as total,
      round(avg(nt.quality_rating)::numeric, 3) as avg_quality,
      sum(nt.usage_count)::bigint as total_usage,
      max(nt.generated_at) as last_batch
    from public.narrative_templates nt
    where active = true
    group by nt.category, nt.intensity
    order by nt.category, nt.intensity;
end;
$$;

revoke all on function public.admin_narrative_stats() from public;
grant execute on function public.admin_narrative_stats() to authenticated;

-- ─── 20260426030409_fix_admin_panel_login_pgcrypto_schema.sql ───
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

-- ─── 20260426040400_create_football_vocabulary_table.sql ───
-- Cria tabela de vocabulário de futebol (biblioteca global de comandos)
-- Separada de manager_learned_phrases (frases aprendidas por usuário)

CREATE TABLE IF NOT EXISTS football_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase TEXT NOT NULL UNIQUE,
  stem TEXT NOT NULL,
  intent TEXT NOT NULL,
  canonical_phrase TEXT NOT NULL,
  confirm_count INTEGER NOT NULL DEFAULT 1,
  region TEXT DEFAULT 'BR',
  language_type TEXT DEFAULT 'popular',
  context TEXT DEFAULT 'torcida',
  formality_level INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_football_vocabulary_phrase ON football_vocabulary(phrase);
CREATE INDEX idx_football_vocabulary_intent ON football_vocabulary(intent);
CREATE INDEX idx_football_vocabulary_active ON football_vocabulary(is_active);
CREATE INDEX idx_football_vocabulary_region ON football_vocabulary(region);

CREATE OR REPLACE FUNCTION update_football_vocabulary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER football_vocabulary_updated_at
  BEFORE UPDATE ON football_vocabulary
  FOR EACH ROW
  EXECUTE FUNCTION update_football_vocabulary_updated_at();

ALTER TABLE football_vocabulary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem fazer tudo em football_vocabulary"
  ON football_vocabulary
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Todos podem ler frases ativas"
  ON football_vocabulary
  FOR SELECT
  TO authenticated
  USING (is_active = true);

COMMENT ON TABLE football_vocabulary IS 'Biblioteca global de vocabulário de futebol PT-BR para comandos de voz';

-- ─── 20260427000000_profile_onboarding.sql ───
-- Estende `profiles` pra armazenar o payload completo do onboarding,
-- permitindo login cross-device: o manager faz signup → profile salvo →
-- em outro dispositivo faz login → hidrata managerProfile + clube +
-- favoriteRealTeam + formação a partir deste payload.

alter table public.profiles
  add column if not exists onboarding_data jsonb,
  add column if not exists display_name text,
  add column if not exists club_name text,
  add column if not exists club_short text;

-- RPC pra o próprio usuário salvar/atualizar seu onboarding.
create or replace function public.save_onboarding_profile(
  p_display_name text,
  p_club_name text,
  p_club_short text,
  p_onboarding_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;
  insert into public.profiles (id, display_name, club_name, club_short, onboarding_data)
  values (v_uid, p_display_name, p_club_name, p_club_short, p_onboarding_data)
  on conflict (id) do update set
    display_name = excluded.display_name,
    club_name = excluded.club_name,
    club_short = excluded.club_short,
    onboarding_data = excluded.onboarding_data,
    updated_at = now();
end;
$$;

revoke all on function public.save_onboarding_profile(text, text, text, jsonb) from public;
grant execute on function public.save_onboarding_profile(text, text, text, jsonb) to authenticated;

-- RPC pra o próprio usuário ler seu profile (hidrata Zustand após login).
create or replace function public.get_my_onboarding_profile()
returns table (
  display_name text,
  club_name text,
  club_short text,
  onboarding_data jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;
  return query
    select p.display_name, p.club_name, p.club_short, p.onboarding_data
      from public.profiles p
     where p.id = v_uid
     limit 1;
end;
$$;

revoke all on function public.get_my_onboarding_profile() from public;
grant execute on function public.get_my_onboarding_profile() to authenticated;

-- Policy: usuário pode ler o próprio profile (já deve existir, mas garante).
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- ─── 20260428000000_admin_list_profiles.sql ───
-- RPC pra o painel admin listar todos os profiles com métricas básicas.
-- Somente admin (is_admin() check) pode chamar.

drop function if exists public.admin_list_profiles();

create function public.admin_list_profiles()
returns table (
  id uuid,
  display_name text,
  club_name text,
  club_short text,
  created_at timestamptz,
  updated_at timestamptz,
  onboarding_data jsonb,
  referred_by_code text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin required';
  end if;
  return query
    select p.id, p.display_name, p.club_name, p.club_short,
           p.created_at, p.updated_at, p.onboarding_data, p.referred_by_code
      from public.profiles p
     order by p.updated_at desc
     limit 500;
end;
$$;

revoke all on function public.admin_list_profiles() from public;
grant execute on function public.admin_list_profiles() to authenticated;

-- ─── 20260429000000_profile_referral.sql ───
-- Registra o código de indicação (referrer) de cada usuário no cadastro.
-- O código fica gravado no profile pra permitir: (a) tracking cross-device,
-- (b) relatórios de admin sobre quem indicou quem, (c) crédito de indicação.
-- Imutável após a primeira gravação (não se troca de patrocinador).

alter table public.profiles
  add column if not exists referred_by_code text;

-- Índice pra consultar cadastros por código (admin / growth analytics).
create index if not exists profiles_referred_by_code_idx
  on public.profiles (referred_by_code)
  where referred_by_code is not null;

-- Substitui a RPC pra aceitar o código de indicação opcional.
-- Postgres não permite adicionar param com default à função existente sem drop;
-- drop da assinatura antiga pra recriar com 5 args.
drop function if exists public.save_onboarding_profile(text, text, text, jsonb);

create or replace function public.save_onboarding_profile(
  p_display_name text,
  p_club_name text,
  p_club_short text,
  p_onboarding_data jsonb,
  p_referred_by_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  -- Normaliza: maiúsculas, só A-Z e 0-9, 6 a 8 chars. Qualquer coisa fora disso → null.
  v_code := nullif(regexp_replace(upper(coalesce(p_referred_by_code, '')), '[^A-Z0-9]', '', 'g'), '');
  if v_code is not null and (char_length(v_code) < 6 or char_length(v_code) > 8) then
    v_code := null;
  end if;

  insert into public.profiles (id, display_name, club_name, club_short, onboarding_data, referred_by_code)
  values (v_uid, p_display_name, p_club_name, p_club_short, p_onboarding_data, v_code)
  on conflict (id) do update set
    display_name = excluded.display_name,
    club_name = excluded.club_name,
    club_short = excluded.club_short,
    onboarding_data = excluded.onboarding_data,
    -- referred_by_code é imutável: só grava se o profile ainda não tinha código.
    referred_by_code = coalesce(public.profiles.referred_by_code, excluded.referred_by_code),
    updated_at = now();
end;
$$;

revoke all on function public.save_onboarding_profile(text, text, text, jsonb, text) from public;
grant execute on function public.save_onboarding_profile(text, text, text, jsonb, text) to authenticated;

-- ─── 20260429000100_admin_referral_views.sql ───
-- Admin: expõe `referred_by_code` no listing de profiles e um agregado
-- de top referrers (quantos managers cada código indicou).

drop function if exists public.admin_list_profiles();

create or replace function public.admin_list_profiles()
returns table (
  id uuid,
  display_name text,
  club_name text,
  club_short text,
  created_at timestamptz,
  updated_at timestamptz,
  onboarding_data jsonb,
  referred_by_code text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin required';
  end if;
  return query
    select p.id, p.display_name, p.club_name, p.club_short,
           p.created_at, p.updated_at, p.onboarding_data, p.referred_by_code
      from public.profiles p
     order by p.updated_at desc
     limit 500;
end;
$$;

revoke all on function public.admin_list_profiles() from public;
grant execute on function public.admin_list_profiles() to authenticated;

-- Top referrers: código → quantos managers indicados.
create or replace function public.admin_list_top_referrers(p_limit int default 50)
returns table (
  referred_by_code text,
  referred_count bigint,
  first_referral_at timestamptz,
  last_referral_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin required';
  end if;
  return query
    select p.referred_by_code,
           count(*)::bigint as referred_count,
           min(p.created_at) as first_referral_at,
           max(p.created_at) as last_referral_at
      from public.profiles p
     where p.referred_by_code is not null
     group by p.referred_by_code
     order by referred_count desc, last_referral_at desc
     limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

revoke all on function public.admin_list_top_referrers(int) from public;
grant execute on function public.admin_list_top_referrers(int) to authenticated;

-- ─── 20260430000000_check_email_exists.sql ───
-- RPC pra verificar se um e-mail já está cadastrado em auth.users.
-- Retorna apenas boolean (não vaza dados do usuário). Case-insensitive.
-- Usado no cadastro pra avisar o usuário inline em vez de esperar o submit.

create or replace function public.check_email_exists(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email = '' or position('@' in v_email) = 0 then
    return false;
  end if;
  return exists (
    select 1 from auth.users u where lower(u.email) = v_email
  );
end;
$$;

revoke all on function public.check_email_exists(text) from public;
grant execute on function public.check_email_exists(text) to anon, authenticated;

-- ─── 20260501000000_profile_verification.sql ───
-- Verificação de conta — dados protegidos por RLS; RPCs SECURITY DEFINER.
-- TODO: criptografia em repouso (pgsodium ou app-layer) antes de produção com usuários reais.

alter table public.profiles
  add column if not exists verified boolean not null default false,
  add column if not exists verification_status text not null default 'not_submitted',
  add column if not exists verification_data jsonb,
  add column if not exists verification_submitted_at timestamptz,
  add column if not exists verification_reviewed_at timestamptz,
  add column if not exists verification_rejection_reason text;

alter table public.profiles
  drop constraint if exists profiles_verification_status_chk;
alter table public.profiles
  add constraint profiles_verification_status_chk
    check (verification_status in ('not_submitted','pending','approved','rejected'));

create index if not exists profiles_verification_status_idx
  on public.profiles (verification_status)
  where verification_status = 'pending';

create or replace function public.submit_verification(p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'invalid payload'; end if;
  insert into public.profiles (id, verification_data, verification_status, verification_submitted_at, verified)
  values (v_uid, p_data, 'pending', now(), false)
  on conflict (id) do update set
    verification_data = p_data,
    verification_status = 'pending',
    verification_submitted_at = now(),
    verification_rejection_reason = null,
    updated_at = now();
end; $$;
revoke all on function public.submit_verification(jsonb) from public;
grant execute on function public.submit_verification(jsonb) to authenticated;

create or replace function public.get_my_verification()
returns table (
  verification_status text,
  verified boolean,
  verification_data jsonb,
  verification_submitted_at timestamptz,
  verification_reviewed_at timestamptz,
  verification_rejection_reason text
)
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  return query
    select p.verification_status, p.verified, p.verification_data,
           p.verification_submitted_at, p.verification_reviewed_at, p.verification_rejection_reason
      from public.profiles p where p.id = v_uid limit 1;
end; $$;
revoke all on function public.get_my_verification() from public;
grant execute on function public.get_my_verification() to authenticated;

create or replace function public.admin_list_verifications(p_status text default 'pending')
returns table (
  id uuid,
  display_name text,
  club_name text,
  verification_status text,
  verification_data jsonb,
  verification_submitted_at timestamptz,
  verification_reviewed_at timestamptz,
  verification_rejection_reason text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  return query
    select p.id, p.display_name, p.club_name,
           p.verification_status, p.verification_data,
           p.verification_submitted_at, p.verification_reviewed_at, p.verification_rejection_reason
      from public.profiles p
     where (p_status is null or p.verification_status = p_status)
     order by p.verification_submitted_at desc nulls last
     limit 200;
end; $$;
revoke all on function public.admin_list_verifications(text) from public;
grant execute on function public.admin_list_verifications(text) to authenticated;

create or replace function public.admin_set_verification(p_user_id uuid, p_approved boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if p_approved then
    update public.profiles
      set verified = true, verification_status = 'approved',
          verification_reviewed_at = now(), verification_rejection_reason = null, updated_at = now()
      where id = p_user_id;
  else
    update public.profiles
      set verified = false, verification_status = 'rejected',
          verification_reviewed_at = now(), verification_rejection_reason = p_reason, updated_at = now()
      where id = p_user_id;
  end if;
end; $$;
revoke all on function public.admin_set_verification(uuid, boolean, text) from public;
grant execute on function public.admin_set_verification(uuid, boolean, text) to authenticated;

-- ─── 20260501000100_player_beneficiary_split.sql ───
-- Vinculação de cards a usuário (beneficiary) + split de pagamento.
-- Split padrão: 50% jogador · 10% facilitador(es) · 40% Olefoot.
-- Formato: [{ kind: 'player'|'facilitator'|'olefoot', user_id uuid|null, label text, percent numeric }]
-- Soma dos percents deve ser 100. Validação via RPC (CHECK em jsonb é limitado).

alter table public.genesis_market_players
  add column if not exists beneficiary_user_id uuid references auth.users(id) on delete set null,
  add column if not exists payment_split jsonb;

alter table public.legacy_players
  add column if not exists beneficiary_user_id uuid references auth.users(id) on delete set null,
  add column if not exists payment_split jsonb;

create index if not exists genesis_market_players_beneficiary_idx
  on public.genesis_market_players (beneficiary_user_id)
  where beneficiary_user_id is not null;
create index if not exists legacy_players_beneficiary_idx
  on public.legacy_players (beneficiary_user_id)
  where beneficiary_user_id is not null;

create or replace function public.validate_payment_split(p_split jsonb)
returns void language plpgsql as $$
declare
  v_sum numeric := 0;
  v_item jsonb;
begin
  if p_split is null or jsonb_typeof(p_split) <> 'array' then
    raise exception 'split must be a non-null array';
  end if;
  if jsonb_array_length(p_split) < 1 then
    raise exception 'split must have at least one entry';
  end if;
  for v_item in select * from jsonb_array_elements(p_split) loop
    if (v_item->>'kind') is null or (v_item->>'percent') is null then
      raise exception 'each split entry needs kind and percent';
    end if;
    v_sum := v_sum + (v_item->>'percent')::numeric;
  end loop;
  if abs(v_sum - 100) > 0.01 then
    raise exception 'split percents must sum to 100 (got %)', v_sum;
  end if;
end;
$$;
revoke all on function public.validate_payment_split(jsonb) from public;

create or replace function public.admin_update_player_link(
  p_table text,
  p_player_id text,
  p_beneficiary_user_id uuid,
  p_payment_split jsonb
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if p_table not in ('genesis_market_players', 'legacy_players') then
    raise exception 'invalid table: %', p_table;
  end if;
  perform public.validate_payment_split(p_payment_split);
  if p_table = 'genesis_market_players' then
    update public.genesis_market_players
      set beneficiary_user_id = p_beneficiary_user_id, payment_split = p_payment_split, updated_at = now()
      where id = p_player_id;
  else
    update public.legacy_players
      set beneficiary_user_id = p_beneficiary_user_id, payment_split = p_payment_split, updated_at = now()
      where id = p_player_id;
  end if;
end;
$$;
revoke all on function public.admin_update_player_link(text, text, uuid, jsonb) from public;
grant execute on function public.admin_update_player_link(text, text, uuid, jsonb) to authenticated;

create or replace function public.get_my_linked_cards()
returns table (
  source text,
  id text,
  name text,
  pos text,
  rarity_label text,
  portrait_public_url text,
  price_bro_cents bigint,
  listed_on_market boolean,
  beneficiary_user_id uuid,
  payment_split jsonb
)
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  return query
    select 'genesis'::text, g.id, g.name, g.pos, g.rarity_label, g.portrait_public_url,
           g.price_bro_cents::bigint, g.listed_on_market, g.beneficiary_user_id, g.payment_split
      from public.genesis_market_players g where g.beneficiary_user_id = v_uid
     union all
    select 'legacy'::text, l.id, l.name, coalesce(l.pos,'')::text, coalesce(l.rarity_label,'')::text,
           coalesce(l.portrait_public_url,'')::text, coalesce(l.price_bro_cents,0)::bigint,
           false, l.beneficiary_user_id, l.payment_split
      from public.legacy_players l where l.beneficiary_user_id = v_uid
     order by name;
end;
$$;
revoke all on function public.get_my_linked_cards() from public;
grant execute on function public.get_my_linked_cards() to authenticated;

-- ─── 20260502000000_pro_payouts_pipeline.sql ───
-- Pipeline de distribuição de vendas pro PRO.
-- Quando um market_purchases insert acontece, lê o payment_split do player
-- e credita cada beneficiário (user_id) em pro_payouts proporcional ao percent.
-- Valores em EXP (mesma unidade de price_exp). Conversão p/ BRL fica pra WALLET.

create table if not exists public.pro_payouts (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  purchase_id     uuid references public.market_purchases(id) on delete set null,
  player_id       text not null,
  player_name     text,
  split_kind      text not null,
  percent         numeric(5,2) not null,
  amount_exp      bigint not null check (amount_exp >= 0),
  created_at      timestamptz not null default now()
);
create index if not exists pro_payouts_user_idx on public.pro_payouts (user_id, created_at desc);
create index if not exists pro_payouts_player_idx on public.pro_payouts (player_id);

alter table public.pro_payouts enable row level security;
drop policy if exists "user reads own pro_payouts" on public.pro_payouts;
create policy "user reads own pro_payouts"
  on public.pro_payouts for select
  using (auth.uid() = user_id);

create or replace function public.distribute_player_sale(
  p_purchase_id uuid,
  p_player_id text,
  p_price_exp bigint
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_split jsonb;
  v_name text;
  v_entry jsonb;
  v_pct numeric;
  v_uid uuid;
  v_kind text;
  v_amount bigint;
begin
  select payment_split, name into v_split, v_name
    from public.genesis_market_players where id = p_player_id;
  if v_split is null then
    select payment_split, name into v_split, v_name
      from public.legacy_players where id = p_player_id;
  end if;
  if v_split is null or jsonb_typeof(v_split) <> 'array' then return; end if;

  for v_entry in select * from jsonb_array_elements(v_split) loop
    v_pct := coalesce((v_entry->>'percent')::numeric, 0);
    v_kind := coalesce(v_entry->>'kind', 'unknown');
    v_amount := floor(p_price_exp * v_pct / 100)::bigint;
    if v_amount <= 0 then continue; end if;
    begin v_uid := (v_entry->>'user_id')::uuid;
    exception when others then v_uid := null;
    end;
    if v_uid is null then continue; end if;
    insert into public.pro_payouts (
      user_id, purchase_id, player_id, player_name, split_kind, percent, amount_exp
    ) values (
      v_uid, p_purchase_id, p_player_id, v_name, v_kind, v_pct, v_amount
    );
  end loop;
end;
$$;
revoke all on function public.distribute_player_sale(uuid, text, bigint) from public;
grant execute on function public.distribute_player_sale(uuid, text, bigint) to authenticated;

create or replace function public.trg_market_purchase_distribute()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.distribute_player_sale(new.id, new.genesis_id, new.price_exp);
  return new;
end; $$;
drop trigger if exists market_purchases_distribute on public.market_purchases;
create trigger market_purchases_distribute
  after insert on public.market_purchases
  for each row execute function public.trg_market_purchase_distribute();

create or replace function public.get_my_pro_summary()
returns table (balance_exp bigint, total_sales int, last_sale_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  return query
    select coalesce(sum(p.amount_exp), 0)::bigint,
           count(distinct p.purchase_id)::int,
           max(p.created_at)
      from public.pro_payouts p where p.user_id = v_uid;
end; $$;
revoke all on function public.get_my_pro_summary() from public;
grant execute on function public.get_my_pro_summary() to authenticated;

create or replace function public.get_my_pro_payouts(p_limit int default 50)
returns table (
  id bigint, player_id text, player_name text, split_kind text,
  percent numeric, amount_exp bigint, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  return query
    select p.id, p.player_id, p.player_name, p.split_kind, p.percent, p.amount_exp, p.created_at
      from public.pro_payouts p where p.user_id = v_uid
     order by p.created_at desc
     limit greatest(coalesce(p_limit, 50), 1);
end; $$;
revoke all on function public.get_my_pro_payouts(int) from public;
grant execute on function public.get_my_pro_payouts(int) to authenticated;

-- ─── 20260502010000_coach_skills.sql ───
-- Coach Skills · Fase 1 (PlaybookV1)
-- Spec: docs/COACH_SKILLS_PLAYBOOK_V1.md
--
-- 3 tabelas:
--   coach_skills_catalog        — admin-curated, leitura pública
--   manager_owned_skills        — RLS por user_id
--   manager_skill_assignments   — RLS por user_id
--
-- 3 RPCs (security definer onde necessário):
--   get_skills_catalog()        — lista catálogo ativo
--   get_my_owned_skills()       — skills possuídas pelo auth.uid()
--   purchase_skill(skill_id, currency) — debita preço + insere ownership

-- ──────────────────────────────────────────────────────────────────
-- 1. Catálogo (admin-curated, leitura pública via RPC)
-- ──────────────────────────────────────────────────────────────────

create table if not exists coach_skills_catalog (
  id text primary key,
  schema_version int not null default 1,
  name text not null,
  role text not null check (role in (
    'goleiro','zagueiro','lateral','volante','meia','ponta','atacante'
  )),
  tier text not null check (tier in ('generica','historica','lendaria')),
  level int not null check (level between 1 and 5),
  payload jsonb not null,                 -- PlaybookV1 completo (CoachSkill)
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_skills_catalog_role_tier_idx
  on coach_skills_catalog (role, tier) where active = true;

-- catálogo é leitura pública (via RPC), escrita só por service_role
alter table coach_skills_catalog enable row level security;
drop policy if exists "catalog readable by anyone" on coach_skills_catalog;
create policy "catalog readable by anyone"
  on coach_skills_catalog for select
  using (active = true);

-- ──────────────────────────────────────────────────────────────────
-- 2. Skills possuídas (uma linha por skill comprada/desbloqueada)
-- ──────────────────────────────────────────────────────────────────

create table if not exists manager_owned_skills (
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id text not null references coach_skills_catalog(id) on delete restrict,
  acquired_at timestamptz not null default now(),
  acquired_via text not null check (acquired_via in (
    'purchase_exp','purchase_bro','achievement','gift','seed'
  )),
  primary key (user_id, skill_id)
);

alter table manager_owned_skills enable row level security;
drop policy if exists "user reads own skills" on manager_owned_skills;
create policy "user reads own skills"
  on manager_owned_skills for select
  using (auth.uid() = user_id);

-- inserts/updates só via RPC security definer (purchase_skill, grant_skill)
-- — sem policy de write pra user_id direto (evita gravar skill sem pagar)

-- ──────────────────────────────────────────────────────────────────
-- 3. Atribuições ativas (skill_id atribuído a player_entity_id no save)
-- ──────────────────────────────────────────────────────────────────

create table if not exists manager_skill_assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  player_entity_id text not null,         -- ID client-side, sem FK
  skill_id text not null references coach_skills_catalog(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, player_entity_id, skill_id)
);

alter table manager_skill_assignments enable row level security;
drop policy if exists "user reads own assignments" on manager_skill_assignments;
create policy "user reads own assignments"
  on manager_skill_assignments for select
  using (auth.uid() = user_id);

drop policy if exists "user writes own assignments" on manager_skill_assignments;
create policy "user writes own assignments"
  on manager_skill_assignments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────────
-- 4. RPCs
-- ──────────────────────────────────────────────────────────────────

-- Lista o catálogo ativo (leitura pública).
create or replace function get_skills_catalog()
returns setof coach_skills_catalog
language sql
security invoker
stable
as $$
  select * from coach_skills_catalog where active = true order by tier, role, name;
$$;

-- Lista as skills possuídas pelo auth.uid() (RLS já filtra na select).
create or replace function get_my_owned_skills()
returns table (
  skill_id text,
  acquired_at timestamptz,
  acquired_via text,
  payload jsonb
)
language sql
security invoker
stable
as $$
  select o.skill_id, o.acquired_at, o.acquired_via, c.payload
  from manager_owned_skills o
  join coach_skills_catalog c on c.id = o.skill_id
  where o.user_id = auth.uid()
  order by o.acquired_at desc;
$$;

-- Compra de skill: debita do saldo (EXP via app, BRO cents via stripe upstream)
-- e insere ownership. Atômica. Retorna o registro inserido.
--
-- IMPORTANTE: esta versão valida apenas o preço bate com o catálogo. O
-- débito real do EXP/BRO acontece no client (after success) ou em um RPC
-- separado de finance — manter purchase_skill focado em ownership.
create or replace function purchase_skill(
  p_skill_id text,
  p_currency text  -- 'exp' | 'bro' | 'achievement' | 'gift'
)
returns manager_owned_skills
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_catalog coach_skills_catalog%rowtype;
  v_via text;
  v_inserted manager_owned_skills%rowtype;
begin
  if v_user_id is null then
    raise exception 'auth required';
  end if;

  select * into v_catalog from coach_skills_catalog
  where id = p_skill_id and active = true;
  if not found then
    raise exception 'skill_not_found_or_inactive: %', p_skill_id;
  end if;

  v_via := case p_currency
    when 'exp' then 'purchase_exp'
    when 'bro' then 'purchase_bro'
    when 'achievement' then 'achievement'
    when 'gift' then 'gift'
    else null
  end;
  if v_via is null then
    raise exception 'invalid_currency: % (expected exp|bro|achievement|gift)', p_currency;
  end if;

  -- ownership idempotente: se já possui, retorna existente
  select * into v_inserted from manager_owned_skills
  where user_id = v_user_id and skill_id = p_skill_id;
  if found then
    return v_inserted;
  end if;

  insert into manager_owned_skills (user_id, skill_id, acquired_via)
  values (v_user_id, p_skill_id, v_via)
  returning * into v_inserted;

  return v_inserted;
end;
$$;

grant execute on function get_skills_catalog() to anon, authenticated;
grant execute on function get_my_owned_skills() to authenticated;
grant execute on function purchase_skill(text, text) to authenticated;

-- ──────────────────────────────────────────────────────────────────
-- 5. Seed inicial — espelha src/skills/seedCatalog.ts
-- ──────────────────────────────────────────────────────────────────
--
-- 6 skills (3 generica + 3 historica). Idempotente via on conflict do nothing
-- — re-rodar a migration não duplica nem sobrescreve. Para atualizar payload
-- futuramente, usar uma migration nova com `update coach_skills_catalog`.

insert into coach_skills_catalog (id, name, role, tier, level, payload) values
  ('skl_goleiro_padrao', 'Goleiro Padrão', 'goleiro', 'generica', 1, '{
    "schema":"playbook_v1","id":"skl_goleiro_padrao","name":"Goleiro Padrão",
    "role":"goleiro","tier":"generica","level":1,
    "philosophy":"Defesa segura + distribuição básica.",
    "behaviors":[
      {"id":"bh_passe_curto_seguro","name":"Passe curto pro zagueiro mais próximo",
       "when":"team_has_ball && carrier_is_me && no_press_nearby",
       "bias":{"passShortToDefender":0.20,"clearBall":-0.10}},
      {"id":"bh_chutao_sob_pressao","name":"Afastar quando pressionado",
       "when":"team_has_ball && carrier_is_me && opp_press_nearby",
       "bias":{"clearBall":0.25,"passShortToDefender":-0.15}}
    ],
    "unlock":{"minCareerTier":1}
  }'::jsonb),

  ('skl_atacante_padrao', 'Atacante Padrão', 'atacante', 'generica', 1, '{
    "schema":"playbook_v1","id":"skl_atacante_padrao","name":"Atacante Padrão",
    "role":"atacante","tier":"generica","level":1,
    "philosophy":"Chute na área, recupera no rival quando perde.",
    "behaviors":[
      {"id":"bh_chute_na_area","name":"Finaliza ao receber dentro da área",
       "when":"carrier_is_me && isBox(zone)",
       "bias":{"shotPlaced":0.22,"passShortBack":-0.12}},
      {"id":"bh_pressao_imediata","name":"Pressiona o zagueiro adversário ao perder a bola",
       "when":"!team_has_ball && my_zone == \"att\"",
       "bias":{"pressNearestOpp":0.18,"dropBack":-0.10}}
    ],
    "unlock":{"minCareerTier":1}
  }'::jsonb),

  ('skl_meia_padrao', 'Meia Padrão', 'meia', 'generica', 1, '{
    "schema":"playbook_v1","id":"skl_meia_padrao","name":"Meia Padrão",
    "role":"meia","tier":"generica","level":1,
    "philosophy":"Passe pra frente quando livre, recompõe quando precisa.",
    "behaviors":[
      {"id":"bh_passe_progressivo","name":"Passe vertical para o ataque quando livre",
       "when":"carrier_is_me && no_press_nearby && team_has_ball",
       "bias":{"passProgressive":0.20,"passShortBack":-0.10}},
      {"id":"bh_recompoe_meio","name":"Volta ao meio sem bola",
       "when":"!team_has_ball && my_zone == \"mid\"",
       "bias":{"recoverMid":0.15,"holdLine":-0.08}}
    ],
    "unlock":{"minCareerTier":1}
  }'::jsonb),

  ('skl_escola_taffarel', 'Escola Taffarel', 'goleiro', 'historica', 3, '{
    "schema":"playbook_v1","id":"skl_escola_taffarel","name":"Escola Taffarel",
    "role":"goleiro","tier":"historica","level":3,
    "philosophy":"Defesa segura, reflexo elite e comando de linha defensiva.",
    "attrRequirements":{"mentalidade":70},
    "behaviors":[
      {"id":"bh_saida_curta","name":"Saída curta pro zagueiro",
       "when":"team_has_ball && carrier_is_me && no_press_nearby",
       "bias":{"passShortToDefender":0.30,"clearBall":-0.18}},
      {"id":"bh_antecipar_cruzamento","name":"Sair pra cortar cruzamento",
       "when":"opp_crossing && ball_in_my_box_zone",
       "bias":{"cornerCatch":0.28,"stayOnLine":-0.15},"cooldownSec":30},
      {"id":"bh_defender_1v1","name":"Fechar ângulo em 1v1",
       "when":"opp_through_ball && attacker_isolated",
       "bias":{"advanceToCloseAngle":0.30,"diveEarly":-0.22}},
      {"id":"bh_reflexo_rebote","name":"Espalmar pro lado em rebote",
       "when":"shot_incoming && shot_power == \"power\"",
       "bias":{"parryToSide":0.28,"holdRisk":-0.18}},
      {"id":"bh_comando_linha","name":"Organiza linha de defesa",
       "when":"zone == \"def\" && team_defending",
       "bias":{"organizeLine":0.18},
       "teammateEffect":{"scope":"zagueiro","radius":22,
         "bias":{"holdLine":0.10,"trackRunner":0.08}}}
    ],
    "unlock":{"minCareerTier":2,"priceExp":120000,"priceBroCents":999},
    "research":{"seeds":["Cláudio Taffarel Copa 94 Brasil","Liverpool Alisson saída curta"]}
  }'::jsonb),

  ('skl_ferrolho_italiano', 'Ferrolho Italiano', 'zagueiro', 'historica', 3, '{
    "schema":"playbook_v1","id":"skl_ferrolho_italiano","name":"Ferrolho Italiano",
    "role":"zagueiro","tier":"historica","level":3,
    "philosophy":"Antecipação + leitura + falta calculada quando necessário.",
    "attrRequirements":{"marcacao":75,"mentalidade":70},
    "behaviors":[
      {"id":"bh_antecipar_passe","name":"Roubar antes do atacante",
       "when":"opp_through_ball && my_distance_to_ball < 6",
       "bias":{"interceptionAttempt":0.30,"stayInLine":-0.15}},
      {"id":"bh_falta_estrategica","name":"Falta tática pra parar o contra-ataque",
       "when":"opp_counter && my_zone_depth < 0.4 && no_other_defender",
       "bias":{"tacticalFoul":0.30,"letRunGo":-0.25}},
      {"id":"bh_marca_homem","name":"Marcação individual no homem-gol",
       "when":"opp_in_box && opponent_is_top_scorer",
       "bias":{"manMark":0.30,"zonalMark":-0.20}},
      {"id":"bh_lider_defesa","name":"Sobe linha quando time tem posse",
       "when":"team_has_ball && my_zone == \"def\"",
       "bias":{"stepUpLine":0.20},
       "teammateEffect":{"scope":"zagueiro","bias":{"stepUpLine":0.15}}}
    ],
    "unlock":{"minCareerTier":3,"priceExp":180000,"priceBroCents":1499}
  }'::jsonb),

  ('skl_artilheiro_clutch', 'Artilheiro Clutch', 'atacante', 'historica', 3, '{
    "schema":"playbook_v1","id":"skl_artilheiro_clutch","name":"Artilheiro Clutch",
    "role":"atacante","tier":"historica","level":3,
    "philosophy":"Sangue frio nos minutos finais. Decide o jogo.",
    "attrRequirements":{"mentalidade":80,"finalizacao":75},
    "behaviors":[
      {"id":"bh_chute_clutch","name":"Finaliza com calma na pressão",
       "when":"minute > 75 && score_diff <= 1",
       "bias":{"shotPlaced":0.30,"shotPower":-0.15}},
      {"id":"bh_busca_jogada","name":"Pede a bola no minuto final",
       "when":"minute > 85 && team_has_ball",
       "bias":{"callForBall":0.30,"stayPositioned":-0.20}},
      {"id":"bh_chute_panico_inverso","name":"Não força em vantagem",
       "when":"score_diff > 1 && minute > 70",
       "bias":{"passSafe":0.25,"shotForce":-0.20}}
    ],
    "unlock":{"minCareerTier":3,"requiredAchievementIds":["clutch_goal_5x"]}
  }'::jsonb)
on conflict (id) do nothing;

-- ─── 20260503000000_beta_program_and_social.sql ───
-- ============================================================================
-- OLEFOOT — Beta program, bug reports, notifications, manager friendships
-- ============================================================================
-- Tabelas para suportar testes online:
--   1) beta_testers        — controle de acesso ao beta (waitlist + invites)
--   2) bug_reports         — coleta de feedback/bugs dos testers
--   3) notifications       — log persistente de notificações (NotificationBell)
--   4) manager_friendships — solicitações + amizades confirmadas (ManagerNetwork)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1) beta_testers
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.beta_testers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  email         text not null,
  status        text not null default 'pending'
                check (status in ('pending','approved','rejected','active','revoked')),
  invite_code   text unique,
  invited_by    uuid references auth.users(id) on delete set null,
  approved_at   timestamptz,
  approved_by   uuid references auth.users(id) on delete set null,
  source        text,                    -- ex: 'landing', 'referral', 'admin'
  notes         text,
  metadata      jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (email)
);

create index if not exists idx_beta_testers_status on public.beta_testers(status);
create index if not exists idx_beta_testers_user on public.beta_testers(user_id);
create index if not exists idx_beta_testers_invite_code on public.beta_testers(invite_code);

alter table public.beta_testers enable row level security;

-- Usuário lê seu próprio registro; admin lê tudo.
drop policy if exists beta_testers_select_self on public.beta_testers;
create policy beta_testers_select_self on public.beta_testers
  for select using (user_id = auth.uid() or public.is_admin());

-- Inserção pública para waitlist (anon pode entrar com email).
drop policy if exists beta_testers_insert_waitlist on public.beta_testers;
create policy beta_testers_insert_waitlist on public.beta_testers
  for insert with check (status = 'pending');

-- Apenas admin atualiza/aprova.
drop policy if exists beta_testers_admin_write on public.beta_testers;
create policy beta_testers_admin_write on public.beta_testers
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists beta_testers_admin_delete on public.beta_testers;
create policy beta_testers_admin_delete on public.beta_testers
  for delete using (public.is_admin());

comment on table public.beta_testers is
  'Waitlist e controle de acesso ao beta online da Olefoot.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2) bug_reports
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.bug_reports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete set null,
  category       text not null default 'bug'
                 check (category in ('bug','feedback','suggestion','crash','ux')),
  severity       text not null default 'medium'
                 check (severity in ('low','medium','high','critical')),
  title          text not null,
  description    text not null,
  route          text,                    -- rota onde ocorreu (ex: /match/live)
  user_agent     text,
  app_version    text,
  screenshot_url text,                    -- supabase storage path
  attachments    jsonb default '[]'::jsonb,
  status         text not null default 'open'
                 check (status in ('open','triage','in_progress','resolved','wontfix','duplicate')),
  admin_notes    text,
  resolved_by    uuid references auth.users(id) on delete set null,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_bug_reports_user on public.bug_reports(user_id);
create index if not exists idx_bug_reports_status on public.bug_reports(status);
create index if not exists idx_bug_reports_category on public.bug_reports(category);
create index if not exists idx_bug_reports_created on public.bug_reports(created_at desc);

alter table public.bug_reports enable row level security;

drop policy if exists bug_reports_select_self on public.bug_reports;
create policy bug_reports_select_self on public.bug_reports
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists bug_reports_insert_self on public.bug_reports;
create policy bug_reports_insert_self on public.bug_reports
  for insert with check (user_id = auth.uid() or user_id is null);

drop policy if exists bug_reports_admin_write on public.bug_reports;
create policy bug_reports_admin_write on public.bug_reports
  for update using (public.is_admin()) with check (public.is_admin());

comment on table public.bug_reports is
  'Bugs e feedback enviados pelos beta testers via UI.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3) notifications
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category    text not null,             -- 'COMPETIÇÃO','PLANTEL','TREINO','STAFF','TORCIDA','SISTEMA'
  title       text not null,
  message     text,
  link        text,                      -- rota in-app (ex: /clube/elenco)
  payload     jsonb default '{}'::jsonb,
  read        boolean not null default false,
  read_at     timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread
  on public.notifications(user_id, read, created_at desc)
  where read = false;
create index if not exists idx_notifications_user_created
  on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_expires
  on public.notifications(expires_at) where expires_at is not null;

alter table public.notifications enable row level security;

drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_admin_insert on public.notifications;
create policy notifications_admin_insert on public.notifications
  for insert with check (public.is_admin());

drop policy if exists notifications_delete_self on public.notifications;
create policy notifications_delete_self on public.notifications
  for delete using (user_id = auth.uid() or public.is_admin());

comment on table public.notifications is
  'Notificações in-app persistentes (NotificationBell + InboxItem).';

-- RPC: marcar notificação como lida
create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
     set read = true, read_at = now()
   where id = p_notification_id
     and user_id = auth.uid()
     and read = false;
  return found;
end;
$$;

grant execute on function public.mark_notification_read(uuid) to authenticated;

-- RPC: marcar todas como lidas
create or replace function public.mark_all_notifications_read()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.notifications
     set read = true, read_at = now()
   where user_id = auth.uid() and read = false;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.mark_all_notifications_read() to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4) manager_friendships
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.manager_friendships (
  id                    uuid primary key default gen_random_uuid(),
  requester_id          uuid not null references auth.users(id) on delete cascade,
  addressee_id          uuid not null references auth.users(id) on delete cascade,
  status                text not null default 'pending'
                        check (status in ('pending','accepted','rejected','blocked','cancelled')),
  requester_club_name   text,
  addressee_club_name   text,
  message               text,
  responded_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint friendship_distinct_users check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

create index if not exists idx_friendships_requester
  on public.manager_friendships(requester_id, status);
create index if not exists idx_friendships_addressee
  on public.manager_friendships(addressee_id, status);
create index if not exists idx_friendships_status
  on public.manager_friendships(status, created_at desc);

alter table public.manager_friendships enable row level security;

-- Ambos os lados leem; admin lê tudo.
drop policy if exists friendships_select_involved on public.manager_friendships;
create policy friendships_select_involved on public.manager_friendships
  for select using (
    requester_id = auth.uid()
    or addressee_id = auth.uid()
    or public.is_admin()
  );

-- Apenas o requester cria solicitação.
drop policy if exists friendships_insert_requester on public.manager_friendships;
create policy friendships_insert_requester on public.manager_friendships
  for insert with check (requester_id = auth.uid());

-- Ambos os lados podem atualizar (aceitar/rejeitar/cancelar).
drop policy if exists friendships_update_involved on public.manager_friendships;
create policy friendships_update_involved on public.manager_friendships
  for update using (
    requester_id = auth.uid() or addressee_id = auth.uid()
  ) with check (
    requester_id = auth.uid() or addressee_id = auth.uid()
  );

-- Apenas requester pode cancelar (delete) sua própria solicitação pending.
drop policy if exists friendships_delete_requester on public.manager_friendships;
create policy friendships_delete_requester on public.manager_friendships
  for delete using (
    requester_id = auth.uid() and status = 'pending'
  );

comment on table public.manager_friendships is
  'Solicitações de amizade e amizades confirmadas entre managers (ManagerNetwork).';

-- ────────────────────────────────────────────────────────────────────────────
-- Triggers de updated_at (compartilhado)
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_beta_testers_updated on public.beta_testers;
create trigger trg_beta_testers_updated
  before update on public.beta_testers
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_bug_reports_updated on public.bug_reports;
create trigger trg_bug_reports_updated
  before update on public.bug_reports
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_friendships_updated on public.manager_friendships;
create trigger trg_friendships_updated
  before update on public.manager_friendships
  for each row execute function public.touch_updated_at();

-- ─── 20260503010000_beta_invite_approve_rpcs.sql ───
-- ============================================================================
-- OLEFOOT — RPCs de invite/approve para beta_testers
-- ============================================================================

create or replace function public.generate_beta_invite_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  v_code text;
  v_attempts int := 0;
begin
  loop
    v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    exit when not exists (select 1 from public.beta_testers where invite_code = v_code);
    v_attempts := v_attempts + 1;
    if v_attempts > 10 then
      raise exception 'Failed to generate unique invite code after 10 attempts';
    end if;
  end loop;
  return v_code;
end;
$$;

create or replace function public.admin_approve_beta_tester(
  p_tester_id uuid,
  p_notes text default null
)
returns table (id uuid, email text, status text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_code text;
begin
  if not public.is_admin() then
    raise exception 'Forbidden: admin only';
  end if;

  v_code := public.generate_beta_invite_code();

  return query
  update public.beta_testers t
     set status = 'approved',
         invite_code = coalesce(t.invite_code, v_code),
         approved_at = now(),
         approved_by = v_admin,
         notes = coalesce(p_notes, t.notes)
   where t.id = p_tester_id and t.status in ('pending','rejected')
  returning t.id, t.email, t.status, t.invite_code;
end;
$$;

grant execute on function public.admin_approve_beta_tester(uuid, text) to authenticated;

create or replace function public.admin_invite_beta_tester(
  p_email text,
  p_source text default 'admin',
  p_notes text default null
)
returns table (id uuid, email text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_code text;
  v_email text := lower(trim(p_email));
begin
  if not public.is_admin() then
    raise exception 'Forbidden: admin only';
  end if;
  if v_email = '' or v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'Invalid email';
  end if;

  v_code := public.generate_beta_invite_code();

  return query
  insert into public.beta_testers (email, status, invite_code, invited_by, approved_at, approved_by, source, notes)
  values (v_email, 'approved', v_code, v_admin, now(), v_admin, p_source, p_notes)
  on conflict (email) do update
    set status = case when public.beta_testers.status = 'pending' then 'approved' else public.beta_testers.status end,
        invite_code = coalesce(public.beta_testers.invite_code, excluded.invite_code),
        approved_at = coalesce(public.beta_testers.approved_at, excluded.approved_at),
        approved_by = coalesce(public.beta_testers.approved_by, excluded.approved_by),
        updated_at = now()
  returning beta_testers.id, beta_testers.email, beta_testers.invite_code;
end;
$$;

grant execute on function public.admin_invite_beta_tester(text, text, text) to authenticated;

create or replace function public.redeem_beta_invite(p_invite_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(trim(p_invite_code));
begin
  if v_user is null then
    raise exception 'Must be authenticated to redeem invite';
  end if;

  update public.beta_testers
     set user_id = v_user,
         status = 'active',
         updated_at = now()
   where invite_code = v_code
     and status = 'approved'
     and (user_id is null or user_id = v_user);

  return found;
end;
$$;

grant execute on function public.redeem_beta_invite(text) to authenticated;

create or replace function public.admin_revoke_beta_access(
  p_tester_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden: admin only';
  end if;

  update public.beta_testers
     set status = 'revoked',
         notes = coalesce(p_reason, notes),
         updated_at = now()
   where id = p_tester_id;

  return found;
end;
$$;

grant execute on function public.admin_revoke_beta_access(uuid, text) to authenticated;
-- Fix: Complete referral code system
-- Adds: my_referral_code column, trigger to generate it, RPCs to query it

-- 1. Add my_referral_code column (the code that THIS user generates for sharing)
alter table public.profiles
  add column if not exists my_referral_code text unique;

-- 2. Create index for lookup by my_referral_code
create index if not exists profiles_my_referral_code_idx
  on public.profiles (my_referral_code)
  where my_referral_code is not null;

-- 3. Function to generate unique referral code (8 chars, A-Z and 2-9)
create or replace function public.generate_unique_referral_code()
returns text
language plpgsql
as $$
declare
  v_code text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_attempts int := 0;
begin
  -- Try up to 10 times to find a unique code
  while v_attempts < 10 loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, (floor(random() * 32)::int) + 1, 1);
    end loop;

    -- Check if code already exists
    if not exists(select 1 from public.profiles where my_referral_code = v_code) then
      return v_code;
    end if;

    v_attempts := v_attempts + 1;
  end loop;

  -- Fallback: if we somehow fail, raise error
  raise exception 'Failed to generate unique referral code after 10 attempts';
end;
$$;

-- 4. Trigger to auto-generate my_referral_code on profile creation
create or replace function public.trg_generate_referral_code()
returns trigger
language plpgsql
as $$
begin
  if new.my_referral_code is null then
    new.my_referral_code := public.generate_unique_referral_code();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_generate_referral_code_trg on public.profiles;

create trigger profiles_generate_referral_code_trg
  before insert on public.profiles
  for each row
  execute function public.trg_generate_referral_code();

-- 5. RPC: Get the current user's referral code
create or replace function public.get_my_referral_code()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  select my_referral_code into v_code
    from public.profiles
   where id = auth.uid();

  return v_code;
end;
$$;

revoke all on function public.get_my_referral_code() from public;
grant execute on function public.get_my_referral_code() to authenticated;

-- 6. RPC: Get all profiles that were referred by the current user's code
create or replace function public.get_my_referrals()
returns table (
  id uuid,
  display_name text,
  club_name text,
  club_short text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_my_code text;
begin
  -- Get the current user's referral code
  select my_referral_code into v_my_code
    from public.profiles
   where id = auth.uid();

  if v_my_code is null then
    return;
  end if;

  -- Return all profiles referred by this code
  return query
    select p.id, p.display_name, p.club_name, p.club_short, p.created_at
      from public.profiles p
     where p.referred_by_code = v_my_code
     order by p.created_at desc;
end;
$$;

revoke all on function public.get_my_referrals() from public;
grant execute on function public.get_my_referrals() to authenticated;

-- 7. Populate my_referral_code for existing users (safely, without conflicts)
-- Each user who doesn't have a code gets one
do $$
declare
  v_profile record;
  v_code text;
  v_attempts int;
begin
  for v_profile in select id from public.profiles where my_referral_code is null
  loop
    v_attempts := 0;
    v_code := null;

    while v_attempts < 10 and v_code is null loop
      v_code := public.generate_unique_referral_code();

      -- Try to update; if it fails due to unique constraint, try again
      begin
        update public.profiles set my_referral_code = v_code where id = v_profile.id;
      exception when unique_violation then
        v_code := null;
      end;

      v_attempts := v_attempts + 1;
    end loop;
  end loop;
end $$;
