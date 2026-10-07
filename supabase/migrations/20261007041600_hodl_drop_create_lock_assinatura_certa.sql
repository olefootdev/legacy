-- ═══════════════════════════════════════════════════════════════════════════
-- HODL — o drop que não acertou o alvo, agora na assinatura certa
--
-- 🔴 A migration 20260801120000 (`desliga_rentabilidade_hodl_olexp`) desligou o
-- HODL: desagendou o `hodl-daily-tick`, congelou as tabelas e deu drop nas
-- funções que CRIAM valor. Só que o drop de `create_hodl_lock` errou a
-- assinatura — pediu `(uuid, numeric, int)` e `(numeric, int)`, e a função real
-- é `(numeric, text)`. `drop function if exists` com assinatura que não existe
-- não reclama: passa verde e não derruba nada.
--
-- Resultado: por 67 dias a função que cria lock de um produto descontinuado
-- continuou viva no banco. Não houve exposição — só `service_role` tem EXECUTE
-- (`anon` e `authenticated` = false) e nenhum arquivo .ts a chama — mas é
-- gatilho armado num produto morto, e o motor que pagaria o rendimento já não
-- existe: um lock criado hoje nunca renderia.
--
-- É a Regra 3 do _TEMPLATE de novo, do lado do DROP: assinatura se copia do
-- `pg_get_function_identity_arguments`, não da memória. E `if exists` silencioso
-- é exatamente o "Success" que esconde o erro (Regra 2).
--
-- NÃO entra no escopo (decisão da 20260801120000, mantida de propósito):
-- `get_my_hodl_locks`, `get_my_olexp_balance` e `get_my_olexp_ledger` seguem de
-- pé — são LEITURA, e existem pra conferir saldo travado antes de qualquer
-- limpeza. As tabelas `hodl_locks`, `hodl_daily_rewards`, `hodl_lottery_draws`,
-- `olexp_balances` e `olexp_ledger` continuam congeladas como histórico.
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.create_hodl_lock(numeric, text);


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — roda junto e derruba tudo se falhar
-- ═══════════════════════════════════════════════════════════════════════════
-- Não confere a assinatura que eu escrevi: conta quantas `create_hodl_lock`
-- sobraram no schema, em QUALQUER assinatura. Foi a pergunta errada que deixou
-- esta função viva em 2026-08-01.
do $$
declare sobraram int;
begin
  select count(*) into sobraram
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'create_hodl_lock';

  if sobraram > 0 then
    raise exception 'ainda existe(m) % create_hodl_lock em public: %', sobraram,
      (select string_agg(p.proname||'('||pg_get_function_identity_arguments(p.oid)||')', ', ')
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'create_hodl_lock');
  end if;

  -- o motor de rendimento tem que continuar ausente
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'process_hodl_daily_tick') then
    raise exception 'process_hodl_daily_tick voltou — o rendimento do HODL está desligado desde 2026-08-01';
  end if;

  -- e o cron não pode ter voltado
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from cron.job where jobname = 'hodl-daily-tick') then
    raise exception 'o cron hodl-daily-tick está agendado de novo';
  end if;

  raise notice 'verificação: ok — create_hodl_lock removida, rendimento e cron seguem desligados';
end $$;
