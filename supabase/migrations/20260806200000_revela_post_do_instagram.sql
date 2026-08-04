-- ════════════════════════════════════════════════════════════════════════════
-- REVELA — o atleta escolhe UM post do Instagram pra aparecer no perfil
-- ════════════════════════════════════════════════════════════════════════════
-- Feed ao vivo não dá: o oEmbed do Instagram embute UM post por vez, e não
-- existe endpoint que liste os posts de uma conta pública. Puxar feed exigiria o
-- dono conectar via OAuth e a Olefoot passar por App Review — semanas, e cada
-- atleta conectando um a um.
--
-- O post escolhido resolve o mesmo problema e é melhor por um motivo que não é
-- técnico: é CURADORIA. Ele escolhe o gol, não o algoritmo. Numa página que
-- mostra menor de idade, a diferença entre "o que ele quis mostrar" e "o que ele
-- postou ontem" é a diferença toda — feed ao vivo traria a festa, a escola
-- marcada, a localização.
--
-- ── O QUE ENTRA AQUI É TEXTO, NÃO ENDEREÇO ──────────────────────────────────
-- Guardamos o que o atleta colou, validado só na FORMA (é um link de post do
-- Instagram?). Quem monta o endereço do embed é o cliente, a partir do código
-- extraído — nunca a string crua. Mesma regra do vídeo: ver src/lib/videoEmbed.ts
-- e revela/src/data/instagram.ts.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.revela_talents
  add column if not exists instagram_post_url text;

comment on column public.revela_talents.instagram_post_url is
  'Link de UM post que o atleta escolheu destacar. Texto — o embed é montado no cliente.';


-- ── O atleta grava o post ───────────────────────────────────────────────────
create or replace function public.revela_meu_post(p_url text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_talent uuid;
  limpo    text := nullif(trim(coalesce(p_url, '')), '');
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;

  select id into v_talent
    from public.revela_talents
   where user_id = auth.uid() and status <> 'rejected'
   order by created_at asc limit 1;

  if v_talent is null then
    return jsonb_build_object('ok', false, 'reason', 'no_talent');
  end if;

  -- Vazio LIMPA o destaque. É como o atleta tira um post que não quer mais.
  if limpo is not null then
    -- Só a forma: instagram.com/{p|reel|tv}/{código}. O código é o que o
    -- cliente usa pra montar o embed.
    if limpo !~* '^https?://(www\.)?instagram\.com/(p|reel|tv)/[A-Za-z0-9_-]{5,20}/?' then
      return jsonb_build_object('ok', false, 'reason', 'nao_e_post');
    end if;
    if length(limpo) > 300 then
      return jsonb_build_object('ok', false, 'reason', 'nao_e_post');
    end if;
  end if;

  update public.revela_talents
     set instagram_post_url = limpo,
         updated_at         = now()
   where id = v_talent;

  return jsonb_build_object('ok', true, 'url', limpo);
end;
$$;

grant execute on function public.revela_meu_post(text) to authenticated;


-- ── A vitrine devolve o post ────────────────────────────────────────────────
create or replace function public.revela_get_talent(p_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id',            rt.id,
    'slug',          rt.slug,
    'name',          coalesce(nullif(rt.nickname, ''), rt.name),
    'pos',           rt.pos,
    'category',      rt.category,
    'gameSituation', rt.game_situation,
    'club',          rt.club,
    'city',          rt.city,
    'uf',            rt.uf,
    'country',       rt.country,
    'birthYear',     rt.birth_year,
    'strongFoot',    rt.strong_foot,
    'bio',           rt.bio,
    'dream',         rt.dream,
    'portrait',      rt.portrait_url,
    'fotoEsperando', rt.pending_portrait_url is not null,
    'video',         rt.video_url,
    'instagram',     rt.instagram_url,
    'instagramPost', rt.instagram_post_url,
    'attributes',    rt.attributes,
    'overall',       rt.overall,
    'ratingSource',  rt.rating_source,
    'status',        rt.status,
    'featured',      rt.featured,
    'carded',        rt.status = 'carded',
    'dna',           (
      select jsonb_build_object('arquetipo', d.arquetipo, 'tracos', d.tracos)
        from public.revela_talent_dna d where d.talent_id = rt.id
    ),
    'supporters',    (select count(*)::int from public.revela_supports s where s.talent_id = rt.id),
    'createdAt',     rt.created_at
  )
  from public.revela_talents rt
  where rt.slug = p_slug
    and rt.status in ('approved', 'carded')
  limit 1;
$$;

grant execute on function public.revela_get_talent(text) to anon, authenticated;


-- ── E o painel, pra ele ver o que já colou ──────────────────────────────────
create or replace function public.revela_my_talent()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id',         rt.id,
    'slug',       rt.slug,
    'handle',     rt.handle,
    'name',       coalesce(nullif(rt.nickname, ''), rt.name),
    'pos',        rt.pos,
    'category',   rt.category,
    'club',       rt.club,
    'city',       rt.city,
    'uf',         rt.uf,
    'portrait',   rt.portrait_url,
    'overall',    rt.overall,
    'status',     rt.status,
    'scoutNote',  rt.scout_note,
    'supporters', (select count(*)::int from public.revela_supports s where s.talent_id = rt.id),
    'indicacaoAtiva', exists (
      select 1 from public.profiles p
      where p.id = rt.user_id and p.my_referral_code is not null
    ),
    'dna',        (
      select jsonb_build_object('arquetipo', d.arquetipo, 'tracos', d.tracos, 'respostas', d.respostas)
        from public.revela_talent_dna d where d.talent_id = rt.id
    ),
    'autorizacao', (
      select jsonb_build_object('status', a.status, 'token', a.token)
        from public.revela_guardian_auth a where a.talent_id = rt.id
    ),
    'fotoEsperando', rt.pending_portrait_url is not null,
    'instagramPost', rt.instagram_post_url,
    'createdAt',  rt.created_at
  )
  from public.revela_talents rt
  where rt.user_id = auth.uid()
    and rt.status <> 'rejected'
  order by rt.created_at asc
  limit 1;
$$;

grant execute on function public.revela_my_talent() to authenticated;


-- ─── Verificação ────────────────────────────────────────────────────────────
--   select public.revela_meu_post('https://www.instagram.com/p/C8QltmvyE0i/');
-- Logado como atleta: ok:true. Link que não seja post: reason 'nao_e_post'.
