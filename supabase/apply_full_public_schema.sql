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

-- ─── 20260427000000_create_player_collections_table.sql ───
-- Cria tabela para armazenar coleções de jogadores
CREATE TABLE IF NOT EXISTS player_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_player_collections_collection_id ON player_collections(collection_id);
CREATE INDEX idx_player_collections_active ON player_collections(is_active);

CREATE OR REPLACE FUNCTION update_player_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER player_collections_updated_at
  BEFORE UPDATE ON player_collections
  FOR EACH ROW
  EXECUTE FUNCTION update_player_collections_updated_at();

ALTER TABLE player_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem fazer tudo em player_collections"
  ON player_collections
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Todos podem ler coleções ativas"
  ON player_collections
  FOR SELECT
  TO authenticated
  USING (is_active = true);

COMMENT ON TABLE player_collections IS 'Coleções de jogadores para organização e categorização';

-- Insere coleções iniciais
INSERT INTO player_collections (collection_id, name, description)
VALUES
  ('genesis', 'Genesis', 'Coleção inicial do Olefoot'),
  ('legends', 'Legends', 'Lendas do futebol mundial'),
  ('brasil', 'Brasil', 'Jogadores brasileiros históricos')
ON CONFLICT (collection_id) DO NOTHING;

-- ─── 20260427000002_profile_onboarding.sql ───
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

-- ─── 20260427012821_beta_program_and_social.sql ───
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

-- ─── 20260427013353_beta_invite_approve_rpcs.sql ───
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

