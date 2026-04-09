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
