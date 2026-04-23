-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — 00005_postgrest_grants_core_game
--
-- Garante que o cliente Supabase-js (anon + JWT authenticated) consegue
-- aceder às tabelas do núcleo de jogo criadas em 00001. Em projectos novos,
-- às vezes faltam GRANT explícitos até às políticas RLS poderem filtrar linhas.
-- Idempotente: repetir GRANT é seguro.
-- ═══════════════════════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table public.clubs to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.players to authenticated;
grant select, insert, update on table public.matches to authenticated;
grant select, insert on table public.match_events to authenticated;
