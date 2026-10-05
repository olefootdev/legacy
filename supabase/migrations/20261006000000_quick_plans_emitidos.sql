-- ═══════════════════════════════════════════════════════════════════════════
-- SMART-PROFILE — Fase 2B: CUSTÓDIA DO PLANO da Partida Rápida
--
-- Cada plano que o motor Python gera para um manager logado vira uma linha
-- aqui: quem pediu, a escalação que foi ao motor e um resumo dos lances. O
-- relato do fim da partida só vale se apontar para planos deste manager que
-- ainda não foram usados — `usado_em` impede creditar a mesma partida duas vezes.
--
-- Só o servidor lê e escreve. Lógica: server/src/lib/smartProfile/custodia.ts.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.quick_plans_emitidos (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  seed          text not null,
  modo          text not null check (modo in ('full','second_half')),
  resumo        jsonb not null,
  criado_em     timestamptz not null default now(),
  usado_em      timestamptz
);
create index if not exists quick_plans_emitidos_dono on public.quick_plans_emitidos (owner_id, criado_em desc);

alter table public.quick_plans_emitidos enable row level security;
revoke all on public.quick_plans_emitidos from anon, authenticated;

do $$
begin
  if has_table_privilege('authenticated', 'public.quick_plans_emitidos', 'select') then
    raise exception 'quick_plans_emitidos ficou aberta ao cliente';
  end if;
end $$;
