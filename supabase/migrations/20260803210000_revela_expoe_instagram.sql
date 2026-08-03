-- ============================================================================
-- REVELA — expõe o @ do Instagram no perfil público
-- ============================================================================
-- O cadastro pede o Instagram desde julho e guarda em `instagram_url`. Só que o
-- campo nunca entrou na lista branca das RPCs públicas — ou seja, a informação
-- vinha sendo COLETADA E DESCARTADA. Esta migration liga o que já existe.
--
-- ── POR QUE É SEGURO ────────────────────────────────────────────────────────
-- A lista branca existe por PII: telefone, e-mail, dados do responsável. Um @
-- de Instagram é o oposto disso — é um endereço que o atleta escolheu tornar
-- público e que ele quer que a torcida encontre. É a mesma natureza do vídeo e
-- da foto, que já saem.
--
-- ── SÓ NO PERFIL, NÃO NA LISTAGEM ───────────────────────────────────────────
-- Entra apenas em `revela_get_talent` (a página do atleta). A vitrine não
-- precisa: o card já tem para onde levar, que é o perfil. Campo que a tela não
-- usa é peso na resposta de uma lista de até 100 nomes.
--
-- ── O VALOR NÃO É UM LINK ───────────────────────────────────────────────────
-- `instagram_url` é texto livre e o banco prova: hoje há '@imjonhnes' e um
-- 'Diadema' (alguém digitou a cidade no campo). Quem monta o endereço é o
-- cliente, a partir de um handle validado — ver `revela/src/data/instagram.ts`.
-- Nada aqui deve ser usado como href direto.
-- ============================================================================

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
    'instagram',     rt.instagram_url,
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

grant execute on function public.revela_get_talent(text) to anon, authenticated;


-- ─── Verificação ────────────────────────────────────────────────────────────
--   select public.revela_get_talent('breno-liborge') -> 'instagram';
-- Hoje volta null — o Breno não preencheu. O botão some sozinho nesse caso.
