-- ============================================================================
-- OLEFOOT — RPCs de invite/approve para beta_testers
-- ============================================================================

create or replace function public.generate_beta_invite_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  v_code text;
  v_attempts int := 0;
begin
  loop
    v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    exit when not exists (select 1 from public.beta_testers where invite_code = v_code);
    v_attempts := v_attempts + 1;
    if v_attempts > 10 then
      raise exception 'Failed to generate unique invite code after 10 attempts';
    end if;
  end loop;
  return v_code;
end;
$$;

create or replace function public.admin_approve_beta_tester(
  p_tester_id uuid,
  p_notes text default null
)
returns table (id uuid, email text, status text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_code text;
begin
  if not public.is_admin() then
    raise exception 'Forbidden: admin only';
  end if;

  v_code := public.generate_beta_invite_code();

  return query
  update public.beta_testers t
     set status = 'approved',
         invite_code = coalesce(t.invite_code, v_code),
         approved_at = now(),
         approved_by = v_admin,
         notes = coalesce(p_notes, t.notes)
   where t.id = p_tester_id and t.status in ('pending','rejected')
  returning t.id, t.email, t.status, t.invite_code;
end;
$$;

grant execute on function public.admin_approve_beta_tester(uuid, text) to authenticated;

create or replace function public.admin_invite_beta_tester(
  p_email text,
  p_source text default 'admin',
  p_notes text default null
)
returns table (id uuid, email text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_code text;
  v_email text := lower(trim(p_email));
begin
  if not public.is_admin() then
    raise exception 'Forbidden: admin only';
  end if;
  if v_email = '' or v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'Invalid email';
  end if;

  v_code := public.generate_beta_invite_code();

  return query
  insert into public.beta_testers (email, status, invite_code, invited_by, approved_at, approved_by, source, notes)
  values (v_email, 'approved', v_code, v_admin, now(), v_admin, p_source, p_notes)
  on conflict (email) do update
    set status = case when public.beta_testers.status = 'pending' then 'approved' else public.beta_testers.status end,
        invite_code = coalesce(public.beta_testers.invite_code, excluded.invite_code),
        approved_at = coalesce(public.beta_testers.approved_at, excluded.approved_at),
        approved_by = coalesce(public.beta_testers.approved_by, excluded.approved_by),
        updated_at = now()
  returning beta_testers.id, beta_testers.email, beta_testers.invite_code;
end;
$$;

grant execute on function public.admin_invite_beta_tester(text, text, text) to authenticated;

create or replace function public.redeem_beta_invite(p_invite_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(trim(p_invite_code));
begin
  if v_user is null then
    raise exception 'Must be authenticated to redeem invite';
  end if;

  update public.beta_testers
     set user_id = v_user,
         status = 'active',
         updated_at = now()
   where invite_code = v_code
     and status = 'approved'
     and (user_id is null or user_id = v_user);

  return found;
end;
$$;

grant execute on function public.redeem_beta_invite(text) to authenticated;

create or replace function public.admin_revoke_beta_access(
  p_tester_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden: admin only';
  end if;

  update public.beta_testers
     set status = 'revoked',
         notes = coalesce(p_reason, notes),
         updated_at = now()
   where id = p_tester_id;

  return found;
end;
$$;

grant execute on function public.admin_revoke_beta_access(uuid, text) to authenticated;
