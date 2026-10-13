-- ═══════════════════════════════════════════════════════════════════════════
-- PARTIDA VIVA — Motor de Posses, Fase 4: O FILME COMO ARENA
-- (docs/raio-x-partida-viva.html · docs/PARTIDA-VIVA-PLANO.md, "Fase 4 do Motor de Posses")
--
-- "Assumir o lance": um manager pega o filme de outro (ou o da própria lenda),
-- escolhe um minuto e joga dali com as próprias ordens e os MESMOS dados. O
-- servidor compara: "você fez 2×1 onde ele fez 1×1". Vira desafio assíncrono e
-- ranking semanal, sem precisar do adversário online.
--
--   partidas_filme.arena_aberta — o dono abriu o filme como DESAFIO: qualquer
--                                 manager logado pode assumir um lance dele.
--   arena_tentativas            — uma tentativa por (filme, desafiante): o
--                                 minuto, as ordens, as escolhas e os 3 placares
--                                 (ele, você, banco calado). `saldo` entra no
--                                 ranking da semana (`semana` = '2026-W42').
--   escolhas_da_lenda / lendas  — LENDA COMO AGENTE: quando quem assume é o
--                                 ATLETA de uma lenda, as escolhas dele nos
--                                 momentos dela viram a preferência que o motor
--                                 usa quando o técnico não responde.
--
-- Só o servidor lê e escreve (server/src/routes/arena.ts). As rotas funcionam
-- SEM esta migration (assumir e ver o resultado); só o desafio aberto, o
-- ranking e a lenda como agente esperam por ela.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.partidas_filme add column if not exists arena_aberta boolean not null default false;
create index if not exists partidas_filme_arena on public.partidas_filme (criado_em desc) where arena_aberta;

create table if not exists public.arena_tentativas (
  id                  uuid primary key default gen_random_uuid(),
  filme               uuid not null references public.partidas_filme(id) on delete cascade,
  desafiante          uuid not null references auth.users(id) on delete cascade,
  minuto              smallint not null check (minuto between 2 and 85),
  ordens              jsonb not null default '[]'::jsonb,
  escolhas            jsonb not null default '{}'::jsonb,
  no_minuto           smallint[] not null check (array_length(no_minuto, 1) = 2),
  placar_ele          smallint[] not null check (array_length(placar_ele, 1) = 2),
  placar_voce         smallint[] not null check (array_length(placar_voce, 1) = 2),
  placar_parado       smallint[] not null check (array_length(placar_parado, 1) = 2),
  saldo               smallint not null,
  contra_parado       smallint not null,
  semana              text not null,
  lendas              text[] not null default '{}',
  escolhas_da_lenda   jsonb not null default '{}'::jsonb,
  criado_em           timestamptz not null default now(),
  unique (filme, desafiante)
);
create index if not exists arena_tentativas_semana on public.arena_tentativas (semana, saldo desc);
create index if not exists arena_tentativas_desafiante on public.arena_tentativas (desafiante, criado_em desc);
create index if not exists arena_tentativas_lendas on public.arena_tentativas using gin (lendas);

alter table public.arena_tentativas enable row level security;
revoke all on public.arena_tentativas from anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — roda junto e derruba tudo se falhar
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  dono uuid := (select id from auth.users order by created_at limit 1);
  outro uuid := (select id from auth.users order by created_at offset 1 limit 1);
  filme uuid;
  tent uuid;
begin
  if has_table_privilege('authenticated', 'public.arena_tentativas', 'select')
     or has_table_privilege('anon', 'public.arena_tentativas', 'select') then
    raise exception 'arena_tentativas ficou aberta ao cliente';
  end if;
  if dono is null or outro is null then
    raise notice 'verificação: sem dois usuários pra testar (ambiente vazio)';
    return;
  end if;
  -- o caminho novo: um filme aberto como desafio, uma tentativa, a busca do ranking e a da lenda
  insert into public.partidas_filme (dono, seed, resumo, filme, arena_aberta)
    values (dono, 'zz-verifica-arena', '{}'::jsonb, '{"v":1}'::jsonb, true)
    returning id into filme;
  insert into public.arena_tentativas (filme, desafiante, minuto, no_minuto, placar_ele, placar_voce, placar_parado, saldo, contra_parado, semana, lendas, escolhas_da_lenda)
    values (filme, outro, 60, '{1,1}', '{1,2}', '{2,1}', '{1,1}', 2, 1, 'zz-W00', array['legacy-zz'], '{"legacy-zz":{"driblar":2}}'::jsonb)
    returning id into tent;
  if not exists (select 1 from public.partidas_filme where arena_aberta and id = filme) then
    raise exception 'o filme aberto como desafio não foi achado';
  end if;
  if not exists (select 1 from public.arena_tentativas where semana = 'zz-W00' and lendas && array['legacy-zz'] and id = tent) then
    raise exception 'a tentativa não foi achada pelo ranking ou pela lenda';
  end if;
  begin
    insert into public.arena_tentativas (filme, desafiante, minuto, no_minuto, placar_ele, placar_voce, placar_parado, saldo, contra_parado, semana)
      values (filme, outro, 70, '{0,0}', '{0,0}', '{0,0}', '{0,0}', 0, 0, 'zz-W00');
    raise exception 'o mesmo desafiante tentou o mesmo filme duas vezes';
  exception when unique_violation then null;
  end;
  begin
    insert into public.arena_tentativas (filme, desafiante, minuto, no_minuto, placar_ele, placar_voce, placar_parado, saldo, contra_parado, semana)
      values (filme, dono, 88, '{0,0}', '{0,0}', '{0,0}', '{0,0}', 0, 0, 'zz-W00');
    raise exception 'aceitou assumir no 88''';
  exception when check_violation then null;
  end;
  delete from public.partidas_filme where id = filme; -- cascata leva a tentativa
  if exists (select 1 from public.arena_tentativas where id = tent) then
    raise exception 'a tentativa sobreviveu ao filme apagado';
  end if;
  raise notice 'verificação: ok';
end $$;
