-- ════════════════════════════════════════════════════════════════════════════
-- ONDA 0 · CAMINHO 1 — item #1: wallet_credits deixa de ser editável pelo cliente
-- ════════════════════════════════════════════════════════════════════════════
-- A policy "user marks own credit applied" (20260421194739) só validava
-- `auth.uid() = user_id` — sem restringir COLUNA nem VALOR. Qualquer conta
-- autenticada podia, direto pelo supabase-js:
--   1. editar `bro_cents`/`exp_amount` das próprias linhas pra qualquer valor
--      positivo (só existe `check (bro_cents > 0)`); e/ou
--   2. voltar `applied_at` pra null num crédito já aplicado e receber de novo a
--      cada reload — replay infinito.
-- E cada aplicação dispara `trg_wallet_credit_affiliate_bonus` (5% pra cadeia
-- L1–L3 em affiliate_commissions, que é sacável) — então o buraco também
-- imprimia comissão real pra quem indicou.
--
-- A correção:
--   • o cliente só pode marcar applied_at, só de pendente → aplicado, só em
--     crédito não estornado (policy de mão única + grant só dessa coluna). É o
--     que mantém funcionando uma aba aberta com o bundle anterior ao deploy —
--     se o UPDATE sumisse por completo, essa aba creditaria o mesmo lote a cada
--     navegação, porque o "marcar aplicado" dela passaria a falhar;
--   • o caminho novo é `claim_pending_wallet_credits()`: trava as linhas, soma e
--     marca na mesma transação — sem corrida entre duas abas.
--
-- ⚠️ Não fecha o problema maior (finance ainda é upsertado inteiro pelo
-- cliente). `ADMIN_GRANT_RESOURCES` continua despachável pelo devtools; o que
-- muda é que o valor que entra por ESTE caminho vem do servidor, e o registro
-- no banco (que alimenta comissão) não é mais editável.

drop policy if exists "user marks own credit applied" on public.wallet_credits;
drop policy if exists "wallet_credits_mark_applied_one_way" on public.wallet_credits;
create policy "wallet_credits_mark_applied_one_way"
  on public.wallet_credits for update
  to authenticated
  using (user_id = auth.uid() and applied_at is null and voided_at is null)
  with check (user_id = auth.uid() and applied_at is not null);

revoke insert, update, delete, truncate on public.wallet_credits from anon, authenticated;
grant select on public.wallet_credits to authenticated;
grant update (applied_at) on public.wallet_credits to authenticated;

create or replace function public.claim_pending_wallet_credits()
returns table(bro_cents_total bigint, exp_amount_total bigint)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[];
  v_bro bigint;
  v_exp bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Trava ANTES de somar: a segunda chamada concorrente espera a primeira
  -- commitar e já encontra applied_at preenchido.
  with locked as (
    select id, bro_cents, exp_amount
      from public.wallet_credits
     where user_id = v_uid
       and applied_at is null
       and voided_at is null
     for update
  )
  select coalesce(array_agg(id), '{}'), coalesce(sum(bro_cents), 0), coalesce(sum(exp_amount), 0)
    into v_ids, v_bro, v_exp
    from locked;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return query select 0::bigint, 0::bigint;
    return;
  end if;

  -- Marca exatamente as linhas somadas — nunca re-avalia a condição, pra não
  -- engolir sem creditar um crédito que um webhook inseriu no meio do caminho.
  update public.wallet_credits
     set applied_at = now()
   where id = any(v_ids);

  return query select v_bro, v_exp;
end;
$function$;

revoke execute on function public.claim_pending_wallet_credits() from public, anon;
grant execute on function public.claim_pending_wallet_credits() to authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — exercita o caminho novo e desfaz o próprio rastro
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_uid  uuid;
  v_bro  bigint;
  v_exp  bigint;
  v_n    int;
  v_msg  text;
begin
  -- 1. cliente não edita valor, dono, nem cria/apaga crédito
  if has_column_privilege('authenticated', 'public.wallet_credits', 'bro_cents', 'UPDATE')
     or has_column_privilege('authenticated', 'public.wallet_credits', 'exp_amount', 'UPDATE')
     or has_column_privilege('authenticated', 'public.wallet_credits', 'user_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.wallet_credits', 'voided_at', 'UPDATE') then
    raise exception 'cliente ainda edita valor/dono/estorno de wallet_credits';
  end if;
  if has_table_privilege('authenticated', 'public.wallet_credits', 'INSERT')
     or has_table_privilege('authenticated', 'public.wallet_credits', 'DELETE')
     or has_any_column_privilege('anon', 'public.wallet_credits', 'UPDATE') then
    raise exception 'cliente ainda cria/apaga wallet_credits';
  end if;

  -- 2. mas ainda marca aplicado (aba com bundle antigo) — e só de mão única
  if not has_column_privilege('authenticated', 'public.wallet_credits', 'applied_at', 'UPDATE') then
    raise exception 'cliente perdeu o marcar-aplicado — aba antiga creditaria em loop';
  end if;
  select count(*) into v_n
    from pg_policies
   where schemaname = 'public' and tablename = 'wallet_credits'
     and cmd in ('UPDATE', 'ALL')
     and not (coalesce(qual, '') ilike '%applied_at IS NULL%'
              and coalesce(with_check, '') ilike '%applied_at IS NOT NULL%');
  if v_n > 0 then
    raise exception 'sobrou policy de UPDATE em wallet_credits que permite voltar applied_at';
  end if;

  -- 3. a RPC soma, marca, e não paga duas vezes
  select id into v_uid from auth.users order by created_at limit 1;
  if v_uid is null then
    raise notice 'verificação: sem usuários pra exercitar claim_pending_wallet_credits';
  else
    begin
      update public.wallet_credits set applied_at = now()
       where user_id = v_uid and applied_at is null and voided_at is null;

      insert into public.wallet_credits (user_id, bro_cents, exp_amount, reason)
      values (v_uid, 123, 0, 'zz-verifica'), (v_uid, 77, 5, 'zz-verifica');

      perform set_config('request.jwt.claim.sub', v_uid::text, true);
      select bro_cents_total, exp_amount_total into v_bro, v_exp
        from public.claim_pending_wallet_credits();
      if v_bro <> 200 or v_exp <> 5 then
        raise exception 'claim devolveu (%, %) em vez de (200, 5)', v_bro, v_exp;
      end if;

      select bro_cents_total, exp_amount_total into v_bro, v_exp
        from public.claim_pending_wallet_credits();
      if v_bro <> 0 or v_exp <> 0 then
        raise exception 'segundo claim pagou de novo: (%, %)', v_bro, v_exp;
      end if;

      raise exception 'zz_verifica_ok';
    exception when others then
      v_msg := sqlerrm;
      if v_msg <> 'zz_verifica_ok' then
        raise exception 'verificação de wallet_credits falhou: %', v_msg;
      end if;
    end;
    perform set_config('request.jwt.claim.sub', '', true);
  end if;

  raise notice 'verificação: ok — wallet_credits sem replay nem edição de valor';
end $$;
