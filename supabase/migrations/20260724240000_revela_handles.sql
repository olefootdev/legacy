-- ════════════════════════════════════════════════════════════════════════════
-- REVELA — @username escolhido pelo jogador (o endereço + link de indicação)
--
-- Decisão do fundador: o jogador ESCOLHE o próprio nome de usuário no cadastro
-- (obrigatório), com confirmação de disponibilidade. Ele adora número — breno11,
-- jv9. Esse @ vira `revela.olefoot.com/<handle>`: o endereço do perfil E o link
-- de indicação dele (bonito de compartilhar, ao contrário do código aleatório).
--
-- UNICIDADE GLOBAL: o handle não pode colidir com outro talento NEM com o handle
-- de uma lenda (playervip_handles) — senão `/breno` seria de dois.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Coluna + unicidade (case-insensitive) ────────────────────────────────
alter table public.revela_talents add column if not exists handle text;

create unique index if not exists revela_talents_handle_uidx
  on public.revela_talents (lower(handle))
  where handle is not null;

comment on column public.revela_talents.handle is
  '@username escolhido pelo jogador (a-z 0-9 _, 3-20). Vira revela.olefoot.com/<handle> '
  '— endereço do perfil e link de indicação. Único (global, inclui lendas).';

-- ── 2. Palavras reservadas (colidem com rota ou marca) ──────────────────────
create or replace function public.revela_handle_reserved(p text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p, '')) in (
    'comecar', 't', 'lenda', 'playervip', 'api', 'admin', 'app', 'www', 'home',
    'login', 'entrar', 'cadastro', 'revela', 'olefoot', 'perfil', 'conta',
    'sobre', 'ajuda', 'suporte', 'assets', 'fonts', 'static', 'og-default',
    'null', 'undefined', 'me', 'eu', 'time', 'liga'
  );
$$;

