-- Registo server-side de compras no mercado Genesis.
-- Serve como audit trail e impede compra duplicada do mesmo jogador.

create table if not exists public.market_purchases (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  genesis_id      text not null,                     -- ex: GEN-001
  price_exp       bigint not null check (price_exp > 0),
  mint_overall    int not null,
  purchased_at    timestamptz not null default now(),
  unique (user_id, genesis_id)                       -- um jogador por utilizador
);

alter table public.market_purchases enable row level security;

-- Utilizador só lê as suas próprias compras.
create policy "user reads own purchases"
  on public.market_purchases for select
  using (auth.uid() = user_id);

create index on public.market_purchases (user_id);
