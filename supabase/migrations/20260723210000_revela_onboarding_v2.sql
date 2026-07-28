-- ════════════════════════════════════════════════════════════════════════════
-- REVELA — onboarding v2: ficha completa e envio SEM CONTA
--
-- Duas mudanças, e a segunda muda o modelo de segurança do cadastro.
--
-- 1) CAMPOS NOVOS pedidos pelo fundador: apelido de jogo, categoria, situação
--    de jogo, empresário, sonho, redes sociais, foto, e — para menor de 18 —
--    nome e telefone do responsável.
--
-- 2) 🔴 O ENVIO DEIXA DE EXIGIR LOGIN.
--    Antes: `auth.uid()` obrigatório, um perfil por conta.
--    Agora: qualquer visitante envia; a conta vem depois, na aprovação.
--    Decisão do fundador (2026-07-23): "clicando em ENVIAR deve finalizar o
--    cadastro... e aí a gente aprova a conta em alguns minutos".
--
--    O QUE ISSO CUSTA: sem `auth.uid()` não existe mais dono, e a porta fica
--    aberta pra flood. As três travas que sobram:
--      • WhatsApp passa a ser OBRIGATÓRIO e único — é a identidade do cadastro
--        e o limite natural de repetição.
--      • Nada aparece na vitrine sem passar pelo OLE SCOUT (status 'pending').
--      • A função é a ÚNICA porta: `insert` direto continua revogado pra anon.
--    Não há rate limit por IP — o Postgres não enxerga IP. Se aparecer flood,
--    o lugar de resolver é no edge (Worker/Turnstile), não aqui.
--
-- 🔴 DADO DE MENOR DE IDADE: `guardian_name` e `guardian_phone` só existem
--    quando o atleta tem menos de 18 anos, e são tratados como o telefone dele
--    — nenhum RPC público devolve, nenhuma policy de select libera pra anon.
--    LGPD art. 14 trata dado de criança e adolescente com proteção reforçada:
--    se algum dia alguém for expor esses campos, precisa de base legal, não de
--    conveniência de tela.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Colunas novas ───────────────────────────────────────────────────────
alter table public.revela_talents
  add column if not exists nickname       text,
  add column if not exists category       text,
  add column if not exists game_situation text,
  add column if not exists has_agent      boolean,
  add column if not exists agent_name     text,
  add column if not exists dream          text,
  add column if not exists instagram_url  text,
  add column if not exists tiktok_url     text,
  -- 🔒 PII reforçada — responsável por menor de idade.
  add column if not exists guardian_name  text,
  add column if not exists guardian_phone text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'revela_talents_category_chk') then
    alter table public.revela_talents add constraint revela_talents_category_chk
      check (category is null or category in ('sub15','sub20','amador','profissional','legend'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'revela_talents_situation_chk') then
    alter table public.revela_talents add constraint revela_talents_situation_chk
      check (game_situation is null or game_situation in ('escolinha','junior','profissional'));
  end if;
end $$;

comment on column public.revela_talents.nickname is
  'Apelido de jogo — é o nome público do atleta e a base do slug.';
comment on column public.revela_talents.guardian_phone is
  '🔒 Telefone do responsável (atleta menor de 18). Dado de menor sob LGPD art. '
  '14: jamais devolver em RPC público nem abrir select pra anon.';

-- Um cadastro por WhatsApp. Sem `auth.uid()` esta é a única identidade que
-- sobra, e é o que segura repetição. Índice parcial: rejeitado não bloqueia
-- quem quer tentar de novo.
create unique index if not exists revela_talents_phone_uniq
  on public.revela_talents (contact_phone)
  where contact_phone is not null and status <> 'rejected';


-- ─── 2. Storage: foto de perfil do talento ──────────────────────────────────
-- Upload anônimo é aceitável AQUI porque nada é publicado sem revisão: o
-- talento nasce 'pending' e a foto só aparece na vitrine depois que o OLE SCOUT
-- aprova. Limite de 4 MB e só imagem.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'revela-talent-photos',
  'revela-talent-photos',
  true,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "revela_photos_public_read" on storage.objects;
create policy "revela_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'revela-talent-photos');

drop policy if exists "revela_photos_insert" on storage.objects;
create policy "revela_photos_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'revela-talent-photos'
    -- Prefixo fixo: impede usar o bucket como depósito de qualquer coisa.
    and name like 'talentos/%'
  );

