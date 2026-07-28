-- ════════════════════════════════════════════════════════════════════════════
-- REVELA — classificação por divisão (a tela "Elifoot" do portal)
--
-- Devolve a Liga Global agrupada POR DIVISÃO, cada uma ordenada como uma tabela
-- de campeonato: pontos, saldo, gols pró. Por time vêm V/E/D e gols — o dado
-- que a `global_league_teams` já persiste. Nenhuma coluna nova, nenhum cálculo
-- novo: só o recorte público.
--
-- 🔒 PII: mesma regra de `revela_top_clubs`. NUNCA devolve `id` nem `manager_id`
-- — ambos são o e-mail do manager em `global_league_teams` (ver 20260717170000).
-- Só sai o que apareceria numa tabela de jornal: clube, V/E/D, gols, pontos.
--
-- ⚠️ NÚMERO DE DIVISÕES: este RPC NÃO assume 3 nem 4. Ele agrupa por qualquer
-- valor de `division` que existir. Se a liga migrar de 3 pra 4 divisões, esta
-- função continua correta sem tocar numa linha — o recorte é dinâmico.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.revela_standings(p_per_division int default 8)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(d.payload order by d.division), '[]'::jsonb)
  from (
    select
      div as division,
      jsonb_build_object(
        'division', div,
        -- Top N da divisão, já ordenado e com a posição DENTRO dela.
        'teams', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'pos',      t.pos,
              'club',     t.club_name,
              'short',    t.club_short,
              'played',   t.matches_played,
              'wins',     t.wins,
              'draws',    t.draws,
              'losses',   t.losses,
              'goalsFor', t.goals_for,
              'goalsAgainst', t.goals_against,
              'points',   t.points,
              'crestId',  t.favorite_team_id
            ) order by t.pos
          ), '[]'::jsonb)
          from (
            select
              row_number() over (
                order by coalesce(points,0) desc,
                         coalesce(goal_difference,0) desc,
                         coalesce(goals_for,0) desc,
                         club_name
              )::int as pos,
              club_name, club_short,
              coalesce(matches_played,0) as matches_played,
              coalesce(wins,0)   as wins,
              coalesce(draws,0)  as draws,
              coalesce(losses,0) as losses,
              coalesce(goals_for,0)     as goals_for,
              coalesce(goals_against,0) as goals_against,
              coalesce(points,0) as points,
              favorite_team_id
            from public.global_league_teams
            where coalesce(division, 1) = div
            order by pos
            limit greatest(1, least(coalesce(p_per_division, 8), 30))
          ) t
        ),
        'totalClubs', (
          select count(*)::int from public.global_league_teams
          where coalesce(division, 1) = div
        )
      ) as payload
    from (
      select distinct coalesce(division, 1) as div
      from public.global_league_teams
    ) divs
  ) d;
$$;

grant execute on function public.revela_standings(int) to anon, authenticated;

comment on function public.revela_standings(int) is
  'Classificação da Liga Global agrupada por divisão, para a tela retro do REVELA. '
  'Nunca devolve id nem manager_id (e-mail). Agrupa por qualquer nº de divisões.';
