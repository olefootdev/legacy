-- =============================================================================
-- Checkout PIX no card (compra de jogador Legacy com dinheiro real).
-- Data: 2026-06-18
--
-- Ao confirmar o pagamento de um card (product_kind='card'):
--   1) NÃO credita o comprador (ele compra um jogador, não recarrega saldo).
--   2) SPLIT: credita cada user_id do payment_split a sua % (wallet_credits
--      pendente → o cliente do beneficiário coleta e vira saldo). olefoot/
--      community sem user_id ficam com a plataforma (sem crédito).
--   3) ENTREGA: insere o PlayerEntity (metadata->'player') no manager_squad do comprador.
--   4) COMISSÃO DE AFILIADO: 5% por nível na cadeia do COMPRADOR (source='purchase').
--
-- A trigger de afiliados passa a IGNORAR créditos de split ('card_split:%') —
-- senão o beneficiário receber sua fatia geraria comissão na cadeia dele (errado).
-- =============================================================================

-- Preço de lançamento já existe em legacy_players.price_unit_cents (+ currency
-- 'USDT'/'OLEFOOT'); o checkout PIX converte USDT→BRL pela cotação. Sem coluna nova.

-- 1) Trigger de afiliados ignora créditos de split de card.
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
begin
  if new.applied_at is null then
    return new;
  end if;
  if old.applied_at is not null then
    return new;
  end if;
  -- Créditos de split de card NÃO geram comissão (a split já é a fatia deles).
  if new.reason like 'card\_split:%' then
    return new;
  end if;

  v_bro_bonus := coalesce(floor(new.bro_cents * v_rate), 0)::bigint;
  v_exp_bonus := coalesce(floor(coalesce(new.exp_amount, 0) * v_rate), 0)::bigint;
  if v_bro_bonus <= 0 and v_exp_bonus <= 0 then
    return new;
  end if;

  for v_chain in select * from public.get_referral_chain(new.user_id, 3) loop
    if v_bro_bonus > 0 then
      insert into public.affiliate_commissions (
        referrer_id, referred_id, level, source, source_ref,
        currency, amount_cents, rate, base_amount_cents, status
      ) values (
        v_chain.referrer_id, new.user_id, v_chain.level, 'deposit',
        'wallet_credit:' || new.id::text || ':BRO',
        'BRO', v_bro_bonus, v_rate, new.bro_cents, 'confirmed'
      ) on conflict (source_ref, level) do nothing;
    end if;
    if v_exp_bonus > 0 then
      insert into public.affiliate_commissions (
        referrer_id, referred_id, level, source, source_ref,
        currency, amount_cents, rate, base_amount_cents, status
      ) values (
        v_chain.referrer_id, new.user_id, v_chain.level, 'deposit',
        'wallet_credit:' || new.id::text || ':EXP',
        'EXP', v_exp_bonus, v_rate, new.exp_amount, 'confirmed'
      ) on conflict (source_ref, level) do nothing;
    end if;
  end loop;
  return new;
end;
$$;

-- 3) confirm_payment_intent com ramo 'card'.
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
  v_legacy record;
  v_item jsonb;
  v_uid uuid;
  v_pct numeric;
  v_player jsonb;
  v_players jsonb;
  v_chain record;
  v_comm bigint;
