-- Sistema PvP assíncrono: partidas Rápida e Clássica entre managers.
--
-- Modelo:
--   1. Manager A joga contra um manager B (offline) usando o snapshot do
--      squad de B (em manager_squad). A simulação roda local no cliente A.
--   2. Ao final, cliente A chama `record_pvp_match_result()`. Server insere
--      ledger imutável + calcula EXP reward pra cada lado.
--   3. A recebe seu reward imediatamente (RPC retorna o valor).
--   4. B recebe quando logar: `fetch_my_pending_pvp_results()` retorna
--      ledger rows onde ele participou e não foi claimed ainda.
--      Cliente B aplica via reducer + chama `claim_pvp_match_result(id)`.
--
-- Recompensas (decisão de produto 2026-05-26): vitória 200 EXP,
-- empate 80 EXP, derrota 30 EXP (consolation). Aplicado pros DOIS lados.

create table if not exists public.pvp_match_results (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('quick', 'classic')),
  home_user_id uuid not null references public.profiles(id) on delete cascade,
  away_user_id uuid not null references public.profiles(id) on delete cascade,
  home_score smallint not null check (home_score >= 0 and home_score <= 30),
  away_score smallint not null check (away_score >= 0 and away_score <= 30),
  home_overall smallint,
  away_overall smallint,
  outcome text not null check (outcome in ('home_win', 'away_win', 'draw')),
  home_exp_reward bigint not null,
  away_exp_reward bigint not null,
  -- Quando cada lado coletou (claimed). A é creditado na hora; B coleta no próximo login.
  home_claimed_at timestamptz default now(),
  away_claimed_at timestamptz,
  played_at timestamptz not null default now(),
  constraint different_users check (home_user_id <> away_user_id)
);

create index if not exists pvp_results_home_idx on public.pvp_match_results (home_user_id, played_at desc);
create index if not exists pvp_results_away_idx on public.pvp_match_results (away_user_id, played_at desc);
create index if not exists pvp_results_mode_idx on public.pvp_match_results (mode, played_at desc);
create index if not exists pvp_results_away_pending_idx
  on public.pvp_match_results (away_user_id)
  where away_claimed_at is null;

alter table public.pvp_match_results enable row level security;

-- Usuário lê apenas resultados onde participou
drop policy if exists pvp_results_select_participant on public.pvp_match_results;
create policy pvp_results_select_participant on public.pvp_match_results
  for select using (home_user_id = auth.uid() or away_user_id = auth.uid());

-- Sem INSERT/UPDATE direto via cliente — só via RPCs (security definer)

-- ============================================================
-- RPC: record_pvp_match_result
-- Cliente A grava o resultado. Server calcula outcome + rewards + insere.
-- Retorna o ID + os rewards (cliente A aplica home_reward localmente).
-- ============================================================

create or replace function public.record_pvp_match_result(
  p_mode text,
  p_away_user_id uuid,
  p_home_score int,
  p_away_score int,
  p_home_overall int default null,
  p_away_overall int default null
)
returns table (
  id uuid,
  outcome text,
  home_exp_reward bigint,
  away_exp_reward bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_home_user_id uuid := auth.uid();
  v_outcome text;
  v_home_exp bigint;
  v_away_exp bigint;
  v_id uuid;
  v_hs smallint;
  v_as smallint;
begin
  if v_home_user_id is null then
    raise exception 'must be authenticated';
  end if;
  if p_mode not in ('quick', 'classic') then
    raise exception 'invalid mode';
  end if;
  if p_away_user_id = v_home_user_id then
    raise exception 'cannot play against self';
  end if;
  if not exists (select 1 from public.profiles where id = p_away_user_id) then
    raise exception 'opponent not found';
  end if;

  -- Sanitização defensiva dos scores (0-30)
  v_hs := greatest(0, least(30, coalesce(p_home_score, 0)));
  v_as := greatest(0, least(30, coalesce(p_away_score, 0)));

  v_outcome := case
    when v_hs > v_as then 'home_win'
    when v_hs < v_as then 'away_win'
    else 'draw'
  end;

  v_home_exp := case v_outcome
    when 'home_win' then 200
    when 'draw' then 80
    else 30
  end;
  v_away_exp := case v_outcome
    when 'away_win' then 200
    when 'draw' then 80
    else 30
  end;

  insert into public.pvp_match_results (
    mode, home_user_id, away_user_id,
    home_score, away_score, home_overall, away_overall,
    outcome, home_exp_reward, away_exp_reward,
    home_claimed_at, away_claimed_at
  ) values (
    p_mode, v_home_user_id, p_away_user_id,
    v_hs, v_as, p_home_overall, p_away_overall,
    v_outcome, v_home_exp, v_away_exp,
    now(),   -- A coleta imediatamente
    null     -- B coleta quando logar
  )
  returning pvp_match_results.id into v_id;

  return query select v_id, v_outcome, v_home_exp, v_away_exp;
end;
$$;

revoke execute on function public.record_pvp_match_result(text, uuid, int, int, int, int) from anon, public;
grant execute on function public.record_pvp_match_result(text, uuid, int, int, int, int) to authenticated;

-- ============================================================
-- RPC: fetch_my_pending_pvp_results
-- B busca resultados onde participou como away e ainda não claimou.
-- ============================================================

create or replace function public.fetch_my_pending_pvp_results()
returns table (
  id uuid,
  mode text,
  outcome text,
  home_score smallint,
  away_score smallint,
  away_exp_reward bigint,
  played_at timestamptz,
  opponent_display_name text,
  opponent_club_name text,
  opponent_club_short text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;
  return query
    select
      r.id,
      r.mode,
      r.outcome,
      r.home_score,
      r.away_score,
      r.away_exp_reward,
      r.played_at,
      p.display_name,
      p.club_name,
      p.club_short
    from public.pvp_match_results r
    inner join public.profiles p on p.id = r.home_user_id
    where r.away_user_id = v_uid
      and r.away_claimed_at is null
    order by r.played_at desc
    limit 20;
end;
$$;

revoke execute on function public.fetch_my_pending_pvp_results() from anon, public;
grant execute on function public.fetch_my_pending_pvp_results() to authenticated;

-- ============================================================
-- RPC: claim_pvp_match_result
-- Cliente B marca um result como claimed (após ter aplicado o EXP local).
-- ============================================================

create or replace function public.claim_pvp_match_result(p_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_reward bigint;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  update public.pvp_match_results
     set away_claimed_at = now()
   where id = p_id
     and away_user_id = v_uid
     and away_claimed_at is null
   returning away_exp_reward into v_reward;

  return coalesce(v_reward, 0);
end;
$$;

revoke execute on function public.claim_pvp_match_result(uuid) from anon, public;
grant execute on function public.claim_pvp_match_result(uuid) to authenticated;
