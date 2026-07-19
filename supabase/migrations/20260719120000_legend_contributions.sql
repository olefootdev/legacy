-- ════════════════════════════════════════════════════════════════════════════
-- A LENDA FALA — caixa de entrada única das contribuições do atleta
--
-- Três coisas, um lugar só:
--   correcao   → "isso no meu card está errado"
--   historia   → áudio + transcrição contando a própria história
--   novo_card  → "quero um card do meu período no clube X"
--
-- Por que UMA tabela e não três: é o mesmo fluxo (a lenda manda → alguém lê →
-- vira ação no card). Três tabelas viram três telas de admin e coisa se perde.
--
-- SEGURANÇA: só o BENEFICIÁRIO do card contribui, e a checagem é no servidor
-- (SECURITY DEFINER). A UI esconder o botão não é garantia de nada.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Vitrine: o RPC passa a devolver posição e raridade ───────────────────
create or replace function public.get_playervip_landing(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h     public.playervip_handles;
  cards jsonb;
begin
  select * into h
  from public.playervip_handles
  where lower(handle) = lower(trim(coalesce(p_handle, '')));

  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',            lp.id,
      'name',          lp.name,
      'pos',           lp.pos,
      'club',          lp.main_club,
      'phase',         lp.phase,
      'portrait',      lp.portrait_public_url,
      'narrativeTitle',lp.narrative_title,
      'tagline',       lp.tagline,
      'currency',      lp.currency,
      'priceCents',    lp.price_unit_cents,
      'mintOverall',   lp.mint_overall,
      'attributes',    lp.attributes,
      'rarity',        lp.rarity_label,
      'yearStart',     lp.year_start,
      'yearEnd',       lp.year_end
    )
    order by lp.tier nulls last, lp.year_start nulls last, lp.created_at
  ), '[]'::jsonb)
  into cards
  from public.legacy_players lp
  where lp.collection_id = h.collection_id
    and lp.listed_on_market = true;

  return jsonb_build_object(
    'handle',       h.handle,
    'displayName',  h.display_name,
    'headline',     h.headline,
    'referralCode', h.referral_code,
    'collectionId', h.collection_id,
    'cards',        coalesce(cards, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_playervip_landing(text) to anon, authenticated;

-- ── 2. Caixa de entrada ─────────────────────────────────────────────────────
create table if not exists public.legend_contributions (
  id               bigserial primary key,
  kind             text not null check (kind in ('correcao', 'historia', 'novo_card')),
  user_id          uuid not null,
  -- Card específico. NULL quando a contribuição é da coleção toda
  -- (uma história, ou o pedido de um card que ainda não existe).
  legacy_player_id text,
  message          text,          -- texto livre / transcrição do áudio
  audio_path       text,          -- caminho no bucket 'legend-stories'
  payload          jsonb not null default '{}'::jsonb,  -- campos por tipo
  status           text not null default 'pendente'
                     check (status in ('pendente', 'aceita', 'recusada')),
  admin_note       text,
  created_at       timestamptz not null default now(),
  reviewed_at      timestamptz
);

create index if not exists legend_contrib_user_idx   on public.legend_contributions (user_id, created_at desc);
create index if not exists legend_contrib_status_idx on public.legend_contributions (status, created_at desc);
create index if not exists legend_contrib_card_idx   on public.legend_contributions (legacy_player_id);

alter table public.legend_contributions enable row level security;
-- Sem policy direta: tudo passa pelos RPCs abaixo.

/**
 * A lenda envia uma contribuição.
 *
 * `p_legacy_player_id` é obrigatório para 'correcao' (é sobre um card
 * específico) e opcional para 'historia' e 'novo_card'. Quando vem preenchido,
 * exige que quem chama seja o beneficiário daquele card.
 */
create or replace function public.submit_legend_contribution(
  p_kind             text,
  p_message          text default null,
  p_legacy_player_id text default null,
  p_payload          jsonb default '{}'::jsonb,
  p_audio_path       text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  owner_id  uuid;
  is_legend boolean;
  abertas   int;
  new_id    bigint;
begin
  if uid is null then
    raise exception 'não autenticado';
  end if;

  if p_kind not in ('correcao', 'historia', 'novo_card') then
    raise exception 'tipo inválido';
  end if;

  if p_kind = 'correcao' and coalesce(trim(p_legacy_player_id), '') = '' then
    raise exception 'correção precisa apontar o card';
  end if;

  -- Precisa ter conteúdo: texto OU áudio.
  if coalesce(trim(p_message), '') = '' and coalesce(trim(p_audio_path), '') = '' then
    raise exception 'contribuição vazia';
  end if;

  -- Card informado → tem que ser dele.
  if coalesce(trim(p_legacy_player_id), '') <> '' then
    select beneficiary_user_id into owner_id
    from public.legacy_players
    where id = p_legacy_player_id;

    if owner_id is null or owner_id <> uid then
      raise exception 'apenas o dono do card pode contribuir';
    end if;
  else
    -- Sem card: exige que a pessoa seja dona de ALGUM card (é uma lenda).
    select exists(
      select 1 from public.legacy_players where beneficiary_user_id = uid
    ) into is_legend;

    if not is_legend then
      raise exception 'apenas atletas com card podem contribuir';
    end if;
  end if;

  -- Guarda anti-flood: no máximo 10 contribuições em análise por pessoa.
  select count(*) into abertas
  from public.legend_contributions
  where user_id = uid and status = 'pendente';

  if abertas >= 10 then
    raise exception 'você já tem 10 envios em análise; aguarde a resposta';
  end if;

  insert into public.legend_contributions (kind, user_id, legacy_player_id, message, audio_path, payload)
  values (
    p_kind, uid,
    nullif(trim(p_legacy_player_id), ''),
    nullif(trim(p_message), ''),
    nullif(trim(p_audio_path), ''),
    coalesce(p_payload, '{}'::jsonb)
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.submit_legend_contribution(text, text, text, jsonb, text) to authenticated;

/** A lenda vê os próprios envios e em que pé estão. */
create or replace function public.get_my_legend_contributions()
returns table (
  id bigint, kind text, legacy_player_id text, message text, audio_path text,
  payload jsonb, status text, admin_note text, created_at timestamptz, reviewed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, kind, legacy_player_id, message, audio_path, payload,
         status, admin_note, created_at, reviewed_at
  from public.legend_contributions
  where user_id = auth.uid()
  order by created_at desc
  limit 100;
$$;

grant execute on function public.get_my_legend_contributions() to authenticated;

-- ── 3. Bucket privado para os áudios ────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('legend-stories', 'legend-stories', false)
on conflict (id) do nothing;

-- A lenda escreve e lê só dentro da própria pasta (<uid>/arquivo.webm).
drop policy if exists legend_stories_insert_own on storage.objects;
create policy legend_stories_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'legend-stories'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists legend_stories_read_own on storage.objects;
create policy legend_stories_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'legend-stories'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
