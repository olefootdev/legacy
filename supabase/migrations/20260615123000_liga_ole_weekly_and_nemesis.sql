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
