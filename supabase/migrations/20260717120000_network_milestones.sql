-- ============================================================
-- REDE — marcos de indicação em EXP (substitui a comissão sobre EXP do indicado)
--
-- SAI: `referral_exp_commissions` — o indicador ganhava 5% de todo EXP que o
-- indicado ganhasse jogando. Confuso ("ganho sobre o ganho do outro"), sem teto,
-- sem idempotência, e o resgate marcava `claimed_at` mas creditava só no cliente:
-- se o dispatch falhasse, o EXP sumia.
--
-- ENTRA: escada de marcos com regra fechada. Decisões do fundador (2026-07-17):
--   • Cada indicado DIRETO abre uma EQUIPE (perna).
--   • A perna vale os DESCENDENTES do direto — o direto NÃO conta a si mesmo.
--     Ex.: A tem 10 indicados => perna A = 10.
--   • Só as 2 MAIORES equipes contam.
--     Ex.: A=10, B=50, C=5  =>  qualificados = A+B = 60 (C é ignorado).
--   • Só indicado ATIVO conta (exp_lifetime_earned > 0), mesma régua do sorteio
--     de craque. Cadastro sem jogar não vira EXP.
--   • Marcos e prêmios: 1→200k · 10→1M · 25→3M · 50→8M · 100→25M.
--     (calibração do fundador 2026-07-17: 100× a escala inicial. O degrau de 100
--     rompe o ×100 de propósito — 20M seria o múltiplo, 25M é bônus de topo
--     decidido por ele.)
--
--   EXCEÇÃO DECLARADA no marco 1: como a perna não conta o direto, quem tem 1
--   indicado direto e nenhuma rede abaixo teria 0 qualificados e nunca receberia
--   o primeiro prêmio. Então o marco 1 (e SÓ ele) olha DIRETOS ATIVOS >= 1.
--   Os marcos 10/25/50/100 olham a soma das 2 maiores equipes.
--
-- REGRA FUTURA (registrada, NÃO aplicada aqui): o Plano de Carreira vai exigir
-- indicação até a equipe D — ou seja, 4 pernas diretas. Nada neste arquivo
-- valida isso; ver MIN_LEGS_CAREER_PLAN em src/systems/network/milestones.ts.
--
-- MANTIDOS de propósito: `profiles.exp_lifetime_earned`, `sync_my_exp_lifetime` e
-- o ReferralExpSync no cliente. O gate de ≥5 indicados ativos do sorteio de craque
-- depende deles — matar junto quebraria o sorteio.
-- ============================================================

-- ─── 1. Remove a comissão de EXP sobre o indicado ──────────────────────────
drop trigger if exists profiles_referral_exp_commission_trg on public.profiles;
drop function if exists public.trg_referral_exp_commission() cascade;
drop function if exists public.claim_my_referral_commissions(uuid) cascade;
drop table if exists public.referral_exp_commissions cascade;

