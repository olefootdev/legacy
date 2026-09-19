-- ════════════════════════════════════════════════════════════════════════════
-- A VIRADA · E2 — os relatórios da CSP ganham um destino
-- ════════════════════════════════════════════════════════════════════════════
-- A CSP do jogo roda em Report-Only desde 2026-09-18 sem `report-uri`: nenhum
-- relatório chegava. Sem isso não dá pra saber quando é seguro passar a
-- BLOQUEAR — e a tela das palavras da carteira embutida (C4) só pode existir
-- com a CSP bloqueando.
--
-- O servidor (POST /api/csp-report) normaliza cada relatório e chama
-- `record_csp_report`, que agrega por dia. Nada de URL completa: só a ORIGEM do
-- recurso bloqueado e o CAMINHO da página (query pode carregar token).
--
-- Critério pra ligar o bloqueio: 7 dias seguidos sem linha nova que não seja
-- ruído conhecido (extensão de navegador).

create table if not exists public.csp_reports (
  day            date not null default (now() at time zone 'utc')::date,
  directive      text not null,
  blocked        text not null default '',
  document_path  text not null default '',
  source         text not null default '',
  disposition    text not null default 'report',
  hits           integer not null default 1,
  first_seen     timestamptz not null default now(),
  last_seen      timestamptz not null default now(),
  primary key (day, directive, blocked, document_path, source, disposition)
);

alter table public.csp_reports enable row level security;
revoke all on public.csp_reports from anon, authenticated;

comment on table public.csp_reports is
  'Violações da CSP agregadas por dia (A VIRADA · E2). Escrita só pela RPC '
  'record_csp_report, chamada pelo servidor. Ver 20260919120000_csp_reports.sql.';

create or replace function public.record_csp_report(
  p_directive     text,
  p_blocked       text,
  p_document_path text,
  p_source        text,
  p_disposition   text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if coalesce(p_directive, '') = '' then
    return;
  end if;
  insert into public.csp_reports (directive, blocked, document_path, source, disposition)
  values (
    left(p_directive, 60),
    left(coalesce(p_blocked, ''), 200),
    left(coalesce(p_document_path, ''), 200),
    left(coalesce(p_source, ''), 200),
    left(coalesce(nullif(p_disposition, ''), 'report'), 20)
  )
  on conflict (day, directive, blocked, document_path, source, disposition)
  do update set hits = public.csp_reports.hits + 1, last_seen = now();
end;
$function$;

revoke execute on function public.record_csp_report(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_csp_report(text, text, text, text, text) to service_role;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — executa o que mudou e desfaz o próprio rastro
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_hits int;
  v_msg  text;
begin
  if has_table_privilege('authenticated', 'public.csp_reports', 'SELECT')
     or has_table_privilege('anon', 'public.csp_reports', 'SELECT')
     or has_table_privilege('authenticated', 'public.csp_reports', 'INSERT') then
    raise exception 'cliente acessa csp_reports direto';
  end if;
  if has_function_privilege('authenticated', 'public.record_csp_report(text,text,text,text,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.record_csp_report(text,text,text,text,text)', 'EXECUTE') then
    raise exception 'cliente executa record_csp_report';
  end if;
  if not has_function_privilege('service_role', 'public.record_csp_report(text,text,text,text,text)', 'EXECUTE') then
    raise exception 'service_role não executa record_csp_report';
  end if;

  begin
    perform public.record_csp_report('zz-teste-src', 'https://x.example', '/zz', '', 'report');
    perform public.record_csp_report('zz-teste-src', 'https://x.example', '/zz', '', 'report');
    select hits into v_hits from public.csp_reports
     where directive = 'zz-teste-src' and document_path = '/zz';
    if v_hits is distinct from 2 then
      raise exception 'agregação falhou: hits = %', v_hits;
    end if;
    raise exception 'zz_verifica_ok';
  exception when others then
    v_msg := sqlerrm;
    if v_msg <> 'zz_verifica_ok' then
      raise exception 'verificação do csp_reports falhou: %', v_msg;
    end if;
  end;

  raise notice 'verificação: ok — relatório agrega por dia, cliente não lê nem escreve';
end $$;
