-- ═══════════════════════════════════════════════════════════════════════════
-- QUEM VÊ O MUNDO PARALELO VOLTA MAIS?  (critério 4 do plano da Partida Viva,
-- docs/raio-x-partida-viva.html: "retorno no dia seguinte e na semana de quem
-- usou o Mundo Paralelo, comparado com quem não usou")
--
-- Só leitura. Rodar no SQL do Supabase (ou pelo MCP) depois de pelo menos uma
-- semana de dados — os eventos nasceram em 13/10/2026 (src/analytics/track.ts):
--   mundo_paralelo_oferecido · o campo ofereceu "E se eu não tivesse mandado?"
--   mundo_paralelo_visto     · o manager tocou e viu
--
-- Comparação justa: os DOIS grupos receberam a oferta (mesmo modo, mesma fase do
-- jogo). Ainda assim quem toca tende a ser mais engajado — o número é indício,
-- não prova de causa. Dia 0 = a primeira oferta. Voltar = jogar uma partida
-- (plano emitido) ou abrir a Home.
-- ═══════════════════════════════════════════════════════════════════════════
with oferta as (
  select user_id, min(created_at) as dia0
  from public.product_events
  where event = 'mundo_paralelo_oferecido' and user_id is not null
  group by user_id
),
visto as (
  select user_id, min(created_at) as primeira_vez
  from public.product_events
  where event = 'mundo_paralelo_visto' and user_id is not null
  group by user_id
),
atividade as (
  select owner_id as user_id, criado_em as em from public.quick_plans_emitidos where modo = 'full'
  union all
  select user_id, created_at from public.product_events where event in ('pulse_seen', 'home_mode')
),
coorte as (
  select o.user_id, o.dia0, v.user_id is not null as viu
  from oferta o left join visto v using (user_id)
)
select
  case when viu then 'viu o Mundo Paralelo' else 'só recebeu a oferta' end as grupo,
  count(*) as managers,
  -- D1: voltou no dia seguinte (24–48 h depois da primeira oferta)
  count(*) filter (where c.dia0 < now() - interval '2 days') as maduros_d1,
  count(*) filter (where c.dia0 < now() - interval '2 days' and exists (
    select 1 from atividade a where a.user_id = c.user_id
      and a.em >= c.dia0 + interval '1 day' and a.em < c.dia0 + interval '2 days')) as voltou_d1,
  -- Semana: voltou entre o 2º e o 7º dia
  count(*) filter (where c.dia0 < now() - interval '8 days') as maduros_semana,
  count(*) filter (where c.dia0 < now() - interval '8 days' and exists (
    select 1 from atividade a where a.user_id = c.user_id
      and a.em >= c.dia0 + interval '1 day' and a.em < c.dia0 + interval '8 days')) as voltou_semana
from coorte c
group by viu
order by viu desc;
