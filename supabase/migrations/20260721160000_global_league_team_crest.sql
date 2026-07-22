-- Brasão do time do coração de cada clube na Liga Global.
--
-- Denormaliza o `favorite_team_id` (id do time real no api-sports) na linha do
-- time, pra que o card "Próxima Partida" da Home mostre o ESCUDO DO ADVERSÁRIO
-- (hoje só o meu clube tem brasão; o do rival não vem nos dados da rodada).
-- O client resolve o crest local via `/crests/{favorite_team_id}.png`.
--
-- Idempotente (IF NOT EXISTS). A policy "Allow authenticated update" já existente
-- em global_league_teams permite o client gravar/atualizar a própria coluna —
-- nenhuma mudança de RLS é necessária.

ALTER TABLE global_league_teams
  ADD COLUMN IF NOT EXISTS favorite_team_id integer;

COMMENT ON COLUMN global_league_teams.favorite_team_id IS
  'ID do time do coração (api-sports) do manager. O client resolve o brasão em /crests/{id}.png — usado no card Próxima Partida pra mostrar o escudo de cada clube (meu e do adversário).';
