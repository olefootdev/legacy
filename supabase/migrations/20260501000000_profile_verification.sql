-- Verificação de conta — dados protegidos por RLS; RPCs SECURITY DEFINER.
-- TODO: criptografia em repouso (pgsodium ou app-layer) antes de produção com usuários reais.

alter table public.profiles
  add column if not exists verified boolean not null default false,
  add column if not exists verification_status text not null default 'not_submitted',
  add column if not exists verification_data jsonb,
  add column if not exists verification_submitted_at timestamptz,
  add column if not exists verification_reviewed_at timestamptz,
  add column if not exists verification_rejection_reason text;

alter table public.profiles
  drop constraint if exists profiles_verification_status_chk;
alter table public.profiles
  add constraint profiles_verification_status_chk
    check (verification_status in ('not_submitted','pending','approved','rejected'));

create index if not exists profiles_verification_status_idx
  on public.profiles (verification_status)
  where verification_status = 'pending';

create or replace function public.submit_verification(p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'invalid payload'; end if;
  insert into public.profiles (id, verification_data, verification_status, verification_submitted_at, verified)
  values (v_uid, p_data, 'pending', now(), false)
  on conflict (id) do update set
    verification_data = p_data,
    verification_status = 'pending',
    verification_submitted_at = now(),
    verification_rejection_reason = null,
    updated_at = now();
end; $$;
revoke all on function public.submit_verification(jsonb) from public;
grant execute on function public.submit_verification(jsonb) to authenticated;

create or replace function public.get_my_verification()
returns table (
  verification_status text,
  verified boolean,
  verification_data jsonb,
  verification_submitted_at timestamptz,
  verification_reviewed_at timestamptz,
  verification_rejection_reason text
)
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  return query
    select p.verification_status, p.verified, p.verification_data,
           p.verification_submitted_at, p.verification_reviewed_at, p.verification_rejection_reason
      from public.profiles p where p.id = v_uid limit 1;
end; $$;
revoke all on function public.get_my_verification() from public;
grant execute on function public.get_my_verification() to authenticated;

create or replace function public.admin_list_verifications(p_status text default 'pending')
returns table (
  id uuid,
  display_name text,
  club_name text,
  verification_status text,
  verification_data jsonb,
  verification_submitted_at timestamptz,
  verification_reviewed_at timestamptz,
  verification_rejection_reason text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  return query
    select p.id, p.display_name, p.club_name,
           p.verification_status, p.verification_data,
           p.verification_submitted_at, p.verification_reviewed_at, p.verification_rejection_reason
      from public.profiles p
     where (p_status is null or p.verification_status = p_status)
     order by p.verification_submitted_at desc nulls last
     limit 200;
end; $$;
revoke all on function public.admin_list_verifications(text) from public;
grant execute on function public.admin_list_verifications(text) to authenticated;

create or replace function public.admin_set_verification(p_user_id uuid, p_approved boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if p_approved then
    update public.profiles
      set verified = true, verification_status = 'approved',
          verification_reviewed_at = now(), verification_rejection_reason = null, updated_at = now()
      where id = p_user_id;
  else
    update public.profiles
      set verified = false, verification_status = 'rejected',
          verification_reviewed_at = now(), verification_rejection_reason = p_reason, updated_at = now()
      where id = p_user_id;
  end if;
end; $$;
revoke all on function public.admin_set_verification(uuid, boolean, text) from public;
grant execute on function public.admin_set_verification(uuid, boolean, text) to authenticated;
