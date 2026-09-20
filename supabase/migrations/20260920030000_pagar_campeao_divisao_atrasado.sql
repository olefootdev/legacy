-- ════════════════════════════════════════════════════════════════════════════
-- O título de divisão atrasado também é pago pelo servidor
-- ════════════════════════════════════════════════════════════════════════════
-- Mesmo problema do Mata-Mata (20260920010000): `claim_my_season_champion_prizes()`
-- só roda quando o manager ABRE o jogo. Medido em 2026-09-20:
--
--     69 títulos · 19 pagos · 50 pendentes · 36 managers · 11.250.000 no saldo
--     (3.750.000 em prize_exp + 7.500.000 em prize_ole)
--
-- Uma ordem de grandeza abaixo dos 638,5M do Mata-Mata, mas é gente que ganhou
-- uma temporada inteira e nunca viu o prêmio.
--
-- O crédito reusa `_apply_finance_prize`, criada em 20260920020000 quando o
-- claim passou a creditar junto com a marca. Ela já espelha o reducer:
-- `prize_ole` sobe só o saldo (addOle) e `prize_exp` sobe saldo e lifetime
-- (grantEarnedExp). Aqui não se reescreve a regra, só se chama.
--
-- `p_idle_minutes` pelo mesmo motivo de antes: o saldo é escrito pelo CLIENTE,
-- então creditar embaixo de uma sessão aberta é escrever o que o próximo save
-- apaga. Medido antes de aplicar: 0 dos 36 salvaram nos últimos 30 min.

