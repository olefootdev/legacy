-- Standings agregados de Quick e Classic.
-- View espelha cada partida em 2 linhas (home + away) e agrega por user+mode.
-- RPC retorna top N com info de profile + crest do time do coração.

create or replace view public.pvp_standings_v as
with results as (
  select home_user_id as user_id, mode,
    case outcome
      when 'home_win' then 'W'
      when 'away_win' then 'L'
      else 'D'
    end as result,
    home_score as gf, away_score as ga
  from public.pvp_match_results
  union all
  select away_user_id, mode,
    case outcome
      when 'away_win' then 'W'
      when 'home_win' then 'L'
      else 'D'
    end as result,
    away_score as gf, home_score as ga
  from public.pvp_match_results
)
select
  r.user_id,
  r.mode,
  count(*)::int as played,
  count(*) filter (where result = 'W')::int as wins,
  count(*) filter (where result = 'D')::int as draws,
  count(*) filter (where result = 'L')::int as losses,
  coalesce(sum(gf), 0)::int as goals_for,
  coalesce(sum(ga), 0)::int as goals_against,
  coalesce(sum(gf - ga), 0)::int as goal_diff,
  (count(*) filter (where result = 'W') * 3 + count(*) filter (where result = 'D'))::int as points
from results r
group by r.user_id, r.mode;

create or replace function public.get_pvp_standings(p_mode text, p_limit int default 50)
returns table (
  user_id uuid,
  display_name text,
  club_name text,
  club_short text,
  favorite_team_id int,
  played int,
  wins int,
  draws int,
  losses int,
  goals_for int,
  goals_against int,
  goal_diff int,
  points int,
  rank int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_mode not in ('quick', 'classic') then
    raise exception 'invalid mode';
  end if;
  return query
    select
      s.user_id,
      p.display_name,
      p.club_name,
      p.club_short,
      nullif(p.onboarding_data->'favoriteRealTeam'->>'id', '')::int as favorite_team_id,
      s.played,
      s.wins,
      s.draws,
      s.losses,
      s.goals_for,
      s.goals_against,
      s.goal_diff,
      s.points,
      (row_number() over (order by s.points desc, s.goal_diff desc, s.goals_for desc))::int as rank
    from public.pvp_standings_v s
    inner join public.profiles p on p.id = s.user_id
    where s.mode = p_mode
    order by s.points desc, s.goal_diff desc, s.goals_for desc
    limit greatest(1, least(200, coalesce(p_limit, 50)));
end;
$$;

revoke execute on function public.get_pvp_standings(text, int) from anon, public;
grant execute on function public.get_pvp_standings(text, int) to authenticated;
