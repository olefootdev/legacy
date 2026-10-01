-- ═══════════════════════════════════════════════════════════════════════════
-- RPG-PRICE-LIVE · FUNDAÇÃO — o preço sobe pro servidor (decisão do fundador,
-- 2026-10-01: "vamos subir o preço para o servidor para ser LIVE")
--
-- Até aqui o preço dinâmico era recalculado a cada partida e DESCARTADO: a
-- série temporal vivia só no localStorage (playerEvolutionTimeline) e o
-- rating nem isso. Sem história no servidor não existe ticker, não existe
-- índice, não existe auditoria de "por que valorizou".
--
-- Este arquivo cria:
--   · `player_value_snapshots` — cada partida/treino/checkpoint grava OVR,
--     valor e rating do jogador. O CLIENTE empurra (o motor roda nele; é a
--     arquitetura do jogo) — mas só na própria conta, e o que vale dinheiro
--     (yield, migration seguinte) é pago COM TETO em cima destes registros.
--   · `market_ticker()` — as últimas variações de preço, com Δ% calculado
--     contra o snapshot anterior DO MESMO jogador.
--   · `ole100()` — os 100 jogadores mais valiosos agora (último snapshot de
--     cada um, janela de 30 dias).
--   · `ole100_history` + cron de hora em hora — o ÍNDICE: a soma do top-100,
--     virando gráfico.
--   · `presale_config.liquidez_adicionada` — decisão 2 do fundador: a
--     pré-venda SÓ libera token quando a liquidez for adicionada na moeda.
--     O flag nasce FALSE e qualquer ponte futura de liberação é obrigada a
--     checá-lo.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.player_value_snapshots (
  id               bigserial primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  game_player_id   text not null,
  name             text not null,
  pos              text not null default '',
  ovr              integer not null check (ovr between 1 and 99),
  market_bro_cents bigint not null check (market_bro_cents >= 0),
  -- Nota da partida (0–10). Null em treino/checkpoint.
  rating           numeric(4,2) check (rating is null or (rating >= 0 and rating <= 10)),
  source           text not null check (source in ('match', 'training', 'checkpoint', 'sale')),
  at               timestamptz not null default now()
);
create index if not exists pvs_por_jogador on public.player_value_snapshots (game_player_id, at desc);
create index if not exists pvs_recentes on public.player_value_snapshots (at desc);
create index if not exists pvs_por_dono on public.player_value_snapshots (user_id, at desc);

alter table public.player_value_snapshots enable row level security;
-- Cada um grava os PRÓPRIOS jogadores; o mercado inteiro pode LER (é a bolsa).
drop policy if exists pvs_insere_proprio on public.player_value_snapshots;
create policy pvs_insere_proprio on public.player_value_snapshots
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists pvs_le_todos on public.player_value_snapshots;
create policy pvs_le_todos on public.player_value_snapshots
  for select to authenticated using (true);
grant select, insert on public.player_value_snapshots to authenticated;
grant usage on sequence public.player_value_snapshots_id_seq to authenticated;
grant all on public.player_value_snapshots to service_role;
grant usage on sequence public.player_value_snapshots_id_seq to service_role;
revoke all on public.player_value_snapshots from anon;
revoke update, delete on public.player_value_snapshots from authenticated;

-- ─── o ticker: últimas variações, com Δ contra o snapshot anterior ──────────
create or replace function public.market_ticker(p_limite integer default 40)
returns table (game_player_id text, name text, pos text, ovr integer,
               market_bro_cents bigint, delta_cents bigint, delta_pct numeric,
               source text, at timestamptz, dono text)
language sql stable security definer set search_path = public
as $$
  select s.game_player_id, s.name, s.pos, s.ovr, s.market_bro_cents,
         (s.market_bro_cents - ant.market_bro_cents) as delta_cents,
         round((s.market_bro_cents - ant.market_bro_cents)::numeric * 100
               / nullif(ant.market_bro_cents, 0), 2) as delta_pct,
         s.source, s.at,
         coalesce(pr.club_name, pr.username) as dono
    from player_value_snapshots s
    cross join lateral (
      select a.market_bro_cents
        from player_value_snapshots a
       where a.game_player_id = s.game_player_id and a.at < s.at
       order by a.at desc
       limit 1
    ) ant
    left join profiles pr on pr.id = s.user_id
   where s.at > now() - interval '48 hours'
     and s.market_bro_cents <> ant.market_bro_cents
   order by s.at desc
   limit least(greatest(coalesce(p_limite, 40), 1), 200);
$$;
revoke all on function public.market_ticker(integer) from public, anon;
grant execute on function public.market_ticker(integer) to authenticated, service_role;

-- ─── OLE-100: os mais valiosos AGORA (último snapshot por jogador, 30 dias) ─
create or replace function public.ole100(p_limite integer default 100)
returns table (game_player_id text, name text, pos text, ovr integer,
               market_bro_cents bigint, at timestamptz, dono text,
               delta24h_cents bigint)
language sql stable security definer set search_path = public
as $$
  with ultimos as (
    select distinct on (s.game_player_id)
           s.game_player_id, s.name, s.pos, s.ovr, s.market_bro_cents, s.at, s.user_id
      from player_value_snapshots s
     where s.at > now() - interval '30 days'
     order by s.game_player_id, s.at desc
  )
  select u.game_player_id, u.name, u.pos, u.ovr, u.market_bro_cents, u.at,
         coalesce(pr.club_name, pr.username) as dono,
         (u.market_bro_cents - coalesce(h24.market_bro_cents, u.market_bro_cents)) as delta24h_cents
    from ultimos u
    left join profiles pr on pr.id = u.user_id
    left join lateral (
      select a.market_bro_cents
        from player_value_snapshots a
       where a.game_player_id = u.game_player_id and a.at < now() - interval '24 hours'
       order by a.at desc
       limit 1
    ) h24 on true
   order by u.market_bro_cents desc, u.at desc
   limit least(greatest(coalesce(p_limite, 100), 1), 100);
