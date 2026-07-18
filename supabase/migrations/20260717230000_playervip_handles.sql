-- ════════════════════════════════════════════════════════════════════════════
-- PLAYERVIP HANDLES — link de convite/vitrine por lenda ou facilitador
--
-- game.olefoot.com/playervip/<handle>  → página PÚBLICA (sem login) que:
--   • explica a lenda + mostra os cards da coleção (vitrine, NÃO vende ali)
--   • manda quem quer comprar pro jogo (/mercado/transfer)
--   • credita a rede de indicação do dono do link (referral_code) — viral
--
-- SEGURANÇA: é a antítese do link mágico. O link mágico loga como o dono e
-- JAMAIS pode ser compartilhado. Este handle é público e reutilizável e NUNCA
-- expõe e-mail (o RPC só devolve campos seguros).
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.playervip_handles (
  handle        text primary key,           -- slug curto, ex.: 'adauto'
  user_id       uuid not null,              -- dono do link (lenda ou facilitador)
  collection_id text,                       -- coleção em destaque (null = só landing)
  display_name  text not null,
  headline      text,
  referral_code text,                       -- código que credita a rede (viral)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.playervip_handles enable row level security;

-- Leitura pública (é uma landing). Escrita só via service role (admin/seed).
drop policy if exists playervip_handles_public_read on public.playervip_handles;
create policy playervip_handles_public_read
  on public.playervip_handles for select using (true);

-- ── RPC público: dados seguros da vitrine (nunca e-mail, nunca user_id) ──────
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
      'club',          lp.main_club,
      'phase',         lp.phase,
      'portrait',      lp.portrait_public_url,
      'narrativeTitle',lp.narrative_title,
      'tagline',       lp.tagline,
      'currency',      lp.currency,
      'priceCents',    lp.price_unit_cents,
      'mintOverall',   lp.mint_overall,
      'attributes',    lp.attributes,
      'yearStart',     lp.year_start,
      'yearEnd',       lp.year_end
    )
    order by lp.year_start nulls last, lp.created_at
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

-- ── Seed: Adauto ────────────────────────────────────────────────────────────
-- referral_code = CJN26GB2 (facilitador Andre Figer / afiger@gmail.com), porque
-- a conta da própria lenda é só-playervip e não é nó da rede de afiliados.
insert into public.playervip_handles
  (handle, user_id, collection_id, display_name, headline, referral_code)
values
  ('adauto', 'b0d913c8-8ce1-4960-b196-f541e2cebe20', 'mem-adauto-2026',
   'Adauto', 'O menino de Santo André que virou símbolo na Europa.', 'CJN26GB2')
on conflict (handle) do update set
  user_id       = excluded.user_id,
  collection_id = excluded.collection_id,
  display_name  = excluded.display_name,
  headline      = excluded.headline,
  referral_code = excluded.referral_code,
  updated_at    = now();
