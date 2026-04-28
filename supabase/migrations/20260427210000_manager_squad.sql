-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — manager_squad
--
-- Persistência server-side do plantel + escalação de cada manager.
-- Estrutura: 1 row por user_id, com `players` (jsonb array) e `lineup` (jsonb map).
-- Idempotente: upsert overwrite total. Cliente envia snapshot completo.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.manager_squad (
  user_id uuid primary key references auth.users(id) on delete cascade,
  players jsonb not null default '[]'::jsonb,
  lineup jsonb not null default '{}'::jsonb,
  formation_scheme text,
  updated_at timestamptz not null default now()
);

comment on table public.manager_squad is
  'Plantel + escalação por manager (snapshot client-side). 1 row por user.';
comment on column public.manager_squad.players is
  'Array<PlayerEntity> serializado integralmente do client.';
comment on column public.manager_squad.lineup is
  'Map<slotId, playerId> da escalação ativa.';

create index if not exists idx_manager_squad_updated
  on public.manager_squad (updated_at desc);

alter table public.manager_squad enable row level security;

drop policy if exists "manager_squad_select_own" on public.manager_squad;
create policy "manager_squad_select_own"
  on public.manager_squad for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "manager_squad_insert_own" on public.manager_squad;
create policy "manager_squad_insert_own"
  on public.manager_squad for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "manager_squad_update_own" on public.manager_squad;
create policy "manager_squad_update_own"
  on public.manager_squad for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on table public.manager_squad to authenticated;

-- updated_at trigger
create or replace function public.touch_manager_squad_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_manager_squad on public.manager_squad;
create trigger trg_touch_manager_squad
  before update on public.manager_squad
  for each row
  execute function public.touch_manager_squad_updated_at();
