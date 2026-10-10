-- ═══════════════════════════════════════════════════════════════════════════
-- PARTIDA VIVA — Fase 8: "sua lenda jogou"
--
-- Cada filme passa a dizer quais LENDAS (cartas de legacy_players) estavam em
-- campo. O id do jogador-lenda no elenco é o próprio `legacy_players.id`
-- (legacy-<slug>-<fase>), então basta guardar os ids. O atleta por trás da
-- carta (`legacy_players.beneficiary_user_id`) vê as partidas da lenda dele no
-- PLAYERVIP, com a Câmera do Craque já nele.
--
-- O servidor preenche ao gravar (server/src/routes/filmes.ts), só com ids que
-- existem em legacy_players. Backfill: os filmes que já existem.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.partidas_filme add column if not exists lendas text[] not null default '{}';
-- Gols de cada lenda no filme ({"legacy-x-revelacao": 2}) — a lista do PLAYERVIP não abre o filme inteiro.
alter table public.partidas_filme add column if not exists lendas_gols jsonb not null default '{}'::jsonb;
create index if not exists partidas_filme_lendas on public.partidas_filme using gin (lendas);

-- Backfill: lendas dos filmes já gravados (fichas cujo id existe em legacy_players).
update public.partidas_filme pf
   set lendas = coalesce((
     select array_agg(distinct f->>'id')
       from jsonb_array_elements(case when jsonb_typeof(pf.filme->'fichas') = 'array' then pf.filme->'fichas' else '[]'::jsonb end) f
      -- no elenco o id é 'legacy-<id da linha>' quando a linha não traz o prefixo
      where exists (select 1 from public.legacy_players lp where lp.id = f->>'id' or 'legacy-' || lp.id = f->>'id')
   ), '{}')
 where pf.lendas = '{}';


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — roda junto e derruba tudo se falhar
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  dono uuid := (select id from auth.users order by created_at limit 1);
  lenda text := (select id from public.legacy_players order by id limit 1);
  novo uuid;
begin
  if has_table_privilege('authenticated', 'public.partidas_filme', 'select') then
    raise exception 'partidas_filme ficou aberta ao cliente';
  end if;
  if dono is null or lenda is null then
    raise notice 'verificação: sem usuário ou sem lenda pra testar (ambiente vazio)';
    return;
  end if;
  -- o caminho novo: grava com a lenda e ACHA pelo índice (operador &&)
  insert into public.partidas_filme (dono, seed, resumo, filme, lendas)
    values (dono, 'zz-verifica-lenda', '{}'::jsonb, '{"v":1}'::jsonb, array[lenda])
    returning id into novo;
  if not exists (select 1 from public.partidas_filme where lendas && array[lenda] and id = novo) then
    raise exception 'o filme com a lenda não foi achado pela busca de lendas';
  end if;
  delete from public.partidas_filme where id = novo;
  raise notice 'verificação: ok';
end $$;
