-- FABLE — Decreto da Semana (Liga Global).
-- Votos cross-user por semana ISO; o decreto vencedor da semana passa a valer
-- pra TODOS quando o client ler o tally (v2). O client v1 já grava o voto e
-- aplica o efeito LOCAL (weeklyDecree no save) — esta tabela é a agregação.

create table if not exists public.weekly_decree_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_key text not null,                      -- ex.: '2026-W27'
  option text not null check (option in ('espetaculo', 'ferro')),
  created_at timestamptz not null default now(),
  unique (user_id, week_key)                   -- 1 voto por manager por semana
);

alter table public.weekly_decree_votes enable row level security;

-- Cada manager insere/lê o próprio voto; tally público via view agregada.
create policy "decree_vote_insert_own" on public.weekly_decree_votes
  for insert with check (auth.uid() = user_id);
create policy "decree_vote_select_own" on public.weekly_decree_votes
  for select using (auth.uid() = user_id);

-- Tally agregado (sem expor votos individuais).
create or replace view public.weekly_decree_tally
  with (security_invoker = off) as
  select week_key, option, count(*)::int as votes
  from public.weekly_decree_votes
  group by week_key, option;

grant select on public.weekly_decree_tally to anon, authenticated;
