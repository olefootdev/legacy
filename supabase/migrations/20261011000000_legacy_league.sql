-- ═══════════════════════════════════════════════════════════════════════════
-- LEGACY LEAGUE — a liga que só se joga na Partida Viva (modo LEGACY).
--
-- Temporada semanal (segunda a domingo, UTC; `temporada` = '2026-W41').
-- O servidor abre cada partida da liga (sorteia o adversário: o time de outro
-- manager real) e só fecha como `valida` quando a partida tem CUSTÓDIA válida
-- (evolucao_sombra) E o FILME (partidas_filme) — prova de que foi jogada em
-- campo. Tabela = soma das partidas válidas de cada manager na temporada.
--
-- Liga Global e Liga Ole continuam no motor delas: esta tabela é só da LEGACY.
-- Só o servidor lê e escreve (server/src/routes/legacyLeague.ts).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.legacy_league_partidas (
  id            uuid primary key default gen_random_uuid(),
  temporada     text not null,
  dono          uuid not null references auth.users(id) on delete cascade,
  adversario    uuid not null references auth.users(id) on delete cascade,
  seed          text,
  status        text not null default 'aberta' check (status in ('aberta', 'valida', 'invalida', 'expirada')),
  motivo        text,
  gols_pro      smallint,
  gols_contra   smallint,
  pontos        smallint check (pontos is null or pontos in (0, 1, 3)),
  criado_em     timestamptz not null default now(),
  fechado_em    timestamptz,
  check (adversario <> dono)
);
create index if not exists legacy_league_temporada on public.legacy_league_partidas (temporada, status);
create index if not exists legacy_league_dono on public.legacy_league_partidas (dono, criado_em desc);
create unique index if not exists legacy_league_seed on public.legacy_league_partidas (seed) where seed is not null;

alter table public.legacy_league_partidas enable row level security;
revoke all on public.legacy_league_partidas from anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — roda junto e derruba tudo se falhar
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  dono uuid := (select id from auth.users order by created_at limit 1);
  outro uuid := (select id from auth.users order by created_at offset 1 limit 1);
  novo uuid;
begin
  if has_table_privilege('authenticated', 'public.legacy_league_partidas', 'select')
     or has_table_privilege('anon', 'public.legacy_league_partidas', 'select') then
    raise exception 'legacy_league_partidas ficou aberta ao cliente';
  end if;
  if dono is null or outro is null then
    raise notice 'verificação: sem dois usuários pra testar (ambiente vazio)';
    return;
  end if;
  -- o caminho novo: abre, fecha válida com 3 pontos, a tabela soma
  insert into public.legacy_league_partidas (temporada, dono, adversario) values ('zz-verifica', dono, outro) returning id into novo;
  update public.legacy_league_partidas
     set status = 'valida', seed = 'zz-verifica-seed', gols_pro = 2, gols_contra = 1, pontos = 3, fechado_em = now()
   where id = novo;
  if (select sum(pontos) from public.legacy_league_partidas where temporada = 'zz-verifica' and status = 'valida') <> 3 then
    raise exception 'a tabela não somou os pontos da partida válida';
  end if;
  begin
    update public.legacy_league_partidas set pontos = 2 where id = novo;
    raise exception 'aceitou 2 pontos numa partida';
  exception when check_violation then null;
  end;
  begin
    insert into public.legacy_league_partidas (temporada, dono, adversario) values ('zz-verifica', dono, dono);
    raise exception 'aceitou jogar contra si mesmo';
  exception when check_violation then null;
  end;
  delete from public.legacy_league_partidas where temporada = 'zz-verifica';
  raise notice 'verificação: ok';
end $$;
