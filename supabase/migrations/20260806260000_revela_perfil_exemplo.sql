-- ════════════════════════════════════════════════════════════════════════════
-- REVELA — PERFIL DE EXEMPLO, dito com todas as letras
-- ════════════════════════════════════════════════════════════════════════════
-- O Juan é ficção criada pela casa, e vira card no mercado. O fundador decidiu
-- mantê-lo na vitrine — com uma TAG EXEMPLO. É a saída certa: o problema nunca
-- foi ele estar lá, foi ele estar lá SEM AVISO, ao lado do Breno, numa página
-- que promete "descubra quem está chegando".
--
-- Com a tag, ele deixa de ser um atleta inventado se passando por descoberta e
-- passa a ser o que de fato é: a amostra que mostra como uma ficha fica pronta.
-- Isso tem valor próprio — quem chega no REVELA sem entender o produto tem um
-- perfil completo pra olhar.
--
-- ── FORA DA DISPUTA ─────────────────────────────────────────────────────────
-- Exemplo não corre na Trajetória. Se corresse, um perfil da casa poderia
-- juntar fãs e liderar o ranking contra moleques de verdade — e aí a tag não
-- salvaria nada, porque a injustiça seria real. `revela_trajetoria_ranking`
-- passa a ignorá-los.
--
-- Continua na VITRINE (é pra ser visto) e continua com página própria.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.revela_talents
  add column if not exists is_example boolean not null default false;

comment on column public.revela_talents.is_example is
  'Perfil de demonstração criado pela casa. Aparece com tag EXEMPLO e não disputa a Trajetória.';


-- ── O Juan: exemplo, e com o card ligado ────────────────────────────────────
update public.revela_talents
   set is_example     = true,
       card_legacy_id = 'legacy-juan-revelacao',
       status         = 'carded',
       updated_at     = now()
 where slug = 'juan';


-- ── A vitrine e a listagem contam ───────────────────────────────────────────
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
    'exemplo',       rt.is_example,
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


-- A listagem: mesmo conjunto de 20260806220000 mais `exemplo`. (Se aquela ainda
-- não tiver rodado, esta a substitui inteira — as duas trazem ratingSource.)
create or replace function public.revela_list_talents(
  p_limit int  default 24,
  p_order text default 'overall'
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(x order by ord), '[]'::jsonb)
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
        'instagram',     rt.instagram_url,
        'ratingSource',  rt.rating_source,
        'fotoEsperando', rt.pending_portrait_url is not null,
        'exemplo',       rt.is_example,
        'attributes', rt.attributes,
        'overall',    rt.overall,
        'status',     rt.status,
        'featured',   rt.featured,
        'carded',     rt.status = 'carded',
        'supporters', coalesce(s.total, 0),
        'createdAt',  rt.created_at
      ) as x,
      case p_order
        when 'supporters' then coalesce(s.total, 0)
        when 'recent'     then extract(epoch from rt.created_at)
        else coalesce(rt.overall, 0)
      end as ord
    from public.revela_talents rt
    left join (
      select talent_id, count(*)::int as total
        from public.revela_supports group by talent_id
    ) s on s.talent_id = rt.id
    where rt.status in ('approved', 'carded')
    order by ord desc, rt.created_at desc
    limit greatest(1, least(coalesce(p_limit, 24), 100))
  ) q;
$$;

grant execute on function public.revela_list_talents(int, text) to anon, authenticated;


-- ── O ranking ignora exemplo ────────────────────────────────────────────────
-- Função EXTRAÍDA POR SCRIPT de 20260804120000, com uma linha a mais no where.
-- Minha primeira tentativa foi reescrevê-la de cabeça e saiu com assinatura
-- trocada (p_limit e p_periodo invertidos) e sem `revela_oleko_events` — teria
-- quebrado o placar inteiro. Copiar da fonte, não da memória.

create or replace function public.revela_trajetoria_ranking(
  p_chave   text default null,
  p_limit   int  default 20,
  p_periodo text default 'all'
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with janela as (
    select case lower(coalesce(p_periodo, 'all'))
      when '24h' then now() - interval '24 hours'
      when '7d'  then now() - interval '7 days'
      when '30d' then now() - interval '30 days'
      else null  -- 'all': sem corte
    end as desde
  ),
  base as (
    select
      rt.id,
      rt.slug,
      coalesce(nullif(rt.nickname, ''), rt.name) as name,
      rt.portrait_url                            as portrait,
      coalesce(rt.game_situation, 'escolinha')   as chave,
      rt.user_id,
      rt.created_at,
      (select count(*)::int from public.revela_supports s where s.talent_id = rt.id) as fas,
      -- Fãs ganhos DENTRO da janela (0 quando a janela é 'sempre').
      (select count(*)::int from public.revela_supports s
        where s.talent_id = rt.id
          and (select desde from janela) is not null
          and s.created_at >= (select desde from janela)) as fas_janela
    from public.revela_talents rt
    where rt.status in ('approved', 'carded')
      -- A LINHA NOVA: perfil de exemplo não disputa a Trajetória. Se disputasse,
      -- um perfil da casa poderia juntar fãs e liderar contra moleques de
      -- verdade — e aí a tag EXEMPLO não salvaria nada, porque a injustiça
      -- seria real. Ver 20260806260000.
      and rt.is_example = false
      and (p_chave is null or coalesce(rt.game_situation, 'escolinha') = p_chave)
  ),
  pontuado as (
    select
      b.*,
      case
        when (select desde from janela) is null
          then public.revela_oleko_total(b.id)
        else
          -- Degraus de fã cruzados na janela…
          public.revela_oleko_de_fas(b.fas)
          - public.revela_oleko_de_fas(greatest(b.fas - b.fas_janela, 0))
          -- …mais o que foi creditado na janela.
          + coalesce((
              select sum(e.oleko) from public.revela_oleko_events e
              where e.user_id = b.user_id
                and e.created_at >= (select desde from janela)
            ), 0)
      end as oleko
    from base b
  )
  select coalesce(jsonb_agg(x.payload order by x.pos), '[]'::jsonb)
  from (
    select
      jsonb_build_object(
        'pos',      row_number() over (order by p.oleko desc, p.created_at asc),
        'slug',     p.slug,
        'name',     p.name,
        'portrait', p.portrait,
        'chave',    p.chave,
        'oleko',    p.oleko,
        'fas',      p.fas,
        -- Quantos fãs entraram na janela. Em 'sempre' vem 0 e a tela ignora.
        'fasJanela', p.fas_janela,
        'divisao',  public.revela_oleko_divisao(public.revela_oleko_total(p.id))
      ) as payload,
      row_number() over (order by p.oleko desc, p.created_at asc) as pos
    from pontuado p
    -- Numa janela, quem não pontuou não aparece: uma lista de zeros não é um
    -- placar, é uma lista de nomes. Em 'sempre' todo mundo entra.
    where (select desde from janela) is null or p.oleko > 0
    order by p.oleko desc, p.created_at asc
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  ) x;
$$;

grant execute on function public.revela_trajetoria_ranking(text, int, text) to anon, authenticated;


-- ─── Verificação ────────────────────────────────────────────────────────────
--   select public.revela_get_talent('juan') -> 'exemplo';        -- true
--   select public.revela_trajetoria_ranking(null, 50, 'all');    -- sem o Juan
