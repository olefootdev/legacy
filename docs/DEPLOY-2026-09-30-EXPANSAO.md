# DEPLOY — Expansão: ponto fixo, teto diário e prêmio de carreira

> **Para o agente do terminal.** Siga as etapas NA ORDEM. Cada etapa tem um
> critério de "passou". Se um critério falhar, **pare e reporte** — não tente
> contornar, não aplique a etapa seguinte.
>
> Projeto Supabase de produção: **`xtuveikgwlgbcleloxia`** (OLEFOOT).
> Repositório: `olefootdev/legacy`, branch `main`.

---

## O que vai ao ar

| Commit | O que muda |
|---|---|
| `0826e9d` | Ponto da equiparação vale **$0,25 fixo**; **teto de $2.500 por pessoa por dia** (dia de São Paulo). O excedente é cortado e registrado. Hora sem receita também paga. |
| `86c0046` | **Prêmio em OLEFOOT ao atingir cada degrau da carreira**: Campeão 1.000 · Duplo 5.000 · Tri 10.000 · Tetra 25.000 · Penta 50.000 (total 91.000). Uma vez por degrau, fora do teto diário. |

Os dois só mexem em: 2 migrations novas, `server/src/lib/expansao/*` (lógica
espelho, sem rota nova), a tela NETWORK da carteira e os testes.

**Pendente em produção hoje:**
- Banco: `20260930180000_expansao_ponto_fixo_teto_diario.sql` e
  `20260930220000_expansao_premio_carreira.sql` — **nenhuma das duas aplicada**.
- Git: os 2 commits acima não estão no `origin/main`.
- Front do jogo (Cloudflare): sem a tela nova.
- OLEWALLET (`dex/`): **nada muda** — não precisa de deploy.

---

## Regras que NÃO se quebram

1. **Nunca `supabase db push`.** O histórico de migrations de produção é
   incompleto (65 migrations antigas foram aplicadas pelo SQL Editor e não
   estão registradas). O `db push` tentaria rodar todas de novo.
2. **Uma migration por vez, pelo arquivo exato.** Cada arquivo termina com um
   bloco `do $$ … $$` que testa tudo dentro de um savepoint e desfaz. Se a
   verificação falhar, a migration inteira volta atrás — é o comportamento
   certo. Leia o erro e reporte.
3. **Ordem obrigatória:** teto diário ANTES do prêmio. A do prêmio redefine
   `expansao_meu_bonus()` em cima da versão da do teto.
4. **Banco antes do push, push antes do Cloudflare.** A tela nova lê colunas
   que só existem depois das migrations.
5. **Não aplicar entre o minuto :00 e o :10 de qualquer hora.** O cron
   `expansao-ciclo-horario` roda no minuto 5 e chama a função que a primeira
   migration substitui.

---

## Etapa 0 — Conferir o terreno (só leitura)

```bash
cd ~/Projects/olefootv-11
git fetch origin
git status --short          # tem que sair vazio
git log --oneline origin/main..main
```

**Passou se:** `git status` vazio e o log mostra `86c0046`, `0826e9d` e o commit deste plano (`docs(deploy): …`) — 3 commits.

Confirme no banco de produção (MCP `execute_sql` do projeto
`xtuveikgwlgbcleloxia`, ou `psql`):

```sql
select version, name from supabase_migrations.schema_migrations
 where version >= '20260930' order by version;
```

**Passou se:** aparecem `cancela_plano_de_marketing`, `expansao_ciclo_horario`,
`expansao_licenca`, `carteira_pin`, `card_pix_em_bro_do_servidor` — e **não**
aparecem `expansao_ponto_fixo_teto_diario` nem `expansao_premio_carreira`.

```sql
select count(*) as ciclos_pagos from public.expansao_ciclo where status = 'SETTLED';
select count(*) as compras_pagas from public.presale_purchase where status = 'pago';
```

Anote os dois números no relatório. (Em 2026-09-30 eram 0 e 0 — a troca de
regra não altera nenhum ciclo já pago.)