-- ─── 2. wallet_credits: permitir crédito só de EXP ─────────────────────────
-- O check original era `bro_cents > 0`, o que impedia creditar EXP puro. Passa a
-- aceitar 0 em BRO, exigindo que ao menos uma das duas moedas tenha valor.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.wallet_credits'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%bro_cents%'
  loop
    execute format('alter table public.wallet_credits drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.wallet_credits
  add constraint wallet_credits_amounts_chk
  check (bro_cents >= 0 and exp_amount >= 0 and (bro_cents > 0 or exp_amount > 0));

-- ─── 3. get_my_referrals sem as colunas de comissão ────────────────────────
-- ManagerNetwork, ReferralTab e PlayerVip chamam esta RPC. Dropar a tabela sem
-- reescrever aqui derrubaria as três telas juntas.
drop function if exists public.get_my_referrals() cascade;

create or replace function public.get_my_referrals()
returns table (
  id uuid,
  display_name text,
  club_name text,
  club_short text,
  created_at timestamptz,
  exp_lifetime_earned bigint,
  /** Descendentes ATIVOS abaixo deste indicado (a "equipe" dele). */
  leg_size bigint,
  /** true se esta equipe está entre as 2 maiores (as que contam pros marcos). */
  counts_for_milestones boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_my_id uuid := auth.uid();
  v_my_code text;
begin
  if v_my_id is null then
    return;
  end if;

  select my_referral_code into v_my_code from public.profiles where profiles.id = v_my_id;
  if v_my_code is null then
    return;
  end if;

  return query
  with recursive tree as (
    -- Raiz de cada perna: meus indicados diretos.
    select p.id as node_id, p.my_referral_code as code, p.id as leg_root, 1 as depth
      from public.profiles p
     where p.referred_by_code = v_my_code
    union all
    -- Desce a árvore carregando a perna de origem. depth cap = guarda anti-ciclo.
    select c.id, c.my_referral_code, t.leg_root, t.depth + 1
      from public.profiles c
      join tree t on c.referred_by_code = t.code
     where t.depth < 12
  ),
  legs as (
    select t.leg_root,
           count(*) filter (
             where t.depth > 1 and coalesce(pr.exp_lifetime_earned, 0) > 0
           )::bigint as leg_size
      from tree t
      join public.profiles pr on pr.id = t.node_id
     group by t.leg_root
  ),
  ranked as (
    select l.leg_root, l.leg_size,
           row_number() over (order by l.leg_size desc, l.leg_root) as rn
      from legs l
  )
  select p.id,
         p.display_name,
         p.club_name,
         p.club_short,
         p.created_at,
         coalesce(p.exp_lifetime_earned, 0)::bigint,
         coalesce(r.leg_size, 0)::bigint,
         coalesce(r.rn <= 2, false)
    from public.profiles p
    left join ranked r on r.leg_root = p.id
   where p.referred_by_code = v_my_code
   order by coalesce(r.leg_size, 0) desc, p.created_at desc;
end;
$$;

revoke execute on function public.get_my_referrals() from anon, public;
grant execute on function public.get_my_referrals() to authenticated;

-- ─── 4. Marcos: tabela de resgate ──────────────────────────────────────────
-- PK (user_id, milestone) = idempotência real: cada marco resgata uma vez só.
create table if not exists public.network_milestone_claims (
  user_id          uuid not null references auth.users(id) on delete cascade,
  milestone        int  not null,
  exp_amount       bigint not null check (exp_amount > 0),
  /** Quantos qualificados o manager tinha no momento do resgate (auditoria). */
  qualifying_count int not null,
  claimed_at       timestamptz not null default now(),
  primary key (user_id, milestone)
);

alter table public.network_milestone_claims enable row level security;

drop policy if exists network_milestone_claims_self_read on public.network_milestone_claims;
create policy network_milestone_claims_self_read on public.network_milestone_claims
  for select to authenticated
  using (user_id = auth.uid());
-- Sem policy de INSERT: só a RPC security definer escreve.

-- ─── 5. Prêmio por marco — autoritativo no servidor ────────────────────────
-- O cliente NUNCA manda valor; manda só qual marco quer resgatar.
create or replace function public.network_milestone_exp(p_milestone int)
returns bigint
language sql
immutable
as $$
  select case p_milestone
    when 1   then 200000::bigint
    when 10  then 1000000::bigint
    when 25  then 3000000::bigint
    when 50  then 8000000::bigint
    when 100 then 25000000::bigint
    else null::bigint
  end;
$$;

-- ─── 6. Status da rede ─────────────────────────────────────────────────────
create or replace function public.get_my_network_status()
returns table (
  /** Indicados diretos ativos (régua do marco 1). */
  directs_active   int,
  /** Total de indicados diretos, ativos ou não. */
  directs_total    int,
  /** Soma das 2 maiores equipes — a régua dos marcos 10/25/50/100. */
  qualifying_count int,
  /** Nº de pernas (indicados diretos) — a regra futura de carreira exige 4. */
  legs_total       int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_my_id uuid := auth.uid();
  v_my_code text;
begin
  if v_my_id is null then
    return;
  end if;

  select my_referral_code into v_my_code from public.profiles where profiles.id = v_my_id;
  if v_my_code is null then
    return;
  end if;

  return query
  with recursive tree as (
    select p.id as node_id, p.my_referral_code as code, p.id as leg_root, 1 as depth
      from public.profiles p
     where p.referred_by_code = v_my_code
    union all
    select c.id, c.my_referral_code, t.leg_root, t.depth + 1
      from public.profiles c
      join tree t on c.referred_by_code = t.code
     where t.depth < 12
  ),
  legs as (
    select t.leg_root,
           count(*) filter (
             where t.depth > 1 and coalesce(pr.exp_lifetime_earned, 0) > 0
           )::bigint as leg_size
      from tree t
      join public.profiles pr on pr.id = t.node_id
     group by t.leg_root
  ),
  top2 as (
    select coalesce(sum(l.leg_size), 0)::int as s
      from (select leg_size from legs order by leg_size desc limit 2) l
  ),
  directs as (
    select count(*)::int as total,
           count(*) filter (where coalesce(p.exp_lifetime_earned, 0) > 0)::int as active
      from public.profiles p
     where p.referred_by_code = v_my_code
  )
  select d.active, d.total, t.s, d.total
    from directs d cross join top2 t;
end;
$$;

revoke execute on function public.get_my_network_status() from anon, public;
grant execute on function public.get_my_network_status() to authenticated;

-- ─── 7. Resgate do marco ───────────────────────────────────────────────────
-- Credita via wallet_credits (exp_amount) em vez de devolver o valor pro cliente
-- aplicar: `applyPendingCredits` já reaplica no próximo boot se o dispatch falhar.
-- Era exatamente aqui que o sistema antigo perdia EXP.
create or replace function public.claim_network_milestone(p_milestone int)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_exp   bigint;
  v_qual  int;
  v_reach int;
  v_rows  int;
  v_st    record;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  v_exp := public.network_milestone_exp(p_milestone);
  if v_exp is null then
    raise exception 'INVALID_MILESTONE';
  end if;

  select * into v_st from public.get_my_network_status();
  if v_st is null then
    raise exception 'MILESTONE_NOT_REACHED';
  end if;

  -- Marco 1 é a exceção: olha diretos ativos, porque a perna não conta o direto.
  if p_milestone = 1 then
    v_reach := v_st.directs_active;
  else
    v_reach := v_st.qualifying_count;
  end if;

  if v_reach < p_milestone then
    raise exception 'MILESTONE_NOT_REACHED';
  end if;
  v_qual := v_reach;

  insert into public.network_milestone_claims (user_id, milestone, exp_amount, qualifying_count)
  values (v_uid, p_milestone, v_exp, v_qual)
  on conflict (user_id, milestone) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'ALREADY_CLAIMED';
  end if;

  insert into public.wallet_credits (user_id, bro_cents, exp_amount, reason)
  values (v_uid, 0, v_exp, 'network_milestone:' || p_milestone::text);

  return v_exp;
end;
$$;

revoke execute on function public.claim_network_milestone(int) from anon, public;
grant execute on function public.claim_network_milestone(int) to authenticated;
