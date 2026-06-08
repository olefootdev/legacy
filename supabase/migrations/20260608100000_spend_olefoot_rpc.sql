-- ============================================================
-- spend_olefoot RPC
--
-- Permite que o user autenticado gaste OLEFOOT (=OLEXP) em compras in-game
-- (renovação de contrato, marketplace premium, etc) com auditoria via ledger.
--
-- Embrulha o _debit_olexp interno (que continua revogado de authenticated)
-- expondo apenas operações com source whitelisteado. Isso impede que código
-- malicioso debite OLEFOOT pra origens arbitrárias.
--
-- Whitelist atual:
--   'renovacao_contrato' — renovação de contrato de jogador (Academia OLE)
--
-- Ampliar conforme novas features que aceitem OLEFOOT.
-- ============================================================

create or replace function public.spend_olefoot(
  p_amount numeric,
  p_source text,
  p_source_ref text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_new_balance numeric(36, 8);
  v_allowed_sources text[] := array[
    'renovacao_contrato'
  ];
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED: precisa estar autenticado pra gastar OLEFOOT';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT: valor deve ser positivo';
  end if;

  if not (p_source = any(v_allowed_sources)) then
    raise exception 'INVALID_SOURCE: % não está na whitelist', p_source;
  end if;

  -- _debit_olexp valida saldo (raise INSUFFICIENT_OLEXP_BALANCE), faz lock
  -- da row e escreve no ledger numa transação só.
  v_new_balance := public._debit_olexp(v_user_id, p_amount, p_source, p_source_ref);

  return v_new_balance;
end;
$$;

revoke execute on function public.spend_olefoot(numeric, text, text) from anon, public;
grant execute on function public.spend_olefoot(numeric, text, text) to authenticated;

comment on function public.spend_olefoot(numeric, text, text) is
  'Debita OLEFOOT do user autenticado pra fonte whitelisteada. Lança INSUFFICIENT_OLEXP_BALANCE se sem saldo. Auditável via olexp_ledger.';
