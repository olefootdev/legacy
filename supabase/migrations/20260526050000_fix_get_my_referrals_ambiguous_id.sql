-- Fix: column reference "id" was ambiguous because RETURNS TABLE (id uuid, ...)
-- creates a variable named "id" that shadows profiles.id in the inner query.
--
-- Bug pré-existente da migration 20260521000000. ReferralTab + ManagerNetwork
-- recebiam 400 Bad Request silenciado pelo try/catch do client (`fetchMyReferrals`
-- só logava warning e retornava []), então a página parecia "vazia" mesmo com
-- dados no banco.
--
-- Diagnóstico veio do Network tab do browser: POST /rest/v1/rpc/get_my_referrals
-- → 400. SQL puro `select * from get_my_referrals()` retornou:
--   ERROR: 42702: column reference "id" is ambiguous
--   QUERY: select my_referral_code from public.profiles where id = auth.uid()

create or replace function public.get_my_referrals()
returns table (
  id uuid,
  display_name text,
  club_name text,
  club_short text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_my_code text;
begin
  -- Qualifica com alias pra evitar ambiguidade com a variável "id" do RETURNS TABLE
  select p.my_referral_code into v_my_code
    from public.profiles p
   where p.id = auth.uid();

  if v_my_code is null then
    return;
  end if;

  return query
    select p.id, p.display_name, p.club_name, p.club_short, p.created_at
      from public.profiles p
     where p.referred_by_code = v_my_code
     order by p.created_at desc;
end;
$$;

revoke execute on function public.get_my_referrals() from anon, public;
grant execute on function public.get_my_referrals() to authenticated;
