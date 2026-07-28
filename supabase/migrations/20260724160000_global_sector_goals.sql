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

-- Detalhe por TIPO DE LANCE — alimenta a evolução "evolui fazendo" (cabeça sobe
-- cabeceio, falta sobe bola parada, pênalti sobe pênalti). `add if not exists`
-- pra esta migration ser re-aplicável sem erro.
alter table public.global_fixture_goals add column if not exists goals_header     int not null default 0;
alter table public.global_fixture_goals add column if not exists goals_free_kick  int not null default 0;
alter table public.global_fixture_goals add column if not exists goals_penalty    int not null default 0;

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

-- ── 5. Evolução por lance: gols por tipo dos MEUS jogadores numa partida ─────
-- O cliente chama isto ao processar uma rodada finalizada e sobe o especialista
-- de quem marcou de cabeça/falta/pênalti. SECURITY DEFINER, mas devolve SÓ os
-- jogadores do PRÓPRIO clube (filtro por club_id do auth.uid()) — nada de elenco
-- alheio. Nenhuma coluna de PII sai.
create or replace function public.my_fixture_lance_goals(p_fixture_id text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'playerId', g.player_id,
    'header',   g.goals_header,
    'freeKick', g.goals_free_kick,
    'penalty',  g.goals_penalty
  )), '[]'::jsonb)
  from public.global_fixture_goals g
  where g.fixture_id = p_fixture_id
    and (g.goals_header > 0 or g.goals_free_kick > 0 or g.goals_penalty > 0)
    and g.player_id in (
      select p.id from public.players p
      where p.club_id = (select club_id from public.profiles where id = auth.uid())
    );
$$;

grant execute on function public.my_fixture_lance_goals(text) to authenticated;

comment on function public.my_fixture_lance_goals(text) is
  'Gols por tipo de lance dos jogadores do PRÓPRIO clube numa partida da Liga '
  'Global. Alimenta a evolução dos especialistas ("evolui fazendo").';
