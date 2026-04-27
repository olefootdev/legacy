-- Corrige brecha de segurança: policy de UPDATE totalmente aberta para anon+authenticated.
-- A policy original permitia alterar QUALQUER coluna (preços, atributos, nomes) sem restrições.
-- Nova política: só utilizadores autenticados podem atualizar, e apenas as colunas de retrato.

-- Remove grant de UPDATE ao role anon (SELECT continua para o mercado público).
revoke update on table public.genesis_market_players from anon;

-- Remove a policy permissiva original.
drop policy if exists "genesis_market_players_update_portraits" on public.genesis_market_players;

-- Nova policy: só authenticated, e apenas quando os campos de negócio não mudam.
-- O with check garante que preço, atributos, nome e listed_on_market permanecem idênticos.
create policy "genesis_market_players_update_portraits_only"
  on public.genesis_market_players
  for update
  to authenticated
  using (true)
  with check (
    -- Campos de negócio devem permanecer inalterados
    name              = (select name              from public.genesis_market_players g where g.id = genesis_market_players.id) and
    pos               = (select pos               from public.genesis_market_players g where g.id = genesis_market_players.id) and
    attributes        = (select attributes        from public.genesis_market_players g where g.id = genesis_market_players.id) and
    price_bro_cents   = (select price_bro_cents   from public.genesis_market_players g where g.id = genesis_market_players.id) and
    market_value_bro_cents = (select market_value_bro_cents from public.genesis_market_players g where g.id = genesis_market_players.id) and
    listed_on_market  = (select listed_on_market  from public.genesis_market_players g where g.id = genesis_market_players.id)
  );
