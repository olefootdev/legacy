-- ============================================================================
-- REVELA — o placar da Trajetória ganha recorte de tempo
-- ============================================================================
-- 24 HORAS · 7 DIAS · 30 DIAS · SEMPRE. Com isso a seção "Em alta essa semana"
-- deixa de ter razão de existir: ela era exatamente o recorte de 7 dias, numa
-- caixa própria, medindo só fãs.
--
-- ── O QUE DÁ E O QUE NÃO DÁ PRA MEDIR NUMA JANELA ───────────────────────────
-- OLEKO tem duas fontes e só uma tem linha do tempo:
--
--   TEM data  · `revela_oleko_events.created_at` (Instagram, pódio da semana)
--             · `revela_supports.created_at`     (cada fã, um a um)
--
--   NÃO tem   · foto, vídeo, @, aval do scout, clube criado, rede de indicados.
--               São estados derivados: o banco sabe que ESTÁ feito, não QUANDO
--               foi feito.
--
-- Então a janela mede MOVIMENTO — o que a pessoa conquistou naquele período —
-- e não o acervo. Que é precisamente o que a seção pergunta: "quem está
-- correndo mais". O total continua disponível em SEMPRE.
--
-- ── OS MARCOS DE FÃ SÃO DEGRAUS, NÃO PONTOS POR FÃ ──────────────────────────
-- Ganhar 40 fãs não vale nada se você não cruzou nenhum marco; ganhar 1 vale
-- 2.500 se ele foi o centésimo. Por isso a conta é a DIFERENÇA entre o OLEKO de
-- marcos com o total de hoje e o de quando a janela abriu. Somar "fãs ganhos ×
-- alguma coisa" daria um número bonito e errado.
-- ============================================================================


-- ─── OLEKO acumulado de marcos de fã para um total N ────────────────────────
-- Espelha a família B de `revela_oleko_missoes`. Existe separada porque a
-- janela precisa avaliar a MESMA escada em dois pontos do tempo.
create or replace function public.revela_oleko_de_fas(p_fas int)
returns bigint
language sql
immutable
as $$
  select coalesce(
      case when p_fas >= 10     then   100 else 0 end
    + case when p_fas >= 100    then  2500 else 0 end
    + case when p_fas >= 1000   then  7500 else 0 end
    + case when p_fas >= 2500   then 15000 else 0 end
    + case when p_fas >= 5000   then 30000 else 0 end
    + case when p_fas >= 10000  then 60000 else 0 end
  , 0)::bigint;
$$;


-- ─── O placar ───────────────────────────────────────────────────────────────
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


grant execute on function public.revela_oleko_de_fas(int)                  to anon, authenticated;
grant execute on function public.revela_trajetoria_ranking(text, int, text) to anon, authenticated;

-- A assinatura antiga (2 argumentos) fica órfã depois desta migration. Some,
-- pra não existirem duas versões e o cliente cair na errada por engano.
drop function if exists public.revela_trajetoria_ranking(text, int);


-- ─── Verificação ────────────────────────────────────────────────────────────
--   select public.revela_trajetoria_ranking(null, 10, 'all');
--   select public.revela_trajetoria_ranking(null, 10, '24h');
--   select public.revela_oleko_de_fas(112);   -- 2.600 (marco de 10 + marco de 100)
