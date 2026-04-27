-- ============================================================================
-- Olefoot Liga — Cron job para o tick da Edge Function global-league-tick
-- ============================================================================
-- Habilita pg_cron + pg_net e agenda chamada HTTP a cada 1 minuto à Edge
-- Function que avança rodadas agendadas. URL e service role key são lidos
-- de Vault para não vazarem no schema.
--
-- ANTES DE RODAR ESTA MIGRATION você precisa setar 2 segredos no Vault:
--
--   select vault.create_secret(
--     'https://<SEU_PROJECT_REF>.supabase.co/functions/v1/global-league-tick',
--     'global_league_tick_url',
--     'URL pública da Edge Function global-league-tick'
--   );
--
--   select vault.create_secret(
--     '<SEU_SERVICE_ROLE_KEY>',
--     'global_league_tick_service_role_key',
--     'Service role key usada pela cron para chamar a Edge Function'
--   );
--
-- Depois deploy a Edge Function:
--   supabase functions deploy global-league-tick --no-verify-jwt
--
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Permitir execução de cron pelo postgres role
grant usage on schema cron to postgres;

-- Remover job anterior se existir (idempotente em re-deploys)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'global-league-tick') then
    perform cron.unschedule('global-league-tick');
  end if;
end$$;

-- Agendar tick a cada 1 minuto
select cron.schedule(
  'global-league-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'global_league_tick_url' limit 1),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'global_league_tick_service_role_key' limit 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);

comment on extension pg_cron is 'Job scheduler — usado pelo Olefoot para tick da Liga Global';
comment on extension pg_net is 'Async HTTP client — usado pelo cron para chamar Edge Functions';