---

## Etapa 1 — Testes locais

```bash
npm run lint
npx tsx server/src/lib/expansao/runExpansaoSelfTest.mts
npm run test:ciclo-paridade
npm run test:licenca-expansao
npm run test:fase0-pix
npm run test:convite-expansao
npm run test:expansao-migration
```

**Passou se:** `lint` sem erro e cada teste termina com `🟢 N passaram, 0 falharam`.
Referência: motor 175 · paridade 24 · licença 33 · fase0-pix 57 · convite 15 ·
migration 25. O `test:ciclo-paridade` aplica as duas migrations novas num banco
descartável (PGlite) e roda a verificação de dentro delas — é o ensaio do que
vai acontecer em produção.

---

## Etapa 2 — Migration 1: ponto fixo + teto diário

Arquivo: `supabase/migrations/20260930180000_expansao_ponto_fixo_teto_diario.sql`

**Preferencial — MCP do Supabase** (registra no histórico):
`apply_migration` com
- `name`: `expansao_ponto_fixo_teto_diario`
- `query`: o conteúdo **integral** do arquivo, sem editar nada.

**Alternativa — psql** (a connection string está em Supabase → Settings → Database):

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
  -f supabase/migrations/20260930180000_expansao_ponto_fixo_teto_diario.sql
