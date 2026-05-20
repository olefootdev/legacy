-- Fix: conta managers reais a partir de auth.users (não profiles que pode ficar órfão).
-- SECURITY DEFINER permite acesso a auth.users.
create or replace function public.get_total_managers()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int from auth.users;
$$;
