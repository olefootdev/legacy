-- ============================================================
-- FIX (Ghost Map 2026-07-10, ponte #1): claim_my_affiliate_commissions
-- queimava o valor — marcava claimed_at e retornava o total, mas NUNCA
-- inseria wallet_credits, então o saldo do afiliado nunca era creditado.
-- Aqui a função passa a inserir wallet_credits por moeda (BRO/EXP),
-- espelhando exatamente o padrão de claim_career_bonus (applied_at = null
-- → aplicado no SPOT do usuário via applyPendingCredits no próximo mount).
-- ============================================================

create or replace function public.claim_my_affiliate_commissions(
  p_currency text default null
)
returns table (
  currency text,
  total_cents bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  return query
  with claimed as (
    update public.affiliate_commissions
       set claimed_at = now()
     where referrer_id = v_uid
       and claimed_at is null
       and status = 'confirmed'
       and (p_currency is null or currency = p_currency)
    returning currency, amount_cents
  ),
  totals as (
    select c.currency as cur, coalesce(sum(c.amount_cents), 0)::bigint as tot
      from claimed c
     group by c.currency
  ),
  -- Data-modifying CTE: roda até o fim mesmo sem ser referenciada no SELECT final.
  credited as (
    insert into public.wallet_credits (user_id, bro_cents, exp_amount, reason, applied_at)
    select
      v_uid,
      case when upper(t.cur) = 'BRO' then t.tot else 0 end,
      case when upper(t.cur) = 'EXP' then t.tot else 0 end,
      'affiliate_commission:' || t.cur,
      null
    from totals t
    where t.tot > 0
    returning 1
  )
  select t.cur, t.tot
    from totals t;
end;
$$;

revoke execute on function public.claim_my_affiliate_commissions(text) from anon, public;
grant execute on function public.claim_my_affiliate_commissions(text) to authenticated;
