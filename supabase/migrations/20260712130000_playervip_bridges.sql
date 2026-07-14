-- ============================================================
-- PLAYERVIP — PONTES 1..5: conectar dados reais da coleção ao painel da lenda.
--
-- Achado da varredura: o dinheiro/venda de card de LENDA não chegava em
-- lugar legível pelo painel (pro_payouts só é alimentado pelo fluxo Genesis;
-- venda por OLEFOOT não pagava o dono; likes/escassez sem persistência).
--
-- Esta migration é ADITIVA e IDEMPOTENTE. Não reescreve confirm_payment_intent
-- (função de pagamento ao vivo) — captura a venda PIX por TRIGGER em wallet_credits.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- PONTE 5 — Higiene: versionar legacy_player_lots + fechar lote esgotado
--            + legacy_player_id no ticker
-- ════════════════════════════════════════════════════════════

-- 5a) Versiona o shape de legacy_player_lots (a tabela existe no banco mas o
--     DDL nunca foi versionado no repo). create-if-not-exists = no-op em prod.
create table if not exists public.legacy_player_lots (
  lot_id           uuid primary key default gen_random_uuid(),
  legacy_player_id text not null,
  lot_number       int not null default 1,
  supply           bigint not null default 0,
  sold             bigint not null default 0,
  price_unit_cents bigint not null default 0,
  currency         text not null default 'OLEFOOT',
  status           text not null default 'open',
  created_at       timestamptz not null default now()
);
create index if not exists legacy_player_lots_player_idx on public.legacy_player_lots (legacy_player_id, status);

-- 5a) Fecha o lote quando esgota (sold >= supply) — evita sold ultrapassar supply
--     silenciosamente. Não abre o próximo lote (isso é decisão de produto/admin).
create or replace function public.trg_close_soldout_lot()
returns trigger language plpgsql as $$
begin
  if new.status = 'open' and new.supply > 0 and new.sold >= new.supply then
    new.status := 'sold_out';
  end if;
  return new;
end;
$$;
drop trigger if exists close_soldout_lot on public.legacy_player_lots;
create trigger close_soldout_lot
  before update of sold on public.legacy_player_lots
  for each row execute function public.trg_close_soldout_lot();

-- 5b) FK lógica card→ticker: permite auditar "vendas deste card" no ticker.
alter table public.market_activities
  add column if not exists legacy_player_id text;
create index if not exists market_activities_legacy_idx on public.market_activities (legacy_player_id);

-- ════════════════════════════════════════════════════════════
-- PONTE 1 — Registro canônico de venda de card (fonte confiável por card+dono)
-- ════════════════════════════════════════════════════════════
create table if not exists public.card_sales (
  id                  uuid primary key default gen_random_uuid(),
  legacy_player_id    text not null,
  collection_id       text,
  beneficiary_user_id uuid references auth.users(id) on delete set null,
  buyer_user_id       uuid references auth.users(id) on delete set null,
  currency            text not null default 'BRO',
  gross_cents         bigint not null default 0,   -- valor pago pelo comprador
  owner_cents         bigint not null default 0,   -- fatia do dono (split 'player')
  payment_method      text not null check (payment_method in ('pix','olefoot')),
  source_ref          text unique,                 -- idempotência (1 venda = 1 row)
  created_at          timestamptz not null default now()
);
create index if not exists card_sales_beneficiary_idx on public.card_sales (beneficiary_user_id, created_at desc);
create index if not exists card_sales_player_idx on public.card_sales (legacy_player_id);

alter table public.card_sales enable row level security;
drop policy if exists "card_sales_read" on public.card_sales;
create policy "card_sales_read" on public.card_sales
  for select to authenticated
  using (beneficiary_user_id = auth.uid() or public.is_admin());

