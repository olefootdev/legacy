-- ============================================================
-- token_economy_config — camada centralizada do preço do token OLEFOOT
--
-- Por quê:
--   Toda lógica do jogo (rewards HODL, marketplace, swaps, comissões em USD)
--   precisa puxar o preço da moeda de UMA fonte. Hardcodear $0.00001 em
--   vários arquivos = dívida técnica que explode quando listarmos em exchange.
--
-- Modelo:
--   - Singleton (id='current')
--   - Modo 'fixed' (preço travado interno) vs 'market' (oráculo futuro)
--   - Treasury + mint controls (flags para evolução)
--
-- Preço inicial: $0.00001 (OLEFOOT-USD)
-- ============================================================

create table if not exists public.token_economy_config (
  id text primary key default 'current',
  current_token_price numeric(20, 10) not null default 0.00001,
  pricing_mode text not null default 'fixed' check (pricing_mode in ('fixed', 'market')),
  future_exchange_enabled boolean not null default false,
  treasury_control_enabled boolean not null default true,
  mint_control_enabled boolean not null default true,
  daily_mint_cap numeric(36, 8),
  total_minted numeric(36, 8) not null default 0,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint token_economy_config_singleton check (id = 'current')
);

alter table public.token_economy_config enable row level security;

-- Read público (preço é informação pública)
drop policy if exists token_economy_config_select_all on public.token_economy_config;
create policy token_economy_config_select_all
  on public.token_economy_config
  for select
  using (true);

-- Sem INSERT/UPDATE direto via client — apenas via RPC (admin)

insert into public.token_economy_config (id) values ('current')
on conflict (id) do nothing;

-- ============================================================
-- RPC get_token_price() — leitura pública
-- ============================================================

create or replace function public.get_token_price()
returns table (
  current_token_price numeric,
  pricing_mode text,
  future_exchange_enabled boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select current_token_price, pricing_mode, future_exchange_enabled
    from public.token_economy_config
   where id = 'current';
$$;

revoke execute on function public.get_token_price() from anon, public;
grant execute on function public.get_token_price() to authenticated, anon;

-- ============================================================
-- Helper interno: converte centavos BRO → pontos de carreira (USD-equivalent)
-- 1 BRO = 1 USD (parity), 1 ponto = 1 USD ganho
-- ============================================================

create or replace function public.bro_cents_to_career_points(p_cents bigint)
returns bigint
language sql
immutable
as $$
  select coalesce(floor(p_cents::numeric / 100), 0)::bigint;
$$;
