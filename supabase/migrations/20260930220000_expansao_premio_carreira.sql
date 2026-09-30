-- ═══════════════════════════════════════════════════════════════════════════
-- CARREIRA — prêmio em OLEFOOT ao atingir cada degrau
--
-- Regra do fundador (2026-09-30):
--   atingiu CAMPEÃO        → 1.000 OLEFOOT
--   atingiu DUPLO CAMPEÃO  → 5.000 OLEFOOT
--   atingiu TRI CAMPEÃO    → 10.000 OLEFOOT
--   atingiu TETRA CAMPEÃO  → 25.000 OLEFOOT
--   atingiu PENTA CAMPEÃO  → 50.000 OLEFOOT
--
-- Espelha `DEGRAUS` em server/src/lib/expansao/carreira.ts.
--
-- 🔑 UMA VEZ POR DEGRAU, POR PESSOA. A chave primária (user_id, degrau) é a
-- trava: fechar o mesmo ciclo de novo, ou a carreira passar dois degraus num
-- ciclo só, nunca paga duas vezes o mesmo — e pula-degrau paga os dois.
--
-- 🔑 NASCE ONDE A CARREIRA ANDA. O prêmio é gravado dentro de
-- `expansao_somar_equiparado`, que o fechamento do ciclo chama. Não há outro
-- caminho pra graduar, então não há outro caminho pra premiar.
--
-- 🔑 É OLEFOOT DIRETO, não dólar: não passa pelo preço de referência e NÃO
-- entra no teto diário de $2.500 (o teto é do bônus de equiparação). Soma no
-- "a receber" da tela junto com o bônus e sai no mesmo claim.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── os degraus: fonte única no banco ─────────────────────────────────────
create or replace function public.expansao_degraus()
returns table (degrau text, exige numeric, premio_olefoot numeric)
language sql immutable set search_path = public
as $$
  values ('CAMPEAO',        10000::numeric,  1000::numeric),
         ('DUPLO_CAMPEAO',  50000,           5000),
         ('TRI_CAMPEAO',   100000,          10000),
         ('TETRA',         250000,          25000),
         ('PENTA',         500000,          50000)
$$;
grant execute on function public.expansao_degraus() to anon, authenticated, service_role;

create table if not exists public.expansao_premio_carreira (
  user_id     uuid not null references auth.users(id) on delete restrict,
  degrau      text not null check (degrau in ('CAMPEAO','DUPLO_CAMPEAO','TRI_CAMPEAO','TETRA','PENTA')),
  olefoot     numeric(78,0) not null check (olefoot > 0),
  -- O acumulado no momento em que cruzou — prova de que cruzou.
  acumulado   numeric(78,0) not null,
  criado_em   timestamptz not null default now(),
  primary key (user_id, degrau)
);
alter table public.expansao_premio_carreira enable row level security;
drop policy if exists expansao_premio_carreira_proprio on public.expansao_premio_carreira;
create policy expansao_premio_carreira_proprio on public.expansao_premio_carreira
  for select to authenticated using (user_id = auth.uid());

-- Livro: prêmio pago não muda nem some.
drop trigger if exists expansao_premio_carreira_imutavel on public.expansao_premio_carreira;
create or replace function public.expansao_premio_carreira_imutavel()
returns trigger language plpgsql as $$
begin
  raise exception 'expansao_premio_carreira é append-only (tentou %)', tg_op;
end;
$$;
revoke all on function public.expansao_premio_carreira_imutavel() from public, anon, authenticated;
create trigger expansao_premio_carreira_imutavel before update or delete on public.expansao_premio_carreira
  for each row execute function public.expansao_premio_carreira_imutavel();

