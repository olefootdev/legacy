-- ════════════════════════════════════════════════════════════════════════════
-- ONDA 0 · CAMINHO 1 — itens #2/#3: campeão de temporada + coroa do dia
-- ════════════════════════════════════════════════════════════════════════════
-- `global_league_season_champions` (20260616140000) e `global_league_ko_prizes`
-- (20260619200000) nasceram SEM RLS. A 20260717170000 revogou SELECT de `anon`
-- (vazamento de e-mail), mas `authenticated` seguiu com INSERT/UPDATE/DELETE
-- livres, em qualquer linha.
--
-- Pior que o wallet_credits: qualquer conta logada podia INSERIR uma linha de
-- "campeão" pra si (manager_id é texto livre) com prize_ole/prize_exp
-- arbitrários, e o polling em src/hooks/useGlobalConsequencesSync.ts creditava
-- no próximo load — sem vencer nada. Ou marcar `claimed` no prêmio dos outros.
--
-- Fecha: RLS ligada, nenhuma escrita pelo cliente (quem grava prêmio é a Edge
-- `global-league-tick`, com service_role — não passa por RLS), e a reclamação
-- vira RPC atômica.
--
-- IDENTIDADE: `manager_id` guarda o e-mail que o cliente mandou no cadastro do
-- time (managerProfile.email). Comparo com o e-mail VERIFICADO do auth, sem
-- diferenciar maiúscula. Nunca com o e-mail do perfil (profiles.onboarding_data):
-- ele é gravado via save_onboarding_profile com valor vindo do cliente — usar
-- ele deixaria qualquer um se declarar dono do prêmio alheio. Quem cadastrou o
-- time com um e-mail diferente do login fica com o prêmio RETIDO (não perdido)
-- até a migração do eixo e-mail → auth.uid() (Onda 1). A verificação abaixo
-- conta quantos são.

create or replace function public.my_manager_identities()
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $function$
  select array_remove(array[
    (select lower(u.email) from auth.users u where u.id = auth.uid()),
    auth.uid()::text
  ], null);
$function$;

revoke execute on function public.my_manager_identities() from public, anon;
grant execute on function public.my_manager_identities() to authenticated;

comment on function public.my_manager_identities() is
  'Identidades confiáveis do usuário logado pra casar com manager_id (texto, '
  'legado por e-mail): e-mail do auth em minúsculas + uid. NÃO incluir o e-mail '
  'do perfil — ele é declarado pelo cliente.';

alter table public.global_league_season_champions enable row level security;
alter table public.global_league_ko_prizes enable row level security;

drop policy if exists "season_champions_select_own" on public.global_league_season_champions;
create policy "season_champions_select_own"
  on public.global_league_season_champions for select
  to authenticated
  using (lower(manager_id) = any ((select public.my_manager_identities())::text[]));

drop policy if exists "ko_prizes_select_own" on public.global_league_ko_prizes;
create policy "ko_prizes_select_own"
  on public.global_league_ko_prizes for select
  to authenticated
  using (lower(manager_id) = any ((select public.my_manager_identities())::text[]));

revoke all on public.global_league_season_champions from anon, authenticated;
revoke all on public.global_league_ko_prizes from anon, authenticated;
grant select on public.global_league_season_champions to authenticated;
grant select on public.global_league_ko_prizes to authenticated;

create or replace function public.claim_my_season_champion_prizes()
returns setof public.global_league_season_champions
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ids text[];
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  with locked as (
    select id
      from public.global_league_season_champions
     where lower(manager_id) = any (public.my_manager_identities())
       and claimed = false
     for update
  )
  select coalesce(array_agg(id), '{}') into v_ids from locked;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return;
  end if;

  update public.global_league_season_champions
     set claimed = true
   where id = any(v_ids);

  return query
    select * from public.global_league_season_champions where id = any(v_ids);
end;
$function$;

revoke execute on function public.claim_my_season_champion_prizes() from public, anon;
grant execute on function public.claim_my_season_champion_prizes() to authenticated;

create or replace function public.claim_my_ko_prizes()
returns setof public.global_league_ko_prizes
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ids text[];
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  with locked as (
    select id
      from public.global_league_ko_prizes
     where lower(manager_id) = any (public.my_manager_identities())
       and claimed = false
     for update
  )
  select coalesce(array_agg(id), '{}') into v_ids from locked;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return;
  end if;

  update public.global_league_ko_prizes
     set claimed = true
   where id = any(v_ids);

  return query
    select * from public.global_league_ko_prizes where id = any(v_ids);
