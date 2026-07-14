-- ============================================================
-- PLAYERVIP — solicitações do atleta (saque / suporte / nova coleção)
--
-- Página game.olefoot.com/playervip: cockpit da lenda. As LEITURAS
-- (vendas, comissões, cards, saldo) reusam RPCs já existentes
-- (get_my_pro_summary, get_my_pro_payouts, get_my_affiliate_commissions,
-- get_my_linked_cards, get_my_olexp_balance). Esta migration cobre só
-- as 3 AÇÕES novas, todas com aprovação/atendimento MANUAL do fundador.
--
-- Saque: cria um PEDIDO (status 'pending'), gateado por KYC aprovado.
-- O fundador aprova e paga o PIX manualmente (decisão de produto).
-- ============================================================

-- ─── 1. Saque (pedido) ──────────────────────────────────────────────────────
create table if not exists public.playervip_withdrawals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  amount_cents  bigint not null check (amount_cents > 0),
  currency      text not null default 'BRO',
  pix_key       text not null,
  pix_key_type  text not null default 'cpf' check (pix_key_type in ('cpf','cnpj','email','phone','random')),
  status        text not null default 'pending' check (status in ('pending','approved','paid','rejected')),
  note          text,
  admin_note    text,
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references auth.users(id) on delete set null
);
create index if not exists playervip_withdrawals_user_idx on public.playervip_withdrawals (user_id, created_at desc);
create index if not exists playervip_withdrawals_status_idx on public.playervip_withdrawals (status) where status = 'pending';

-- ─── 2. Suporte (mensagem para a OLEFOOT) ───────────────────────────────────
create table if not exists public.playervip_support_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  subject     text not null default 'Suporte',
  body        text not null,
  status      text not null default 'open' check (status in ('open','answered','closed')),
  answer      text,
  created_at  timestamptz not null default now(),
  answered_at timestamptz
);
create index if not exists playervip_support_user_idx on public.playervip_support_messages (user_id, created_at desc);

-- ─── 3. Nova coleção (solicitação de novos cards) ───────────────────────────
create table if not exists public.playervip_collection_requests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  athlete_name     text not null,
  notes            text,
  referred_name    text,
  referred_contact text,
  status           text not null default 'pending' check (status in ('pending','in_review','approved','rejected')),
  created_at       timestamptz not null default now(),
  reviewed_at      timestamptz
);
create index if not exists playervip_collection_user_idx on public.playervip_collection_requests (user_id, created_at desc);

-- ─── RLS: dono lê o próprio; admin lê tudo; escrita do dono só via RPC ──────
alter table public.playervip_withdrawals          enable row level security;
alter table public.playervip_support_messages     enable row level security;
alter table public.playervip_collection_requests  enable row level security;

drop policy if exists "pv_withdrawals_read"  on public.playervip_withdrawals;
create policy "pv_withdrawals_read" on public.playervip_withdrawals
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "pv_support_read"     on public.playervip_support_messages;
create policy "pv_support_read" on public.playervip_support_messages
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "pv_collection_read"  on public.playervip_collection_requests;
create policy "pv_collection_read" on public.playervip_collection_requests
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ─── RPC: pedir saque (gate de KYC aprovado) ────────────────────────────────
create or replace function public.request_withdrawal(
  p_amount_cents bigint,
  p_pix_key text,
  p_pix_key_type text default 'cpf',
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'valor inválido';
  end if;
  if p_pix_key is null or length(btrim(p_pix_key)) = 0 then
    raise exception 'chave PIX obrigatória';
  end if;

  select verification_status into v_status from public.profiles where id = v_uid;
  if coalesce(v_status, 'not_submitted') <> 'approved' then
    raise exception 'conta não verificada';
  end if;

  insert into public.playervip_withdrawals (user_id, amount_cents, pix_key, pix_key_type, note)
  values (v_uid, p_amount_cents, btrim(p_pix_key), coalesce(p_pix_key_type,'cpf'), p_note)
  returning id into v_id;

  return v_id;
end;
$$;

-- ─── RPC: enviar mensagem de suporte ────────────────────────────────────────
create or replace function public.send_support_message(
  p_subject text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;
  if p_body is null or length(btrim(p_body)) = 0 then
    raise exception 'mensagem vazia';
  end if;

  insert into public.playervip_support_messages (user_id, subject, body)
  values (v_uid, coalesce(nullif(btrim(p_subject),''),'Suporte'), btrim(p_body))
  returning id into v_id;

  return v_id;
end;
$$;

-- ─── RPC: solicitar nova coleção ────────────────────────────────────────────
create or replace function public.request_new_collection(
  p_athlete_name text,
  p_notes text default null,
  p_referred_name text default null,
  p_referred_contact text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;
  if p_athlete_name is null or length(btrim(p_athlete_name)) = 0 then
    raise exception 'nome do atleta obrigatório';
  end if;

  insert into public.playervip_collection_requests (user_id, athlete_name, notes, referred_name, referred_contact)
  values (v_uid, btrim(p_athlete_name), p_notes, p_referred_name, p_referred_contact)
  returning id into v_id;

  return v_id;
end;
$$;

-- ─── RPC: meus pedidos de saque (histórico no painel) ───────────────────────
create or replace function public.get_my_withdrawals()
returns setof public.playervip_withdrawals
language sql
security definer
set search_path = public
as $$
  select * from public.playervip_withdrawals
   where user_id = auth.uid()
   order by created_at desc
   limit 50;
$$;

-- ─── Admin: listar pedidos (guard is_admin) ─────────────────────────────────
create or replace function public.admin_list_withdrawals(p_status text default 'pending')
returns setof public.playervip_withdrawals
language sql
security definer
set search_path = public
as $$
  select * from public.playervip_withdrawals w
   where public.is_admin()
     and (p_status is null or w.status = p_status)
   order by w.created_at asc;
$$;

grant execute on function public.request_withdrawal(bigint, text, text, text) to authenticated;
grant execute on function public.send_support_message(text, text) to authenticated;
grant execute on function public.request_new_collection(text, text, text, text) to authenticated;
grant execute on function public.get_my_withdrawals() to authenticated;
grant execute on function public.admin_list_withdrawals(text) to authenticated;
