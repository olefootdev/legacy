-- ============================================================================
-- DESLIGA A RENTABILIDADE — HODL / OLEXP / ganho diário
-- ============================================================================
-- Diretriz do fundador (2026-08-01): o OLEFOOT não tem mais rentabilidade,
-- não tem OLEXP e não tem ganho diário. O foco é o game e os CARDS.
--
-- O cliente já não mostra nada disso desde 2026-07-16. O SERVIDOR, porém,
-- continuava com um cron `hodl-daily-tick` agendado para 00:05 UTC todo dia
-- chamando `process_hodl_daily_tick()` — ou seja, possivelmente emitindo OLEXP
-- diariamente para uma moeda que o jogo não exibe mais.
--
-- ⚠️ O QUE ESTA MIGRATION **NÃO** FAZ, DE PROPÓSITO
-- ----------------------------------------------------------------------------
-- 1. NÃO apaga `olexp_balances` / `olexp_ledger` / `hodl_locks`. São saldo e
--    histórico. Apagar é decisão comercial e IRREVERSÍVEL — rode antes o bloco
--    de DIAGNÓSTICO abaixo e decida com o número na mão.
--
-- 2. NÃO toca em `premium_card_grants`, `get_my_premium_cards` nem
--    `redeem_premium_card`. Eles nasceram na mesma migration do HODL, mas os
--    CARDS **não são** do HODL: hoje vêm de `career_bonus` e `admin`, e o jogo
--    usa os dois RPCs em `src/wallet/premiumCards.ts`. Derrubá-los quebraria
--    justamente o que o produto quer preservar.
--
-- O que ela faz: PARA DE EMITIR. Nada mais.
-- ============================================================================


-- ─── 1. Desagenda o cron diário ────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('hodl-daily-tick');
    raise notice 'cron hodl-daily-tick desagendado';
  else
    raise notice 'pg_cron não instalado — nada a desagendar';
  end if;
exception when others then
  raise notice 'cron hodl-daily-tick não estava agendado (ok)';
end;
$$;


-- ─── 2. Derruba a função que credita o rendimento ──────────────────────────
-- Sem ela, nem cron nem Edge Function conseguem emitir mais nada.
drop function if exists public.process_hodl_daily_tick(date);
drop function if exists public.process_hodl_daily_tick();


-- ─── 3. Derruba a criação de novos locks ───────────────────────────────────
-- Ninguém mais deve conseguir travar saldo esperando rendimento.
drop function if exists public.create_hodl_lock(uuid, numeric, int);
drop function if exists public.create_hodl_lock(numeric, int);


-- ─── 4. Leitura de rendimento passa a devolver vazio ───────────────────────
drop function if exists public.get_hodl_rewards_for_lock(uuid);
drop function if exists public.get_recent_lottery_draws(int);


-- ─── 5. Marca a intenção no schema, pra quem vier depois ───────────────────
do $$
begin
  if to_regclass('public.olexp_balances') is not null then
    comment on table public.olexp_balances is
      'CONGELADA em 2026-08-01. OLEXP foi descontinuado; nada credita aqui. '
      'Mantida só como histórico — ver migration 20260801120000.';
  end if;
  if to_regclass('public.hodl_locks') is not null then
    comment on table public.hodl_locks is
      'CONGELADA em 2026-08-01. O HODL foi descontinuado; não há mais rendimento '
      'nem criação de locks. Conferir saldo travado antes de qualquer limpeza.';
  end if;
end;
$$;


-- ============================================================================
-- DIAGNÓSTICO — rode ANTES de decidir sobre os saldos
-- ============================================================================
-- ⚠️ ATENÇÃO: `hodl_locks.currency` aceita OLEXP, **BRO** e USDT. BRO é dinheiro
-- com valor real. Se houver lock ativo em BRO, existe dinheiro de manager preso
-- num sistema que acabou de ser desligado — isso precisa de decisão SUA antes
-- de qualquer limpeza, e provavelmente de devolução.
--
-- Rode no SQL Editor. Tudo zero => as tabelas podem sair numa limpeza posterior
-- sem prejudicar ninguém. Qualquer número > 0 => é de alguém.

-- select 'olexp_balances' as origem,
--        null::text        as moeda,
--        count(*)          as linhas,
--        coalesce(sum(balance), 0) as total
--   from public.olexp_balances
--  where balance > 0
-- union all
-- select 'hodl_locks ATIVOS',
--        currency,
--        count(*),
--        coalesce(sum(amount_locked), 0)
--   from public.hodl_locks
--  where status = 'active'
--  group by currency
-- union all
-- select 'hodl rewards já pagos',
--        currency,
--        count(*),
--        coalesce(sum(total_rewards_paid), 0)
--   from public.hodl_locks
--  where total_rewards_paid > 0
--  group by currency;
-- ============================================================================
