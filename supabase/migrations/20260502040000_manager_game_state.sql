-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — manager_game_state
--
-- Persistência server-side dos slices críticos do OlefootGameState que
-- ficavam apenas no localStorage e se perdiam ao trocar de browser/dispositivo.
--
-- Estratégia: snapshot JSONB por slice, upsert debounced após eventos chave.
-- Hidratação no boot via ManagerGameStateHydrator (antes da cerimônia).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.manager_game_state (
  user_id            uuid primary key references auth.users(id) on delete cascade,

  -- CRÍTICO
  structures         jsonb,   -- ClubStructuresState
  league_season      jsonb,   -- LeagueSeasonState
  results            jsonb,   -- PastResult[]
  trophy_ids         jsonb,   -- string[]
  competitive_ranking jsonb,  -- CompetitiveRankingState
  olefoot_ranked     jsonb,   -- OlefootRankedState

  -- IMPORTANTE
  player_health      jsonb,   -- Record<string, PlayerHealth>
  player_season_ledger jsonb, -- PlayerSeasonLedgerMap
  player_moral       jsonb,   -- Record<string, PlayerMoral>
  shop_inventory     jsonb,   -- Record<string, number>
  olefoot_league     jsonb,   -- OlefootLeagueState
  manager_relation   jsonb,   -- Record<string, number>
  saved_tactics      jsonb,   -- SavedTacticPlan[]
  staff              jsonb,   -- StaffState

  updated_at         timestamptz not null default now()
);

comment on table public.manager_game_state is
  'Snapshot dos slices críticos do OlefootGameState. Upsert debounced após eventos chave. 1 row por manager.';

create index if not exists idx_manager_game_state_updated
  on public.manager_game_state (updated_at desc);

alter table public.manager_game_state enable row level security;

create policy "manager_game_state_select_own"
  on public.manager_game_state for select
  to authenticated using (user_id = auth.uid());

create policy "manager_game_state_insert_own"
  on public.manager_game_state for insert
  to authenticated with check (user_id = auth.uid());

create policy "manager_game_state_update_own"
  on public.manager_game_state for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on table public.manager_game_state to authenticated;

create or replace function public.touch_manager_game_state_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_touch_manager_game_state on public.manager_game_state;
create trigger trg_touch_manager_game_state
  before update on public.manager_game_state
  for each row execute function public.touch_manager_game_state_updated_at();