$$;
revoke all on function public.ole100(integer) from public, anon;
grant execute on function public.ole100(integer) to authenticated, service_role;

-- ─── o ÍNDICE: a soma do top-100, materializada de hora em hora ─────────────
create table if not exists public.ole100_history (
  at              timestamptz primary key default now(),
  indice_bro_cents bigint not null,
  jogadores       integer not null
);
alter table public.ole100_history enable row level security;
drop policy if exists ole100_history_le on public.ole100_history;
create policy ole100_history_le on public.ole100_history
  for select to authenticated using (true);
grant select on public.ole100_history to authenticated, service_role;
grant insert, delete on public.ole100_history to service_role;
revoke all on public.ole100_history from anon;

create or replace function public.ole100_snapshot()
returns void language sql security definer set search_path = public
as $$
  insert into ole100_history (indice_bro_cents, jogadores)
  select coalesce(sum(o.market_bro_cents), 0), count(*)::int
    from public.ole100(100) o;
  -- O gráfico vive de 90 dias; snapshot de preço individual idem.
  delete from ole100_history where at < now() - interval '90 days';
  delete from player_value_snapshots where at < now() - interval '90 days';
$$;
revoke all on function public.ole100_snapshot() from public, anon, authenticated;
grant execute on function public.ole100_snapshot() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'ole100-hourly') then
      perform cron.unschedule('ole100-hourly');
    end if;
    perform cron.schedule('ole100-hourly', '10 * * * *', 'select public.ole100_snapshot()');
  end if;
end $$;

-- ─── decisão 2: pré-venda só libera com liquidez na moeda ───────────────────
alter table public.presale_config
  add column if not exists liquidez_adicionada boolean not null default false;
comment on column public.presale_config.liquidez_adicionada is
  'Decisão do fundador (2026-10-01): a pré-venda SÓ libera token (qualquer
   ponte de unlock/saque futura) quando a liquidez for adicionada na moeda.
   Nasce false; quem construir a ponte é OBRIGADO a checar este flag.';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — savepoint que termina em raise.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_chegou boolean := false;
  v_user uuid;
  v_r record;
begin
  if not has_table_privilege('authenticated', 'public.player_value_snapshots', 'insert')
     or not has_table_privilege('authenticated', 'public.player_value_snapshots', 'select')
     or has_table_privilege('authenticated', 'public.player_value_snapshots', 'update')
     or has_table_privilege('authenticated', 'public.player_value_snapshots', 'delete')
     or not has_function_privilege('authenticated', 'public.market_ticker(integer)', 'execute')
     or not has_function_privilege('authenticated', 'public.ole100(integer)', 'execute')
     or has_function_privilege('authenticated', 'public.ole100_snapshot()', 'execute') then
    raise exception 'uma porta do price-live ficou errada';
  end if;
  if (select liquidez_adicionada from presale_config where id = true) is distinct from false then
    -- Em banco recém-criado a linha pode nem existir; só não pode nascer true.
    if exists (select 1 from presale_config where id = true and liquidez_adicionada = true) then
      raise exception 'liquidez_adicionada não pode nascer true';
    end if;
  end if;

  select id into v_user from auth.users limit 1;
  if v_user is null then
    raise notice 'sem conta neste ambiente: verificação do price-live pulada';
    return;
  end if;

  begin
    -- Zagueiro valoriza de 100 BRO pra 112 após uma partida nota 8.
    insert into public.player_value_snapshots (user_id, game_player_id, name, pos, ovr, market_bro_cents, rating, source, at)
    values (v_user, 'zag-live', 'Zagueiro Live', 'ZAG', 66, 10000, null, 'checkpoint', now() - interval '2 hours'),
           (v_user, 'zag-live', 'Zagueiro Live', 'ZAG', 67, 11200, 8.1, 'match', now() - interval '1 hour');

    select * into v_r from public.market_ticker(10) t where t.game_player_id = 'zag-live';
    if v_r.delta_cents <> 1200 or v_r.delta_pct <> 12.00 then
      raise exception 'ticker devia dar +1200 (+12%%), veio % (%%%)', v_r.delta_cents, v_r.delta_pct;
    end if;

    select * into v_r from public.ole100(100) o where o.game_player_id = 'zag-live';
    if v_r.market_bro_cents <> 11200 or v_r.ovr <> 67 then
      raise exception 'ole100 devia trazer o ÚLTIMO snapshot (11200/67), veio %/%', v_r.market_bro_cents, v_r.ovr;
    end if;

    perform public.ole100_snapshot();
    if not exists (select 1 from public.ole100_history where indice_bro_cents >= 11200) then
      raise exception 'o índice não somou o top-100';
    end if;

    v_chegou := true;
    raise exception 'DESFAZ_A_VERIFICACAO';
  exception when others then
    if sqlerrm <> 'DESFAZ_A_VERIFICACAO' then raise; end if;
  end;

  if not v_chegou then raise exception 'a verificação não chegou ao fim'; end if;
  if exists (select 1 from public.player_value_snapshots where game_player_id = 'zag-live') then
    raise exception 'a verificação deixou rastro';
  end if;
end $$;
