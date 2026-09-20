-- ════════════════════════════════════════════════════════════════════════════
-- O prêmio atrasado passa a ser pago PELO SERVIDOR
-- ════════════════════════════════════════════════════════════════════════════
-- O fundador decidiu pagar o acumulado do Mata-Mata da Liga Global. Medido em
-- 2026-09-20, um dia depois de a decisão entrar no ar:
--
--     4.207 prêmios   ·   230 pagos   ·   3.977 pendentes
--     230 pagos pertencem a UM único manager (o do fundador).
--     666.050.000 EXP parados, devidos a 77 destinos.
--
-- Não é bug de cálculo: é o desenho. `claim_my_ko_prizes()` só roda quando o
-- manager ABRE o jogo — e o prêmio existe justamente pra trazer de volta quem
-- não está abrindo. Dos 77 destinos, 3 salvaram nos últimos 7 dias. O prêmio
-- vira uma porta trancada por dentro.
--
-- 🔴 E tem um furo junto: `claim_my_ko_prizes()` marca `claimed = true` e
-- devolve as linhas — quem CREDITA é o cliente, depois, num dispatch do
-- reducer. Se o navegador fechar entre uma coisa e outra, o prêmio fica
-- marcado como pago e o EXP não entra em lugar nenhum. Some.
--
-- Esta função faz as duas coisas na MESMA transação: credita o saldo e marca
-- o prêmio. Ou acontecem juntas, ou nenhuma acontece.
--
-- O crédito espelha exatamente `CLAIM_KO_PRIZE` (src/game/reducer.ts:3615):
--   · `finance.ole` += prêmio          (`ole` é o saldo de EXP gastável — o
--                                        nome é legado, ver entities/types.ts)
--   · `finance.expLifetimeEarned` += prêmio
--   · uma linha em `finance.expHistory` (a lista tem teto de 120 no cliente)
--
-- Duas diferenças conscientes em relação ao cliente, ambas por causa do teto:
--   1. UMA linha de histórico com o total, não uma por prêmio. O maior devedor
--      tem 192 prêmios; 192 linhas empurrariam pra fora todo o histórico
--      anterior dele.
--   2. UM item de inbox resumindo, que é o que o cliente já faz quando são
--      mais de 3 prêmios (PRIZE_INBOX_SUMMARY_OVER).
-- `clubRenown` (+50/+10 por fase) fica de fora: não é persistido no servidor.
--
-- Corrida com quem está jogando AGORA: o saldo é escrito pelo cliente (ele
-- salva o `finance` inteiro), então creditar embaixo de uma sessão aberta
-- seria escrever algo que o próximo save apaga. Por isso `p_idle_minutes`:
-- só paga quem não salva há N minutos. Medido antes de aplicar: 0 dos 76
-- salvaram nos últimos 30 min.

