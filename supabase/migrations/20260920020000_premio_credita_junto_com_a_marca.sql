-- ════════════════════════════════════════════════════════════════════════════
-- O prêmio da Liga passa a ser creditado NA MESMA TRANSAÇÃO em que é marcado
-- ════════════════════════════════════════════════════════════════════════════
-- `claim_my_ko_prizes()` e `claim_my_season_champion_prizes()` marcam
-- `claimed = true` e devolvem as linhas. Quem CREDITA é o cliente, depois, num
-- dispatch do reducer (useGlobalConsequencesSync.ts:236-305). Entre uma coisa e
-- a outra cabe um navegador fechando, uma aba dormindo no celular, um 4G que
-- cai: o prêmio fica marcado como pago e o EXP não entra em lugar nenhum. Some,
-- e some silenciosamente — ninguém reclama do que não sabe que ganhou.
--
-- Agora as duas funções creditam `manager_game_state.finance` junto com a
-- marca. Uma transação: ou as duas coisas, ou nenhuma.
--
-- ─── Por que ISTO NÃO precisa de deploy casado com o front ──────────────────
-- O cliente continua fazendo o que sempre fez: lê `prize_exp` das linhas
-- devolvidas, credita no estado local e salva. E o save do jogo grava o
-- `finance` INTEIRO — um retrato, não um delta (supabase/managerGameState.ts).
-- Então os dois caminhos convergem no mesmo número:
--
--     saldo 100, prêmio 10
--     servidor credita  → banco 110
--     cliente credita   → memória 110 → salva → banco 110
--
-- Não soma duas vezes porque a segunda escrita não soma: ela SUBSTITUI pelo
-- valor absoluto, que é o mesmo. E se o cliente morrer antes de salvar, o 110
-- do servidor já está gravado. O furo fecha sem tocar no front, e front velho
-- em cache continua funcionando igual.
--
-- ─── O crédito espelha o reducer, campo a campo ─────────────────────────────
-- CLAIM_KO_PRIZE (reducer.ts:3615)            → grantEarnedExp: ole + lifetime
-- CLAIM_SEASON_CHAMPION_PRIZE (reducer.ts:3600) → prize_ole via addOle (só ole,
--   sem lifetime) e prize_exp via grantEarnedExp (ole + lifetime)
-- `expHistory` recebe uma linha por prêmio, com a mesma frase do reducer, e o
-- mesmo teto de 120. `clubRenown` fica de fora: não é persistido no servidor.
--
-- Manager ainda sem linha em `manager_game_state` (conta nova que ganhou antes
-- do primeiro save): não há onde creditar, e o cliente cria a linha no save
-- seguinte. O crédito do servidor é pulado — o prêmio segue marcado e pago pelo
-- cliente, como hoje.

-- ── Helper: aplica um prêmio no finance de um manager ───────────────────────
create or replace function public._apply_finance_prize(
  p_user_id       uuid,
  p_ole_sem_lifetime numeric,   -- prize_ole do campeão: sobe saldo, não sobe lifetime
  p_exp              numeric,   -- sobe saldo E lifetime
  p_hist_entries     jsonb      -- linhas de expHistory, mais nova primeiro
) returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_fin  jsonb;
  v_ole  numeric;
  v_life numeric;
  v_hist jsonb;
  v_tem  boolean;
begin
  if coalesce(p_ole_sem_lifetime, 0) <= 0 and coalesce(p_exp, 0) <= 0 then
    return false;
  end if;

  select true, mgs.finance into v_tem, v_fin
    from public.manager_game_state mgs
   where mgs.user_id = p_user_id
   for update;

  -- Sem linha salva ainda: o cliente cria no próximo save e credita lá.
  if not coalesce(v_tem, false) then
    return false;
  end if;

  v_fin  := coalesce(v_fin, jsonb_build_object('ole', 0, 'broCents', 0, 'expLifetimeEarned', 0));
  v_ole  := coalesce(public.jsonb_num(v_fin, 'ole'), 0);
  v_life := coalesce(public.jsonb_num(v_fin, 'expLifetimeEarned'), 0);
  v_hist := case when jsonb_typeof(v_fin -> 'expHistory') = 'array'
                 then v_fin -> 'expHistory' else '[]'::jsonb end;

  if jsonb_typeof(p_hist_entries) = 'array' then
    v_hist := p_hist_entries || v_hist;
    if jsonb_array_length(v_hist) > 120 then
      v_hist := (select jsonb_agg(e order by i)
                   from jsonb_array_elements(v_hist) with ordinality t(e, i)
                  where i <= 120);
    end if;
  end if;

  update public.manager_game_state
     set finance = v_fin
                   || jsonb_build_object('ole', v_ole + coalesce(p_ole_sem_lifetime, 0) + coalesce(p_exp, 0))
                   || jsonb_build_object('expLifetimeEarned', v_life + coalesce(p_exp, 0))
                   || jsonb_build_object('expHistory', v_hist)
   where manager_game_state.user_id = p_user_id;

  return true;