end;
$function$;

revoke execute on function public.claim_my_ko_prizes() from public, anon;
grant execute on function public.claim_my_ko_prizes() to authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — exercita o caminho novo e desfaz o próprio rastro
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_uid     uuid;
  v_email   text;
  v_n       int;
  v_retidos int;
  v_orfaos  int;
  v_msg     text;
begin
  -- 1. RLS ligada e cliente sem escrita
  if not (select relrowsecurity from pg_class where oid = 'public.global_league_season_champions'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.global_league_ko_prizes'::regclass) then
    raise exception 'RLS não ficou ligada nas tabelas de prêmio';
  end if;
  if has_table_privilege('authenticated', 'public.global_league_season_champions', 'INSERT')
     or has_any_column_privilege('authenticated', 'public.global_league_season_champions', 'UPDATE')
     or has_table_privilege('authenticated', 'public.global_league_ko_prizes', 'INSERT')
     or has_any_column_privilege('authenticated', 'public.global_league_ko_prizes', 'UPDATE')
     or has_table_privilege('anon', 'public.global_league_ko_prizes', 'SELECT') then
    raise exception 'cliente ainda escreve (ou anon lê) tabela de prêmio';
  end if;

  -- 2. a RPC acha o prêmio mesmo com o e-mail em outra caixa, paga uma vez só
  select id, email into v_uid, v_email
    from auth.users where email is not null order by created_at limit 1;
  if v_uid is null then
    raise notice 'verificação: sem usuários com e-mail pra exercitar as RPCs de prêmio';
  else
    begin
      insert into public.global_league_season_champions
        (id, division, team_id, manager_id, prize_ole, prize_exp, claimed)
      values ('zz-verifica-champ', 1, 'zz-team', upper(v_email), 1, 2, false);
      insert into public.global_league_ko_prizes
        (id, daily_date, team_id, manager_id, stage, prize_exp, claimed)
      values ('zz-verifica-ko', '2000-01-01', 'zz-team', upper(v_email), 'final', 3, false);

      perform set_config('request.jwt.claim.sub', v_uid::text, true);

      select count(*) into v_n
        from public.claim_my_season_champion_prizes() c where c.id = 'zz-verifica-champ';
      if v_n <> 1 then
        raise exception 'claim de campeão não achou o prêmio (e-mail em maiúscula)';
      end if;
      select count(*) into v_n
        from public.claim_my_season_champion_prizes() c where c.id = 'zz-verifica-champ';
      if v_n <> 0 then
        raise exception 'claim de campeão pagou duas vezes';
      end if;

      select count(*) into v_n
        from public.claim_my_ko_prizes() c where c.id = 'zz-verifica-ko';
      if v_n <> 1 then
        raise exception 'claim do mata-mata não achou o prêmio';
      end if;
      select count(*) into v_n
        from public.claim_my_ko_prizes() c where c.id = 'zz-verifica-ko';
      if v_n <> 0 then
        raise exception 'claim do mata-mata pagou duas vezes';
      end if;

      raise exception 'zz_verifica_ok';
    exception when others then
      v_msg := sqlerrm;
      if v_msg <> 'zz_verifica_ok' then
        raise exception 'verificação dos prêmios falhou: %', v_msg;
      end if;
    end;
    perform set_config('request.jwt.claim.sub', '', true);
  end if;

  -- 3. diagnóstico (não falha): quem fica com prêmio retido até a Onda 1
  select count(*) into v_retidos
    from (select manager_id from public.global_league_season_champions where not claimed
          union all
          select manager_id from public.global_league_ko_prizes where not claimed) p
   where not exists (select 1 from auth.users u where lower(u.email) = lower(p.manager_id));
  select count(*) into v_orfaos
    from public.global_league_teams t
   where not exists (select 1 from auth.users u
                      where lower(u.email) = lower(t.manager_id) or u.id::text = t.manager_id);
  raise notice 'diagnóstico: % prêmio(s) pendente(s) sem e-mail de login correspondente; % time(s) da Liga com manager_id que não bate com nenhum login',
    v_retidos, v_orfaos;

  raise notice 'verificação: ok — prêmios da Liga só via RPC, sem cliente escrevendo';
end $$;
