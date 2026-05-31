-- Migração v1 → v11 dos 168 usuários do Olefoot antigo.
-- Cria tabela de créditos OLEFOOT off-chain (snapshot BSC) + função admin
-- de import que insere auth.users com bcrypt preservado e registra o crédito.
--
-- Bcrypt do v1 ($2b$10$...) é compatível com Supabase Auth out-of-the-box,
-- então o usuário antigo loga com email + senha de sempre.
-- Profile NÃO é criado de propósito: RequireRegistration força onboarding completo.

create table if not exists public.legacy_olefoot_credits (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  legacy_id        int not null,
  email            text not null,
  wallet_address   text not null,
  balance_wei      numeric(78, 0) not null,
  balance_human    text not null,
  source           text not null default 'olefoot-v1-bsc-snapshot',
  snapshot_at      timestamptz not null,
  credited_at      timestamptz,
  credited_amount  numeric(78, 0),
  created_at       timestamptz not null default now()
);

alter table public.legacy_olefoot_credits enable row level security;

create unique index if not exists ulx_legacy_credits_legacy_id
  on public.legacy_olefoot_credits(legacy_id);

create index if not exists idx_legacy_credits_email
  on public.legacy_olefoot_credits(lower(email));

-- Usuário pode ler o próprio crédito (pra UI mostrar o toast / saldo pendente).
drop policy if exists legacy_credits_self_read on public.legacy_olefoot_credits;
create policy legacy_credits_self_read on public.legacy_olefoot_credits
  for select to authenticated
  using (user_id = auth.uid());

-- Função admin: cria/atualiza auth.users e legacy_olefoot_credits em uma transação.
-- Idempotente por email: roda 2x sem duplicar.
-- Política Passo 0:
--   - se email já existe em auth.users → reaproveita o UUID, registra o crédito,
--     NÃO mexe em senha/profile/club do usuário ativo do v11.
--   - se não existe → cria com bcrypt preservado e email_confirmed_at=now().
create or replace function public.admin_import_legacy_v1_user(
  p_email          text,
  p_bcrypt_hash    text,
  p_legacy_id      int,
  p_name           text,
  p_wallet         text,
  p_balance_wei    numeric,
  p_balance_human  text,
  p_snapshot_at    timestamptz
)
returns table (out_user_id uuid, action text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(p_email));
  v_uid uuid;
  v_action text;
begin
  if v_email is null or v_email = '' then
    raise exception 'email vazio';
  end if;
  if p_bcrypt_hash !~ '^\$2[aby]\$\d{2}\$.{53}$' then
    raise exception 'bcrypt hash inválido para %', v_email;
  end if;

  -- Passo 0: já existe?
  select id into v_uid from auth.users where lower(email) = v_email limit 1;

  if v_uid is not null then
    v_action := 'reused_existing';
  else
    v_uid := gen_random_uuid();
    insert into auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      aud, role, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      v_uid,
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_email,
      p_bcrypt_hash,
      now(),
      'authenticated',
      'authenticated',
      jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
      jsonb_build_object('legacy_id', p_legacy_id, 'legacy_name', p_name, 'source','olefoot-v1'),
      now(),
      now(),
      '', '', '', ''
    );
    -- Linha em auth.identities pro provider 'email' (necessário pro login funcionar).
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      'email',
      v_email,
      null, now(), now()
    );
    v_action := 'created_new';
  end if;

  -- Crédito OLEFOOT (idempotente por user_id).
  insert into public.legacy_olefoot_credits (
    user_id, legacy_id, email, wallet_address, balance_wei, balance_human, snapshot_at
  ) values (
    v_uid, p_legacy_id, v_email, p_wallet, p_balance_wei, p_balance_human, p_snapshot_at
  )
  on conflict (user_id) do update set
    balance_wei = excluded.balance_wei,
    balance_human = excluded.balance_human,
    snapshot_at = excluded.snapshot_at,
    legacy_id = excluded.legacy_id;

  return query select v_uid, v_action;
end;
$$;

revoke all on function public.admin_import_legacy_v1_user(
  text, text, int, text, text, numeric, text, timestamptz
) from public;
-- Apenas service_role (script de migração) pode chamar.
grant execute on function public.admin_import_legacy_v1_user(
  text, text, int, text, text, numeric, text, timestamptz
) to service_role;

-- Função consumida pela UI no primeiro login: credita off-chain (idempotente)
-- e retorna o saldo creditado pra o toast de boas-vindas.
-- Hoje só marca credited_at e retorna o balance_human pra mostrar.
-- A integração com o wallet OLEXP fica num segundo passo (após confirmar UX).
create or replace function public.claim_legacy_olefoot_credit()
returns table (already_claimed boolean, out_balance_human text, out_credited_amount_wei numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.legacy_olefoot_credits%rowtype;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;
  select * into v_row from public.legacy_olefoot_credits where user_id = v_uid;
  if not found then
    return query select false, null::text, null::numeric;
    return;
  end if;
  if v_row.credited_at is not null then
    return query select true, v_row.balance_human, v_row.credited_amount;
    return;
  end if;
  update public.legacy_olefoot_credits
     set credited_at = now(),
         credited_amount = balance_wei
   where user_id = v_uid;
  return query select false, v_row.balance_human, v_row.balance_wei;
end;
$$;

revoke all on function public.claim_legacy_olefoot_credit() from public;
grant execute on function public.claim_legacy_olefoot_credit() to authenticated;
