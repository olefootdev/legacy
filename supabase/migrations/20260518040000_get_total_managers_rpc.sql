-- ============================================================================
-- RPC get_total_managers() — pré-existente em código mas nunca criada no DB
-- ============================================================================
-- O hook `useTotalManagers` (src/hooks/useTotalManagers.ts) chama essa RPC
-- pra mostrar contagem global de managers na Home. Estava retornando 404
-- em prod (spammando o console). Migration cria a função.
--
-- Sem fallback mockado — se vier null o hook deixa "Fase Beta" no UI.
-- ============================================================================

create or replace function public.get_total_managers()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int from public.profiles where id is not null;
$$;

grant execute on function public.get_total_managers() to anon, authenticated;
