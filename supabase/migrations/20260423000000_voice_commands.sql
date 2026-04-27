-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — voice_commands
--
-- Persistência do sistema de comandos de voz:
--   1. `manager_voice_commands` — log de todo comando efetivo emitido em partida.
--      Usado por `get_manager_persona()` pra inferir estilo do treinador.
--   2. `profanity_words` — lista de palavras censuradas, admin-editável.
--   3. RPCs: record_voice_command, get_manager_persona,
--            admin_add_profanity, admin_remove_profanity.
--
-- Guard: todos os admin_* checam `is_admin()` (já existe em 20260422000000).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. manager_voice_commands ──────────────────────────────────────────────
create table if not exists public.manager_voice_commands (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid,
  intent text not null,
  target_player_id text,
  tier text,
  effective_obedience numeric,
  individual_obedience numeric,
  team_obedience_at_time numeric,
  raw_text text,
  assistant text,
  minute int,
  created_at timestamptz not null default now()
);

create index if not exists idx_mvc_manager_created
  on public.manager_voice_commands (manager_id, created_at desc);
create index if not exists idx_mvc_intent
  on public.manager_voice_commands (intent);
create index if not exists idx_mvc_assistant
  on public.manager_voice_commands (assistant);

alter table public.manager_voice_commands enable row level security;

drop policy if exists "mvc_self_read" on public.manager_voice_commands;
create policy "mvc_self_read"
  on public.manager_voice_commands for select
  to authenticated
  using (manager_id = auth.uid() or public.is_admin());

grant select on table public.manager_voice_commands to authenticated;

comment on table public.manager_voice_commands is
  'Log de comandos de voz do manager em partidas. Usado pra inferir perfil/estilo.';

-- ─── 2. profanity_words ─────────────────────────────────────────────────────
create table if not exists public.profanity_words (
  word text primary key,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  active boolean not null default true
);

alter table public.profanity_words enable row level security;

drop policy if exists "profanity_public_read" on public.profanity_words;
create policy "profanity_public_read"
  on public.profanity_words for select
  to authenticated
  using (active = true);

grant select on table public.profanity_words to authenticated;

comment on table public.profanity_words is
  'Lista de palavrões detectados pelo árbitro. Admin-editável via RPC.';

-- ─── 3. RPCs ────────────────────────────────────────────────────────────────

-- record_voice_command: qualquer manager autenticado registra SEU comando.
create or replace function public.record_voice_command(
  p_match_id uuid,
  p_intent text,
  p_target_player_id text,
  p_tier text,
  p_effective_obedience numeric,
  p_individual_obedience numeric,
  p_team_obedience_at_time numeric,
  p_raw_text text,
  p_assistant text,
  p_minute int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  insert into public.manager_voice_commands (
    manager_id, match_id, intent, target_player_id, tier,
    effective_obedience, individual_obedience, team_obedience_at_time,
    raw_text, assistant, minute
  )
  values (
    auth.uid(), p_match_id, p_intent, p_target_player_id, p_tier,
    p_effective_obedience, p_individual_obedience, p_team_obedience_at_time,
    p_raw_text, p_assistant, p_minute
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.record_voice_command(uuid, text, text, text, numeric, numeric, numeric, text, text, int) from public;
grant execute on function public.record_voice_command(uuid, text, text, text, numeric, numeric, numeric, text, text, int) to authenticated;

-- get_manager_persona: retorna agregados pra card no /profile.
create or replace function public.get_manager_persona(p_user_id uuid default null)
returns table (
  total_commands bigint,
  accepted_count bigint,
  refused_count bigint,
  top_intent text,
  top_intent_count bigint,
  top_assistant text,
  top_assistant_count bigint,
  avg_effective_obedience numeric,
  first_command_at timestamptz,
  last_command_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := coalesce(p_user_id, auth.uid());
  if v_uid is null then
    raise exception 'auth required';
  end if;
  -- Só retorna o próprio, a não ser que seja admin.
  if v_uid <> auth.uid() and not public.is_admin() then
    raise exception 'permission denied';
  end if;

  return query
    with base as (
      select * from public.manager_voice_commands where manager_id = v_uid
    ),
    top_intent_q as (
      select intent as ti, count(*) as tic
        from base group by intent order by count(*) desc limit 1
    ),
    top_assistant_q as (
      select assistant as ta, count(*) as tac
        from base where assistant is not null
        group by assistant order by count(*) desc limit 1
    )
    select
      (select count(*) from base) as total_commands,
      (select count(*) from base where tier in ('critical_accept','accept','weak_accept')) as accepted_count,
      (select count(*) from base where tier in ('refuse','protest')) as refused_count,
      (select ti from top_intent_q) as top_intent,
      (select tic from top_intent_q) as top_intent_count,
      (select ta from top_assistant_q) as top_assistant,
      (select tac from top_assistant_q) as top_assistant_count,
      (select avg(effective_obedience) from base) as avg_effective_obedience,
      (select min(created_at) from base) as first_command_at,
      (select max(created_at) from base) as last_command_at;
end;
$$;

revoke all on function public.get_manager_persona(uuid) from public;
grant execute on function public.get_manager_persona(uuid) to authenticated;

-- admin_add_profanity: admin adiciona palavra.
create or replace function public.admin_add_profanity(p_word text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin required';
  end if;
  insert into public.profanity_words (word, added_by, active)
  values (lower(trim(p_word)), auth.uid(), true)
  on conflict (word) do update set active = true;
  return true;
end;
$$;

revoke all on function public.admin_add_profanity(text) from public;
grant execute on function public.admin_add_profanity(text) to authenticated;

-- admin_remove_profanity: admin remove (soft-delete).
create or replace function public.admin_remove_profanity(p_word text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin required';
  end if;
  update public.profanity_words set active = false where word = lower(trim(p_word));
  return true;
end;
$$;

revoke all on function public.admin_remove_profanity(text) from public;
grant execute on function public.admin_remove_profanity(text) to authenticated;

-- ─── 4. Feature flag VOICE_COMMANDS_ENABLED no seed ─────────────────────────
update public.platform_config
   set value = value || jsonb_build_object('VOICE_COMMANDS_ENABLED', true)
 where key = 'feature_flags';
