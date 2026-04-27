-- Registra o código de indicação (referrer) de cada usuário no cadastro.
-- O código fica gravado no profile pra permitir: (a) tracking cross-device,
-- (b) relatórios de admin sobre quem indicou quem, (c) crédito de indicação.
-- Imutável após a primeira gravação (não se troca de patrocinador).

alter table public.profiles
  add column if not exists referred_by_code text;

-- Índice pra consultar cadastros por código (admin / growth analytics).
create index if not exists profiles_referred_by_code_idx
  on public.profiles (referred_by_code)
  where referred_by_code is not null;

-- Substitui a RPC pra aceitar o código de indicação opcional.
-- Postgres não permite adicionar param com default à função existente sem drop;
-- drop da assinatura antiga pra recriar com 5 args.
drop function if exists public.save_onboarding_profile(text, text, text, jsonb);

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

  -- Normaliza: maiúsculas, só A-Z e 0-9, 6 a 8 chars. Qualquer coisa fora disso → null.
  v_code := nullif(regexp_replace(upper(coalesce(p_referred_by_code, '')), '[^A-Z0-9]', '', 'g'), '');
  if v_code is not null and (char_length(v_code) < 6 or char_length(v_code) > 8) then
    v_code := null;
  end if;

  insert into public.profiles (id, display_name, club_name, club_short, onboarding_data, referred_by_code)
  values (v_uid, p_display_name, p_club_name, p_club_short, p_onboarding_data, v_code)
  on conflict (id) do update set
    display_name = excluded.display_name,
    club_name = excluded.club_name,
    club_short = excluded.club_short,
    onboarding_data = excluded.onboarding_data,
    -- referred_by_code é imutável: só grava se o profile ainda não tinha código.
    referred_by_code = coalesce(public.profiles.referred_by_code, excluded.referred_by_code),
    updated_at = now();
end;
$$;

revoke all on function public.save_onboarding_profile(text, text, text, jsonb, text) from public;
grant execute on function public.save_onboarding_profile(text, text, text, jsonb, text) to authenticated;
