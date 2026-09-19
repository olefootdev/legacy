-- ════════════════════════════════════════════════════════════════════════════
-- A VIRADA · E1 — a auditoria do finance para de gritar à toa
-- ════════════════════════════════════════════════════════════════════════════
-- A 20260918200000 criou `trg_audit_manager_finance` como BEFORE INSERT OR
-- UPDATE. O save do jogo é um upsert (onConflict: 'user_id'), e num upsert o
-- BEFORE INSERT dispara SEMPRE — antes do Postgres descobrir o conflito. Nessa
-- fase não existe OLD: a auditoria gravava previous = null e delta = saldo
-- inteiro, e depois o UPDATE gravava a linha certa. Resultado medido em
-- 2026-09-19: 5 dos 6 alertas eram falsos, e todo manager com > 50M virava
-- "sinalizado" a cada save, mesmo sem mudar nada.
--
-- AFTER resolve pela semântica do próprio Postgres: AFTER INSERT só dispara se
-- a linha foi de fato inserida; no ON CONFLICT DO UPDATE dispara só o AFTER
-- UPDATE. A função não muda — em AFTER o `return new` é ignorado, e ela não
-- altera NEW. O `of finance` evita rodar a função quando o save nem toca no
-- saldo.
--
-- Os 5 alertas falsos já gravados são DADO, não schema: ficam como estão (a
-- tabela é só trilha de auditoria, lida pela service role).

drop trigger if exists trg_audit_manager_finance on public.manager_game_state;
create trigger trg_audit_manager_finance
  after insert or update of finance on public.manager_game_state
  for each row execute function public.audit_manager_finance_change();


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — exercita o upsert de verdade e desfaz o próprio rastro
-- ════════════════════════════════════════════════════════════════════════════
-- O sub-bloco termina levantando 'zz_verifica_ok'; o handler captura e o
-- Postgres desfaz tudo que foi escrito. Nenhum dado real fica alterado.
do $$
declare
  v_uid     uuid;
  v_before  bigint;
  v_after   bigint;
  v_fake    int;
  v_msg     text;
begin
  -- 1. o gatilho existe e é AFTER (bit 1 de tgtype = BEFORE)
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.manager_game_state'::regclass
       and tgname = 'trg_audit_manager_finance'
       and not tgisinternal
       and (tgtype & 2) = 0
  ) then
    raise exception 'trg_audit_manager_finance não está como AFTER';
  end if;

  select user_id into v_uid
    from public.manager_game_state
   where public.jsonb_num(finance, 'ole') is not null
   limit 1;

  if v_uid is null then
    raise notice 'verificação: sem manager_game_state com finance pra exercitar';
  else
    begin
      select coalesce(max(id), 0) into v_before from public.manager_finance_snapshots;

      -- 2. upsert IDÊNTICO ao do cliente, sem mudar o saldo → zero linhas
      insert into public.manager_game_state
      select * from public.manager_game_state where user_id = v_uid
      on conflict (user_id) do update set finance = excluded.finance;

      select count(*) into v_fake
        from public.manager_finance_snapshots where id > v_before;
      if v_fake <> 0 then
        raise exception 'upsert sem mudança gerou % linha(s) de auditoria', v_fake;
      end if;

      -- 3. upsert com salto de 60M → exatamente 1 linha, com o saldo anterior
      insert into public.manager_game_state
      select * from public.manager_game_state where user_id = v_uid
      on conflict (user_id) do update
        set finance = jsonb_set(
              coalesce(excluded.finance, '{}'::jsonb), '{ole}',
              to_jsonb(coalesce(public.jsonb_num(excluded.finance, 'ole'), 0) + 60000000));

      select count(*) into v_fake
        from public.manager_finance_snapshots
       where id > v_before
         and user_id = v_uid
         and delta_ole = 60000000
         and previous_ole is not distinct from (
               select public.jsonb_num(finance, 'ole') - 60000000
                 from public.manager_game_state where user_id = v_uid)
         and flagged;
      select count(*) into v_after
        from public.manager_finance_snapshots where id > v_before;
      if v_fake <> 1 or v_after <> 1 then
        raise exception 'salto de 60M: esperava 1 linha certa, achou % certa(s) em % no total', v_fake, v_after;
      end if;

      raise exception 'zz_verifica_ok';
    exception when others then
      v_msg := sqlerrm;
      if v_msg <> 'zz_verifica_ok' then
        raise exception 'verificação da auditoria falhou: %', v_msg;
      end if;
    end;
  end if;

  raise notice 'verificação: ok — upsert sem mudança não audita, salto real audita uma vez';
end $$;
