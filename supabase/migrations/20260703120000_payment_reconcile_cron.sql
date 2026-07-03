-- ============================================================================
-- Olefoot Pagamentos — Cron de reconciliação (webhook perdido = nada entregue)
-- ============================================================================
-- Agenda chamada HTTP a cada 10 min à Edge Function payment-reconcile, que
-- varre payment_intents 'pending' e pergunta ao Mercado Pago o status real.
-- URL e service role key vêm do Vault (não vazam no schema).
--
-- ANTES DE RODAR ESTA MIGRATION, setar 2 segredos no Vault:
--
--   select vault.create_secret(
--     'https://<SEU_PROJECT_REF>.supabase.co/functions/v1/payment-reconcile',
--     'payment_reconcile_url',
--     'URL da Edge Function payment-reconcile'
--   );
--
--   -- Reusa a service role key. Se já criou 'global_league_tick_service_role_key'
--   -- para o cron da Liga, pode reaproveitar aquele nome no bloco abaixo.
--   select vault.create_secret(
--     '<SEU_SERVICE_ROLE_KEY>',
--     'edge_cron_service_role_key',
--     'Service role key usada pelos crons para chamar Edge Functions'
--   );
--
-- Depois deploy a Edge Function (COM verify_jwt — só o cron chama):
--   supabase functions deploy payment-reconcile
--
-- E garanta os secrets da função: MP_ACCESS_TOKEN.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

grant usage on schema cron to postgres;

-- Idempotente em re-deploys
do $$
begin
  if exists (select 1 from cron.job where jobname = 'payment-reconcile') then
    perform cron.unschedule('payment-reconcile');
  end if;
end$$;

-- A cada 10 minutos
select cron.schedule(
  'payment-reconcile',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'payment_reconcile_url' limit 1),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_cron_service_role_key' limit 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);