end;
$function$;

comment on function public._apply_finance_prize(uuid, numeric, numeric, jsonb) is
  'Aplica um prêmio da Liga no finance do manager, espelhando addOle/grantEarnedExp '
  'do reducer. Uso interno das funções de claim. Ver 20260920020000.';

revoke execute on function public._apply_finance_prize(uuid, numeric, numeric, jsonb) from public, anon, authenticated;


-- ── Mata-Mata do dia ────────────────────────────────────────────────────────
create or replace function public.claim_my_ko_prizes()
returns setof global_league_ko_prizes
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ids  text[];
  v_uid  uuid := auth.uid();
  v_exp  numeric;
  v_hist jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  with locked as (
    select gp.id
      from public.global_league_ko_prizes gp
     where lower(gp.manager_id) = any (public.my_manager_identities())
       and gp.claimed = false
     for update
  )
  select coalesce(array_agg(id), '{}') into v_ids from locked;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return;
  end if;

  update public.global_league_ko_prizes gp
     set claimed = true
   where gp.id = any(v_ids);

  -- O cliente só credita linhas com prize_exp > 0 (useGlobalConsequencesSync
  -- filtra). O servidor faz igual, senão os dois lados divergiriam.
  select coalesce(sum(gp.prize_exp), 0),
         coalesce(jsonb_agg(
           jsonb_build_object(
             'id',        'exp-ko-' || gp.id,
             'amount',    gp.prize_exp,
             'source',    'Mata-Mata · ' || case gp.stage
                              when 'qualified' then 'Classificação Mata-Mata'
                              when 'r16'       then 'Vitória nas oitavas'
                              when 'qf'        then 'Vitória nas quartas'
                              when 'sf'        then 'Vitória na semifinal'
                              when 'final'     then 'Campeão do Dia'
                              else gp.stage end || ' · EXP',
             'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
           ) order by gp.id desc
         ), '[]'::jsonb)
    into v_exp, v_hist
    from public.global_league_ko_prizes gp
   where gp.id = any(v_ids) and gp.prize_exp > 0;

  perform public._apply_finance_prize(v_uid, 0, v_exp, v_hist);

  return query
    select * from public.global_league_ko_prizes gp where gp.id = any(v_ids);
end;
$function$;

comment on function public.claim_my_ko_prizes() is
  'Marca os prêmios do Mata-Mata do manager E credita o saldo na MESMA '
  'transação (antes o crédito era só no cliente e sumia se a aba fechasse). '
  'O cliente também credita; como ele salva o finance inteiro, o valor final é '
  'o mesmo. Ver 20260920020000_premio_credita_junto_com_a_marca.sql.';


-- ── Campeão de temporada ────────────────────────────────────────────────────
create or replace function public.claim_my_season_champion_prizes()
returns setof global_league_season_champions
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ids  text[];
  v_uid  uuid := auth.uid();
  v_ole  numeric;
  v_exp  numeric;
  v_hist jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  with locked as (
    select sc.id
      from public.global_league_season_champions sc
     where lower(sc.manager_id) = any (public.my_manager_identities())
       and sc.claimed = false
     for update
  )
  select coalesce(array_agg(id), '{}') into v_ids from locked;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return;
  end if;

  update public.global_league_season_champions sc
     set claimed = true
   where sc.id = any(v_ids);

  select coalesce(sum(sc.prize_ole), 0), coalesce(sum(sc.prize_exp), 0)
    into v_ole, v_exp
    from public.global_league_season_champions sc
   where sc.id = any(v_ids);

  -- Duas linhas por título, como no reducer: OLE e EXP separados.
  select coalesce(jsonb_agg(x order by ord), '[]'::jsonb) into v_hist from (
    select jsonb_build_object(
             'id',        'exp-champ-' || sc.id || '-exp',
             'amount',    sc.prize_exp,
             'source',    'Campeão Div ' || sc.division || ' · EXP',
             'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
           ) as x, 1 as ord, sc.id
      from public.global_league_season_champions sc
     where sc.id = any(v_ids) and sc.prize_exp > 0
    union all
    select jsonb_build_object(
             'id',        'exp-champ-' || sc.id || '-ole',
             'amount',    sc.prize_ole,
             'source',    'Campeão Div ' || sc.division || ' · OLE',
             'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
           ), 2, sc.id
      from public.global_league_season_champions sc
     where sc.id = any(v_ids) and sc.prize_ole > 0
  ) s;

  perform public._apply_finance_prize(v_uid, v_ole, v_exp, v_hist);

  return query
    select * from public.global_league_season_champions sc where sc.id = any(v_ids);
