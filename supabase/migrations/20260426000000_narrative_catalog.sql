-- Catálogo de narrativas pré-geradas pelo GameSpirit.
-- Motivação: substituir chamadas LLM em tempo real durante partidas (caras,
-- escalam linear com usuários) por consumo offline determinístico.
--
-- Fluxo:
--   1. Admin (ou cron semanal) chama `generate-narrative-catalog` script.
--   2. Script pede N templates ao Anthropic (Haiku) em batch.
--   3. Script insere via RPC `insert_narrative_batch`.
--   4. Runtime cliente hidrata via `get_narrative_templates` ao montar partida.
--   5. `pickNarrative(category, context, seed)` escolhe deterministicamente.
--
-- Qualidade é ajustada por `quality_rating` (thumbs up/down do manager).

create table if not exists public.narrative_templates (
  id              uuid primary key default gen_random_uuid(),
  category        text not null,      -- 'goal','shot_saved','foul_yellow',...
  intensity       text not null,      -- 'low'|'medium'|'high'|'world_class'
  context_tags    text[] default '{}',-- ['last_minute','comeback','rival',...]
  template        text not null,      -- "{player} arrisca de fora — {outcome}"
  variables       jsonb default '{}', -- { outcome: ['morre no poste','beija a rede'], ... }
  persona_vibe    text default 'casual', -- 'analytical'|'visceral'|'poetic'|'casual'
  generated_at    timestamptz not null default now(),
  batch_id        uuid,
  usage_count     int not null default 0,
  quality_rating  numeric not null default 0.5,
  active          boolean not null default true
);

create index if not exists idx_ntpl_cat_intensity
  on public.narrative_templates (category, intensity)
  where active = true;
create index if not exists idx_ntpl_batch
  on public.narrative_templates (batch_id);

alter table public.narrative_templates enable row level security;

-- Qualquer autenticado lê o catálogo (não é segredo).
drop policy if exists ntpl_public_read on public.narrative_templates;
create policy ntpl_public_read on public.narrative_templates
  for select
  to authenticated, anon
  using (active = true);

-- Escrita só via RPC.
drop policy if exists ntpl_no_direct_write on public.narrative_templates;
create policy ntpl_no_direct_write on public.narrative_templates
  for all
  using (false)
  with check (false);

grant select on table public.narrative_templates to authenticated, anon;

-- ─── RPC: listar templates (runtime) ──────────────────────────────────
-- Filtra por categoria. Ordena por (quality desc, usage asc) pra rotacionar
-- os menos usados e mais bem avaliados.
create or replace function public.get_narrative_templates(
  p_category text default null,
  p_limit int default 500
)
returns setof public.narrative_templates
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
    select *
      from public.narrative_templates
     where active = true
       and (p_category is null or category = p_category)
     order by quality_rating desc, usage_count asc
     limit greatest(1, least(coalesce(p_limit, 500), 2000));
end;
$$;

revoke all on function public.get_narrative_templates(text, int) from public;
grant execute on function public.get_narrative_templates(text, int) to authenticated, anon;

-- ─── RPC: inserir batch (admin/script) ────────────────────────────────
-- Recebe array JSONB com N templates e insere em uma transação com o
-- mesmo `batch_id`. Use do script gerador e admin panel.
create or replace function public.admin_insert_narrative_batch(
  p_templates jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid := gen_random_uuid();
  v_row jsonb;
begin
  -- service_role bypass: permite o script CLI gravar sem sessão admin.
  if auth.role() <> 'service_role' and not public.is_admin() then
    raise exception 'admin required';
  end if;
  if jsonb_typeof(p_templates) <> 'array' then
    raise exception 'p_templates must be a JSON array';
  end if;
  for v_row in select * from jsonb_array_elements(p_templates)
  loop
    insert into public.narrative_templates (
      category, intensity, context_tags, template, variables,
      persona_vibe, batch_id
    ) values (
      v_row->>'category',
      coalesce(v_row->>'intensity', 'medium'),
      coalesce((
        select array_agg(value::text)
          from jsonb_array_elements_text(v_row->'context_tags')
      ), '{}'),
      v_row->>'template',
      coalesce(v_row->'variables', '{}'::jsonb),
      coalesce(v_row->>'persona_vibe', 'casual'),
      v_batch_id
    );
  end loop;
  return v_batch_id;
end;
$$;

revoke all on function public.admin_insert_narrative_batch(jsonb) from public;
grant execute on function public.admin_insert_narrative_batch(jsonb) to authenticated;

-- ─── RPC: ajustar quality_rating (feedback do manager) ────────────────
-- Thumbs up/down no feed da partida. EMA com alpha=0.3 pra não oscilar.
create or replace function public.rate_narrative_template(
  p_id uuid,
  p_positive boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alpha numeric := 0.3;
  v_delta numeric := case when p_positive then 1.0 else 0.0 end;
begin
  update public.narrative_templates
     set quality_rating = round((quality_rating * (1 - v_alpha) + v_delta * v_alpha)::numeric, 3)
   where id = p_id;
end;
$$;

revoke all on function public.rate_narrative_template(uuid, boolean) from public;
grant execute on function public.rate_narrative_template(uuid, boolean) to authenticated;

-- ─── RPC: incrementar usage_count (runtime) ───────────────────────────
-- Opcional: pode ser batched no cliente pra evitar N calls por partida.
create or replace function public.bump_narrative_usage(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.narrative_templates
     set usage_count = usage_count + 1
   where id = any(p_ids);
end;
$$;

revoke all on function public.bump_narrative_usage(uuid[]) from public;
grant execute on function public.bump_narrative_usage(uuid[]) to authenticated;

-- ─── RPC: agregação do admin (painel de narrativas) ────────────────────
create or replace function public.admin_narrative_stats()
returns table (
  category text,
  intensity text,
  total int,
  avg_quality numeric,
  total_usage bigint,
  last_batch timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin required';
  end if;
  return query
    select
      nt.category,
      nt.intensity,
      count(*)::int as total,
      round(avg(nt.quality_rating)::numeric, 3) as avg_quality,
      sum(nt.usage_count)::bigint as total_usage,
      max(nt.generated_at) as last_batch
    from public.narrative_templates nt
    where active = true
    group by nt.category, nt.intensity
    order by nt.category, nt.intensity;
end;
$$;

revoke all on function public.admin_narrative_stats() from public;
grant execute on function public.admin_narrative_stats() to authenticated;
