-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — wallet_credits: adiciona exp_amount
--
-- Permite creditar EXP (moeda in-game) via Supabase, com a mesma semântica
-- de applied_at que já existe para bro_cents.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.wallet_credits
  add column if not exists exp_amount bigint not null default 0;

comment on column public.wallet_credits.exp_amount is
  'EXP a creditar ao manager. Aplicado pelo cliente em applyPendingCredits() junto com bro_cents.';
