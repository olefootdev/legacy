-- ============================================================
-- SOCIAL — amizade REAL entre managers (liga o cliente à tabela que já existia)
--
-- Contexto: `public.manager_friendships` está no banco desde 2026-04-27
-- (20260427012821_beta_program_and_social.sql) com RLS completa e correta — e o
-- CLIENTE NUNCA A USOU. Construíram um mock local por cima (`src/social/types.ts`)
-- que plantava um pedido fake do "WOLVES" no estado inicial de todo manager e
-- fingia aceite com `autoAccept` num catálogo de 6 clubes inventados. Aceitar,
-- recusar e convidar nunca saíam do localStorage — o outro lado não existia.
--
-- Esta migration NÃO cria tabela nenhuma. Só adiciona o que faltava pra usar a
-- que já está lá:
--   1. busca de manager (a RLS de `profiles` é self-only: sem security definer
--      ninguém acha ninguém)
--   2. envio de pedido (precisa ler o club_name do alvo, idem)
--   3. resposta ao pedido (aceitar/recusar) com responded_at
--   4. AUTO-AMIZADE: quem entra pelo seu código de indicação já vira amigo,
--      sem pedido — decisão do fundador (2026-07-17)
--
-- GOTCHA DE IDENTIDADE: `manager_friendships` usa uuid de auth.users. O mock
-- local usava `managerId = email` (state.userSettings.managerProfile.email). O
-- cliente foi migrado pro eixo uuid junto com esta migration.
-- ============================================================

-- ─── 1. Busca de manager ───────────────────────────────────────────────────
-- A RLS de profiles é self-only (profiles_select_own / profiles_self_read), então
-- a busca precisa de security definer. Devolve só identidade DE JOGO — nunca
-- e-mail, nunca dado pessoal.
--
-- Sobre e-mail (pedido do fundador): a busca aceita e-mail EXATO, nunca parcial.
-- Isso permite "achar meu amigo pelo e-mail dele" sem virar varredura da base.
-- `check_email_exists` (20260430000000) já expõe a EXISTÊNCIA de um e-mail pra
-- anon, então o incremento aqui é ligar e-mail → clube pra quem já está logado.
-- Se preferir fechar, é só remover o ramo do e-mail — a busca por clube/username
-- cobre o caso normal.
create or replace function public.search_managers(p_q text, p_limit int default 10)
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
declare
  v_uid uuid := auth.uid();
  v_q   text := btrim(coalesce(p_q, ''));
  v_lim int  := least(greatest(coalesce(p_limit, 10), 1), 25);
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  -- Curto demais vira varredura da base.
  if char_length(v_q) < 3 then
    return;
  end if;

  -- E-mail: só match EXATO, e o e-mail nunca volta no resultado.
  if position('@' in v_q) > 0 then
    return query
      select p.id, p.username, p.display_name, p.club_name, p.club_short
        from public.profiles p
        join auth.users u on u.id = p.id
       where lower(u.email) = lower(v_q)
         and p.id <> v_uid
         and coalesce(p.status, 'active') = 'active'
       limit 1;
    return;
  end if;

  return query
    select p.id, p.username, p.display_name, p.club_name, p.club_short
      from public.profiles p
     where p.id <> v_uid
       and coalesce(p.status, 'active') = 'active'
       and (
         p.club_name  ilike '%' || v_q || '%'
         or p.club_short ilike '%' || v_q || '%'
         or p.username   ilike '%' || v_q || '%'
       )
     order by
       -- Match exato primeiro; depois quem começa com o termo.
       case when lower(p.club_short) = lower(v_q) or lower(p.username) = lower(v_q) then 0
            when p.club_name ilike v_q || '%' then 1
            else 2 end,
       p.club_name
     limit v_lim;
end;
$$;

revoke execute on function public.search_managers(text, int) from anon, public;
grant execute on function public.search_managers(text, int) to authenticated;

