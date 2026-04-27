-- Habilita Realtime para tabelas da Liga Global.
-- Clientes assinam mudanças e re-hidratam o estado quando o servidor (Edge
-- Function global-league-tick) avança rodadas, simula partidas, etc.

alter publication supabase_realtime add table public.global_league_teams;
alter publication supabase_realtime add table public.global_league_rounds;
alter publication supabase_realtime add table public.global_league_fixtures;
alter publication supabase_realtime add table public.global_league_events;
alter publication supabase_realtime add table public.global_league_state;
