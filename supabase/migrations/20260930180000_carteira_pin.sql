-- ═══════════════════════════════════════════════════════════════════════════
-- PIN DA CARTEIRA — a parte SERVIDOR da Fase 5
--
-- O PIN protege as três portas combinadas: abrir a aba DEX, trocar a carteira
-- Solana vinculada (o destino do airdrop) e mudar o time padrão no NETWORK.
-- Ele mora AQUI, não no aparelho: PIN no localStorage tranca a tela e mais
-- nada — quem chama a API por fora passa reto. A tela pede; quem exige é o
-- servidor.
--
-- Regras (fixadas pelo fundador em 2026-09-30):
--   · 5 erros travam a conta por 15 minutos — e erro DURANTE a trava não
--     estica a trava, senão chute contínuo vira cadeado eterno;
--   · trocar o PIN exige ter ENTRADO na conta nos últimos 5 minutos. O relógio
--     é o `amr` do JWT (a hora da autenticação de verdade) — o `iat` renova a
--     cada refresh e diria que todo mundo entrou agora. Esquecer o PIN tem o
--     mesmo remédio: entrar de novo com a senha e definir outro;
--   · quem não criou PIN não é bloqueado por ele — as portas só fecham pra
--     quem as trancou.
--
-- 🔒 Só o bcrypt do PIN fica guardado (`extensions.crypt`, schema SEMPRE
-- qualificado — `search_path = public` já engoliu essa função uma vez).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.carteira_pin (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  pin_hash   text not null,
  criado_em  timestamptz not null default now(),
  trocado_em timestamptz
);
alter table public.carteira_pin enable row level security;
-- Sem policy de propósito: nem o dono lê a linha. O que a tela precisa
-- ("tenho PIN? estou travado?") sai de carteira_pin_estado().

-- Só ERRO entra aqui. Acerto limpa as linhas do usuário.
create table if not exists public.carteira_pin_tentativa (
  id      bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  em      timestamptz not null default now()
);
create index if not exists carteira_pin_tentativa_user
  on public.carteira_pin_tentativa (user_id, em desc);
alter table public.carteira_pin_tentativa enable row level security;

-- ─── a trava: segundos até poder tentar de novo (0 = livre) ───────────────
create or replace function public.carteira_pin_trava_interno(p_user uuid)
returns integer language sql stable security definer set search_path = public
as $$
  select case when count(*) >= 5
              then greatest(ceil(extract(epoch from
                     (max(em) + interval '15 minutes' - now())))::int, 1)
              else 0 end
    from carteira_pin_tentativa
   where user_id = p_user and em > now() - interval '15 minutes';
$$;
revoke all on function public.carteira_pin_trava_interno(uuid) from public, anon, authenticated;
grant execute on function public.carteira_pin_trava_interno(uuid) to service_role;

