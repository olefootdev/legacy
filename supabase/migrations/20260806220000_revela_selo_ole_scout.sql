-- ════════════════════════════════════════════════════════════════════════════
-- REVELA — o SELO DO OLE SCOUT, e o fim de uma mentira na vitrine
-- ════════════════════════════════════════════════════════════════════════════
-- 🔴 O BUG: a vitrine marca TODO MUNDO como "Avaliado".
--
-- `statusOf()` em revela/src/sections/Talents.tsx decide o chip do card assim:
--
--     if (t.overall != null) return 'scouted';   → chip preto "AVALIADO"
--
-- Isso era verdade quando só o olheiro escrevia `overall`. Desde o SCOUT
-- autônomo (20260805220000) TODO cadastro nasce com overall — então a vitrine
-- inteira passou a carimbar "Avaliado" em ficha que nenhum humano abriu.
--
-- É o MESMO bug que já corrigimos no selo do perfil ("ter OVR não é ter aval") e
-- que sobreviveu aqui porque `revela_list_talents` nem devolvia `rating_source`:
-- a tela não tinha como saber, mesmo querendo.
--
-- ── O SELO ──────────────────────────────────────────────────────────────────
-- Pedido do fundador: uma badge pra quem tem CADASTRO COMPLETO + RATING. Duas
-- condições, e as duas medem coisas diferentes:
--
--   • `ratingSource = 'scout'` — um humano abriu, conferiu e assinou.
--   • ficha completa — foto, vídeo, história, Instagram, pé e idade.
--
-- Uma sozinha não vale: rating sem ficha completa é olheiro avaliando no escuro;
-- ficha completa sem rating é só formulário bem preenchido. O selo é o encontro
-- dos dois, e é isso que faz dele raro o bastante pra significar alguma coisa.
--
-- A conta de completude mora em `revela/src/data/completude.ts` — aqui só saem
-- os CAMPOS pra a tela calcular, sem duplicar a regra em SQL.
-- ════════════════════════════════════════════════════════════════════════════

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
        -- Os três campos novos. `instagram` e `ratingSource` são o que a vitrine
        -- precisa pra parar de mentir; `fotoEsperando` explica retrato vazio de
        -- menor sem autorização, em vez de parecer descuido do atleta.
        'instagram',     rt.instagram_url,
        'ratingSource',  rt.rating_source,
        'fotoEsperando', rt.pending_portrait_url is not null,
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


-- ─── Verificação ────────────────────────────────────────────────────────────
-- Todo item tem que trazer ratingSource. Hoje quase todos vêm 'auto' — e é
-- exatamente por isso que o chip "Avaliado" tinha que sair deles:
--
--   select jsonb_agg(distinct v -> 'ratingSource')
--     from jsonb_array_elements(public.revela_list_talents(100, 'overall')) v;
