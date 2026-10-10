-- ═══════════════════════════════════════════════════════════════════════════
-- PARTIDA VIVA — Fase 7: "seu time jogou enquanto você dormia"
--
-- O filme de uma partida LEGACY (docs/PARTIDA-VIVA-PLANO.md §8): o roteiro de
-- quadros que reproduz a partida idêntica no campo. Quem jogou (`dono`) manda
-- pro servidor; se o adversário era o time de outro manager (`adversario`),
-- ele recebe uma notificação e assiste o time DELE jogando.
--
-- Só o servidor lê e escreve (rotas em server/src/routes/filmes.ts): o cliente
-- nunca toca a tabela. Um filme por (dono, seed) — reenviar não duplica.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.partidas_filme (
  id             uuid primary key default gen_random_uuid(),
  dono           uuid not null references auth.users(id) on delete cascade,
  adversario     uuid references auth.users(id) on delete set null,
  seed           text not null,
  resumo         jsonb not null,
  filme          jsonb not null,
  criado_em      timestamptz not null default now(),
  visto_em       timestamptz,
  unique (dono, seed),
  check (adversario is null or adversario <> dono),
  check (pg_column_size(filme) <= 400000)
);
create index if not exists partidas_filme_dono on public.partidas_filme (dono, criado_em desc);
create index if not exists partidas_filme_adversario on public.partidas_filme (adversario, criado_em desc) where adversario is not null;

alter table public.partidas_filme enable row level security;
revoke all on public.partidas_filme from anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — roda junto e derruba tudo se falhar
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  dono uuid := (select id from auth.users order by created_at limit 1);
  outro uuid := (select id from auth.users order by created_at offset 1 limit 1);
  novo uuid;
begin
  if has_table_privilege('authenticated', 'public.partidas_filme', 'select')
     or has_table_privilege('anon', 'public.partidas_filme', 'select') then
    raise exception 'partidas_filme ficou aberta ao cliente';
  end if;
  if dono is null or outro is null then
    raise notice 'verificação: sem dois usuários pra testar o insert (ambiente vazio)';
    return;
  end if;
  -- o caminho novo: grava, o par (dono, seed) é único, não aceita jogar contra si mesmo
  insert into public.partidas_filme (dono, adversario, seed, resumo, filme)
    values (dono, outro, 'zz-verifica-filme', '{}'::jsonb, '{"v":1}'::jsonb)
    returning id into novo;
  begin
    insert into public.partidas_filme (dono, seed, resumo, filme) values (dono, 'zz-verifica-filme', '{}', '{}');
    raise exception 'o mesmo (dono, seed) entrou duas vezes';
  exception when unique_violation then null;
  end;
  begin
    insert into public.partidas_filme (dono, adversario, seed, resumo, filme) values (dono, dono, 'zz-verifica-si', '{}', '{}');
    raise exception 'aceitou o dono como adversário de si mesmo';
  exception when check_violation then null;
  end;
  delete from public.partidas_filme where id = novo;
  raise notice 'verificação: ok';
end $$;
