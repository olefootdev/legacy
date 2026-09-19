-- ════════════════════════════════════════════════════════════════════════════
-- ONDA 0 · legacy_player_lots — a escassez das lendas deixa de ser editável
-- ════════════════════════════════════════════════════════════════════════════
-- `legacy_player_lots` (20260712130000_playervip_bridges) é a base do "restam X
-- de N" no card de lenda: supply, sold, status do lote e preço unitário. Nasceu
-- SEM RLS e sem grant explícito — herdou o grant amplo do schema public. Com a
-- anon key embutida no bundle, qualquer pessoa (nem precisa de login) podia
-- zerar `sold`, inflar `supply`, marcar lote como esgotado ou reabrir um
-- esgotado. É a escassez vendida como argumento do colecionável.
--
-- Quem escreve de verdade: server/src/routes/legendImport.ts e market.ts
-- (service_role) e a função SECURITY DEFINER de 20260704120000 (sold++ na venda
-- por PIX) — nenhum passa por RLS. O cliente só LÊ (fetchLegacyOpenLots em
-- src/supabase/legacyPlayers.ts), e a leitura continua aberta a anon (a vitrine
-- pública do PLAYERVIP mostra o "restam").

alter table public.legacy_player_lots enable row level security;

drop policy if exists "legacy_player_lots_select_all" on public.legacy_player_lots;
create policy "legacy_player_lots_select_all"
  on public.legacy_player_lots for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.legacy_player_lots from anon, authenticated;
grant select on public.legacy_player_lots to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ════════════════════════════════════════════════════════════════════════════
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.legacy_player_lots'::regclass) then
    raise exception 'RLS não ficou ligada em legacy_player_lots';
  end if;
  if has_table_privilege('anon', 'public.legacy_player_lots', 'INSERT')
     or has_any_column_privilege('anon', 'public.legacy_player_lots', 'UPDATE')
     or has_table_privilege('anon', 'public.legacy_player_lots', 'DELETE')
     or has_table_privilege('authenticated', 'public.legacy_player_lots', 'INSERT')
     or has_any_column_privilege('authenticated', 'public.legacy_player_lots', 'UPDATE')
     or has_table_privilege('authenticated', 'public.legacy_player_lots', 'DELETE') then
    raise exception 'cliente ainda escreve em legacy_player_lots';
  end if;
  if not has_table_privilege('anon', 'public.legacy_player_lots', 'SELECT')
     or not has_table_privilege('authenticated', 'public.legacy_player_lots', 'SELECT') then
    raise exception 'a vitrine perdeu a leitura do "restam X"';
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'legacy_player_lots'
                    and cmd = 'SELECT') then
    raise exception 'sem policy de leitura — com RLS ligada a vitrine ficaria vazia';
  end if;

  raise notice 'verificação: ok — lote de lenda só muda pelo servidor';
end $$;
