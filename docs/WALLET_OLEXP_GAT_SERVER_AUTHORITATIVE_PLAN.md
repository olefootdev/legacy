# Plano — OLEXP & GAT servidor-autoritativos

**Status:** aprovado (direção), a executar em sessão dedicada.
**Data:** 2026-07-03.
**Contexto:** auditoria da wallet nesta sessão apontou que OLEXP e GAT
calculam rendimento **só no cliente** (Zustand/localStorage). O servidor não
sabe das posições, não debita saldo na criação e não roda accrual. Risco:
(1) rendimento exibido não concilia com o servidor; (2) limpar o navegador
apaga o "tesouro". Este plano fecha os dois buracos.

> Migração de PIX (Abacate → Mercado Pago) e limpeza de mock da wallet **já
> foram feitas** nesta sessão. Este doc cobre **só** OLEXP/GAT.

---

## 0. Princípio

**Servidor é a fonte da verdade.** O cliente vira cache: lê via RPC, nunca
inventa saldo nem rendimento. Toda criação/resgate/accrual é uma transação
atômica no Postgres, auditável via ledger.

Hoje já existe a base certa para copiar o padrão:
- `olexp_balances` + `olexp_ledger` (saldo agregado + histórico imutável) —
  [migration 20260528000100](../supabase/migrations/20260528000100_olexp_balances.sql)
- `_credit_olexp()` / `_debit_olexp()` (security definer, revogadas de authenticated)
- `create_hodl_lock()` + `process_hodl_daily_tick()` — o **HODL já é o modelo
  correto** de posição servidor-autoritativa. OLEXP/GAT devem seguir o mesmo molde.
- Edge function [hodl-daily-tick](../supabase/functions/hodl-daily-tick/index.ts)
  já processa tick diário — replicar para OLEXP/GAT.

---

## 1. OLEXP — posições no servidor

### 1.1 Nova tabela `olexp_positions`

```sql
-- supabase/migrations/2026XXXX_olexp_positions.sql
create table if not exists public.olexp_positions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  plan_id           text not null,                 -- '90d' | '180d' | '360d'
  principal_cents   bigint not null check (principal_cents > 0),
  daily_rate        numeric(10,6) not null,        -- congela a taxa do plano
  yield_accrued_cents bigint not null default 0,
  yield_paid_cents  bigint not null default 0,
  status            text not null default 'active' -- active|matured|claimed|early_exited
                    check (status in ('active','matured','claimed','early_exited')),
  start_date        date not null,
  end_date          date not null,
  first_yield_at    timestamptz not null,          -- 24h após adesão
  last_accrued_date date,                          -- idempotência do accrual
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on public.olexp_positions (user_id, status);
create index on public.olexp_positions (status, end_date);
alter table public.olexp_positions enable row level security;
create policy "own positions read" on public.olexp_positions
  for select using (auth.uid() = user_id);
-- writes só via RPC security definer (sem policy de insert/update pra authenticated)
```

Espelha 1:1 o tipo cliente `OlexpPosition`
([src/wallet/types.ts:58-89](../src/wallet/types.ts)) — os campos batem com a
matemática já validada em [src/wallet/olexp.ts](../src/wallet/olexp.ts). A ideia
é **portar essa matemática para SQL** (não reinventar).

### 1.2 RPCs

| RPC | Papel | Debita/credita |
|---|---|---|
| `open_olexp_position(p_plan_id text, p_amount_cents bigint)` | Cria posição + debita SPOT | `_debit_olexp` do SPOT → `olexp_positions` |
| `claim_olexp_principal(p_position_id uuid)` | Após vencimento, devolve principal ao SPOT | `_credit_olexp` |
| `early_exit_olexp(p_position_id uuid)` | Saída antecipada (principal, com/sem penalidade) | `_credit_olexp` |
| `get_my_olexp_positions()` | Lista posições do user (substitui leitura local) | — |

Regras:
- `open_olexp_position` valida saldo SPOT **no servidor** antes de debitar
  (hoje `createOlexpPosition` no cliente não chama RPC nenhum — esse é o bug).
