-- ============================================================
-- ACTIVATION GATEWAY FIX — Bloqueia ativação grátis
--
-- Antes: purchase_activation_pack criava activation_packs sem cobrar.
-- Agora: exige wallet_credit_id válido (pago e aplicado) >= $25.
--
-- Caminho pré-PIX: admin chama admin_grant_activation_pack que cria
-- wallet_credit + activation_pack atomicamente.
-- Caminho pós-PIX: webhook do Abacatepay cria wallet_credit com PIX
-- confirmado e depois chama purchase_activation_pack com esse id.
-- ============================================================

-- 1. UNIQUE constraint: 1 ativação por wallet_credit (idempotência)
alter table public.activation_packs
  add constraint activation_packs_wallet_credit_unique
    unique (wallet_credit_id) deferrable initially deferred;

-- Nota: nullable (legacy rows pré-fix podem ter wallet_credit_id = null)

-- 2. SUBSTITUI purchase_activation_pack — agora exige wallet_credit_id NOT NULL
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
  v_credit record;
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

  -- Idempotente: já ativado? Retorna existente
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

  -- ATIVAÇÃO EXIGE PAGAMENTO REAL — exceto admin_grant
  if p_source = 'purchase' then
    if p_wallet_credit_id is null then
      raise exception 'ACTIVATION_REQUIRES_PAYMENT: wallet_credit_id obrigatório para ativação por compra';
    end if;

    select * into v_credit
      from public.wallet_credits
     where id = p_wallet_credit_id;

    if v_credit is null then
      raise exception 'WALLET_CREDIT_NOT_FOUND';
    end if;

    if v_credit.user_id <> v_uid then
      raise exception 'WALLET_CREDIT_WRONG_OWNER';
    end if;

    if v_credit.applied_at is null then
      raise exception 'WALLET_CREDIT_NOT_APPLIED: depósito ainda não confirmado';
    end if;

    if coalesce(v_credit.bro_cents, 0) < p_amount_cents then
      raise exception 'WALLET_CREDIT_INSUFFICIENT: depósito de % cents insuficiente para pack de %', v_credit.bro_cents, p_amount_cents;
    end if;

    if exists (
      select 1 from public.activation_packs ap
       where ap.wallet_credit_id = p_wallet_credit_id
    ) then
      raise exception 'WALLET_CREDIT_ALREADY_USED: este crédito já ativou outra conta';
    end if;
  end if;

  -- admin_grant e promo podem passar wallet_credit_id null
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
-- 3. RPC admin_grant_activation_pack — bypass admin (auditável)
--
-- Cria wallet_credit + activation_pack atomicamente em nome do user-alvo.
-- Útil pra: grants promocionais, testes pré-PIX, suporte ao cliente.
-- ============================================================

create or replace function public.admin_grant_activation_pack(
  p_target_user_id uuid,
  p_reason text default 'admin_grant'
)
returns table (
  activation_id uuid,
  wallet_credit_id uuid,
  user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credit_id uuid;
  v_activation_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if p_target_user_id is null then
    raise exception 'target user id required';
  end if;

  -- Idempotente
  if public.is_user_activated(p_target_user_id) then
    return query
      select ap.id, ap.wallet_credit_id, ap.user_id
        from public.activation_packs ap
       where ap.user_id = p_target_user_id
         and (ap.expires_at is null or ap.expires_at > now())
       order by ap.activated_at desc
       limit 1;
    return;
  end if;

  -- 1. Cria wallet_credit já aplicado (grants admin não geram comissão 5-5-5%
  --    pra rede do user-alvo — só wallets com bro_cents > 0 disparam trigger,
  --    e queremos isso aqui pra refletir o "pagamento simulado" no histórico).
  --    Se quiseres GRANT sem disparar 5-5-5%, mudar bro_cents pra 0 — mas o
  --    pack continua valendo.
  insert into public.wallet_credits (user_id, bro_cents, exp_amount, reason, applied_at)
  values (p_target_user_id, 2500, 0, 'admin_activation_grant:' || p_reason, now())
  returning id into v_credit_id;

  -- 2. Cria activation_packs row
  insert into public.activation_packs (
    user_id, amount_cents, currency, source, wallet_credit_id, activated_at
  ) values (
    p_target_user_id, 2500, 'BRO', 'admin_grant', v_credit_id, now()
  )
  returning id into v_activation_id;

  return query select v_activation_id, v_credit_id, p_target_user_id;
end;
$$;

revoke execute on function public.admin_grant_activation_pack(uuid, text) from anon, public, authenticated;
-- Apenas admins via Supabase Studio (com auth.uid() válido) podem chamar
grant execute on function public.admin_grant_activation_pack(uuid, text) to authenticated;
