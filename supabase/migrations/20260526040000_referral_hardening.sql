-- Hardening do sistema de referral (3 melhorias):
-- 1. save_onboarding_profile valida que referred_by_code é um my_referral_code real
--    de OUTRO usuário (bloqueia órfãos e auto-indicação silenciosamente).
-- 2. Revoga EXECUTE de anon/public nos RPCs (auth ainda checada internamente, mas
--    reduz superfície exposta no /rest/v1/rpc).
-- 3. SET search_path = public nas funções que faltavam (hardening contra injection
--    via search_path manipulado em sessões).

-- ============================================================
-- 1. Validação de referrer existente
-- ============================================================

create or replace function public.save_onboarding_profile(
  p_display_name text,
  p_club_name text,
  p_club_short text,
  p_onboarding_data jsonb,
  p_referred_by_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  v_code := nullif(regexp_replace(upper(coalesce(p_referred_by_code, '')), '[^A-Z0-9]', '', 'g'), '');
  if v_code is not null and (char_length(v_code) < 6 or char_length(v_code) > 8) then
    v_code := null;
  end if;

  if v_code is not null then
    if not exists (
      select 1 from public.profiles
      where my_referral_code = v_code and id <> v_uid
    ) then
      v_code := null;
    end if;
  end if;

  insert into public.profiles (id, display_name, club_name, club_short, onboarding_data, referred_by_code)
  values (v_uid, p_display_name, p_club_name, p_club_short, p_onboarding_data, v_code)
  on conflict (id) do update set
    display_name = excluded.display_name,
    club_name = excluded.club_name,
    club_short = excluded.club_short,
    onboarding_data = excluded.onboarding_data,
    referred_by_code = coalesce(public.profiles.referred_by_code, excluded.referred_by_code),
    updated_at = now();
end;
$$;

-- ============================================================
-- 2. Revoga EXECUTE de anon/public; só authenticated entra
-- ============================================================

revoke execute on function public.save_onboarding_profile(text, text, text, jsonb, text) from anon, public;
grant execute on function public.save_onboarding_profile(text, text, text, jsonb, text) to authenticated;

revoke execute on function public.get_my_referral_code() from anon, public;
grant execute on function public.get_my_referral_code() to authenticated;

revoke execute on function public.get_my_referrals() from anon, public;
grant execute on function public.get_my_referrals() to authenticated;

-- generate_unique_referral_code só é chamada pelo trigger (que roda no contexto
-- do owner da função): nem authenticated nem anon precisam invocá-la diretamente.
revoke execute on function public.generate_unique_referral_code() from anon, authenticated, public;

-- ============================================================
-- 3. search_path explícito nas funções que faltavam
-- ============================================================

create or replace function public.generate_unique_referral_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  v_code text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_attempts int := 0;
begin
  while v_attempts < 10 loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, (floor(random() * 32)::int) + 1, 1);
    end loop;
    if not exists(select 1 from public.profiles where my_referral_code = v_code) then
      return v_code;
    end if;
    v_attempts := v_attempts + 1;
  end loop;
  raise exception 'Failed to generate unique referral code after 10 attempts';
end;
$$;

create or replace function public.trg_generate_referral_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.my_referral_code is null then
    new.my_referral_code := public.generate_unique_referral_code();
  end if;
  return new;
end;
$$;

-- Re-revoga após o CREATE OR REPLACE (o CREATE recria grants default em PUBLIC).
revoke execute on function public.generate_unique_referral_code() from anon, authenticated, public;
revoke execute on function public.trg_generate_referral_code() from anon, authenticated, public;
