-- ═══════════════════════════════════════════════════════════════════════════
-- EXPANSÃO — ponto a $0,25 fixo e teto de $2.500 por pessoa por dia
--
-- Decisão do fundador (2026-09-30):
--   "pode manter o valor do ponto em $1 dólar = $0,25 valor pago pelo ponto"
--   "vamos criar um limitador diário de ganhos na OLEFOOT de $2500"
--
-- Até aqui o valor do ponto era pool da hora ÷ equiparado da hora. Isso tinha
-- dois defeitos medidos na simulação de 2026-09-30:
--   · uma hora com um único pack de $10 (pool $2,50) consumia os pontos
--     acumulados de todo mundo por centavos;
--   · uma hora forte com pouca gente equiparando pagava mais de $1 por ponto.
--
-- Agora, espelhando `server/src/lib/expansao/equiparacao.ts`:
--   bônus bruto = equiparado × $0,25
--   bônus pago  = o que cabe no teto do dia (São Paulo), $2.500 − já recebido
--   cortado     = bruto − pago, REGISTRADO em `expansao_liquidacao.cortado_teto`
--
-- 🔴 O excedente do teto não volta: o time menor é equiparado inteiro, como
-- sempre. Guardar o excedente pra outro dia faria o saldo devido crescer sem
-- fim — num binário nasce mais ponto do que dinheiro.
--
-- 🔑 A hora não precisa mais ter receita pra pagar: os pontos vieram de compras
-- de horas anteriores e o valor é fixo. HELD só quando ninguém equipara.
-- O pool (25% da receita da hora) continua gravado como régua do que entrou.
--
-- 🔑 O pagamento deixa de ter como teto a receita da hora. O que segura a
-- emissão é o teto por pessoa. `bonus_total` por ciclo fica gravado pra essa
-- conta ser olhada todo dia.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.expansao_liquidacao
  add column if not exists cortado_teto numeric(78,0) not null default 0 check (cortado_teto >= 0);
alter table public.expansao_ciclo
  add column if not exists bonus_total   numeric(78,0) not null default 0 check (bonus_total >= 0),
  add column if not exists cortado_total numeric(78,0) not null default 0 check (cortado_total >= 0),
  add column if not exists teto_diario   numeric(78,0);
create index if not exists expansao_liquidacao_user on public.expansao_liquidacao (user_id, ciclo_id);

comment on column public.expansao_ciclo.valor_por_olexp_micro is
  'Micro-centavos de dólar por OLEXP. Desde 2026-09-30 é fixo: 25.000.000 = $0,25.';
comment on column public.expansao_liquidacao.cortado_teto is
  'Centavos de dólar que passaram do teto diário e NÃO foram pagos.';

-- ─── o dia do teto ────────────────────────────────────────────────────────
create or replace function public.expansao_dia_do_teto(p_quando timestamptz)
returns date language sql immutable set search_path = public
as $$ select (p_quando at time zone 'America/Sao_Paulo')::date $$;
revoke all on function public.expansao_dia_do_teto(timestamptz) from public, anon, authenticated;
grant execute on function public.expansao_dia_do_teto(timestamptz) to service_role;

-- ─── fechar UM ciclo ──────────────────────────────────────────────────────
drop function if exists public.expansao_fechar_ciclo(timestamptz, integer, numeric);

