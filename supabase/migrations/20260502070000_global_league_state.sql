-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — global_league_state
--
-- Estado singleton da liga global (OlefootLeague + rodadas).
-- Admin escreve via painel, servidor Hono lê para executar rodadas.
-- Managers leem no boot via PlatformDataHydrator.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.global_league_state (
  id         text primary key default 'singleton',
  state      jsonb not null,
  updated_at timestamptz not null default now(),
  constraint global_league_state_singleton check (id = 'singleton')
);

alter table public.global_league_state enable row level security;

-- Todos os managers autenticados podem ler
create policy "global_league_state_select"
  on public.global_league_state for select
  to authenticated using (true);

-- Só service_role escreve (admin usa service_role via servidor)
grant select on table public.global_league_state to authenticated;

comment on table public.global_league_state is
  'Estado singleton da liga global. 1 row (id=singleton). Escrito pelo servidor Hono com service_role.';

create or replace function public.touch_global_league_state_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_touch_global_league_state on public.global_league_state;
create trigger trg_touch_global_league_state
  before update on public.global_league_state
  for each row execute function public.touch_global_league_state_updated_at();
