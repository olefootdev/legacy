-- ════════════════════════════════════════════════════════════════════════════
-- 1) VITRINE: o RPC passa a devolver a POSIÇÃO de cada card
--    Necessário pra destacar os atributos que definem o ofício (ATA=gol,
--    VOL=desarme, MEI=assistência). Ver src/entities/ovrWeights.ts.
--
-- 2) SUGERIR CORREÇÃO: a lenda corrige a própria ficha
--    Quem viveu a carreira sabe mais que qualquer matéria. Só o BENEFICIÁRIO do
--    card pode sugerir — a checagem é no servidor (SECURITY DEFINER), não na UI.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Landing com posição ──────────────────────────────────────────────────
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
      'pos',           lp.pos,              -- << novo
      'club',          lp.main_club,
      'phase',         lp.phase,
      'portrait',      lp.portrait_public_url,
      'narrativeTitle',lp.narrative_title,
      'tagline',       lp.tagline,
      'currency',      lp.currency,
      'priceCents',    lp.price_unit_cents,
      'mintOverall',   lp.mint_overall,
      'attributes',    lp.attributes,
      'rarity',        lp.rarity_label,     -- << novo
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

-- ── 2. Sugestões de correção ────────────────────────────────────────────────
create table if not exists public.card_correction_requests (
  id               bigserial primary key,
  legacy_player_id text not null,
  user_id          uuid not null,
  field            text,                    -- 'marcacao', 'bio', 'foto', 'historia'...
  message          text not null,
  status           text not null default 'pending'
                     check (status in ('pending', 'accepted', 'rejected')),
  admin_note       text,
  created_at       timestamptz not null default now(),
  reviewed_at      timestamptz
);

create index if not exists card_corrections_card_idx on public.card_correction_requests (legacy_player_id);
create index if not exists card_corrections_user_idx on public.card_correction_requests (user_id, created_at desc);

alter table public.card_correction_requests enable row level security;
-- Sem policy de INSERT/SELECT direto: tudo passa pelos RPCs abaixo.

/**
 * A lenda sugere uma correção no PRÓPRIO card.
 * Recusa se quem chama não for o beneficiário daquele card — a UI esconde o
 * botão, mas quem garante é aqui.
 */
create or replace function public.suggest_card_correction(
  p_legacy_player_id text,
  p_message          text,
  p_field            text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  uid      uuid := auth.uid();
  owner_id uuid;
  pendentes int;
  new_id   bigint;
begin
  if uid is null then
    raise exception 'não autenticado';
  end if;

  if coalesce(trim(p_message), '') = '' then
    raise exception 'mensagem vazia';
  end if;

  select beneficiary_user_id into owner_id
  from public.legacy_players
  where id = p_legacy_player_id;

  if owner_id is null or owner_id <> uid then
    raise exception 'apenas o dono do card pode sugerir correção';
  end if;

  -- Guarda simples anti-flood: no máximo 10 sugestões abertas por pessoa.
  select count(*) into pendentes
  from public.card_correction_requests
  where user_id = uid and status = 'pending';

  if pendentes >= 10 then
    raise exception 'você já tem 10 sugestões em análise; aguarde a resposta';
  end if;

  insert into public.card_correction_requests (legacy_player_id, user_id, field, message)
  values (p_legacy_player_id, uid, nullif(trim(p_field), ''), trim(p_message))
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.suggest_card_correction(text, text, text) to authenticated;

/** A lenda vê as próprias sugestões e em que pé estão. */
create or replace function public.get_my_card_corrections()
returns table (
  id bigint, legacy_player_id text, field text, message text,
  status text, admin_note text, created_at timestamptz, reviewed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, legacy_player_id, field, message, status, admin_note, created_at, reviewed_at
  from public.card_correction_requests
  where user_id = auth.uid()
  order by created_at desc
  limit 100;
$$;

grant execute on function public.get_my_card_corrections() to authenticated;