-- Sem update e sem delete de propósito: quem subiu não mexe depois. Correção de
-- foto passa pelo admin.


-- ─── 3. O envio ─────────────────────────────────────────────────────────────
create or replace function public.revela_submit_talent(
  p_name           text,
  p_pos            text,
  p_contact_phone  text,
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
  publico   text := coalesce(nullif(trim(coalesce(p_nickname, '')), ''), trim(coalesce(p_name, '')));
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

  -- Sem conta, o telefone é a identidade do cadastro: sem ele não há como
  -- avisar a aprovação nem impedir repetição.
  if fone is null or length(fone) < 10 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_phone');
  end if;

  -- Menor de idade exige responsável. A checagem vive no SERVIDOR porque a
  -- tela pode ser contornada, e aqui o assunto é proteção de menor.
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
    regexp_replace(lower(unaccent_safe(publico)), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'talento'; end if;

  try_slug := base_slug;
  while exists (select 1 from public.revela_talents where slug = try_slug) loop
    n := n + 1;
    try_slug := base_slug || '-' || n::text;
  end loop;

  insert into public.revela_talents (
    slug, name, nickname, pos, category, strong_foot, birth_year, height_cm,
    guardian_name, guardian_phone, game_situation, has_agent, agent_name,
    club, city, uf, bio, video_url, instagram_url, tiktok_url, portrait_url,
    contact_phone, contact_email, user_id, referral_code, status
  )
  values (
    try_slug, trim(p_name), nullif(trim(coalesce(p_nickname, '')), ''),
    upper(trim(p_pos)), nullif(trim(coalesce(p_category, '')), ''),
    nullif(trim(coalesce(p_strong_foot, '')), ''),
    p_birth_year,
    case when p_height_cm between 120 and 230 then p_height_cm else null end,
    -- Só guarda dado do responsável quando ele é de fato necessário.
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
    uid,  -- nulo quando o envio é anônimo; preenchido na aprovação
    nullif(trim(coalesce(p_referral_code, '')), ''),
    'pending'
  )
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id, 'slug', try_slug);
end;
$$;

-- 🔴 `anon` recebe execute: é o que permite enviar sem conta.
grant execute on function public.revela_submit_talent(
  text, text, text, text, text, text, int, int, text, text, text, boolean,
  text, text, text, text, text, text, text, text, text, text
) to anon, authenticated;

-- As assinaturas antigas saem de circulação: elas não exigiam telefone, e com
-- envio anônimo isso viraria porta aberta pra cadastro sem identidade nenhuma.
drop function if exists public.revela_submit_talent(text, text, text, text, text, int, text, text, text, text, text);
drop function if exists public.revela_submit_talent(text, text, text, text, text, int, text, text, text, text, text, int);


-- ─── 4. A fila do OLE SCOUT enxerga tudo ────────────────────────────────────
-- ⚠️ DROP antes do CREATE: esta função retorna TABLE(...), e o Postgres recusa
-- `create or replace` quando a lista de colunas muda ("cannot change return type
-- of existing function"). Para função que devolve jsonb isso não acontece — só
-- para as que declaram colunas OUT, como esta.
drop function if exists public.revela_admin_queue();

create or replace function public.revela_admin_queue()
returns table (
  id             uuid,
  slug           text,
  name           text,
  nickname       text,
  pos            text,
  category       text,
  game_situation text,
  club           text,
  city           text,
  uf             text,
  birth_year     int,
  idade          int,
  strong_foot    text,
  height_cm      int,
  has_agent      boolean,
  agent_name     text,
  dream          text,
  status         text,
  overall        int,
  portrait_url   text,
  video_url      text,
  instagram_url  text,
  tiktok_url     text,
  contact_phone  text,
  contact_email  text,
  guardian_name  text,
  guardian_phone text,
  user_id        uuid,
  created_at     timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select t.id, t.slug, t.name, t.nickname, t.pos, t.category, t.game_situation,
         t.club, t.city, t.uf, t.birth_year,
         case when t.birth_year is not null
              then extract(year from now())::int - t.birth_year end,
         t.strong_foot, t.height_cm, t.has_agent, t.agent_name, t.dream,
         t.status, t.overall, t.portrait_url, t.video_url, t.instagram_url,
         t.tiktok_url, t.contact_phone, t.contact_email,
         t.guardian_name, t.guardian_phone, t.user_id, t.created_at
  from public.revela_talents t
  order by
    case t.status when 'pending' then 0 when 'in_review' then 1 else 2 end,
    t.created_at;
$$;

revoke execute on function public.revela_admin_queue() from anon, authenticated;


-- ─── 5. A vitrine devolve os campos públicos novos ──────────────────────────
-- Público aqui = o que apareceria numa súmula ou numa ficha de peneira. Fora:
-- telefone, e-mail, responsável, empresário — nenhum sai por RPC público.
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
    'name',       coalesce(nullif(rt.nickname, ''), rt.name),
    'fullName',   rt.name,
    'pos',        rt.pos,
    'category',   rt.category,
    'situation',  rt.game_situation,
    'club',       rt.club,
    'city',       rt.city,
    'uf',         rt.uf,
    'country',    rt.country,
    'birthYear',  rt.birth_year,
    'strongFoot', rt.strong_foot,
    'heightCm',   rt.height_cm,
    'bio',        rt.bio,
    'dream',      rt.dream,
    'portrait',   rt.portrait_url,
    'video',      rt.video_url,
    'instagram',  rt.instagram_url,
    'tiktok',     rt.tiktok_url,
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


-- A listagem também passa a usar o apelido como nome público.
create or replace function public.revela_list_talents(
  p_limit int default 24,
  p_order text default 'overall'
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(q.payload order by q.ord), '[]'::jsonb)
  from (
    select
      jsonb_build_object(
        'id',         rt.id,
        'slug',       rt.slug,
        'name',       coalesce(nullif(rt.nickname, ''), rt.name),
        'pos',        rt.pos,
        'category',   rt.category,
        'club',       rt.club,
        'city',       rt.city,
        'uf',         rt.uf,
        'country',    rt.country,
        'birthYear',  rt.birth_year,
        'strongFoot', rt.strong_foot,
        'bio',        rt.bio,
        'dream',      rt.dream,
        'portrait',   rt.portrait_url,
        'video',      rt.video_url,
        'attributes', rt.attributes,
        'overall',    rt.overall,
        'status',     rt.status,
        'featured',   rt.featured,
        'carded',     rt.status = 'carded',
        'supporters', coalesce(s.total, 0),
        'createdAt',  rt.created_at
      ) as payload,
      case lower(coalesce(p_order, 'overall'))
        when 'supporters' then coalesce(s.total, 0)::numeric
        when 'recent'     then extract(epoch from rt.created_at)::numeric
        else coalesce(rt.overall, 0)::numeric
      end as ord_val,
      row_number() over (
        order by
          case lower(coalesce(p_order, 'overall'))
            when 'supporters' then coalesce(s.total, 0)::numeric
            when 'recent'     then extract(epoch from rt.created_at)::numeric
            else coalesce(rt.overall, 0)::numeric
          end desc,
          rt.created_at desc
      ) as ord
    from public.revela_talents rt
    left join (
      select talent_id, count(*)::int as total
      from public.revela_supports group by talent_id
    ) s on s.talent_id = rt.id
    where rt.status in ('approved', 'carded')
    order by ord_val desc, rt.created_at desc
    limit greatest(1, least(coalesce(p_limit, 24), 100))
  ) q;
$$;

grant execute on function public.revela_list_talents(int, text) to anon, authenticated;