-- ─── somar o equiparado E premiar o degrau cruzado ────────────────────────
-- Copiada de 20260929180000_carreira_por_equiparado_pago.sql; o acréscimo é
-- o insert dos prêmios no fim.
create or replace function public.expansao_somar_equiparado(p_user uuid, p_quanto numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_novo numeric(78,0);
begin
  if p_quanto < 0 then raise exception 'equiparado negativo: %', p_quanto; end if;
  if p_quanto = 0 then
    return (select equiparado_acumulado from expansao_no where user_id = p_user);
  end if;
  update expansao_no
     set equiparado_acumulado = equiparado_acumulado + p_quanto
   where user_id = p_user
  returning equiparado_acumulado into v_novo;
  if v_novo is null then raise exception '% não está na árvore', p_user; end if;

  insert into expansao_premio_carreira (user_id, degrau, olefoot, acumulado)
  select p_user, d.degrau, d.premio_olefoot, v_novo
    from public.expansao_degraus() d
   where d.exige <= v_novo
  on conflict (user_id, degrau) do nothing;

  return v_novo;
end;
$$;
revoke all on function public.expansao_somar_equiparado(uuid,numeric) from public, anon, authenticated;
grant execute on function public.expansao_somar_equiparado(uuid,numeric) to service_role;

-- ─── quem já tinha graduado antes desta regra também recebe ───────────────
insert into public.expansao_premio_carreira (user_id, degrau, olefoot, acumulado)
select n.user_id, d.degrau, d.premio_olefoot, n.equiparado_acumulado
  from public.expansao_no n
  cross join public.expansao_degraus() d
 where d.exige <= n.equiparado_acumulado
on conflict (user_id, degrau) do nothing;

-- ─── a carreira que a tela lê, agora com o prêmio do próximo degrau ───────
-- Copiada de 20260929210000_expansao_leitura_so_do_dono.sql (com a trava de
-- acesso), lendo os degraus da fonte única em vez de repetir a tabela.
drop function if exists public.expansao_carreira(uuid);
create or replace function public.expansao_carreira(p_user uuid)
returns table (equiparado_acumulado numeric, degrau text, proximo text, falta numeric,
               premio_proximo numeric, premios_olefoot numeric)
language sql stable security definer set search_path = public
as $$
  with a as (
    select coalesce((select equiparado_acumulado from expansao_no where user_id = p_user), 0) as v
  ), d as (select * from public.expansao_degraus())
  select (select v from a),
         (select d.degrau from d where d.exige <= (select v from a) order by d.exige desc limit 1),
         (select d.degrau from d where d.exige >  (select v from a) order by d.exige asc  limit 1),
         coalesce((select d.exige - (select v from a) from d
                    where d.exige > (select v from a) order by d.exige asc limit 1), 0),
         (select d.premio_olefoot from d where d.exige > (select v from a) order by d.exige asc limit 1),
         coalesce((select sum(p.olefoot) from expansao_premio_carreira p where p.user_id = p_user), 0)
   where public.expansao_acesso(p_user);
$$;
revoke all on function public.expansao_carreira(uuid) from public, anon;
grant execute on function public.expansao_carreira(uuid) to authenticated, service_role;

-- ─── o meu bônus: o prêmio da carreira soma no OLEFOOT a receber ──────────
-- Copiada de 20260930180000_expansao_ponto_fixo_teto_diario.sql; o acréscimo
-- é o CTE `p` e a coluna `premios_olefoot`.
drop function if exists public.expansao_meu_bonus();
create or replace function public.expansao_meu_bonus()
returns table (bonus_usd_cents numeric, olefoot numeric, olefoot_sacado numeric,
               ciclos_pagos integer, perna_padrao smallint,
               hoje_usd_cents numeric, teto_diario_cents numeric, premios_olefoot numeric)
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
  p as (
    select coalesce(sum(pc.olefoot), 0) as tok
      from expansao_premio_carreira pc
     where pc.user_id = (select uid from eu)
  ),
  s as (
    select coalesce(sum(cl.olefoot_liquido), 0) as tok
      from expansao_claim cl
     where cl.user_id = (select uid from eu) and cl.status in ('aprovado', 'pago')
  )
  select l.usd, l.tok + p.tok, s.tok, l.n,
         (select n.perna_padrao from expansao_no n where n.user_id = (select uid from eu)),
         l.hoje, 250000::numeric, p.tok
    from l, p, s
   where (select uid from eu) is not null;
$$;
revoke all on function public.expansao_meu_bonus() from public, anon;
grant execute on function public.expansao_meu_bonus() to authenticated, service_role;

comment on table public.expansao_premio_carreira is
  'Prêmio em OLEFOOT por degrau da carreira, uma vez por pessoa. Gravado por
   expansao_somar_equiparado quando o acumulado cruza o degrau.';

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — num savepoint, desfeita com raise
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_chegou boolean := false;
  v_u uuid;
  v_n numeric;
  v_r record;
begin
  if has_function_privilege('authenticated', 'public.expansao_somar_equiparado(uuid,numeric)', 'execute')
     or has_function_privilege('anon', 'public.expansao_somar_equiparado(uuid,numeric)', 'execute') then
    raise exception 'expansao_somar_equiparado ficou aberta ao cliente';
  end if;
  if (select sum(premio_olefoot) from public.expansao_degraus()) <> 91000 then
    raise exception 'a tabela de prêmios não é a do fundador';
  end if;

  select u.id into v_u from auth.users u
   where not exists (select 1 from public.expansao_no n where n.user_id = u.id)
   order by u.created_at limit 1;
  if v_u is null then
    raise notice 'sem conta fora da árvore: verificação do prêmio pulada';
    return;
  end if;

  begin
    if not exists (select 1 from public.expansao_no where pai_id is null) then
      perform public.expansao_inserir(v_u, null, null, null);
    else
      insert into public.expansao_no (user_id, patrocinador_id, pai_id, lado, y_ordem, nivel)
      values (v_u, null, null, null, nextval('expansao_y_seq'), 0);
    end if;

    -- 9.999: nada
    perform public.expansao_somar_equiparado(v_u, 9999);
    if exists (select 1 from public.expansao_premio_carreira where user_id = v_u) then
      raise exception 'premiou antes de chegar a 10.000';
    end if;
    -- +1 = 10.000: CAMPEÃO, 1.000
    perform public.expansao_somar_equiparado(v_u, 1);
    select olefoot into v_n from public.expansao_premio_carreira where user_id = v_u and degrau = 'CAMPEAO';
    if v_n is distinct from 1000 then raise exception 'CAMPEÃO pagou %', v_n; end if;
    -- pula dois degraus num ciclo só (→ 120.000): DUPLO e TRI
    perform public.expansao_somar_equiparado(v_u, 110000);
    select count(*), sum(olefoot) into v_r from public.expansao_premio_carreira where user_id = v_u;
    if v_r.count <> 3 or v_r.sum <> 16000 then
      raise exception 'pulando degrau: % prêmios, % OLEFOOT (esperava 3 e 16000)', v_r.count, v_r.sum;
    end if;
    -- somar de novo sem cruzar nada não repete
    perform public.expansao_somar_equiparado(v_u, 5);
    select count(*) into v_n from public.expansao_premio_carreira where user_id = v_u;
    if v_n <> 3 then raise exception 'repetiu prêmio: % linhas', v_n; end if;
    -- até PENTA: total 91.000
    perform public.expansao_somar_equiparado(v_u, 400000);
    select sum(olefoot) into v_n from public.expansao_premio_carreira where user_id = v_u;
    if v_n <> 91000 then raise exception 'carreira completa pagou % (esperava 91000)', v_n; end if;

    -- a tela: a receber inclui o prêmio
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_u, 'role', 'authenticated')::text, true);
    select * into v_r from public.expansao_meu_bonus();
    if v_r.premios_olefoot <> 91000 or v_r.olefoot < 91000 then
      raise exception 'meu bônus não somou o prêmio: % / %', v_r.premios_olefoot, v_r.olefoot;
    end if;
    select * into v_r from public.expansao_carreira(v_u);
    if v_r.degrau <> 'PENTA' or v_r.premio_proximo is not null or v_r.premios_olefoot <> 91000 then
      raise exception 'carreira na tela: % / % / %', v_r.degrau, v_r.premio_proximo, v_r.premios_olefoot;
    end if;
    perform set_config('request.jwt.claims', '', true);

    v_chegou := true;
    raise exception 'DESFAZ_A_VERIFICACAO';
  exception when others then
    if sqlerrm <> 'DESFAZ_A_VERIFICACAO' then raise; end if;
  end;

  perform set_config('request.jwt.claims', '', true);
  if not v_chegou then raise exception 'a verificação do prêmio não chegou ao fim'; end if;
  if exists (select 1 from public.expansao_premio_carreira where user_id = v_u) then
    raise exception 'a verificação do prêmio deixou rastro';
  end if;
end $$;
