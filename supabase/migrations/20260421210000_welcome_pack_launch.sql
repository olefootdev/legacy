-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — welcome_pack_launch
--
-- 1. Coluna `admin_market_tag` em genesis_market_players (flag 'welcomepack' etc.)
-- 2. Tabela `launch_counters` (singleton) com total_managers + welcome_packs_claimed
-- 3. RPC `claim_welcome_pack(p_manager_id uuid)` atômica com SELECT ... FOR UPDATE
-- 4. Trigger incrementando total_managers a cada novo profile
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. admin_market_tag ────────────────────────────────────────────────────
alter table public.genesis_market_players
  add column if not exists admin_market_tag text;

create index if not exists idx_genesis_market_admin_tag
  on public.genesis_market_players (admin_market_tag)
  where admin_market_tag is not null;

comment on column public.genesis_market_players.admin_market_tag is
  'Tag administrativa usada no painel Admin > Market (ex.: ''welcomepack''). Nula = sem tag.';

-- ─── 2. launch_counters (singleton row id=1) ────────────────────────────────
create table if not exists public.launch_counters (
  id int primary key default 1,
  total_managers bigint not null default 0,
  welcome_packs_claimed bigint not null default 0,
  welcome_packs_limit bigint not null default 1000,
  updated_at timestamptz not null default now(),
  constraint launch_counters_singleton check (id = 1)
);

insert into public.launch_counters (id) values (1)
  on conflict (id) do nothing;

comment on table public.launch_counters is
  'Singleton com contadores globais de lançamento (managers, welcome packs).';

alter table public.launch_counters enable row level security;

drop policy if exists "launch_counters_select_public" on public.launch_counters;
create policy "launch_counters_select_public"
  on public.launch_counters for select
  to anon, authenticated
  using (true);

grant select on table public.launch_counters to anon, authenticated;

-- ─── 3. RPC claim_welcome_pack (atômico, com lock de linha) ─────────────────
create or replace function public.claim_welcome_pack(p_manager_id uuid)
returns table (
  claimed boolean,
  queue_position bigint,
  remaining bigint,
  welcome_packs_claimed bigint,
  welcome_packs_limit bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed bigint;
  v_limit bigint;
begin
  -- lock singleton row for atomic increment
  select lc.welcome_packs_claimed, lc.welcome_packs_limit
    into v_claimed, v_limit
    from public.launch_counters lc
    where lc.id = 1
    for update;

  if v_claimed < v_limit then
    update public.launch_counters
       set welcome_packs_claimed = welcome_packs_claimed + 1,
           updated_at = now()
     where id = 1
     returning launch_counters.welcome_packs_claimed
       into v_claimed;

    return query select
      true                 as claimed,
      v_claimed            as queue_position,
      (v_limit - v_claimed) as remaining,
      v_claimed            as welcome_packs_claimed,
      v_limit              as welcome_packs_limit;
  else
    return query select
      false                as claimed,
      (v_claimed + 1)      as queue_position,
      0::bigint            as remaining,
      v_claimed            as welcome_packs_claimed,
      v_limit              as welcome_packs_limit;
  end if;
end;
$$;

revoke all on function public.claim_welcome_pack(uuid) from public;
grant execute on function public.claim_welcome_pack(uuid) to authenticated;

comment on function public.claim_welcome_pack(uuid) is
  'Reserva atomicamente 1 welcome pack se welcome_packs_claimed < welcome_packs_limit. Retorna claimed, position (1-based), remaining.';

-- ─── 4. Trigger: incrementar total_managers por novo profile ────────────────
create or replace function public.increment_total_managers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.launch_counters
     set total_managers = total_managers + 1,
         updated_at = now()
   where id = 1;
  return new;
end;
$$;

drop trigger if exists trg_increment_total_managers on public.profiles;
create trigger trg_increment_total_managers
  after insert on public.profiles
  for each row
  execute function public.increment_total_managers();
