-- wallet_credits: créditos BRO emitidos pelo admin após depósito confirmado.
-- O app aplica cada linha UMA VEZ (applied_at preenchido = já processado).

create table if not exists public.wallet_credits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  bro_cents    bigint not null check (bro_cents > 0),
  reason       text not null default '',
  created_at   timestamptz not null default now(),
  applied_at   timestamptz          -- preenchido pelo cliente ao aplicar
);

alter table public.wallet_credits enable row level security;

-- Jogador só lê os seus próprios créditos.
create policy "user reads own credits"
  on public.wallet_credits
  for select
  using (auth.uid() = user_id);

-- Jogador pode marcar applied_at nos seus próprios créditos pendentes.
create policy "user marks own credit applied"
  on public.wallet_credits
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Índice para busca eficiente de créditos pendentes por utilizador.
create index on public.wallet_credits (user_id, applied_at) where applied_at is null;
