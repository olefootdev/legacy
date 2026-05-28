-- ============================================================
-- ACTIVATION PACK — Gate de entrada do Plano de Carreira ($25 USD)
--
-- Regra de produto:
--   - Para PARTICIPAR (receber comissões, criar HODL, claim de bônus),
--     o usuário precisa comprar um Activation Pack de $25 (2500 cents BRO).
--   - Pack é vitalício (compra única → ativação permanente).
--   - Se um referrer NÃO está ativado, a comissão dele NÃO é criada (vai
--     para um log de "comissões perdidas" como FOMO motivador).
--   - A compra do próprio pack é um wallet_credit normal — paga 5-5-5%
--     para a cadeia (se essa cadeia estiver ativada).
--
-- Por que vitalício: padrão MMN. Se um dia quisermos expirar, adicionar
-- coluna expires_at e mudar is_user_activated() — UI e RPCs continuam.
-- ============================================================

create table if not exists public.activation_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 2500),
  currency text not null default 'BRO' check (currency in ('BRO', 'USDT', 'USD')),
  source text not null default 'purchase' check (source in ('purchase', 'admin_grant', 'promo')),
  wallet_credit_id uuid references public.wallet_credits(id) on delete set null,
  activated_at timestamptz not null default now(),
  expires_at timestamptz, -- null = vitalício
  created_at timestamptz not null default now()
);

-- 1 pack ativo (vitalício) por user. Quando expiração futura existir,
-- aplicar lógica adicional na aplicação ou trigger — índice precisa IMMUTABLE.
create unique index if not exists activation_packs_one_active_per_user
  on public.activation_packs (user_id)
  where expires_at is null;

create index if not exists activation_packs_user_idx
  on public.activation_packs (user_id, activated_at desc);

alter table public.activation_packs enable row level security;

drop policy if exists activation_packs_select_self on public.activation_packs;
create policy activation_packs_select_self
  on public.activation_packs
  for select
  using (user_id = auth.uid());

-- ============================================================
-- Função: is_user_activated(uuid)
-- ============================================================

create or replace function public.is_user_activated(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.activation_packs
     where user_id = p_user_id
       and (expires_at is null or expires_at > now())
    limit 1
  );
$$;

revoke execute on function public.is_user_activated(uuid) from anon, public;
grant execute on function public.is_user_activated(uuid) to authenticated;

-- ============================================================
-- Tabela de comissões perdidas (FOMO motivador)
-- ============================================================

create table if not exists public.affiliate_commissions_lost (
  id uuid primary key default gen_random_uuid(),
  would_be_referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  level smallint not null check (level between 1 and 3),
  source text not null,
  source_ref text not null,
  currency text not null,
  amount_cents bigint not null,
  reason text not null default 'referrer_not_activated',
  created_at timestamptz not null default now()
);

create index if not exists affiliate_commissions_lost_referrer_idx
  on public.affiliate_commissions_lost (would_be_referrer_id, created_at desc);

alter table public.affiliate_commissions_lost enable row level security;

drop policy if exists affiliate_commissions_lost_select_self on public.affiliate_commissions_lost;
create policy affiliate_commissions_lost_select_self
  on public.affiliate_commissions_lost
  for select
  using (would_be_referrer_id = auth.uid());

-- ============================================================
-- Adiciona coluna lost_commissions_cents em career_progress
-- ============================================================

alter table public.career_progress
  add column if not exists lost_commissions_cents bigint not null default 0;

-- ============================================================
-- SUBSTITUI o trigger de bônus: agora respeita ativação
-- ============================================================

create or replace function public.trg_wallet_credit_affiliate_bonus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate numeric := 0.05;
  v_bro_bonus bigint;
  v_exp_bonus bigint;
  v_chain record;
  v_referrer_active boolean;
