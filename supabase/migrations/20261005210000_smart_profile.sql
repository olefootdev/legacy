-- ═══════════════════════════════════════════════════════════════════════════
-- SMART-PROFILE — Fase 1: a ficha única do jogador, morando no servidor
--
-- Uma ficha por PAR (dono, jogador). O mesmo Genesis está no elenco de dezenas
-- de managers e cada cópia evolui do seu jeito — por isso a chave é dupla.
--
--   player_profiles         a ficha viva (9 camadas: gênese, corpo, classe,
--                           temperamento, traços, progressão, cérebro, vínculo)
--   player_profile_events   a MEMÓRIA do jogador: só recebe linhas novas
--
-- Quem escreve é só o servidor (service role). O dono lê as próprias fichas.
-- Lógica: server/src/lib/smartProfile/. Plano: doc SMART-PROFILE, Fase 1.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.player_profiles (
  owner_id          uuid not null references auth.users(id) on delete cascade,
  player_id         text not null,
  origem            text not null check (origem in ('genesis','legacy','academia','gacha','revela','bot')),
  catalogo          text,
  raridade          text not null check (raridade in ('comum','raro','epico','lendario','unico')),
  -- Camada 1: selada no nascimento; o hash prova que ninguém mexeu depois.
  genese            jsonb not null,
  genese_hash       text not null check (genese_hash ~ '^[0-9a-f]{64}$'),
  nome              text not null,
  posicao           text not null,
  -- Camada 2: o corpo de hoje.
  atributos         jsonb not null,
  ovr               smallint not null check (ovr between 1 and 99),
  -- Camada 3: a classe (16 do catálogo) e a afinidade (a segunda melhor).
  classe            text not null,
  classe_afinidade  text,
  -- Camadas 4 a 9.
  temperamento      jsonb not null,
  tracos            jsonb not null default '[]'::jsonb,
  nivel             smallint not null default 1 check (nivel between 1 and 50),
  xp                integer not null default 0 check (xp >= 0),
  cerebro           jsonb not null default '{"espacos":1,"ideias":[]}'::jsonb,
  vinculo           jsonb not null default '{}'::jsonb,
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  primary key (owner_id, player_id)
);
create index if not exists player_profiles_ativos on public.player_profiles (owner_id) where ativo;
create index if not exists player_profiles_catalogo on public.player_profiles (catalogo) where catalogo is not null;

-- A gênese não muda depois de nascer: nem pelo servidor.
create or replace function public.player_profiles_genese_selada()
returns trigger language plpgsql as $$
begin
  if new.genese_hash <> old.genese_hash or new.genese <> old.genese then
    raise exception 'gênese do jogador % é selada: não muda depois de nascer', old.player_id;
  end if;
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists player_profiles_genese_selada on public.player_profiles;
create trigger player_profiles_genese_selada before update on public.player_profiles
  for each row execute function public.player_profiles_genese_selada();

create table if not exists public.player_profile_events (
  id         bigint generated always as identity primary key,
  owner_id   uuid not null,
  player_id  text not null,
  tipo       text not null check (tipo in ('nasceu','atributos','saiu_do_elenco','voltou_ao_elenco')),
  dados      jsonb not null default '{}'::jsonb,
  criado_em  timestamptz not null default now(),
  foreign key (owner_id, player_id) references public.player_profiles (owner_id, player_id) on delete cascade
);
create index if not exists player_profile_events_jogador on public.player_profile_events (owner_id, player_id, criado_em desc);

-- Memória é append-only: nenhuma linha muda depois de escrita (update recusado
-- pelo trigger). Delete só existe pelo cascade de uma conta apagada; o cliente
-- não tem permissão de delete e o servidor não tem rota que apague.
create or replace function public.player_profile_events_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'player_profile_events é append-only: % recusado na linha %', tg_op, old.id;
end $$;
drop trigger if exists player_profile_events_sem_update on public.player_profile_events;
create trigger player_profile_events_sem_update before update on public.player_profile_events
  for each row execute function public.player_profile_events_append_only();

alter table public.player_profiles enable row level security;
alter table public.player_profile_events enable row level security;
revoke all on public.player_profiles, public.player_profile_events from anon;
revoke insert, update, delete on public.player_profiles, public.player_profile_events from authenticated;
grant select on public.player_profiles, public.player_profile_events to authenticated;

drop policy if exists player_profiles_proprias on public.player_profiles;
create policy player_profiles_proprias on public.player_profiles
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists player_profile_events_proprios on public.player_profile_events;
create policy player_profile_events_proprios on public.player_profile_events
  for select to authenticated using (owner_id = auth.uid());

do $$
begin
  if has_table_privilege('authenticated', 'public.player_profiles', 'insert')
     or has_table_privilege('authenticated', 'public.player_profile_events', 'insert')
     or has_table_privilege('anon', 'public.player_profiles', 'select') then
    raise exception 'SMART-PROFILE ficou aberto para escrita do cliente';
  end if;
end $$;
