-- ════════════════════════════════════════════════════════════════════════════
-- ONDA 0 · legacy_player_lots — o repo passa a saber da proteção que já existe
-- ════════════════════════════════════════════════════════════════════════════
-- `legacy_player_lots` (supply/sold/status/preço dos lotes de lenda — a base do
-- "restam X de N") nasceu no REPO sem RLS (20260712130000_playervip_bridges).
-- Em PRODUÇÃO a RLS já está ligada, com a policy `legacy_player_lots_select_public`,
-- criada pela migration `legend_creator_lots_and_panini_model` — aplicada por
-- fora e sem arquivo neste repo. Medido em 2026-09-18.
--
-- Então aqui não há buraco aberto pra fechar. Esta migration:
--   • deixa o repo consistente com produção (um banco novo nasce protegido);
--   • tira o grant de escrita que anon/authenticated ainda tinham — hoje inócuo
--     só porque a RLS sem policy de escrita nega; tira a RLS como barreira única.
--
-- Quem escreve de verdade: server (legendImport.ts, market.ts, service_role) e
-- a SECURITY DEFINER de 20260704120000 — nenhum depende de grant do cliente.

alter table public.legacy_player_lots enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'legacy_player_lots'
                    and cmd = 'SELECT') then
    create policy "legacy_player_lots_select_public"
      on public.legacy_player_lots for select
      to anon, authenticated
      using (true);
  end if;
end $$;

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
    raise exception 'cliente ainda tem grant de escrita em legacy_player_lots';
  end if;
  if not has_table_privilege('anon', 'public.legacy_player_lots', 'SELECT')
     or not exists (select 1 from pg_policies
                     where schemaname = 'public' and tablename = 'legacy_player_lots'
                       and cmd = 'SELECT') then
    raise exception 'a vitrine perdeu a leitura do "restam X"';
  end if;

  raise notice 'verificação: ok — lote de lenda só muda pelo servidor';
end $$;