- Todas security definer, `revoke ... from anon, public`, `grant ... to authenticated`.
- Escrever no `olexp_ledger` em cada operação (`SWAP_SPOT_TO_OLEXP`,
  `OLEXP_PRINCIPAL`, `OLEXP_YIELD`) para o extrato continuar funcionando.

### 1.3 Accrual diário automatizado

**Problema atual:** yield só progride se o cliente despachar `DAILY_ACCRUE`
([reducer.ts:4341](../src/game/reducer.ts)). Fechou o app → não rende. E a
edge `hodl-daily-tick` processa HODL, **não** as posições OLEXP.

**Solução:**
```sql
create or replace function public.process_olexp_daily_tick(p_target_date date)
returns table (positions_accrued int, total_yield_cents bigint) ...
-- para cada posição active com last_accrued_date < p_target_date e
-- p_target_date em dia útil (seg–sex) e >= first_yield_at:
--   yield_day = floor(principal_cents * daily_rate)
--   yield_accrued_cents += yield_day
--   _credit_olexp(user_id, yield_day, 'OLEXP_YIELD')  -- ou acumula e paga no claim
--   last_accrued_date = p_target_date
--   se p_target_date >= end_date → status = 'matured'
-- idempotente por (position_id, last_accrued_date)
```

Edge function nova `olexp-daily-tick` (clonar `hodl-daily-tick`) + **cron**.
Duas opções de agendamento:
1. **pg_cron** no Supabase (`select cron.schedule(...)`) chamando a função SQL
   direto — mais simples, sem edge. **Recomendado.**
2. Edge function + `supabase/functions` agendada por cron externo (o
   `global-league-tick` já mostra esse padrão no projeto).

> Decisão de produto pendente: dia útil = fuso de Brasília. Fixar `America/Sao_Paulo`
> no cálculo do `p_target_date` para não pagar/pular yield por causa de UTC.

### 1.4 Rewire do cliente

- `createOlexpPosition` / `claimOlexpPrincipal` / `earlyExitOlexpToSpot`
  ([olexp.ts](../src/wallet/olexp.ts)) deixam de mutar estado local e passam a
  chamar as RPCs via [olexpSync.ts](../src/wallet/olexpSync.ts) (que já tem o
  padrão `fetchMyOlexpBalance`).
- `OlexpTab` ([src/pages/wallet/OlexpTab.tsx](../src/pages/wallet/OlexpTab.tsx))
  lê `get_my_olexp_positions()` em vez de `wallet.olexpPositions`.
- Remover `accrueOlexpDaily` do path do `DAILY_ACCRUE` (o servidor faz agora).
  Manter só como projeção visual read-only, se quiser preview de rendimento.

### 1.5 Admin
- [AdminFinanceiroPanel](../src/admin/panels/AdminFinanceiroPanel.tsx) hoje cria
  posições em `platformStore` local. Apontar para as mesmas RPCs (admin usa
  `admin_credit_olexp` já existente para grants; adicionar leitura de
  `olexp_positions` agregada por user para o forecast real).

---

## 2. GAT — posições no servidor

Mesmo molde do OLEXP. Hoje GAT é 100% cliente
([src/wallet/gat.ts](../src/wallet/gat.ts), UI em
[GatTab.tsx](../src/pages/wallet/GatTab.tsx)).

### 2.1 Tabela `gat_positions`

```sql
create table if not exists public.gat_positions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  category      text not null,          -- GAT_ELIGIBLE_CATEGORIES (constants.ts:57)
  base_cents    bigint not null,        -- BRO gasto que gerou a posição
  daily_rate    numeric(10,6) not null, -- faixa progressiva (1.5%–5.5%)
  exp_accrued   bigint not null default 0,
  start_date    date not null,
  end_date      date not null,          -- +24 meses
  last_accrued_date date,
  created_at    timestamptz not null default now()
);
create index on public.gat_positions (user_id);
create index on public.gat_positions (end_date);
alter table public.gat_positions enable row level security;
create policy "own gat read" on public.gat_positions
  for select using (auth.uid() = user_id);
```

### 2.2 RPCs + accrual
- `register_gat_position(p_category text, p_amount_cents bigint)` — chamada
  **dentro** da transação de compra elegível (hoje é a action
  `WALLET_GAT_PURCHASE`, [reducer.ts:4345](../src/game/reducer.ts)). Cria a
  posição + aplica a comissão de referral 1%/nível em EXP (já existe a lógica,
  portar para SQL/ledger).