-- ─── 2. Enviar solicitação ─────────────────────────────────────────────────
-- Security definer porque precisa LER o club_name do alvo (RLS self-only) pra
-- gravar denormalizado na linha — é o que faz a listagem funcionar sem join.
create or replace function public.send_friend_request(p_to uuid, p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_my_club   text;
  v_their_club text;
  v_existing  record;
  v_id        uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_to is null or p_to = v_uid then
    raise exception 'INVALID_TARGET';
  end if;

  select club_name into v_their_club from public.profiles where id = p_to;
  if not found then
    raise exception 'MANAGER_NOT_FOUND';
  end if;
  select club_name into v_my_club from public.profiles where id = v_uid;

  -- Já existe vínculo em qualquer direção?
  select * into v_existing
    from public.manager_friendships
   where (requester_id = v_uid and addressee_id = p_to)
      or (requester_id = p_to and addressee_id = v_uid)
   limit 1;

  if found then
    if v_existing.status = 'accepted' then
      raise exception 'ALREADY_FRIENDS';
    end if;
    if v_existing.status = 'blocked' then
      raise exception 'BLOCKED';
    end if;
    if v_existing.status = 'pending' then
      -- O outro já tinha te chamado: aceita na hora em vez de duplicar.
      if v_existing.addressee_id = v_uid then
        update public.manager_friendships
           set status = 'accepted', responded_at = now(), updated_at = now()
         where id = v_existing.id;
        return v_existing.id;
      end if;
      raise exception 'ALREADY_PENDING';
    end if;
    -- rejected/cancelled: reabre o mesmo vínculo (a unique impede duplicar).
    update public.manager_friendships
       set requester_id = v_uid,
           addressee_id = p_to,
           requester_club_name = v_my_club,
           addressee_club_name = v_their_club,
           status = 'pending',
           message = p_message,
           responded_at = null,
           updated_at = now()
     where id = v_existing.id;
    return v_existing.id;
  end if;

  insert into public.manager_friendships
    (requester_id, addressee_id, requester_club_name, addressee_club_name, status, message)
  values (v_uid, p_to, v_my_club, v_their_club, 'pending', p_message)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.send_friend_request(uuid, text) from anon, public;
grant execute on function public.send_friend_request(uuid, text) to authenticated;

-- ─── 3. Responder solicitação ──────────────────────────────────────────────
-- A RLS já permitiria UPDATE direto, mas o RPC garante que só o DESTINATÁRIO
-- aceita (a policy deixa os dois lados atualizarem) e carimba responded_at.
create or replace function public.respond_friend_request(p_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row record;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_row from public.manager_friendships where id = p_id;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  -- Só quem RECEBEU decide. Sem isto, o requester aceitaria o próprio pedido.
  if v_row.addressee_id <> v_uid then
    raise exception 'NOT_ADDRESSEE';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'NOT_PENDING';
  end if;

  update public.manager_friendships
     set status = case when p_accept then 'accepted' else 'rejected' end,
         responded_at = now(),
         updated_at = now()
   where id = p_id;
end;
$$;

revoke execute on function public.respond_friend_request(uuid, boolean) from anon, public;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- ─── 4. Desfazer amizade / cancelar pedido ─────────────────────────────────
create or replace function public.remove_friendship(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row record;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into v_row from public.manager_friendships where id = p_id;
  if not found then
    return;
  end if;
  if v_row.requester_id <> v_uid and v_row.addressee_id <> v_uid then
    raise exception 'NOT_INVOLVED';
  end if;
  delete from public.manager_friendships where id = p_id;
end;
$$;

revoke execute on function public.remove_friendship(uuid) from anon, public;
grant execute on function public.remove_friendship(uuid) to authenticated;

-- ─── 5. AUTO-AMIZADE pelo código de indicação ──────────────────────────────
-- Decisão do fundador (2026-07-17): quem entra pelo seu código já vira amigo,
-- sem pedido. Recria save_onboarding_profile preservando o hardening de
-- 20260526040000 (valida que o código é de OUTRO usuário real; referred_by_code
-- imutável após a 1ª gravação) e pendura a amizade no fim.
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
  v_referrer_id uuid;
  v_referrer_club text;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  v_code := nullif(regexp_replace(upper(coalesce(p_referred_by_code, '')), '[^A-Z0-9]', '', 'g'), '');
  if v_code is not null and (char_length(v_code) < 6 or char_length(v_code) > 8) then
    v_code := null;
  end if;

  if v_code is not null then
    if not exists (
      select 1 from public.profiles
      where my_referral_code = v_code and id <> v_uid
    ) then
      v_code := null;
    end if;
  end if;

  insert into public.profiles (id, display_name, club_name, club_short, onboarding_data, referred_by_code)
  values (v_uid, p_display_name, p_club_name, p_club_short, p_onboarding_data, v_code)
  on conflict (id) do update set
    display_name = excluded.display_name,
    club_name = excluded.club_name,
    club_short = excluded.club_short,
    onboarding_data = excluded.onboarding_data,
    referred_by_code = coalesce(public.profiles.referred_by_code, excluded.referred_by_code),
    updated_at = now();

  -- Auto-amizade com quem indicou. Best-effort: onboarding NUNCA pode quebrar
  -- por causa disso.
  begin
    -- Relê da tabela: se o profile já existia, o código que vale é o gravado
    -- (imutável), não o que veio no parâmetro.
    select p.referred_by_code into v_code from public.profiles p where p.id = v_uid;

    if v_code is not null then
      select id, club_name into v_referrer_id, v_referrer_club
        from public.profiles
       where my_referral_code = v_code and id <> v_uid
       limit 1;

      if v_referrer_id is not null then
        insert into public.manager_friendships
          (requester_id, addressee_id, requester_club_name, addressee_club_name, status, responded_at)
        values (v_referrer_id, v_uid, v_referrer_club, p_club_name, 'accepted', now())
        on conflict (requester_id, addressee_id) do update
          set status = case
                when public.manager_friendships.status in ('rejected','cancelled')
                  then public.manager_friendships.status  -- respeita recusa anterior
                else 'accepted' end,
              addressee_club_name = excluded.addressee_club_name,
              updated_at = now();
      end if;
    end if;
  exception when others then
    null; -- amizade é secundária; o profile já está salvo
  end;
end;
$$;

revoke execute on function public.save_onboarding_profile(text, text, text, jsonb, text) from anon, public;
grant execute on function public.save_onboarding_profile(text, text, text, jsonb, text) to authenticated;

-- ─── 6. Backfill: indicações que já existem viram amizade ──────────────────
-- Quem já entrou pelo código de alguém antes desta migration também vira amigo.
insert into public.manager_friendships
  (requester_id, addressee_id, requester_club_name, addressee_club_name, status, responded_at)
select r.id, p.id, r.club_name, p.club_name, 'accepted', now()
  from public.profiles p
  join public.profiles r on r.my_referral_code = p.referred_by_code
 where p.referred_by_code is not null
   and r.id <> p.id
on conflict (requester_id, addressee_id) do nothing;
