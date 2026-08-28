# Telemetria de produto — as perguntas e o SQL

Cole no **SQL Editor do Supabase**. A tabela `public.product_events` não tem
policy de leitura (RLS nega por padrão), então isto só roda ali ou por
service_role — de propósito.

> **Antes de tirar conclusão:** deixe rodar alguns dias. Com 76 managers, um
> par de horas de dado não distingue "ninguém usa" de "ninguém entrou ainda".
> A primeira query serve justamente pra saber se já dá pra olhar.

---

## 0. Já tem dado suficiente?

```sql
select
  event,
  count(*)                        as eventos,
  count(distinct user_id)         as managers,
  min(created_at)::date           as desde,
  max(created_at)                 as ultimo
from public.product_events
group by event
order by eventos desc;
```

Se `managers` estiver em 1 ou 2, você está olhando o próprio teste. Espere.

---

## 1. 🔴 O card de momento é compartilhado?

**A pergunta que motivou a Fase 2.** `moment_detected` é o denominador (o card
apareceu), `moment_shared` é o numerador (apertaram).

```sql
with detectado as (
  select props->>'competition' as competicao,
         (props->>'tier')::int as tier,
         count(*) as vezes
  from public.product_events
  where event = 'moment_detected'
  group by 1, 2
),
compartilhado as (
  select props->>'competition' as competicao,
         (props->>'tier')::int as tier,
         count(*) filter (where props->>'result' = 'shared')    as share_real,
         count(*) filter (where props->>'result' = 'fallback')  as copiou_link,
         count(*) filter (where props->>'result' = 'cancelled') as desistiu,
         count(*) as apertou
  from public.product_events
  where event = 'moment_shared'
  group by 1, 2
)
select
  d.competicao,
  d.tier,
  case d.tier when 0 then 'comum' when 1 then 'raro'
              when 2 then 'épico' else 'lendário' end as raridade,
  d.vezes                                    as card_apareceu,
  coalesce(c.apertou, 0)                     as apertou_compartilhar,
  coalesce(c.share_real, 0)                  as share_de_verdade,
  coalesce(c.desistiu, 0)                    as desistiu_no_dialogo,
  round(100.0 * coalesce(c.apertou, 0) / nullif(d.vezes, 0), 1) as taxa_pct
from detectado d
left join compartilhado c using (competicao, tier)
order by d.vezes desc;
```

**Como ler:** `taxa_pct` abaixo de ~5% em tier 2–3 significa que o card não está
puxando ninguém — e aí o problema é o card, não a raridade. Se `desistiu_no_dialogo`
for alto, o card convence e o texto do share não.

---

## 2. 🔴 Qual resposta do vestiário ganha?

**A pergunta que motivou a Fase 4.** Se for sempre "dar chance", as outras duas
não estão custando nada e a decisão é falsa.

```sql
with mostrado as (
  select props->>'kind' as pedido, count(*) as vezes
  from public.product_events where event = 'request_shown'
  group by 1
),
respondido as (
  select props->>'kind' as pedido,
         count(*)                                                as respostas,
         count(*) filter (where props->>'choice' = 'grant')      as dar_chance,
         count(*) filter (where props->>'choice' = 'challenge')  as conquistar,
         count(*) filter (where props->>'choice' = 'promise')    as prometer
  from public.product_events where event = 'request_resolved'
  group by 1
)
select
  m.pedido,
  m.vezes                                                          as apareceu,
  coalesce(r.respostas, 0)                                         as respondeu,
  round(100.0 * coalesce(r.respostas,0) / nullif(m.vezes,0), 1)    as taxa_resposta_pct,
  r.dar_chance, r.conquistar, r.prometer
from mostrado m
left join respondido r using (pedido)
order by m.vezes desc;
```

**Como ler:** `taxa_resposta_pct` baixa = o card está no lugar errado da Home.
Uma escolha acima de ~70% = as outras duas são decorativas e vale recalibrar
o preço de cada uma em `resolveRequest`.

---

## 3. Em que estado o clube abre — e o Pulso prevê retorno?

```sql
-- Distribuição das aberturas por banda e por modo da Home
select
  props->>'band'                            as banda_pulso,
  props->>'trend'                           as tendencia,
  count(*)                                  as aberturas,
  count(distinct user_id)                   as managers,
  round(avg((props->>'value')::numeric), 1) as pulso_medio
from public.product_events
where event = 'pulse_seen'
group by 1, 2
order by aberturas desc;
```

```sql
select props->>'mode' as modo_home,
       count(*) as aberturas,
       count(distinct user_id) as managers
from public.product_events
where event = 'home_mode'
group by 1 order by aberturas desc;
```

**A pergunta cara:** quem abre em crise volta no dia seguinte?

```sql
with aberturas as (
  select user_id, created_at::date as dia, props->>'band' as banda
  from public.product_events where event = 'pulse_seen'
)
select
  a.banda,
  count(*)                                       as aberturas,
  count(*) filter (where b.user_id is not null)  as voltou_no_dia_seguinte,
  round(100.0 * count(*) filter (where b.user_id is not null) / count(*), 1) as retencao_d1_pct
from aberturas a
left join aberturas b
  on b.user_id = a.user_id and b.dia = a.dia + 1
group by a.banda
order by aberturas desc;
```

**Como ler:** se `retencao_d1_pct` de `crisis` for muito menor que a de `fire`,
o Pulso está descrevendo abandono — e aí a suavização da ausência (Fase 1.5)
foi acertada, mas talvez insuficiente.

---

## 4. O manager mexe no Foco?

```sql
select
  props->>'level'                                   as foco_escolhido,
  count(*)                                          as escolhas,
  count(*) filter (where (props->>'changed')::bool) as trocas_reais,
  count(distinct user_id)                           as managers
from public.product_events
where event = 'focus_chosen'
group by 1
order by escolhas desc;
```

**Como ler:** `trocas_reais` perto de zero = todo mundo aceita o default
(`possession`) e o Foco virou enfeite. Se um foco domina, o balanceamento dos
5 estilos está torto.

---

## 5. Quantas partidas produzem consequência visível?

```sql
select
  count(*)                                            as vezes_que_apareceu,
  count(distinct user_id)                             as managers,
  round(avg((props->>'count')::numeric), 2)           as consequencias_por_partida,
  round(avg((props->>'penalties')::numeric), 2)       as penalidades_por_partida
from public.product_events
where event = 'consequences_seen';
```

Compare com o total de partidas do período. Se o bloco aparece em menos de ~20%
das partidas, ele não está pagando o espaço que ocupa no pós-jogo.

---

## Manutenção

A tabela é estreita de propósito (~8 eventos em ponto de decisão), mas cresce.
Quando passar de alguns milhões de linhas, apare o rabo:

```sql
delete from public.product_events where created_at < now() - interval '180 days';
```

**Nunca guarde PII em `props`** — nome, e-mail, telefone, código de indicação.
O `user_id` (uuid) já identifica quem precisa ser identificado. O self-test
`npm run test:analytics` varre os pontos de chamada e quebra o build se alguém
tentar.
