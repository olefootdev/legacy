-- ============================================================
-- PLAYERVIP — conta OLEFOOT: a plataforma vira beneficiária e enxerga tudo
--
-- O PROBLEMA
-- Todo card tem split de 4 fatias: player 50% · olefoot 25% · community 15% ·
-- facilitator 10%. Mas `olefoot` e `community` SEMPRE tiveram user_id null
-- (0 de 5 cards), e o `confirm_payment_intent` só credita entrada com user_id.
-- Resultado: os 40% da plataforma nunca viraram registro. O dinheiro fica na
-- conta do Mercado Pago, mas não existe rastro no sistema — não dá pra
-- acompanhar receita, nem conferir se o split fechou.
--
-- Pior: o trigger que materializa `card_sales` DESCARTA essas fatias de propósito
--   if v_role not in ('player','facilitator') then return new;
-- então mesmo com user_id elas não apareceriam no painel.
--
-- A SOLUÇÃO (decisão do fundador 2026-07-17)
-- A OLEFOOT vira "mais um beneficiário", reusando a estrutura inteira do
-- PLAYERVIP — sem tocar no painel admin. A conta `trader4` (a admin real; a
-- `olefootdev` é fantasma, ver memória) recebe olefoot 25% + community 15% = 40%
-- e passa a ver cada venda no próprio cockpit.
--
-- ⚠️ NOTA HONESTA: isso é CONTABILIDADE, não movimento de dinheiro. Os 40% já
-- são da plataforma (ficam no MP). O crédito aqui é registro pra acompanhar. O
-- botão "Sacar" no playervip dessa conta não faz sentido — e fica inerte na
-- prática, porque `request_withdrawal` exige KYC aprovado.
-- ============================================================

-- ─── 1. A conta da plataforma ──────────────────────────────────────────────
-- Hardcode consciente: é UMA conta e ela precisa ser resolvida dentro de trigger
-- (que não tem sessão). Pra trocar, mude AQUI e rode de novo — as duas funções
-- abaixo leem daqui.
create or replace function public.olefoot_platform_user_id()
returns uuid
language sql
immutable
as $$
  select 'cc5d5342-c89f-431a-9da5-80882abdc358'::uuid;  -- trader4 (admin real)
$$;

comment on function public.olefoot_platform_user_id() is
  'Conta que recebe as fatias olefoot (25%) e community (15%) do split de card. '
  'Trocar aqui muda tanto o preenchimento automático quanto o backfill.';

-- ─── 2. Card novo já nasce com a plataforma no split ───────────────────────
-- Trigger em legacy_players em vez de mexer no legendImport: assim QUALQUER
-- caminho (import, wizard admin, script) fica coberto, e card novo não depende
-- de alguém lembrar de preencher.
create or replace function public.trg_fill_platform_split()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public.olefoot_platform_user_id();
  v_out jsonb;
begin
  if new.payment_split is null or jsonb_typeof(new.payment_split) <> 'array' then
    return new;
  end if;

  select jsonb_agg(
           case
             when e->>'kind' in ('olefoot', 'community') and nullif(e->>'user_id', '') is null
               then jsonb_set(e, '{user_id}', to_jsonb(v_uid::text))
             else e
           end
         )
    into v_out
    from jsonb_array_elements(new.payment_split) e;

  if v_out is not null then
    new.payment_split := v_out;
  end if;
  return new;
end;
$$;

drop trigger if exists legacy_players_fill_platform_split on public.legacy_players;
create trigger legacy_players_fill_platform_split
  before insert or update of payment_split on public.legacy_players
  for each row execute function public.trg_fill_platform_split();

-- Mesmo tratamento pros cards Genesis, que usam o mesmo formato de split.
do $$
begin
  if to_regclass('public.genesis_market_players') is not null then
    drop trigger if exists genesis_players_fill_platform_split on public.genesis_market_players;
    create trigger genesis_players_fill_platform_split
      before insert or update of payment_split on public.genesis_market_players
      for each row execute function public.trg_fill_platform_split();
  end if;
end $$;

-- ─── 3. Preenche os cards que já existem ───────────────────────────────────
-- O trigger é BEFORE UPDATE: este update "toca" a coluna e ele faz o resto.
update public.legacy_players
   set payment_split = payment_split
 where payment_split is not null
   and exists (
     select 1 from jsonb_array_elements(payment_split) e
      where e->>'kind' in ('olefoot', 'community')
        and nullif(e->>'user_id', '') is null
   );

