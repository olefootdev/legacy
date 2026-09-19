-- ════════════════════════════════════════════════════════════════════════════
-- ONDA 0 · Liga Global — o cliente para de escrever no estado da liga dos outros
-- ════════════════════════════════════════════════════════════════════════════
-- A 20260427135532 criou as policies de escrita da Liga Global como
-- `auth.role() = 'authenticated'` — ou seja, QUALQUER conta logada podia:
--   • global_league_teams    INSERT/UPDATE em qualquer time: pontos, divisão,
--                            manager_id, e `available_player_count` do rival
--                            (abaixo de 11 a Edge aplica WO 3x0);
--   • global_league_fixtures INSERT/UPDATE: placar de qualquer partida;
--   • global_league_rounds   INSERT/UPDATE;
--   • global_league_state    UPDATE: o estado da temporada;
--   • global_league_events   INSERT.
-- E é desse estado que a Edge `global-league-tick` lê a classificação pra
-- coroar campeão — travar só as tabelas de prêmio (20260918230000) deixava a
-- porta de cima aberta.
--
-- O próprio src/supabase/globalLeague.ts já diz: "A Edge Function é a ÚNICA
-- fonte de verdade para ranking, pontos, fixtures, eventos. O frontend nunca
-- reescreve esse estado". Esta migration só faz o banco concordar com o código.
--
-- O que o cliente AINDA escreve, e só no próprio time (casado por
-- public.my_manager_identities(), criada em 20260918230000):
--   INSERT (cadastro, registerGlobalTeamIdentity): id, manager_id, club_name,
--     club_short, overall, registered_at, favorite_team_id, division. O bundle
--     de 2026-09-18 em diante não manda division (a Edge põe na porta de
--     entrada); a coluna fica no grant só pra aba com bundle antigo, que manda
--     3 — e a policy aceita nula ou ≥ 3 (ninguém entra direto na Div 1/2).
--   UPDATE (brasão + syncTeamStatus): favorite_team_id, available_player_count,
--     available_player_count_updated_at, engagement_score, overall,
--     lineup_snapshot.
-- Pontos, vitórias, gols, posição, divisão pós-cadastro: só a Edge.
--
-- ⚠️ `overall`, `lineup_snapshot` e `available_player_count` do PRÓPRIO time
-- continuam declarados pelo cliente — o elenco inteiro ainda é client-side
-- (fora do escopo da Onda 0). O que fecha aqui é mexer no time dos outros e no
-- placar/classificação.
--
-- Leitura não muda (authenticated lê tudo — a classificação precisa).
-- Quem grava via servidor (Edge e server/src/routes/globalLeague.ts) usa
-- service_role e não passa por RLS nem por grant.

drop policy if exists "Allow authenticated insert" on public.global_league_teams;
drop policy if exists "Allow authenticated update" on public.global_league_teams;
drop policy if exists "Allow authenticated insert" on public.global_league_rounds;
drop policy if exists "Allow authenticated update" on public.global_league_rounds;
drop policy if exists "Allow authenticated insert" on public.global_league_fixtures;
drop policy if exists "Allow authenticated update" on public.global_league_fixtures;
drop policy if exists "Allow authenticated insert" on public.global_league_events;
drop policy if exists "Allow authenticated update" on public.global_league_state;

revoke insert, update, delete, truncate on public.global_league_teams     from anon, authenticated;
revoke insert, update, delete, truncate on public.global_league_fixtures  from anon, authenticated;
revoke insert, update, delete, truncate on public.global_league_rounds    from anon, authenticated;
revoke insert, update, delete, truncate on public.global_league_state     from anon, authenticated;
revoke insert, update, delete, truncate on public.global_league_events    from anon, authenticated;

-- Grant só nas colunas que existem neste banco (lineup_snapshot e
-- favorite_team_id chegaram em migrations posteriores — grant de coluna
-- inexistente derrubaria a migration inteira).
do $$
declare
  c text;
