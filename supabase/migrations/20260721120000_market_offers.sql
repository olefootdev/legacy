-- NEGOCIAÇÃO P2P ENTRE MANAGERS — proposta + aceite/negação/contraproposta.
--
-- Complementa a compra direta (academy_managers.listed_on_market + /api/market/buy-prospect):
-- em vez de só comprar pelo preço listado, o comprador PROPÕE um valor e o
-- vendedor aceita, nega ou contrapropõe. A transferência atômica no aceite
-- reutiliza a lógica já existente do buy-prospect (server, service-role).
--
-- SEGURANÇA (lições do projeto): RLS restringe leitura às DUAS partes; nenhuma
-- policy de INSERT/UPDATE/DELETE → só o servidor (service_role, que ignora RLS)
-- escreve. O cliente NUNCA cria/altera oferta direto — sempre via endpoint.

create table if not exists public.market_offers (
  offer_id        uuid primary key default gen_random_uuid(),
  listing_id      text not null,
  game_player_id  text not null,
  player_snapshot jsonb not null,
  player_name     text,
  player_overall  int,
  buyer_user_id   uuid not null references auth.users(id) on delete cascade,
  buyer_club_name text,
  seller_user_id  uuid not null references auth.users(id) on delete cascade,
  offer_exp       bigint not null check (offer_exp > 0 and offer_exp <= 50000000),
  status          text not null default 'pending'
                    check (status in ('pending','accepted','rejected','countered','cancelled','expired')),
  counter_exp     bigint check (counter_exp > 0 and counter_exp <= 50000000),
  created_at      timestamptz not null default now(),
  responded_at    timestamptz
);

create index if not exists market_offers_seller_idx on public.market_offers (seller_user_id, status);
create index if not exists market_offers_buyer_idx  on public.market_offers (buyer_user_id, status);
create index if not exists market_offers_listing_idx on public.market_offers (listing_id, status);

-- Uma proposta PENDENTE por (comprador, listagem): reproposta atualiza a mesma.
create unique index if not exists market_offers_one_pending_per_buyer
  on public.market_offers (listing_id, buyer_user_id)
  where status = 'pending';

alter table public.market_offers enable row level security;

-- Só as duas partes enxergam a oferta.
drop policy if exists "market_offers_select_parties" on public.market_offers;
create policy "market_offers_select_parties" on public.market_offers
  for select
  using (auth.uid() = buyer_user_id or auth.uid() = seller_user_id);

-- Sem policies de escrita: apenas service_role (servidor) grava.
revoke insert, update, delete on public.market_offers from anon, authenticated;
