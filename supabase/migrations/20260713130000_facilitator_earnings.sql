-- ============================================================
-- PLAYERVIP — Saldo/ganhos do FACILITADOR (Peça 2)
--
-- Hoje o trigger de card_sales só captura a fatia 'player' (dono). A fatia de
-- 10% do facilitador cai em wallet_credits (card_split:<intent>:facilitator) mas
-- não aparece no painel. Esta migration:
--   1. adiciona card_sales.role ('player' | 'facilitator')
--   2. estende o trigger pra materializar TAMBÉM a fatia do facilitador
--   3. o summary separa ganhos de dono vs facilitador
--   4. get_my_withdrawable_balance já soma tudo (beneficiary = eu, BRO) — inclui
--      automaticamente a comissão de facilitador.
-- Aditiva e idempotente.
-- ============================================================

-- 1) coluna role
alter table public.card_sales
  add column if not exists role text not null default 'player';

-- 2) trigger: captura player E facilitator (source_ref inclui role + user p/
--    suportar múltiplos facilitadores no mesmo split)
create or replace function public.trg_record_card_sale_from_split()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_intent uuid;
  v_role text;
  v_pi record;
  v_collection text;
begin
  if new.reason is null or new.reason not like 'card_split:%' then
    return new;
  end if;
  v_role := split_part(new.reason, ':', 3);
  if v_role not in ('player', 'facilitator') then
    return new;  -- olefoot/community não geram card_sales
  end if;

  begin
    v_intent := split_part(new.reason, ':', 2)::uuid;
  exception when others then
    return new;
  end;

  select * into v_pi from public.payment_intents where id = v_intent;
  if v_pi is null then return new; end if;

  select collection_id into v_collection from public.legacy_players where id = v_pi.product_ref;

  insert into public.card_sales (
    legacy_player_id, collection_id, beneficiary_user_id, buyer_user_id,
    currency, gross_cents, owner_cents, payment_method, role, source_ref
  ) values (
    v_pi.product_ref, v_collection, new.user_id, v_pi.user_id,
    'BRO', v_pi.amount_cents, new.bro_cents, 'pix', v_role,
    'pixcard:' || v_intent::text || ':' || v_role || ':' || new.user_id::text
  ) on conflict (source_ref) do nothing;

  return new;
end;
$$;

-- 3) summary: separa vendas como DONO (role=player) de comissões como FACILITADOR
--    (DROP antes: a função já existe com menos colunas; o Postgres não deixa
--     create-or-replace mudar o tipo de retorno.)
drop function if exists public.get_my_card_sales_summary();
create or replace function public.get_my_card_sales_summary()
returns table (
  total_sales bigint,
  bro_owner_cents bigint,
  olefoot_owner_cents bigint,
  facilitator_sales bigint,
  facilitator_bro_cents bigint,
  last_sale_at timestamptz
)
language sql security definer set search_path = public as $$
  select
    count(*) filter (where role = 'player')::bigint,
    coalesce(sum(owner_cents) filter (where role = 'player' and currency = 'BRO'), 0)::bigint,
    coalesce(sum(owner_cents) filter (where role = 'player' and currency = 'OLEFOOT'), 0)::bigint,
    count(*) filter (where role = 'facilitator')::bigint,
    coalesce(sum(owner_cents) filter (where role = 'facilitator' and currency = 'BRO'), 0)::bigint,
    max(created_at)
  from public.card_sales
  where beneficiary_user_id = auth.uid();
$$;

grant execute on function public.get_my_card_sales_summary() to authenticated;
