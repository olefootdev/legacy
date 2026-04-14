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