-- ── 3. Checagem de disponibilidade (confirmação em tempo real no cadastro) ───
-- anon recebe execute: a confirmação acontece durante o cadastro anônimo.
create or replace function public.revela_check_handle(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  h text := lower(trim(coalesce(p_handle, '')));
begin
  if h !~ '^[a-z0-9_]{3,20}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if public.revela_handle_reserved(h) then
    return jsonb_build_object('ok', false, 'reason', 'reserved');
  end if;
  if exists (select 1 from public.revela_talents where lower(handle) = h)
     or exists (select 1 from public.playervip_handles where lower(handle) = h) then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end if;
  return jsonb_build_object('ok', true, 'handle', h);
end;
$$;

grant execute on function public.revela_check_handle(text) to anon, authenticated;

-- ── 4. O envio passa a EXIGIR o handle ──────────────────────────────────────
-- Some a assinatura antiga (22 args) e entra a nova com p_handle. Chamada por
-- nome (PostgREST), então a posição do novo parâmetro não quebra o cliente.
drop function if exists public.revela_submit_talent(
  text, text, text, text, text, text, int, int, text, text, text, boolean,
  text, text, text, text, text, text, text, text, text, text
);

create or replace function public.revela_submit_talent(
  p_name           text,
  p_pos            text,
  p_contact_phone  text,
  p_handle         text,
  p_nickname       text default null,
  p_category       text default null,
  p_strong_foot    text default null,
  p_birth_year     int  default null,
  p_height_cm      int  default null,
  p_guardian_name  text default null,
  p_guardian_phone text default null,
  p_game_situation text default null,
  p_has_agent      boolean default null,
  p_agent_name     text default null,
  p_club           text default null,
  p_city           text default null,
  p_uf             text default null,
  p_dream          text default null,
  p_video_url      text default null,
  p_instagram_url  text default null,
  p_tiktok_url     text default null,
  p_photo_url      text default null,
  p_referral_code  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  fone      text := nullif(regexp_replace(coalesce(p_contact_phone, ''), '\D', '', 'g'), '');
  fone_resp text := nullif(regexp_replace(coalesce(p_guardian_phone, ''), '\D', '', 'g'), '');
  v_handle  text := lower(trim(coalesce(p_handle, '')));
  idade     int;
  base_slug text;
  try_slug  text;
  n         int := 0;
  new_id    uuid;
begin
  if coalesce(trim(p_name), '') = '' or length(trim(p_name)) < 3 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_name');
  end if;
  if coalesce(trim(p_pos), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_pos');
  end if;
  if fone is null or length(fone) < 10 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_phone');
  end if;

  -- @username OBRIGATÓRIO, válido e único (global, inclui lendas).
  if v_handle !~ '^[a-z0-9_]{3,20}$' or public.revela_handle_reserved(v_handle) then
    return jsonb_build_object('ok', false, 'reason', 'handle_invalid');
  end if;
  if exists (select 1 from public.revela_talents where lower(handle) = v_handle)
     or exists (select 1 from public.playervip_handles where lower(handle) = v_handle) then
    return jsonb_build_object('ok', false, 'reason', 'handle_taken');
  end if;

  if p_birth_year is not null then
    idade := extract(year from now())::int - p_birth_year;
    if idade < 18 and (coalesce(trim(coalesce(p_guardian_name, '')), '') = '' or fone_resp is null) then
      return jsonb_build_object('ok', false, 'reason', 'guardian_required');
    end if;
  end if;

  if exists (
    select 1 from public.revela_talents
    where contact_phone = fone and status <> 'rejected'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_submitted');
  end if;

  base_slug := trim(both '-' from
    regexp_replace(lower(unaccent_safe(coalesce(nullif(trim(coalesce(p_nickname, '')), ''), trim(coalesce(p_name, ''))))), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'talento'; end if;

  try_slug := base_slug;
  while exists (select 1 from public.revela_talents where slug = try_slug) loop
    n := n + 1;
    try_slug := base_slug || '-' || n::text;
  end loop;

  insert into public.revela_talents (
    slug, handle, name, nickname, pos, category, strong_foot, birth_year, height_cm,
    guardian_name, guardian_phone, game_situation, has_agent, agent_name,
    club, city, uf, bio, video_url, instagram_url, tiktok_url, portrait_url,
    contact_phone, contact_email, user_id, referral_code, status
  )
  values (
    try_slug, v_handle, trim(p_name), nullif(trim(coalesce(p_nickname, '')), ''),
    upper(trim(p_pos)), nullif(trim(coalesce(p_category, '')), ''),
    nullif(trim(coalesce(p_strong_foot, '')), ''),
    p_birth_year,
    case when p_height_cm between 120 and 230 then p_height_cm else null end,
    case when idade is not null and idade < 18 then nullif(trim(coalesce(p_guardian_name, '')), '') end,
    case when idade is not null and idade < 18 then fone_resp end,
    nullif(trim(coalesce(p_game_situation, '')), ''),
    p_has_agent,
    case when coalesce(p_has_agent, false) then nullif(trim(coalesce(p_agent_name, '')), '') end,
    nullif(trim(coalesce(p_club, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(upper(trim(coalesce(p_uf, ''))), ''),
    left(nullif(trim(coalesce(p_dream, '')), ''), 250),
    nullif(trim(coalesce(p_video_url, '')), ''),
    nullif(trim(coalesce(p_instagram_url, '')), ''),
    nullif(trim(coalesce(p_tiktok_url, '')), ''),
    nullif(trim(coalesce(p_photo_url, '')), ''),
    fone,
    (select email from auth.users where id = uid),
    uid,
    nullif(trim(coalesce(p_referral_code, '')), ''),
    'pending'
  )
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id, 'slug', try_slug, 'handle', v_handle);

exception
  -- Corrida: dois envios com o mesmo @ ao mesmo tempo. O índice único é a trava
  -- real; aqui só traduzimos pro cliente em vez de estourar erro cru.
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'handle_taken');
end;
$$;

grant execute on function public.revela_submit_talent(
  text, text, text, text, text, text, text, int, int, text, text, text, boolean,
  text, text, text, text, text, text, text, text, text, text
) to anon, authenticated;

comment on function public.revela_submit_talent is
  'Envio do talento com @username OBRIGATÓRIO (p_handle). Anônimo (grant anon). '
  'Handle único global (talentos + lendas); corrida tratada por unique_violation.';