create or replace function public.expansao_fechar_ciclo(
  p_abre timestamptz,
  p_percentual_bps integer default 2500,
  p_preco_micro numeric default 12500,
  p_valor_ponto_micro numeric default 25000000,
  p_teto_diario numeric default 250000
)
returns table (ciclo_id bigint, status text, pool numeric, equiparado_total numeric, pessoas integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_fecha timestamptz := p_abre + interval '1 hour';
  v_dia date := public.expansao_dia_do_teto(p_abre);
  v_existe record;
  v_receita numeric;
  v_pool numeric;
  v_total numeric := 0;
  v_ciclo bigint;
  v_n integer := 0;
  v_r record;
  v_bruto numeric;
  v_ja numeric;
  v_pago numeric;
  v_soma_eq numeric;
  v_soma_pago numeric;
  v_soma_cortado numeric;
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
  if p_valor_ponto_micro is null or p_valor_ponto_micro <= 0 then
    raise exception 'valor do ponto inválido: %', p_valor_ponto_micro;
  end if;
  if p_teto_diario is null or p_teto_diario < 0 then
    raise exception 'teto diário inválido: %', p_teto_diario;
  end if;

  select c.id, c.status, c.pool, c.equiparado_total into v_existe
    from expansao_ciclo c where c.abre_em = p_abre;
  if found then
    return query select v_existe.id, v_existe.status, v_existe.pool, v_existe.equiparado_total, 0;
    return;
  end if;

  v_receita := public.expansao_receita_da_janela(p_abre, v_fecha);
  v_pool := floor(v_receita * p_percentual_bps / 10000);

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

  -- ── ninguém equipara: HELD, ninguém é debitado ──
  if v_total = 0 then
    insert into expansao_ciclo (abre_em, fecha_em, status, receita_menor_unid, percentual_bps,
                                pool, equiparado_total, valor_por_olexp_micro, preco_micro,
                                motivo, fechado_em, teto_diario)
    values (p_abre, v_fecha, 'HELD', v_receita, p_percentual_bps, v_pool, 0, null,
            p_preco_micro, 'nada a equiparar neste ciclo', now(), p_teto_diario)
    returning id into v_ciclo;
    return query select v_ciclo, 'HELD'::text, v_pool, 0::numeric, 0;
    return;
  end if;

  insert into expansao_ciclo (abre_em, fecha_em, status, receita_menor_unid, percentual_bps,
                              pool, equiparado_total, valor_por_olexp_micro, preco_micro,
                              motivo, fechado_em, teto_diario)
  values (p_abre, v_fecha, 'SETTLED', v_receita, p_percentual_bps, v_pool, v_total,
          p_valor_ponto_micro, p_preco_micro, null, now(), p_teto_diario)
  returning id into v_ciclo;

  for v_r in select * from _expansao_eq e order by e.user_id loop
    if v_r.ativo and v_r.eq > 0 then
      update expansao_perna p
         set volume = p.volume - v_r.eq
       where p.user_id = v_r.user_id and p.trilho = 'equiparacao';

      v_bruto := floor(v_r.eq * p_valor_ponto_micro / 1000000);
      select coalesce(sum(l.bonus_contabil), 0) into v_ja
        from expansao_liquidacao l
        join expansao_ciclo c on c.id = l.ciclo_id
       where l.user_id = v_r.user_id
         and c.id <> v_ciclo
         and public.expansao_dia_do_teto(c.abre_em) = v_dia;
      v_pago := least(v_bruto, greatest(p_teto_diario - v_ja, 0));

      insert into expansao_liquidacao (ciclo_id, user_id, equiparado, sobra_t1, sobra_t2,
                                       bonus_contabil, cortado_teto, retido_inativo)
      values (v_ciclo, v_r.user_id, v_r.eq, v_r.t1 - v_r.eq, v_r.t2 - v_r.eq,
              v_pago, v_bruto - v_pago, false);
      perform public.expansao_somar_equiparado(v_r.user_id, v_r.eq);
      v_n := v_n + 1;
    else
      insert into expansao_liquidacao (ciclo_id, user_id, equiparado, sobra_t1, sobra_t2,
                                       bonus_contabil, retido_inativo)
      values (v_ciclo, v_r.user_id, 0, v_r.t1, v_r.t2, 0, true);
    end if;
  end loop;

  select coalesce(sum(l.equiparado), 0), coalesce(sum(l.bonus_contabil), 0), coalesce(sum(l.cortado_teto), 0)
    into v_soma_eq, v_soma_pago, v_soma_cortado
    from expansao_liquidacao l where l.ciclo_id = v_ciclo;
  if v_soma_eq <> v_total then
    raise exception 'ciclo %: equiparado por pessoa (%) ≠ total (%)', v_ciclo, v_soma_eq, v_total;
  end if;
  -- Pago + cortado é o bruto de cada um; a soma dos arredondamentos por
  -- pessoa nunca passa do bruto do total.
  if v_soma_pago + v_soma_cortado > floor(v_total * p_valor_ponto_micro / 1000000) then
    raise exception 'ciclo %: pago + cortado (%) acima do bruto', v_ciclo, v_soma_pago + v_soma_cortado;
  end if;
  -- Ninguém passou do teto no dia, contando este ciclo.
  if exists (
    select 1 from expansao_liquidacao l
      join expansao_ciclo c on c.id = l.ciclo_id
     where l.user_id in (select e.user_id from _expansao_eq e)
       and public.expansao_dia_do_teto(c.abre_em) = v_dia
     group by l.user_id
    having sum(l.bonus_contabil) > p_teto_diario) then
    raise exception 'ciclo %: alguém passou do teto diário', v_ciclo;
  end if;

  update expansao_ciclo c set bonus_total = v_soma_pago, cortado_total = v_soma_cortado
   where c.id = v_ciclo;

  return query select v_ciclo, 'SETTLED'::text, v_pool, v_total, v_n;
end;
$$;

revoke all on function public.expansao_fechar_ciclo(timestamptz, integer, numeric, numeric, numeric) from public, anon, authenticated;
grant execute on function public.expansao_fechar_ciclo(timestamptz, integer, numeric, numeric, numeric) to service_role;

-- ─── o que a tela lê: o meu bônus, e quanto do teto de hoje já foi ────────
drop function if exists public.expansao_meu_bonus();
create or replace function public.expansao_meu_bonus()
returns table (bonus_usd_cents numeric, olefoot numeric, olefoot_sacado numeric,
               ciclos_pagos integer, perna_padrao smallint,
               hoje_usd_cents numeric, teto_diario_cents numeric)
language sql stable security definer set search_path = public
as $$
  with eu as (select auth.uid() as uid),
  l as (
    select coalesce(sum(li.bonus_contabil), 0) as usd,
           coalesce(sum(floor(li.bonus_contabil * 1000000 / c.preco_micro)), 0) as tok,
           count(*) filter (where li.bonus_contabil > 0)::int as n,
           coalesce(sum(li.bonus_contabil) filter (
             where public.expansao_dia_do_teto(c.abre_em) = public.expansao_dia_do_teto(now())), 0) as hoje
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
         (select n.perna_padrao from expansao_no n where n.user_id = (select uid from eu)),
         l.hoje, 250000::numeric
    from l, s
   where (select uid from eu) is not null;
$$;
revoke all on function public.expansao_meu_bonus() from public, anon;
grant execute on function public.expansao_meu_bonus() to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — rede mínima num savepoint, três ciclos no mesmo dia e um no
-- seguinte, desfeita com raise. Nem o livro append-only fica com linha.
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_chegou boolean := false;
  v_raiz uuid; v_a uuid; v_b uuid;
  -- 10h de São Paulo, 400 dias atrás: três horas seguidas no mesmo dia.
  v_hora timestamptz := (date_trunc('day', (now() - interval '400 days') at time zone 'America/Sao_Paulo')
                         + interval '10 hours') at time zone 'America/Sao_Paulo';
  v_r record;
  v_n numeric;
begin
  if has_function_privilege('authenticated', 'public.expansao_fechar_ciclo(timestamptz,integer,numeric,numeric,numeric)', 'execute')
     or has_function_privilege('anon', 'public.expansao_fechar_ciclo(timestamptz,integer,numeric,numeric,numeric)', 'execute') then
    raise exception 'expansao_fechar_ciclo ficou aberta ao cliente';
  end if;

  select id into v_raiz from auth.users order by created_at limit 1;
  select id into v_a from auth.users where id <> v_raiz order by created_at limit 1;
  select id into v_b from auth.users where id not in (v_raiz, v_a) order by created_at limit 1;
  if v_b is null then
    raise notice 'menos de 3 contas neste ambiente: verificação do teto pulada';
    return;
  end if;

  begin
    delete from expansao_liquidacao;
    delete from expansao_ciclo;
    delete from expansao_perna;
    delete from expansao_confirmacao;
    delete from expansao_no;

    perform public.expansao_inserir(v_raiz, null, null, null);
    perform public.expansao_inserir(v_a, v_raiz, v_raiz, 1::smallint);
    perform public.expansao_inserir(v_b, v_raiz, v_raiz, 2::smallint);

    -- 1. sem receita nenhuma na hora, com 4.000 no time menor: PAGA $1.000
    perform public.expansao_creditar(v_a, 20000, 'compra_olefoot', 'verifica-teto-a');
    perform public.expansao_creditar(v_b, 4000, 'compra_olefoot', 'verifica-teto-b');
    select * into v_r from public.expansao_fechar_ciclo(v_hora);
    if v_r.status <> 'SETTLED' then raise exception 'hora sem receita não pagou: %', v_r.status; end if;
    select bonus_contabil, cortado_teto into v_r from expansao_liquidacao where user_id = v_raiz;
    if v_r.bonus_contabil <> 100000 or v_r.cortado_teto <> 0 then
      raise exception '4.000 pontos: pagou % cortou % (esperava 100000 e 0)', v_r.bonus_contabil, v_r.cortado_teto;
    end if;

    -- 2. mesma data, +8.000 no menor: bruto $2.000, cabe $1.500, corta $500
    perform public.expansao_creditar(v_b, 8000, 'compra_olefoot', 'verifica-teto-b2');
    perform public.expansao_fechar_ciclo(v_hora + interval '1 hour');
    select l.bonus_contabil, l.cortado_teto into v_r from expansao_liquidacao l
      join expansao_ciclo c on c.id = l.ciclo_id
     where l.user_id = v_raiz and c.abre_em = v_hora + interval '1 hour';
    if v_r.bonus_contabil <> 150000 or v_r.cortado_teto <> 50000 then
      raise exception 'segundo ciclo: pagou % cortou % (esperava 150000 e 50000)', v_r.bonus_contabil, v_r.cortado_teto;
    end if;
    select volume into v_n from expansao_perna where user_id = v_raiz and lado = 2 and trilho = 'equiparacao';
    if v_n <> 0 then raise exception 'o time menor não foi equiparado inteiro: sobrou %', v_n; end if;

    -- 3. mesma data, teto batido: equipara, não paga nada
    perform public.expansao_creditar(v_b, 100, 'compra_olefoot', 'verifica-teto-b3');
    perform public.expansao_fechar_ciclo(v_hora + interval '2 hours');
    select l.bonus_contabil, l.cortado_teto into v_r from expansao_liquidacao l
      join expansao_ciclo c on c.id = l.ciclo_id
     where l.user_id = v_raiz and c.abre_em = v_hora + interval '2 hours';
    if v_r.bonus_contabil <> 0 or v_r.cortado_teto <> 2500 then
      raise exception 'teto batido: pagou % cortou %', v_r.bonus_contabil, v_r.cortado_teto;
    end if;
    select sum(l.bonus_contabil) into v_n from expansao_liquidacao l where l.user_id = v_raiz;
    if v_n <> 250000 then raise exception 'o dia pagou % (esperava 250000)', v_n; end if;

    -- 4. dia seguinte: o teto zera
    perform public.expansao_creditar(v_b, 100, 'compra_olefoot', 'verifica-teto-b4');
    perform public.expansao_fechar_ciclo(v_hora + interval '1 day');
    select l.bonus_contabil into v_n from expansao_liquidacao l
      join expansao_ciclo c on c.id = l.ciclo_id
     where l.user_id = v_raiz and c.abre_em = v_hora + interval '1 day';
    if v_n <> 2500 then raise exception 'dia seguinte pagou % (esperava 2500)', v_n; end if;

    -- 5. a carreira soma o equiparado inteiro, pago ou cortado
    select equiparado_acumulado into v_n from expansao_no where user_id = v_raiz;
    if v_n <> 12200 then raise exception 'carreira: % (esperava 12200)', v_n; end if;

    -- 6. o ciclo registra o pago e o cortado
    select bonus_total, cortado_total into v_r from expansao_ciclo where abre_em = v_hora + interval '1 hour';
    if v_r.bonus_total <> 150000 or v_r.cortado_total <> 50000 then
      raise exception 'totais do ciclo: % / %', v_r.bonus_total, v_r.cortado_total;
    end if;

    v_chegou := true;
    raise exception 'DESFAZ_A_VERIFICACAO';
  exception when others then
    if sqlerrm <> 'DESFAZ_A_VERIFICACAO' then raise; end if;
  end;

  if not v_chegou then raise exception 'a verificação do teto não chegou ao fim'; end if;
  if exists (select 1 from expansao_olexp where ref like 'verifica-teto-%') then
    raise exception 'a verificação do teto deixou rastro';
  end if;
end $$;
