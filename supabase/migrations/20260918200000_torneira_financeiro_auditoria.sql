-- ════════════════════════════════════════════════════════════════════════════
-- ONDA 0 · A TORNEIRA DO CLIENTE — parte 1.5: o medidor do finance
-- ════════════════════════════════════════════════════════════════════════════
-- A varredura de 2026-09-01 (ver migration 20260901120000_torneira_do_cliente)
-- fechou o caminho 2 (profiles.exp_lifetime_earned) e mediu o caminho 3
-- (sync_my_exp_lifetime). O caminho 1 ficou de fora: `manager_game_state.finance`
-- continua sendo upsertado inteiro pelo cliente (persistManagerGameState em
-- src/supabase/managerGameState.ts) — o saldo é declarado pelo navegador.
--
-- Fechar de verdade (saldo calculado no servidor a partir de um ledger) é
-- trabalho de várias frentes. O que dá pra fazer AGORA, sem quebrar nenhum
-- fluxo, é o mesmo remédio já aplicado ao EXP: medir toda escrita, sinalizar a
-- implausível, pra reconciliação ter o que reconciliar.
--
-- ⚠️ Isto NÃO bloqueia nada. Continua sendo possível declarar qualquer saldo
-- pelo devtools. O que muda é que agora fica registrado, com antes/depois.
--
-- O trigger NUNCA pode derrubar o save do jogo: cast só quando o valor é
-- número JSON de verdade, e a gravação da auditoria engole o próprio erro.

create table if not exists public.manager_finance_snapshots (
  id                  bigserial primary key,
  user_id             uuid not null references auth.users (id) on delete cascade,
  previous_ole        numeric,
  new_ole             numeric,
  delta_ole           numeric,
  previous_bro_cents  numeric,
  new_bro_cents       numeric,
  delta_bro_cents     numeric,
  flagged             boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists manager_finance_snapshots_user_idx
  on public.manager_finance_snapshots (user_id, created_at desc);

create index if not exists manager_finance_snapshots_flagged_idx
  on public.manager_finance_snapshots (flagged) where flagged;

alter table public.manager_finance_snapshots enable row level security;

-- Trilha de auditoria: só o servidor (service_role) lê.
revoke all on public.manager_finance_snapshots from anon, authenticated;

comment on table public.manager_finance_snapshots is
  'Auditoria de toda escrita em manager_game_state.finance (Onda 0, parte 1.5). '
  'Mede sem bloquear enquanto o caminho 1 da torneira do cliente não fecha. '
  'Ver migration 20260901120000_torneira_do_cliente.sql.';

create or replace function public.jsonb_num(p jsonb, k text)
returns numeric
language sql
immutable
as $function$
  select case when jsonb_typeof(p -> k) = 'number' then (p ->> k)::numeric end;
$function$;

-- Limiar provisório: salto de OLE ou BRO acima disto num único upsert vira
-- `flagged`. 50.000.000 só pra não gerar ruído com a economia atual (card mais
-- caro ~250.000 OLE) — recalibrar quando houver distribuição real nesta tabela.
create or replace function public.audit_manager_finance_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_prev_ole  numeric;
  v_new_ole   numeric;
  v_prev_bro  numeric;
  v_new_bro   numeric;
  v_delta_ole numeric;
  v_delta_bro numeric;
  v_threshold constant numeric := 50000000;
begin
  if new.finance is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.finance is not distinct from new.finance then
      return new;
    end if;
    v_prev_ole := public.jsonb_num(old.finance, 'ole');
    v_prev_bro := public.jsonb_num(old.finance, 'broCents');
  end if;

  v_new_ole := public.jsonb_num(new.finance, 'ole');
  v_new_bro := public.jsonb_num(new.finance, 'broCents');
  v_delta_ole := coalesce(v_new_ole, 0) - coalesce(v_prev_ole, 0);
  v_delta_bro := coalesce(v_new_bro, 0) - coalesce(v_prev_bro, 0);

  begin
    insert into public.manager_finance_snapshots (
      user_id, previous_ole, new_ole, delta_ole,
      previous_bro_cents, new_bro_cents, delta_bro_cents, flagged
    ) values (
      new.user_id, v_prev_ole, v_new_ole, v_delta_ole,
      v_prev_bro, v_new_bro, v_delta_bro,
      (abs(v_delta_ole) > v_threshold) or (abs(v_delta_bro) > v_threshold)
    );
  exception when others then
    raise warning 'audit_manager_finance_change: auditoria não gravou (%)', sqlerrm;
  end;

  return new;
end;
$function$;

drop trigger if exists trg_audit_manager_finance on public.manager_game_state;
create trigger trg_audit_manager_finance
  before insert or update on public.manager_game_state
  for each row execute function public.audit_manager_finance_change();


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — exercita o caminho novo e desfaz o próprio rastro
-- ════════════════════════════════════════════════════════════════════════════
-- O teste funcional roda dentro de um sub-bloco que termina levantando
-- 'zz_verifica_ok'; o handler captura e o Postgres desfaz tudo que o sub-bloco
-- escreveu. Nenhum dado real fica alterado.
do $$
declare
  v_uid   uuid;
  v_count int;
  v_msg   text;
begin
  if has_table_privilege('authenticated', 'public.manager_finance_snapshots', 'SELECT')
     or has_table_privilege('anon', 'public.manager_finance_snapshots', 'SELECT') then
    raise exception 'cliente consegue ler manager_finance_snapshots';
  end if;

  select user_id into v_uid from public.manager_game_state limit 1;
  if v_uid is null then
    raise notice 'verificação: sem manager_game_state pra exercitar o trigger';
  else
    begin
      update public.manager_game_state
         set finance = jsonb_set(
               coalesce(finance, '{}'::jsonb), '{ole}',
               to_jsonb(coalesce(public.jsonb_num(finance, 'ole'), 0) + 60000000))
       where user_id = v_uid;

      select count(*) into v_count
        from public.manager_finance_snapshots
       where user_id = v_uid and delta_ole = 60000000 and flagged;
      if v_count <> 1 then
        raise exception 'trigger não auditou o salto de 60M (achou % linhas)', v_count;
      end if;

      -- valor malformado não pode travar o save do jogo
      update public.manager_game_state
         set finance = jsonb_set(coalesce(finance, '{}'::jsonb), '{ole}', '"abc"'::jsonb)
       where user_id = v_uid;

      raise exception 'zz_verifica_ok';
    exception when others then
      v_msg := sqlerrm;
      if v_msg <> 'zz_verifica_ok' then
        raise exception 'verificação do finance falhou: %', v_msg;
      end if;
    end;
  end if;

  raise notice 'verificação: ok — finance auditado sem travar o save';
end $$;
