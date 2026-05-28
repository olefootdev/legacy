-- ============================================================
-- PAYMENT INTENTS — Camada agnóstica de pagamento (PIX via Abacate Pay)
--
-- Arquitetura:
--   1. Front pede ao backend: "criar PIX pra ativation_pack"
--   2. Backend (Hono) chama POST /v2/transparents/create no Abacate
--   3. Salva payment_intent + retorna brCode/brCodeBase64 pro front
--   4. User paga PIX no app do banco
--   5. Abacate envia webhook "transparent.completed" → edge function
--   6. Edge function valida HMAC + chama confirm_payment_intent RPC
--   7. RPC: marca paid_at + cria wallet_credit (applied) + cria activation_pack
--   8. Trigger 5-5-5% existente dispara → comissões pra rede do user
--
-- Idempotência:
--   - payment_intents.external_id UNIQUE (1 charge por intent)
--   - payment_webhooks_log.event_id UNIQUE (1 processamento por evento)
--   - confirm_payment_intent re-entrante (status=paid → retorna OK)
-- ============================================================

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  external_id text not null unique,
  abacate_id text,
  product_kind text not null check (product_kind in ('activation_pack', 'card', 'recharge')),
  product_ref text,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'BRL',
  br_code text,
  br_code_base64 text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'cancelled', 'failed')),
  dev_mode boolean not null default false,
  customer_name text,
  customer_email text,
  customer_tax_id text,
  customer_cellphone text,
  expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_intents_user_idx
  on public.payment_intents (user_id, created_at desc);

create index if not exists payment_intents_status_idx
  on public.payment_intents (status, created_at desc);

create index if not exists payment_intents_abacate_idx
  on public.payment_intents (abacate_id)
  where abacate_id is not null;

alter table public.payment_intents enable row level security;

drop policy if exists payment_intents_select_self on public.payment_intents;
create policy payment_intents_select_self
  on public.payment_intents
  for select
  using (user_id = auth.uid());

-- ============================================================
-- payment_webhooks_log — idempotência absoluta
-- ============================================================

create table if not exists public.payment_webhooks_log (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  raw_payload jsonb not null,
  signature_header text,
  signature_valid boolean,
  intent_id uuid references public.payment_intents(id) on delete set null,
  processed_at timestamptz,
  error_message text,
  received_at timestamptz not null default now()
);

create index if not exists payment_webhooks_log_event_idx
  on public.payment_webhooks_log (event_type, received_at desc);

alter table public.payment_webhooks_log enable row level security;

-- Webhooks log: só admins veem. Webhook insere via service_role.
drop policy if exists payment_webhooks_log_select_admin on public.payment_webhooks_log;
create policy payment_webhooks_log_select_admin
  on public.payment_webhooks_log
  for select
  using (public.is_admin());

-- ============================================================
-- RPC create_payment_intent — chamada pelo backend Hono ANTES de chamar Abacate
-- ============================================================

