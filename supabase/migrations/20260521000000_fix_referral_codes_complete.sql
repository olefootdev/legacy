-- Fix: Complete referral code system
-- Adds: my_referral_code column, trigger to generate it, RPCs to query it

-- 1. Add my_referral_code column (the code that THIS user generates for sharing)
alter table public.profiles
  add column if not exists my_referral_code text unique;

-- 2. Create index for lookup by my_referral_code
create index if not exists profiles_my_referral_code_idx
  on public.profiles (my_referral_code)
  where my_referral_code is not null;

-- 3. Function to generate unique referral code (8 chars, A-Z and 2-9)
create or replace function public.generate_unique_referral_code()
returns text
language plpgsql
as $$
declare
  v_code text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_attempts int := 0;
begin
  -- Try up to 10 times to find a unique code
  while v_attempts < 10 loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, (floor(random() * 32)::int) + 1, 1);
    end loop;

    -- Check if code already exists
    if not exists(select 1 from public.profiles where my_referral_code = v_code) then
      return v_code;
    end if;

    v_attempts := v_attempts + 1;
  end loop;

  -- Fallback: if we somehow fail, raise error
  raise exception 'Failed to generate unique referral code after 10 attempts';
end;
$$;

-- 4. Trigger to auto-generate my_referral_code on profile creation
create or replace function public.trg_generate_referral_code()
returns trigger
language plpgsql
as $$
begin
  if new.my_referral_code is null then
    new.my_referral_code := public.generate_unique_referral_code();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_generate_referral_code_trg on public.profiles;

create trigger profiles_generate_referral_code_trg
  before insert on public.profiles
  for each row
  execute function public.trg_generate_referral_code();

-- 5. RPC: Get the current user's referral code
create or replace function public.get_my_referral_code()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  select my_referral_code into v_code
    from public.profiles
   where id = auth.uid();

  return v_code;
end;
$$;

revoke all on function public.get_my_referral_code() from public;
grant execute on function public.get_my_referral_code() to authenticated;

-- 6. RPC: Get all profiles that were referred by the current user's code
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
  -- Get the current user's referral code
  select my_referral_code into v_my_code
    from public.profiles
   where id = auth.uid();

  if v_my_code is null then
    return;
  end if;

  -- Return all profiles referred by this code
  return query
    select p.id, p.display_name, p.club_name, p.club_short, p.created_at
      from public.profiles p
     where p.referred_by_code = v_my_code
     order by p.created_at desc;
end;
$$;

revoke all on function public.get_my_referrals() from public;
grant execute on function public.get_my_referrals() to authenticated;

-- 7. Populate my_referral_code for existing users (safely, without conflicts)
-- Each user who doesn't have a code gets one
do $$
declare
  v_profile record;
  v_code text;
  v_attempts int;
begin
  for v_profile in select id from public.profiles where my_referral_code is null
  loop
    v_attempts := 0;
    v_code := null;

    while v_attempts < 10 and v_code is null loop
      v_code := public.generate_unique_referral_code();

      -- Try to update; if it fails due to unique constraint, try again
      begin
        update public.profiles set my_referral_code = v_code where id = v_profile.id;
      exception when unique_violation then
        v_code := null;
      end;

      v_attempts := v_attempts + 1;
    end loop;
  end loop;
end $$;