begin
  if new.applied_at is null then return new; end if;
  if old.applied_at is not null then return new; end if;

  v_bro_bonus := coalesce(floor(new.bro_cents * v_rate), 0)::bigint;
  v_exp_bonus := coalesce(floor(coalesce(new.exp_amount, 0) * v_rate), 0)::bigint;

  if v_bro_bonus <= 0 and v_exp_bonus <= 0 then return new; end if;

  for v_chain in select * from public.get_referral_chain(new.user_id, 3) loop
    v_referrer_active := public.is_user_activated(v_chain.referrer_id);

    if v_referrer_active then
      -- Referrer ATIVADO: gera comissões normalmente
      if v_bro_bonus > 0 then
        insert into public.affiliate_commissions (
          referrer_id, referred_id, level, source, source_ref,
          currency, amount_cents, rate, base_amount_cents, status
        ) values (
          v_chain.referrer_id, new.user_id, v_chain.level, 'deposit',
          'wallet_credit:' || new.id::text || ':BRO',
          'BRO', v_bro_bonus, v_rate, new.bro_cents, 'confirmed'
        )
        on conflict (source_ref, level) do nothing;
      end if;

      if v_exp_bonus > 0 then
        insert into public.affiliate_commissions (
          referrer_id, referred_id, level, source, source_ref,
          currency, amount_cents, rate, base_amount_cents, status
        ) values (
          v_chain.referrer_id, new.user_id, v_chain.level, 'deposit',
          'wallet_credit:' || new.id::text || ':EXP',
          'EXP', v_exp_bonus, v_rate, new.exp_amount, 'confirmed'
        )
        on conflict (source_ref, level) do nothing;
      end if;
    else
      -- Referrer NÃO ativado: registra perda (FOMO) e atualiza contador
      if v_bro_bonus > 0 then
        insert into public.affiliate_commissions_lost (
          would_be_referrer_id, referred_id, level, source, source_ref,
          currency, amount_cents
        ) values (
          v_chain.referrer_id, new.user_id, v_chain.level, 'deposit',
          'wallet_credit:' || new.id::text || ':BRO',
          'BRO', v_bro_bonus
        );

        insert into public.career_progress (user_id, lost_commissions_cents)
        values (v_chain.referrer_id, v_bro_bonus)
        on conflict (user_id) do update
          set lost_commissions_cents = career_progress.lost_commissions_cents + v_bro_bonus,
              updated_at = now();
      end if;
    end if;
  end loop;

  return new;
end;
$$;

revoke execute on function public.trg_wallet_credit_affiliate_bonus() from anon, authenticated, public;

-- ============================================================
-- RPC purchase_activation_pack — flujo de compra/ativação
--
-- Cria wallet_credit (debitando saldo via apply normal? NO — pack é compra,
-- então NÃO credita BRO; cria entry de activation_packs e marca o gate).
-- O cliente paga $25 via gateway. Quando o pagamento confirma, esta RPC
-- é chamada (idealmente pelo webhook ou edge function).
--
-- Modelo simples (MVP):
--   - Recebe amount_cents (deve ser >= 2500)
--   - Cria activation_packs entry
--   - NÃO mexe em wallet_credits (depósito real fica separado)
--
-- Pra integração com gateway futuro: criar wallet_credits row com
-- source='activation_pack' e chamar esta RPC depois de marcar applied_at —
-- assim o trigger de bônus dispara normal, dando 5-5-5% pros 3 níveis.
-- ============================================================

