-- ============================================================
-- 🔴 VAZAMENTO DE DADO PESSOAL — estanca a leitura anônima
--
-- O QUE ACONTECE HOJE
-- A família global_league usa o E-MAIL do manager como `manager_id` — é um
-- padrão deliberado, documentado em 20260616140000: "manager_id text -- email do
-- manager (match no cliente)". O cliente grava `managerProfile?.email ?? club.id`
-- (src/game/reducer.ts, useAutoRegisterGlobalLeague).
--
-- Só que essas tabelas nasceram com `FOR SELECT USING (true)` — leitura PÚBLICA.
-- Como a anon key é embutida no bundle do frontend, qualquer pessoa faz um GET e
-- leva a base de e-mails inteira.
--
-- Medido em produção, SEM LOGIN (2026-07-17):
--   • global_league_teams.manager_id ......... 72 e-mails
--   • global_league_teams.id ("gt_fulano_gmail_com", a PK) ... 6 e-mails
--   • daily_crowns ........................... 17 e-mails
--   • global_league_season_champions ......... 0 (vaza no 1º campeão)
--   • global_league_ko_prizes ................ 0 (vaza no 1º prêmio)
--
-- O QUE ESTA MIGRATION FAZ (e o que NÃO faz)
-- Revoga `select` de `anon` nessas tabelas. Estanca o vazamento HOJE, com risco
-- quase zero: todo leitor é interno do jogo e exige login (matchmaking, Liga Olé,
-- hidratador da liga, sync de consequências, admin).
--
-- NÃO conserta a raiz: o e-mail continua gravado como identidade, agora legível
-- só por autenticado. A migração do eixo e-mail → auth.uid() é trabalho separado
-- e grande (~15 arquivos de cliente + 5 tabelas + Edge Functions que escrevem
-- coroas/campeões/prêmios). Decisão do fundador (2026-07-17): estancar primeiro.
--
-- DÍVIDA QUE FICA: um manager autenticado ainda lê o e-mail dos outros. Isso só
-- morre com a migração do eixo.
-- ============================================================

-- `anon` só recebe SELECT via o grant amplo do schema public; a RLS `USING (true)`
-- não distingue papel. Revogar no nível da tabela é o corte certo.
revoke select on public.global_league_teams from anon;
revoke select on public.global_league_fixtures from anon;
revoke select on public.global_league_rounds from anon;
revoke select on public.global_league_events from anon;
revoke select on public.global_league_state from anon;

do $$
begin
  if to_regclass('public.daily_crowns') is not null then
    revoke select on public.daily_crowns from anon;
  end if;
  if to_regclass('public.global_league_season_champions') is not null then
    revoke select on public.global_league_season_champions from anon;
  end if;
  if to_regclass('public.global_league_ko_prizes') is not null then
    revoke select on public.global_league_ko_prizes from anon;
  end if;
end $$;

comment on column public.global_league_teams.manager_id is
  'E-MAIL do manager (padrão legado). ⚠️ É DADO PESSOAL: jamais reabrir leitura '
  'pra anon nesta tabela. A correção de raiz é migrar este eixo para auth.uid(); '
  'até lá, autenticado ainda enxerga o e-mail dos outros. Ver 20260717170000.';
