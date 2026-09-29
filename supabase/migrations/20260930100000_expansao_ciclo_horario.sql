-- ═══════════════════════════════════════════════════════════════════════════
-- EXPANSÃO — o ciclo horário da equiparação
--
-- Até aqui o OLEXP entrava nas pernas e ficava lá: não existia quem fechasse
-- ciclo. "OLEXP acumula e nunca vira bônus" (docs/RELATORIO-LANCAMENTO.md).
-- Esta migration é o fechamento, espelhando `server/src/lib/expansao/
-- equiparacao.ts` regra por regra:
--
--   equiparado = MIN(Time 1, Time 2), debitado dos DOIS lados
--   pool       = 25% da receita elegível da hora
--   valor      = pool ÷ equiparado total (em micro-centavos de dólar por OLEXP)
--   bônus      = equiparado × valor
--
-- E as três travas do motor:
--   · ciclo SEM POOL não liquida: fica HELD e não debita ninguém. Equiparar
--     sem pool trocaria OLEXP por nada;
--   · quem não tem 1 indicado direto em CADA time fica RETIDO: o saldo não é
--     debitado, só registrado, e equipara inteiro quando ativar;
--   · a carreira soma o que foi PAGO (`expansao_somar_equiparado`).
--
-- 🔑 RECEITA ELEGÍVEL = compras de pré-venda PAGAS na janela, em centavos de
-- dólar. É a única fonte que gera equiparação hoje (`compra_olefoot`), e é a
-- régua de docs/TOKENOMICS.md ("25% da receita de $10.000"). Receita de card,
-- depósito e compra na DEX não entra.
--
-- 🔑 PREÇO DE REFERÊNCIA = o da pré-venda, $0,000125 por OLEFOOT, gravado em
-- cada ciclo. É por ele que o bônus vira token no claim, e gravar no ciclo é
-- o que impede alguém de sentar no bônus esperando o preço cair.
--   $0,000125 = 0,0125 centavo = 12.500 micro-centavos.
-- Espelha PRECO_USD_POR_TOKEN em server/src/lib/presale/packs.ts.
--
-- Unidades, todas inteiras:
--   receita, pool, bonus_contabil ........ centavos de dólar
--   valor_por_olexp_micro, preco_micro ... micro-centavos (1e-6 centavo)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── quem está ativo, sem trava de sessão ─────────────────────────────────
-- `expansao_ativacao` é a leitura da TELA e só responde pro dono. O ciclo
-- precisa perguntar de todo mundo, então tem a sua — mesma regra, fechada
-- pro cliente.
create or replace function public.expansao_ativo_interno(p_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  with diretos as (
    select coalesce(
             (select n2.lado from expansao_no n2
               where n2.user_id = d.posicao_path[array_position(d.posicao_path, p_user) + 1]),
             d.lado
           ) as perna
      from expansao_no d
     where d.patrocinador_id = p_user
       and p_user = any(d.posicao_path)
  )
  select count(*) filter (where perna = 1) >= 1
     and count(*) filter (where perna = 2) >= 1
    from diretos;
$$;

revoke all on function public.expansao_ativo_interno(uuid) from public, anon, authenticated;
grant execute on function public.expansao_ativo_interno(uuid) to service_role;

-- ─── a receita da janela ──────────────────────────────────────────────────
create or replace function public.expansao_receita_da_janela(p_abre timestamptz, p_fecha timestamptz)
returns numeric language sql stable security definer set search_path = public
as $$
  select coalesce(sum(usd_cents), 0)::numeric
    from presale_purchase
   where status = 'pago' and paga_em >= p_abre and paga_em < p_fecha;
$$;

revoke all on function public.expansao_receita_da_janela(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.expansao_receita_da_janela(timestamptz, timestamptz) to service_role;

-- ─── fechar UM ciclo ──────────────────────────────────────────────────────
-- Idempotente pela janela: `expansao_ciclo_janela_unica` em `abre_em`. Fechar
-- de novo a mesma hora devolve o ciclo que já existe e não mexe em nada.
create or replace function public.expansao_fechar_ciclo(
  p_abre timestamptz,
  p_percentual_bps integer default 2500,
  p_preco_micro numeric default 12500
)
returns table (ciclo_id bigint, status text, pool numeric, equiparado_total numeric, pessoas integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_fecha timestamptz := p_abre + interval '1 hour';
  v_existe record;
  v_receita numeric;
  v_pool numeric;
  v_total numeric := 0;
  v_valor numeric;
  v_ciclo bigint;
  v_n integer := 0;
  v_r record;
  v_soma_eq numeric;
  v_soma_bonus numeric;
begin
  if p_abre <> date_trunc('hour', p_abre) then
    raise exception 'ciclo tem que abrir na hora cheia: %', p_abre;
  end if;
  if v_fecha > now() then
    raise exception 'ciclo de % ainda não terminou', p_abre;
  end if;
  if p_preco_micro is null or p_preco_micro <= 0 then
    raise exception 'preço de referência inválido: %', p_preco_micro;
  end if;

  select c.id, c.status, c.pool, c.equiparado_total into v_existe
    from expansao_ciclo c where c.abre_em = p_abre;
  if found then
    return query select v_existe.id, v_existe.status, v_existe.pool, v_existe.equiparado_total, 0;
    return;
  end if;

  v_receita := public.expansao_receita_da_janela(p_abre, v_fecha);
  -- Arredonda pra BAIXO: a casa nunca promete mais do que arrecadou.
  v_pool := floor(v_receita * p_percentual_bps / 10000);

  -- Quem tem volume nos DOIS times, com o que equiparia. Trava as linhas das
  -- pernas: um crédito que chegue no meio espera o fechamento terminar.
  create temp table if not exists _expansao_eq (
    user_id uuid primary key, t1 numeric, t2 numeric, eq numeric, ativo boolean
  ) on commit drop;
  truncate _expansao_eq;

  insert into _expansao_eq (user_id, t1, t2, eq, ativo)
  select p.user_id,
         coalesce(sum(p.volume) filter (where p.lado = 1), 0),
         coalesce(sum(p.volume) filter (where p.lado = 2), 0),
         0, false
    from expansao_perna p
   where p.trilho = 'equiparacao'
   group by p.user_id
  having coalesce(sum(p.volume) filter (where p.lado = 1), 0) > 0
     and coalesce(sum(p.volume) filter (where p.lado = 2), 0) > 0;

  perform 1 from expansao_perna p
   where p.trilho = 'equiparacao' and p.user_id in (select e.user_id from _expansao_eq e)
     for update;

  update _expansao_eq e
     set ativo = public.expansao_ativo_interno(e.user_id),
         eq = least(e.t1, e.t2);
  update _expansao_eq e set eq = 0 where not e.ativo;

  select coalesce(sum(e.eq), 0) into v_total from _expansao_eq e;

  -- ── sem o que equiparar, ou sem pool: HELD, ninguém é debitado ──
  if v_total = 0 or v_pool = 0 then
    insert into expansao_ciclo (abre_em, fecha_em, status, receita_menor_unid, percentual_bps,
                                pool, equiparado_total, valor_por_olexp_micro, preco_micro,
                                motivo, fechado_em)
    values (p_abre, v_fecha, 'HELD', v_receita, p_percentual_bps, v_pool, v_total, null,
            p_preco_micro,
            case when v_total = 0 then 'nada a equiparar neste ciclo'
                 else 'ciclo sem receita elegível — equiparação retida para o próximo ciclo com pool' end,
            now())
    returning id into v_ciclo;
    return query select v_ciclo, 'HELD'::text, v_pool, v_total, 0;
    return;
  end if;

  -- ── liquida ──
  v_valor := floor(v_pool * 1000000 / v_total);

  insert into expansao_ciclo (abre_em, fecha_em, status, receita_menor_unid, percentual_bps,
                              pool, equiparado_total, valor_por_olexp_micro, preco_micro,
                              motivo, fechado_em)
  values (p_abre, v_fecha, 'SETTLED', v_receita, p_percentual_bps, v_pool, v_total, v_valor,
          p_preco_micro, null, now())
  returning id into v_ciclo;

  for v_r in select * from _expansao_eq e order by e.user_id loop
    if v_r.ativo and v_r.eq > 0 then
      update expansao_perna p
         set volume = p.volume - v_r.eq
       where p.user_id = v_r.user_id and p.trilho = 'equiparacao';
      insert into expansao_liquidacao (ciclo_id, user_id, equiparado, sobra_t1, sobra_t2,
                                       bonus_contabil, retido_inativo)
      values (v_ciclo, v_r.user_id, v_r.eq, v_r.t1 - v_r.eq, v_r.t2 - v_r.eq,
              floor(v_r.eq * v_valor / 1000000), false);
      perform public.expansao_somar_equiparado(v_r.user_id, v_r.eq);
      v_n := v_n + 1;
    else
      -- Retido por inatividade: registrado, nada debitado.
      insert into expansao_liquidacao (ciclo_id, user_id, equiparado, sobra_t1, sobra_t2,
                                       bonus_contabil, retido_inativo)
      values (v_ciclo, v_r.user_id, 0, v_r.t1, v_r.t2, 0, true);
    end if;
  end loop;

  -- ── confere antes de sair: a soma por pessoa é o total, e ninguém recebe
  --    mais do que o pool. Se falhar, o ciclo inteiro volta atrás.
  select coalesce(sum(l.equiparado), 0), coalesce(sum(l.bonus_contabil), 0)
    into v_soma_eq, v_soma_bonus
    from expansao_liquidacao l where l.ciclo_id = v_ciclo;
  if v_soma_eq <> v_total then
    raise exception 'ciclo %: equiparado por pessoa (%) ≠ total (%)', v_ciclo, v_soma_eq, v_total;
  end if;
  if v_soma_bonus > v_pool then
    raise exception 'ciclo %: bônus (%) acima do pool (%)', v_ciclo, v_soma_bonus, v_pool;
  end if;

  return query select v_ciclo, 'SETTLED'::text, v_pool, v_total, v_n;
end;
$$;

revoke all on function public.expansao_fechar_ciclo(timestamptz, integer, numeric) from public, anon, authenticated;
grant execute on function public.expansao_fechar_ciclo(timestamptz, integer, numeric) to service_role;

-- ─── fechar TODAS as horas pendentes ──────────────────────────────────────
-- É o que o cron chama. Começa na hora seguinte ao último ciclo — ou, se
-- nunca houve ciclo, na hora do primeiro OLEXP. Sem OLEXP nenhum, não há o
-- que fechar e não cria linha.
--
-- Teto por execução: se o cron ficar parado um dia, a volta fecha 48 horas por
-- vez, em ordem, em vez de uma transação gigante.
create or replace function public.expansao_fechar_ciclos_pendentes(p_max integer default 48)
returns integer language plpgsql security definer set search_path = public
as $$
declare
  v_hora timestamptz;
  v_n integer := 0;
begin
  -- Um fechamento por vez. Dois crons sobrepostos debitariam a mesma perna.
  if not pg_try_advisory_xact_lock(hashtext('expansao_fechar_ciclos')) then
    return 0;
  end if;

  select max(c.abre_em) + interval '1 hour' into v_hora from expansao_ciclo c;
  if v_hora is null then
    select date_trunc('hour', min(o.criado_em)) into v_hora from expansao_olexp o;
  end if;
  if v_hora is null then return 0; end if;

  while v_hora + interval '1 hour' <= now() and v_n < p_max loop
    perform public.expansao_fechar_ciclo(v_hora);
    v_hora := v_hora + interval '1 hour';
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.expansao_fechar_ciclos_pendentes(integer) from public, anon, authenticated;
grant execute on function public.expansao_fechar_ciclos_pendentes(integer) to service_role;

-- ─── o que a tela lê: o meu bônus ─────────────────────────────────────────
-- Soma o que já foi liquidado pra quem está logado, e converte pra OLEFOOT
-- pelo preço gravado EM CADA CICLO — nunca pelo de hoje.
create or replace function public.expansao_meu_bonus()
returns table (bonus_usd_cents numeric, olefoot numeric, olefoot_sacado numeric,
               ciclos_pagos integer, perna_padrao smallint)
language sql stable security definer set search_path = public
as $$
  with eu as (select auth.uid() as uid),
  l as (
    select coalesce(sum(li.bonus_contabil), 0) as usd,
           coalesce(sum(floor(li.bonus_contabil * 1000000 / c.preco_micro)), 0) as tok,
           count(*) filter (where li.bonus_contabil > 0)::int as n
      from expansao_liquidacao li
      join expansao_ciclo c on c.id = li.ciclo_id
     where li.user_id = (select uid from eu)
  ),
  s as (
    select coalesce(sum(cl.olefoot_liquido), 0) as tok
      from expansao_claim cl
     where cl.user_id = (select uid from eu) and cl.status in ('aprovado', 'pago')
  )
  select l.usd, l.tok, s.tok, l.n,
         (select n.perna_padrao from expansao_no n where n.user_id = (select uid from eu))
    from l, s
   where (select uid from eu) is not null;
$$;

revoke all on function public.expansao_meu_bonus() from public, anon;
grant execute on function public.expansao_meu_bonus() to authenticated, service_role;

-- ─── o time que recebe o próximo indicado ─────────────────────────────────
-- null = automático (a perna com menos indicados diretos, `expansao_perna_alvo`).
-- Age sobre `auth.uid()`: ninguém escolhe o lado de outra pessoa.
create or replace function public.expansao_definir_perna_padrao(p_lado smallint)
returns smallint language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;
  if p_lado is not null and p_lado not in (1, 2) then
    raise exception 'lado inválido: %', p_lado;
  end if;
  update expansao_no set perna_padrao = p_lado where user_id = v_uid;
  if not found then raise exception 'fora_da_arvore'; end if;
  return p_lado;
end;
$$;

revoke all on function public.expansao_definir_perna_padrao(smallint) from public, anon;
grant execute on function public.expansao_definir_perna_padrao(smallint) to authenticated, service_role;

-- ─── o relógio ────────────────────────────────────────────────────────────
-- Minuto 5 de toda hora: dá folga pro Pix confirmado às 10:59:59 terminar de
-- gravar antes de a hora 10 fechar.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'expansao-ciclo-horario') then
      perform cron.unschedule('expansao-ciclo-horario');
    end if;
    perform cron.schedule('expansao-ciclo-horario', '5 * * * *',
                          'select public.expansao_fechar_ciclos_pendentes()');
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — roda junto e derruba tudo se falhar
-- ════════════════════════════════════════════════════════════════════════════
-- Monta uma rede mínima dentro de um savepoint, fecha um ciclo com pool e um
-- sem, confere débito, bônus e carreira, e desfaz tudo com um `raise` — nem o
-- livro append-only fica com linha de teste.
do $$
declare
  v_chegou boolean := false;
  v_raiz uuid; v_a uuid; v_b uuid; v_c uuid;
  v_hora timestamptz := date_trunc('hour', now()) - interval '400 days';
  v_r record;
  v_n numeric;
begin
  select id into v_raiz from auth.users order by created_at limit 1;
  select id into v_a from auth.users where id <> v_raiz order by created_at limit 1;
  select id into v_b from auth.users where id not in (v_raiz, v_a) order by created_at limit 1;
  select id into v_c from auth.users where id not in (v_raiz, v_a, v_b) order by created_at limit 1;
  if v_c is null then
    raise notice 'menos de 4 contas neste ambiente: verificação do ciclo pulada';
    return;
  end if;

  begin
    -- Isola da árvore real: a verificação monta a sua e apaga a de verdade
    -- só dentro do savepoint.
    delete from expansao_liquidacao;
    delete from expansao_ciclo;
    delete from expansao_perna;
    delete from expansao_confirmacao;
    delete from expansao_no;

    perform public.expansao_inserir(v_raiz, null, null, null);
    perform public.expansao_inserir(v_a, v_raiz, v_raiz, 1::smallint);
    perform public.expansao_inserir(v_b, v_raiz, v_raiz, 2::smallint);

    -- Time 1 compra $30, Time 2 compra $10 → raiz equipara 10
    perform public.expansao_creditar(v_a, 30, 'compra_olefoot', 'verifica-ciclo-a');
    perform public.expansao_creditar(v_b, 10, 'compra_olefoot', 'verifica-ciclo-b');

    -- 1. sem receita na janela: HELD, nada debitado
    select * into v_r from public.expansao_fechar_ciclo(v_hora);
    if v_r.status <> 'HELD' then raise exception 'ciclo sem receita não ficou HELD: %', v_r.status; end if;
    select volume into v_n from expansao_perna where user_id = v_raiz and lado = 2 and trilho = 'equiparacao';
    if v_n <> 10 then raise exception 'ciclo HELD debitou a perna: %', v_n; end if;

    -- 2. com receita de $40: pool $10 (1000 centavos), equipara 10, bônus 1000
    insert into presale_purchase (user_id, ref, usd_cents, brl_cents, brl_por_usd_micro,
                                  tokens_entregues, tokens_brutos, status, criada_em, paga_em)
    values (v_a, 'verifica-ciclo-pp', 4000, 22000, 5500000, 1, 2, 'pago',
            v_hora + interval '1 hour 10 minutes', v_hora + interval '1 hour 10 minutes');
    select * into v_r from public.expansao_fechar_ciclo(v_hora + interval '1 hour');
    if v_r.status <> 'SETTLED' or v_r.pool <> 1000 or v_r.equiparado_total <> 10 then
      raise exception 'ciclo com receita: status % pool % total %', v_r.status, v_r.pool, v_r.equiparado_total;
    end if;
    select bonus_contabil into v_n from expansao_liquidacao where user_id = v_raiz;
    if v_n <> 1000 then raise exception 'bônus da raiz: % (esperava 1000)', v_n; end if;
    select volume into v_n from expansao_perna where user_id = v_raiz and lado = 1 and trilho = 'equiparacao';
    if v_n <> 20 then raise exception 'sobra do Time 1: % (esperava 20)', v_n; end if;
    select equiparado_acumulado into v_n from expansao_no where user_id = v_raiz;
    if v_n <> 10 then raise exception 'carreira não somou o pago: %', v_n; end if;
    select volume into v_n from expansao_perna where user_id = v_raiz and lado = 1 and trilho = 'qualificacao';
    if v_n <> 30 then raise exception 'o ciclo mexeu no trilho de qualificação: %', v_n; end if;

    -- 3. fechar a mesma hora de novo não paga de novo
    perform public.expansao_fechar_ciclo(v_hora + interval '1 hour');
    select count(*) into v_n from expansao_liquidacao where user_id = v_raiz;
    if v_n <> 1 then raise exception 'fechar duas vezes gerou % liquidações', v_n; end if;

    v_chegou := true;
    raise exception 'DESFAZ_A_VERIFICACAO';
  exception when others then
    if sqlerrm <> 'DESFAZ_A_VERIFICACAO' then raise; end if;
  end;

  if not v_chegou then raise exception 'a verificação do ciclo não chegou ao fim'; end if;
  if exists (select 1 from expansao_olexp where ref like 'verifica-ciclo-%')
     or exists (select 1 from presale_purchase where ref = 'verifica-ciclo-pp') then
    raise exception 'a verificação do ciclo deixou rastro';
  end if;
end $$;
