-- Tabela de auditoria genérica + triggers para tabelas sensíveis.
-- Regista INSERT/UPDATE/DELETE com o utilizador, timestamp e diff de dados.

create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  table_name   text        not null,
  operation    text        not null check (operation in ('INSERT','UPDATE','DELETE')),
  user_id      uuid,                        -- auth.uid() no momento da operação
  row_id       text        not null,        -- pk da linha afetada (convertida para text)
  old_data     jsonb,                       -- valor anterior (UPDATE/DELETE)
  new_data     jsonb,                       -- valor novo    (INSERT/UPDATE)
  occurred_at  timestamptz not null default now()
);

alter table public.audit_log enable row level security;

-- Ninguém lê nem escreve via API pública — apenas service_role (bypass RLS).
-- O admin consulta via Supabase dashboard ou scripts server-side.

create index on public.audit_log (table_name, occurred_at desc);
create index on public.audit_log (user_id, occurred_at desc);

-- ─── Função trigger genérica ────────────────────────────────────────────────

create or replace function public.fn_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_id text;
  v_old    jsonb;
  v_new    jsonb;
begin
  -- Extrai a PK da linha (assume coluna "id")
  if TG_OP = 'DELETE' then
    v_row_id := OLD.id::text;
    v_old    := to_jsonb(OLD);
    v_new    := null;
  elsif TG_OP = 'INSERT' then
    v_row_id := NEW.id::text;
    v_old    := null;
    v_new    := to_jsonb(NEW);
  else -- UPDATE
    v_row_id := NEW.id::text;
    v_old    := to_jsonb(OLD);
    v_new    := to_jsonb(NEW);
  end if;

  insert into public.audit_log (table_name, operation, user_id, row_id, old_data, new_data)
  values (TG_TABLE_NAME, TG_OP, auth.uid(), v_row_id, v_old, v_new);

  return coalesce(NEW, OLD);
end;
$$;

-- ─── Triggers nas tabelas sensíveis ─────────────────────────────────────────

-- market_purchases: toda compra fica registada
create trigger audit_market_purchases
  after insert or update or delete on public.market_purchases
  for each row execute function public.fn_audit_log();

-- wallet_credits: emissão de BRO pelo admin
create trigger audit_wallet_credits
  after insert or update or delete on public.wallet_credits
  for each row execute function public.fn_audit_log();

-- genesis_market_players: alterações de retrato ou listagem
create trigger audit_genesis_market_players
  after update or delete on public.genesis_market_players
  for each row execute function public.fn_audit_log();

-- matches: criação e mudança de estado
create trigger audit_matches
  after insert or update or delete on public.matches
  for each row execute function public.fn_audit_log();
