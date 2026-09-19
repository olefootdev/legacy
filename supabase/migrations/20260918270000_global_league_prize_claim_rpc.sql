-- ════════════════════════════════════════════════════════════════════════════
-- ONDA 0 · prêmios da Liga — a reclamação vira RPC atômica
-- ════════════════════════════════════════════════════════════════════════════
-- Em 2026-09-18 havia 69 prêmios de campeão e 4.163 de mata-mata pendentes,
-- nenhum pago desde junho (17M OLE + ~758M EXP; o maior manager sozinho ~89M
-- EXP). DECISÃO DO FUNDADOR (2026-09-18): pagar o acumulado inteiro. Com esta
-- migration + o bundle novo, cada manager recebe tudo no próximo load — um
-- dispatch por prêmio (teto de 5M por chamada no reducer; maior linha 2,5M) e
-- flush imediato do saldo (ver runLeaguePrizeClaim em useGlobalConsequencesSync).
-- Ver 20260918230000.
--
-- As RPCs travam as linhas do próprio manager (FOR UPDATE), marcam claimed e
-- devolvem só as recém-reclamadas — atômico, sem pagar duas vezes.

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
-- VERIFICAÇÃO — exercita as RPCs e desfaz o próprio rastro
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_uid   uuid;
  v_email text;
  v_n     int;
  v_msg   text;
begin
  select id, email into v_uid, v_email
    from auth.users where email is not null order by created_at limit 1;
  if v_uid is null then
    raise notice 'verificação: sem usuários com e-mail pra exercitar as RPCs de prêmio';
  else
    begin
      -- isola o teste do acumulado real desse usuário
      update public.global_league_season_champions set claimed = true
       where lower(manager_id) = lower(v_email) and not claimed;
      update public.global_league_ko_prizes set claimed = true
       where lower(manager_id) = lower(v_email) and not claimed;

      insert into public.global_league_season_champions
        (id, division, team_id, manager_id, prize_ole, prize_exp, claimed)
      values ('zz-verifica-champ', 1, 'zz-team', upper(v_email), 1, 2, false);
      insert into public.global_league_ko_prizes
        (id, daily_date, team_id, manager_id, stage, prize_exp, claimed)
      values ('zz-verifica-ko', '2000-01-01', 'zz-team', upper(v_email), 'final', 3, false);

      perform set_config('request.jwt.claim.sub', v_uid::text, true);

      select count(*) into v_n from public.claim_my_season_champion_prizes();
      if v_n <> 1 then
        raise exception 'claim de campeão devolveu % linhas (esperava 1, e-mail em maiúscula)', v_n;
      end if;
      select count(*) into v_n from public.claim_my_season_champion_prizes();
      if v_n <> 0 then
        raise exception 'claim de campeão pagou duas vezes';
      end if;
      select count(*) into v_n from public.claim_my_ko_prizes();
      if v_n <> 1 then
        raise exception 'claim do mata-mata devolveu % linhas (esperava 1)', v_n;
      end if;
      select count(*) into v_n from public.claim_my_ko_prizes();
      if v_n <> 0 then
        raise exception 'claim do mata-mata pagou duas vezes';
      end if;

      raise exception 'zz_verifica_ok';
    exception when others then
      v_msg := sqlerrm;
      if v_msg <> 'zz_verifica_ok' then
        raise exception 'verificação das RPCs de prêmio falhou: %', v_msg;
      end if;
    end;
    perform set_config('request.jwt.claim.sub', '', true);
  end if;

  raise notice 'verificação: ok — reclamação de prêmio atômica, uma vez só';
end $$;
