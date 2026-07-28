-- ════════════════════════════════════════════════════════════════════════════
-- ARTILHARIA REAL — gols dos jogadores em partidas ao vivo
--
-- Decisão do fundador (2026-07-24): "temos que começar a computar os gols dos
-- jogadores. Se não tiver isso, tem que ser criado a partir daqui!"
--
-- A Liga Global é simulada (Poisson, sem elenco) — não produz artilheiro. Mas
-- toda partida AO VIVO já sabe quem marcou (o motor guarda em scoutTallies). Esta
-- tabela persiste esse dado, uma linha por (partida, jogador).
--
-- IDEMPOTÊNCIA: a chave é (match_id, player_id). Refinalizar a mesma partida
-- reescreve com o mesmo número — nunca soma o gol duas vezes. A artilharia é
-- `sum(goals)` por jogador, lida pelo RPC público `revela_top_scorers`.
--
-- 🔒 Só o time do MANAGER é atribuível (o adversário é sintético, sem UUID). O
-- nome do jogador NÃO é PII nova: talentos e lendas já aparecem por nome nas
-- vitrines públicas do REVELA. O placar não expõe e-mail, clube_id de ninguém.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.player_match_goals (
  match_id   uuid not null references public.matches(id) on delete cascade,
  player_id  uuid not null,
  season     text not null default 'current',
  club_id    uuid,
  club_name  text,
  name       text not null,
  pos        text,
  goals      int  not null default 0,
  assists    int  not null default 0,
  created_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

-- Leitura da artilharia agrega por jogador — este índice serve o group by/sort.
create index if not exists player_match_goals_leaderboard_idx
  on public.player_match_goals (season, player_id);

alter table public.player_match_goals enable row level security;

-- ESCRITA: cada manager só grava gols do PRÓPRIO clube. O RPC de leitura é quem
-- expõe o placar público — a tabela em si fica trancada por RLS.
drop policy if exists player_match_goals_insert on public.player_match_goals;
create policy player_match_goals_insert on public.player_match_goals
  for insert to authenticated
  with check (club_id = (select club_id from public.profiles where id = auth.uid()));

drop policy if exists player_match_goals_update on public.player_match_goals;
create policy player_match_goals_update on public.player_match_goals
  for update to authenticated
  using (club_id = (select club_id from public.profiles where id = auth.uid()))
  with check (club_id = (select club_id from public.profiles where id = auth.uid()));

-- ── Placar público ──────────────────────────────────────────────────────────
-- SECURITY DEFINER: soma os gols de todos os clubes num ranking único. Devolve
-- só nome/posição/clube/gols — nada de e-mail nem id de clube.
create or replace function public.revela_top_scorers(
  p_limit int default 10,
  p_season text default 'current'
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'playerId', s.player_id,
      'name',     s.name,
      'pos',      s.pos,
      'club',     s.club,
      'goals',    s.goals,
      'assists',  s.assists,
      'matches',  s.matches
    ) order by s.goals desc, s.name
  ), '[]'::jsonb)
  from (
    select
      g.player_id,
      max(g.name)                 as name,
      max(g.pos)                  as pos,
      max(g.club_name)            as club,
      sum(g.goals)::int           as goals,
      sum(g.assists)::int         as assists,
      count(distinct g.match_id)::int as matches
    from public.player_match_goals g
    where g.season = coalesce(p_season, 'current')
    group by g.player_id
    having sum(g.goals) > 0
    order by goals desc, name
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ) s;
$$;

grant execute on function public.revela_top_scorers(int, text) to anon, authenticated;

comment on function public.revela_top_scorers(int, text) is
  'Artilharia real: soma de gols por jogador em partidas ao vivo. Sem PII (só nome '
  'de jogador, que já é público nas vitrines). Alimenta a caixa ARTILHEIROS do REVELA.';