do $$
begin
  if to_regclass('public.genesis_market_players') is not null then
    update public.genesis_market_players
       set payment_split = payment_split
     where payment_split is not null
       and exists (
         select 1 from jsonb_array_elements(payment_split) e
          where e->>'kind' in ('olefoot', 'community')
            and nullif(e->>'user_id', '') is null
       );
  end if;
end $$;

-- ─── 4. card_sales passa a registrar as fatias da plataforma ───────────────
-- Antes: `if v_role not in ('player','facilitator') then return new;`
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
  -- olefoot/community entram agora: são a receita da plataforma, e sem elas o
  -- painel nunca fecha com o valor bruto da venda.
  if v_role not in ('player', 'facilitator', 'olefoot', 'community') then
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
    currency, gross_cents, owner_cents, payment_method, role, source_ref
  ) values (
    v_pi.product_ref, v_collection, new.user_id, v_pi.user_id,
    'BRO', v_pi.amount_cents, new.bro_cents, 'pix', v_role,
    'pixcard:' || v_intent::text || ':' || v_role || ':' || new.user_id::text
  ) on conflict (source_ref) do nothing;

  return new;
end;
$$;

-- ─── 5. Summary separa a receita da plataforma ─────────────────────────────
drop function if exists public.get_my_card_sales_summary();
create or replace function public.get_my_card_sales_summary()
returns table (
  total_sales bigint,
  bro_owner_cents bigint,
  olefoot_owner_cents bigint,
  facilitator_sales bigint,
  facilitator_bro_cents bigint,
  platform_sales bigint,
  platform_bro_cents bigint,
  last_sale_at timestamptz
)
language sql security definer set search_path = public as $$
  select
    count(*) filter (where role = 'player')::bigint,
    coalesce(sum(owner_cents) filter (where role = 'player' and currency = 'BRO'), 0)::bigint,
    -- ⚠️ nome legado: é venda na MOEDA OLEFOOT, não a fatia 'olefoot' do split.
    coalesce(sum(owner_cents) filter (where role = 'player' and currency = 'OLEFOOT'), 0)::bigint,
    count(*) filter (where role = 'facilitator')::bigint,
    coalesce(sum(owner_cents) filter (where role = 'facilitator' and currency = 'BRO'), 0)::bigint,
    -- Receita da plataforma: olefoot 25% + community 15%.
    count(*) filter (where role in ('olefoot', 'community'))::bigint,
    coalesce(sum(owner_cents) filter (where role in ('olefoot', 'community') and currency = 'BRO'), 0)::bigint,
    max(created_at)
  from public.card_sales
  where beneficiary_user_id = auth.uid();
$$;

revoke execute on function public.get_my_card_sales_summary() from anon, public;
grant execute on function public.get_my_card_sales_summary() to authenticated;

-- ─── 6. Backfill da venda que já aconteceu ─────────────────────────────────
-- A venda do Marcelo (2026-07-08, R$ 27,03) rodou quando olefoot/community
-- tinham user_id null, então nunca geraram crédito. Cria as duas fatias agora,
-- com a MESMA fórmula do confirm_payment_intent (floor(amount * pct / 100)) e a
-- data REAL da venda. O trigger do item 4 materializa card_sales sozinho.
insert into public.wallet_credits (user_id, bro_cents, exp_amount, reason, applied_at, created_at)
select
  public.olefoot_platform_user_id(),
  floor(pi.amount_cents * (e->>'percent')::numeric / 100.0)::bigint,
  0,
  'card_split:' || pi.id::text || ':' || (e->>'kind'),
  null,
  coalesce(pi.paid_at, pi.created_at)
from public.payment_intents pi
join public.legacy_players lp on lp.id = pi.product_ref
cross join lateral jsonb_array_elements(lp.payment_split) e
where pi.product_kind = 'card'
  and pi.status = 'paid'
  and e->>'kind' in ('olefoot', 'community')
  and floor(pi.amount_cents * (e->>'percent')::numeric / 100.0)::bigint > 0
  -- idempotente: não recria o que já existe
  and not exists (
    select 1 from public.wallet_credits w
     where w.reason = 'card_split:' || pi.id::text || ':' || (e->>'kind')
  );

-- ─── Conferência ───────────────────────────────────────────────────────────
select
  cs.role,
  (select email from auth.users u where u.id = cs.beneficiary_user_id) as quem,
  cs.gross_cents as bruto_cents,
  cs.owner_cents as recebe_cents,
  cs.created_at
from public.card_sales cs
order by cs.created_at desc, cs.role;
