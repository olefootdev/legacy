-- RPC atômica para persistir resultado do adversário na Liga Local.
-- Evita race condition de read-then-write quando 2 jogadores vencem
-- o mesmo oponente simultaneamente.
create or replace function public.persist_opponent_local_league_result(
  p_opponent_user_id uuid,
  p_league text,        -- 'fast' ou 'classic'
  p_result text,        -- 'win', 'draw', 'loss'
  p_goals_for int,
  p_goals_against int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leagues jsonb;
  v_league_data jsonb;
  v_played int;
  v_wins int;
  v_draws int;
  v_losses int;
  v_gf int;
  v_ga int;
  v_points int;
begin
  -- Ler local_leagues atual
  select coalesce(local_leagues, '{}'::jsonb)
  into v_leagues
  from manager_game_state
  where user_id = p_opponent_user_id
  for update;

  -- Se não existe row, criar
  if not found then
    insert into manager_game_state (user_id, local_leagues)
    values (p_opponent_user_id, '{}'::jsonb)
    on conflict (user_id) do nothing;
    v_leagues := '{}'::jsonb;
  end if;

  -- Extrair dados da liga específica
  v_league_data := coalesce(v_leagues -> p_league, '{}'::jsonb);
  v_played := coalesce((v_league_data ->> 'played')::int, 0) + 1;
  v_wins := coalesce((v_league_data ->> 'wins')::int, 0) + (case when p_result = 'win' then 1 else 0 end);
  v_draws := coalesce((v_league_data ->> 'draws')::int, 0) + (case when p_result = 'draw' then 1 else 0 end);
  v_losses := coalesce((v_league_data ->> 'losses')::int, 0) + (case when p_result = 'loss' then 1 else 0 end);
  v_gf := coalesce((v_league_data ->> 'goalsFor')::int, 0) + p_goals_for;
  v_ga := coalesce((v_league_data ->> 'goalsAgainst')::int, 0) + p_goals_against;
  v_points := (v_wins * 3) + v_draws;

  -- Montar novo JSON da liga
  v_league_data := jsonb_build_object(
    'played', v_played,
    'wins', v_wins,
    'draws', v_draws,
    'losses', v_losses,
    'goalsFor', v_gf,
    'goalsAgainst', v_ga,
    'points', v_points
  );

  -- Atualizar atomicamente
  update manager_game_state
  set local_leagues = jsonb_set(coalesce(local_leagues, '{}'::jsonb), array[p_league], v_league_data)
  where user_id = p_opponent_user_id;
end;
$$;

grant execute on function public.persist_opponent_local_league_result(uuid, text, text, int, int) to anon, authenticated;
