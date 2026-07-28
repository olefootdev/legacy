-- ════════════════════════════════════════════════════════════════════════════
-- LIGA GLOBAL — placar dos 11 reais + artilharia + prep de 4 divisões
--
-- Três coisas aditivas, todas seguras numa liga VIVA (entram no próximo tick,
-- não mexem em ponto/divisão de temporada em andamento):
--
--   1. `lineup_snapshot` — o cliente passa a sincronizar os 11 REAIS + formação,
--      pro tick calcular força por SETOR em vez de um OVR borrado. Coluna JSONB
--      nullable: quem não tiver, o tick cai no cálculo antigo (fallback).
--
--   2. `global_fixture_goals` — a artilharia da Liga Global. Gol de liga vem do
--      SERVIDOR (sem `matches`), então NÃO cabe em `player_match_goals`. Tabela
--      irmã, escrita com service role pelo Edge Function. Idempotente por
--      (fixture_id, player_id): reprocessar a rodada reescreve, nunca duplica.
--
--   3. `valid_division` relaxado pra 4 — PREP do 4º nível. Inócuo hoje: nada cria
--      division=4 até o próximo reset redistribuir os times. Só destrava o valor.
--
-- E `revela_top_scorers` passa a SOMAR as duas fontes (ao vivo + liga) por
-- jogador, sem duplicar (as chaves são disjuntas: match_id vs fixture_id).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Snapshot de escalação ────────────────────────────────────────────────
alter table public.global_league_teams
  add column if not exists lineup_snapshot jsonb;

comment on column public.global_league_teams.lineup_snapshot is
  'Os 11 reais + formação + atributos por setor, sincronizados pelo cliente. '
  'O tick usa pra força por setor; ausente/velho => fallback pro overall agregado.';

-- ── 2. Prep de 4 divisões (só destrava o valor; nada cria a 4ª até o reset) ──
alter table public.global_league_teams drop constraint if exists valid_division;
alter table public.global_league_teams
  add constraint valid_division check (division is null or (division >= 1 and division <= 4));

-- ── 3. Artilharia da Liga Global ────────────────────────────────────────────
create table if not exists public.global_fixture_goals (
  fixture_id text not null,
  player_id  uuid not null,
  season     text not null default 'current',
  team_id    text,
  club_name  text,
  name       text not null,
  pos        text,
  goals      int  not null default 0,
  assists    int  not null default 0,
  created_at timestamptz not null default now(),
  primary key (fixture_id, player_id)
);

create index if not exists global_fixture_goals_leaderboard_idx
  on public.global_fixture_goals (season, player_id);

-- Só o Edge Function (service role) escreve; a leitura pública é pelo RPC. RLS
-- ligada e SEM policy = anon/authenticated não leem a tabela crua.
alter table public.global_fixture_goals enable row level security;

-- ── 4. Placar público unindo as DUAS fontes ─────────────────────────────────
-- Gol ao vivo (player_match_goals) + gol de liga (global_fixture_goals), somados
-- por jogador. Chaves disjuntas (match_id uuid vs fixture_id text) => sem dupla
-- contagem. `matches` conta partidas distintas das duas origens juntas.
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
  with combined as (
    select player_id, name, pos, club_name, goals, assists, match_id::text as src_key
    from public.player_match_goals
    where season = coalesce(p_season, 'current')
    union all
    select player_id, name, pos, club_name, goals, assists, fixture_id as src_key
    from public.global_fixture_goals
    where season = coalesce(p_season, 'current')
  )
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
      c.player_id,
      max(c.name)               as name,
      max(c.pos)                as pos,
      max(c.club_name)          as club,
      sum(c.goals)::int         as goals,
      sum(c.assists)::int       as assists,
      count(distinct c.src_key)::int as matches
    from combined c
    group by c.player_id
    having sum(c.goals) > 0
    order by goals desc, name
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ) s;
$$;

grant execute on function public.revela_top_scorers(int, text) to anon, authenticated;

comment on function public.revela_top_scorers(int, text) is
  'Artilharia REAL somando gol ao vivo (player_match_goals) + gol de Liga Global '
  '(global_fixture_goals) por jogador. Sem PII (só nome de jogador, já público).';
