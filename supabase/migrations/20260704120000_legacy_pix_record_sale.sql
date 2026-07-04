-- Camada ao vivo do mercado — registro da venda por PIX.
--
-- Espelha o que o servidor já faz na compra por OLEFOOT (buy-legacy):
-- ao confirmar o pagamento PIX de um card (product_kind='card'), além de entregar
-- o jogador, agora:
--   (3d) incrementa legacy_player_lots.sold no lote aberto → escassez "restam X"
--        anda de verdade e o trigger emit_next_lot pode disparar ao esgotar;
--   (3d) grava uma atividade REAL em market_activities → o ticker deixa de
--        depender do feed NPC.
--
-- Ambos são BEST-EFFORT: envelopados em begin/exception para NUNCA quebrar o
-- pagamento/entrega já concluídos. Recria a função inteira (create or replace)
-- porque plpgsql não permite patch parcial de corpo.
--
-- Depende de 20260618170000_card_pix_checkout.sql (ramo 'card' + market_activities).

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

    -- 3d) Registro da venda p/ camada ao vivo (BEST-EFFORT — nunca quebra o pagamento).
    begin
      update public.legacy_player_lots
         set sold = sold + 1
       where legacy_player_id = v_legacy.id and status = 'open';

      insert into public.market_activities
        (type, manager_id, manager_name, club_name, player_name, player_ovr, player_pos, price_exp)
      values (
        'purchase',
        v_intent.user_id,
        coalesce(nullif(v_intent.metadata->>'clubName', ''), 'Um manager'),
        nullif(v_intent.metadata->>'clubName', ''),
        v_legacy.name,
        nullif(v_player->>'mintOverall', '')::int,
        v_player->>'pos',
        v_intent.amount_cents
      );
    exception when others then
      -- escassez/ticker é secundário; o pagamento e a entrega já estão feitos.
      null;
    end;

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
