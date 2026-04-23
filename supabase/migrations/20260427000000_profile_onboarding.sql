-- Estende `profiles` pra armazenar o payload completo do onboarding,
-- permitindo login cross-device: o manager faz signup → profile salvo →
-- em outro dispositivo faz login → hidrata managerProfile + clube +
-- favoriteRealTeam + formação a partir deste payload.

alter table public.profiles
  add column if not exists onboarding_data jsonb,
  add column if not exists display_name text,
  add column if not exists club_name text,
  add column if not exists club_short text;

-- RPC pra o próprio usuário salvar/atualizar seu onboarding.
create or replace function public.save_onboarding_profile(
  p_display_name text,
  p_club_name text,
  p_club_short text,
  p_onboarding_data jsonb
)
returns void
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
  insert into public.profiles (id, display_name, club_name, club_short, onboarding_data)
  values (v_uid, p_display_name, p_club_name, p_club_short, p_onboarding_data)
  on conflict (id) do update set
    display_name = excluded.display_name,
    club_name = excluded.club_name,
    club_short = excluded.club_short,
    onboarding_data = excluded.onboarding_data,
    updated_at = now();
end;
$$;

revoke all on function public.save_onboarding_profile(text, text, text, jsonb) from public;
grant execute on function public.save_onboarding_profile(text, text, text, jsonb) to authenticated;

-- RPC pra o próprio usuário ler seu profile (hidrata Zustand após login).
create or replace function public.get_my_onboarding_profile()
returns table (
  display_name text,
  club_name text,
  club_short text,
  onboarding_data jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;
  return query
    select p.display_name, p.club_name, p.club_short, p.onboarding_data
      from public.profiles p
     where p.id = v_uid
     limit 1;
end;
$$;

revoke all on function public.get_my_onboarding_profile() from public;
grant execute on function public.get_my_onboarding_profile() to authenticated;

-- Policy: usuário pode ler o próprio profile (já deve existir, mas garante).
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated
  using (id = auth.uid());
