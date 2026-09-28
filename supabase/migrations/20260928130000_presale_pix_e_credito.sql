-- presale_pack entra como product_kind aceito no Pix que já funciona.
alter table public.payment_intents drop constraint if exists payment_intents_product_kind_check;
alter table public.payment_intents add constraint payment_intents_product_kind_check
  check (product_kind = any (array['activation_pack'::text,'card'::text,'recharge'::text,'presale_pack'::text]));

-- Credita a posição travada quando o Pix da pré-venda é aprovado.
-- security definer porque escreve em presale_* (RLS sem policy de insert), e o
-- 🔴 revoke abaixo é obrigatório: o Postgres dá EXECUTE a PUBLIC em função nova
-- e "grant to service_role" NÃO restringe.
create or replace function public.presale_creditar(
  p_user uuid, p_ref text, p_usd_cents integer, p_brl_cents bigint,
  p_brl_por_usd_micro bigint, p_tokens_entregues numeric, p_tokens_brutos numeric
) returns table (creditou boolean, motivo text)
language plpgsql security definer set search_path = public as $$
declare v_existe boolean;
begin
  -- Idempotência: webhook reentregue não credita duas vezes.
  select exists(select 1 from presale_purchase where ref = p_ref and status = 'pago')
    into v_existe;
  if v_existe then return query select false, 'ref_ja_creditado'; return; end if;

  insert into presale_purchase (user_id, ref, usd_cents, brl_cents, brl_por_usd_micro,
                                tokens_entregues, tokens_brutos, status, paga_em)
  values (p_user, p_ref, p_usd_cents, p_brl_cents, p_brl_por_usd_micro,
          p_tokens_entregues, p_tokens_brutos, 'pago', now())
  on conflict (ref) do update set status = 'pago', paga_em = now();

  -- A posição acumula: compra_original_usd_cents é a base da razão de dólar.
  insert into presale_position (user_id, compra_original_usd_cents, tokens_totais)
  values (p_user, p_usd_cents, p_tokens_entregues)
  on conflict (user_id) do update set
    compra_original_usd_cents = presale_position.compra_original_usd_cents + p_usd_cents,
    tokens_totais = presale_position.tokens_totais + p_tokens_entregues,
    versao = presale_position.versao + 1,
    atualizado_em = now();

  update presale_config set tokens_vendidos = tokens_vendidos + p_tokens_entregues,
                            atualizado_em = now() where id;
  return query select true, null::text;
end;
$$;

revoke all on function public.presale_creditar(uuid,text,integer,bigint,bigint,numeric,numeric) from public, anon, authenticated;
grant execute on function public.presale_creditar(uuid,text,integer,bigint,bigint,numeric,numeric) to service_role;
