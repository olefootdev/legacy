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
