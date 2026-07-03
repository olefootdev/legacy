-- ============================================================================
-- Olefoot Pagamentos — Estorno / chargeback (reverse_payment_intent)
-- ============================================================================
-- Quando o Mercado Pago devolve o dinheiro (status refunded/charged_back), o
-- webhook chama reverse_payment_intent. O que dá pra reverter no SERVIDOR é
-- revertido automaticamente; o que é client-authoritative (BRO já aplicado no
-- navegador, jogador já entregue no squad) NÃO dá pra clawback automático —
-- fica marcado needs_manual=true para o admin resolver.
--
-- Reverte automaticamente:
--   - affiliate_commissions desta intent → status='reversed'
--   - wallet_credits ainda NÃO coletados (applied_at null) → voided_at=now()
--     (split de card não coletado; o cliente ignora voided em applyPendingCredits)
-- Sinaliza needs_manual quando:
--   - crédito do comprador já foi aplicado (recharge/activation)
--   - split de card já coletado, ou jogador (card) já entregue
-- ============================================================================

-- 1. Permite o status 'refunded' na intent
alter table public.payment_intents drop constraint if exists payment_intents_status_check;
alter table public.payment_intents
  add constraint payment_intents_status_check
  check (status in ('pending', 'paid', 'expired', 'cancelled', 'failed', 'refunded'));

-- 2. Marca de crédito estornado antes de coletar (cliente ignora voided)
alter table public.wallet_credits add column if not exists voided_at timestamptz;

-- 3. Auditoria de estornos
create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.payment_intents(id) on delete cascade,
  mp_payment_id text,
  reason text not null default 'refund',
  amount_cents bigint,
  auto_reversed boolean not null default false,
  needs_manual boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists payment_refunds_intent_idx on public.payment_refunds (intent_id);
create index if not exists payment_refunds_manual_idx on public.payment_refunds (needs_manual) where needs_manual = true;

alter table public.payment_refunds enable row level security;
-- Sem policy pra authenticated: só service role (webhook) e admin via service role.

-- 4. RPC reverse_payment_intent
create or replace function public.reverse_payment_intent(
  p_intent_id uuid,
  p_mp_payment_id text default null,
  p_reason text default 'refund'
)
returns table (
  intent_id uuid,
  status text,
  commissions_reversed int,
  credits_voided int,
  needs_manual boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent record;
  v_credit_id uuid;
  v_comm_reversed int := 0;
  v_credits_voided int := 0;
  v_needs_manual boolean := false;
begin
  select * into v_intent from public.payment_intents where id = p_intent_id for update;
  if v_intent is null then
    raise exception 'PAYMENT_INTENT_NOT_FOUND';
  end if;

  -- Idempotência: já estornado → no-op
  if v_intent.status = 'refunded' then
    return query select v_intent.id, v_intent.status, 0, 0, false;
    return;
  end if;

  -- Se não estava paga, não há o que reverter: só cancela a pendente.
  if v_intent.status <> 'paid' then
    update public.payment_intents
       set status = 'cancelled', cancelled_at = now(), updated_at = now()
     where id = p_intent_id and status = 'pending';
    insert into public.payment_refunds (intent_id, mp_payment_id, reason, amount_cents, auto_reversed, needs_manual, note)
    values (p_intent_id, p_mp_payment_id, p_reason, v_intent.amount_cents, false, false,
            'intent_nao_estava_paga:' || coalesce(v_intent.status, 'null'));
    return query select v_intent.id, 'cancelled'::text, 0, 0, false;
    return;
  end if;

  -- Marca estornada
  update public.payment_intents
     set status = 'refunded', updated_at = now()
   where id = p_intent_id;

  if v_intent.product_kind = 'card' then
    -- Comissões do comprador (source='purchase')
    update public.affiliate_commissions
       set status = 'reversed'
     where status = 'confirmed'
       and source_ref = 'card_purchase:' || v_intent.id::text;
    get diagnostics v_comm_reversed = row_count;

    -- Splits ainda não coletados → void; coletados → manual
    update public.wallet_credits
       set voided_at = now()
     where reason like 'card\_split:' || v_intent.id::text || ':%'
       and applied_at is null
       and voided_at is null;
    get diagnostics v_credits_voided = row_count;

    if exists (
      select 1 from public.wallet_credits
       where reason like 'card\_split:' || v_intent.id::text || ':%'
         and applied_at is not null
    ) then
      v_needs_manual := true;
    end if;

    -- Jogador já entregue no manager_squad → remoção é decisão do admin.
    v_needs_manual := true;
  else
    -- recharge / activation_pack: crédito do comprador
    select id into v_credit_id
      from public.wallet_credits
     where user_id = v_intent.user_id
       and reason = 'pix_payment:' || v_intent.id::text
     order by created_at desc
     limit 1;

    if v_credit_id is not null then
      update public.affiliate_commissions
         set status = 'reversed'
       where status = 'confirmed'
         and source_ref in (
           'wallet_credit:' || v_credit_id::text || ':BRO',
           'wallet_credit:' || v_credit_id::text || ':EXP'
         );
      get diagnostics v_comm_reversed = row_count;

      -- confirm aplica o crédito na hora (applied_at=now). Se aplicado → o BRO
      -- já entrou no saldo client-side; clawback é manual. Se (raro) não
      -- aplicado → void.
      if exists (select 1 from public.wallet_credits where id = v_credit_id and applied_at is not null) then
        v_needs_manual := true;
      else
        update public.wallet_credits set voided_at = now()
         where id = v_credit_id and voided_at is null;
        get diagnostics v_credits_voided = row_count;
      end if;
    end if;
  end if;

  insert into public.payment_refunds (intent_id, mp_payment_id, reason, amount_cents, auto_reversed, needs_manual, note)
  values (
    p_intent_id, p_mp_payment_id, p_reason, v_intent.amount_cents, true, v_needs_manual,
    format('comm_reversed=%s credits_voided=%s kind=%s', v_comm_reversed, v_credits_voided, v_intent.product_kind)
  );

  return query select v_intent.id, 'refunded'::text, v_comm_reversed, v_credits_voided, v_needs_manual;
end;
$$;

-- Só service role (webhook). Nunca authenticated/anon.
revoke execute on function public.reverse_payment_intent(uuid, text, text) from anon, public, authenticated;
