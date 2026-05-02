-- market_activities: feed público de atividades do mercado
-- Registra compras, vendas e leilões ganhos pelos managers

create table if not exists public.market_activities (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('purchase', 'sale', 'auction_won', 'listing')),
  manager_id    uuid references auth.users(id) on delete set null,
  manager_name  text not null default 'Manager',
  club_name     text,
  player_name   text not null,
  player_ovr    integer,
  player_pos    text,
  price_exp     bigint,
  created_at    timestamptz not null default now()
);

-- Índice para feed cronológico
create index if not exists market_activities_created_at_idx
  on public.market_activities (created_at desc);

-- RLS: leitura pública, escrita apenas pelo próprio manager
alter table public.market_activities enable row level security;

create policy "market_activities_select_all"
  on public.market_activities for select
  using (true);

create policy "market_activities_insert_own"
  on public.market_activities for insert
  with check (manager_id = auth.uid() or manager_id is null);
