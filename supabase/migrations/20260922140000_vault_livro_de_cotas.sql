-- Livro do Vault: cotas por manager, persistidas (A VIRADA · V1).
--
-- A matemática já existe e está testada em `server/src/lib/vaultBook.ts` +
-- `harvestSplit.ts` (npm run test:vault-book, 36 casos). Esta migration NÃO a
-- reimplementa em plpgsql: duas implementações de conta de dinheiro divergem, e
-- a que diverge em silêncio é sempre a que ninguém testa. O banco aqui faz o
-- que só o banco sabe fazer — guardar, travar a concorrência e RECUSAR estado
-- impossível. A conta continua num lugar só.
--
-- Concorrência por compare-and-swap: quem escreve leu o fundo na versão N e só
-- consegue gravar se ainda estiver em N. Dois resgates simultâneos não se
-- atropelam; o segundo recebe conflito e relê.
--
-- Fronteira: nada aqui lê `manager_game_state.finance`. Cota nasce de depósito
-- verificado, não de saldo escrito pelo cliente (ver docs/FRONTEIRA-TOKEN.md).

-- ---------------------------------------------------------------- o fundo ---
create table if not exists public.vault_fund (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  ativo         text not null,                       -- 'SOL', 'USDT'…
  decimais      smallint not null check (decimais between 0 and 18),
  -- numeric(78,0) e não bigint: micro-cota = unidade × 1e9, e 250 SOL em
  -- lamports já passa de 2e20. bigint estoura em 9.2e18.
  cotas_emitidas numeric(78,0) not null default 0 check (cotas_emitidas >= 0),
  patrimonio     numeric(78,0) not null default 0 check (patrimonio >= 0),
  versao         bigint not null default 0,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  -- A mesma recusa que `exigeConsistente` faz no TS, agora impossível de burlar:
  -- cota emitida com patrimônio zero dilui todo mundo a zero.
  constraint vault_fund_consistente check (cotas_emitidas = 0 or patrimonio > 0)
);

comment on column public.vault_fund.cotas_emitidas is
  'Micro-cotas (1 cota = 1e9). Soma das posições tem que bater — ver vault_reconciliar().';

-- ----------------------------------------------------------- as posições ---
create table if not exists public.vault_position (
  fund_id       uuid not null references public.vault_fund(id) on delete restrict,
  user_id       uuid not null references auth.users(id) on delete restrict,
  cotas         numeric(78,0) not null check (cotas > 0),  -- zerou, a linha sai
  atualizado_em timestamptz not null default now(),
  primary key (fund_id, user_id)
);

create index if not exists vault_position_user_idx on public.vault_position (user_id);

-- ------------------------------------------------------- o livro sagrado ---
-- Append-only de verdade: o trigger abaixo recusa update e delete. Se um dia
-- precisar corrigir, entra linha nova de correção — não se apaga história.
create table if not exists public.vault_ledger (
  id         bigserial primary key,
  fund_id    uuid not null references public.vault_fund(id) on delete restrict,
  user_id    uuid references auth.users(id) on delete restrict,   -- null = movimento do fundo
  tipo       text not null check (tipo in ('aporte','resgate','marcacao','colheita','rateio','reinvestimento')),
  unidades   numeric(78,0) not null default 0,
  cotas      numeric(78,0) not null default 0,
  -- Fotografia do fundo DEPOIS do movimento: dá pra reconstituir o NAV de
  -- qualquer linha sem recalcular a história inteira.
  cotas_apos numeric(78,0) not null check (cotas_apos >= 0),
  patrim_apos numeric(78,0) not null check (patrim_apos >= 0),
  motivo     text,
  ref        text,
  criado_em  timestamptz not null default now()
);

create index if not exists vault_ledger_fund_idx on public.vault_ledger (fund_id, id);
create index if not exists vault_ledger_user_idx on public.vault_ledger (user_id, id desc);

create or replace function public.vault_ledger_imutavel()
returns trigger language plpgsql as $$
begin
  raise exception 'vault_ledger é append-only: % recusado na linha %',
    tg_op, coalesce(old.id, -1);
end;
$$;

drop trigger if exists vault_ledger_sem_update on public.vault_ledger;
create trigger vault_ledger_sem_update before update or delete on public.vault_ledger
  for each row execute function public.vault_ledger_imutavel();