```

(Pelo psql o histórico não é gravado; registre depois com
`insert into supabase_migrations.schema_migrations (version, name) values ('20260930180000','expansao_ponto_fixo_teto_diario');`)

**Conferência:**

```sql
-- a função nova (5 argumentos) existe e a antiga (3) sumiu
select pg_get_function_identity_arguments(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'expansao_fechar_ciclo';
-- esperado: UMA linha, com 5 parâmetros (…, p_valor_ponto_micro numeric, p_teto_diario numeric)

-- colunas novas
select column_name from information_schema.columns
 where table_schema='public' and table_name='expansao_ciclo'
   and column_name in ('bonus_total','cortado_total','teto_diario');        -- 3 linhas
select column_name from information_schema.columns
 where table_schema='public' and table_name='expansao_liquidacao'
   and column_name = 'cortado_teto';                                        -- 1 linha

-- fechada pro cliente
select has_function_privilege('authenticated',
  'public.expansao_fechar_ciclo(timestamptz,integer,numeric,numeric,numeric)','execute') as auth,
       has_function_privilege('anon',
  'public.expansao_fechar_ciclo(timestamptz,integer,numeric,numeric,numeric)','execute') as anon;
-- esperado: false, false

-- o cron continua agendado e a chamada dele resolve
select jobname, schedule, active from cron.job where jobname = 'expansao-ciclo-horario';
-- esperado: '5 * * * *', active = true
select public.expansao_fechar_ciclos_pendentes();
-- esperado: um número (0 se não há hora pendente). NÃO pode dar erro.
```

**Passou se:** todos os esperados batem. Se `expansao_fechar_ciclos_pendentes()`
der erro, **pare** — o cron das próximas horas vai falhar igual.

---

## Etapa 3 — Migration 2: prêmio de carreira

Arquivo: `supabase/migrations/20260930220000_expansao_premio_carreira.sql`

Mesmo procedimento da Etapa 2, com `name`: `expansao_premio_carreira`.

**Conferência:**

```sql
select degrau, exige, premio_olefoot from public.expansao_degraus();
-- CAMPEAO 10000 1000 · DUPLO_CAMPEAO 50000 5000 · TRI_CAMPEAO 100000 10000
-- TETRA 250000 25000 · PENTA 500000 50000
select sum(premio_olefoot) from public.expansao_degraus();            -- 91000

select to_regclass('public.expansao_premio_carreira');                -- não nulo
select count(*) from public.expansao_premio_carreira;                 -- 0 enquanto ninguém graduou

-- a tela lê as colunas novas
select proargnames from pg_proc where proname = 'expansao_meu_bonus';
-- tem que conter hoje_usd_cents, teto_diario_cents, premios_olefoot
select proargnames from pg_proc where proname = 'expansao_carreira';
-- tem que conter premio_proximo, premios_olefoot

select has_function_privilege('authenticated','public.expansao_somar_equiparado(uuid,numeric)','execute');
-- esperado: false
```

E o histórico:

```sql
select version, name from supabase_migrations.schema_migrations
 where name in ('expansao_ponto_fixo_teto_diario','expansao_premio_carreira');
-- 2 linhas
```

---

## Etapa 4 — Push (servidor no Railway)

```bash
git push origin main
```

O Railway publica sozinho ao receber o push. Estes commits não criam rota nova
no servidor; o deploy só precisa terminar verde.

**Passou se:** o push foi aceito e o deploy do Railway terminou com sucesso.

```bash
curl -s https://legacy-production-de1e.up.railway.app/health
```

Se o push der **403**, o GitHub está na conta errada:

```bash
gh auth status
gh auth switch --user olefootdev
gh auth setup-git
```

---

## Etapa 5 — Front do jogo (Cloudflare)

```bash
npm run deploy:cloudflare
```

**Passou se:** o `wrangler deploy` termina publicando o worker.

**NÃO** rodar `deploy:dex` — a OLEWALLET não mudou nesses commits.

---

## Etapa 6 — Conferência em produção

Abra `https://game.olefoot.ai/wallet/network` logado numa conta que está na
árvore e confira:

1. Bloco **Bônus a receber** mostra a barra **"Hoje $0,00 de $2.500,00"**.
2. Bloco **Carreira** mostra **"Chegou, ganhou 1.000 OLEFOOT"** abaixo da
   barra do próximo degrau.
3. Bloco **Ciclos pagos** mostra "pago $X" por ciclo (ou "Nenhum ainda").
4. Console do navegador sem erro de RPC (`expansao_meu_bonus`,
   `expansao_carreira`).

Depois do próximo minuto :05, confira que o cron rodou sem erro:

```sql
select status, return_message, start_time
  from cron.job_run_details d join cron.job j on j.jobid = d.jobid
 where j.jobname = 'expansao-ciclo-horario'
 order by start_time desc limit 3;
-- esperado: status 'succeeded'
```

---

## Relatório final (devolver ao fundador)

- Números da Etapa 0 (ciclos pagos, compras pagas).
- Resultado de cada teste da Etapa 1.
- As 2 migrations aplicadas + saída das conferências.
- Hash do commit publicado no Railway e URL/versão do deploy Cloudflare.
- Resultado da Etapa 6 (com print da tela NETWORK, se possível).
- Qualquer etapa que parou, com o erro **literal**.

---

## Se algo der errado

| Sintoma | O que fazer |
|---|---|
| Migration falhou na verificação de dentro | Nada foi aplicado (a transação voltou). Reporte o erro literal. Não edite o arquivo. |
| `expansao_fechar_ciclos_pendentes()` dá erro depois da Etapa 2 | Pare antes da Etapa 3. Reporte. O cron vai falhar a cada hora até corrigir, mas nenhum ponto é perdido: a hora fica pendente e fecha quando a função voltar. |
| Tela NETWORK quebrada depois da Etapa 5 | Confirme que as 2 migrations estão aplicadas (colunas novas de `expansao_meu_bonus`). Se estiverem, reporte o erro do console. |
| Push 403 | Ver Etapa 4. |

---

## Fora deste deploy (fica para depois)

- **Teste de lançamento:** uma compra real de $10 por Pix de ponta a ponta
  (posição, árvore, 10 OLEXP, ciclo fechando). Depende do fundador pagar.
- **Decisões abertas do fundador:**
  1. Conta ativada por licença conta como indicado direto na regra "1 em cada
     time"? (Hoje conta.)
  2. Teto de compra por conta na pré-venda.
  3. Data de abertura da pré-venda ao público.
  4. Contas-selo da casa no material de divulgação.
  5. Excedente do teto diário: hoje é cortado; alternativa é guardar pro dia
     seguinte.
