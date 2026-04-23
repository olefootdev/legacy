-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — 00010_friendly_challenges
--
-- Desafios amistosos online: convite com TTL (45s), aceitação, Realtime.
-- Finanças (BRO/EXP escrow) permanecem no estado local do cliente; esta tabela
-- coordena presença e abertura sincronizada da partida.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.friendly_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_club_id uuid not null references public.clubs (id) on delete cascade,
  challenged_club_id uuid not null references public.clubs (id) on delete cascade,
  challenger_club_name text not null,
  challenged_club_name text not null,
  mode text not null check (mode in ('quick', 'live')),
  bet_currency text not null check (bet_currency in ('BRO', 'EXP')),
  bet_bro_cents int check (bet_bro_cents is null or bet_bro_cents >= 0),
  bet_exp int check (bet_exp is null or bet_exp >= 0),
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')
  ),
  expires_at timestamptz not null,
  simulation_seed bigint,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint friendly_challenges_distinct_clubs check (challenger_club_id <> challenged_club_id)
);

create index if not exists idx_friendly_challenges_challenged_pending
  on public.friendly_challenges (challenged_club_id, status, expires_at desc);

create index if not exists idx_friendly_challenges_challenger_created
  on public.friendly_challenges (challenger_club_id, created_at desc);

comment on table public.friendly_challenges is
  'Convite PvP amistoso: challenger cria linha pending; challenged aceita/recusa; expires_at ~45s.';

alter table public.friendly_challenges enable row level security;

-- Preencher accepted_at e seed ao aceitar
create or replace function public.friendly_challenges_set_accept_meta()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.status = 'accepted' and old.status = 'pending' then
    new.accepted_at := coalesce(new.accepted_at, now());
    if new.simulation_seed is null then
      new.simulation_seed := (floor(random() * 2147483646::double precision) + 1)::bigint;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists friendly_challenges_set_accept_meta_trg on public.friendly_challenges;
create trigger friendly_challenges_set_accept_meta_trg
  before update on public.friendly_challenges
  for each row execute function public.friendly_challenges_set_accept_meta();

-- ─── RLS ─────────────────────────────────────────────────────────────────

create policy "friendly_challenges_select_participants"
  on public.friendly_challenges
  for select
  using (
    challenger_club_id = public.my_club_id()
    or challenged_club_id = public.my_club_id()
  );

create policy "friendly_challenges_insert_as_challenger"
  on public.friendly_challenges
  for insert
  with check (
    auth.uid() is not null
    and challenger_club_id = public.my_club_id()
    and challenged_club_id <> public.my_club_id()
  );

create policy "friendly_challenges_update_challenger_cancel"
  on public.friendly_challenges
  for update
  using (challenger_club_id = public.my_club_id() and status = 'pending')
  with check (status = 'cancelled');

create policy "friendly_challenges_update_challenged_decide"
  on public.friendly_challenges
  for update
  using (challenged_club_id = public.my_club_id() and status = 'pending')
  with check (status in ('accepted', 'declined'));

create policy "friendly_challenges_update_expire_participant"
  on public.friendly_challenges
  for update
  using (
    status = 'pending'
    and expires_at < now()
    and (
      challenger_club_id = public.my_club_id()
      or challenged_club_id = public.my_club_id()
    )
  )
  with check (status = 'expired');

-- ─── Busca de clubes com perfil (para UI de convite) ─────────────────────

create or replace function public.search_clubs_for_friendly(search text, max_results int default 12)
returns table (club_id uuid, name text, short_name text)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as club_id,
    c.name,
    coalesce(nullif(btrim(c.short_name), ''), left(c.name, 48)) as short_name
  from public.clubs c
  inner join public.profiles p on p.club_id = c.id
  where
    public.my_club_id() is not null
    and c.id <> public.my_club_id()
    and nullif(btrim(search), '') is not null
    and (
      c.name ilike '%' || btrim(search) || '%'
      or coalesce(c.short_name, '') ilike '%' || btrim(search) || '%'
    )
  order by c.name asc
  limit least(coalesce(max_results, 12), 24);
$$;

comment on function public.search_clubs_for_friendly(text, int) is
  'Lista clubes com utilizador associado (perfil), excluindo o clube do JWT; para convite amistoso.';

grant execute on function public.search_clubs_for_friendly(text, int) to authenticated;

-- ─── Grants tabela ───────────────────────────────────────────────────────

grant select, insert, update on table public.friendly_challenges to authenticated;

-- ─── Realtime (Supabase) ─────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'friendly_challenges'
  ) then
    execute 'alter publication supabase_realtime add table public.friendly_challenges';
  end if;
end $$;