-- ------------------------------------------------- a colheita e o rateio ---
create table if not exists public.vault_harvest (
  id           bigserial primary key,
  fund_id      uuid not null references public.vault_fund(id) on delete restrict,
  depositante  uuid not null references auth.users(id) on delete restrict,
  colheita     numeric(78,0) not null check (colheita >= 0),
  politica     text not null check (politica in ('reinvestir','depositante','casa')),
  reinvestido  numeric(78,0) not null default 0 check (reinvestido >= 0),
  criado_em    timestamptz not null default now()
);

-- Uma linha por fatia, inclusive as VAGAS (destino null + motivo). É o extrato
-- que responde "cadê os 25%?" sem ninguém precisar acreditar na gente.
create table if not exists public.vault_harvest_slice (
  harvest_id bigint not null references public.vault_harvest(id) on delete cascade,
  fatia      text not null check (fatia in ('voce','myclub','manager','captain','pro','olefoot')),
  papel      text not null check (papel in ('depositante','nivel1','nivel2','nivel3','nivel4','casa')),
  destino    uuid references auth.users(id) on delete restrict,
  unidades   numeric(78,0) not null check (unidades >= 0),
  motivo     text,
  primary key (harvest_id, fatia),
  -- Ou tem dono, ou tem motivo escrito. Fatia sem dono e sem motivo é vazamento.
  constraint vault_slice_dono_ou_motivo check (destino is not null or motivo is not null)
);

-- A trava que o self-test faz no TS, agora também no banco: o rateio fecha.
create or replace function public.vault_harvest_fecha()
returns trigger language plpgsql as $$
declare
  v_colheita numeric(78,0);
  v_somado   numeric(78,0);
begin
  select h.colheita into v_colheita
  from public.vault_harvest h where h.id = new.harvest_id;

  select coalesce(sum(s.unidades), 0) into v_somado
  from public.vault_harvest_slice s where s.harvest_id = new.harvest_id;

  if v_somado > v_colheita then
    raise exception 'rateio da colheita % estourou: % distribuído de % colhido',
      new.harvest_id, v_somado, v_colheita;
  end if;
  return new;
end;
$$;

drop trigger if exists vault_slice_nao_estoura on public.vault_harvest_slice;
create constraint trigger vault_slice_nao_estoura
  after insert or update on public.vault_harvest_slice
  deferrable initially deferred
  for each row execute function public.vault_harvest_fecha();