create or replace function public.pay_ko_prize_backlog(
  p_idle_minutes int default 30
)
returns table (
  manager_id   text,
  user_id      uuid,
  premios      int,
  exp_pago     bigint,
  saldo_antes  numeric,
  saldo_depois numeric
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r        record;
  v_ids    text[];
  v_n      int;
  v_total  bigint;
  v_fin    jsonb;
  v_inbox  jsonb;
  v_ole    numeric;
  v_life   numeric;
  v_hist   jsonb;
  v_now    text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  for r in
    select k.manager_id as mid, u.id as uid
      from public.global_league_ko_prizes k
      join auth.users u              on lower(u.email) = lower(k.manager_id)
      join public.manager_game_state m on m.user_id = u.id
     where k.claimed = false
       and k.prize_exp > 0
       and m.updated_at < now() - make_interval(mins => greatest(p_idle_minutes, 0))
     group by k.manager_id, u.id
     order by k.manager_id
  loop
    -- Trava os prêmios deste manager antes de somar: se o cliente dele chamar
    -- claim_my_ko_prizes() no meio, um dos dois espera o outro.
    -- `gp.` obrigatório: `manager_id` também é nome de parâmetro de saída
    -- desta função, e sem qualificar o Postgres recusa por ambiguidade.
    with travados as (
      select gp.id, gp.prize_exp
        from public.global_league_ko_prizes gp
       where lower(gp.manager_id) = lower(r.mid)
         and gp.claimed = false
         and gp.prize_exp > 0
       for update
    )
    select coalesce(array_agg(id), '{}'), count(*)::int, coalesce(sum(prize_exp), 0)::bigint
      into v_ids, v_n, v_total
      from travados;

    continue when v_n = 0;

    select mgs.finance, coalesce(mgs.inbox, '[]'::jsonb)
      into v_fin, v_inbox
      from public.manager_game_state mgs
     where mgs.user_id = r.uid
     for update;

    -- Manager com estado salvo mas sem `finance` (11 dos 76): começa do estado
    -- inicial do jogo (src/game/initialState.ts:59 — tudo zero), não de um
    -- saldo inventado.
    v_fin  := coalesce(v_fin, jsonb_build_object('ole', 0, 'broCents', 0, 'expLifetimeEarned', 0));
    v_ole  := coalesce(public.jsonb_num(v_fin, 'ole'), 0);
    v_life := coalesce(public.jsonb_num(v_fin, 'expLifetimeEarned'), 0);
    v_hist := case when jsonb_typeof(v_fin -> 'expHistory') = 'array'
                   then v_fin -> 'expHistory' else '[]'::jsonb end;

    v_hist := jsonb_build_array(jsonb_build_object(
      'id',        'exp-backlog-' || r.uid::text,
      'amount',    v_total,
      'source',    'Mata-Mata · prêmios acumulados · EXP',
      'createdAt', v_now
    )) || v_hist;
    if jsonb_array_length(v_hist) > 120 then
      v_hist := (select jsonb_agg(e order by i)
                   from jsonb_array_elements(v_hist) with ordinality t(e, i)
                  where i <= 120);
    end if;

    v_inbox := jsonb_build_array(jsonb_build_object(
      'id',          'league-prizes-backlog-' || r.uid::text,
      'messageType', 'FINANCE_EXP_GAIN',
      'category',    'COMPETIÇÃO',
      'tag',         'COMPETIÇÃO',
      'title',       '🏆 Prêmios da Liga Global creditados',
      -- O separador de milhar do to_char segue o lc_numeric do banco; o
      -- jogo escreve em pt-BR. O replace deixa ponto nos dois casos.
      'body',        v_n || ' fase(s) de mata-mata. Total: +'
                       || replace(to_char(v_total, 'FM999G999G999G999'), ',', '.') || ' EXP.',
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
       set finance = v_fin
                     || jsonb_build_object('ole', v_ole + v_total)
                     || jsonb_build_object('expLifetimeEarned', v_life + v_total)
                     || jsonb_build_object('expHistory', v_hist),
           inbox   = v_inbox
     where manager_game_state.user_id = r.uid;

    update public.global_league_ko_prizes gp
       set claimed = true
     where gp.id = any(v_ids);

    manager_id   := r.mid;
    user_id      := r.uid;
    premios      := v_n;
    exp_pago     := v_total;
    saldo_antes  := v_ole;
    saldo_depois := v_ole + v_total;
    return next;
  end loop;
end;
$function$;

comment on function public.pay_ko_prize_backlog(int) is
  'Paga o acumulado do Mata-Mata da Liga Global pelo servidor: credita o saldo '
  'e marca claimed na MESMA transação. Só service_role. Pula quem salvou nos '
  'últimos p_idle_minutes (o saldo é escrito pelo cliente). '
  'Ver 20260920010000_pagar_premio_atrasado_no_servidor.sql.';

revoke execute on function public.pay_ko_prize_backlog(int) from public, anon, authenticated;
grant  execute on function public.pay_ko_prize_backlog(int) to service_role;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — paga de verdade, confere o resultado e desfaz o próprio rastro
-- ════════════════════════════════════════════════════════════════════════════
-- O sub-bloco termina levantando 'zz_verifica_ok'; o handler captura e o
-- Postgres desfaz tudo. Nenhum prêmio fica pago por causa da verificação.
do $$
declare
  v_pend_antes   int;
  v_pend_depois  int;
  v_linhas       int;
  v_exp          bigint;
  v_uid          uuid;
  v_ole_antes    numeric;
  v_ole_depois   numeric;
  v_esperado     bigint;
  v_msg          text;
begin
  if has_function_privilege('authenticated', 'public.pay_ko_prize_backlog(int)', 'EXECUTE')
     or has_function_privilege('anon', 'public.pay_ko_prize_backlog(int)', 'EXECUTE') then
    raise exception 'cliente consegue executar pay_ko_prize_backlog';
  end if;
  if not has_function_privilege('service_role', 'public.pay_ko_prize_backlog(int)', 'EXECUTE') then
    raise exception 'service_role não executa pay_ko_prize_backlog';
  end if;

  select count(*) into v_pend_antes from public.global_league_ko_prizes where not claimed;

  begin
    -- Escolhe um manager pagável e guarda o saldo dele ANTES.
    select u.id, coalesce(public.jsonb_num(m.finance, 'ole'), 0)
      into v_uid, v_ole_antes
      from public.global_league_ko_prizes k
      join auth.users u               on lower(u.email) = lower(k.manager_id)
      join public.manager_game_state m on m.user_id = u.id
     where k.claimed = false and k.prize_exp > 0
       and m.updated_at < now() - interval '30 minutes'
     limit 1;

    if v_uid is null then
      raise notice 'verificação: ninguém pagável agora (ninguém ocioso com prêmio) — função criada mesmo assim';
    else
      select coalesce(sum(k.prize_exp), 0)::bigint into v_esperado
        from public.global_league_ko_prizes k
        join auth.users u on lower(u.email) = lower(k.manager_id)
       where u.id = v_uid and k.claimed = false and k.prize_exp > 0;

      select count(*)::int, coalesce(sum(exp_pago), 0)::bigint
        into v_linhas, v_exp
        from public.pay_ko_prize_backlog(30);

      if v_linhas = 0 then
        raise exception 'a função não pagou ninguém, mas havia manager pagável';
      end if;

      -- 1. o saldo subiu exatamente o valor dos prêmios daquele manager
      select coalesce(public.jsonb_num(finance, 'ole'), 0) into v_ole_depois
        from public.manager_game_state where user_id = v_uid;
      if v_ole_depois - v_ole_antes is distinct from v_esperado::numeric then
        raise exception 'saldo subiu % , esperado %', v_ole_depois - v_ole_antes, v_esperado;
      end if;

      -- 2. os prêmios daquele manager ficaram marcados
      if exists (
        select 1 from public.global_league_ko_prizes k
        join auth.users u on lower(u.email) = lower(k.manager_id)
        where u.id = v_uid and not k.claimed and k.prize_exp > 0
      ) then
        raise exception 'sobrou prêmio não marcado para quem foi pago';
      end if;

      -- 3. o histórico e o inbox ganharam a linha, sem estourar o teto
      if not exists (
        select 1 from public.manager_game_state
         where user_id = v_uid
           and jsonb_array_length(finance -> 'expHistory') between 1 and 120
           and (finance -> 'expHistory' -> 0 ->> 'source') = 'Mata-Mata · prêmios acumulados · EXP'
      ) then
        raise exception 'expHistory não recebeu a linha do prêmio (ou estourou 120)';
      end if;
      if not exists (
        select 1 from public.manager_game_state
         where user_id = v_uid
           and jsonb_array_length(inbox) between 1 and 14
           and (inbox -> 0 ->> 'id') = 'league-prizes-backlog-' || v_uid::text
      ) then
        raise exception 'inbox não recebeu o aviso (ou estourou 14)';
      end if;

      -- 4. pagar de novo não paga duas vezes
      select count(*)::int into v_linhas from public.pay_ko_prize_backlog(30)
       where pay_ko_prize_backlog.user_id = v_uid;
      if v_linhas <> 0 then
        raise exception 'segunda chamada pagou o mesmo manager de novo';
      end if;

      select count(*) into v_pend_depois from public.global_league_ko_prizes where not claimed;
      raise notice 'verificação: pagou % EXP; pendentes % → %', v_exp, v_pend_antes, v_pend_depois;
    end if;

    raise exception 'zz_verifica_ok';
  exception when others then
    v_msg := sqlerrm;
    if v_msg <> 'zz_verifica_ok' then
      raise exception 'verificação do pagamento falhou: %', v_msg;
    end if;
  end;

  -- Depois do rollback do sub-bloco, nada pode ter mudado.
  select count(*) into v_pend_depois from public.global_league_ko_prizes where not claimed;
  if v_pend_depois <> v_pend_antes then
    raise exception 'a verificação deixou rastro: pendentes % → %', v_pend_antes, v_pend_depois;
  end if;

  raise notice 'verificação: ok — credita e marca juntos, não paga duas vezes, não deixou rastro';
end $$;
