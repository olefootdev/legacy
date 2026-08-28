-- ════════════════════════════════════════════════════════════════════════════
-- PRODUCT EVENTS — o cano de telemetria de produto do OLEFOOT
-- ════════════════════════════════════════════════════════════════════════════
-- Por que existe: o jogo tem 137 tabelas e NENHUMA responde "o jogador usou?".
-- O `trackMissionEvent` do TS parece telemetria mas não é — é o contador de
-- progresso das missões, enum fechado, sem destino nenhum fora do navegador.
--
-- Sem isto, as Fases 2 e 4 do Ultra-Concept (card de momento compartilhável e
-- pedido do vestiário) são aposta não medida: ninguém sabe se o card é
-- compartilhado nem qual resposta o manager escolhe.
--
-- ── ESCOPO: ESTREITO DE PROPÓSITO ──────────────────────────────────────────
-- Isto NÃO é um firehose de clique e pageview. São ~8 tipos de evento, todos
-- em ponto de DECISÃO, cada um disparando poucas vezes por sessão. A ordem de
-- grandeza é dezenas de linhas por manager por dia, não milhares.
--
-- ── PRIVACIDADE ────────────────────────────────────────────────────────────
-- 🔴 `user_id` é UUID de `auth.users`, NUNCA e-mail. O projeto já sangrou
-- e-mail duas vezes (ver migrations de revoke do anon na liga). O default é
-- `auth.uid()`, o `with check` prende a linha ao dono, e NÃO existe policy de
-- select: leitura é só service_role. Nada de PII entra em `props` — quem
-- escrever evento novo com nome, e-mail ou telefone lá dentro está errado.

create table if not exists public.product_events (
  id          bigint generated always as identity primary key,
  -- Dono do evento. Default auth.uid() pra que o cliente NUNCA precise mandar
  -- (e portanto nunca possa forjar) a identidade.
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Nome do evento em snake_case (ex.: 'moment_shared'). Sem enum de propósito:
  -- evento novo não deve exigir migration.
  event       text not null check (char_length(event) between 1 and 64),
  -- Dimensões do evento (tier, escolha, competição…). Só escalar e booleano.
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.product_events is
  'Telemetria de PRODUTO (uso de feature), não de jogo. Escrita pelo cliente com auth.uid(); leitura só service_role. NUNCA guardar PII em props.';

-- Consulta típica é "este evento, nesta janela" — o índice segue esse formato.
create index if not exists product_events_event_created_idx
  on public.product_events (event, created_at desc);

-- E "o que este manager fez", pra investigar um caso.
create index if not exists product_events_user_created_idx
  on public.product_events (user_id, created_at desc);

alter table public.product_events enable row level security;

-- Escrita: só a própria linha. Sem essa cláusula, um manager logado poderia
-- gravar evento no nome de outro e envenenar a métrica.
drop policy if exists product_events_insert_own on public.product_events;
create policy product_events_insert_own
  on public.product_events
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Leitura: NENHUMA policy, de propósito. RLS nega por padrão, então nem anon
-- nem authenticated leem — inclusive os próprios eventos. Análise roda pela
-- service_role no backend/admin.


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — roda junto e derruba tudo se falhar
-- ════════════════════════════════════════════════════════════════════════════
-- Exercita o CAMINHO NOVO, não a existência dele: grava uma linha de verdade
-- com um usuário real, confere que os defaults preencheram e que o jsonb
-- voltou íntegro, e apaga. Se a FK, o default ou o check estiverem errados,
-- a migration inteira volta atrás aqui — em vez de dizer "Success" e falhar
-- só quando o primeiro manager abrir a Home.
do $$
declare
  v_user   uuid;
  v_id     bigint;
  v_props  jsonb;
  v_at     timestamptz;
begin
  select id into v_user from auth.users limit 1;

  if v_user is null then
    -- Ambiente novo, sem usuário: não dá pra exercitar a FK. Não é falha.
    raise notice 'verificação: sem usuário em auth.users — insert não exercitado';
  else
    insert into public.product_events (user_id, event, props)
    values (v_user, 'zz_verificacao', '{"tier": 3, "ok": true}'::jsonb)
    returning id, props, created_at into v_id, v_props, v_at;

    if v_id is null then
      raise exception 'insert não devolveu id — identity quebrada';
    end if;
    if v_at is null then
      raise exception 'created_at não recebeu o default now()';
    end if;
    if (v_props ->> 'tier')::int <> 3 or (v_props ->> 'ok')::boolean is not true then
      raise exception 'props não fez round-trip em jsonb: %', v_props;
    end if;

    -- O default de props também precisa funcionar (o cliente pode omitir).
    insert into public.product_events (user_id, event)
    values (v_user, 'zz_verificacao_default')
    returning props into v_props;
    if v_props <> '{}'::jsonb then
      raise exception 'props não caiu no default {}: %', v_props;
    end if;

    delete from public.product_events where event like 'zz_verificacao%';
    raise notice 'verificação: insert, defaults e jsonb ok';
  end if;

  -- O check de tamanho do evento precisa REJEITAR de verdade.
  begin
    insert into public.product_events (user_id, event) values (v_user, '');
    raise exception 'o check de char_length aceitou evento vazio';
  exception
    when check_violation then null;  -- esperado
    when not_null_violation then null;  -- ambiente sem usuário: também barra
  end;

  -- RLS precisa estar LIGADA — sem isso a policy acima é decorativa.
  if not exists (
    select 1 from pg_class
    where oid = 'public.product_events'::regclass and relrowsecurity
  ) then
    raise exception 'RLS não ficou habilitada em product_events';
  end if;

  -- E não pode existir policy de select (leitura é só service_role).
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'product_events' and cmd = 'SELECT'
  ) then
    raise exception 'apareceu policy de SELECT — leitura deve ser só service_role';
  end if;

  raise notice 'verificação: ok';
end $$;
