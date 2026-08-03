-- ============================================================================
-- REVELA — expõe `game_situation` nas RPCs públicas (selo LEGEND)
-- ============================================================================
-- Decisão do fundador (2026-08-02): ex-atleta ganha selo **LEGEND** na vitrine
-- — "vamos tratar todos os ex-atletas com respeito". Ele continua na vitrine
-- junto dos que estão chegando, e continua recebendo apoio e entrando no
-- ranking da semana como qualquer outro.
--
-- O cliente não tinha como saber: a lista branca de colunas das RPCs públicas
-- não incluía `game_situation`. Esta migration adiciona o campo — e SÓ ele.
--
-- POR QUE É SEGURO EXPOR: a lista branca existe por PII (telefone, e-mail,
-- responsável de menor). `game_situation` é uma de quatro palavras públicas
-- (escolinha | junior | profissional | lenda) — é exatamente o que a vitrine
-- precisa dizer sobre o atleta. Nada de contato entra junto.
-- ============================================================================


-- ─── 1. Listagem pública ────────────────────────────────────────────────────
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
        'video',         rt.video_url,
        'attributes',    rt.attributes,
        'overall',       rt.overall,
        'status',        rt.status,
        'featured',      rt.featured,
        'carded',        rt.status = 'carded',
        'supporters',    coalesce(s.total, 0),
        'createdAt',     rt.created_at
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


-- ─── 2. Perfil público ──────────────────────────────────────────────────────
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
    'video',         rt.video_url,
    'attributes',    rt.attributes,
    'overall',       rt.overall,
    'status',        rt.status,
    'featured',      rt.featured,
    'carded',        rt.status = 'carded',
    'supporters',    (select count(*)::int from public.revela_supports s where s.talent_id = rt.id),
    'createdAt',     rt.created_at
  )
  from public.revela_talents rt
  where rt.slug = p_slug
    and rt.status in ('approved', 'carded')
  limit 1;
$$;


grant execute on function public.revela_list_talents(int, text) to anon, authenticated;
grant execute on function public.revela_get_talent(text) to anon, authenticated;


-- ─── Verificação ────────────────────────────────────────────────────────────
-- Deve trazer a chave "gameSituation" no retorno:
--
-- select public.revela_get_talent('breno-liborge') -> 'gameSituation';
