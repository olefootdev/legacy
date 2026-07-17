-- ============================================================
-- OLEFOOT — gasto repontado pro saldo que o jogador REALMENTE vê.
--
-- Contexto: `spend_olefoot` (20260608100000) debitava `olexp_balances`, enquanto
-- a Wallet exibe o ticker "OLEFOOT" a partir de `legacy_olefoot_credits` e o
-- `/api/market/buy-legacy` debita ESSA tabela. Ou seja: renovar contrato gastava
-- um saldo invisível, de outra tabela. Split-brain.
--
-- OLEXP foi removido do produto (2026-07-16). Esta migration cria o substituto
-- `spend_legacy_olefoot`, que debita a mesma tabela que a tela mostra e que o
-- mercado usa — uma moeda só, um número só.
--
-- Aritmética espelha server/src/routes/market.ts: o gasto é em unidade INTEIRA;
-- a parte fracionária do saldo é preservada intacta. balance_wei é mantido em
-- sincronia com balance_human (18 casas).
--
-- Aditiva e idempotente. NÃO dropa olexp_balances/olexp_ledger: o código parou de
-- usar, mas derrubar tabela é irreversível e fica a seu critério.
-- ============================================================

create or replace function public.spend_legacy_olefoot(
  p_amount     bigint,
  p_source     text,
  p_source_ref text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid             uuid := auth.uid();
  v_allowed_sources text[] := array['renovacao_contrato'];
  v_human           text;
  v_int             numeric;
  v_frac            text;
  v_new_int         numeric;
  v_new_human       text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  if p_source is null or not (p_source = any(v_allowed_sources)) then
    raise exception 'INVALID_SOURCE';
  end if;

  -- Lock da linha: dois gastos simultâneos não podem ler o mesmo saldo.
  select balance_human into v_human
    from public.legacy_olefoot_credits
   where user_id = v_uid
   for update;

  -- Usuário do v11 (não migrado) não tem linha → saldo 0.
  if v_human is null then
    raise exception 'INSUFFICIENT_OLEFOOT_BALANCE';
  end if;

  v_int  := coalesce(nullif(split_part(v_human, '.', 1), ''), '0')::numeric;
  v_frac := rpad(coalesce(split_part(v_human, '.', 2), ''), 18, '0');

  if v_int < p_amount::numeric then
    raise exception 'INSUFFICIENT_OLEFOOT_BALANCE';
  end if;

  v_new_int   := v_int - p_amount::numeric;
  v_new_human := v_new_int::text || '.' || v_frac;

  update public.legacy_olefoot_credits
     set balance_human = v_new_human,
         balance_wei   = (v_new_int * (10::numeric ^ 18)) + v_frac::numeric
   where user_id = v_uid;

  return v_new_int;
end;
$$;

revoke execute on function public.spend_legacy_olefoot(bigint, text, text) from anon, public;
grant  execute on function public.spend_legacy_olefoot(bigint, text, text) to authenticated;

-- O gasto por OLEXP não existe mais no cliente. Revogar impede que uma sessão
-- antiga (bundle em cache) continue debitando a tabela aposentada.
--
-- A assinatura é (numeric, text, text) — ver 20260608100000_spend_olefoot_rpc.sql.
-- O DO/exception cobre o ambiente onde a função nunca existiu: sem isso, um
-- `revoke` em função ausente aborta a transação inteira e nada acima é aplicado.
do $$
begin
  revoke execute on function public.spend_olefoot(numeric, text, text) from authenticated;
exception
  when undefined_function then null;
end $$;
