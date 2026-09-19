-- ════════════════════════════════════════════════════════════════════════════
-- MANUTENÇÃO — os logs internos param de derrubar o banco
-- ════════════════════════════════════════════════════════════════════════════
-- Em 2026-09-19 o jogo ficou ~12h com login travado. Causa: o worker do pg_net
-- (que dispara as chamadas HTTP dos cron jobs) estava PRESO desde 05/08 — 45
-- dias segurando `net._http_response` numa transação que nunca fechava. Com a
-- tabela travada, nenhum autovacuum rodava nela: 396 linhas vivas ocupando
-- 188 MB. A limpeza do próprio pg_net varria esses 188 MB a cada poucos
-- segundos e comia o IO do disco. Sem IO, o PostgREST não conseguia ler o
-- schema cache dentro do statement_timeout (PGRST002 + 57014) e respondia 503
-- em TUDO; o /auth/v1/token dava 504. Junto, `cron.job_run_details` tinha
-- 283 MB de histórico (366 mil execuções) que ninguém nunca apagou.
--
-- Depois do reinício do projeto (o worker preso só sai assim — ele ignora
-- pg_cancel_backend e pg_terminate_backend) e do truncate das duas tabelas:
-- banco 515 MB → 44 MB, API 503/13s → 200/0,2s.
--
-- Estas duas rotinas existem pra isso não voltar. São só LOGS INTERNOS de
-- infraestrutura: nada de dado de jogo, jogador, partida ou dinheiro.

-- Evita duplicar se a migration rodar de novo.
select cron.unschedule(jobid) from cron.job where jobname in ('purge-cron-history', 'vacuum-pg-net');

-- Histórico do cron: guarda 3 dias (suficiente pra investigar), apaga o resto.
select cron.schedule(
  'purge-cron-history',
  '20 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '3 days'$$
);

-- pg_net: o vacuum semanal recupera o espaço das respostas já expiradas. Se o
-- worker travar de novo, o vacuum será pulado por conflito de lock — e o
-- tamanho da tabela volta a crescer, que é justamente o sinal de alerta.
select cron.schedule(
  'vacuum-pg-net',
  '40 3 * * 0',
  $$vacuum (analyze) net._http_response$$
);


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — os dois jobs existem, estão ativos e com o agendamento certo
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_purge  record;
  v_vacuum record;
begin
  select * into v_purge from cron.job where jobname = 'purge-cron-history';
  if v_purge is null or not v_purge.active or v_purge.schedule <> '20 3 * * *' then
    raise exception 'purge-cron-history não ficou agendado como esperado';
  end if;

  select * into v_vacuum from cron.job where jobname = 'vacuum-pg-net';
  if v_vacuum is null or not v_vacuum.active or v_vacuum.schedule <> '40 3 * * 0' then
    raise exception 'vacuum-pg-net não ficou agendado como esperado';
  end if;

  raise notice 'verificação: ok — purga do histórico do cron (diária) e vacuum do pg_net (semanal)';
end $$;
