-- ═══════════════════════════════════════════════════════════════════════════
-- A GRADUAÇÃO PASSA A CONTAR O QUE FOI PAGO
--
-- Regra do fundador (2026-09-29): a carreira conta o OLEXP já PAGO em
-- equiparação, somado ao longo dos ciclos — não o volume parado na equipe
-- menor.
--
-- 🔑 O furo que a regra antiga tinha, no exemplo dele:
--
--   ciclo 1:  T1=1000  T2=500   → equipara 500 → T1=500  T2=0
--   ciclo 2:  entra investidor
--             T1=1000  T2=5000  → equipara 1000 → T1=0  T2=4000
--
-- No ciclo 2 a perna MENOR TROCOU DE LADO. Lendo "a menor agora", a graduação
-- passaria a olhar outro número e poderia cair. Somando o pago, vai a 1500 e
-- nunca volta.
--
-- E some a necessidade do trilho protegido: soma de parcelas não-negativas é
-- MONOTÔNICA POR CONSTRUÇÃO. A graduação não precisa ser defendida de nada.
--
-- O trilho `qualificacao` fica: ele ainda desempata a perna alvo em
-- expansao_perna_alvo. Só deixou de ser a base da carreira.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.expansao_no
  add column if not exists equiparado_acumulado numeric(78,0) not null default 0
    check (equiparado_acumulado >= 0);

comment on column public.expansao_no.equiparado_acumulado is
  'Soma de todo OLEXP já pago em equiparação. É a base da graduação — só cresce,
   então o degrau nunca cai, mesmo quando a perna menor troca de lado.';

-- Soma o equiparado do ciclo. Chamada pelo fechamento, uma vez por pessoa.
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
  return v_novo;
end;
$$;
revoke all on function public.expansao_somar_equiparado(uuid,numeric) from public, anon, authenticated;
grant execute on function public.expansao_somar_equiparado(uuid,numeric) to service_role;

-- A graduação da pessoa, legível por ela.
create or replace function public.expansao_carreira(p_user uuid)
returns table (equiparado_acumulado numeric, degrau text, proximo text, falta numeric)
language sql stable security definer set search_path = public as $$
  with a as (
    select coalesce((select equiparado_acumulado from expansao_no where user_id = p_user), 0) as v
  ), d(nome, exige) as (
    values ('CAMPEAO', 10000::numeric), ('DUPLO_CAMPEAO', 50000), ('TRI_CAMPEAO', 100000),
           ('TETRA', 250000), ('PENTA', 500000)
  )
  select (select v from a),
         (select nome from d where exige <= (select v from a) order by exige desc limit 1),
         (select nome from d where exige >  (select v from a) order by exige asc  limit 1),
         coalesce((select exige - (select v from a) from d
                    where exige > (select v from a) order by exige asc limit 1), 0);
$$;
revoke all on function public.expansao_carreira(uuid) from public, anon;
grant execute on function public.expansao_carreira(uuid) to authenticated, service_role;
