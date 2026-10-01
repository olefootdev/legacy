-- ═══════════════════════════════════════════════════════════════════════════
-- ADMIN P0 — o login do painel para de aceitar força bruta
--
-- O raio-x de 2026-09-30 (docs/ADMIN-RAIO-X-2026-09-30.md) mediu em produção
-- TRÊS versões vivas de `admin_panel_login`, todas executáveis por `anon`:
--   · (text,text)                — de 20260425000100, sem trava nenhuma;
--   · (text,text,text,text)     — de 20260425000002, sobrou como overload;
--   · (text,text,text,text,text) — de 20260426030409, que ao consertar o
--     schema do pgcrypto REMOVEU sem querer o rate-limit, o registro de
--     tentativas, a IP allow-list e o 2FA que as migrations de 25/04 criaram.
--
-- Resultado: qualquer pessoa com a chave pública do site podia tentar senhas
-- de admin sem limite e sem deixar rastro. Este arquivo:
--   1. DROPA as overloads de 2 e 4 argumentos (o cliente só chama a de 5);
--   2. reescreve a de 5 com a trava religada — 5 erros por e-mail (10 por IP)
--      em 15 minutos, via `check_admin_login_rate_limit` que já existia — e o
--      registro de cada tentativa em `admin_login_attempts`;
--   3. tentativa DURANTE a trava não é registrada: chute contínuo não pode
--      esticar o cadeado (a mesma regra do PIN da carteira).
--
-- O 2FA continua fora do login DE PROPÓSITO: religar o mock de 25/04 seria
-- teatro (o verificador aceita qualquer 6 dígitos). 2FA real é P2 do raio-x.
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.admin_panel_login(text, text);
drop function if exists public.admin_panel_login(text, text, text, text);

-- Corpo copiado de 20260426030409 (Regra 3: da fonte); o acréscimo é a trava
-- antes do crypt e o insert em admin_login_attempts nos dois desfechos.
create or replace function public.admin_panel_login(
  p_email text,
  p_password text,
  p_ip_address text default null,
  p_user_agent text default null,
  p_two_factor_code text default null
)
returns table (email text, display_name text, role text, two_factor_enabled boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(p_email));
  v_trava record;
begin
  if p_password is null or length(p_password) = 0 or v_email = '' then
    return;
  end if;

  -- 🔒 A trava vem ANTES do crypt. Bloqueado responde igual a senha errada
  -- (vazio): quem chuta não aprende nem se o e-mail existe.
  select * into v_trava from public.check_admin_login_rate_limit(v_email, p_ip_address);
  if v_trava.blocked then
    return;
  end if;

  update public.admin_panel_users au
     set last_login_at = now()
   where au.email = v_email
     and au.active = true
     and au.password_hash = extensions.crypt(p_password, au.password_hash);

  if not found then
    insert into public.admin_login_attempts (email, ip_address, user_agent, success, failure_reason)
    values (v_email, p_ip_address, p_user_agent, false, 'credenciais');
    return;
  end if;

  insert into public.admin_login_attempts (email, ip_address, user_agent, success)
  values (v_email, p_ip_address, p_user_agent, true);

  return query
    select au.email, au.display_name, au.role, false as two_factor_enabled
      from public.admin_panel_users au
     where au.email = v_email
       and au.active = true
     limit 1;
end;
$$;

revoke all on function public.admin_panel_login(text, text, text, text, text) from public;
grant execute on function public.admin_panel_login(text, text, text, text, text) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — um admin de teste leva a trava num savepoint desfeito no fim.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_chegou boolean := false;
  v_r record;
  v_n integer;
  v_i integer;
begin
  -- Só a assinatura de 5 argumentos sobrou.
  select count(*) into v_n from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'admin_panel_login';
  if v_n <> 1 then
    raise exception 'esperava 1 assinatura de admin_panel_login, achei %', v_n;
  end if;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
              where ns.nspname = 'public' and p.proname = 'admin_panel_login' and p.pronargs <> 5) then
    raise exception 'sobrou overload antiga de admin_panel_login';
  end if;

  begin
    insert into public.admin_panel_users (email, password_hash, display_name, role, active)
    values ('verifica-p0@teste', extensions.crypt('Senha-Forte-123', extensions.gen_salt('bf')),
            'Verificação P0', 'admin', true);

    -- Senha certa entra, registra sucesso e carimba o last_login_at.
    select * into v_r from public.admin_panel_login('verifica-p0@teste', 'Senha-Forte-123');
    if v_r.email is distinct from 'verifica-p0@teste' then
      raise exception 'login certo não entrou';
    end if;
    if not exists (select 1 from public.admin_login_attempts
                    where email = 'verifica-p0@teste' and success) then
      raise exception 'o sucesso não foi registrado';
    end if;
    if (select last_login_at from public.admin_panel_users where email = 'verifica-p0@teste') is null then
      raise exception 'last_login_at não foi carimbado';
    end if;

    -- 5 erros travam; o 6º (mesmo com a senha CERTA) volta vazio e não
    -- registra tentativa nova.
    for v_i in 1..5 loop
      select * into v_r from public.admin_panel_login('verifica-p0@teste', 'errada-' || v_i);
    end loop;
    select count(*) into v_n from public.admin_login_attempts
     where email = 'verifica-p0@teste' and not success;
    if v_n <> 5 then raise exception 'esperava 5 erros registrados, achei %', v_n; end if;

    select * into v_r from public.admin_panel_login('verifica-p0@teste', 'Senha-Forte-123');
    if v_r.email is not null then raise exception 'a senha certa passou por cima da trava'; end if;
    select count(*) into v_n from public.admin_login_attempts
     where email = 'verifica-p0@teste';
    if v_n <> 6 then raise exception 'tentativa durante a trava não podia contar (achei %)', v_n; end if;

    -- A trava passa: 16 minutos depois a senha certa entra de novo.
    update public.admin_login_attempts set attempted_at = attempted_at - interval '16 minutes'
     where email = 'verifica-p0@teste';
    select * into v_r from public.admin_panel_login('verifica-p0@teste', 'Senha-Forte-123');
    if v_r.email is distinct from 'verifica-p0@teste' then
      raise exception 'destravado, a senha certa falhou';
    end if;

    v_chegou := true;
    raise exception 'DESFAZ_A_VERIFICACAO';
  exception when others then
    if sqlerrm <> 'DESFAZ_A_VERIFICACAO' then raise; end if;
  end;

  if not v_chegou then raise exception 'a verificação da trava não chegou ao fim'; end if;
  if exists (select 1 from public.admin_panel_users where email = 'verifica-p0@teste')
     or exists (select 1 from public.admin_login_attempts where email = 'verifica-p0@teste') then
    raise exception 'a verificação deixou rastro';
  end if;
end $$;
