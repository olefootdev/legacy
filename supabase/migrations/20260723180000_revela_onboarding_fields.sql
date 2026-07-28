-- ⚠️ SUPERADA POR 20260723210000_revela_onboarding_v2.sql — NÃO APLICAR.
--
-- Esta migration nasceu pra adicionar só a altura. Horas depois o escopo do
-- onboarding cresceu (apelido, categoria, situação, empresário, sonho, redes,
-- foto, responsável de menor) e o envio deixou de exigir login — a v2 refaz
-- todas as funções daqui, com `p_height_cm` incluso, e ainda dá `drop` nas
-- assinaturas que esta criava.
--
-- Fica no repositório como histórico. Aplicar as duas não quebra nada (a v2
-- roda depois e vence), mas é trabalho à toa.
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- REVELA — altura no cadastro do talento
--
-- `revela_talents.height_cm` já existe desde a primeira migration, mas o RPC de
-- envio não aceitava o parâmetro: o atleta não tinha como informar, e o campo
-- ficava sempre nulo. Altura é dado básico de scouting — pra goleiro e zagueiro
-- ela muda a leitura do jogador tanto quanto um atributo.
--
-- A função é recriada inteira (não dá pra "adicionar parâmetro" em Postgres) e
-- mantém a assinatura antiga funcionando: `p_height_cm` entra no fim, com
-- default, então chamada sem ele continua válida.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.revela_submit_talent(
  p_name          text,
  p_pos           text,
  p_club          text default null,
  p_city          text default null,
  p_uf            text default null,
  p_birth_year    int  default null,
  p_strong_foot   text default null,
  p_bio           text default null,
  p_video_url     text default null,
  p_contact_phone text default null,
  p_referral_code text default null,
  p_height_cm     int  default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  base_slug text;
  try_slug  text;
  n         int := 0;
  new_id    uuid;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;
  if coalesce(trim(p_name), '') = '' or length(trim(p_name)) < 2 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_name');
  end if;
  if coalesce(trim(p_pos), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_pos');
  end if;

  -- Um perfil por conta enquanto estiver na fila ou aprovado.
  if exists (
    select 1 from public.revela_talents
    where user_id = uid and status <> 'rejected'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_submitted');
  end if;

  base_slug := regexp_replace(
    lower(unaccent_safe(trim(p_name))), '[^a-z0-9]+', '-', 'g'
  );
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then base_slug := 'talento'; end if;

  try_slug := base_slug;
  while exists (select 1 from public.revela_talents where slug = try_slug) loop
    n := n + 1;
    try_slug := base_slug || '-' || n::text;
  end loop;

  insert into public.revela_talents (
    slug, name, pos, club, city, uf, birth_year, strong_foot, height_cm, bio,
    video_url, contact_phone, contact_email, user_id, referral_code, status
  )
  values (
    try_slug, trim(p_name), upper(trim(p_pos)), nullif(trim(coalesce(p_club,'')),''),
    nullif(trim(coalesce(p_city,'')),''), nullif(upper(trim(coalesce(p_uf,''))),''),
    p_birth_year, nullif(trim(coalesce(p_strong_foot,'')),''),
    -- Faixa sanitária: fora dela é digitação errada, não atleta.
    case when p_height_cm between 120 and 230 then p_height_cm else null end,
    nullif(trim(coalesce(p_bio,'')),''), nullif(trim(coalesce(p_video_url,'')),''),
    nullif(regexp_replace(coalesce(p_contact_phone,''), '\D', '', 'g'), ''),
    (select email from auth.users where id = uid),
    uid, nullif(trim(coalesce(p_referral_code,'')),''), 'pending'
  )
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id, 'slug', try_slug);
end;
$$;

grant execute on function public.revela_submit_talent(
  text, text, text, text, text, int, text, text, text, text, text, int
) to authenticated;

-- A versão de 11 parâmetros continua existindo como sobrecarga. Removê-la
-- deixaria o site quebrado no intervalo entre aplicar a migration e publicar o
-- front novo — e o front antigo nunca passa height_cm mesmo.


-- ── A ficha do OLE SCOUT passa a mostrar os campos novos ────────────────────
-- ⚠️ DROP antes do CREATE: esta função retorna TABLE(...), e o Postgres recusa
-- `create or replace` quando a lista de colunas muda ("cannot change return type
-- of existing function"). Para função que devolve jsonb isso não acontece — só
-- para as que declaram colunas OUT, como esta.
drop function if exists public.revela_admin_queue();

create or replace function public.revela_admin_queue()
returns table (
  id            uuid,
  slug          text,
  name          text,
  pos           text,
  club          text,
  city          text,
  uf            text,
  birth_year    int,
  strong_foot   text,
  height_cm     int,
  bio           text,
  status        text,
  overall       int,
  video_url     text,
  contact_phone text,
  contact_email text,
  created_at    timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select t.id, t.slug, t.name, t.pos, t.club, t.city, t.uf, t.birth_year,
         t.strong_foot, t.height_cm, t.bio,
         t.status, t.overall, t.video_url, t.contact_phone, t.contact_email,
         t.created_at
  from public.revela_talents t
  order by
    case t.status when 'pending' then 0 when 'in_review' then 1 else 2 end,
    t.created_at;
$$;

revoke execute on function public.revela_admin_queue() from anon, authenticated;


-- ── A vitrine devolve pé e altura ───────────────────────────────────────────
-- São dados públicos de ficha (aparecem em qualquer súmula), diferentes de
-- telefone e e-mail, que continuam fora de todo RPC público.
create or replace function public.revela_get_talent(p_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id',         rt.id,
    'slug',       rt.slug,
    'name',       rt.name,
    'pos',        rt.pos,
    'club',       rt.club,
    'city',       rt.city,
    'uf',         rt.uf,
    'country',    rt.country,
    'birthYear',  rt.birth_year,
    'strongFoot', rt.strong_foot,
    'heightCm',   rt.height_cm,
    'bio',        rt.bio,
    'portrait',   rt.portrait_url,
    'video',      rt.video_url,
    'attributes', rt.attributes,
    'overall',    rt.overall,
    'status',     rt.status,
    'carded',     rt.status = 'carded',
    'supporters', (select count(*)::int from public.revela_supports s where s.talent_id = rt.id),
    'createdAt',  rt.created_at
  )
  from public.revela_talents rt
  where lower(rt.slug) = lower(trim(coalesce(p_slug, '')))
    and rt.status in ('approved', 'carded');
$$;

grant execute on function public.revela_get_talent(text) to anon, authenticated;