create or replace function public.create_payment_intent(
  p_product_kind text,
  p_product_ref text default null,
  p_amount_cents bigint default 12500,
  p_customer_name text default null,
  p_customer_email text default null,
  p_customer_tax_id text default null,
  p_customer_cellphone text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  intent_id uuid,
  external_id text,
  amount_cents bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_intent_id uuid;
  v_external text;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  if p_amount_cents <= 0 then
    raise exception 'amount must be positive';
  end if;

  if p_product_kind not in ('activation_pack', 'card', 'recharge') then
    raise exception 'invalid product_kind: %', p_product_kind;
  end if;

  -- external_id determinístico: user + product_kind + timestamp + product_ref
  v_external := 'olefoot_' || v_uid::text || '_' || p_product_kind || '_' ||
                extract(epoch from now())::bigint::text ||
                coalesce('_' || p_product_ref, '');

  insert into public.payment_intents (
    user_id, external_id, product_kind, product_ref,
    amount_cents, customer_name, customer_email, customer_tax_id, customer_cellphone,
    metadata
  )
  values (
    v_uid, v_external, p_product_kind, p_product_ref,
    p_amount_cents, p_customer_name, p_customer_email, p_customer_tax_id, p_customer_cellphone,
    p_metadata
  )
  returning id into v_intent_id;

  return query select v_intent_id, v_external, p_amount_cents;
end;
$$;

revoke execute on function public.create_payment_intent(text, text, bigint, text, text, text, text, jsonb) from anon, public;
grant execute on function public.create_payment_intent(text, text, bigint, text, text, text, text, jsonb) to authenticated;

-- ============================================================
-- RPC update_payment_intent_charge — chamada pelo backend Hono APÓS Abacate
-- responder com brCode/brCodeBase64
-- ============================================================

create or replace function public.update_payment_intent_charge(
  p_intent_id uuid,
  p_abacate_id text,
  p_br_code text,
  p_br_code_base64 text,
  p_expires_at timestamptz,
  p_dev_mode boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_updated int;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  update public.payment_intents
     set abacate_id = p_abacate_id,
         br_code = p_br_code,
         br_code_base64 = p_br_code_base64,
         expires_at = p_expires_at,
         dev_mode = p_dev_mode,
         updated_at = now()
   where id = p_intent_id
     and user_id = v_uid
     and status = 'pending';

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke execute on function public.update_payment_intent_charge(uuid, text, text, text, timestamptz, boolean) from anon, public;
grant execute on function public.update_payment_intent_charge(uuid, text, text, text, timestamptz, boolean) to authenticated;

-- ============================================================
-- RPC get_my_payment_intent — usado pelo modal de checkout (polling)
-- ============================================================

create or replace function public.get_my_payment_intent(p_intent_id uuid)
returns table (
  id uuid,
  status text,
  amount_cents bigint,
  br_code text,
  br_code_base64 text,
  expires_at timestamptz,
  paid_at timestamptz,
  product_kind text,
  product_ref text,
  dev_mode boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select id, status, amount_cents, br_code, br_code_base64,
         expires_at, paid_at, product_kind, product_ref, dev_mode
    from public.payment_intents
   where id = p_intent_id
     and user_id = auth.uid();
$$;

revoke execute on function public.get_my_payment_intent(uuid) from anon, public;
grant execute on function public.get_my_payment_intent(uuid) to authenticated;

-- ============================================================
-- RPC confirm_payment_intent — chamado pelo webhook após validar HMAC
--
-- Atômico:
--   1. Marca intent como paid
--   2. Cria wallet_credit (já com applied_at = now → trigger 5-5-5% dispara)
--   3. Se product_kind = activation_pack: cria activation_pack apontando pro wallet_credit
--   4. Se product_kind = card: TODO (Fase 9 marketplace)
--   5. Se product_kind = recharge: nada além do wallet_credit
--
-- Idempotente: se já pago, retorna OK.
-- ============================================================

create or replace function public.confirm_payment_intent(
  p_intent_id uuid,
  p_abacate_id text default null
)
returns table (
  intent_id uuid,
  status text,
  wallet_credit_id uuid,
  activation_id uuid,
  was_already_paid boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent record;
  v_credit_id uuid;
  v_activation_id uuid;
  v_was_paid boolean := false;
begin
  -- Lock the row
  select * into v_intent
    from public.payment_intents
   where id = p_intent_id
   for update;

  if v_intent is null then
    raise exception 'PAYMENT_INTENT_NOT_FOUND';
  end if;

  -- Idempotência absoluta
  if v_intent.status = 'paid' then
    v_was_paid := true;
    -- Retorna links existentes do credit + activation se houver
    select id into v_credit_id
      from public.wallet_credits
     where user_id = v_intent.user_id
       and reason = 'pix_payment:' || v_intent.id::text
     order by created_at desc
     limit 1;

    select id into v_activation_id
      from public.activation_packs
     where user_id = v_intent.user_id
       and wallet_credit_id = v_credit_id
     order by activated_at desc
     limit 1;

    return query select v_intent.id, v_intent.status, v_credit_id, v_activation_id, v_was_paid;
    return;
  end if;

  -- Marca como pago
  update public.payment_intents
     set status = 'paid',
         paid_at = now(),
         abacate_id = coalesce(p_abacate_id, abacate_id),
         updated_at = now()
   where id = p_intent_id;

  -- 1. Cria wallet_credit pago — dispara trigger 5-5-5%
  insert into public.wallet_credits (user_id, bro_cents, exp_amount, reason, applied_at)
  values (
    v_intent.user_id,
    v_intent.amount_cents,
    0,
    'pix_payment:' || v_intent.id::text,
    now()
  )
  returning id into v_credit_id;

  -- 2. Side-effect por product_kind
  if v_intent.product_kind = 'activation_pack' then
    -- Cria ativação apontando pro wallet_credit (idempotente via UNIQUE wallet_credit_id)
    if not public.is_user_activated(v_intent.user_id) then
      insert into public.activation_packs (
        user_id, amount_cents, currency, source, wallet_credit_id, activated_at
      ) values (
        v_intent.user_id, 2500, 'BRO', 'purchase', v_credit_id, now()
      )
      on conflict (wallet_credit_id) do nothing
      returning id into v_activation_id;
    end if;
  end if;

  -- product_kind = 'card' fica pra Fase 9 marketplace
  -- product_kind = 'recharge' não tem side-effect adicional

  return query select v_intent.id, 'paid'::text, v_credit_id, v_activation_id, v_was_paid;
end;
$$;

-- confirm_payment_intent só roda no contexto de service_role (edge function webhook)
revoke execute on function public.confirm_payment_intent(uuid, text) from anon, public, authenticated;