end;
$function$;

comment on function public.claim_my_season_champion_prizes() is
  'Marca o título de divisão do manager E credita o saldo na MESMA transação. '
  'prize_ole sobe só o saldo; prize_exp sobe saldo e lifetime (espelha o '
  'reducer). Ver 20260920020000_premio_credita_junto_com_a_marca.sql.';


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — reclama um prêmio de verdade, confere o crédito, desfaz tudo
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_uid       uuid;
  v_ole_antes numeric;
  v_ole_dps   numeric;
  v_life_antes numeric;
  v_life_dps  numeric;
  v_pend      int;
  v_pend_dps  int;
  v_linhas    int;
  v_msg       text;
begin
  select count(*) into v_pend from public.global_league_ko_prizes where not claimed;

  begin
    -- Cria um prêmio de teste para um manager com estado salvo e finge ser ele.
    select m.user_id, coalesce(public.jsonb_num(m.finance,'ole'), 0),
           coalesce(public.jsonb_num(m.finance,'expLifetimeEarned'), 0)
      into v_uid, v_ole_antes, v_life_antes
      from public.manager_game_state m
      join auth.users u on u.id = m.user_id
     where m.finance is not null and u.email is not null
     limit 1;

    if v_uid is null then
      raise notice 'verificação: nenhum manager com finance pra exercitar';
    else
      insert into public.global_league_ko_prizes
        (id, competition_id, season_id, daily_date, team_id, manager_id, club_name,
         stage, prize_exp, claimed, crowned_at_ms)
      select 'zz-teste-' || v_uid::text, 'zz', 'zz', '2026-09-20', 'zz',
             u.email, 'ZZ Teste', 'final', 2500000, false,
             (extract(epoch from now()) * 1000)::bigint
        from auth.users u where u.id = v_uid;

      -- auth.uid() lê do GUC da sessão; setá-lo faz o claim rodar como este user.
      perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text)::text, true);

      select count(*)::int into v_linhas from public.claim_my_ko_prizes();
      if v_linhas = 0 then
        raise exception 'claim_my_ko_prizes não devolveu o prêmio de teste';
      end if;

      select coalesce(public.jsonb_num(finance,'ole'), 0),
             coalesce(public.jsonb_num(finance,'expLifetimeEarned'), 0)
        into v_ole_dps, v_life_dps
        from public.manager_game_state where user_id = v_uid;

      if v_ole_dps - v_ole_antes <> 2500000 then
        raise exception 'saldo subiu %, esperado 2500000', v_ole_dps - v_ole_antes;
      end if;
      if v_life_dps - v_life_antes <> 2500000 then
        raise exception 'lifetime subiu %, esperado 2500000', v_life_dps - v_life_antes;
      end if;
      if not exists (
        select 1 from public.manager_game_state
         where user_id = v_uid
           and (finance -> 'expHistory' -> 0 ->> 'source') = 'Mata-Mata · Campeão do Dia · EXP'
           and jsonb_array_length(finance -> 'expHistory') <= 120
      ) then
        raise exception 'expHistory não recebeu a linha do Campeão do Dia';
      end if;
      if exists (
        select 1 from public.global_league_ko_prizes
         where id = 'zz-teste-' || v_uid::text and not claimed
      ) then
        raise exception 'o prêmio de teste não ficou marcado';
      end if;

      -- Chamar de novo não credita nada (não há mais prêmio pendente dele).
      select count(*)::int into v_linhas from public.claim_my_ko_prizes();
      select coalesce(public.jsonb_num(finance,'ole'), 0) into v_ole_dps
        from public.manager_game_state where user_id = v_uid;
      if v_ole_dps - v_ole_antes <> 2500000 then
        raise exception 'segunda chamada creditou de novo (saldo subiu %)', v_ole_dps - v_ole_antes;
      end if;

      raise notice 'verificação: creditou 2.500.000 e marcou junto; segunda chamada não repetiu';
    end if;

    raise exception 'zz_verifica_ok';
  exception when others then
    v_msg := sqlerrm;
    if v_msg <> 'zz_verifica_ok' then
      raise exception 'verificação do crédito falhou: %', v_msg;
    end if;
  end;

  select count(*) into v_pend_dps from public.global_league_ko_prizes where not claimed;
  if v_pend_dps <> v_pend then
    raise exception 'a verificação deixou rastro: pendentes % → %', v_pend, v_pend_dps;
  end if;
  if exists (select 1 from public.global_league_ko_prizes where id like 'zz-teste-%') then
    raise exception 'o prêmio de teste sobrou na tabela';
  end if;

  raise notice 'verificação: ok — credita junto com a marca e não deixou rastro';
end $$;