-- 1a) PIX: o ramo 'card' de confirm_payment_intent já insere wallet_credits
--     'card_split:<intent>:<kind>' por beneficiário. Capturamos a fatia do DONO
--     (kind='player') por trigger e materializamos a venda em card_sales — SEM
--     tocar na função de pagamento.
create or replace function public.trg_record_card_sale_from_split()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_intent uuid;
  v_pi record;
  v_collection text;
begin
  if new.reason is null or new.reason not like 'card_split:%:player' then
    return new;
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
    currency, gross_cents, owner_cents, payment_method, source_ref
  ) values (
    v_pi.product_ref, v_collection, new.user_id, v_pi.user_id,
    'BRO', v_pi.amount_cents, new.bro_cents, 'pix', 'pixcard:' || v_intent::text
  ) on conflict (source_ref) do nothing;

  return new;
end;
$$;
drop trigger if exists record_card_sale_from_split on public.wallet_credits;
create trigger record_card_sale_from_split
  after insert on public.wallet_credits
  for each row execute function public.trg_record_card_sale_from_split();

-- 1b) OLEFOOT: o repasse ao dono + card_sales é gravado pelo servidor
--     (server/src/routes/market.ts buy-legacy) — ver PONTE 3. Aqui só um helper
--     para o servidor materializar a venda de forma idempotente.
create or replace function public.record_olefoot_card_sale(
  p_legacy_player_id text,
  p_beneficiary uuid,
  p_buyer uuid,
  p_gross_cents bigint,
  p_owner_cents bigint
)
returns void language plpgsql security definer set search_path = public as $$
declare v_collection text;
begin
  select collection_id into v_collection from public.legacy_players where id = p_legacy_player_id;
  insert into public.card_sales (
    legacy_player_id, collection_id, beneficiary_user_id, buyer_user_id,
    currency, gross_cents, owner_cents, payment_method, source_ref
  ) values (
    p_legacy_player_id, v_collection, p_beneficiary, p_buyer,
    'OLEFOOT', p_gross_cents, p_owner_cents, 'olefoot',
    'olecard:' || p_legacy_player_id || ':' || coalesce(p_buyer::text, 'anon')
  ) on conflict (source_ref) do nothing;
end;
$$;

-- 1c) Leituras por dono (auth.uid()) — o painel consome estas.
create or replace function public.get_my_card_sales(p_limit int default 50)
returns setof public.card_sales
language sql security definer set search_path = public as $$
  select * from public.card_sales
   where beneficiary_user_id = auth.uid()
   order by created_at desc
   limit greatest(1, least(p_limit, 200));
$$;

create or replace function public.get_my_card_sales_summary()
returns table (
  total_sales bigint,
  bro_owner_cents bigint,
  olefoot_owner_cents bigint,
  last_sale_at timestamptz
)
language sql security definer set search_path = public as $$
  select
    count(*)::bigint,
    coalesce(sum(owner_cents) filter (where currency = 'BRO'), 0)::bigint,
    coalesce(sum(owner_cents) filter (where currency = 'OLEFOOT'), 0)::bigint,
    max(created_at)
  from public.card_sales
  where beneficiary_user_id = auth.uid();
$$;

-- ════════════════════════════════════════════════════════════
-- PONTE 2 — Saldo sacável AUTORITATIVO (server-side)
-- ════════════════════════════════════════════════════════════
-- Sacável em R$ (BRO) = ganhos BRO de venda de card (fatia do dono)
--                       − saques já solicitados/pagos.
-- (Comissão de afiliado tem fluxo de claim próprio; fica fora daqui p/ não dobrar.)
create or replace function public.get_my_withdrawable_balance()
returns bigint
language sql security definer set search_path = public as $$
  select greatest(0,
    coalesce((
      select sum(owner_cents) from public.card_sales
       where beneficiary_user_id = auth.uid() and currency = 'BRO'
    ), 0)
    -
    coalesce((
      select sum(amount_cents) from public.playervip_withdrawals
       where user_id = auth.uid() and status in ('pending','approved','paid')
    ), 0)
  )::bigint;