begin
  select * into v_intent from public.payment_intents where id = p_intent_id for update;
  if v_intent is null then
    raise exception 'PAYMENT_INTENT_NOT_FOUND';
  end if;

  -- Idempotência
  if v_intent.status = 'paid' then
    v_was_paid := true;
    select id into v_credit_id from public.wallet_credits
     where user_id = v_intent.user_id and reason = 'pix_payment:' || v_intent.id::text
     order by created_at desc limit 1;
    return query select v_intent.id, v_intent.status, v_credit_id, v_activation_id, v_was_paid;
    return;
  end if;

  update public.payment_intents
     set status = 'paid', paid_at = now(),
         abacate_id = coalesce(p_abacate_id, abacate_id), updated_at = now()
   where id = p_intent_id;

  -- ─── CARD: split + entrega + comissão do comprador (sem creditar o comprador) ───
  if v_intent.product_kind = 'card' then
    select * into v_legacy from public.legacy_players where id = v_intent.product_ref;
    if v_legacy is null then
      raise exception 'CARD_LEGACY_NOT_FOUND: %', v_intent.product_ref;
    end if;

    -- 3a) Split: credita cada beneficiário com user_id (pendente → cliente coleta)
    for v_item in select value from jsonb_array_elements(coalesce(v_legacy.payment_split, '[]'::jsonb)) loop
      v_uid := nullif(v_item->>'user_id', '')::uuid;
      v_pct := coalesce((v_item->>'percent')::numeric, 0);
      if v_uid is not null and v_pct > 0 then
        insert into public.wallet_credits (user_id, bro_cents, exp_amount, reason, applied_at)
        values (
          v_uid,
          floor(v_intent.amount_cents * v_pct / 100.0)::bigint,
          0,
          'card_split:' || v_intent.id::text || ':' || coalesce(v_item->>'kind', 'x'),
          null
        );
      end if;
    end loop;

    -- 3b) Entrega o jogador no manager_squad do comprador (idempotente por id)
    v_player := v_intent.metadata->'player';
    if v_player is null then
      raise exception 'CARD_PLAYER_MISSING_IN_METADATA';
    end if;
    select players into v_players from public.manager_squad where user_id = v_intent.user_id;
    if v_players is null then
      insert into public.manager_squad (user_id, players, lineup)
      values (v_intent.user_id, jsonb_build_array(v_player), '{}'::jsonb)
      on conflict (user_id) do update set players = jsonb_build_array(v_player), updated_at = now();
    elsif not exists (
      select 1 from jsonb_array_elements(v_players) e where e->>'id' = v_player->>'id'
    ) then
      update public.manager_squad
         set players = v_players || jsonb_build_array(v_player), updated_at = now()
       where user_id = v_intent.user_id;
    end if;

    -- 3c) Comissão de afiliado 5% por nível na cadeia do COMPRADOR
    v_comm := floor(v_intent.amount_cents * 0.05)::bigint;
    if v_comm > 0 then
      for v_chain in select * from public.get_referral_chain(v_intent.user_id, 3) loop
        insert into public.affiliate_commissions (
          referrer_id, referred_id, level, source, source_ref,
          currency, amount_cents, rate, base_amount_cents, status
        ) values (
          v_chain.referrer_id, v_intent.user_id, v_chain.level, 'purchase',
          'card_purchase:' || v_intent.id::text,
          'BRO', v_comm, 0.05, v_intent.amount_cents, 'confirmed'
        ) on conflict (source_ref, level) do nothing;
      end loop;
    end if;

    return query select v_intent.id, 'paid'::text, null::uuid, null::uuid, false;
    return;
  end if;

  -- ─── recharge / activation_pack: credita o comprador (fluxo original) ───
  insert into public.wallet_credits (user_id, bro_cents, exp_amount, reason, applied_at)
  values (v_intent.user_id, v_intent.amount_cents, 0, 'pix_payment:' || v_intent.id::text, now())
  returning id into v_credit_id;

  if v_intent.product_kind = 'activation_pack' then
    if not public.is_user_activated(v_intent.user_id) then
      insert into public.activation_packs (
        user_id, amount_cents, currency, source, wallet_credit_id, activated_at
      ) values (v_intent.user_id, 2500, 'BRO', 'purchase', v_credit_id, now())
      on conflict (wallet_credit_id) do nothing
      returning id into v_activation_id;
    end if;
  end if;

  return query select v_intent.id, 'paid'::text, v_credit_id, v_activation_id, v_was_paid;
end;
$$;

revoke execute on function public.confirm_payment_intent(uuid, text) from anon, public, authenticated;