create or replace function public.pay_season_champion_backlog(
  p_idle_minutes int default 30
)
returns table (
  manager_id   text,
  user_id      uuid,
  titulos      int,
  total_pago   bigint,
  saldo_antes  numeric,
  saldo_depois numeric
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r       record;
  v_ids   text[];
  v_n     int;
  v_ole   numeric;
  v_exp   numeric;
  v_hist  jsonb;
  v_inbox jsonb;
  v_antes numeric;
  v_now   text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  for r in
    select sc.manager_id as mid, u.id as uid
      from public.global_league_season_champions sc
      join auth.users u               on lower(u.email) = lower(sc.manager_id)
      join public.manager_game_state m on m.user_id = u.id
     where sc.claimed = false
       and m.updated_at < now() - make_interval(mins => greatest(p_idle_minutes, 0))
     group by sc.manager_id, u.id
     order by sc.manager_id
  loop
    -- `gsc.` obrigatório: `manager_id` e `user_id` também são parâmetros de
    -- saída desta função, e sem qualificar o Postgres recusa por ambiguidade.
    with travados as (
      select gsc.id, gsc.prize_ole, gsc.prize_exp, gsc.division
        from public.global_league_season_champions gsc
       where lower(gsc.manager_id) = lower(r.mid)
         and gsc.claimed = false
       for update
    )
    select coalesce(array_agg(id), '{}'), count(*)::int,
           coalesce(sum(prize_ole), 0), coalesce(sum(prize_exp), 0),
           -- Duas linhas por título, como no reducer: OLE e EXP separados.
           coalesce((
             select jsonb_agg(x) from (
               select jsonb_build_object(
                        'id', 'exp-champ-' || t.id || '-exp', 'amount', t.prize_exp,
                        'source', 'Campeão Div ' || t.division || ' · EXP', 'createdAt', v_now
                      ) x from travados t where t.prize_exp > 0
               union all
               select jsonb_build_object(
                        'id', 'exp-champ-' || t.id || '-ole', 'amount', t.prize_ole,
                        'source', 'Campeão Div ' || t.division || ' · OLE', 'createdAt', v_now
                      ) from travados t where t.prize_ole > 0
             ) s
           ), '[]'::jsonb)
      into v_ids, v_n, v_ole, v_exp, v_hist
      from travados;

    continue when v_n = 0;

    select coalesce(public.jsonb_num(mgs.finance, 'ole'), 0) into v_antes
      from public.manager_game_state mgs where mgs.user_id = r.uid;

    if not public._apply_finance_prize(r.uid, v_ole, v_exp, v_hist) then
      continue;  -- sem onde creditar: deixa o prêmio pendente pro cliente
    end if;

    -- Aviso no inbox, pra ele saber o que recebeu quando voltar.
    select coalesce(mgs.inbox, '[]'::jsonb) into v_inbox
      from public.manager_game_state mgs where mgs.user_id = r.uid;
    v_inbox := jsonb_build_array(jsonb_build_object(
      'id',          'season-champ-backlog-' || r.uid::text,
      'messageType', 'FINANCE_EXP_GAIN',
      'category',    'COMPETIÇÃO',
      'tag',         'COMPETIÇÃO',
      'title',       '🏆 Título de divisão creditado',
      'body',        v_n || ' temporada(s) vencida(s). Total: +'
                       || replace(to_char(v_ole + v_exp, 'FM999G999G999G999'), ',', '.') || ' EXP.',
      'deepLink',    '/match/global',
      'timeLabel',   'Agora',
      'colorClass',  'text-blue-400',
      'read',        false
    )) || v_inbox;
    if jsonb_array_length(v_inbox) > 14 then
      v_inbox := (select jsonb_agg(e order by i)
                    from jsonb_array_elements(v_inbox) with ordinality t(e, i)
                   where i <= 14);
    end if;
    update public.manager_game_state
       set inbox = v_inbox
     where manager_game_state.user_id = r.uid;

    update public.global_league_season_champions gsc
       set claimed = true
     where gsc.id = any(v_ids);

    manager_id   := r.mid;
    user_id      := r.uid;
    titulos      := v_n;
    total_pago   := (v_ole + v_exp)::bigint;
    saldo_antes  := v_antes;
    saldo_depois := v_antes + v_ole + v_exp;
    return next;
  end loop;
end;
$function$;

comment on function public.pay_season_champion_backlog(int) is
  'Paga o acumulado de título de divisão da Liga Global pelo servidor: credita '
  'e marca claimed na MESMA transação, reusando _apply_finance_prize. Só '
  'service_role. Pula quem salvou nos últimos p_idle_minutes. '
  'Ver 20260920030000_pagar_campeao_divisao_atrasado.sql.';

revoke execute on function public.pay_season_champion_backlog(int) from public, anon, authenticated;
grant  execute on function public.pay_season_champion_backlog(int) to service_role;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — paga de verdade, confere o resultado e desfaz o próprio rastro
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_pend_antes  int;
  v_pend_depois int;
  v_uid         uuid;
  v_ole_antes   numeric;
  v_ole_depois  numeric;
  v_esperado    bigint;
  v_linhas      int;
  v_total       bigint;
  v_msg         text;
begin
  if has_function_privilege('authenticated', 'public.pay_season_champion_backlog(int)', 'EXECUTE')
     or has_function_privilege('anon', 'public.pay_season_champion_backlog(int)', 'EXECUTE') then
    raise exception 'cliente consegue executar pay_season_champion_backlog';
  end if;

  select count(*) into v_pend_antes from public.global_league_season_champions where not claimed;

  begin
    select u.id, coalesce(public.jsonb_num(m.finance, 'ole'), 0)
      into v_uid, v_ole_antes
      from public.global_league_season_champions sc
      join auth.users u               on lower(u.email) = lower(sc.manager_id)
      join public.manager_game_state m on m.user_id = u.id
     where sc.claimed = false
       and m.updated_at < now() - interval '30 minutes'
     limit 1;

    if v_uid is null then
      raise notice 'verificação: ninguém pagável agora — função criada mesmo assim';
    else
      select coalesce(sum(sc.prize_ole + sc.prize_exp), 0)::bigint into v_esperado
        from public.global_league_season_champions sc
        join auth.users u on lower(u.email) = lower(sc.manager_id)
       where u.id = v_uid and sc.claimed = false;

      select count(*)::int, coalesce(sum(total_pago), 0)::bigint
        into v_linhas, v_total
        from public.pay_season_champion_backlog(30);

      if v_linhas = 0 then
        raise exception 'a função não pagou ninguém, mas havia manager pagável';
      end if;

      select coalesce(public.jsonb_num(finance, 'ole'), 0) into v_ole_depois
        from public.manager_game_state where user_id = v_uid;
      if v_ole_depois - v_ole_antes is distinct from v_esperado::numeric then
        raise exception 'saldo subiu %, esperado %', v_ole_depois - v_ole_antes, v_esperado;
      end if;

      if exists (
        select 1 from public.global_league_season_champions sc
        join auth.users u on lower(u.email) = lower(sc.manager_id)
        where u.id = v_uid and not sc.claimed
      ) then
        raise exception 'sobrou título não marcado para quem foi pago';
      end if;

      if not exists (
        select 1 from public.manager_game_state
         where user_id = v_uid
           and (inbox -> 0 ->> 'id') = 'season-champ-backlog-' || v_uid::text
           and jsonb_array_length(inbox) between 1 and 14
      ) then
        raise exception 'inbox não recebeu o aviso (ou estourou 14)';
      end if;

      if not exists (
        select 1 from public.manager_game_state
         where user_id = v_uid
           and jsonb_array_length(finance -> 'expHistory') <= 120
           and (finance -> 'expHistory' -> 0 ->> 'source') like 'Campeão Div %'
      ) then
        raise exception 'expHistory não recebeu a linha do título';
      end if;

      -- Pagar de novo não paga duas vezes.
      select count(*)::int into v_linhas from public.pay_season_champion_backlog(30)
       where pay_season_champion_backlog.user_id = v_uid;
      if v_linhas <> 0 then
        raise exception 'segunda chamada pagou o mesmo manager de novo';
      end if;

      raise notice 'verificação: pagou % no total; % → % pendentes', v_total, v_pend_antes,
        (select count(*) from public.global_league_season_champions where not claimed);
    end if;

    raise exception 'zz_verifica_ok';
  exception when others then
    v_msg := sqlerrm;
    if v_msg <> 'zz_verifica_ok' then
      raise exception 'verificação do pagamento falhou: %', v_msg;
    end if;
  end;

  select count(*) into v_pend_depois from public.global_league_season_champions where not claimed;
  if v_pend_depois <> v_pend_antes then
    raise exception 'a verificação deixou rastro: pendentes % → %', v_pend_antes, v_pend_depois;
  end if;

  raise notice 'verificação: ok — credita e marca juntos, não paga duas vezes, não deixou rastro';
end $$;
