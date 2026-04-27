-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — 00011_academy_managers
--
-- Academia OLE: ao «lançar» jogador aprovado, registo no Supabase alinhado ao
-- mercado EXP (listagem) + snapshot JSONB para o motor (atributos / contrato).
-- Nome lógico do produto: academy-managers → tabela public.academy_managers
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.academy_managers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  listing_id text not null unique,
  game_player_id text not null,
  art_request_id text not null,
  price_exp int not null check (price_exp >= 50000 and price_exp <= 5000000),
  listed_at timestamptz not null default now(),
  listed_on_market boolean not null default true,
  mint_overall int not null check (mint_overall >= 0 and mint_overall <= 99),
  player_snapshot jsonb not null,
  portrait_public_url text,
  portrait_token_public_url text
);

comment on table public.academy_managers is
  'Academia OLE: jogadores aprovados lançados no mercado EXP; snapshot alinhado a PlayerEntity / motor.';

create index if not exists idx_academy_managers_club_created
  on public.academy_managers (club_id, created_at desc);

create index if not exists idx_academy_managers_listed_price
  on public.academy_managers (listed_on_market, price_exp)
  where listed_on_market = true;

alter table public.academy_managers enable row level security;

-- Dono do clube vê todas as linhas do clube; qualquer sessão vê listagens ativas (mercado).
create policy "academy_managers_select_own_or_listed"
  on public.academy_managers
  for select
  using (
    club_id = public.my_club_id()
    or listed_on_market = true
  );

create policy "academy_managers_insert_own_club"
  on public.academy_managers
  for insert
  with check (
    auth.uid() is not null
    and club_id = public.my_club_id()
  );

grant select on table public.academy_managers to anon, authenticated;
grant insert on table public.academy_managers to authenticated;
