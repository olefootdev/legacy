-- RPC pra verificar se um e-mail já está cadastrado em auth.users.
-- Retorna apenas boolean (não vaza dados do usuário). Case-insensitive.
-- Usado no cadastro pra avisar o usuário inline em vez de esperar o submit.

create or replace function public.check_email_exists(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email = '' or position('@' in v_email) = 0 then
    return false;
  end if;
  return exists (
    select 1 from auth.users u where lower(u.email) = v_email
  );
end;
$$;

revoke all on function public.check_email_exists(text) from public;
grant execute on function public.check_email_exists(text) to anon, authenticated;
