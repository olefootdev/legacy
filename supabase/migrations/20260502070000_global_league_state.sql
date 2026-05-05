-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — global_league_state (NO-OP)
--
-- Esta migration tentava criar `global_league_state` com schema (id text PK,
-- state jsonb). Mas a tabela já tinha sido criada em
-- 20260427135532_global_league_mvp.sql com o schema relacional (season_id,
-- status, current_playoff_round, current_league_round, min_teams_required,
-- ...) que é o que cliente e server usam.
--
-- O `CREATE TABLE IF NOT EXISTS` impedia que essa migration criasse algo, mas
-- o arquivo confundia leitores. Mantida vazia para preservar o histórico de
-- migrations sem alterar o estado do banco. Sem rollback necessário.
-- ═══════════════════════════════════════════════════════════════════════════

select 1 as global_league_state_noop_2026_05_02;
