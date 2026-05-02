-- Sistema de username auto-gerado: firstName_clubShort (ex.: jonhnes_ofc).
-- Unicidade garantida por club_short ser UNIQUE na tabela.

-- 1a. Deduplica club_short existentes (sufixo numérico nas cópias).
do $$
declare
  dup record;
  duped record;
  v_short text;
  i int;
begin
  for dup in
    select club_short
    from public.profiles
    where club_short is not null
    group by club_short
    having count(*) > 1
  loop
    v_short := dup.club_short;
    i := 1;
    for duped in
      select id from public.profiles
      where club_short = v_short
      order by created_at asc
      offset 1
    loop
      update public.profiles
      set club_short = v_short || i::text
      where id = duped.id;
      i := i + 1;
    end loop;
  end loop;
end;
$$;

-- 1b. Torna club_short único (impede dois clubes com mesmas iniciais).
alter table public.profiles
  add constraint profiles_club_short_unique unique (club_short);

-- 2. Coluna username — derivada de display_name + club_short.
alter table public.profiles
  add column if not exists username text;

create unique index if not exists profiles_username_unique
  on public.profiles (username)
  where username is not null;

-- 3. Função utilitária para gerar username limpo.
create or replace function public.compute_username(p_display_name text, p_club_short text)
returns text
language plpgsql
immutable
as $$
declare
  v_first text;
  v_short text;
begin
  if p_display_name is null or p_club_short is null then
    return null;
  end if;
  -- Remove acentos, lowercase, só alfanumérico
  v_first := regexp_replace(
    lower(translate(
      p_display_name,
      'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñ',
      'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
    )),
    '[^a-z0-9]', '', 'g'
  );
  v_short := lower(regexp_replace(p_club_short, '[^a-zA-Z0-9]', '', 'g'));
  if v_first = '' or v_short = '' then
    return null;
  end if;
  return v_first || '_' || v_short;
end;
$$;

-- 4. Trigger: auto-atualiza username quando display_name ou club_short mudam.
create or replace function public.trg_update_username()
returns trigger
language plpgsql
as $$
begin
  new.username := public.compute_username(new.display_name, new.club_short);
  return new;
end;
$$;

drop trigger if exists trg_profiles_username on public.profiles;
create trigger trg_profiles_username
  before insert or update of display_name, club_short on public.profiles
  for each row
  execute function public.trg_update_username();

-- 5. Backfill perfis existentes.
update public.profiles
set username = public.compute_username(display_name, club_short)
where display_name is not null
  and club_short is not null
  and username is null;

-- 6. RPC para checar se iniciais já estão em uso.
create or replace function public.check_club_short_available(p_club_short text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return not exists (
    select 1 from public.profiles
    where lower(club_short) = lower(p_club_short)
      and id != coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
end;
$$;

revoke all on function public.check_club_short_available(text) from public;
grant execute on function public.check_club_short_available(text) to authenticated, anon;

-- 7. RPC para buscar perfil por username (lookup de amigos).
create or replace function public.find_profile_by_username(p_username text)
returns table (
  id uuid,
  username text,
  display_name text,
  club_name text,
  club_short text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
    select p.id, p.username, p.display_name, p.club_name, p.club_short
    from public.profiles p
    where p.username = lower(p_username)
    limit 1;
end;
$$;

revoke all on function public.find_profile_by_username(text) from public;
grant execute on function public.find_profile_by_username(text) to authenticated;

-- 8. Atualiza get_my_onboarding_profile para incluir username.
create or replace function public.get_my_onboarding_profile()
returns table (
  display_name text,
  club_name text,
  club_short text,
  onboarding_data jsonb,
  username text
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
    select p.display_name, p.club_name, p.club_short, p.onboarding_data, p.username
      from public.profiles p
     where p.id = v_uid
     limit 1;
end;
$$;

revoke all on function public.get_my_onboarding_profile() from public;
grant execute on function public.get_my_onboarding_profile() to authenticated;