$$;

-- request_withdrawal recriada: agora VALIDA contra o saldo sacável server-side
-- (antes confiava no maxCents do cliente). Mantém o gate de KYC.
create or replace function public.request_withdrawal(
  p_amount_cents bigint,
  p_pix_key text,
  p_pix_key_type text default 'cpf',
  p_note text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_avail bigint;
  v_id uuid;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'valor inválido'; end if;
  if p_pix_key is null or length(btrim(p_pix_key)) = 0 then raise exception 'chave PIX obrigatória'; end if;

  select verification_status into v_status from public.profiles where id = v_uid;
  if coalesce(v_status, 'not_submitted') <> 'approved' then
    raise exception 'conta não verificada';
  end if;

  v_avail := public.get_my_withdrawable_balance();
  if p_amount_cents > v_avail then
    raise exception 'saldo insuficiente';
  end if;

  insert into public.playervip_withdrawals (user_id, amount_cents, pix_key, pix_key_type, note)
  values (v_uid, p_amount_cents, btrim(p_pix_key), coalesce(p_pix_key_type,'cpf'), p_note)
  returning id into v_id;

  return v_id;
end;
$$;

-- ════════════════════════════════════════════════════════════
-- PONTE 4 — Curtidas REAIS por card (persistidas, agregáveis por dono)
-- ════════════════════════════════════════════════════════════
create table if not exists public.legend_likes (
  id               uuid primary key default gen_random_uuid(),
  legacy_player_id text not null,
  user_id          uuid not null references auth.users(id) on delete cascade,
  created_at       timestamptz not null default now(),
  unique (legacy_player_id, user_id)
);
create index if not exists legend_likes_player_idx on public.legend_likes (legacy_player_id);

alter table public.legend_likes enable row level security;
drop policy if exists "legend_likes_read" on public.legend_likes;
create policy "legend_likes_read" on public.legend_likes
  for select to authenticated using (true);

create or replace function public.toggle_legend_like(p_legacy_player_id text)
returns table (liked boolean, like_count bigint)
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_liked boolean;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;
  if exists (select 1 from public.legend_likes where legacy_player_id = p_legacy_player_id and user_id = v_uid) then
    delete from public.legend_likes where legacy_player_id = p_legacy_player_id and user_id = v_uid;
    v_liked := false;
  else
    insert into public.legend_likes (legacy_player_id, user_id) values (p_legacy_player_id, v_uid)
      on conflict (legacy_player_id, user_id) do nothing;
    v_liked := true;
  end if;
  return query
    select v_liked, (select count(*) from public.legend_likes where legacy_player_id = p_legacy_player_id)::bigint;
end;
$$;

create or replace function public.get_legend_like_count(p_legacy_player_id text)
returns bigint
language sql security definer set search_path = public as $$
  select count(*)::bigint from public.legend_likes where legacy_player_id = p_legacy_player_id;
$$;

-- Total de curtidas somando todos os cards do dono — o painel mostra este número.
create or replace function public.get_my_collection_likes()
returns bigint
language sql security definer set search_path = public as $$
  select count(*)::bigint
    from public.legend_likes ll
    join public.legacy_players lp on lp.id = ll.legacy_player_id
   where lp.beneficiary_user_id = auth.uid();
$$;

-- ─── Grants ─────────────────────────────────────────────────
grant execute on function public.get_my_card_sales(int) to authenticated;
grant execute on function public.get_my_card_sales_summary() to authenticated;
grant execute on function public.get_my_withdrawable_balance() to authenticated;
grant execute on function public.record_olefoot_card_sale(text, uuid, uuid, bigint, bigint) to authenticated, service_role;
grant execute on function public.toggle_legend_like(text) to authenticated;
grant execute on function public.get_legend_like_count(text) to authenticated;
grant execute on function public.get_my_collection_likes() to authenticated;
