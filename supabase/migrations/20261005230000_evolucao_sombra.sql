-- ═══════════════════════════════════════════════════════════════════════════
-- SMART-PROFILE — Fase 2A: evolução em MODO SOMBRA
--
-- Depois de cada Partida Rápida o celular manda ao servidor o que calculou
-- (atributos antes e depois de cada titular). O servidor refaz a conta com o
-- próprio motor (server/src/lib/smartProfile/evolucao.ts) e grava aqui a
-- comparação. Nada no jogo muda: é a prova de que as duas contas batem.
--
-- Portão da Fase 2A: 20 partidas reais seguidas com `divergencias = 0`.
-- Só o servidor lê e escreve (diagnóstico, não é dado do jogador).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.evolucao_sombra (
  id               bigint generated always as identity primary key,
  owner_id         uuid not null references auth.users(id) on delete cascade,
  seed             text not null,
  resultado        text not null check (resultado in ('win','draw','loss')),
  jogadores        smallint not null check (jogadores >= 0),
  -- Titulares cuja conta do servidor deu diferente da do celular.
  divergencias     smallint not null check (divergencias >= 0),
  -- Titulares cujo "antes" do celular não bate com a ficha guardada no servidor
  -- (ficha desatualizada ou save adulterado) — informativo nesta fase.
  antes_diferente  smallint not null default 0 check (antes_diferente >= 0),
  detalhes         jsonb not null default '[]'::jsonb,
  -- Fase 2B: o relato bate com o plano que o servidor emitiu? (ver quick_plans_emitidos)
  planos           uuid[] not null default '{}',
  custodia         text not null default 'sem_custodia' check (custodia in ('valida','suspeita','sem_custodia')),
  custodia_motivos jsonb not null default '[]'::jsonb,
  criado_em        timestamptz not null default now(),
  unique (owner_id, seed)
);
create index if not exists evolucao_sombra_recente on public.evolucao_sombra (criado_em desc);

alter table public.evolucao_sombra enable row level security;
revoke all on public.evolucao_sombra from anon, authenticated;

do $$
begin
  if has_table_privilege('authenticated', 'public.evolucao_sombra', 'select') then
    raise exception 'evolucao_sombra ficou aberta ao cliente';
  end if;
end $$;
