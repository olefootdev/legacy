-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — schema public completo (gerado por scripts/bundle-supabase-migrations.sh)
--
-- Executar UMA vez no Supabase → SQL → novo script, com a base vazia (ou só apagar
-- tabelas públicas se souberes o que fazes). Não reexecutar sobre o mesmo schema:
-- políticas CREATE POLICY podem falhar se já existirem.
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
