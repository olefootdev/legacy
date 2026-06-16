-- Colunas que a Edge Function `global-league-tick` LÊ e o client (useGlobalConsequencesSync)
-- ESCREVE, mas que nunca tiveram migration própria. Sem elas, o UPDATE do sync falha
-- inteiro (PostgREST rejeita a query toda) → available_player_count nunca atualiza →
-- todo time fica no default 25 sem timestamp → estimateAvailable cai em stale → WO eterno
-- → epidemia de 0×0 na Liga Global.
--
-- Idempotente (IF NOT EXISTS): se já tiverem sido criadas manualmente em prod, no-op.

ALTER TABLE global_league_teams
  ADD COLUMN IF NOT EXISTS available_player_count_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS engagement_score integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN global_league_teams.available_player_count_updated_at IS
  'Timestamp do último sync do client. Edge usa pra confiar (ou não) em available_player_count ao decidir WO.';

COMMENT ON COLUMN global_league_teams.engagement_score IS
  'Score de engajamento (0-100) synced pelo client. effectiveOverall converte em buff de até +20 OVR.';
