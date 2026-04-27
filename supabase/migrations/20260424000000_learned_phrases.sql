-- Learned voice phrases: dicionário personalizado por manager.
-- Cresce a cada confirmação "Você quis dizer…? Sim" no painel de comando.
-- Cross-device: manager vê as frases aprendidas em qualquer dispositivo.
-- Admin também consulta agregado global pra expandir o parser determinístico.

create table if not exists public.manager_learned_phrases (
  id              uuid primary key default gen_random_uuid(),
  manager_id      uuid not null references auth.users(id) on delete cascade,
  phrase          text not null,        -- frase normalizada (lower, sem acentos)
  stem            text not null,        -- stem sem nome de jogador
  intent          text not null,        -- VoiceIntent enum (string)
  canonical_phrase text not null,       -- frase que o parser determinístico reconhece
  confirm_count   int  not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (manager_id, phrase)
);

create index if not exists idx_mlp_manager_updated
  on public.manager_learned_phrases (manager_id, updated_at desc);
create index if not exists idx_mlp_intent
  on public.manager_learned_phrases (intent);
create index if not exists idx_mlp_stem
  on public.manager_learned_phrases (stem);

alter table public.manager_learned_phrases enable row level security;

-- Manager lê seu próprio dicionário; admin lê tudo.
drop policy if exists mlp_select_self on public.manager_learned_phrases;
create policy mlp_select_self on public.manager_learned_phrases
  for select
  using (manager_id = auth.uid() or public.is_admin());

-- Inserção/atualização só via RPC (ver abaixo) — bloqueia acesso direto.
drop policy if exists mlp_no_direct_write on public.manager_learned_phrases;
create policy mlp_no_direct_write on public.manager_learned_phrases
  for all
  using (false)
  with check (false);

-- ─── RPC: upsert frase aprendida ────────────────────────────────────────
create or replace function public.record_learned_phrase(
  p_phrase text,
  p_stem text,
  p_intent text,
  p_canonical_phrase text
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
    raise exception 'must be authenticated';
  end if;
  if p_phrase is null or length(trim(p_phrase)) = 0 then
    raise exception 'phrase required';
  end if;
  if p_intent is null or length(trim(p_intent)) = 0 then
    raise exception 'intent required';
  end if;

  insert into public.manager_learned_phrases
    (manager_id, phrase, stem, intent, canonical_phrase)
  values
    (auth.uid(), lower(trim(p_phrase)), coalesce(p_stem, ''), p_intent, p_canonical_phrase)
  on conflict (manager_id, phrase)
  do update set
    intent = excluded.intent,
    stem = excluded.stem,
    canonical_phrase = excluded.canonical_phrase,
    confirm_count = public.manager_learned_phrases.confirm_count + 1,
    updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.record_learned_phrase(text, text, text, text) from public;
grant execute on function public.record_learned_phrase(text, text, text, text) to authenticated;

-- ─── RPC: lista do manager (hidrata localStorage) ───────────────────────
create or replace function public.get_manager_learned_phrases(
  p_user_id uuid default null,
  p_limit int default 500
)
returns setof public.manager_learned_phrases
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
begin
  if v_uid is null then
    return;
  end if;
  if v_uid <> auth.uid() and not public.is_admin() then
    raise exception 'forbidden';
  end if;
  return query
    select *
    from public.manager_learned_phrases
    where manager_id = v_uid
    order by updated_at desc
    limit greatest(1, least(p_limit, 2000));
end;
$$;

revoke all on function public.get_manager_learned_phrases(uuid, int) from public;
grant execute on function public.get_manager_learned_phrases(uuid, int) to authenticated;

-- ─── RPC: top frases agregadas (admin) ──────────────────────────────────
create or replace function public.admin_top_learned_phrases(
  p_limit int default 100,
  p_intent text default null
)
returns table (
  phrase text,
  stem text,
  intent text,
  canonical_phrase text,
  distinct_managers int,
  total_confirms bigint,
  last_confirmed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  return query
    select
      p.phrase,
      min(p.stem) as stem,
      p.intent,
      min(p.canonical_phrase) as canonical_phrase,
      count(distinct p.manager_id)::int as distinct_managers,
      sum(p.confirm_count)::bigint as total_confirms,
      max(p.updated_at) as last_confirmed_at
    from public.manager_learned_phrases p
    where (p_intent is null or p.intent = p_intent)
    group by p.phrase, p.intent
    order by total_confirms desc, distinct_managers desc
    limit greatest(1, least(p_limit, 1000));
end;
$$;

revoke all on function public.admin_top_learned_phrases(int, text) from public;
grant execute on function public.admin_top_learned_phrases(int, text) to authenticated;

-- ─── RPC: admin apaga frase aprendida globalmente ──────────────────────
-- Útil se uma frase virou padrão do parser e queremos limpar o dicionário.
create or replace function public.admin_delete_learned_phrase(p_phrase text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  delete from public.manager_learned_phrases
  where phrase = lower(trim(p_phrase));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_delete_learned_phrase(text) from public;
grant execute on function public.admin_delete_learned_phrase(text) to authenticated;