begin
  foreach c in array array['id', 'manager_id', 'club_name', 'club_short', 'overall',
                           'registered_at', 'favorite_team_id', 'division'] loop
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'global_league_teams'
                  and column_name = c) then
      execute format('grant insert (%I) on public.global_league_teams to authenticated', c);
    end if;
  end loop;

  foreach c in array array['favorite_team_id', 'available_player_count',
                           'available_player_count_updated_at', 'engagement_score',
                           'overall', 'lineup_snapshot'] loop
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'global_league_teams'
                  and column_name = c) then
      execute format('grant update (%I) on public.global_league_teams to authenticated', c);
    end if;
  end loop;
end $$;

drop policy if exists "global_league_teams_insert_own" on public.global_league_teams;
create policy "global_league_teams_insert_own"
  on public.global_league_teams for insert
  to authenticated
  with check (
    lower(manager_id) = any ((select public.my_manager_identities())::text[])
    and (division is null or division >= 3)
  );

drop policy if exists "global_league_teams_update_own" on public.global_league_teams;
create policy "global_league_teams_update_own"
  on public.global_league_teams for update
  to authenticated
  using (lower(manager_id) = any ((select public.my_manager_identities())::text[]))
  with check (lower(manager_id) = any ((select public.my_manager_identities())::text[]));


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  t    text;
  c    text;
  v_n  int;
  v_uid uuid;
  v_email text;
  v_ids text[];
begin
  -- 1. placar, rodada, estado e eventos: zero escrita do cliente
  foreach t in array array['global_league_fixtures', 'global_league_rounds',
                           'global_league_state', 'global_league_events'] loop
    if has_table_privilege('authenticated', 'public.' || t, 'INSERT')
       or has_table_privilege('authenticated', 'public.' || t, 'DELETE')
       or has_any_column_privilege('authenticated', 'public.' || t, 'UPDATE')
       or has_table_privilege('anon', 'public.' || t, 'INSERT')
       or has_any_column_privilege('anon', 'public.' || t, 'UPDATE') then
      raise exception 'cliente ainda escreve em %', t;
    end if;
  end loop;

  -- 2. time: nada de pontos/divisão/dono via UPDATE, nem apagar time
  foreach c in array array['points', 'wins', 'goals_for', 'division', 'manager_id',
                           'position', 'matches_played'] loop
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'global_league_teams'
                  and column_name = c)
       and has_column_privilege('authenticated', 'public.global_league_teams', c, 'UPDATE') then
      raise exception 'cliente ainda altera global_league_teams.%', c;
    end if;
  end loop;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'global_league_teams'
                and column_name = 'points')
     and has_column_privilege('authenticated', 'public.global_league_teams', 'points', 'INSERT') then
    raise exception 'cliente ainda cadastra time com pontos';
  end if;
  if has_table_privilege('authenticated', 'public.global_league_teams', 'DELETE') then
    raise exception 'cliente ainda apaga time';
  end if;

  -- 3. …mas o cadastro e o sync do próprio time continuam possíveis
  if not has_column_privilege('authenticated', 'public.global_league_teams', 'club_name', 'INSERT')
     or not has_column_privilege('authenticated', 'public.global_league_teams', 'overall', 'UPDATE') then
    raise exception 'cadastro/sync do próprio time ficaria quebrado';
  end if;

  -- 4. nenhuma policy de escrita genérica "qualquer logado" sobrou na família
  select count(*) into v_n
    from pg_policies
   where schemaname = 'public' and tablename like 'global_league_%'
     and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
     and (coalesce(qual, '') ilike '%auth.role()%'
          or coalesce(with_check, '') ilike '%auth.role()%');
  if v_n > 0 then
    raise exception 'sobrou % policy de escrita por auth.role() na Liga Global', v_n;
  end if;

  -- 5. a identidade usada pelas policies reconhece o próprio usuário
  select id, email into v_uid, v_email
    from auth.users where email is not null order by created_at limit 1;
  if v_uid is not null then
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    v_ids := public.my_manager_identities();
    perform set_config('request.jwt.claim.sub', '', true);
    if not (lower(v_email) = any (v_ids)) or not (v_uid::text = any (v_ids)) then
      raise exception 'my_manager_identities não reconheceu o próprio usuário: %', v_ids;
    end if;
  end if;

  raise notice 'verificação: ok — Liga Global só escreve pelo servidor (cliente: só o próprio time, colunas de sync)';
end $$;
