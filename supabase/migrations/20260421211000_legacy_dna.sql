-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — legacy_dna
--
-- LegacyDNA: jogadores criados no admin que ensinam atributos-de-posição
-- aos jogadores do elenco do mesmo posto, e aplicam um booster numérico
-- ao time quando titulares.
--
-- Regras:
--  • Ensino: legacy presente no elenco + aluno com mentoria ativa + mesma pos.
--  • Evolução: +1/dia em cada atributo ensinado, teto no valor do legacy.
--  • Mentor único por aluno (unique constraint).
--  • Booster de time (jsonb numérico): ativo quando legacy é titular.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. legacy_players ──────────────────────────────────────────────────────
create table if not exists public.legacy_players (
  id text primary key,
  name text not null,
  pos text not null,
  pos_original text,
  attributes jsonb not null default '{}'::jsonb,
  taught_attributes text[] not null default '{}'::text[],
  team_booster jsonb not null default '{}'::jsonb,
  price_bro_cents bigint not null default 0,
  listed_on_market boolean not null default false,
  country text,
  age int,
  strong_foot text,
  creator_label text,
  rarity_label text,
  bio text,
  portrait_storage_path text,
  portrait_public_url text,
  card_supply int default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legacy_players_strong_foot_chk
    check (strong_foot is null or strong_foot in ('right', 'left', 'both'))
);

create index if not exists idx_legacy_players_listed
  on public.legacy_players (listed_on_market, pos);
create index if not exists idx_legacy_players_pos
  on public.legacy_players (pos);

comment on table public.legacy_players is
  'Jogadores LegacyDNA criados no admin. Ensinam atributos-de-posição e aplicam team_booster quando titulares.';
comment on column public.legacy_players.taught_attributes is
  'Atributos que este legacy ensina (ex.: {passe,drible,finalizacao,tatico}).';
comment on column public.legacy_players.team_booster is
  'Booster numérico aplicado ao time quando titular. Ex.: {"morale":3,"possession_pct":5}.';

alter table public.legacy_players enable row level security;

drop policy if exists "legacy_players_select_public" on public.legacy_players;
create policy "legacy_players_select_public"
  on public.legacy_players for select
  to anon, authenticated
  using (coalesce(listed_on_market, false) = true);

grant select on table public.legacy_players to anon, authenticated;

-- ─── 2. legacy_mentorships ──────────────────────────────────────────────────
create table if not exists public.legacy_mentorships (
  student_player_id text primary key,
  manager_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text not null references public.legacy_players(id) on delete cascade,
  learned_attributes jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  last_tick_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_legacy_mentorships_manager
  on public.legacy_mentorships (manager_id);
create index if not exists idx_legacy_mentorships_legacy
  on public.legacy_mentorships (legacy_id);

comment on table public.legacy_mentorships is
  'Vínculo aluno→legacy (mentor único por aluno). learned_attributes acumula o progresso já aplicado.';
comment on column public.legacy_mentorships.learned_attributes is
  'Progresso persistido por atributo (jsonb numérico). Soma ao atributo-base do aluno até o teto do legacy.';

alter table public.legacy_mentorships enable row level security;

drop policy if exists "legacy_mentorships_owner_select" on public.legacy_mentorships;
create policy "legacy_mentorships_owner_select"
  on public.legacy_mentorships for select
  to authenticated
  using (manager_id = auth.uid());

drop policy if exists "legacy_mentorships_owner_modify" on public.legacy_mentorships;
create policy "legacy_mentorships_owner_modify"
  on public.legacy_mentorships for all
  to authenticated
  using (manager_id = auth.uid())
  with check (manager_id = auth.uid());

grant select, insert, update, delete on table public.legacy_mentorships to authenticated;

-- ─── 3. set_legacy_mentor (troca livre, preserva progresso por aluno) ────────
create or replace function public.set_legacy_mentor(
  p_student_player_id text,
  p_legacy_id text
)
returns public.legacy_mentorships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.legacy_mentorships;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  insert into public.legacy_mentorships (student_player_id, manager_id, legacy_id)
  values (p_student_player_id, auth.uid(), p_legacy_id)
  on conflict (student_player_id) do update
    set legacy_id = excluded.legacy_id,
        updated_at = now()
    where legacy_mentorships.manager_id = auth.uid()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.set_legacy_mentor(text, text) from public;
grant execute on function public.set_legacy_mentor(text, text) to authenticated;

comment on function public.set_legacy_mentor(text, text) is
  'Define/troca o mentor legacy de um aluno. Progresso (learned_attributes) é preservado por aluno.';

-- ─── 4. tick_legacy_mentorships: +1/dia nos atributos ensinados, teto no legacy
-- Chamada por cliente (ex.: no login) ou cron. Aplica o delta em dias completos
-- desde last_tick_at para cada mentoria do manager, respeitando o teto do legacy.
create or replace function public.tick_legacy_mentorships(p_manager_id uuid default null)
returns table (
  student_player_id text,
  legacy_id text,
  ticks_applied int,
  learned_attributes jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager uuid;
  rec record;
  v_days int;
  v_learned jsonb;
  v_legacy_attrs jsonb;
  v_attr text;
  v_cap numeric;
  v_current numeric;
  v_new numeric;
begin
  v_manager := coalesce(p_manager_id, auth.uid());
  if v_manager is null then
    raise exception 'auth required';
  end if;

  for rec in
    select m.student_player_id, m.legacy_id, m.learned_attributes, m.last_tick_at,
           l.taught_attributes, l.attributes as legacy_attrs
      from public.legacy_mentorships m
      join public.legacy_players l on l.id = m.legacy_id
     where m.manager_id = v_manager
     for update of m
  loop
    v_days := greatest(0, floor(extract(epoch from (now() - rec.last_tick_at)) / 86400)::int);
    if v_days <= 0 then
      continue;
    end if;

    v_learned := coalesce(rec.learned_attributes, '{}'::jsonb);
    v_legacy_attrs := coalesce(rec.legacy_attrs, '{}'::jsonb);

    foreach v_attr in array rec.taught_attributes
    loop
      v_cap := coalesce((v_legacy_attrs ->> v_attr)::numeric, 0);
      v_current := coalesce((v_learned ->> v_attr)::numeric, 0);
      v_new := least(v_current + v_days, v_cap);
      v_learned := v_learned || jsonb_build_object(v_attr, v_new);
    end loop;

    update public.legacy_mentorships
       set learned_attributes = v_learned,
           last_tick_at = last_tick_at + make_interval(days => v_days),
           updated_at = now()
     where student_player_id = rec.student_player_id;

    student_player_id := rec.student_player_id;
    legacy_id := rec.legacy_id;
    ticks_applied := v_days;
    learned_attributes := v_learned;
    return next;
  end loop;

  return;
end;
$$;

revoke all on function public.tick_legacy_mentorships(uuid) from public;
grant execute on function public.tick_legacy_mentorships(uuid) to authenticated;

comment on function public.tick_legacy_mentorships(uuid) is
  'Aplica +1/dia (por dia completo desde last_tick_at) em cada taught_attribute do legacy, com teto no atributo do legacy. Retorna resumo por mentoria atualizada.';

-- ─── 5. Storage bucket para retratos de legacies ────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'legacy-player-portraits',
  'legacy-player-portraits',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "legacy_portraits_public_read" on storage.objects;
create policy "legacy_portraits_public_read"
  on storage.objects for select
  using (bucket_id = 'legacy-player-portraits');
