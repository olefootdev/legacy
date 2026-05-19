-- Permite leitura cruzada de manager_squad para matchmaking PvP assíncrono.
-- Dados de gameplay (plantel/lineup) não são sensíveis.
DROP POLICY IF EXISTS "manager_squad_select_own" ON public.manager_squad;

CREATE POLICY "manager_squad_select_all"
  ON public.manager_squad FOR SELECT
  TO authenticated
  USING (true);