create or replace function public.purchase_activation_pack(
  p_amount_cents bigint default 2500,
  p_wallet_credit_id uuid default null,
  p_source text default 'purchase'
)
returns table (
  activation_id uuid,
  user_id uuid,
  amount_cents bigint,
  activated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_now timestamptz := now();
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  if p_amount_cents < 2500 then
    raise exception 'minimum pack amount is 2500 cents ($25)';
  end if;

  if p_source not in ('purchase', 'admin_grant', 'promo') then
    raise exception 'invalid source: %', p_source;
  end if;

  -- Já ativado? Não cria novo (mantém o existente)
  if public.is_user_activated(v_uid) then
    return query
      select ap.id, ap.user_id, ap.amount_cents, ap.activated_at
        from public.activation_packs ap
       where ap.user_id = v_uid
         and (ap.expires_at is null or ap.expires_at > now())
       order by ap.activated_at desc
       limit 1;
    return;
  end if;

  insert into public.activation_packs (
    user_id, amount_cents, currency, source, wallet_credit_id, activated_at
  ) values (
    v_uid, p_amount_cents, 'BRO', p_source, p_wallet_credit_id, v_now
  )
  returning id into v_id;

  return query
    select v_id, v_uid, p_amount_cents, v_now;
end;
$$;

revoke execute on function public.purchase_activation_pack(bigint, uuid, text) from anon, public;
grant execute on function public.purchase_activation_pack(bigint, uuid, text) to authenticated;

-- ============================================================
-- RPC get_my_activation_status — status pro UI
-- ============================================================

create or replace function public.get_my_activation_status()
returns table (
  is_activated boolean,
  activated_at timestamptz,
  expires_at timestamptz,
  total_lost_commissions_cents bigint,
  activation_amount_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;

  return query
  select
    public.is_user_activated(v_uid) as is_activated,
    (select ap.activated_at from public.activation_packs ap
      where ap.user_id = v_uid
        and (ap.expires_at is null or ap.expires_at > now())
      order by ap.activated_at desc limit 1) as activated_at,
    (select ap.expires_at from public.activation_packs ap
      where ap.user_id = v_uid
        and (ap.expires_at is null or ap.expires_at > now())
      order by ap.activated_at desc limit 1) as expires_at,
    coalesce((select cp.lost_commissions_cents from public.career_progress cp
              where cp.user_id = v_uid), 0)::bigint as total_lost_commissions_cents,
    2500::bigint as activation_amount_cents;
end;
$$;

revoke execute on function public.get_my_activation_status() from anon, public;
grant execute on function public.get_my_activation_status() to authenticated;

-- ============================================================
-- Modifica RPCs existentes para EXIGIR ativação
-- ============================================================

-- create_hodl_lock: bloqueia se não ativado
create or replace function public.create_hodl_lock(
  p_amount numeric,
  p_currency text default 'OLEXP'
)
returns table (
  lock_id uuid,
  premium_card_id uuid,
  end_date timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lock_id uuid;
  v_card_id uuid;
  v_end_date timestamptz;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;

  if not public.is_user_activated(v_uid) then
    raise exception 'ACTIVATION_REQUIRED: compre o pack de $25 para participar do HODL';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  if p_currency not in ('OLEXP', 'BRO', 'USDT') then
    raise exception 'unsupported currency: %', p_currency;
  end if;

  v_end_date := now() + interval '90 days';

  insert into public.hodl_locks (user_id, amount_locked, currency, end_date)
  values (v_uid, p_amount, p_currency, v_end_date)
  returning id into v_lock_id;

  insert into public.premium_cards_grants (user_id, card_tier, source, source_ref, card_metadata)
  values (
    v_uid, 'premium', 'hodl_lock', v_lock_id::text,
    jsonb_build_object('lock_amount', p_amount, 'lock_currency', p_currency, 'lock_end_date', v_end_date)
  )
  returning id into v_card_id;

  return query select v_lock_id, v_card_id, v_end_date;
end;
$$;

revoke execute on function public.create_hodl_lock(numeric, text) from anon, public;
grant execute on function public.create_hodl_lock(numeric, text) to authenticated;

-- claim_career_bonus: bloqueia se não ativado
create or replace function public.claim_career_bonus()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pending bigint;
  v_rank text;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;

  if not public.is_user_activated(v_uid) then
    raise exception 'ACTIVATION_REQUIRED: compre o pack de $25 para resgatar bônus';
  end if;

  select pending_bonus_cents, current_rank into v_pending, v_rank
    from public.career_progress
   where user_id = v_uid
   for update;

  if v_pending is null or v_pending <= 0 then return 0; end if;

  insert into public.wallet_credits (user_id, bro_cents, exp_amount, reason, applied_at)
  values (v_uid, v_pending, 0, 'career_bonus:' || v_rank, null);

  update public.career_progress
     set unlocked_rewards = unlocked_rewards || jsonb_build_object(
       'rank', v_rank, 'amount_cents', v_pending, 'claimed_at', now()
     ),
     pending_bonus_cents = 0,
     updated_at = now()
   where user_id = v_uid;

  return v_pending;
end;
$$;

revoke execute on function public.claim_career_bonus() from anon, public;
grant execute on function public.claim_career_bonus() to authenticated;

-- claim_my_affiliate_commissions: bloqueia se não ativado
create or replace function public.claim_my_affiliate_commissions(
  p_currency text default null
)
returns table (
  currency text,
  total_cents bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;

  if not public.is_user_activated(v_uid) then
    raise exception 'ACTIVATION_REQUIRED: compre o pack de $25 para resgatar comissões';
  end if;

  return query
  with claimed as (
    update public.affiliate_commissions
       set claimed_at = now()
     where referrer_id = v_uid
       and claimed_at is null
       and status = 'confirmed'
       and (p_currency is null or currency = p_currency)
    returning currency, amount_cents
  )
  select c.currency, coalesce(sum(c.amount_cents), 0)::bigint
    from claimed c
   group by c.currency;
end;
$$;

revoke execute on function public.claim_my_affiliate_commissions(text) from anon, public;
grant execute on function public.claim_my_affiliate_commissions(text) to authenticated;