-- ------------------------------------------------------- compare-and-swap ---
-- Um write atômico do livro. `p_versao` é a versão que o chamador leu; se o
-- fundo já andou, ninguém grava e o chamador relê. Posições chegam em estado
-- ABSOLUTO (não delta): quem calculou tinha o livro travado naquela versão.
create or replace function public.vault_apply(
  p_fund      uuid,
  p_versao    bigint,
  p_cotas     numeric,
  p_patrim    numeric,
  p_posicoes  jsonb default '[]'::jsonb,   -- [{"user_id":…, "cotas":"…"}]
  p_ledger    jsonb default '[]'::jsonb    -- [{"user_id":…, "tipo":…, "unidades":"…", "cotas":"…", "motivo":…, "ref":…}]
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_nova   bigint;
  v_linha  jsonb;
  v_soma   numeric(78,0);
begin
  update public.vault_fund
     set cotas_emitidas = p_cotas,
         patrimonio     = p_patrim,
         versao         = versao + 1,
         atualizado_em  = now()
   where id = p_fund and versao = p_versao
  returning versao into v_nova;

  if v_nova is null then
    raise exception 'conflito de versão no fundo %: esperada %, releia', p_fund, p_versao
      using errcode = '40001';
  end if;

  for v_linha in select * from jsonb_array_elements(p_posicoes) loop
    if (v_linha->>'cotas')::numeric = 0 then
      delete from public.vault_position
       where fund_id = p_fund and user_id = (v_linha->>'user_id')::uuid;
    else
      insert into public.vault_position (fund_id, user_id, cotas)
      values (p_fund, (v_linha->>'user_id')::uuid, (v_linha->>'cotas')::numeric)
      on conflict (fund_id, user_id)
      do update set cotas = excluded.cotas, atualizado_em = now();
    end if;
  end loop;

  for v_linha in select * from jsonb_array_elements(p_ledger) loop
    insert into public.vault_ledger
      (fund_id, user_id, tipo, unidades, cotas, cotas_apos, patrim_apos, motivo, ref)
    values (
      p_fund,
      nullif(v_linha->>'user_id','')::uuid,
      v_linha->>'tipo',
      coalesce((v_linha->>'unidades')::numeric, 0),
      coalesce((v_linha->>'cotas')::numeric, 0),
      p_cotas, p_patrim,
      v_linha->>'motivo',
      v_linha->>'ref'
    );
  end loop;

  -- A invariante mais importante do arquivo: a soma das posições É o emitido.
  select coalesce(sum(cotas), 0) into v_soma
  from public.vault_position where fund_id = p_fund;

  if v_soma <> p_cotas then
    raise exception 'livro não bate no fundo %: posições somam %, emitido diz %',
      p_fund, v_soma, p_cotas;
  end if;

  return v_nova;
end;
$$;

revoke all on function public.vault_apply(uuid,bigint,numeric,numeric,jsonb,jsonb) from public, anon, authenticated;

-- ------------------------------------------------------------ conferência ---
-- Roda a seco quando quiser: select * from public.vault_reconciliar();
create or replace function public.vault_reconciliar()
returns table (fundo text, emitido numeric, somado numeric, diferenca numeric, patrimonio numeric)
language sql stable security definer set search_path = public as $$
  select f.slug,
         f.cotas_emitidas,
         coalesce(sum(p.cotas), 0),
         f.cotas_emitidas - coalesce(sum(p.cotas), 0),
         f.patrimonio
  from public.vault_fund f
  left join public.vault_position p on p.fund_id = f.id
  group by f.id, f.slug, f.cotas_emitidas, f.patrimonio
  order by f.slug;
$$;

-- -------------------------------------------------------------------- RLS ---
-- Ninguém escreve pelo cliente. Nenhuma linha destas tabelas pode nascer de
-- valor que o navegador mandou — é a lição que `manager_game_state.finance`
-- ensinou caro. Todo write passa pelo servidor com service_role.
alter table public.vault_fund           enable row level security;
alter table public.vault_position       enable row level security;
alter table public.vault_ledger         enable row level security;
alter table public.vault_harvest        enable row level security;
alter table public.vault_harvest_slice  enable row level security;

drop policy if exists vault_fund_leitura on public.vault_fund;
create policy vault_fund_leitura on public.vault_fund
  for select to authenticated using (true);          -- o fundo é público por desenho

drop policy if exists vault_position_propria on public.vault_position;
create policy vault_position_propria on public.vault_position
  for select to authenticated using (user_id = auth.uid());

drop policy if exists vault_ledger_proprio on public.vault_ledger;
create policy vault_ledger_proprio on public.vault_ledger
  for select to authenticated using (user_id = auth.uid() or user_id is null);

drop policy if exists vault_harvest_propria on public.vault_harvest;
create policy vault_harvest_propria on public.vault_harvest
  for select to authenticated using (depositante = auth.uid());

drop policy if exists vault_slice_propria on public.vault_harvest_slice;
create policy vault_slice_propria on public.vault_harvest_slice
  for select to authenticated using (
    destino = auth.uid()
    or exists (select 1 from public.vault_harvest h
               where h.id = harvest_id and h.depositante = auth.uid())
  );

-- ------------------------------------------------- os ancestrais da rede ---
-- Os quatro papéis do rateio são os quatro primeiros ancestrais na árvore de
-- indicação. A aresta é por CÓDIGO (profiles.referred_by_code →
-- profiles.my_referral_code), não FK — então normaliza e ignora auto-indicação
-- e ciclo, que o banco não impede sozinho.
create or replace function public.vault_ancestrais(p_user uuid, p_niveis int default 4)
returns table (nivel int, user_id uuid)
language sql stable security definer set search_path = public as $$
  with recursive base as (
    select id,
           nullif(upper(trim(my_referral_code)), '')  as code,
           nullif(upper(trim(referred_by_code)), '')  as parent_code
    from public.profiles
  ),
  aresta as (
    select b.id as filho, p.id as pai
    from base b join base p on p.code = b.parent_code and p.id <> b.id
  ),
  subida as (
    select a.pai as ancestral, 1 as nivel, array[a.filho, a.pai] as caminho
    from aresta a where a.filho = p_user
    union all
    select a.pai, s.nivel + 1, s.caminho || a.pai
    from subida s join aresta a on a.filho = s.ancestral
    where s.nivel < p_niveis and not (a.pai = any(s.caminho))
  )
  select nivel, ancestral from subida order by nivel;
$$;

-- ⚠ Estes grants NÃO restringem: o Postgres já concede EXECUTE a PUBLIC em toda
-- função nova. Quem fecha é a migration 20260922141000, com os revoke.
grant execute on function public.vault_ancestrais(uuid, int) to service_role;
grant execute on function public.vault_reconciliar() to service_role;
grant execute on function public.vault_apply(uuid,bigint,numeric,numeric,jsonb,jsonb) to service_role;