-- ─── 20260427124302_add_increment_vocabulary_usage_function.sql ───
-- Função RPC para incrementar contador de uso de vocabulário
CREATE OR REPLACE FUNCTION public.increment_vocabulary_usage(p_phrase_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.football_vocabulary
  SET
    confirm_count = confirm_count + 1,
    updated_at = now()
  WHERE id = p_phrase_id AND is_active = true;
END;
$$;

-- ─── 20260427134038_fix_favorite_team_ids.sql ───
-- Correção de IDs de times favoritos que podem estar trocados
-- Ceará deve ser ID 152 (não 129)
-- Athletico-PR deve ser ID 129 (não 152)

-- Atualiza registros onde o ID está trocado
update public.profiles
set onboarding_data = jsonb_set(
  onboarding_data,
  '{favoriteRealTeam}',
  jsonb_build_object(
    'id', 152,
    'name', 'Ceará',
    'logo', 'https://media.api-sports.io/football/teams/152.png'
  )
)
where onboarding_data->>'favoriteRealTeam' is not null
  and onboarding_data->'favoriteRealTeam'->>'name' = 'Ceará'
  and (onboarding_data->'favoriteRealTeam'->>'id')::int != 152;

update public.profiles
set onboarding_data = jsonb_set(
  onboarding_data,
  '{favoriteRealTeam}',
  jsonb_build_object(
    'id', 129,
    'name', 'Athletico-PR',
    'logo', 'https://media.api-sports.io/football/teams/129.png'
  )
)
where onboarding_data->>'favoriteRealTeam' is not null
  and onboarding_data->'favoriteRealTeam'->>'name' = 'Athletico-PR'
  and (onboarding_data->'favoriteRealTeam'->>'id')::int != 129;

-- Comentário para log
comment on table public.profiles is 'Correção aplicada em 2026-04-27: IDs de Ceará (152) e Athletico-PR (129) verificados e corrigidos';

-- ─── 20260427135532_global_league_mvp.sql ───
-- ============================================
-- GLOBAL LEAGUE MVP - TABELAS SUPABASE
-- ============================================

-- 1. Tabela de Times
CREATE TABLE IF NOT EXISTS global_league_teams (
  id TEXT PRIMARY KEY,
  manager_id TEXT NOT NULL UNIQUE,
  club_name TEXT NOT NULL,
  club_short TEXT NOT NULL,
  overall INTEGER NOT NULL,

  -- Divisão atual
  division INTEGER,
  "position" INTEGER,
  previous_position INTEGER,

  -- Estatísticas dos Playoffs
  playoff_points INTEGER DEFAULT 0,
  playoff_matches_played INTEGER DEFAULT 0,
  playoff_wins INTEGER DEFAULT 0,
  playoff_draws INTEGER DEFAULT 0,
  playoff_losses INTEGER DEFAULT 0,
  playoff_goals_for INTEGER DEFAULT 0,
  playoff_goals_against INTEGER DEFAULT 0,

  -- Estatísticas da Liga Oficial
  points INTEGER DEFAULT 0,
  matches_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  goals_for INTEGER DEFAULT 0,
  goals_against INTEGER DEFAULT 0,
  goal_difference INTEGER DEFAULT 0,

  -- Forma recente (JSON array)
  recent_form JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_division CHECK (division IS NULL OR (division >= 1 AND division <= 3)),
  CONSTRAINT valid_overall CHECK (overall >= 40 AND overall <= 99)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_global_teams_manager ON global_league_teams(manager_id);
CREATE INDEX IF NOT EXISTS idx_global_teams_division ON global_league_teams(division);
CREATE INDEX IF NOT EXISTS idx_global_teams_points ON global_league_teams(points DESC);
CREATE INDEX IF NOT EXISTS idx_global_teams_playoff_points ON global_league_teams(playoff_points DESC);

-- 2. Tabela de Rodadas
CREATE TABLE IF NOT EXISTS global_league_rounds (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  round_number INTEGER NOT NULL,
  round_type TEXT NOT NULL,
  phase TEXT,
  is_returning BOOLEAN DEFAULT FALSE,

  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled',

  -- Timestamps
  scheduled_kickoff_ms BIGINT NOT NULL,
  actual_kickoff_ms BIGINT,
  finished_at_ms BIGINT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_round_type CHECK (round_type IN ('playoff', 'league')),
  CONSTRAINT valid_status CHECK (status IN ('scheduled', 'live', 'finished')),
  CONSTRAINT unique_round_per_season UNIQUE (season_id, round_number, round_type)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_global_rounds_season ON global_league_rounds(season_id);
CREATE INDEX IF NOT EXISTS idx_global_rounds_status ON global_league_rounds(status);
CREATE INDEX IF NOT EXISTS idx_global_rounds_kickoff ON global_league_rounds(scheduled_kickoff_ms);

-- 3. Tabela de Partidas
CREATE TABLE IF NOT EXISTS global_league_fixtures (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES global_league_rounds(id) ON DELETE CASCADE,
  division TEXT NOT NULL,

  -- Times
  home_team_id TEXT NOT NULL REFERENCES global_league_teams(id) ON DELETE CASCADE,
  away_team_id TEXT NOT NULL REFERENCES global_league_teams(id) ON DELETE CASCADE,
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  home_overall INTEGER NOT NULL,
  away_overall INTEGER NOT NULL,

  -- Placar
  score_home INTEGER DEFAULT 0,
  score_away INTEGER DEFAULT 0,
  current_minute INTEGER DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled',

  -- Timestamps
  kickoff_ms BIGINT,
  finished_at_ms BIGINT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_fixture_status CHECK (status IN ('scheduled', 'live', 'finished')),
  CONSTRAINT different_teams CHECK (home_team_id != away_team_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_global_fixtures_round ON global_league_fixtures(round_id);
CREATE INDEX IF NOT EXISTS idx_global_fixtures_home_team ON global_league_fixtures(home_team_id);
CREATE INDEX IF NOT EXISTS idx_global_fixtures_away_team ON global_league_fixtures(away_team_id);
CREATE INDEX IF NOT EXISTS idx_global_fixtures_division ON global_league_fixtures(division);
CREATE INDEX IF NOT EXISTS idx_global_fixtures_status ON global_league_fixtures(status);

-- 4. Tabela de Eventos
CREATE TABLE IF NOT EXISTS global_league_events (
  id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL REFERENCES global_league_fixtures(id) ON DELETE CASCADE,

  -- Tipo de evento
  event_type TEXT NOT NULL,

  -- Detalhes
  minute INTEGER NOT NULL,
  side TEXT NOT NULL,
  player_name TEXT,
  player_id TEXT,
  "text" TEXT NOT NULL,
  highlight BOOLEAN DEFAULT FALSE,

  -- Timestamp
  timestamp_ms BIGINT NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_event_type CHECK (event_type IN ('goal', 'yellow_card', 'red_card', 'injury', 'substitution', 'pressure', 'miss')),
  CONSTRAINT valid_side CHECK (side IN ('home', 'away')),
  CONSTRAINT valid_minute CHECK (minute >= 0 AND minute <= 90)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_global_events_fixture ON global_league_events(fixture_id);
CREATE INDEX IF NOT EXISTS idx_global_events_type ON global_league_events(event_type);
CREATE INDEX IF NOT EXISTS idx_global_events_minute ON global_league_events(minute);

-- 5. Tabela de Estado da Liga (singleton)
CREATE TABLE IF NOT EXISTS global_league_state (
  id TEXT PRIMARY KEY DEFAULT 'current',
  season_id TEXT NOT NULL,
  season_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting_teams',

  -- Configurações
  min_teams_required INTEGER DEFAULT 32,
  teams_per_division INTEGER DEFAULT 11,
  promotion_percentage DECIMAL(3,2) DEFAULT 0.10,
  relegation_percentage DECIMAL(3,2) DEFAULT 0.10,

  -- Rodadas atuais
  current_playoff_round INTEGER,
  current_league_round INTEGER,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_league_status CHECK (status IN ('waiting_teams', 'playoffs', 'active', 'season_ended')),
  CONSTRAINT singleton_check CHECK (id = 'current')
);

-- Inserir estado inicial
INSERT INTO global_league_state (id, season_id, season_name, status)
VALUES ('current', 'season_2026', 'OLEFOOT LIGA GLOBAL 2026', 'waiting_teams')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- TRIGGERS PARA ATUALIZAÇÃO AUTOMÁTICA
-- ============================================

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas
DROP TRIGGER IF EXISTS update_global_teams_updated_at ON global_league_teams;
CREATE TRIGGER update_global_teams_updated_at
  BEFORE UPDATE ON global_league_teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_global_rounds_updated_at ON global_league_rounds;
CREATE TRIGGER update_global_rounds_updated_at
  BEFORE UPDATE ON global_league_rounds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_global_fixtures_updated_at ON global_league_fixtures;
CREATE TRIGGER update_global_fixtures_updated_at
  BEFORE UPDATE ON global_league_fixtures
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_global_state_updated_at ON global_league_state;
CREATE TRIGGER update_global_state_updated_at
  BEFORE UPDATE ON global_league_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS ÚTEIS
-- ============================================

-- View: Classificação dos Playoffs
CREATE OR REPLACE VIEW v_playoff_standings AS
SELECT
  id,
  manager_id,
  club_name,
  club_short,
  overall,
  playoff_points,
  playoff_matches_played,
  playoff_wins,
  playoff_draws,
  playoff_losses,
  playoff_goals_for,
  playoff_goals_against,
  (playoff_goals_for - playoff_goals_against) AS playoff_goal_difference,
  ROW_NUMBER() OVER (
    ORDER BY
      playoff_points DESC,
      playoff_wins DESC,
      (playoff_goals_for - playoff_goals_against) DESC,
      playoff_goals_for DESC,
      club_name ASC
  ) AS playoff_position
FROM global_league_teams
ORDER BY playoff_position;

-- View: Classificação por Divisão
CREATE OR REPLACE VIEW v_division_standings AS
SELECT
  id,
  manager_id,
  club_name,
  club_short,
  overall,
  division,
  points,
  matches_played,
  wins,
  draws,
  losses,
  goals_for,
  goals_against,
  goal_difference,
  recent_form,
  "position",
  previous_position,
  ROW_NUMBER() OVER (
    PARTITION BY division
    ORDER BY
      points DESC,
      wins DESC,
      goal_difference DESC,
      goals_for DESC,
      club_name ASC
  ) AS calculated_position
FROM global_league_teams
WHERE division IS NOT NULL
ORDER BY division, calculated_position;

-- View: Próximas Rodadas
CREATE OR REPLACE VIEW v_upcoming_rounds AS
SELECT
  r.id,
  r.season_id,
  r.round_number,
  r.round_type,
  r.status,
  r.scheduled_kickoff_ms,
  COUNT(f.id) AS total_fixtures,
  COUNT(CASE WHEN f.status = 'finished' THEN 1 END) AS finished_fixtures
FROM global_league_rounds r
LEFT JOIN global_league_fixtures f ON f.round_id = r.id
WHERE r.status IN ('scheduled', 'live')
GROUP BY r.id, r.season_id, r.round_number, r.round_type, r.status, r.scheduled_kickoff_ms
ORDER BY r.scheduled_kickoff_ms ASC;

-- ============================================
-- FUNÇÕES ÚTEIS
-- ============================================

-- Função: Obter times de uma divisão
CREATE OR REPLACE FUNCTION get_division_teams(div INTEGER)
RETURNS TABLE (
  id TEXT,
  club_name TEXT,
  points INTEGER,
  team_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.club_name,
    t.points,
    t."position" as team_position
  FROM global_league_teams t
  WHERE t.division = div
  ORDER BY t."position" ASC;
END;
$$ LANGUAGE plpgsql;

-- Função: Obter estatísticas da liga
CREATE OR REPLACE FUNCTION get_league_stats()
RETURNS TABLE (
  total_teams INTEGER,
  teams_in_playoffs INTEGER,
  teams_in_league INTEGER,
  total_goals INTEGER,
  total_matches INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_teams,
    COUNT(CASE WHEN division IS NULL THEN 1 END)::INTEGER AS teams_in_playoffs,
    COUNT(CASE WHEN division IS NOT NULL THEN 1 END)::INTEGER AS teams_in_league,
    SUM(goals_for)::INTEGER AS total_goals,
    SUM(matches_played)::INTEGER AS total_matches
  FROM global_league_teams;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================

-- Habilitar RLS
ALTER TABLE global_league_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_league_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_league_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_league_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_league_state ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Allow public read access" ON global_league_teams;
DROP POLICY IF EXISTS "Allow public read access" ON global_league_rounds;
DROP POLICY IF EXISTS "Allow public read access" ON global_league_fixtures;
DROP POLICY IF EXISTS "Allow public read access" ON global_league_events;
DROP POLICY IF EXISTS "Allow public read access" ON global_league_state;
DROP POLICY IF EXISTS "Allow authenticated insert" ON global_league_teams;
DROP POLICY IF EXISTS "Allow authenticated update" ON global_league_teams;
DROP POLICY IF EXISTS "Allow authenticated insert" ON global_league_rounds;
DROP POLICY IF EXISTS "Allow authenticated update" ON global_league_rounds;
DROP POLICY IF EXISTS "Allow authenticated insert" ON global_league_fixtures;
DROP POLICY IF EXISTS "Allow authenticated update" ON global_league_fixtures;
DROP POLICY IF EXISTS "Allow authenticated insert" ON global_league_events;
DROP POLICY IF EXISTS "Allow authenticated update" ON global_league_state;

-- Política: Todos podem ler
CREATE POLICY "Allow public read access" ON global_league_teams FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON global_league_rounds FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON global_league_fixtures FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON global_league_events FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON global_league_state FOR SELECT USING (true);

-- Política: Apenas autenticados podem inserir/atualizar
CREATE POLICY "Allow authenticated insert" ON global_league_teams FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update" ON global_league_teams FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated insert" ON global_league_rounds FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update" ON global_league_rounds FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated insert" ON global_league_fixtures FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update" ON global_league_fixtures FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated insert" ON global_league_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update" ON global_league_state FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON TABLE global_league_teams IS 'Times cadastrados na Liga Global MVP';
COMMENT ON TABLE global_league_rounds IS 'Rodadas dos playoffs e da liga oficial';
COMMENT ON TABLE global_league_fixtures IS 'Partidas de cada rodada';
COMMENT ON TABLE global_league_events IS 'Eventos que acontecem durante as partidas';
COMMENT ON TABLE global_league_state IS 'Estado global da liga (singleton)';

COMMENT ON VIEW v_playoff_standings IS 'Classificação dos playoffs ordenada por pontos';
COMMENT ON VIEW v_division_standings IS 'Classificação por divisão ordenada por pontos';
COMMENT ON VIEW v_upcoming_rounds IS 'Próximas rodadas agendadas ou em andamento';

-- ─── 20260427160000_global_league_cron.sql ───
-- ============================================================================
-- Olefoot Liga — Cron job para o tick da Edge Function global-league-tick
-- ============================================================================
-- Habilita pg_cron + pg_net e agenda chamada HTTP a cada 1 minuto à Edge
-- Function que avança rodadas agendadas. URL e service role key são lidos
-- de Vault para não vazarem no schema.
--
-- ANTES DE RODAR ESTA MIGRATION você precisa setar 2 segredos no Vault:
--
--   select vault.create_secret(
--     'https://<SEU_PROJECT_REF>.supabase.co/functions/v1/global-league-tick',
--     'global_league_tick_url',
--     'URL pública da Edge Function global-league-tick'
--   );
--
--   select vault.create_secret(
--     '<SEU_SERVICE_ROLE_KEY>',
--     'global_league_tick_service_role_key',
--     'Service role key usada pela cron para chamar a Edge Function'
--   );
--
-- Depois deploy a Edge Function:
--   supabase functions deploy global-league-tick --no-verify-jwt
--
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Permitir execução de cron pelo postgres role
grant usage on schema cron to postgres;

-- Remover job anterior se existir (idempotente em re-deploys)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'global-league-tick') then
    perform cron.unschedule('global-league-tick');
  end if;
end$$;

-- Agendar tick a cada 1 minuto
select cron.schedule(
  'global-league-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'global_league_tick_url' limit 1),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'global_league_tick_service_role_key' limit 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);

comment on extension pg_cron is 'Job scheduler — usado pelo Olefoot para tick da Liga Global';
comment on extension pg_net is 'Async HTTP client — usado pelo cron para chamar Edge Functions';

-- ─── 20260427170000_global_league_realtime.sql ───
-- Habilita Realtime para tabelas da Liga Global.
-- Clientes assinam mudanças e re-hidratam o estado quando o servidor (Edge
-- Function global-league-tick) avança rodadas, simula partidas, etc.

alter publication supabase_realtime add table public.global_league_teams;
alter publication supabase_realtime add table public.global_league_rounds;
alter publication supabase_realtime add table public.global_league_fixtures;
alter publication supabase_realtime add table public.global_league_events;
alter publication supabase_realtime add table public.global_league_state;

-- ─── 20260427180000_global_league_team_injuries.sql ───
-- Lesões α (server-only): debuff temporário no overall do time.
-- Uma lesão num jogo registra injury_modifier (-2 a -4) e injury_rounds_remaining
-- (1 ou 2). A cada rodada futura, o tick decrementa o contador; quando chega
-- a 0, o modifier é zerado. Não modela jogador individual ainda.

alter table public.global_league_teams
  add column if not exists injury_modifier int not null default 0,
  add column if not exists injury_rounds_remaining int not null default 0;

comment on column public.global_league_teams.injury_modifier is
  'Debuff temporário no overall do time por lesões. 0 = sem lesão. Tipicamente entre -4 e 0.';
comment on column public.global_league_teams.injury_rounds_remaining is
  'Quantas rodadas restam de debuff. 0 = sem lesão. Decrementado a cada tick que joga.';

-- ─── 20260427210000_manager_squad.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — manager_squad
--
-- Persistência server-side do plantel + escalação de cada manager.
-- Estrutura: 1 row por user_id, com `players` (jsonb array) e `lineup` (jsonb map).
-- Idempotente: upsert overwrite total. Cliente envia snapshot completo.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.manager_squad (
  user_id uuid primary key references auth.users(id) on delete cascade,
  players jsonb not null default '[]'::jsonb,
  lineup jsonb not null default '{}'::jsonb,
  formation_scheme text,
  updated_at timestamptz not null default now()
);

comment on table public.manager_squad is
  'Plantel + escalação por manager (snapshot client-side). 1 row por user.';
comment on column public.manager_squad.players is
  'Array<PlayerEntity> serializado integralmente do client.';
comment on column public.manager_squad.lineup is
  'Map<slotId, playerId> da escalação ativa.';

create index if not exists idx_manager_squad_updated
  on public.manager_squad (updated_at desc);

alter table public.manager_squad enable row level security;

drop policy if exists "manager_squad_select_own" on public.manager_squad;
create policy "manager_squad_select_own"
  on public.manager_squad for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "manager_squad_insert_own" on public.manager_squad;
create policy "manager_squad_insert_own"
  on public.manager_squad for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "manager_squad_update_own" on public.manager_squad;
create policy "manager_squad_update_own"
  on public.manager_squad for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on table public.manager_squad to authenticated;

-- updated_at trigger
create or replace function public.touch_manager_squad_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_manager_squad on public.manager_squad;
create trigger trg_touch_manager_squad
  before update on public.manager_squad
  for each row
  execute function public.touch_manager_squad_updated_at();

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

-- ─── 20260502000000_market_activities.sql ───
-- market_activities: feed público de atividades do mercado
-- Registra compras, vendas e leilões ganhos pelos managers

create table if not exists public.market_activities (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('purchase', 'sale', 'auction_won', 'listing')),
  manager_id    uuid references auth.users(id) on delete set null,
  manager_name  text not null default 'Manager',
  club_name     text,
  player_name   text not null,
  player_ovr    integer,
  player_pos    text,
  price_exp     bigint,
  created_at    timestamptz not null default now()
);

-- Índice para feed cronológico
create index if not exists market_activities_created_at_idx
  on public.market_activities (created_at desc);

-- RLS: leitura pública, escrita apenas pelo próprio manager
alter table public.market_activities enable row level security;

create policy "market_activities_select_all"
  on public.market_activities for select
  using (true);

create policy "market_activities_insert_own"
  on public.market_activities for insert
  with check (manager_id = auth.uid() or manager_id is null);

-- ─── 20260502000001_pro_payouts_pipeline.sql ───
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

-- ─── 20260502020000_position_knowledge.sql ───
-- Migration: position_knowledge
-- Adiciona coluna JSONB para persistir o DNA de lenda evoluído por jogador.
-- Aplicada em: players (elenco normal) e legacy_players (lendas).

-- ── players ──────────────────────────────────────────────────────────────────
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS position_knowledge JSONB DEFAULT NULL;

COMMENT ON COLUMN public.players.position_knowledge IS
  'DNA de lenda evoluído: actionWeights, traits, sessionsCompleted, legendSource. Atualizado pós-partida pelo syncPlayerToSupabase.';

-- ── legacy_players ────────────────────────────────────────────────────────────
ALTER TABLE public.legacy_players
  ADD COLUMN IF NOT EXISTS position_knowledge JSONB DEFAULT NULL;

COMMENT ON COLUMN public.legacy_players.position_knowledge IS
  'DNA de lenda evoluído: actionWeights, traits, sessionsCompleted, legendSource. Atualizado por syncLegacyPlayerPositionKnowledge.';

-- Índice GIN para queries futuras sobre traits/actionWeights (opcional mas útil).
CREATE INDEX IF NOT EXISTS idx_players_position_knowledge
  ON public.players USING GIN (position_knowledge)
  WHERE position_knowledge IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_legacy_players_position_knowledge
  ON public.legacy_players USING GIN (position_knowledge)
  WHERE position_knowledge IS NOT NULL;

-- ─── 20260502030000_profile_username.sql ───
-- Sistema de username auto-gerado: firstName_clubShort (ex.: jonhnes_ofc).
-- Unicidade garantida por club_short ser UNIQUE na tabela.

-- 1a. Deduplica club_short existentes (sufixo numérico nas cópias).
do $$
declare
  dup record;
  duped record;
  v_short text;
  i int;
begin
  for dup in
    select club_short
    from public.profiles
    where club_short is not null
    group by club_short
    having count(*) > 1
  loop
    v_short := dup.club_short;
    i := 1;
    for duped in
      select id from public.profiles
      where club_short = v_short
      order by created_at asc
      offset 1
    loop
      update public.profiles
      set club_short = v_short || i::text
      where id = duped.id;
      i := i + 1;
    end loop;
  end loop;
end;
$$;

-- 1b. Torna club_short único (impede dois clubes com mesmas iniciais).
alter table public.profiles
  add constraint profiles_club_short_unique unique (club_short);

-- 2. Coluna username — derivada de display_name + club_short.
alter table public.profiles
  add column if not exists username text;

create unique index if not exists profiles_username_unique
  on public.profiles (username)
  where username is not null;

-- 3. Função utilitária para gerar username limpo.
create or replace function public.compute_username(p_display_name text, p_club_short text)
returns text
language plpgsql
immutable
as $$
declare
  v_first text;
  v_short text;
begin
  if p_display_name is null or p_club_short is null then
    return null;
  end if;
  -- Remove acentos, lowercase, só alfanumérico
  v_first := regexp_replace(
    lower(translate(
      p_display_name,
      'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñ',
      'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
    )),
    '[^a-z0-9]', '', 'g'
  );
  v_short := lower(regexp_replace(p_club_short, '[^a-zA-Z0-9]', '', 'g'));
  if v_first = '' or v_short = '' then
    return null;
  end if;
  return v_first || '_' || v_short;
end;
$$;

-- 4. Trigger: auto-atualiza username quando display_name ou club_short mudam.
create or replace function public.trg_update_username()
returns trigger
language plpgsql
as $$
begin
  new.username := public.compute_username(new.display_name, new.club_short);
  return new;
end;
$$;

drop trigger if exists trg_profiles_username on public.profiles;
create trigger trg_profiles_username
  before insert or update of display_name, club_short on public.profiles
  for each row
  execute function public.trg_update_username();

-- 5. Backfill perfis existentes.
update public.profiles
set username = public.compute_username(display_name, club_short)
where display_name is not null
  and club_short is not null
  and username is null;

-- 6. RPC para checar se iniciais já estão em uso.
create or replace function public.check_club_short_available(p_club_short text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return not exists (
    select 1 from public.profiles
    where lower(club_short) = lower(p_club_short)
      and id != coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
end;
$$;

revoke all on function public.check_club_short_available(text) from public;
grant execute on function public.check_club_short_available(text) to authenticated, anon;

-- 7. RPC para buscar perfil por username (lookup de amigos).
create or replace function public.find_profile_by_username(p_username text)
returns table (
  id uuid,
  username text,
  display_name text,
  club_name text,
  club_short text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
    select p.id, p.username, p.display_name, p.club_name, p.club_short
    from public.profiles p
    where p.username = lower(p_username)
    limit 1;
end;
$$;

revoke all on function public.find_profile_by_username(text) from public;
grant execute on function public.find_profile_by_username(text) to authenticated;

-- 8. Atualiza get_my_onboarding_profile para incluir username.
create or replace function public.get_my_onboarding_profile()
returns table (
  display_name text,
  club_name text,
  club_short text,
  onboarding_data jsonb,
  username text
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
    select p.display_name, p.club_name, p.club_short, p.onboarding_data, p.username
      from public.profiles p
     where p.id = v_uid
     limit 1;
end;
$$;

revoke all on function public.get_my_onboarding_profile() from public;
grant execute on function public.get_my_onboarding_profile() to authenticated;

-- ─── 20260502030001_wallet_credits_exp.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — wallet_credits: adiciona exp_amount
--
-- Permite creditar EXP (moeda in-game) via Supabase, com a mesma semântica
-- de applied_at que já existe para bro_cents.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.wallet_credits
  add column if not exists exp_amount bigint not null default 0;

comment on column public.wallet_credits.exp_amount is
  'EXP a creditar ao manager. Aplicado pelo cliente em applyPendingCredits() junto com bro_cents.';

-- ─── 20260502040000_manager_game_state.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — manager_game_state
--
-- Persistência server-side dos slices críticos do OlefootGameState que
-- ficavam apenas no localStorage e se perdiam ao trocar de browser/dispositivo.
--
-- Estratégia: snapshot JSONB por slice, upsert debounced após eventos chave.
-- Hidratação no boot via ManagerGameStateHydrator (antes da cerimônia).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.manager_game_state (
  user_id            uuid primary key references auth.users(id) on delete cascade,

  -- CRÍTICO
  structures         jsonb,   -- ClubStructuresState
  league_season      jsonb,   -- LeagueSeasonState
  results            jsonb,   -- PastResult[]
  trophy_ids         jsonb,   -- string[]
  competitive_ranking jsonb,  -- CompetitiveRankingState
  olefoot_ranked     jsonb,   -- OlefootRankedState

  -- IMPORTANTE
  player_health      jsonb,   -- Record<string, PlayerHealth>
  player_season_ledger jsonb, -- PlayerSeasonLedgerMap
  player_moral       jsonb,   -- Record<string, PlayerMoral>
  shop_inventory     jsonb,   -- Record<string, number>
  olefoot_league     jsonb,   -- OlefootLeagueState
  manager_relation   jsonb,   -- Record<string, number>
  saved_tactics      jsonb,   -- SavedTacticPlan[]
  staff              jsonb,   -- StaffState

  updated_at         timestamptz not null default now()
);

comment on table public.manager_game_state is
  'Snapshot dos slices críticos do OlefootGameState. Upsert debounced após eventos chave. 1 row por manager.';

create index if not exists idx_manager_game_state_updated
  on public.manager_game_state (updated_at desc);

alter table public.manager_game_state enable row level security;

create policy "manager_game_state_select_own"
  on public.manager_game_state for select
  to authenticated using (user_id = auth.uid());

create policy "manager_game_state_insert_own"
  on public.manager_game_state for insert
  to authenticated with check (user_id = auth.uid());

create policy "manager_game_state_update_own"
  on public.manager_game_state for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on table public.manager_game_state to authenticated;

create or replace function public.touch_manager_game_state_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_touch_manager_game_state on public.manager_game_state;
create trigger trg_touch_manager_game_state
  before update on public.manager_game_state
  for each row execute function public.touch_manager_game_state_updated_at();

-- ─── 20260502050000_welcome_pack_grants.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — welcome_pack_grants
--
-- Idempotência real por manager: garante que cada user_id recebe o welcome
-- pack exatamente uma vez, independente de localStorage ou cache.
-- Substitui o guard local (welcomeGenesisPackVersion no localStorage).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.welcome_pack_grants (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  pack_version int not null default 1,
  granted_at timestamptz not null default now()
);

alter table public.welcome_pack_grants enable row level security;

create policy "welcome_pack_grants_select_own"
  on public.welcome_pack_grants for select
  to authenticated using (user_id = auth.uid());

grant select on table public.welcome_pack_grants to authenticated;

comment on table public.welcome_pack_grants is
  'Registro server-side de entrega do welcome pack por manager. Idempotência real — substitui guard localStorage.';

-- Recria claim_welcome_pack com verificação por manager
create or replace function public.claim_welcome_pack(p_manager_id uuid)
returns table (
  claimed          boolean,
  queue_position   bigint,
  remaining        bigint,
  welcome_packs_claimed bigint,
  welcome_packs_limit   bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed bigint;
  v_limit   bigint;
  v_already boolean;
begin
  -- Verificar se este manager já recebeu (idempotência por manager)
  select exists(
    select 1 from public.welcome_pack_grants where user_id = p_manager_id
  ) into v_already;

  if v_already then
    select lc.welcome_packs_claimed, lc.welcome_packs_limit
      into v_claimed, v_limit
      from public.launch_counters lc where lc.id = 1;
    return query select
      false                    as claimed,
      (v_claimed + 1)          as queue_position,
      (v_limit - v_claimed)    as remaining,
      v_claimed                as welcome_packs_claimed,
      v_limit                  as welcome_packs_limit;
    return;
  end if;

  -- Lock singleton para incremento atômico
  select lc.welcome_packs_claimed, lc.welcome_packs_limit
    into v_claimed, v_limit
    from public.launch_counters lc where lc.id = 1
    for update;

  if v_claimed < v_limit then
    update public.launch_counters
       set welcome_packs_claimed = welcome_packs_claimed + 1,
           updated_at = now()
     where id = 1
     returning launch_counters.welcome_packs_claimed into v_claimed;

    -- Registrar entrega para este manager
    insert into public.welcome_pack_grants (user_id, pack_version)
    values (p_manager_id, 2)
    on conflict (user_id) do nothing;

    return query select
      true                     as claimed,
      v_claimed                as queue_position,
      (v_limit - v_claimed)    as remaining,
      v_claimed                as welcome_packs_claimed,
      v_limit                  as welcome_packs_limit;
  else
    return query select
      false                    as claimed,
      (v_claimed + 1)          as queue_position,
      0::bigint                as remaining,
      v_claimed                as welcome_packs_claimed,
      v_limit                  as welcome_packs_limit;
  end if;
end;
$$;

revoke all on function public.claim_welcome_pack(uuid) from public;
grant execute on function public.claim_welcome_pack(uuid) to authenticated;

-- ─── 20260502060000_platform_data.sql ───
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

-- ─── 20260502070000_global_league_state.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — global_league_state (NO-OP)
--
-- Esta migration tentava criar `global_league_state` com schema (id text PK,
-- state jsonb). Mas a tabela já tinha sido criada em
-- 20260427135532_global_league_mvp.sql com o schema relacional (season_id,
-- status, current_playoff_round, current_league_round, min_teams_required,
-- ...) que é o que cliente e server usam.
--
-- O `CREATE TABLE IF NOT EXISTS` impedia que essa migration criasse algo, mas
-- o arquivo confundia leitores. Mantida vazia para preservar o histórico de
-- migrations sem alterar o estado do banco. Sem rollback necessário.
-- ═══════════════════════════════════════════════════════════════════════════

select 1 as global_league_state_noop_2026_05_02;

-- ─── 20260506000000_global_league_alltime_stats.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — Liga Global: estatísticas ALL-TIME
--
-- Adiciona colunas all_time_* em global_league_teams para acumular pontos,
-- vitórias, gols etc. ao longo de todas as temporadas. Diferente das colunas
-- `points`/`wins`/etc. (que zeram a cada temporada para reorganização de
-- divisões via promoção/rebaixamento), as all_time_* JAMAIS zeram.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE global_league_teams
  ADD COLUMN IF NOT EXISTS all_time_points INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS all_time_matches_played INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS all_time_wins INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS all_time_draws INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS all_time_losses INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS all_time_goals_for INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS all_time_goals_against INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS all_time_seasons_played INTEGER DEFAULT 0 NOT NULL;

-- Backfill: copia os valores atuais (que ainda não foram zerados) como base
-- inicial. Times que já passaram por reset perdem histórico anterior, mas a
-- partir daqui o all-time acumula corretamente.
UPDATE global_league_teams
SET
  all_time_points = COALESCE(points, 0),
  all_time_matches_played = COALESCE(matches_played, 0),
  all_time_wins = COALESCE(wins, 0),
  all_time_draws = COALESCE(draws, 0),
  all_time_losses = COALESCE(losses, 0),
  all_time_goals_for = COALESCE(goals_for, 0),
  all_time_goals_against = COALESCE(goals_against, 0)
WHERE all_time_points = 0 AND points > 0;

CREATE INDEX IF NOT EXISTS idx_global_teams_all_time_points
  ON global_league_teams (all_time_points DESC);

-- ─── 20260506000001_global_league_match_slots.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — Liga Global: slots fixos por dia + conceito de "OleFoot day"
--
-- Etapa 2 da reorganização da Liga Global. Em vez de rodadas 24/7 a cada 5min,
-- as rodadas só podem acontecer DENTRO de janelas de slot (default 5/dia).
-- O dia OleFoot acompanha a UTC date atual.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE global_league_state
  ADD COLUMN IF NOT EXISTS match_slots JSONB
    DEFAULT '["05:30","11:00","15:00","19:00","21:30"]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS slot_duration_min INTEGER
    DEFAULT 30 NOT NULL,
  ADD COLUMN IF NOT EXISTS current_olefoot_day DATE
    DEFAULT CURRENT_DATE NOT NULL;

COMMENT ON COLUMN global_league_state.match_slots IS
  'Janelas (hh:mm UTC) onde rodadas podem ser disputadas. Default: 5 slots/dia.';
COMMENT ON COLUMN global_league_state.slot_duration_min IS
  'Duração de cada slot em minutos (default 30 = 6 rodadas de 5min).';
COMMENT ON COLUMN global_league_state.current_olefoot_day IS
  'Dia OleFoot atual (UTC). Atualizado pela Edge Function ao virar a meia-noite.';

-- ─── 20260506000002_global_league_competition_cycle.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — Liga Global: ciclo de "Competição" longa (carry-over de pontos)
--
-- Etapa 3. Em vez de pontos zerarem ao fim de cada season (~110min), os pontos
-- agora acumulam por TODA a competição (default 7 dias). Promoção/rebaixamento
-- entre seasons preserva pontos (soft mode). Reset hard só ao fim do ciclo.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE global_league_state
  ADD COLUMN IF NOT EXISTS competition_started_at TIMESTAMPTZ
    DEFAULT NOW() NOT NULL,
  ADD COLUMN IF NOT EXISTS competition_duration_days INTEGER
    DEFAULT 7 NOT NULL,
  ADD COLUMN IF NOT EXISTS competition_id TEXT
    DEFAULT ('competition_' || extract(epoch from now())::bigint::text) NOT NULL;

COMMENT ON COLUMN global_league_state.competition_started_at IS
  'Início da competição atual. Pontos acumulam até completion_started_at + duration_days.';
COMMENT ON COLUMN global_league_state.competition_duration_days IS
  'Duração de uma competição em dias (default 7). Ao fim, zera pontos da temporada (all-time intacto).';
COMMENT ON COLUMN global_league_state.competition_id IS
  'ID da competição atual. Muda ao fim do ciclo.';

-- Inicializa para o registro existente
UPDATE global_league_state
SET competition_started_at = COALESCE(competition_started_at, NOW()),
    competition_duration_days = COALESCE(competition_duration_days, 7),
    competition_id = COALESCE(competition_id, 'competition_' || extract(epoch from now())::bigint::text)
WHERE id = 'current';

-- ─── 20260510000000_global_league_yellow_cards_suspension.sql ───
-- Adiciona acúmulo de cartões amarelos e suspensões por time na Liga Global.
-- yellow_card_count: contador de amarelos na competição atual (zera após suspensão).
-- suspension_rounds_remaining: rodadas de suspensão pendentes (penaliza OVR efetivo em -5).

ALTER TABLE global_league_teams
  ADD COLUMN IF NOT EXISTS yellow_card_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suspension_rounds_remaining INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN global_league_teams.yellow_card_count IS
  'Amarelos acumulados na competição atual. Zera ao atingir 3 (gera 1 rodada de suspensão).';
COMMENT ON COLUMN global_league_teams.suspension_rounds_remaining IS
  'Rodadas de suspensão pendentes. Enquanto > 0, OVR efetivo é reduzido em 5 pontos.';

-- ─── 20260518000000_manager_state_academy_inbox.sql ───
-- ============================================================================
-- Persistência cross-browser do queue da Academia OLE + inbox do manager
-- ============================================================================
-- Antes: managerProspectArtQueue e inbox viviam só no localStorage.
-- Manager criava prospect num browser, admin processava no MESMO browser,
-- e se o manager logava noutro device a carta entregue não aparecia.
--
-- Agora: ambos os slices vão pro Supabase como JSONB. O game state hydrator
-- traz de volta no boot e o reducer continua mutando em memória.
-- ============================================================================

alter table public.manager_game_state
  add column if not exists manager_prospect_art_queue jsonb,
  add column if not exists inbox jsonb;

-- Sem índices: campos são lidos só pelo próprio user_id (já indexado como PK).
-- Sem RLS extra: a tabela já tem RLS por user_id (mesma policy dos outros slices).

-- ─── 20260518010000_manager_state_global_league_milestones.sql ───
-- ============================================================================
-- Persistência cross-browser dos marcos da Liga Global já reclamados
-- ============================================================================
-- Cada manager pode bater 20 marcos no total (4 categorias × 5 thresholds):
--   matches | goals | points | wins  → 10 / 50 / 100 / 300 / 1000
-- IDs estáveis: `gl_<category>_<threshold>` (ex.: `gl_matches_10`).
--
-- Persistir cross-browser garante que o EXP é pago só 1× — sem isso, logar
-- noutro device pagaria de novo todos os marcos que o time já atingiu.
-- ============================================================================

alter table public.manager_game_state
  add column if not exists global_league_milestones_claimed jsonb;

-- Sem índices: campo é lido só pelo próprio user_id (já PK).
-- RLS herdada do owner da tabela.

-- ─── 20260518020000_manager_state_local_leagues.sql ───
-- ============================================================================
-- LIGA CLASSIC + FAST LIGA — placar acumulado por manager cross-browser
-- ============================================================================
-- Cada manager tem 2 leagues locais cumulativas (sem temporadas):
--   • classic → soma pontos por toda partida do modo CLASSIC (2D tático)
--   • fast    → soma pontos por toda partida do modo QUICK (rápida)
--
-- Schema do JSON (LocalLeaguesState em src/match/localLeagues.ts):
--   {
--     "classic": { "played": int, "wins": int, "draws": int, "losses": int,
--                  "goalsFor": int, "goalsAgainst": int, "points": int,
--                  "recentForm": ["W"|"D"|"L"], "bestStreak": int,
--                  "currentStreak": int },
--     "fast": { ... mesmo shape ... }
--   }
--
-- Persistir cross-browser garante que a Liga Classic e a Fast Liga não
-- zeram quando o manager loga em outro device.
-- ============================================================================

alter table public.manager_game_state
  add column if not exists local_leagues jsonb;

-- ─── 20260518030000_manager_state_onboarding_flags.sql ───
-- ============================================================================
-- Persistência cross-browser das flags de onboarding
-- ============================================================================
-- Antes: welcomeGenesisPackVersion + hasDoneOnboarding viviam SÓ no
-- localStorage. Manager fazia a cerimônia, deslogava, logava noutro browser
-- (ou aba anônima) — localStorage zerado + welcome_pack_grants sem entry
-- na cerimônia nova (regressão da remoção do tryGrantWelcomeGenesisPack
-- no Sprint 2). Resultado: cerimônia abria de novo.
--
-- Solução em 2 camadas:
--   1. OnboardingCeremony agora chama claimWelcomePackSlot() no finish()
--      → grava em welcome_pack_grants (gate primário).
--   2. Esta coluna persiste as flags como BACKUP (segundo guard) caso o
--      RPC falhe ou tenha latência.
--
-- Shape do JSON:
--   {
--     "welcomeGenesisPackVersion": int,
--     "hasDoneOnboarding": boolean
--   }
-- ============================================================================

alter table public.manager_game_state
  add column if not exists onboarding_flags jsonb;

-- ─── 20260518040000_get_total_managers_rpc.sql ───
-- ============================================================================
-- RPC get_total_managers() — pré-existente em código mas nunca criada no DB
-- ============================================================================
-- O hook `useTotalManagers` (src/hooks/useTotalManagers.ts) chama essa RPC
-- pra mostrar contagem global de managers na Home. Estava retornando 404
-- em prod (spammando o console). Migration cria a função.
--
-- Sem fallback mockado — se vier null o hook deixa "Fase Beta" no UI.
-- ============================================================================

create or replace function public.get_total_managers()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int from public.profiles where id is not null;
$$;

grant execute on function public.get_total_managers() to anon, authenticated;

-- ─── 20260518050000_manager_state_finance.sql ───
-- ============================================================================
-- PERSISTIR FINANCE CROSS-BROWSER
-- ============================================================================
-- Antes: finance (ole/EXP, broCents, expLifetimeEarned, expHistory) vivia
-- APENAS no localStorage. Resultado: logout → localStorage limpo → user
-- volta com 0 EXP, perde tudo que jogou.
--
-- Agora: persiste em manager_game_state.finance (jsonb). Hidratação usa
-- MAX(expLifetimeEarned) — monotônico, jamais regredir.
-- ============================================================================

alter table public.manager_game_state
  add column if not exists finance jsonb;

-- ─── 20260518060000_global_league_wo_rivalry.sql ───
-- Adiciona colunas para WO (available_player_count) e Rivalidade (rivalry_encounters)
-- na tabela global_league_teams.

ALTER TABLE global_league_teams
  ADD COLUMN IF NOT EXISTS available_player_count integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS rivalry_encounters jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN global_league_teams.available_player_count IS
  'Jogadores disponíveis (synced pelo cliente). Edge Function usa para WO (<11 = derrota 3x0).';

COMMENT ON COLUMN global_league_teams.rivalry_encounters IS
  'Confrontos na temporada: {opponentTeamId: count}. 3+ = clássico (probabilidades aumentadas).';

-- ─── 20260519010000_manager_squad_public_read.sql ───
-- Permite leitura cruzada de manager_squad para matchmaking PvP assíncrono.
-- Dados de gameplay (plantel/lineup) não são sensíveis.
DROP POLICY IF EXISTS "manager_squad_select_own" ON public.manager_squad;

CREATE POLICY "manager_squad_select_all"
  ON public.manager_squad FOR SELECT
  TO authenticated
  USING (true);

-- ─── 20260519020000_cleanup_npc_market_activities.sql ───
-- Remove atividades de mercado geradas por NPCs (manager_id IS NULL).
-- A partir de agora, apenas transações reais de managers aparecem no feed.
DELETE FROM public.market_activities WHERE manager_id IS NULL;

-- ─── 20260519030000_list_ruiz_pacheco_on_market.sql ───
-- Coloca Ruiz Pacheco (GEN-040) disponível no mercado de transferências.
UPDATE public.genesis_market_players
SET listed_on_market = true
WHERE id = 'GEN-040';

-- ─── 20260519040000_fix_get_total_managers_rpc.sql ───
-- Fix: conta managers reais a partir de auth.users (não profiles que pode ficar órfão).
-- SECURITY DEFINER permite acesso a auth.users.
create or replace function public.get_total_managers()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int from auth.users;
$$;

-- ─── 20260519050000_reset_global_league_stats.sql ───
-- Reset da Liga Global: zera stats/pontos de todos os times.
-- Mantém registros (nome, manager_id, club_name, overall, jogadores).
-- Prepara para nova temporada.
UPDATE public.global_league_teams SET
  points = 0,
  matches_played = 0,
  wins = 0,
  draws = 0,
  losses = 0,
  goals_for = 0,
  goals_against = 0,
  goal_difference = 0;

-- ─── 20260519060000_cleanup_orphan_league_teams.sql ───
-- Remove times da Liga Global cujo manager_id não corresponde a nenhum
-- email em auth.users (times órfãos de users deletados).
-- Também remove times mockados (ole-fc, guest).
DELETE FROM public.global_league_teams
WHERE manager_id NOT IN (
  SELECT email FROM auth.users WHERE email IS NOT NULL
)
OR manager_id IN ('ole-fc', 'guest');

-- ─── 20260519070000_atomic_persist_opponent_result.sql ───
-- RPC atômica para persistir resultado do adversário na Liga Local.
-- Evita race condition de read-then-write quando 2 jogadores vencem
-- o mesmo oponente simultaneamente.
create or replace function public.persist_opponent_local_league_result(
  p_opponent_user_id uuid,
  p_league text,        -- 'fast' ou 'classic'
  p_result text,        -- 'win', 'draw', 'loss'
  p_goals_for int,
  p_goals_against int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leagues jsonb;
  v_league_data jsonb;
  v_played int;
  v_wins int;
  v_draws int;
  v_losses int;
  v_gf int;
  v_ga int;
  v_points int;
begin
  -- Ler local_leagues atual
  select coalesce(local_leagues, '{}'::jsonb)
  into v_leagues
  from manager_game_state
  where user_id = p_opponent_user_id
  for update;

  -- Se não existe row, criar
  if not found then
    insert into manager_game_state (user_id, local_leagues)
    values (p_opponent_user_id, '{}'::jsonb)
    on conflict (user_id) do nothing;
    v_leagues := '{}'::jsonb;
  end if;

  -- Extrair dados da liga específica
  v_league_data := coalesce(v_leagues -> p_league, '{}'::jsonb);
  v_played := coalesce((v_league_data ->> 'played')::int, 0) + 1;
  v_wins := coalesce((v_league_data ->> 'wins')::int, 0) + (case when p_result = 'win' then 1 else 0 end);
  v_draws := coalesce((v_league_data ->> 'draws')::int, 0) + (case when p_result = 'draw' then 1 else 0 end);
  v_losses := coalesce((v_league_data ->> 'losses')::int, 0) + (case when p_result = 'loss' then 1 else 0 end);
  v_gf := coalesce((v_league_data ->> 'goalsFor')::int, 0) + p_goals_for;
  v_ga := coalesce((v_league_data ->> 'goalsAgainst')::int, 0) + p_goals_against;
  v_points := (v_wins * 3) + v_draws;

  -- Montar novo JSON da liga
  v_league_data := jsonb_build_object(
    'played', v_played,
    'wins', v_wins,
    'draws', v_draws,
    'losses', v_losses,
    'goalsFor', v_gf,
    'goalsAgainst', v_ga,
    'points', v_points
  );

  -- Atualizar atomicamente
  update manager_game_state
  set local_leagues = jsonb_set(coalesce(local_leagues, '{}'::jsonb), array[p_league], v_league_data)
  where user_id = p_opponent_user_id;
end;
$$;

grant execute on function public.persist_opponent_local_league_result(uuid, text, text, int, int) to anon, authenticated;

-- ─── 20260521000000_fix_referral_codes_complete.sql ───
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

-- ─── 20260525014754_olefoot_python_mode.sql ───
-- ═══════════════════════════════════════════════════════════════════════
--  OLEFOOT PYTHON MODE — Schema for impact + engagement systems
--  Sistema A: club_consequences (persistent overlay effects)
--  Sistema E: manager_presence + manager_login_bonus_claims
--  Will be consumed by:
--    - TS reducer (real-time overlay)
--    - Python /insights service (analytics, batch jobs)
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Sistema A: PersistentConsequence storage ─────────────────────────
CREATE TABLE IF NOT EXISTS public.club_consequences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id      uuid NOT NULL,
  club_id         text NOT NULL,
  player_id       text,
  kind            text NOT NULL,
  dimension       text NOT NULL CHECK (dimension IN ('physical','psychological','reputational','financial')),
  scope           text NOT NULL CHECK (scope IN ('player','club')),
  magnitude       numeric NOT NULL,
  decay_curve     text NOT NULL DEFAULT 'linear' CHECK (decay_curve IN ('step','linear','exponential')),
  starts_at       timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  source_event_id text,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_consequences_manager_expires
  ON public.club_consequences (manager_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_club_consequences_player_expires
  ON public.club_consequences (player_id, expires_at)
  WHERE player_id IS NOT NULL;

-- Postgres não aceita now() em predicate de index (não é IMMUTABLE).
-- Index sem WHERE: queries de "consequências ativas por dimensão" continuam
-- usando este index + filtro WHERE expires_at > now() no runtime.
CREATE INDEX IF NOT EXISTS idx_club_consequences_dimension_expires
  ON public.club_consequences (dimension, expires_at);

COMMENT ON TABLE public.club_consequences IS
  'Persistent overlay effects with temporal decay. TS reducer applies overlay; Python /insights aggregates for projections.';

-- RLS: manager só lê/escreve as próprias consequências
ALTER TABLE public.club_consequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consequences_select_own" ON public.club_consequences;
CREATE POLICY "consequences_select_own"
  ON public.club_consequences FOR SELECT
  USING (auth.uid() = manager_id);

DROP POLICY IF EXISTS "consequences_insert_own" ON public.club_consequences;
CREATE POLICY "consequences_insert_own"
  ON public.club_consequences FOR INSERT
  WITH CHECK (auth.uid() = manager_id);

DROP POLICY IF EXISTS "consequences_update_own" ON public.club_consequences;
CREATE POLICY "consequences_update_own"
  ON public.club_consequences FOR UPDATE
  USING (auth.uid() = manager_id);

DROP POLICY IF EXISTS "consequences_delete_own" ON public.club_consequences;
CREATE POLICY "consequences_delete_own"
  ON public.club_consequences FOR DELETE
  USING (auth.uid() = manager_id);


-- ─── Sistema E: Manager presence (engagement tracking) ────────────────
CREATE TABLE IF NOT EXISTS public.manager_presence (
  manager_id                      uuid PRIMARY KEY,
  last_login_at                   timestamptz NOT NULL,
  last_session_end_at             timestamptz,
  total_sessions                  integer NOT NULL DEFAULT 0,
  last_bonus_claim_at             timestamptz,
  bonus_streak_slots              integer NOT NULL DEFAULT 0,
  absence_penalty_last_applied_at timestamptz,
  last_absence_tier               text CHECK (last_absence_tier IN
    ('normal','warning_12h','mild_24h','moderate_36h','heavy_48h','crisis_72h')),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manager_presence_last_login
  ON public.manager_presence (last_login_at);

COMMENT ON TABLE public.manager_presence IS
  'Tracks manager presence for absence penalty + login bonus cycle.';

ALTER TABLE public.manager_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presence_select_own" ON public.manager_presence;
CREATE POLICY "presence_select_own"
  ON public.manager_presence FOR SELECT
  USING (auth.uid() = manager_id);

DROP POLICY IF EXISTS "presence_upsert_own" ON public.manager_presence;
CREATE POLICY "presence_upsert_own"
  ON public.manager_presence FOR INSERT
  WITH CHECK (auth.uid() = manager_id);

DROP POLICY IF EXISTS "presence_update_own" ON public.manager_presence;
CREATE POLICY "presence_update_own"
  ON public.manager_presence FOR UPDATE
  USING (auth.uid() = manager_id);


-- ─── Sistema E: Login bonus claim history ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.manager_login_bonus_claims (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id   uuid NOT NULL,
  claimed_at   timestamptz NOT NULL DEFAULT now(),
  slot_index   integer NOT NULL,
  reward_kind  text NOT NULL,
  exp_granted  integer,
  is_weekend   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_bonus_claims_manager_at
  ON public.manager_login_bonus_claims (manager_id, claimed_at DESC);

COMMENT ON TABLE public.manager_login_bonus_claims IS
  'History of 3h/1h cycle bonus claims. Used for streak preservation and analytics.';

ALTER TABLE public.manager_login_bonus_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bonus_claims_select_own" ON public.manager_login_bonus_claims;
CREATE POLICY "bonus_claims_select_own"
  ON public.manager_login_bonus_claims FOR SELECT
  USING (auth.uid() = manager_id);

DROP POLICY IF EXISTS "bonus_claims_insert_own" ON public.manager_login_bonus_claims;
CREATE POLICY "bonus_claims_insert_own"
  ON public.manager_login_bonus_claims FOR INSERT
  WITH CHECK (auth.uid() = manager_id);

-- ─── 20260526030000_academy_storage_buckets.sql ───
-- Buckets do fluxo Academia OLE: selfies (privado, temporário) + portraits
-- e cards promocionais (público).
--
-- academy-selfies: selfie do manager usada como referência pelo admin pra
--   gerar a arte final no Freepik. Privado pois é dado pessoal; signed URLs
--   geradas com TTL 7 dias na rota /api/academy/upload-selfie. Deletada após
--   o admin "lançar" o jogador no plantel (cleanup futuro).
--
-- academy-portraits: arte final do jogador (portraitUrl) e card promocional
--   (promotionalCardUrl). Público pois o manager precisa exibir no plantel
--   e compartilhar nas redes sociais. Subdividido em duas subpastas
--   (portrait/ e promo/) só pra organização visual no dashboard.

insert into storage.buckets (id, name, public)
values
  ('academy-selfies', 'academy-selfies', false),
  ('academy-portraits', 'academy-portraits', true)
on conflict (id) do nothing;

-- Policies — uploads via service_role bypass RLS, então só precisamos abrir
-- LEITURA pra usuários autenticados (selfies) e leitura pública (portraits
-- já são públicos via bucket public=true).

drop policy if exists "academy_selfies_authenticated_read" on storage.objects;
create policy "academy_selfies_authenticated_read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'academy-selfies');

drop policy if exists "academy_selfies_owner_delete" on storage.objects;
create policy "academy_selfies_owner_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'academy-selfies' and owner = auth.uid());

-- ─── 20260526040000_referral_hardening.sql ───
-- Hardening do sistema de referral (3 melhorias):
-- 1. save_onboarding_profile valida que referred_by_code é um my_referral_code real
--    de OUTRO usuário (bloqueia órfãos e auto-indicação silenciosamente).
-- 2. Revoga EXECUTE de anon/public nos RPCs (auth ainda checada internamente, mas
--    reduz superfície exposta no /rest/v1/rpc).
-- 3. SET search_path = public nas funções que faltavam (hardening contra injection
--    via search_path manipulado em sessões).

-- ============================================================
-- 1. Validação de referrer existente
-- ============================================================

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

  v_code := nullif(regexp_replace(upper(coalesce(p_referred_by_code, '')), '[^A-Z0-9]', '', 'g'), '');
  if v_code is not null and (char_length(v_code) < 6 or char_length(v_code) > 8) then
    v_code := null;
  end if;

  if v_code is not null then
    if not exists (
      select 1 from public.profiles
      where my_referral_code = v_code and id <> v_uid
    ) then
      v_code := null;
    end if;
  end if;

  insert into public.profiles (id, display_name, club_name, club_short, onboarding_data, referred_by_code)
  values (v_uid, p_display_name, p_club_name, p_club_short, p_onboarding_data, v_code)
  on conflict (id) do update set
    display_name = excluded.display_name,
    club_name = excluded.club_name,
    club_short = excluded.club_short,
    onboarding_data = excluded.onboarding_data,
    referred_by_code = coalesce(public.profiles.referred_by_code, excluded.referred_by_code),
    updated_at = now();
end;
$$;

-- ============================================================
-- 2. Revoga EXECUTE de anon/public; só authenticated entra
-- ============================================================

revoke execute on function public.save_onboarding_profile(text, text, text, jsonb, text) from anon, public;
grant execute on function public.save_onboarding_profile(text, text, text, jsonb, text) to authenticated;

revoke execute on function public.get_my_referral_code() from anon, public;
grant execute on function public.get_my_referral_code() to authenticated;

revoke execute on function public.get_my_referrals() from anon, public;
grant execute on function public.get_my_referrals() to authenticated;

-- generate_unique_referral_code só é chamada pelo trigger (que roda no contexto
-- do owner da função): nem authenticated nem anon precisam invocá-la diretamente.
revoke execute on function public.generate_unique_referral_code() from anon, authenticated, public;

-- ============================================================
-- 3. search_path explícito nas funções que faltavam
-- ============================================================

create or replace function public.generate_unique_referral_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  v_code text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_attempts int := 0;
begin
  while v_attempts < 10 loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, (floor(random() * 32)::int) + 1, 1);
    end loop;
    if not exists(select 1 from public.profiles where my_referral_code = v_code) then
      return v_code;
    end if;
    v_attempts := v_attempts + 1;
  end loop;
  raise exception 'Failed to generate unique referral code after 10 attempts';
end;
$$;

create or replace function public.trg_generate_referral_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.my_referral_code is null then
    new.my_referral_code := public.generate_unique_referral_code();
  end if;
  return new;
end;
$$;

-- Re-revoga após o CREATE OR REPLACE (o CREATE recria grants default em PUBLIC).
revoke execute on function public.generate_unique_referral_code() from anon, authenticated, public;
revoke execute on function public.trg_generate_referral_code() from anon, authenticated, public;

-- ─── 20260526050000_fix_get_my_referrals_ambiguous_id.sql ───
-- Fix: column reference "id" was ambiguous because RETURNS TABLE (id uuid, ...)
-- creates a variable named "id" that shadows profiles.id in the inner query.
--
-- Bug pré-existente da migration 20260521000000. ReferralTab + ManagerNetwork
-- recebiam 400 Bad Request silenciado pelo try/catch do client (`fetchMyReferrals`
-- só logava warning e retornava []), então a página parecia "vazia" mesmo com
-- dados no banco.
--
-- Diagnóstico veio do Network tab do browser: POST /rest/v1/rpc/get_my_referrals
-- → 400. SQL puro `select * from get_my_referrals()` retornou:
--   ERROR: 42702: column reference "id" is ambiguous
--   QUERY: select my_referral_code from public.profiles where id = auth.uid()

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
  -- Qualifica com alias pra evitar ambiguidade com a variável "id" do RETURNS TABLE
  select p.my_referral_code into v_my_code
    from public.profiles p
   where p.id = auth.uid();

  if v_my_code is null then
    return;
  end if;

  return query
    select p.id, p.display_name, p.club_name, p.club_short, p.created_at
      from public.profiles p
     where p.referred_by_code = v_my_code
     order by p.created_at desc;
end;
$$;

revoke execute on function public.get_my_referrals() from anon, public;
grant execute on function public.get_my_referrals() to authenticated;

-- ─── 20260526060000_referral_exp_commission.sql ───
-- Sistema de comissão EXP sobre indicados (5% de todo EXP ganho pelo indicado).
--
-- Como funciona:
--   1. Cliente sincroniza `profiles.exp_lifetime_earned` em eventos críticos
--      (login + pós-partida) com o valor de `finance.expLifetimeEarned` local
--   2. Trigger AFTER UPDATE detecta delta positivo
--   3. Se o profile tem `referred_by_code` → resolve o referrer e cria entry
--      em `referral_exp_commissions` com round(delta * 0.05)
--   4. RPC `get_my_referrals` agrega o total recebido por cada indicado
--
-- O credit automático no saldo do referrer fica como próxima iteração.
-- Esta migration entrega o LEDGER + DISPLAY (decisão de produto, 2026-05-26).

-- ============================================================
-- 1. Coluna pra rastrear lifetime EXP no profile
-- ============================================================

alter table public.profiles
  add column if not exists exp_lifetime_earned bigint not null default 0;

create index if not exists profiles_exp_lifetime_idx
  on public.profiles (exp_lifetime_earned)
  where exp_lifetime_earned > 0;

-- ============================================================
-- 2. Tabela ledger de comissões
-- ============================================================

create table if not exists public.referral_exp_commissions (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  exp_amount bigint not null check (exp_amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists referral_exp_commissions_referrer_idx
  on public.referral_exp_commissions (referrer_id, created_at desc);

create index if not exists referral_exp_commissions_referred_idx
  on public.referral_exp_commissions (referred_id);

alter table public.referral_exp_commissions enable row level security;

-- Só o referrer pode ler suas próprias comissões.
drop policy if exists referral_exp_commissions_select_referrer on public.referral_exp_commissions;
create policy referral_exp_commissions_select_referrer
  on public.referral_exp_commissions
  for select
  using (referrer_id = auth.uid());

-- Inserts vêm só do trigger (service_role contexto). Sem policy de INSERT
-- pra clientes autenticados — eles não devem criar comissão diretamente.

-- ============================================================
-- 3. Trigger: credita comissão no ledger quando indicado ganha EXP
-- ============================================================

create or replace function public.trg_referral_exp_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta bigint;
  v_referrer_id uuid;
  v_commission bigint;
begin
  -- Só age se exp_lifetime_earned aumentou
  v_delta := coalesce(new.exp_lifetime_earned, 0) - coalesce(old.exp_lifetime_earned, 0);
  if v_delta <= 0 then
    return new;
  end if;

  -- Sem referrer → sem comissão
  if new.referred_by_code is null then
    return new;
  end if;

  -- Resolve o referrer
  select p.id into v_referrer_id
    from public.profiles p
   where p.my_referral_code = new.referred_by_code
   limit 1;

  if v_referrer_id is null or v_referrer_id = new.id then
    return new;
  end if;

  -- 5% sobre o delta
  v_commission := round(v_delta * 0.05);
  if v_commission <= 0 then
    return new;
  end if;

  insert into public.referral_exp_commissions (referrer_id, referred_id, exp_amount)
  values (v_referrer_id, new.id, v_commission);

  return new;
end;
$$;

revoke execute on function public.trg_referral_exp_commission() from anon, authenticated, public;

drop trigger if exists profiles_referral_exp_commission_trg on public.profiles;
create trigger profiles_referral_exp_commission_trg
  after update of exp_lifetime_earned on public.profiles
  for each row
  execute function public.trg_referral_exp_commission();

-- ============================================================
-- 4. RPC pra sincronizar exp_lifetime_earned do client
-- ============================================================

create or replace function public.sync_my_exp_lifetime(p_amount bigint)
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
  if p_amount is null or p_amount < 0 then
    return;
  end if;

  -- Monotonic: nunca regredir o lifetime (defende contra client com state stale)
  update public.profiles
     set exp_lifetime_earned = greatest(exp_lifetime_earned, p_amount)
   where id = v_uid
     and exp_lifetime_earned < p_amount;
end;
$$;

revoke execute on function public.sync_my_exp_lifetime(bigint) from anon, public;
grant execute on function public.sync_my_exp_lifetime(bigint) to authenticated;

-- ============================================================
-- 5. RPC get_my_referrals: retorna lifetime + commission agregada
-- ============================================================

drop function if exists public.get_my_referrals();

create or replace function public.get_my_referrals()
returns table (
  id uuid,
  display_name text,
  club_name text,
  club_short text,
  created_at timestamptz,
  exp_lifetime_earned bigint,
  commission_earned bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_my_code text;
  v_my_id uuid := auth.uid();
begin
  if v_my_id is null then
    return;
  end if;

  select p.my_referral_code into v_my_code
    from public.profiles p
   where p.id = v_my_id;

  if v_my_code is null then
    return;
  end if;

  return query
    select
      p.id,
      p.display_name,
      p.club_name,
      p.club_short,
      p.created_at,
      coalesce(p.exp_lifetime_earned, 0)::bigint as exp_lifetime_earned,
      coalesce((
        select sum(c.exp_amount)::bigint
          from public.referral_exp_commissions c
         where c.referrer_id = v_my_id
           and c.referred_id = p.id
      ), 0)::bigint as commission_earned
    from public.profiles p
   where p.referred_by_code = v_my_code
   order by p.created_at desc;
end;
$$;

revoke execute on function public.get_my_referrals() from anon, public;
grant execute on function public.get_my_referrals() to authenticated;

-- ─── 20260526070000_referral_exp_commission_claim.sql ───
-- Fecha o loop da comissão de indicação: ledger → claim → saldo.
--
-- Adiciona claimed_at no ledger e RPC pra resgatar.
-- get_my_referrals agora retorna commission_pending (claimable) e
-- commission_total (histórico cumulativo).

-- ============================================================
-- 1. Coluna claimed_at no ledger (nullable: null = pendente)
-- ============================================================

alter table public.referral_exp_commissions
  add column if not exists claimed_at timestamptz;

create index if not exists referral_exp_commissions_pending_idx
  on public.referral_exp_commissions (referrer_id)
  where claimed_at is null;

-- ============================================================
-- 2. RPC claim: marca como claimed e retorna o total resgatado
-- ============================================================

create or replace function public.claim_my_referral_commissions(
  p_referred_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_total bigint;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  with claimed as (
    update public.referral_exp_commissions
       set claimed_at = now()
     where referrer_id = v_uid
       and claimed_at is null
       and (p_referred_id is null or referred_id = p_referred_id)
    returning exp_amount
  )
  select coalesce(sum(exp_amount), 0)::bigint into v_total from claimed;

  return v_total;
end;
$$;

revoke execute on function public.claim_my_referral_commissions(uuid) from anon, public;
grant execute on function public.claim_my_referral_commissions(uuid) to authenticated;

-- ============================================================
-- 3. Update get_my_referrals: separa pending vs total
-- ============================================================

drop function if exists public.get_my_referrals();

create or replace function public.get_my_referrals()
returns table (
  id uuid,
  display_name text,
  club_name text,
  club_short text,
  created_at timestamptz,
  exp_lifetime_earned bigint,
  commission_pending bigint,
  commission_total bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_my_code text;
  v_my_id uuid := auth.uid();
begin
  if v_my_id is null then
    return;
  end if;

  select p.my_referral_code into v_my_code
    from public.profiles p
   where p.id = v_my_id;

  if v_my_code is null then
    return;
  end if;

  return query
    select
      p.id,
      p.display_name,
      p.club_name,
      p.club_short,
      p.created_at,
      coalesce(p.exp_lifetime_earned, 0)::bigint as exp_lifetime_earned,
      coalesce((
        select sum(c.exp_amount)::bigint
          from public.referral_exp_commissions c
         where c.referrer_id = v_my_id
           and c.referred_id = p.id
           and c.claimed_at is null
      ), 0)::bigint as commission_pending,
      coalesce((
        select sum(c.exp_amount)::bigint
          from public.referral_exp_commissions c
         where c.referrer_id = v_my_id
           and c.referred_id = p.id
      ), 0)::bigint as commission_total
    from public.profiles p
   where p.referred_by_code = v_my_code
   order by p.created_at desc;
end;
$$;

revoke execute on function public.get_my_referrals() from anon, public;
grant execute on function public.get_my_referrals() to authenticated;

-- ─── 20260526080000_pvp_match_results.sql ───
-- Sistema PvP assíncrono: partidas Rápida e Clássica entre managers.
--
-- Modelo:
--   1. Manager A joga contra um manager B (offline) usando o snapshot do
--      squad de B (em manager_squad). A simulação roda local no cliente A.
--   2. Ao final, cliente A chama `record_pvp_match_result()`. Server insere
--      ledger imutável + calcula EXP reward pra cada lado.
--   3. A recebe seu reward imediatamente (RPC retorna o valor).
--   4. B recebe quando logar: `fetch_my_pending_pvp_results()` retorna
--      ledger rows onde ele participou e não foi claimed ainda.
--      Cliente B aplica via reducer + chama `claim_pvp_match_result(id)`.
--
-- Recompensas (decisão de produto 2026-05-26): vitória 200 EXP,
-- empate 80 EXP, derrota 30 EXP (consolation). Aplicado pros DOIS lados.

create table if not exists public.pvp_match_results (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('quick', 'classic')),
  home_user_id uuid not null references public.profiles(id) on delete cascade,
  away_user_id uuid not null references public.profiles(id) on delete cascade,
  home_score smallint not null check (home_score >= 0 and home_score <= 30),
  away_score smallint not null check (away_score >= 0 and away_score <= 30),
  home_overall smallint,
  away_overall smallint,
  outcome text not null check (outcome in ('home_win', 'away_win', 'draw')),
  home_exp_reward bigint not null,
  away_exp_reward bigint not null,
  -- Quando cada lado coletou (claimed). A é creditado na hora; B coleta no próximo login.
  home_claimed_at timestamptz default now(),
  away_claimed_at timestamptz,
  played_at timestamptz not null default now(),
  constraint different_users check (home_user_id <> away_user_id)
);

create index if not exists pvp_results_home_idx on public.pvp_match_results (home_user_id, played_at desc);
create index if not exists pvp_results_away_idx on public.pvp_match_results (away_user_id, played_at desc);
create index if not exists pvp_results_mode_idx on public.pvp_match_results (mode, played_at desc);
create index if not exists pvp_results_away_pending_idx
  on public.pvp_match_results (away_user_id)
  where away_claimed_at is null;

alter table public.pvp_match_results enable row level security;

-- Usuário lê apenas resultados onde participou
drop policy if exists pvp_results_select_participant on public.pvp_match_results;
create policy pvp_results_select_participant on public.pvp_match_results
  for select using (home_user_id = auth.uid() or away_user_id = auth.uid());

-- Sem INSERT/UPDATE direto via cliente — só via RPCs (security definer)

-- ============================================================
-- RPC: record_pvp_match_result
-- Cliente A grava o resultado. Server calcula outcome + rewards + insere.
-- Retorna o ID + os rewards (cliente A aplica home_reward localmente).
-- ============================================================

create or replace function public.record_pvp_match_result(
  p_mode text,
  p_away_user_id uuid,
  p_home_score int,
  p_away_score int,
  p_home_overall int default null,
  p_away_overall int default null
)
returns table (
  id uuid,
  outcome text,
  home_exp_reward bigint,
  away_exp_reward bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_home_user_id uuid := auth.uid();
  v_outcome text;
  v_home_exp bigint;
  v_away_exp bigint;
  v_id uuid;
  v_hs smallint;
  v_as smallint;
begin
  if v_home_user_id is null then
    raise exception 'must be authenticated';
  end if;
  if p_mode not in ('quick', 'classic') then
    raise exception 'invalid mode';
  end if;
  if p_away_user_id = v_home_user_id then
    raise exception 'cannot play against self';
  end if;
  if not exists (select 1 from public.profiles where id = p_away_user_id) then
    raise exception 'opponent not found';
  end if;

  -- Sanitização defensiva dos scores (0-30)
  v_hs := greatest(0, least(30, coalesce(p_home_score, 0)));
  v_as := greatest(0, least(30, coalesce(p_away_score, 0)));

  v_outcome := case
    when v_hs > v_as then 'home_win'
    when v_hs < v_as then 'away_win'
    else 'draw'
  end;

  v_home_exp := case v_outcome
    when 'home_win' then 200
    when 'draw' then 80
    else 30
  end;
  v_away_exp := case v_outcome
    when 'away_win' then 200
    when 'draw' then 80
    else 30
  end;

  insert into public.pvp_match_results (
    mode, home_user_id, away_user_id,
    home_score, away_score, home_overall, away_overall,
    outcome, home_exp_reward, away_exp_reward,
    home_claimed_at, away_claimed_at
  ) values (
    p_mode, v_home_user_id, p_away_user_id,
    v_hs, v_as, p_home_overall, p_away_overall,
    v_outcome, v_home_exp, v_away_exp,
    now(),   -- A coleta imediatamente
    null     -- B coleta quando logar
  )
  returning pvp_match_results.id into v_id;

  return query select v_id, v_outcome, v_home_exp, v_away_exp;
end;
$$;

revoke execute on function public.record_pvp_match_result(text, uuid, int, int, int, int) from anon, public;
grant execute on function public.record_pvp_match_result(text, uuid, int, int, int, int) to authenticated;

-- ============================================================
-- RPC: fetch_my_pending_pvp_results
-- B busca resultados onde participou como away e ainda não claimou.
-- ============================================================

create or replace function public.fetch_my_pending_pvp_results()
returns table (
  id uuid,
  mode text,
  outcome text,
  home_score smallint,
  away_score smallint,
  away_exp_reward bigint,
  played_at timestamptz,
  opponent_display_name text,
  opponent_club_name text,
  opponent_club_short text
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
    select
      r.id,
      r.mode,
      r.outcome,
      r.home_score,
      r.away_score,
      r.away_exp_reward,
      r.played_at,
      p.display_name,
      p.club_name,
      p.club_short
    from public.pvp_match_results r
    inner join public.profiles p on p.id = r.home_user_id
    where r.away_user_id = v_uid
      and r.away_claimed_at is null
    order by r.played_at desc
    limit 20;
end;
$$;

revoke execute on function public.fetch_my_pending_pvp_results() from anon, public;
grant execute on function public.fetch_my_pending_pvp_results() to authenticated;

-- ============================================================
-- RPC: claim_pvp_match_result
-- Cliente B marca um result como claimed (após ter aplicado o EXP local).
-- ============================================================

create or replace function public.claim_pvp_match_result(p_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_reward bigint;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  update public.pvp_match_results
     set away_claimed_at = now()
   where id = p_id
     and away_user_id = v_uid
     and away_claimed_at is null
   returning away_exp_reward into v_reward;

  return coalesce(v_reward, 0);
end;
$$;

revoke execute on function public.claim_pvp_match_result(uuid) from anon, public;
grant execute on function public.claim_pvp_match_result(uuid) to authenticated;

-- ─── 20260526090000_pvp_standings.sql ───
-- Standings agregados de Quick e Classic.
-- View espelha cada partida em 2 linhas (home + away) e agrega por user+mode.
-- RPC retorna top N com info de profile + crest do time do coração.

create or replace view public.pvp_standings_v as
with results as (
  select home_user_id as user_id, mode,
    case outcome
      when 'home_win' then 'W'
      when 'away_win' then 'L'
      else 'D'
    end as result,
    home_score as gf, away_score as ga
  from public.pvp_match_results
  union all
  select away_user_id, mode,
    case outcome
      when 'away_win' then 'W'
      when 'home_win' then 'L'
      else 'D'
    end as result,
    away_score as gf, home_score as ga
  from public.pvp_match_results
)
select
  r.user_id,
  r.mode,
  count(*)::int as played,
  count(*) filter (where result = 'W')::int as wins,
  count(*) filter (where result = 'D')::int as draws,
  count(*) filter (where result = 'L')::int as losses,
  coalesce(sum(gf), 0)::int as goals_for,
  coalesce(sum(ga), 0)::int as goals_against,
  coalesce(sum(gf - ga), 0)::int as goal_diff,
  (count(*) filter (where result = 'W') * 3 + count(*) filter (where result = 'D'))::int as points
from results r
group by r.user_id, r.mode;

create or replace function public.get_pvp_standings(p_mode text, p_limit int default 50)
returns table (
  user_id uuid,
  display_name text,
  club_name text,
  club_short text,
  favorite_team_id int,
  played int,
  wins int,
  draws int,
  losses int,
  goals_for int,
  goals_against int,
  goal_diff int,
  points int,
  rank int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_mode not in ('quick', 'classic') then
    raise exception 'invalid mode';
  end if;
  return query
    select
      s.user_id,
      p.display_name,
      p.club_name,
      p.club_short,
      nullif(p.onboarding_data->'favoriteRealTeam'->>'id', '')::int as favorite_team_id,
      s.played,
      s.wins,
      s.draws,
      s.losses,
      s.goals_for,
      s.goals_against,
      s.goal_diff,
      s.points,
      (row_number() over (order by s.points desc, s.goal_diff desc, s.goals_for desc))::int as rank
    from public.pvp_standings_v s
    inner join public.profiles p on p.id = s.user_id
    where s.mode = p_mode
    order by s.points desc, s.goal_diff desc, s.goals_for desc
    limit greatest(1, least(200, coalesce(p_limit, 50)));
end;
$$;

revoke execute on function public.get_pvp_standings(text, int) from anon, public;
grant execute on function public.get_pvp_standings(text, int) to authenticated;

-- ─── 20260527000000_token_economy_config.sql ───
-- ============================================================
-- token_economy_config — camada centralizada do preço do token OLEFOOT
--
-- Por quê:
--   Toda lógica do jogo (rewards HODL, marketplace, swaps, comissões em USD)
--   precisa puxar o preço da moeda de UMA fonte. Hardcodear $0.00001 em
--   vários arquivos = dívida técnica que explode quando listarmos em exchange.
--
-- Modelo:
--   - Singleton (id='current')
--   - Modo 'fixed' (preço travado interno) vs 'market' (oráculo futuro)
--   - Treasury + mint controls (flags para evolução)
--
-- Preço inicial: $0.00001 (OLEFOOT-USD)
-- ============================================================

create table if not exists public.token_economy_config (
  id text primary key default 'current',
  current_token_price numeric(20, 10) not null default 0.00001,
  pricing_mode text not null default 'fixed' check (pricing_mode in ('fixed', 'market')),
  future_exchange_enabled boolean not null default false,
  treasury_control_enabled boolean not null default true,
  mint_control_enabled boolean not null default true,
  daily_mint_cap numeric(36, 8),
  total_minted numeric(36, 8) not null default 0,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint token_economy_config_singleton check (id = 'current')
);

alter table public.token_economy_config enable row level security;

-- Read público (preço é informação pública)
drop policy if exists token_economy_config_select_all on public.token_economy_config;
create policy token_economy_config_select_all
  on public.token_economy_config
  for select
  using (true);

-- Sem INSERT/UPDATE direto via client — apenas via RPC (admin)

insert into public.token_economy_config (id) values ('current')
on conflict (id) do nothing;

-- ============================================================
-- RPC get_token_price() — leitura pública
-- ============================================================

create or replace function public.get_token_price()
returns table (
  current_token_price numeric,
  pricing_mode text,
  future_exchange_enabled boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select current_token_price, pricing_mode, future_exchange_enabled
    from public.token_economy_config
   where id = 'current';
$$;

revoke execute on function public.get_token_price() from anon, public;
grant execute on function public.get_token_price() to authenticated, anon;

-- ============================================================
-- Helper interno: converte centavos BRO → pontos de carreira (USD-equivalent)
-- 1 BRO = 1 USD (parity), 1 ponto = 1 USD ganho
-- ============================================================

create or replace function public.bro_cents_to_career_points(p_cents bigint)
returns bigint
language sql
immutable
as $$
  select coalesce(floor(p_cents::numeric / 100), 0)::bigint;
$$;

-- ─── 20260527000100_affiliate_commissions.sql ───
-- ============================================================
-- affiliate_commissions — ledger multinível L1/L2/L3
--
-- Super-Bônus de Depósito: 5% L1 + 5% L2 + 5% L3 sobre todo wallet_credits
-- que carregar BRO/EXP e for marcado applied_at.
--
-- Por que ESSA arquitetura:
--   - Hook em wallet_credits.applied_at: qualquer caminho de depósito (admin,
--     gateway futuro, edge function de webhook) termina marcando applied_at.
--     Plugamos UMA vez, vale pra sempre.
--   - Tabela genérica (currency + source + level) suporta BRO, OLEXP, USDT no
--     futuro sem migration nova.
--   - Idempotência via UNIQUE (source_ref, level): nunca paga 2x pelo mesmo
--     wallet_credit.
-- ============================================================

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  level smallint not null check (level between 1 and 3),
  source text not null check (source in ('deposit', 'purchase', 'match_reward', 'manual')),
  source_ref text not null,
  currency text not null check (currency in ('BRO', 'EXP', 'OLEXP', 'USDT', 'USD')),
  -- BRO/EXP em unidades inteiras (cents pra BRO, EXP inteiro); OLEXP/USDT em numeric
  amount_cents bigint,
  amount_numeric numeric(36, 8),
  rate numeric(6, 4) not null default 0.0500,
  base_amount_cents bigint,
  base_amount_numeric numeric(36, 8),
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'reversed')),
  transaction_hash text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),

  -- Idempotência: 1 entry por (source_ref, level)
  constraint affiliate_commissions_idempotent unique (source_ref, level)
);

create index if not exists affiliate_commissions_referrer_idx
  on public.affiliate_commissions (referrer_id, created_at desc);

create index if not exists affiliate_commissions_referred_idx
  on public.affiliate_commissions (referred_id);

create index if not exists affiliate_commissions_pending_idx
  on public.affiliate_commissions (referrer_id, currency)
  where claimed_at is null;

alter table public.affiliate_commissions enable row level security;

drop policy if exists affiliate_commissions_select_referrer on public.affiliate_commissions;
create policy affiliate_commissions_select_referrer
  on public.affiliate_commissions
  for select
  using (referrer_id = auth.uid());

-- ============================================================
-- Helper: resolve cadeia L1/L2/L3 de um user pelo referred_by_code
-- ============================================================

create or replace function public.get_referral_chain(
  p_user_id uuid,
  p_max_levels int default 3
)
returns table (
  level smallint,
  referrer_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cur_id uuid := p_user_id;
  v_cur_code text;
  v_next_referrer uuid;
  v_level smallint := 1;
begin
  while v_level <= p_max_levels loop
    select p.referred_by_code into v_cur_code
      from public.profiles p
     where p.id = v_cur_id;

    if v_cur_code is null or v_cur_code = '' then
      return;
    end if;

    select p.id into v_next_referrer
      from public.profiles p
     where p.my_referral_code = v_cur_code
     limit 1;

    if v_next_referrer is null or v_next_referrer = p_user_id then
      return;
    end if;

    level := v_level;
    referrer_id := v_next_referrer;
    return next;

    v_cur_id := v_next_referrer;
    v_level := v_level + 1;
  end loop;
end;
$$;

revoke execute on function public.get_referral_chain(uuid, int) from anon, public;

-- ============================================================
-- Trigger: ao aplicar wallet_credit, paga 5%-5%-5% nos 3 níveis
-- ============================================================

create or replace function public.trg_wallet_credit_affiliate_bonus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate numeric := 0.05;
  v_bro_bonus bigint;
  v_exp_bonus bigint;
  v_chain record;
begin
  -- Só dispara quando applied_at vira NOT NULL (ou seja, depósito confirmado)
  if new.applied_at is null then
    return new;
  end if;
  if old.applied_at is not null then
    return new; -- já tinha applied_at, não dispara de novo
  end if;

  -- Calcula bônus 5% sobre o crédito aplicado
  v_bro_bonus := coalesce(floor(new.bro_cents * v_rate), 0)::bigint;
  v_exp_bonus := coalesce(floor(coalesce(new.exp_amount, 0) * v_rate), 0)::bigint;

  if v_bro_bonus <= 0 and v_exp_bonus <= 0 then
    return new;
  end if;

  -- Itera cadeia L1/L2/L3
  for v_chain in select * from public.get_referral_chain(new.user_id, 3) loop
    if v_bro_bonus > 0 then
      insert into public.affiliate_commissions (
        referrer_id, referred_id, level, source, source_ref,
        currency, amount_cents, rate, base_amount_cents, status
      ) values (
        v_chain.referrer_id, new.user_id, v_chain.level, 'deposit',
        'wallet_credit:' || new.id::text || ':BRO',
        'BRO', v_bro_bonus, v_rate, new.bro_cents, 'confirmed'
      )
      on conflict (source_ref, level) do nothing;
    end if;

    if v_exp_bonus > 0 then
      insert into public.affiliate_commissions (
        referrer_id, referred_id, level, source, source_ref,
        currency, amount_cents, rate, base_amount_cents, status
      ) values (
        v_chain.referrer_id, new.user_id, v_chain.level, 'deposit',
        'wallet_credit:' || new.id::text || ':EXP',
        'EXP', v_exp_bonus, v_rate, new.exp_amount, 'confirmed'
      )
      on conflict (source_ref, level) do nothing;
    end if;
  end loop;

  return new;
end;
$$;

revoke execute on function public.trg_wallet_credit_affiliate_bonus() from anon, authenticated, public;

drop trigger if exists wallet_credits_affiliate_bonus_trg on public.wallet_credits;
create trigger wallet_credits_affiliate_bonus_trg
  after update of applied_at on public.wallet_credits
  for each row
  execute function public.trg_wallet_credit_affiliate_bonus();

-- ============================================================
-- RPC get_my_affiliate_commissions — agregado por nível + currency
-- ============================================================

create or replace function public.get_my_affiliate_commissions()
returns table (
  level smallint,
  currency text,
  total_pending_cents bigint,
  total_claimed_cents bigint,
  entry_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.level,
    c.currency,
    coalesce(sum(case when c.claimed_at is null then c.amount_cents else 0 end), 0)::bigint as total_pending_cents,
    coalesce(sum(case when c.claimed_at is not null then c.amount_cents else 0 end), 0)::bigint as total_claimed_cents,
    count(*)::bigint as entry_count
  from public.affiliate_commissions c
  where c.referrer_id = auth.uid()
    and c.status = 'confirmed'
  group by c.level, c.currency
  order by c.level, c.currency;
$$;

revoke execute on function public.get_my_affiliate_commissions() from anon, public;
grant execute on function public.get_my_affiliate_commissions() to authenticated;

-- ============================================================
-- RPC claim_my_affiliate_commissions — marca claimed_at + retorna totais
-- ============================================================

create or replace function public.claim_my_affiliate_commissions(
  p_currency text default null
)
returns table (
  currency text,
  total_cents bigint
)
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

  return query
  with claimed as (
    update public.affiliate_commissions
       set claimed_at = now()
     where referrer_id = v_uid
       and claimed_at is null
       and status = 'confirmed'
       and (p_currency is null or currency = p_currency)
    returning currency, amount_cents
  )
  select c.currency, coalesce(sum(c.amount_cents), 0)::bigint
    from claimed c
   group by c.currency;
end;
$$;

revoke execute on function public.claim_my_affiliate_commissions(text) from anon, public;
grant execute on function public.claim_my_affiliate_commissions(text) to authenticated;

-- ─── 20260527000200_career_progress.sql ───
-- ============================================================
-- career_progress — Plano de Carreira "Cash Only" da OLEFOOT
--
-- 1 BRO (≈ 1 USD) ganho em comissão = 1 ponto vitalício.
--
-- Ranks (cumulativo, pago UMA vez por nível):
--   10.000 pts  → Júnior   ($50)
--   50.000      → Pro      ($250)
--   100.000     → Diretor  ($500)
--   250.000     → Campeão  ($2.500)
--   500.000     → Legend   ($5.000)
--
-- Trigger sobre affiliate_commissions: cada comissão confirmada em moeda
-- USD-equivalente (BRO ou USDT) soma pontos.
-- ============================================================

create table if not exists public.career_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  lifetime_points bigint not null default 0,
  current_rank text not null default 'rookie' check (current_rank in (
    'rookie', 'junior', 'pro', 'diretor', 'campeao', 'legend'
  )),
  total_commissions_cents bigint not null default 0,
  unlocked_rewards jsonb not null default '[]'::jsonb,
  pending_bonus_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists career_progress_rank_idx
  on public.career_progress (current_rank, lifetime_points desc);

alter table public.career_progress enable row level security;

drop policy if exists career_progress_select_self on public.career_progress;
create policy career_progress_select_self
  on public.career_progress
  for select
  using (user_id = auth.uid());

-- Leaderboard público (top N) — leitura agregada permitida via RPC, não policy

-- ============================================================
-- Função: rank a partir de pontos
-- ============================================================

create or replace function public.get_rank_for_points(p_points bigint)
returns text
language sql
immutable
as $$
  select case
    when p_points >= 500000 then 'legend'
    when p_points >= 250000 then 'campeao'
    when p_points >= 100000 then 'diretor'
    when p_points >= 50000  then 'pro'
    when p_points >= 10000  then 'junior'
    else 'rookie'
  end;
$$;

create or replace function public.get_rank_bonus_cents(p_rank text)
returns bigint
language sql
immutable
as $$
  select case p_rank
    when 'junior'  then 5000
    when 'pro'     then 25000
    when 'diretor' then 50000
    when 'campeao' then 250000
    when 'legend'  then 500000
    else 0
  end::bigint;
$$;

create or replace function public.get_rank_threshold(p_rank text)
returns bigint
language sql
immutable
as $$
  select case p_rank
    when 'junior'  then 10000
    when 'pro'     then 50000
    when 'diretor' then 100000
    when 'campeao' then 250000
    when 'legend'  then 500000
    else 0
  end::bigint;
$$;

-- ============================================================
-- Trigger: ao confirmar comissão de afiliado USD-equivalente, soma pontos
-- ============================================================

create or replace function public.trg_career_progress_accrue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points_delta bigint;
  v_new_total bigint;
  v_new_rank text;
  v_old_rank text;
begin
  -- Só conta comissão confirmada em moeda fiat-equivalent (1:1 USD)
  if new.status <> 'confirmed' then
    return new;
  end if;

  if new.currency not in ('BRO', 'USDT', 'USD') then
    return new;
  end if;

  -- 1 BRO cent = 0.01 ponto → 100 cents = 1 ponto
  v_points_delta := public.bro_cents_to_career_points(new.amount_cents);
  if v_points_delta <= 0 then
    return new;
  end if;

  insert into public.career_progress (user_id, lifetime_points, total_commissions_cents)
  values (new.referrer_id, v_points_delta, new.amount_cents)
  on conflict (user_id) do update
    set lifetime_points = career_progress.lifetime_points + v_points_delta,
        total_commissions_cents = career_progress.total_commissions_cents + new.amount_cents,
        updated_at = now()
  returning lifetime_points, current_rank into v_new_total, v_old_rank;

  v_new_rank := public.get_rank_for_points(v_new_total);

  if v_new_rank <> v_old_rank then
    update public.career_progress
       set current_rank = v_new_rank,
           pending_bonus_cents = pending_bonus_cents + public.get_rank_bonus_cents(v_new_rank),
           updated_at = now()
     where user_id = new.referrer_id;
  end if;

  return new;
end;
$$;

revoke execute on function public.trg_career_progress_accrue() from anon, authenticated, public;

drop trigger if exists affiliate_commissions_career_progress_trg on public.affiliate_commissions;
create trigger affiliate_commissions_career_progress_trg
  after insert on public.affiliate_commissions
  for each row
  execute function public.trg_career_progress_accrue();

-- ============================================================
-- RPC get_my_career_progress
-- ============================================================

create or replace function public.get_my_career_progress()
returns table (
  user_id uuid,
  lifetime_points bigint,
  current_rank text,
  next_rank text,
  next_rank_threshold bigint,
  progress_pct numeric,
  total_commissions_cents bigint,
  unlocked_rewards jsonb,
  pending_bonus_cents bigint
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

  -- Garante row existente
  insert into public.career_progress (user_id) values (v_uid)
  on conflict (user_id) do nothing;

  return query
  select
    cp.user_id,
    cp.lifetime_points,
    cp.current_rank,
    case cp.current_rank
      when 'rookie'  then 'junior'
      when 'junior'  then 'pro'
      when 'pro'     then 'diretor'
      when 'diretor' then 'campeao'
      when 'campeao' then 'legend'
      else 'legend'
    end as next_rank,
    case cp.current_rank
      when 'rookie'  then 10000
      when 'junior'  then 50000
      when 'pro'     then 100000
      when 'diretor' then 250000
      when 'campeao' then 500000
      else 500000
    end::bigint as next_rank_threshold,
    case
      when cp.current_rank = 'legend' then 100::numeric
      else round((cp.lifetime_points::numeric / nullif(
        case cp.current_rank
          when 'rookie'  then 10000
          when 'junior'  then 50000
          when 'pro'     then 100000
          when 'diretor' then 250000
          when 'campeao' then 500000
          else 1
        end, 0
      )) * 100, 2)
    end as progress_pct,
    cp.total_commissions_cents,
    cp.unlocked_rewards,
    cp.pending_bonus_cents
  from public.career_progress cp
  where cp.user_id = v_uid;
end;
$$;

revoke execute on function public.get_my_career_progress() from anon, public;
grant execute on function public.get_my_career_progress() to authenticated;

-- ============================================================
-- RPC claim_career_bonus — paga bônus pendente pra wallet_credits
-- ============================================================

create or replace function public.claim_career_bonus()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pending bigint;
  v_rank text;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  -- Lock row pra evitar race condition
  select pending_bonus_cents, current_rank into v_pending, v_rank
    from public.career_progress
   where user_id = v_uid
   for update;

  if v_pending is null or v_pending <= 0 then
    return 0;
  end if;

  -- Cria wallet_credit já aplicado (entra no SPOT do user via trigger normal)
  insert into public.wallet_credits (user_id, bro_cents, exp_amount, reason, applied_at)
  values (
    v_uid,
    v_pending,
    0,
    'career_bonus:' || v_rank,
    null
  );

  -- Marca histórico
  update public.career_progress
     set unlocked_rewards = unlocked_rewards || jsonb_build_object(
       'rank', v_rank,
       'amount_cents', v_pending,
       'claimed_at', now()
     ),
     pending_bonus_cents = 0,
     updated_at = now()
   where user_id = v_uid;

  return v_pending;
end;
$$;

revoke execute on function public.claim_career_bonus() from anon, public;
grant execute on function public.claim_career_bonus() to authenticated;

-- ============================================================
-- RPC career_leaderboard — top 50 por pontos
-- ============================================================

create or replace function public.career_leaderboard(p_limit int default 50)
returns table (
  display_name text,
  club_short text,
  current_rank text,
  lifetime_points bigint,
  rank_position bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.display_name,
    p.club_short,
    cp.current_rank,
    cp.lifetime_points,
    row_number() over (order by cp.lifetime_points desc)::bigint as rank_position
  from public.career_progress cp
  join public.profiles p on p.id = cp.user_id
  where cp.lifetime_points > 0
  order by cp.lifetime_points desc
  limit greatest(p_limit, 10);
$$;

revoke execute on function public.career_leaderboard(int) from anon, public;
grant execute on function public.career_leaderboard(int) to authenticated;

-- ─── 20260527000300_hodl_locks.sql ───
-- ============================================================
-- HODL System — Lock-up de 90 dias com 7,5%/mês (0,25%/dia)
--
-- Fluxo:
--   1. Usuário trava OLEXP via create_hodl_lock(amount)
--   2. Recebe instantaneamente 1 Premium Card (premium_cards_grants)
--   3. Edge function diária (hodl-daily-tick) processa:
--        - rewards de cada lock ativo (0,25% diário em OLEXP)
--        - sorteio entre locks ativos (1 winner/dia, prize card)
--        - maturação de locks com end_date passado
--   4. Após end_date, principal volta pra disposição normal do user
--
-- Saldo OLEXP: existe como wallet.olexpPositions client-side. Aqui criamos
-- ledger server-side que reflete LOCKS específicos do HODL (separado dos
-- planos OLEXP convencionais de 90/180/360d).
-- ============================================================

create table if not exists public.hodl_locks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_locked numeric(36, 8) not null check (amount_locked > 0),
  currency text not null default 'OLEXP' check (currency in ('OLEXP', 'BRO', 'USDT')),
  reward_rate_daily numeric(8, 6) not null default 0.0025,
  start_date timestamptz not null default now(),
  end_date timestamptz not null,
  status text not null default 'active' check (status in ('active', 'matured', 'cancelled')),
  total_rewards_paid numeric(36, 8) not null default 0,
  last_reward_date date,
  matured_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hodl_locks_user_idx
  on public.hodl_locks (user_id, status, created_at desc);

create index if not exists hodl_locks_active_idx
  on public.hodl_locks (status, end_date)
  where status = 'active';

alter table public.hodl_locks enable row level security;

drop policy if exists hodl_locks_select_self on public.hodl_locks;
create policy hodl_locks_select_self
  on public.hodl_locks
  for select
  using (user_id = auth.uid());

-- ============================================================
-- hodl_daily_rewards — ledger imutável de payouts diários (idempotência)
-- ============================================================

create table if not exists public.hodl_daily_rewards (
  id uuid primary key default gen_random_uuid(),
  lock_id uuid not null references public.hodl_locks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  paid_for_date date not null,
  amount numeric(36, 8) not null,
  currency text not null,
  created_at timestamptz not null default now(),
  -- 1 payout por (lock, day)
  constraint hodl_daily_rewards_idempotent unique (lock_id, paid_for_date)
);

create index if not exists hodl_daily_rewards_user_idx
  on public.hodl_daily_rewards (user_id, paid_for_date desc);

alter table public.hodl_daily_rewards enable row level security;

drop policy if exists hodl_daily_rewards_select_self on public.hodl_daily_rewards;
create policy hodl_daily_rewards_select_self
  on public.hodl_daily_rewards
  for select
  using (user_id = auth.uid());

-- ============================================================
-- hodl_lottery_draws — sorteio diário
-- ============================================================

create table if not exists public.hodl_lottery_draws (
  id uuid primary key default gen_random_uuid(),
  draw_date date not null,
  winner_user_id uuid references public.profiles(id) on delete set null,
  winner_lock_id uuid references public.hodl_locks(id) on delete set null,
  prize_type text not null check (prize_type in ('premium_card', 'rare_card', 'legendary_card')),
  prize_metadata jsonb not null default '{}'::jsonb,
  eligible_count int not null default 0,
  created_at timestamptz not null default now(),
  constraint hodl_lottery_draws_one_per_day unique (draw_date)
);

create index if not exists hodl_lottery_draws_winner_idx
  on public.hodl_lottery_draws (winner_user_id, draw_date desc);

alter table public.hodl_lottery_draws enable row level security;

drop policy if exists hodl_lottery_draws_select_all on public.hodl_lottery_draws;
create policy hodl_lottery_draws_select_all
  on public.hodl_lottery_draws
  for select
  using (true);

-- ============================================================
-- premium_cards_grants — registro de cards entregues
-- ============================================================

create table if not exists public.premium_cards_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_tier text not null default 'premium' check (card_tier in ('premium', 'rare', 'legendary')),
  source text not null check (source in ('hodl_lock', 'hodl_lottery', 'career_bonus', 'admin')),
  source_ref text not null,
  card_metadata jsonb not null default '{}'::jsonb,
  redeemed_at timestamptz,
  granted_at timestamptz not null default now(),
  constraint premium_cards_grants_idempotent unique (source, source_ref)
);

create index if not exists premium_cards_grants_user_idx
  on public.premium_cards_grants (user_id, granted_at desc);

create index if not exists premium_cards_grants_pending_idx
  on public.premium_cards_grants (user_id)
  where redeemed_at is null;

alter table public.premium_cards_grants enable row level security;

drop policy if exists premium_cards_grants_select_self on public.premium_cards_grants;
create policy premium_cards_grants_select_self
  on public.premium_cards_grants
  for select
  using (user_id = auth.uid());

-- ============================================================
-- RPC create_hodl_lock — cria lock + dispara premium card
-- ============================================================

create or replace function public.create_hodl_lock(
  p_amount numeric,
  p_currency text default 'OLEXP'
)
returns table (
  lock_id uuid,
  premium_card_id uuid,
  end_date timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lock_id uuid;
  v_card_id uuid;
  v_end_date timestamptz;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  if p_currency not in ('OLEXP', 'BRO', 'USDT') then
    raise exception 'unsupported currency: %', p_currency;
  end if;

  v_end_date := now() + interval '90 days';

  insert into public.hodl_locks (user_id, amount_locked, currency, end_date)
  values (v_uid, p_amount, p_currency, v_end_date)
  returning id into v_lock_id;

  -- Premium card instantâneo
  insert into public.premium_cards_grants (user_id, card_tier, source, source_ref, card_metadata)
  values (
    v_uid,
    'premium',
    'hodl_lock',
    v_lock_id::text,
    jsonb_build_object(
      'lock_amount', p_amount,
      'lock_currency', p_currency,
      'lock_end_date', v_end_date
    )
  )
  returning id into v_card_id;

  return query select v_lock_id, v_card_id, v_end_date;
end;
$$;

revoke execute on function public.create_hodl_lock(numeric, text) from anon, public;
grant execute on function public.create_hodl_lock(numeric, text) to authenticated;

-- ============================================================
-- RPC get_my_hodl_locks
-- ============================================================

create or replace function public.get_my_hodl_locks()
returns table (
  id uuid,
  amount_locked numeric,
  currency text,
  reward_rate_daily numeric,
  start_date timestamptz,
  end_date timestamptz,
  status text,
  total_rewards_paid numeric,
  days_remaining int,
  projected_total_rewards numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    l.amount_locked,
    l.currency,
    l.reward_rate_daily,
    l.start_date,
    l.end_date,
    l.status,
    l.total_rewards_paid,
    greatest(0, extract(day from (l.end_date - now()))::int) as days_remaining,
    round(l.amount_locked * l.reward_rate_daily * 90, 8) as projected_total_rewards
  from public.hodl_locks l
  where l.user_id = auth.uid()
  order by l.created_at desc;
$$;

revoke execute on function public.get_my_hodl_locks() from anon, public;
grant execute on function public.get_my_hodl_locks() to authenticated;

-- ============================================================
-- RPC get_my_premium_cards — cards pendentes de redenção
-- ============================================================

create or replace function public.get_my_premium_cards(p_only_pending boolean default true)
returns table (
  id uuid,
  card_tier text,
  source text,
  card_metadata jsonb,
  granted_at timestamptz,
  redeemed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, card_tier, source, card_metadata, granted_at, redeemed_at
    from public.premium_cards_grants
   where user_id = auth.uid()
     and (not p_only_pending or redeemed_at is null)
   order by granted_at desc;
$$;

revoke execute on function public.get_my_premium_cards(boolean) from anon, public;
grant execute on function public.get_my_premium_cards(boolean) to authenticated;

-- ============================================================
-- RPC redeem_premium_card — marca card como usado
-- ============================================================

create or replace function public.redeem_premium_card(p_card_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_updated int;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  update public.premium_cards_grants
     set redeemed_at = now()
   where id = p_card_id
     and user_id = v_uid
     and redeemed_at is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke execute on function public.redeem_premium_card(uuid) from anon, public;
grant execute on function public.redeem_premium_card(uuid) to authenticated;

-- ============================================================
-- RPC process_hodl_daily_tick — núcleo do cron diário
--
-- Para cada lock 'active':
--   - se end_date passou → status='matured'
--   - senão → cria 1 hodl_daily_rewards (idempotente por dia)
--
-- Faz 1 sorteio diário entre locks ativos (1 premium card pro vencedor).
--
-- IMPORTANTE: chamada via service_role (edge function). Idempotente por dia.
-- ============================================================

create or replace function public.process_hodl_daily_tick(
  p_target_date date default current_date
)
returns table (
  rewards_paid int,
  locks_matured int,
  lottery_winner uuid,
  lottery_eligible int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rewards_paid int := 0;
  v_matured int := 0;
  v_winner_user_id uuid;
  v_winner_lock_id uuid;
  v_eligible int := 0;
  v_lock record;
  v_daily_reward numeric;
begin
  -- 1. Maturar locks vencidos
  update public.hodl_locks
     set status = 'matured', updated_at = now()
   where status = 'active'
     and end_date <= now();
  get diagnostics v_matured = row_count;

  -- 2. Pagar rewards a todos locks ativos (idempotente por lock+date)
  for v_lock in
    select id, user_id, amount_locked, reward_rate_daily, currency
      from public.hodl_locks
     where status = 'active'
       and (last_reward_date is null or last_reward_date < p_target_date)
  loop
    v_daily_reward := round(v_lock.amount_locked * v_lock.reward_rate_daily, 8);
    if v_daily_reward <= 0 then continue; end if;

    insert into public.hodl_daily_rewards (
      lock_id, user_id, paid_for_date, amount, currency
    ) values (
      v_lock.id, v_lock.user_id, p_target_date, v_daily_reward, v_lock.currency
    )
    on conflict (lock_id, paid_for_date) do nothing;

    if found then
      update public.hodl_locks
         set total_rewards_paid = total_rewards_paid + v_daily_reward,
             last_reward_date = p_target_date,
             updated_at = now()
       where id = v_lock.id;
      v_rewards_paid := v_rewards_paid + 1;
    end if;
  end loop;

  -- 3. Sorteio diário (1 vez por dia, idempotente via UNIQUE draw_date)
  if not exists (select 1 from public.hodl_lottery_draws where draw_date = p_target_date) then
    select count(*)::int into v_eligible
      from public.hodl_locks
     where status = 'active';

    if v_eligible > 0 then
      -- Pega 1 lock aleatório entre os ativos (peso uniforme por lock)
      select id, user_id into v_winner_lock_id, v_winner_user_id
        from public.hodl_locks
       where status = 'active'
       order by random()
       limit 1;

      insert into public.hodl_lottery_draws (
        draw_date, winner_user_id, winner_lock_id, prize_type,
        prize_metadata, eligible_count
      ) values (
        p_target_date, v_winner_user_id, v_winner_lock_id, 'premium_card',
        jsonb_build_object('drawn_at', now()), v_eligible
      );

      -- Entrega o prêmio (premium card)
      insert into public.premium_cards_grants (
        user_id, card_tier, source, source_ref, card_metadata
      ) values (
        v_winner_user_id, 'premium', 'hodl_lottery', p_target_date::text,
        jsonb_build_object('draw_date', p_target_date, 'lock_id', v_winner_lock_id)
      )
      on conflict (source, source_ref) do nothing;
    end if;
  end if;

  return query select v_rewards_paid, v_matured, v_winner_user_id, v_eligible;
end;
$$;

revoke execute on function public.process_hodl_daily_tick(date) from anon, public, authenticated;
-- Apenas service_role (via edge function) executa o tick

-- ============================================================
-- pg_cron schedule (executa 00:05 UTC todo dia)
-- ============================================================

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('hodl-daily-tick');
    perform cron.schedule(
      'hodl-daily-tick',
      '5 0 * * *',
      $cron$
        select public.process_hodl_daily_tick(current_date);
      $cron$
    );
  end if;
exception when others then
  -- Se pg_cron não está disponível, ignora — edge function ainda pode chamar
  null;
end;
$$;

-- ─── 20260527000400_activation_pack.sql ───
-- ============================================================
-- ACTIVATION PACK — Gate de entrada do Plano de Carreira ($25 USD)
--
-- Regra de produto:
--   - Para PARTICIPAR (receber comissões, criar HODL, claim de bônus),
--     o usuário precisa comprar um Activation Pack de $25 (2500 cents BRO).
--   - Pack é vitalício (compra única → ativação permanente).
--   - Se um referrer NÃO está ativado, a comissão dele NÃO é criada (vai
--     para um log de "comissões perdidas" como FOMO motivador).
--   - A compra do próprio pack é um wallet_credit normal — paga 5-5-5%
--     para a cadeia (se essa cadeia estiver ativada).
--
-- Por que vitalício: padrão MMN. Se um dia quisermos expirar, adicionar
-- coluna expires_at e mudar is_user_activated() — UI e RPCs continuam.
-- ============================================================

create table if not exists public.activation_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 2500),
  currency text not null default 'BRO' check (currency in ('BRO', 'USDT', 'USD')),
  source text not null default 'purchase' check (source in ('purchase', 'admin_grant', 'promo')),
  wallet_credit_id uuid references public.wallet_credits(id) on delete set null,
  activated_at timestamptz not null default now(),
  expires_at timestamptz, -- null = vitalício
  created_at timestamptz not null default now()
);

-- 1 pack ativo (vitalício) por user. Quando expiração futura existir,
-- aplicar lógica adicional na aplicação ou trigger — índice precisa IMMUTABLE.
create unique index if not exists activation_packs_one_active_per_user
  on public.activation_packs (user_id)
  where expires_at is null;

create index if not exists activation_packs_user_idx
  on public.activation_packs (user_id, activated_at desc);

alter table public.activation_packs enable row level security;

drop policy if exists activation_packs_select_self on public.activation_packs;
create policy activation_packs_select_self
  on public.activation_packs
  for select
  using (user_id = auth.uid());

-- ============================================================
-- Função: is_user_activated(uuid)
-- ============================================================

create or replace function public.is_user_activated(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.activation_packs
     where user_id = p_user_id
       and (expires_at is null or expires_at > now())
    limit 1
  );
$$;

revoke execute on function public.is_user_activated(uuid) from anon, public;
grant execute on function public.is_user_activated(uuid) to authenticated;

-- ============================================================
-- Tabela de comissões perdidas (FOMO motivador)
-- ============================================================

create table if not exists public.affiliate_commissions_lost (
  id uuid primary key default gen_random_uuid(),
  would_be_referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  level smallint not null check (level between 1 and 3),
  source text not null,
  source_ref text not null,
  currency text not null,
  amount_cents bigint not null,
  reason text not null default 'referrer_not_activated',
  created_at timestamptz not null default now()
);

create index if not exists affiliate_commissions_lost_referrer_idx
  on public.affiliate_commissions_lost (would_be_referrer_id, created_at desc);

alter table public.affiliate_commissions_lost enable row level security;

drop policy if exists affiliate_commissions_lost_select_self on public.affiliate_commissions_lost;
create policy affiliate_commissions_lost_select_self
  on public.affiliate_commissions_lost
  for select
  using (would_be_referrer_id = auth.uid());

-- ============================================================
-- Adiciona coluna lost_commissions_cents em career_progress
-- ============================================================

alter table public.career_progress
  add column if not exists lost_commissions_cents bigint not null default 0;

-- ============================================================
-- SUBSTITUI o trigger de bônus: agora respeita ativação
-- ============================================================

create or replace function public.trg_wallet_credit_affiliate_bonus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate numeric := 0.05;
  v_bro_bonus bigint;
  v_exp_bonus bigint;
  v_chain record;
  v_referrer_active boolean;
begin
  if new.applied_at is null then return new; end if;
  if old.applied_at is not null then return new; end if;

  v_bro_bonus := coalesce(floor(new.bro_cents * v_rate), 0)::bigint;
  v_exp_bonus := coalesce(floor(coalesce(new.exp_amount, 0) * v_rate), 0)::bigint;

  if v_bro_bonus <= 0 and v_exp_bonus <= 0 then return new; end if;

  for v_chain in select * from public.get_referral_chain(new.user_id, 3) loop
    v_referrer_active := public.is_user_activated(v_chain.referrer_id);

    if v_referrer_active then
      -- Referrer ATIVADO: gera comissões normalmente
      if v_bro_bonus > 0 then
        insert into public.affiliate_commissions (
          referrer_id, referred_id, level, source, source_ref,
          currency, amount_cents, rate, base_amount_cents, status
        ) values (
          v_chain.referrer_id, new.user_id, v_chain.level, 'deposit',
          'wallet_credit:' || new.id::text || ':BRO',
          'BRO', v_bro_bonus, v_rate, new.bro_cents, 'confirmed'
        )
        on conflict (source_ref, level) do nothing;
      end if;

      if v_exp_bonus > 0 then
        insert into public.affiliate_commissions (
          referrer_id, referred_id, level, source, source_ref,
          currency, amount_cents, rate, base_amount_cents, status
        ) values (
          v_chain.referrer_id, new.user_id, v_chain.level, 'deposit',
          'wallet_credit:' || new.id::text || ':EXP',
          'EXP', v_exp_bonus, v_rate, new.exp_amount, 'confirmed'
        )
        on conflict (source_ref, level) do nothing;
      end if;
    else
      -- Referrer NÃO ativado: registra perda (FOMO) e atualiza contador
      if v_bro_bonus > 0 then
        insert into public.affiliate_commissions_lost (
          would_be_referrer_id, referred_id, level, source, source_ref,
          currency, amount_cents
        ) values (
          v_chain.referrer_id, new.user_id, v_chain.level, 'deposit',
          'wallet_credit:' || new.id::text || ':BRO',
          'BRO', v_bro_bonus
        );

        insert into public.career_progress (user_id, lost_commissions_cents)
        values (v_chain.referrer_id, v_bro_bonus)
        on conflict (user_id) do update
          set lost_commissions_cents = career_progress.lost_commissions_cents + v_bro_bonus,
              updated_at = now();
      end if;
    end if;
  end loop;

  return new;
end;
$$;

revoke execute on function public.trg_wallet_credit_affiliate_bonus() from anon, authenticated, public;

-- ============================================================
-- RPC purchase_activation_pack — flujo de compra/ativação
--
-- Cria wallet_credit (debitando saldo via apply normal? NO — pack é compra,
-- então NÃO credita BRO; cria entry de activation_packs e marca o gate).
-- O cliente paga $25 via gateway. Quando o pagamento confirma, esta RPC
-- é chamada (idealmente pelo webhook ou edge function).
--
-- Modelo simples (MVP):
--   - Recebe amount_cents (deve ser >= 2500)
--   - Cria activation_packs entry
--   - NÃO mexe em wallet_credits (depósito real fica separado)
--
-- Pra integração com gateway futuro: criar wallet_credits row com
-- source='activation_pack' e chamar esta RPC depois de marcar applied_at —
-- assim o trigger de bônus dispara normal, dando 5-5-5% pros 3 níveis.
-- ============================================================

create or replace function public.purchase_activation_pack(
  p_amount_cents bigint default 2500,
  p_wallet_credit_id uuid default null,
  p_source text default 'purchase'
)
returns table (
  activation_id uuid,
  user_id uuid,
  amount_cents bigint,
  activated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_now timestamptz := now();
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  if p_amount_cents < 2500 then
    raise exception 'minimum pack amount is 2500 cents ($25)';
  end if;

  if p_source not in ('purchase', 'admin_grant', 'promo') then
    raise exception 'invalid source: %', p_source;
  end if;

  -- Já ativado? Não cria novo (mantém o existente)
  if public.is_user_activated(v_uid) then
    return query
      select ap.id, ap.user_id, ap.amount_cents, ap.activated_at
        from public.activation_packs ap
       where ap.user_id = v_uid
         and (ap.expires_at is null or ap.expires_at > now())
       order by ap.activated_at desc
       limit 1;
    return;
  end if;

  insert into public.activation_packs (
    user_id, amount_cents, currency, source, wallet_credit_id, activated_at
  ) values (
    v_uid, p_amount_cents, 'BRO', p_source, p_wallet_credit_id, v_now
  )
  returning id into v_id;

  return query
    select v_id, v_uid, p_amount_cents, v_now;
end;
$$;

revoke execute on function public.purchase_activation_pack(bigint, uuid, text) from anon, public;
grant execute on function public.purchase_activation_pack(bigint, uuid, text) to authenticated;

-- ============================================================
-- RPC get_my_activation_status — status pro UI
-- ============================================================

create or replace function public.get_my_activation_status()
returns table (
  is_activated boolean,
  activated_at timestamptz,
  expires_at timestamptz,
  total_lost_commissions_cents bigint,
  activation_amount_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;

  return query
  select
    public.is_user_activated(v_uid) as is_activated,
    (select ap.activated_at from public.activation_packs ap
      where ap.user_id = v_uid
        and (ap.expires_at is null or ap.expires_at > now())
      order by ap.activated_at desc limit 1) as activated_at,
    (select ap.expires_at from public.activation_packs ap
      where ap.user_id = v_uid
        and (ap.expires_at is null or ap.expires_at > now())
      order by ap.activated_at desc limit 1) as expires_at,
    coalesce((select cp.lost_commissions_cents from public.career_progress cp
              where cp.user_id = v_uid), 0)::bigint as total_lost_commissions_cents,
    2500::bigint as activation_amount_cents;
end;
$$;

revoke execute on function public.get_my_activation_status() from anon, public;
grant execute on function public.get_my_activation_status() to authenticated;

-- ============================================================
-- Modifica RPCs existentes para EXIGIR ativação
-- ============================================================

-- create_hodl_lock: bloqueia se não ativado
create or replace function public.create_hodl_lock(
  p_amount numeric,
  p_currency text default 'OLEXP'
)
returns table (
  lock_id uuid,
  premium_card_id uuid,
  end_date timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lock_id uuid;
  v_card_id uuid;
  v_end_date timestamptz;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;

  if not public.is_user_activated(v_uid) then
    raise exception 'ACTIVATION_REQUIRED: compre o pack de $25 para participar do HODL';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  if p_currency not in ('OLEXP', 'BRO', 'USDT') then
    raise exception 'unsupported currency: %', p_currency;
  end if;

  v_end_date := now() + interval '90 days';

  insert into public.hodl_locks (user_id, amount_locked, currency, end_date)
  values (v_uid, p_amount, p_currency, v_end_date)
  returning id into v_lock_id;

  insert into public.premium_cards_grants (user_id, card_tier, source, source_ref, card_metadata)
  values (
    v_uid, 'premium', 'hodl_lock', v_lock_id::text,
    jsonb_build_object('lock_amount', p_amount, 'lock_currency', p_currency, 'lock_end_date', v_end_date)
  )
  returning id into v_card_id;

  return query select v_lock_id, v_card_id, v_end_date;
end;
$$;

revoke execute on function public.create_hodl_lock(numeric, text) from anon, public;
grant execute on function public.create_hodl_lock(numeric, text) to authenticated;

-- claim_career_bonus: bloqueia se não ativado
create or replace function public.claim_career_bonus()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pending bigint;
  v_rank text;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;

  if not public.is_user_activated(v_uid) then
    raise exception 'ACTIVATION_REQUIRED: compre o pack de $25 para resgatar bônus';
  end if;

  select pending_bonus_cents, current_rank into v_pending, v_rank
    from public.career_progress
   where user_id = v_uid
   for update;

  if v_pending is null or v_pending <= 0 then return 0; end if;

  insert into public.wallet_credits (user_id, bro_cents, exp_amount, reason, applied_at)
  values (v_uid, v_pending, 0, 'career_bonus:' || v_rank, null);

  update public.career_progress
     set unlocked_rewards = unlocked_rewards || jsonb_build_object(
       'rank', v_rank, 'amount_cents', v_pending, 'claimed_at', now()
     ),
     pending_bonus_cents = 0,
     updated_at = now()
   where user_id = v_uid;

  return v_pending;
end;
$$;

revoke execute on function public.claim_career_bonus() from anon, public;
grant execute on function public.claim_career_bonus() to authenticated;

-- claim_my_affiliate_commissions: bloqueia se não ativado
create or replace function public.claim_my_affiliate_commissions(
  p_currency text default null
)
returns table (
  currency text,
  total_cents bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;

  if not public.is_user_activated(v_uid) then
    raise exception 'ACTIVATION_REQUIRED: compre o pack de $25 para resgatar comissões';
  end if;

  return query
  with claimed as (
    update public.affiliate_commissions
       set claimed_at = now()
     where referrer_id = v_uid
       and claimed_at is null
       and status = 'confirmed'
       and (p_currency is null or currency = p_currency)
    returning currency, amount_cents
  )
  select c.currency, coalesce(sum(c.amount_cents), 0)::bigint
    from claimed c
   group by c.currency;
end;
$$;

revoke execute on function public.claim_my_affiliate_commissions(text) from anon, public;
grant execute on function public.claim_my_affiliate_commissions(text) to authenticated;

-- ─── 20260528000000_activation_gateway_fix.sql ───
-- ============================================================
-- ACTIVATION GATEWAY FIX — Bloqueia ativação grátis
--
-- Antes: purchase_activation_pack criava activation_packs sem cobrar.
-- Agora: exige wallet_credit_id válido (pago e aplicado) >= $25.
--
-- Caminho pré-PIX: admin chama admin_grant_activation_pack que cria
-- wallet_credit + activation_pack atomicamente.
-- Caminho pós-PIX: webhook do Abacatepay cria wallet_credit com PIX
-- confirmado e depois chama purchase_activation_pack com esse id.
-- ============================================================

-- 1. UNIQUE constraint: 1 ativação por wallet_credit (idempotência)
alter table public.activation_packs
  add constraint activation_packs_wallet_credit_unique
    unique (wallet_credit_id) deferrable initially deferred;

-- Nota: nullable (legacy rows pré-fix podem ter wallet_credit_id = null)

-- 2. SUBSTITUI purchase_activation_pack — agora exige wallet_credit_id NOT NULL
create or replace function public.purchase_activation_pack(
  p_amount_cents bigint default 2500,
  p_wallet_credit_id uuid default null,
  p_source text default 'purchase'
)
returns table (
  activation_id uuid,
  user_id uuid,
  amount_cents bigint,
  activated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_now timestamptz := now();
  v_credit record;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  if p_amount_cents < 2500 then
    raise exception 'minimum pack amount is 2500 cents ($25)';
  end if;

  if p_source not in ('purchase', 'admin_grant', 'promo') then
    raise exception 'invalid source: %', p_source;
  end if;

  -- Idempotente: já ativado? Retorna existente
  if public.is_user_activated(v_uid) then
    return query
      select ap.id, ap.user_id, ap.amount_cents, ap.activated_at
        from public.activation_packs ap
       where ap.user_id = v_uid
         and (ap.expires_at is null or ap.expires_at > now())
       order by ap.activated_at desc
       limit 1;
    return;
  end if;

  -- ATIVAÇÃO EXIGE PAGAMENTO REAL — exceto admin_grant
  if p_source = 'purchase' then
    if p_wallet_credit_id is null then
      raise exception 'ACTIVATION_REQUIRES_PAYMENT: wallet_credit_id obrigatório para ativação por compra';
    end if;

    select * into v_credit
      from public.wallet_credits
     where id = p_wallet_credit_id;

    if v_credit is null then
      raise exception 'WALLET_CREDIT_NOT_FOUND';
    end if;

    if v_credit.user_id <> v_uid then
      raise exception 'WALLET_CREDIT_WRONG_OWNER';
    end if;

    if v_credit.applied_at is null then
      raise exception 'WALLET_CREDIT_NOT_APPLIED: depósito ainda não confirmado';
    end if;

    if coalesce(v_credit.bro_cents, 0) < p_amount_cents then
      raise exception 'WALLET_CREDIT_INSUFFICIENT: depósito de % cents insuficiente para pack de %', v_credit.bro_cents, p_amount_cents;
    end if;

    if exists (
      select 1 from public.activation_packs ap
       where ap.wallet_credit_id = p_wallet_credit_id
    ) then
      raise exception 'WALLET_CREDIT_ALREADY_USED: este crédito já ativou outra conta';
    end if;
  end if;

  -- admin_grant e promo podem passar wallet_credit_id null
  insert into public.activation_packs (
    user_id, amount_cents, currency, source, wallet_credit_id, activated_at
  ) values (
    v_uid, p_amount_cents, 'BRO', p_source, p_wallet_credit_id, v_now
  )
  returning id into v_id;

  return query
    select v_id, v_uid, p_amount_cents, v_now;
end;
$$;

revoke execute on function public.purchase_activation_pack(bigint, uuid, text) from anon, public;
grant execute on function public.purchase_activation_pack(bigint, uuid, text) to authenticated;

-- ============================================================
-- 3. RPC admin_grant_activation_pack — bypass admin (auditável)
--
-- Cria wallet_credit + activation_pack atomicamente em nome do user-alvo.
-- Útil pra: grants promocionais, testes pré-PIX, suporte ao cliente.
-- ============================================================

create or replace function public.admin_grant_activation_pack(
  p_target_user_id uuid,
  p_reason text default 'admin_grant'
)
returns table (
  activation_id uuid,
  wallet_credit_id uuid,
  user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credit_id uuid;
  v_activation_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if p_target_user_id is null then
    raise exception 'target user id required';
  end if;

  -- Idempotente
  if public.is_user_activated(p_target_user_id) then
    return query
      select ap.id, ap.wallet_credit_id, ap.user_id
        from public.activation_packs ap
       where ap.user_id = p_target_user_id
         and (ap.expires_at is null or ap.expires_at > now())
       order by ap.activated_at desc
       limit 1;
    return;
  end if;

  -- 1. Cria wallet_credit já aplicado (grants admin não geram comissão 5-5-5%
  --    pra rede do user-alvo — só wallets com bro_cents > 0 disparam trigger,
  --    e queremos isso aqui pra refletir o "pagamento simulado" no histórico).
  --    Se quiseres GRANT sem disparar 5-5-5%, mudar bro_cents pra 0 — mas o
  --    pack continua valendo.
  insert into public.wallet_credits (user_id, bro_cents, exp_amount, reason, applied_at)
  values (p_target_user_id, 2500, 0, 'admin_activation_grant:' || p_reason, now())
  returning id into v_credit_id;

  -- 2. Cria activation_packs row
  insert into public.activation_packs (
    user_id, amount_cents, currency, source, wallet_credit_id, activated_at
  ) values (
    p_target_user_id, 2500, 'BRO', 'admin_grant', v_credit_id, now()
  )
  returning id into v_activation_id;

  return query select v_activation_id, v_credit_id, p_target_user_id;
end;
$$;

revoke execute on function public.admin_grant_activation_pack(uuid, text) from anon, public, authenticated;
-- Apenas admins via Supabase Studio (com auth.uid() válido) podem chamar
grant execute on function public.admin_grant_activation_pack(uuid, text) to authenticated;

-- ─── 20260528000100_olexp_balances.sql ───
-- ============================================================
-- OLEXP BALANCES — Ledger server-side de OLEXP
--
-- Por que existe:
--   Antes: OLEXP era apenas Zustand client-side em WalletState.
--   Problema: create_hodl_lock aceitava qualquer amount sem debitar.
--   User podia "travar" 1M OLEXP sem ter saldo e drenar treasury.
--
-- Modelo:
--   - olexp_balances: cache do saldo atual (1 row por user)
--   - olexp_ledger: histórico imutável de débitos/créditos
--   - Funções _credit_olexp / _debit_olexp são security definer,
--     internas (sem grant pra authenticated/anon), só chamadas por
--     outras RPCs (HODL, futuro marketplace, futuro PIX).
-- ============================================================

create table if not exists public.olexp_balances (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric(36, 8) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists olexp_balances_balance_idx
  on public.olexp_balances (balance desc)
  where balance > 0;

alter table public.olexp_balances enable row level security;

drop policy if exists olexp_balances_select_self on public.olexp_balances;
create policy olexp_balances_select_self
  on public.olexp_balances
  for select
  using (user_id = auth.uid());

-- ============================================================
-- Ledger imutável de movimentos OLEXP
-- ============================================================

create table if not exists public.olexp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta numeric(36, 8) not null check (delta <> 0),
  balance_after numeric(36, 8) not null check (balance_after >= 0),
  source text not null check (source in (
    'hodl_lock', 'hodl_matured', 'hodl_daily_reward', 'hodl_lottery',
    'admin_grant', 'admin_debit', 'card_purchase', 'pix_deposit',
    'swap_in', 'swap_out', 'initial_seed'
  )),
  source_ref text,
  created_at timestamptz not null default now()
);

create index if not exists olexp_ledger_user_idx
  on public.olexp_ledger (user_id, created_at desc);

create index if not exists olexp_ledger_source_idx
  on public.olexp_ledger (source, created_at desc);

alter table public.olexp_ledger enable row level security;

drop policy if exists olexp_ledger_select_self on public.olexp_ledger;
create policy olexp_ledger_select_self
  on public.olexp_ledger
  for select
  using (user_id = auth.uid());

-- ============================================================
-- Função interna: _credit_olexp
-- (security definer, sem grant — só chamada por outras RPCs)
-- ============================================================

create or replace function public._credit_olexp(
  p_user_id uuid,
  p_amount numeric,
  p_source text,
  p_source_ref text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance numeric(36, 8);
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT: credit must be positive';
  end if;

  insert into public.olexp_balances (user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id) do update
    set balance = olexp_balances.balance + p_amount,
        updated_at = now()
  returning balance into v_new_balance;

  insert into public.olexp_ledger (user_id, delta, balance_after, source, source_ref)
  values (p_user_id, p_amount, v_new_balance, p_source, p_source_ref);

  return v_new_balance;
end;
$$;

revoke execute on function public._credit_olexp(uuid, numeric, text, text) from anon, authenticated, public;

-- ============================================================
-- Função interna: _debit_olexp
-- Lock row + valida saldo + raise INSUFFICIENT_OLEXP_BALANCE
-- ============================================================

create or replace function public._debit_olexp(
  p_user_id uuid,
  p_amount numeric,
  p_source text,
  p_source_ref text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_balance numeric(36, 8);
  v_new_balance numeric(36, 8);
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT: debit must be positive';
  end if;

  -- Lock row pra evitar race condition em débitos concorrentes
  select balance into v_current_balance
    from public.olexp_balances
   where user_id = p_user_id
   for update;

  if v_current_balance is null then
    raise exception 'INSUFFICIENT_OLEXP_BALANCE: saldo zero';
  end if;

  if v_current_balance < p_amount then
    raise exception 'INSUFFICIENT_OLEXP_BALANCE: saldo % insuficiente para débito de %', v_current_balance, p_amount;
  end if;

  v_new_balance := v_current_balance - p_amount;

  update public.olexp_balances
     set balance = v_new_balance,
         updated_at = now()
   where user_id = p_user_id;

  insert into public.olexp_ledger (user_id, delta, balance_after, source, source_ref)
  values (p_user_id, -p_amount, v_new_balance, p_source, p_source_ref);

  return v_new_balance;
end;
$$;

revoke execute on function public._debit_olexp(uuid, numeric, text, text) from anon, authenticated, public;

-- ============================================================
-- RPC pública: get_my_olexp_balance
-- ============================================================

create or replace function public.get_my_olexp_balance()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(balance, 0)::numeric(36, 8)
    from public.olexp_balances
   where user_id = auth.uid();
$$;

revoke execute on function public.get_my_olexp_balance() from anon, public;
grant execute on function public.get_my_olexp_balance() to authenticated;

-- ============================================================
-- RPC pública: get_my_olexp_ledger (histórico)
-- ============================================================

create or replace function public.get_my_olexp_ledger(p_limit int default 50)
returns table (
  id uuid,
  delta numeric,
  balance_after numeric,
  source text,
  source_ref text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, delta, balance_after, source, source_ref, created_at
    from public.olexp_ledger
   where user_id = auth.uid()
   order by created_at desc
   limit greatest(p_limit, 10);
$$;

revoke execute on function public.get_my_olexp_ledger(int) from anon, public;
grant execute on function public.get_my_olexp_ledger(int) to authenticated;

-- ============================================================
-- RPC admin: admin_credit_olexp / admin_debit_olexp (auditável)
-- ============================================================

create or replace function public.admin_credit_olexp(
  p_target_user_id uuid,
  p_amount numeric,
  p_reason text
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  return public._credit_olexp(p_target_user_id, p_amount, 'admin_grant', p_reason);
end;
$$;

revoke execute on function public.admin_credit_olexp(uuid, numeric, text) from anon, public;
grant execute on function public.admin_credit_olexp(uuid, numeric, text) to authenticated;

-- ─── 20260528000200_hodl_olexp_integration.sql ───
-- ============================================================
-- HODL ↔ OLEXP INTEGRATION
--
-- Antes: create_hodl_lock criava lock sem debitar saldo. BUG grave.
-- Agora: debita via _debit_olexp atomicamente. Rewards diários creditam.
-- Lock maturado libera principal de volta ao saldo.
--
-- TUDO atômico — qualquer falha rola back o lock inteiro.
-- ============================================================

-- ============================================================
-- 1. SUBSTITUI create_hodl_lock — agora debita saldo OLEXP
-- ============================================================

create or replace function public.create_hodl_lock(
  p_amount numeric,
  p_currency text default 'OLEXP'
)
returns table (
  lock_id uuid,
  premium_card_id uuid,
  end_date timestamptz,
  new_olexp_balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lock_id uuid;
  v_card_id uuid;
  v_end_date timestamptz;
  v_new_balance numeric(36, 8);
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;

  if not public.is_user_activated(v_uid) then
    raise exception 'ACTIVATION_REQUIRED: compre o pack de $25 para participar do HODL';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  -- Atualmente só OLEXP. Quando suportarmos BRO/USDT, expandir aqui.
  if p_currency <> 'OLEXP' then
    raise exception 'unsupported currency for HODL: % (only OLEXP for now)', p_currency;
  end if;

  v_end_date := now() + interval '90 days';

  -- 1. DEBITA OLEXP do user (raises se saldo insuficiente — toda transação rola back)
  insert into public.hodl_locks (user_id, amount_locked, currency, end_date)
  values (v_uid, p_amount, p_currency, v_end_date)
  returning id into v_lock_id;

  v_new_balance := public._debit_olexp(v_uid, p_amount, 'hodl_lock', v_lock_id::text);

  -- 2. Premium card instantâneo
  insert into public.premium_cards_grants (user_id, card_tier, source, source_ref, card_metadata)
  values (
    v_uid, 'premium', 'hodl_lock', v_lock_id::text,
    jsonb_build_object('lock_amount', p_amount, 'lock_currency', p_currency, 'lock_end_date', v_end_date)
  )
  returning id into v_card_id;

  return query select v_lock_id, v_card_id, v_end_date, v_new_balance;
end;
$$;

revoke execute on function public.create_hodl_lock(numeric, text) from anon, public;
grant execute on function public.create_hodl_lock(numeric, text) to authenticated;

-- ============================================================
-- 2. SUBSTITUI process_hodl_daily_tick — credita rewards no OLEXP balance
-- ============================================================

create or replace function public.process_hodl_daily_tick(
  p_target_date date default current_date
)
returns table (
  rewards_paid int,
  locks_matured int,
  lottery_winner uuid,
  lottery_eligible int,
  total_olexp_credited numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rewards_paid int := 0;
  v_matured int := 0;
  v_winner_user_id uuid;
  v_winner_lock_id uuid;
  v_eligible int := 0;
  v_lock record;
  v_daily_reward numeric;
  v_total_credited numeric := 0;
begin
  -- 1. Maturar locks vencidos + LIBERAR principal de volta ao saldo OLEXP
  for v_lock in
    select id, user_id, amount_locked
      from public.hodl_locks
     where status = 'active'
       and end_date <= now()
  loop
    update public.hodl_locks
       set status = 'matured',
           matured_claimed_at = now(),
           updated_at = now()
     where id = v_lock.id;

    -- LIBERA principal: credita de volta ao saldo OLEXP do user
    perform public._credit_olexp(v_lock.user_id, v_lock.amount_locked, 'hodl_matured', v_lock.id::text);

    v_matured := v_matured + 1;
    v_total_credited := v_total_credited + v_lock.amount_locked;
  end loop;

  -- 2. Pagar rewards a todos locks ativos (idempotente por lock+date)
  for v_lock in
    select id, user_id, amount_locked, reward_rate_daily, currency
      from public.hodl_locks
     where status = 'active'
       and (last_reward_date is null or last_reward_date < p_target_date)
  loop
    v_daily_reward := round(v_lock.amount_locked * v_lock.reward_rate_daily, 8);
    if v_daily_reward <= 0 then continue; end if;

    insert into public.hodl_daily_rewards (
      lock_id, user_id, paid_for_date, amount, currency
    ) values (
      v_lock.id, v_lock.user_id, p_target_date, v_daily_reward, v_lock.currency
    )
    on conflict (lock_id, paid_for_date) do nothing;

    if found then
      -- Credita reward direto no saldo OLEXP do user
      perform public._credit_olexp(v_lock.user_id, v_daily_reward, 'hodl_daily_reward', v_lock.id::text || ':' || p_target_date::text);

      update public.hodl_locks
         set total_rewards_paid = total_rewards_paid + v_daily_reward,
             last_reward_date = p_target_date,
             updated_at = now()
       where id = v_lock.id;

      v_rewards_paid := v_rewards_paid + 1;
      v_total_credited := v_total_credited + v_daily_reward;
    end if;
  end loop;

  -- 3. Sorteio diário (1 vez por dia, idempotente)
  if not exists (select 1 from public.hodl_lottery_draws where draw_date = p_target_date) then
    select count(*)::int into v_eligible
      from public.hodl_locks
     where status = 'active';

    if v_eligible > 0 then
      select id, user_id into v_winner_lock_id, v_winner_user_id
        from public.hodl_locks
       where status = 'active'
       order by random()
       limit 1;

      insert into public.hodl_lottery_draws (
        draw_date, winner_user_id, winner_lock_id, prize_type,
        prize_metadata, eligible_count
      ) values (
        p_target_date, v_winner_user_id, v_winner_lock_id, 'premium_card',
        jsonb_build_object('drawn_at', now()), v_eligible
      );

      insert into public.premium_cards_grants (
        user_id, card_tier, source, source_ref, card_metadata
      ) values (
        v_winner_user_id, 'premium', 'hodl_lottery', p_target_date::text,
        jsonb_build_object('draw_date', p_target_date, 'lock_id', v_winner_lock_id)
      )
      on conflict (source, source_ref) do nothing;
    end if;
  end if;

  return query select v_rewards_paid, v_matured, v_winner_user_id, v_eligible, v_total_credited;
end;
$$;

revoke execute on function public.process_hodl_daily_tick(date) from anon, public, authenticated;

-- ============================================================
-- 3. NOVO RPC — get_hodl_rewards_for_lock (histórico de rewards de 1 lock)
-- ============================================================

create or replace function public.get_hodl_rewards_for_lock(p_lock_id uuid)
returns table (
  paid_for_date date,
  amount numeric,
  currency text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.paid_for_date, r.amount, r.currency, r.created_at
    from public.hodl_daily_rewards r
    join public.hodl_locks l on l.id = r.lock_id
   where r.lock_id = p_lock_id
     and l.user_id = auth.uid()
   order by r.paid_for_date desc;
$$;

revoke execute on function public.get_hodl_rewards_for_lock(uuid) from anon, public;
grant execute on function public.get_hodl_rewards_for_lock(uuid) to authenticated;

-- ============================================================
-- 4. NOVO RPC — get_recent_lottery_draws (feed público)
-- ============================================================

create or replace function public.get_recent_lottery_draws(p_limit int default 10)
returns table (
  draw_date date,
  winner_user_id uuid,
  winner_display_name text,
  winner_club_short text,
  prize_type text,
  eligible_count int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.draw_date,
    d.winner_user_id,
    p.display_name,
    p.club_short,
    d.prize_type,
    d.eligible_count
  from public.hodl_lottery_draws d
  left join public.profiles p on p.id = d.winner_user_id
  order by d.draw_date desc
  limit greatest(p_limit, 5);
$$;

revoke execute on function public.get_recent_lottery_draws(int) from anon, public;
grant execute on function public.get_recent_lottery_draws(int) to authenticated;

-- ─── 20260528100000_payment_intents.sql ───
-- ============================================================
-- PAYMENT INTENTS — Camada agnóstica de pagamento (PIX via Abacate Pay)
--
-- Arquitetura:
--   1. Front pede ao backend: "criar PIX pra ativation_pack"
--   2. Backend (Hono) chama POST /v2/transparents/create no Abacate
--   3. Salva payment_intent + retorna brCode/brCodeBase64 pro front
--   4. User paga PIX no app do banco
--   5. Abacate envia webhook "transparent.completed" → edge function
--   6. Edge function valida HMAC + chama confirm_payment_intent RPC
--   7. RPC: marca paid_at + cria wallet_credit (applied) + cria activation_pack
--   8. Trigger 5-5-5% existente dispara → comissões pra rede do user
--
-- Idempotência:
--   - payment_intents.external_id UNIQUE (1 charge por intent)
--   - payment_webhooks_log.event_id UNIQUE (1 processamento por evento)
--   - confirm_payment_intent re-entrante (status=paid → retorna OK)
-- ============================================================

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  external_id text not null unique,
  abacate_id text,
  product_kind text not null check (product_kind in ('activation_pack', 'card', 'recharge')),
  product_ref text,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'BRL',
  br_code text,
  br_code_base64 text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'cancelled', 'failed')),
  dev_mode boolean not null default false,
  customer_name text,
  customer_email text,
  customer_tax_id text,
  customer_cellphone text,
  expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_intents_user_idx
  on public.payment_intents (user_id, created_at desc);

create index if not exists payment_intents_status_idx
  on public.payment_intents (status, created_at desc);

create index if not exists payment_intents_abacate_idx
  on public.payment_intents (abacate_id)
  where abacate_id is not null;

alter table public.payment_intents enable row level security;

drop policy if exists payment_intents_select_self on public.payment_intents;
create policy payment_intents_select_self
  on public.payment_intents
  for select
  using (user_id = auth.uid());

-- ============================================================
-- payment_webhooks_log — idempotência absoluta
-- ============================================================

create table if not exists public.payment_webhooks_log (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  raw_payload jsonb not null,
  signature_header text,
  signature_valid boolean,
  intent_id uuid references public.payment_intents(id) on delete set null,
  processed_at timestamptz,
  error_message text,
  received_at timestamptz not null default now()
);

create index if not exists payment_webhooks_log_event_idx
  on public.payment_webhooks_log (event_type, received_at desc);

alter table public.payment_webhooks_log enable row level security;

-- Webhooks log: só admins veem. Webhook insere via service_role.
drop policy if exists payment_webhooks_log_select_admin on public.payment_webhooks_log;
create policy payment_webhooks_log_select_admin
  on public.payment_webhooks_log
  for select
  using (public.is_admin());

-- ============================================================
-- RPC create_payment_intent — chamada pelo backend Hono ANTES de chamar Abacate
-- ============================================================

create or replace function public.create_payment_intent(
  p_product_kind text,
  p_product_ref text default null,
  p_amount_cents bigint default 12500,
  p_customer_name text default null,
  p_customer_email text default null,
  p_customer_tax_id text default null,
  p_customer_cellphone text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  intent_id uuid,
  external_id text,
  amount_cents bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_intent_id uuid;
  v_external text;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  if p_amount_cents <= 0 then
    raise exception 'amount must be positive';
  end if;

  if p_product_kind not in ('activation_pack', 'card', 'recharge') then
    raise exception 'invalid product_kind: %', p_product_kind;
  end if;

  -- external_id determinístico: user + product_kind + timestamp + product_ref
  v_external := 'olefoot_' || v_uid::text || '_' || p_product_kind || '_' ||
                extract(epoch from now())::bigint::text ||
                coalesce('_' || p_product_ref, '');

  insert into public.payment_intents (
    user_id, external_id, product_kind, product_ref,
    amount_cents, customer_name, customer_email, customer_tax_id, customer_cellphone,
    metadata
  )
  values (
    v_uid, v_external, p_product_kind, p_product_ref,
    p_amount_cents, p_customer_name, p_customer_email, p_customer_tax_id, p_customer_cellphone,
    p_metadata
  )
  returning id into v_intent_id;

  return query select v_intent_id, v_external, p_amount_cents;
end;
$$;

revoke execute on function public.create_payment_intent(text, text, bigint, text, text, text, text, jsonb) from anon, public;
grant execute on function public.create_payment_intent(text, text, bigint, text, text, text, text, jsonb) to authenticated;

-- ============================================================
-- RPC update_payment_intent_charge — chamada pelo backend Hono APÓS Abacate
-- responder com brCode/brCodeBase64
-- ============================================================

create or replace function public.update_payment_intent_charge(
  p_intent_id uuid,
  p_abacate_id text,
  p_br_code text,
  p_br_code_base64 text,
  p_expires_at timestamptz,
  p_dev_mode boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_updated int;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  update public.payment_intents
     set abacate_id = p_abacate_id,
         br_code = p_br_code,
         br_code_base64 = p_br_code_base64,
         expires_at = p_expires_at,
         dev_mode = p_dev_mode,
         updated_at = now()
   where id = p_intent_id
     and user_id = v_uid
     and status = 'pending';

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke execute on function public.update_payment_intent_charge(uuid, text, text, text, timestamptz, boolean) from anon, public;
grant execute on function public.update_payment_intent_charge(uuid, text, text, text, timestamptz, boolean) to authenticated;

-- ============================================================
-- RPC get_my_payment_intent — usado pelo modal de checkout (polling)
-- ============================================================

create or replace function public.get_my_payment_intent(p_intent_id uuid)
returns table (
  id uuid,
  status text,
  amount_cents bigint,
  br_code text,
  br_code_base64 text,
  expires_at timestamptz,
  paid_at timestamptz,
  product_kind text,
  product_ref text,
  dev_mode boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select id, status, amount_cents, br_code, br_code_base64,
         expires_at, paid_at, product_kind, product_ref, dev_mode
    from public.payment_intents
   where id = p_intent_id
     and user_id = auth.uid();
$$;

revoke execute on function public.get_my_payment_intent(uuid) from anon, public;
grant execute on function public.get_my_payment_intent(uuid) to authenticated;

-- ============================================================
-- RPC confirm_payment_intent — chamado pelo webhook após validar HMAC
--
-- Atômico:
--   1. Marca intent como paid
--   2. Cria wallet_credit (já com applied_at = now → trigger 5-5-5% dispara)
--   3. Se product_kind = activation_pack: cria activation_pack apontando pro wallet_credit
--   4. Se product_kind = card: TODO (Fase 9 marketplace)
--   5. Se product_kind = recharge: nada além do wallet_credit
--
-- Idempotente: se já pago, retorna OK.
-- ============================================================

create or replace function public.confirm_payment_intent(
  p_intent_id uuid,
  p_abacate_id text default null
)
returns table (
  intent_id uuid,
  status text,
  wallet_credit_id uuid,
  activation_id uuid,
  was_already_paid boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent record;
  v_credit_id uuid;
  v_activation_id uuid;
  v_was_paid boolean := false;
begin
  -- Lock the row
  select * into v_intent
    from public.payment_intents
   where id = p_intent_id
   for update;

  if v_intent is null then
    raise exception 'PAYMENT_INTENT_NOT_FOUND';
  end if;

  -- Idempotência absoluta
  if v_intent.status = 'paid' then
    v_was_paid := true;
    -- Retorna links existentes do credit + activation se houver
    select id into v_credit_id
      from public.wallet_credits
     where user_id = v_intent.user_id
       and reason = 'pix_payment:' || v_intent.id::text
     order by created_at desc
     limit 1;

    select id into v_activation_id
      from public.activation_packs
     where user_id = v_intent.user_id
       and wallet_credit_id = v_credit_id
     order by activated_at desc
     limit 1;

    return query select v_intent.id, v_intent.status, v_credit_id, v_activation_id, v_was_paid;
    return;
  end if;

  -- Marca como pago
  update public.payment_intents
     set status = 'paid',
         paid_at = now(),
         abacate_id = coalesce(p_abacate_id, abacate_id),
         updated_at = now()
   where id = p_intent_id;

  -- 1. Cria wallet_credit pago — dispara trigger 5-5-5%
  insert into public.wallet_credits (user_id, bro_cents, exp_amount, reason, applied_at)
  values (
    v_intent.user_id,
    v_intent.amount_cents,
    0,
    'pix_payment:' || v_intent.id::text,
    now()
  )
  returning id into v_credit_id;

  -- 2. Side-effect por product_kind
  if v_intent.product_kind = 'activation_pack' then
    -- Cria ativação apontando pro wallet_credit (idempotente via UNIQUE wallet_credit_id)
    if not public.is_user_activated(v_intent.user_id) then
      insert into public.activation_packs (
        user_id, amount_cents, currency, source, wallet_credit_id, activated_at
      ) values (
        v_intent.user_id, 2500, 'BRO', 'purchase', v_credit_id, now()
      )
      on conflict (wallet_credit_id) do nothing
      returning id into v_activation_id;
    end if;
  end if;

  -- product_kind = 'card' fica pra Fase 9 marketplace
  -- product_kind = 'recharge' não tem side-effect adicional

  return query select v_intent.id, 'paid'::text, v_credit_id, v_activation_id, v_was_paid;
end;
$$;

-- confirm_payment_intent só roda no contexto de service_role (edge function webhook)
revoke execute on function public.confirm_payment_intent(uuid, text) from anon, public, authenticated;

-- ─── 20260531000000_legacy_v1_olefoot_credits.sql ───
-- Migração v1 → v11 dos 168 usuários do Olefoot antigo.
-- Cria tabela de créditos OLEFOOT off-chain (snapshot BSC) + função admin
-- de import que insere auth.users com bcrypt preservado e registra o crédito.
--
-- Bcrypt do v1 ($2b$10$...) é compatível com Supabase Auth out-of-the-box,
-- então o usuário antigo loga com email + senha de sempre.
-- Profile NÃO é criado de propósito: RequireRegistration força onboarding completo.

create table if not exists public.legacy_olefoot_credits (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  legacy_id        int not null,
  email            text not null,
  wallet_address   text not null,
  balance_wei      numeric(78, 0) not null,
  balance_human    text not null,
  source           text not null default 'olefoot-v1-bsc-snapshot',
  snapshot_at      timestamptz not null,
  credited_at      timestamptz,
  credited_amount  numeric(78, 0),
  created_at       timestamptz not null default now()
);

alter table public.legacy_olefoot_credits enable row level security;

create unique index if not exists ulx_legacy_credits_legacy_id
  on public.legacy_olefoot_credits(legacy_id);

create index if not exists idx_legacy_credits_email
  on public.legacy_olefoot_credits(lower(email));

-- Usuário pode ler o próprio crédito (pra UI mostrar o toast / saldo pendente).
drop policy if exists legacy_credits_self_read on public.legacy_olefoot_credits;
create policy legacy_credits_self_read on public.legacy_olefoot_credits
  for select to authenticated
  using (user_id = auth.uid());

-- Função admin: cria/atualiza auth.users e legacy_olefoot_credits em uma transação.
-- Idempotente por email: roda 2x sem duplicar.
-- Política Passo 0:
--   - se email já existe em auth.users → reaproveita o UUID, registra o crédito,
--     NÃO mexe em senha/profile/club do usuário ativo do v11.
--   - se não existe → cria com bcrypt preservado e email_confirmed_at=now().
create or replace function public.admin_import_legacy_v1_user(
  p_email          text,
  p_bcrypt_hash    text,
  p_legacy_id      int,
  p_name           text,
  p_wallet         text,
  p_balance_wei    numeric,
  p_balance_human  text,
  p_snapshot_at    timestamptz
)
returns table (out_user_id uuid, action text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(p_email));
  v_uid uuid;
  v_action text;
begin
  if v_email is null or v_email = '' then
    raise exception 'email vazio';
  end if;
  if p_bcrypt_hash !~ '^\$2[aby]\$\d{2}\$.{53}$' then
    raise exception 'bcrypt hash inválido para %', v_email;
  end if;

  -- Passo 0: já existe?
  select id into v_uid from auth.users where lower(email) = v_email limit 1;

  if v_uid is not null then
    v_action := 'reused_existing';
  else
    v_uid := gen_random_uuid();
    insert into auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      aud, role, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      v_uid,
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_email,
      p_bcrypt_hash,
      now(),
      'authenticated',
      'authenticated',
      jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
      jsonb_build_object('legacy_id', p_legacy_id, 'legacy_name', p_name, 'source','olefoot-v1'),
      now(),
      now(),
      '', '', '', ''
    );
    -- Linha em auth.identities pro provider 'email' (necessário pro login funcionar).
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      'email',
      v_email,
      null, now(), now()
    );
    v_action := 'created_new';
  end if;

  -- Crédito OLEFOOT (idempotente por user_id).
  insert into public.legacy_olefoot_credits (
    user_id, legacy_id, email, wallet_address, balance_wei, balance_human, snapshot_at
  ) values (
    v_uid, p_legacy_id, v_email, p_wallet, p_balance_wei, p_balance_human, p_snapshot_at
  )
  on conflict (user_id) do update set
    balance_wei = excluded.balance_wei,
    balance_human = excluded.balance_human,
    snapshot_at = excluded.snapshot_at,
    legacy_id = excluded.legacy_id;

  return query select v_uid, v_action;
end;
$$;

revoke all on function public.admin_import_legacy_v1_user(
  text, text, int, text, text, numeric, text, timestamptz
) from public;
-- Apenas service_role (script de migração) pode chamar.
grant execute on function public.admin_import_legacy_v1_user(
  text, text, int, text, text, numeric, text, timestamptz
) to service_role;

-- Função consumida pela UI no primeiro login: credita off-chain (idempotente)
-- e retorna o saldo creditado pra o toast de boas-vindas.
-- Hoje só marca credited_at e retorna o balance_human pra mostrar.
-- A integração com o wallet OLEXP fica num segundo passo (após confirmar UX).
create or replace function public.claim_legacy_olefoot_credit()
returns table (already_claimed boolean, out_balance_human text, out_credited_amount_wei numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.legacy_olefoot_credits%rowtype;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;
  select * into v_row from public.legacy_olefoot_credits where user_id = v_uid;
  if not found then
    return query select false, null::text, null::numeric;
    return;
  end if;
  if v_row.credited_at is not null then
    return query select true, v_row.balance_human, v_row.credited_amount;
    return;
  end if;
  update public.legacy_olefoot_credits
     set credited_at = now(),
         credited_amount = balance_wei
   where user_id = v_uid;
  return query select false, v_row.balance_human, v_row.balance_wei;
end;
$$;

revoke all on function public.claim_legacy_olefoot_credit() from public;
grant execute on function public.claim_legacy_olefoot_credit() to authenticated;

-- ─── 20260531000100_global_league_daily_crowns.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — Liga Global: histórico de COROAS DO DIA
--
-- Cada vez que o mata-mata diário define um campeão, grava-se uma linha aqui.
-- Alimenta o widget "Campeão de Hoje" na home, a página /liga-global/coroas
-- e o ranking de coroas da season. Leitura pública; escrita só service_role
-- (a Edge Function global-league-tick é a única autoridade).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS daily_crowns (
  id              TEXT PRIMARY KEY,
  team_id         TEXT NOT NULL REFERENCES global_league_teams(id) ON DELETE CASCADE,
  manager_id      TEXT NOT NULL,
  club_name       TEXT NOT NULL,
  club_short      TEXT NOT NULL,

  -- Contexto da conquista
  daily_date      TEXT NOT NULL,               -- 'YYYY-MM-DD' BRT do dia conquistado
  season_id       TEXT NOT NULL,               -- season da liga no momento
  competition_id  TEXT,                         -- competição (ciclo) no momento
  bracket_size    INTEGER NOT NULL,             -- nº de times no mata-mata (2,4,8,16,32)
  final_round_id  TEXT,                         -- round_id da final
  runner_up_team_id   TEXT,                     -- vice (derrotado na final)
  runner_up_club_name TEXT,

  -- Placar da final (inclui pênaltis se houve)
  final_score_home    INTEGER,
  final_score_away    INTEGER,
  final_went_to_pens  BOOLEAN NOT NULL DEFAULT FALSE,

  crowned_at_ms   BIGINT NOT NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_crowns_manager
  ON daily_crowns (manager_id, crowned_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_daily_crowns_recent
  ON daily_crowns (crowned_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_daily_crowns_season
  ON daily_crowns (season_id, crowned_at_ms DESC);

-- Um campeão por dia (BRT). Protege contra dupla coroação por ticks concorrentes.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_daily_crowns_per_day
  ON daily_crowns (daily_date);

ALTER TABLE daily_crowns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON daily_crowns;
CREATE POLICY "Allow public read access" ON daily_crowns FOR SELECT USING (true);

COMMENT ON TABLE daily_crowns IS
  'Histórico de campeões do mata-mata diário da Liga Global (Coroas do Dia). 1 linha por Dia Olefoot.';

-- ─── 20260531003000_global_league_daily_cycle.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — Liga Global: CICLO DIÁRIO com COROAS (Fase A)
--
-- Adiciona a camada "Dia Olefoot" SOBRE a liga nonstop existente, sem
-- alterar o loop de 5/5min que já roda em produção:
--
--   • 00:00–19:00 BRT  → fase "qualifying": cada partida de LIGA também
--     soma daily_points. A liga nonstop continua dando densidade o dia todo.
--   • 19:00 BRT        → fase "knockout": top N (maior potência de 2 ≤ 32)
--     por daily_points entram num mata-mata (round_type='daily_ko'), com
--     pênaltis decidindo empates.
--   • Final            → fase "crowned": campeão do dia recebe 1 Coroa
--     (season_crowns + all_time_crowns). Mais coroas na season = título
--     paralelo ao campeão de divisão.
--   • 00:00 BRT seguinte → daily_* zeram, volta a "qualifying".
--
-- daily_* são ORTOGONAIS ao ciclo de season: NÃO zeram no soft-reset de
-- promoção/rebaixamento; só zeram na virada do Dia Olefoot. A coluna
-- season_crowns acompanha a competição (zera no hard-reset); all_time_crowns
-- jamais zera.
--
-- Migration ADITIVA e idempotente (IF NOT EXISTS). Não destrói dados.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Pontuação diária + coroas em global_league_teams ────────────────────
ALTER TABLE global_league_teams
  ADD COLUMN IF NOT EXISTS daily_points          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_matches_played  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_wins            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_draws           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_losses          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_goals_for       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_goals_against   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_goal_difference INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS season_crowns         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS all_time_crowns       INTEGER NOT NULL DEFAULT 0;

-- Ranking da corrida diária (top N por daily_points, depois saldo, depois pró)
CREATE INDEX IF NOT EXISTS idx_global_teams_daily_rank
  ON global_league_teams (
    daily_points DESC,
    daily_goal_difference DESC,
    daily_goals_for DESC
  );

CREATE INDEX IF NOT EXISTS idx_global_teams_season_crowns
  ON global_league_teams (season_crowns DESC);

-- ── 2. Estado da fase diária em global_league_state ────────────────────────
ALTER TABLE global_league_state
  ADD COLUMN IF NOT EXISTS daily_date         TEXT,    -- 'YYYY-MM-DD' em BRT
  ADD COLUMN IF NOT EXISTS daily_phase        TEXT NOT NULL DEFAULT 'qualifying',
  ADD COLUMN IF NOT EXISTS daily_ko_season_id TEXT,    -- season_id dos rounds daily_ko do dia
  ADD COLUMN IF NOT EXISTS daily_ko_size      INTEGER, -- tamanho do bracket gerado (2,4,8,16,32)
  ADD COLUMN IF NOT EXISTS daily_qualify_hour INTEGER NOT NULL DEFAULT 19, -- hora BRT do corte
  ADD COLUMN IF NOT EXISTS daily_ko_max_size  INTEGER NOT NULL DEFAULT 32; -- teto do bracket

-- Constraint da fase diária (drop+recreate para idempotência)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_daily_phase'
  ) THEN
    ALTER TABLE global_league_state
      ADD CONSTRAINT valid_daily_phase
      CHECK (daily_phase IN ('qualifying', 'knockout', 'crowned'));
  END IF;
END$$;

-- ── 3. Pênaltis nas fixtures (decidem empate no mata-mata) ──────────────────
ALTER TABLE global_league_fixtures
  ADD COLUMN IF NOT EXISTS penalty_score_home INTEGER,
  ADD COLUMN IF NOT EXISTS penalty_score_away INTEGER,
  ADD COLUMN IF NOT EXISTS went_to_penalties  BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 4. round_type aceita 'daily_ko' ────────────────────────────────────────
-- A constraint original só aceita ('playoff','league'). Reabrimos para incluir
-- o mata-mata diário. drop+recreate preservando os valores existentes.
ALTER TABLE global_league_rounds DROP CONSTRAINT IF EXISTS valid_round_type;
ALTER TABLE global_league_rounds
  ADD CONSTRAINT valid_round_type
  CHECK (round_type IN ('playoff', 'league', 'daily_ko'));

-- ── 5. event_type aceita eventos de pênalti e coroação ─────────────────────
ALTER TABLE global_league_events DROP CONSTRAINT IF EXISTS valid_event_type;
ALTER TABLE global_league_events
  ADD CONSTRAINT valid_event_type
  CHECK (event_type IN (
    'goal', 'yellow_card', 'red_card', 'injury', 'substitution',
    'pressure', 'miss', 'walkover', 'penalty', 'crown'
  ));

COMMENT ON COLUMN global_league_teams.daily_points IS
  'Pontos acumulados no Dia Olefoot corrente (qualifying). Zera na virada do dia (BRT), NÃO no soft-reset de season.';
COMMENT ON COLUMN global_league_teams.season_crowns IS
  'Coroas (campeão do mata-mata diário) ganhas nesta competição/season. Mais coroas = título paralelo no fim.';
COMMENT ON COLUMN global_league_teams.all_time_crowns IS
  'Total histórico de Coroas do Dia. Jamais zera.';
COMMENT ON COLUMN global_league_state.daily_phase IS
  'Fase do Dia Olefoot: qualifying (00–19h BRT) | knockout (mata-mata) | crowned (campeão definido, aguarda meia-noite).';

-- ─── 20260608100000_spend_olefoot_rpc.sql ───
-- ============================================================
-- spend_olefoot RPC
--
-- Permite que o user autenticado gaste OLEFOOT (=OLEXP) em compras in-game
-- (renovação de contrato, marketplace premium, etc) com auditoria via ledger.
--
-- Embrulha o _debit_olexp interno (que continua revogado de authenticated)
-- expondo apenas operações com source whitelisteado. Isso impede que código
-- malicioso debite OLEFOOT pra origens arbitrárias.
--
-- Whitelist atual:
--   'renovacao_contrato' — renovação de contrato de jogador (Academia OLE)
--
-- Ampliar conforme novas features que aceitem OLEFOOT.
-- ============================================================

create or replace function public.spend_olefoot(
  p_amount numeric,
  p_source text,
  p_source_ref text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_new_balance numeric(36, 8);
  v_allowed_sources text[] := array[
    'renovacao_contrato'
  ];
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED: precisa estar autenticado pra gastar OLEFOOT';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT: valor deve ser positivo';
  end if;

  if not (p_source = any(v_allowed_sources)) then
    raise exception 'INVALID_SOURCE: % não está na whitelist', p_source;
  end if;

  -- _debit_olexp valida saldo (raise INSUFFICIENT_OLEXP_BALANCE), faz lock
  -- da row e escreve no ledger numa transação só.
  v_new_balance := public._debit_olexp(v_user_id, p_amount, p_source, p_source_ref);

  return v_new_balance;
end;
$$;

revoke execute on function public.spend_olefoot(numeric, text, text) from anon, public;
grant execute on function public.spend_olefoot(numeric, text, text) to authenticated;

comment on function public.spend_olefoot(numeric, text, text) is
  'Debita OLEFOOT do user autenticado pra fonte whitelisteada. Lança INSUFFICIENT_OLEXP_BALANCE se sem saldo. Auditável via olexp_ledger.';

-- ─── 20260615123000_liga_ole_weekly_and_nemesis.sql ───
-- Liga Ole — Liga da Semana (leaderboard semanal compartilhado entre managers) +
-- notificação do NÊMESIS (um manager notifica o derrotado, cross-user).
--
-- Tudo client-driven via RPC SECURITY DEFINER (sem edge function dedicada):
--   • record_liga_ole_weekly_run   — upsert da campanha da semana (guarda a fase MAIS LONGE)
--   • get_liga_ole_weekly_leaderboard — ranking "quem chegou mais longe" na semana
--   • notify_liga_ole_nemesis      — insere notificação pro manager derrotado

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Tabela: uma linha por (semana, manager) com a melhor campanha da semana
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.liga_ole_weekly_runs (
  id            uuid primary key default gen_random_uuid(),
  week_key      text not null,                 -- ex: '2026-W24' (ISO week)
  manager_id    uuid not null references auth.users(id) on delete cascade,
  club_name     text not null,
  club_short    text not null,
  reached_round int  not null default 0 check (reached_round between 0 and 4),
  is_champion   boolean not null default false,
  updated_at    timestamptz not null default now(),
  unique (week_key, manager_id)
);

create index if not exists idx_liga_ole_weekly_rank
  on public.liga_ole_weekly_runs (week_key, is_champion desc, reached_round desc, updated_at asc);

alter table public.liga_ole_weekly_runs enable row level security;

-- Leitura pública (o leaderboard é visível a todos).
drop policy if exists liga_ole_weekly_read on public.liga_ole_weekly_runs;
create policy liga_ole_weekly_read on public.liga_ole_weekly_runs
  for select using (true);

-- Escrita só da própria linha (a RPC abaixo é a via recomendada).
drop policy if exists liga_ole_weekly_insert_self on public.liga_ole_weekly_runs;
create policy liga_ole_weekly_insert_self on public.liga_ole_weekly_runs
  for insert with check (manager_id = auth.uid());
drop policy if exists liga_ole_weekly_update_self on public.liga_ole_weekly_runs;
create policy liga_ole_weekly_update_self on public.liga_ole_weekly_runs
  for update using (manager_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) RPC: registra/atualiza a campanha da semana mantendo a fase MAIS LONGE
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.record_liga_ole_weekly_run(
  p_week_key   text,
  p_reached_round int,
  p_is_champion boolean,
  p_club_name  text,
  p_club_short text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  if p_week_key is null or p_week_key = '' then return; end if;
  insert into public.liga_ole_weekly_runs
    (week_key, manager_id, club_name, club_short, reached_round, is_champion, updated_at)
  values (
    p_week_key, v_uid,
    coalesce(nullif(p_club_name, ''), 'Clube'),
    coalesce(nullif(p_club_short, ''), 'OLE'),
    greatest(0, least(4, coalesce(p_reached_round, 0))),
    coalesce(p_is_champion, false),
    now()
  )
  on conflict (week_key, manager_id) do update
    set reached_round = greatest(public.liga_ole_weekly_runs.reached_round, excluded.reached_round),
        is_champion   = public.liga_ole_weekly_runs.is_champion or excluded.is_champion,
        club_name     = excluded.club_name,
        club_short    = excluded.club_short,
        updated_at    = now();
end;
$$;

grant execute on function public.record_liga_ole_weekly_run(text, int, boolean, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) RPC: leaderboard da semana (quem chegou mais longe)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_liga_ole_weekly_leaderboard(
  p_week_key text,
  p_limit    int default 50
) returns table (
  rank          bigint,
  manager_id    uuid,
  club_name     text,
  club_short    text,
  reached_round int,
  is_champion   boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    row_number() over (order by r.is_champion desc, r.reached_round desc, r.updated_at asc) as rank,
    r.manager_id, r.club_name, r.club_short, r.reached_round, r.is_champion
  from public.liga_ole_weekly_runs r
  where r.week_key = p_week_key
  order by rank
  limit greatest(1, least(200, coalesce(p_limit, 50)));
$$;

grant execute on function public.get_liga_ole_weekly_leaderboard(text, int) to authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) RPC: notifica o manager derrotado pelo nêmesis (cross-user, validado)
--    SECURITY DEFINER → insere em notifications mesmo com RLS admin-only.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.notify_liga_ole_nemesis(
  p_target_manager_id uuid,
  p_winner_club       text,
  p_round             text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null or p_target_manager_id is null then return null; end if;
  if p_target_manager_id = v_uid then return null; end if; -- nunca a si mesmo
  insert into public.notifications (user_id, category, title, message, link, payload)
  values (
    p_target_manager_id,
    'COMPETIÇÃO',
    'Seu time caiu na Liga Ole',
    coalesce(nullif(p_winner_club, ''), 'Um rival')
      || ' eliminou seu time na ' || coalesce(nullif(p_round, ''), 'Liga Ole')
      || '. Vai deixar barato?',
    '/liga-ole',
    jsonb_build_object(
      'kind', 'liga_ole_nemesis',
      'winner_manager_id', v_uid,
      'winner_club', p_winner_club,
      'round', p_round
    )
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.notify_liga_ole_nemesis(uuid, text, text) to authenticated;