- `process_gat_daily_tick(p_target_date date)` — credita EXP diário por faixa,
  idempotente por `last_accrued_date`. Juntar no **mesmo cron** do OLEXP
  (um tick só, duas funções) para simplificar operação.
- `get_my_gat_positions()` — leitura para o `GatTab`.

### 2.3 Rewire
- `registerGatBase` / `accrueGatDaily` deixam de mutar Zustand; viram chamadas
  RPC. `GatTab` lê do servidor. Remover `accrueGatDaily` do `DAILY_ACCRUE`.

---

## 3. Reconciliação client ↔ server

1. **No boot / foco da wallet:** buscar `get_my_olexp_balance` +
   `get_my_olexp_positions` + `get_my_gat_positions` e **sobrescrever** o cache
   local (servidor manda). Nunca fazer merge que "some" o servidor.
2. **Ledger:** manter escrita server-side em toda operação; o extrato
   ([ExtractTab](../src/pages/wallet/ExtractTab.tsx)) passa a ler
   `get_my_olexp_ledger()` como fonte (já existe).
3. **Migração de dados existentes:** usuários que já têm posições só no
   localStorage. Opções:
   - (a) script de importação one-shot: ler backup local → `open_olexp_position`
     retroativo (com `start_date` original) — **preferível** para não zerar
     ninguém.
   - (b) reset assistido com comunicação. Decidir com o fundador.

---

## 4. Corrigir o rótulo "on-chain"

`olexpSync.ts` e textos da UI chamam OLEXP de rentabilidade "on-chain", mas
**não há blockchain** — é PostgreSQL. Escolher um dos dois:
- **Honestidade agora (barato):** trocar "on-chain" por "rentabilidade Olefoot"
  / "rendimento interno" em [olexpSync.ts](../src/wallet/olexpSync.ts) e na UI.
- **On-chain de verdade (caro, futuro):** só se houver contrato + wallet (wagmi/
  ethers). Fora do escopo deste plano.

> Recomendação: fazer a correção de rótulo **junto** com o build servidor-
> autoritativo, para a wallet parar de prometer algo que não existe.

---

## 5. Ordem de execução sugerida

1. Migration `olexp_positions` + RPCs `open/claim/early_exit/get`.
2. `process_olexp_daily_tick` + pg_cron (dia útil, America/Sao_Paulo).
3. Rewire `OlexpTab` + `olexp.ts` para RPC. Testar ponta-a-ponta em sandbox.
4. Repetir 1–3 para GAT (`gat_positions` + tick, no mesmo cron).
5. Reconciliação no boot + correção do rótulo "on-chain".
6. Importação one-shot dos saldos/posições legados do localStorage.
7. Admin: apontar `AdminFinanceiroPanel` para as RPCs reais.

**Riscos/gotchas:**
- Idempotência do tick é obrigatória (rodar 2× no mesmo dia não pode pagar 2×).
- Fuso: fixar Brasília no `p_target_date`.
- Não fazer merge cliente que ressuscite posições apagadas no servidor
  (mesmo bug que já apareceu no Genesis — servidor sempre manda).
- Testar `revoke/grant` das RPCs (nada de authenticated escrevendo saldo direto).

---

## Referências de código

- Base OLEXP: [olexp.ts](../src/wallet/olexp.ts), [olexpSync.ts](../src/wallet/olexpSync.ts),
  [OlexpTab.tsx](../src/pages/wallet/OlexpTab.tsx),
  [migration olexp_balances](../supabase/migrations/20260528000100_olexp_balances.sql)
- Modelo a copiar (HODL): [hodl integration](../supabase/migrations/20260528000200_hodl_olexp_integration.sql),
  [hodl-daily-tick](../supabase/functions/hodl-daily-tick/index.ts)
- GAT: [gat.ts](../src/wallet/gat.ts), [GatTab.tsx](../src/pages/wallet/GatTab.tsx),
  [constants.ts](../src/wallet/constants.ts)
- Cron precedente no projeto: [global-league-tick](../supabase/functions/global-league-tick/index.ts)