-- ─── conferir (o coração; o servidor chama por dentro) ────────────────────
-- Motivos: muitas_tentativas · sem_pin · pin_obrigatorio (não veio PIN — não
-- conta como erro) · pin_errado. Acerto zera as tentativas.
create or replace function public.carteira_pin_conferir_interno(p_user uuid, p_pin text)
returns table (ok boolean, motivo text, tenta_de_novo_em integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_hash text;
  v_trava integer;
begin
  if p_user is null then
    return query select false, 'sem_usuario'::text, 0; return;
  end if;

  v_trava := public.carteira_pin_trava_interno(p_user);
  if v_trava > 0 then
    return query select false, 'muitas_tentativas'::text, v_trava; return;
  end if;

  select pin_hash into v_hash from carteira_pin where user_id = p_user;
  if v_hash is null then
    return query select false, 'sem_pin'::text, 0; return;
  end if;
  if p_pin is null or p_pin = '' then
    return query select false, 'pin_obrigatorio'::text, 0; return;
  end if;

  if extensions.crypt(p_pin, v_hash) = v_hash then
    delete from carteira_pin_tentativa where user_id = p_user;
    return query select true, null::text, 0; return;
  end if;

  insert into carteira_pin_tentativa (user_id) values (p_user);
  return query select false, 'pin_errado'::text, public.carteira_pin_trava_interno(p_user);
end;
$$;
revoke all on function public.carteira_pin_conferir_interno(uuid, text) from public, anon, authenticated;
grant execute on function public.carteira_pin_conferir_interno(uuid, text) to service_role;

-- ─── verificar (a própria pessoa, pela tela) ──────────────────────────────
create or replace function public.carteira_pin_verificar(p_pin text)
returns table (ok boolean, motivo text, tenta_de_novo_em integer)
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;
  return query select * from public.carteira_pin_conferir_interno(v_uid, p_pin);
end;
$$;
revoke all on function public.carteira_pin_verificar(text) from public, anon;
grant execute on function public.carteira_pin_verificar(text) to authenticated, service_role;

-- ─── estado (a tela decide se pede PIN sem tentar nenhum) ─────────────────
create or replace function public.carteira_pin_estado()
returns table (tem_pin boolean, tenta_de_novo_em integer)
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;
  return query select
    exists (select 1 from carteira_pin p where p.user_id = v_uid),
    public.carteira_pin_trava_interno(v_uid);
end;
$$;
revoke all on function public.carteira_pin_estado() from public, anon;
grant execute on function public.carteira_pin_estado() to authenticated, service_role;

-- ─── login recente: o relógio da troca ────────────────────────────────────
-- `amr` guarda a hora de cada autenticação REAL; refresh de token não mexe.
create or replace function public.carteira_login_recente_interno()
returns boolean language sql stable set search_path = public
as $$
  select coalesce(
    to_timestamp((
      select max((e ->> 'timestamp')::bigint)
        from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e
    )) > now() - interval '5 minutes', false);
$$;
revoke all on function public.carteira_login_recente_interno() from public, anon, authenticated;
grant execute on function public.carteira_login_recente_interno() to service_role;

-- ─── definir / trocar ─────────────────────────────────────────────────────
-- Primeira vez: livre (a conta acabou de decidir se proteger). Troca: só com
-- login dos últimos 5 minutos — e ela também zera as tentativas, porque quem
-- provou a senha da conta não fica preso na trava do PIN antigo.
create or replace function public.carteira_pin_definir(p_pin text)
returns table (ok boolean, motivo text)
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;
  if p_pin is null or p_pin !~ '^\d{6}$' then
    return query select false, 'pin_invalido'::text; return;
  end if;
  if exists (select 1 from carteira_pin where user_id = v_uid)
     and not public.carteira_login_recente_interno() then
    return query select false, 'login_antigo'::text; return;
  end if;

  insert into carteira_pin (user_id, pin_hash)
  values (v_uid, extensions.crypt(p_pin, extensions.gen_salt('bf')))
  on conflict (user_id) do update
    set pin_hash = excluded.pin_hash, trocado_em = now();
  delete from carteira_pin_tentativa where user_id = v_uid;
  return query select true, null::text;
end;
$$;
revoke all on function public.carteira_pin_definir(text) from public, anon;
grant execute on function public.carteira_pin_definir(text) to authenticated, service_role;

-- ─── a porta do NETWORK: time padrão ──────────────────────────────────────
-- Corpo copiado de 20260930100000 (Regra 3: da fonte, não da memória), com o
-- gate na frente: conta COM PIN só escolhe o time pela assinatura com p_pin.
create or replace function public.expansao_definir_perna_padrao(p_lado smallint)
returns smallint language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;
  if exists (select 1 from carteira_pin where user_id = v_uid) then
    raise exception 'PIN_OBRIGATORIO';
  end if;
  if p_lado is not null and p_lado not in (1, 2) then
    raise exception 'lado inválido: %', p_lado;
  end if;
  update expansao_no set perna_padrao = p_lado where user_id = v_uid;
  if not found then raise exception 'fora_da_arvore'; end if;
  return p_lado;
end;
$$;
revoke all on function public.expansao_definir_perna_padrao(smallint) from public, anon;
grant execute on function public.expansao_definir_perna_padrao(smallint) to authenticated, service_role;

create or replace function public.expansao_definir_perna_padrao(p_lado smallint, p_pin text)
returns table (ok boolean, motivo text, tenta_de_novo_em integer, lado smallint)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_r record;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;
  if p_lado is not null and p_lado not in (1, 2) then
    raise exception 'lado inválido: %', p_lado;
  end if;
  select * into v_r from public.carteira_pin_conferir_interno(v_uid, p_pin);
  if not v_r.ok then
    return query select false, coalesce(v_r.motivo, 'pin_errado'), v_r.tenta_de_novo_em, null::smallint;
    return;
  end if;
  update expansao_no set perna_padrao = p_lado where user_id = v_uid;
  if not found then raise exception 'fora_da_arvore'; end if;
  return query select true, null::text, 0, p_lado;
end;
$$;
revoke all on function public.expansao_definir_perna_padrao(smallint, text) from public, anon;
grant execute on function public.expansao_definir_perna_padrao(smallint, text) to authenticated, service_role;

comment on table public.carteira_pin is
  'PIN da carteira (Fase 5). Só o bcrypt fica; 5 erros = 15 min de trava;
   trocar exige login nos últimos 5 minutos (amr do JWT). Portas: aba DEX,
   troca da carteira Solana vinculada, time padrão do NETWORK.';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — o caminho novo RODA aqui, num savepoint que termina em raise.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_chegou boolean := false;
  v_user uuid;
  v_r record;
  v_jwt_sem_login text;
  v_jwt_com_login text;
  v_i integer;
begin
  -- As portas: cliente define, verifica e lê o estado; conferir é do servidor.
  if has_function_privilege('authenticated', 'public.carteira_pin_conferir_interno(uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.carteira_pin_trava_interno(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.carteira_login_recente_interno()', 'execute')
     or has_function_privilege('anon', 'public.carteira_pin_definir(text)', 'execute')
     or has_function_privilege('anon', 'public.carteira_pin_verificar(text)', 'execute')
     or has_function_privilege('anon', 'public.carteira_pin_estado()', 'execute')
     or not has_function_privilege('authenticated', 'public.carteira_pin_definir(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.expansao_definir_perna_padrao(smallint,text)', 'execute') then
    raise exception 'uma função do PIN ficou com a porta errada';
  end if;

  select id into v_user from auth.users
   where not exists (select 1 from public.carteira_pin p where p.user_id = auth.users.id)
   limit 1;
  if v_user is null then
    raise notice 'sem conta neste ambiente: verificação do PIN pulada';
    return;
  end if;

  v_jwt_sem_login := json_build_object('sub', v_user, 'role', 'authenticated')::text;
  v_jwt_com_login := json_build_object('sub', v_user, 'role', 'authenticated',
    'amr', json_build_array(json_build_object('method', 'password',
      'timestamp', floor(extract(epoch from now()))::bigint)))::text;

  begin
    perform set_config('request.jwt.claims', v_jwt_sem_login, true);

    select * into v_r from public.carteira_pin_estado();
    if v_r.tem_pin or v_r.tenta_de_novo_em <> 0 then
      raise exception 'estado inicial errado: conta sem PIN aparece com PIN ou travada';
    end if;

    select * into v_r from public.carteira_pin_definir('12345');
    if v_r.ok or v_r.motivo <> 'pin_invalido' then
      raise exception 'aceitou PIN fora de 6 dígitos: %', v_r.motivo; end if;

    -- Primeira definição: sem exigir login recente.
    select * into v_r from public.carteira_pin_definir('123456');
    if not v_r.ok then raise exception 'primeira definição falhou: %', v_r.motivo; end if;
    if exists (select 1 from public.carteira_pin
                where user_id = v_user and pin_hash like '%123456%') then
      raise exception 'o PIN ficou guardado em claro';
    end if;

    -- 5 erros travam; o 6º não estica a trava; nem o PIN certo passa travado.
    for v_i in 1..5 loop
      select * into v_r from public.carteira_pin_verificar('654321');
    end loop;
    if v_r.motivo <> 'pin_errado' or v_r.tenta_de_novo_em <= 0 then
      raise exception '5º erro devia travar: motivo %, trava %', v_r.motivo, v_r.tenta_de_novo_em;
    end if;
    select * into v_r from public.carteira_pin_verificar('654321');
    if v_r.ok or v_r.motivo <> 'muitas_tentativas' then
      raise exception 'travado devia dizer muitas_tentativas, veio %', v_r.motivo; end if;
    if (select count(*) from public.carteira_pin_tentativa where user_id = v_user) <> 5 then
      raise exception 'tentativa durante a trava não podia contar';
    end if;
    select * into v_r from public.carteira_pin_verificar('123456');
    if v_r.ok then raise exception 'PIN certo passou por cima da trava'; end if;

    -- A trava passa: 16 minutos depois o PIN certo entra e zera as tentativas.
    update public.carteira_pin_tentativa set em = em - interval '16 minutes'
     where user_id = v_user;
    select * into v_r from public.carteira_pin_verificar('123456');
    if not v_r.ok then raise exception 'destravado, o PIN certo falhou: %', v_r.motivo; end if;
    if exists (select 1 from public.carteira_pin_tentativa where user_id = v_user) then
      raise exception 'o acerto não zerou as tentativas';
    end if;

    -- Trocar sem login recente: não. Com login fresco no amr: sim.
    select * into v_r from public.carteira_pin_definir('222222');
    if v_r.ok or v_r.motivo <> 'login_antigo' then
      raise exception 'troca sem login recente devia falhar, veio %', v_r.motivo; end if;
    perform set_config('request.jwt.claims', v_jwt_com_login, true);
    select * into v_r from public.carteira_pin_definir('222222');
    if not v_r.ok then raise exception 'troca com login fresco falhou: %', v_r.motivo; end if;
    select * into v_r from public.carteira_pin_verificar('123456');
    if v_r.ok then raise exception 'o PIN antigo continuou valendo'; end if;
    select * into v_r from public.carteira_pin_verificar('222222');
    if not v_r.ok then raise exception 'o PIN novo não valeu: %', v_r.motivo; end if;

    -- A porta do NETWORK: com PIN criado, a assinatura antiga fecha…
    begin
      perform public.expansao_definir_perna_padrao(1::smallint);
      raise exception 'a assinatura sem PIN passou com PIN criado';
    exception when others then
      if sqlerrm <> 'PIN_OBRIGATORIO' then raise; end if;
    end;
    -- …a nova recusa PIN errado sem tocar na árvore…
    select * into v_r from public.expansao_definir_perna_padrao(1::smallint, '999999');
    if v_r.ok or v_r.motivo <> 'pin_errado' then
      raise exception 'perna com PIN errado devia falhar, veio %', v_r.motivo; end if;
    -- …e com o PIN certo chega na árvore (dentro dela ou não, passou da porta).
    begin
      select * into v_r from public.expansao_definir_perna_padrao(1::smallint, '222222');
      if not v_r.ok then raise exception 'perna com PIN certo falhou: %', v_r.motivo; end if;
    exception when others then
      if sqlerrm <> 'fora_da_arvore' then raise; end if;
    end;

    v_chegou := true;
    raise exception 'DESFAZ_A_VERIFICACAO';
  exception when others then
    if sqlerrm <> 'DESFAZ_A_VERIFICACAO' then raise; end if;
  end;

  perform set_config('request.jwt.claims', '', true);
  if not v_chegou then raise exception 'a verificação não chegou ao fim'; end if;
  if exists (select 1 from public.carteira_pin where user_id = v_user)
     or exists (select 1 from public.carteira_pin_tentativa where user_id = v_user) then
    raise exception 'a verificação deixou rastro';
  end if;
end $$;
