-- ═══════════════════════════════════════════════════════════════════════════
-- BÔNUS DE EQUIPARAÇÃO — árvore, acervos, ciclo e claim
--
-- A lógica pura vive em server/src/lib/expansao/ (150 testes). Aqui é
-- persistência + as consultas que a lógica não consegue fazer barato de fora.
--
-- 🔑 A DIVISÃO DE TRABALHO, que é a decisão de arquitetura deste arquivo:
--   · TS DECIDE onde a pessoa entra (vagaNaPerna, busca em largura) — é regra
--     de negócio testada, não fica em SQL.
--   · SQL GUARDA e faz o que seria N+1 de fora: creditar a perna de TODOS os
--     ancestrais de uma vez, e responder o mapa por janela de profundidade.
--
-- 🔑 CAMINHOS MATERIALIZADOS. Sem eles, "essa pessoa é da minha equipe?" seria
-- uma subida recursiva por nó — com 50.000 descendentes, 50.000 subidas por
-- tela. Com eles vira teste de pertinência num índice GIN:
--   · patrocinio_path — quem indicou quem  → define se mostra o @username
--   · posicao_path    — onde foi colocado  → define de quem é a perna
-- Um nó pode estar na minha perna SEM ser da minha equipe (derramamento), e é
-- exatamente essa diferença que a privacidade usa.
--
-- Disciplinas herdadas: numeric(78,0) (bigint estoura), ledger append-only por
-- trigger, idempotência por índice único em `ref`, e revoke explícito em função
-- security definer — o Postgres dá EXECUTE a PUBLIC em função nova e
-- "grant to service_role" NÃO restringe.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── a árvore ─────────────────────────────────────────────────────────────
create table if not exists public.expansao_no (
  user_id         uuid primary key references auth.users(id) on delete restrict,
  -- Quem convidou. null só na raiz.
  patrocinador_id uuid references auth.users(id) on delete restrict,
  -- Debaixo de quem ficou DE FATO. Difere do patrocinador quando derrama.
  pai_id          uuid references auth.users(id) on delete restrict,
  lado            smallint check (lado in (1, 2)),
  -- Ancestrais, raiz primeiro, SEM a própria pessoa.
  patrocinio_path uuid[] not null default '{}',
  posicao_path    uuid[] not null default '{}',
  -- Y estável no mapa. Se recalculasse a cada carga, os nós pulariam de lugar
  -- e o mapa ficaria irreconhecível entre uma sessão e outra.
  y_ordem         bigint not null,
  nivel           integer not null default 0 check (nivel >= 0),
  criado_em       timestamptz not null default now(),
  -- Raiz tem os três nulos; todo o resto tem os três preenchidos.
  constraint expansao_no_raiz_coerente check (
    (pai_id is null and lado is null and nivel = 0) or
    (pai_id is not null and lado is not null and nivel > 0)
  ),
  constraint expansao_no_nao_patrocina_a_si check (patrocinador_id is distinct from user_id),
  constraint expansao_no_nao_e_pai_de_si    check (pai_id is distinct from user_id)
);

create sequence if not exists public.expansao_y_seq;
create unique index if not exists expansao_no_vaga_unica on public.expansao_no (pai_id, lado)
  where pai_id is not null;
create index if not exists expansao_no_patrocinio on public.expansao_no using gin (patrocinio_path);
create index if not exists expansao_no_posicao    on public.expansao_no using gin (posicao_path);
create index if not exists expansao_no_nivel      on public.expansao_no (nivel, y_ordem);
create index if not exists expansao_no_patrocinador on public.expansao_no (patrocinador_id);

-- ─── os DOIS acervos de volume ────────────────────────────────────────────
-- 🔴 Dois trilhos, não um. `qualificacao` gradua e NUNCA é consumido;
-- `equiparacao` é o que o ciclo consome. Um mapa só causaria dois erros de
-- dinheiro: pagar por fonte que só qualifica, e rebaixar a graduação de quem
-- acabou de receber bônus.
create table if not exists public.expansao_perna (
  user_id   uuid not null references auth.users(id) on delete restrict,
  lado      smallint not null check (lado in (1, 2)),
  trilho    text not null check (trilho in ('qualificacao', 'equiparacao')),
  volume    numeric(78,0) not null default 0 check (volume >= 0),
  primary key (user_id, lado, trilho)
);

-- ─── ledger de OLEXP (append-only) ────────────────────────────────────────
create table if not exists public.expansao_olexp (
  id        bigserial primary key,
  user_id   uuid not null references auth.users(id) on delete restrict,
  olexp     numeric(78,0) not null check (olexp > 0),
  fonte     text not null check (fonte in (
              'compra_olefoot','compra_dex','nft','marketplace',
              'produto_jogo','assinatura','evento','campanha','ajuste_admin')),
  -- Idempotência: a MESMA compra não credita duas vezes.
  ref       text not null,
  qualificou boolean not null,
  equiparou  boolean not null,
  criado_em timestamptz not null default now()
);
create unique index if not exists expansao_olexp_ref_unico on public.expansao_olexp (ref);
create index if not exists expansao_olexp_user on public.expansao_olexp (user_id, criado_em desc);

-- ─── ciclos ───────────────────────────────────────────────────────────────
create table if not exists public.expansao_ciclo (
  id                  bigserial primary key,
  abre_em             timestamptz not null,
  fecha_em            timestamptz not null,
  status              text not null default 'OPEN' check (status in
                        ('OPEN','CALCULATING','READY','SETTLING','SETTLED','CANCELED','HELD')),
  receita_menor_unid  numeric(78,0) not null default 0 check (receita_menor_unid >= 0),
  percentual_bps      integer not null default 2500 check (percentual_bps between 0 and 10000),
  pool                numeric(78,0) not null default 0 check (pool >= 0),
  equiparado_total    numeric(78,0) not null default 0 check (equiparado_total >= 0),
  -- null é diferente de zero: ciclo sem pool NÃO liquida, fica retido.
  valor_por_olexp_micro numeric(78,0),
  -- Preço de referência REGISTRADO. O claim converte por ele, nunca pelo preço
  -- do momento do saque — senão sentar no claim esperando queda leva mais token.
  preco_micro         numeric(78,0),
  motivo              text,
  fechado_em          timestamptz,
  constraint expansao_ciclo_janela check (fecha_em > abre_em)
);
create unique index if not exists expansao_ciclo_janela_unica on public.expansao_ciclo (abre_em);

-- ─── liquidação por pessoa no ciclo ───────────────────────────────────────
create table if not exists public.expansao_liquidacao (
  ciclo_id     bigint not null references public.expansao_ciclo(id) on delete restrict,
  user_id      uuid not null references auth.users(id) on delete restrict,
  equiparado   numeric(78,0) not null check (equiparado >= 0),
  sobra_t1     numeric(78,0) not null default 0 check (sobra_t1 >= 0),
  sobra_t2     numeric(78,0) not null default 0 check (sobra_t2 >= 0),
  bonus_contabil numeric(78,0) not null default 0 check (bonus_contabil >= 0),
  -- Retido por não ter 1 indicado em CADA perna. O saldo NÃO é confiscado.
  retido_inativo boolean not null default false,
  criado_em    timestamptz not null default now(),
  primary key (ciclo_id, user_id)
);

-- ─── claims ───────────────────────────────────────────────────────────────
create table if not exists public.expansao_claim (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id) on delete restrict,
  ref           text not null,
  -- O que CHEGA na wallet (a taxa de 5% do Token-2022 morde na entrega).
  olefoot_liquido numeric(78,0) not null check (olefoot_liquido > 0),
  -- O que sai da tesouraria, ~5,26% maior.
  olefoot_bruto   numeric(78,0) not null check (olefoot_bruto >= olefoot_liquido),
  wallet        text not null,
  status        text not null default 'pendente'
                  check (status in ('pendente','aprovado','pago','recusado')),
  achados       jsonb,
  criado_em     timestamptz not null default now(),
  pago_em       timestamptz
);
create unique index if not exists expansao_claim_ref_unico on public.expansao_claim (ref);
create index if not exists expansao_claim_dia
  on public.expansao_claim (criado_em) where status in ('aprovado','pago');

-- ─── append-only nos livros ───────────────────────────────────────────────
create or replace function public.expansao_append_only()
returns trigger language plpgsql as $$
begin
  raise exception '% é append-only (tentou % no id %)', tg_table_name, tg_op, old.id;
end;
$$;

drop trigger if exists expansao_olexp_imutavel on public.expansao_olexp;
create trigger expansao_olexp_imutavel before update or delete on public.expansao_olexp
  for each row execute function public.expansao_append_only();

-- ─── INSERÇÃO: o TS decide a vaga, o SQL monta os caminhos ────────────────
-- Os caminhos saem do PAI, nunca recalculados subindo — é o que mantém a
-- inserção O(1) mesmo com a árvore enorme.
create or replace function public.expansao_inserir(
  p_user uuid, p_patrocinador uuid, p_pai uuid, p_lado smallint
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_pat_path uuid[];
  v_pos_path uuid[];
  v_nivel    integer;
begin
  if p_pai is null then   -- raiz
    insert into expansao_no (user_id, patrocinador_id, pai_id, lado,
                             patrocinio_path, posicao_path, y_ordem, nivel)
    values (p_user, null, null, null, '{}', '{}', nextval('expansao_y_seq'), 0);
    return;
  end if;

  select posicao_path || pai_id_col.user_id, nivel + 1
    into v_pos_path, v_nivel
    from expansao_no pai_id_col where user_id = p_pai;
  if v_pos_path is null then raise exception 'pai % não está na árvore', p_pai; end if;

  select patrocinio_path || user_id into v_pat_path
    from expansao_no where user_id = p_patrocinador;
  if v_pat_path is null then raise exception 'patrocinador % não está na árvore', p_patrocinador; end if;

  insert into expansao_no (user_id, patrocinador_id, pai_id, lado,
                           patrocinio_path, posicao_path, y_ordem, nivel)
  values (p_user, p_patrocinador, p_pai, p_lado,
          v_pat_path, v_pos_path, nextval('expansao_y_seq'), v_nivel);
end;
$$;
revoke all on function public.expansao_inserir(uuid,uuid,uuid,smallint) from public, anon, authenticated;
grant execute on function public.expansao_inserir(uuid,uuid,uuid,smallint) to service_role;

-- ─── CRÉDITO: sobe a perna de TODOS os ancestrais numa tacada ─────────────
-- De fora isto seria N+1 num loop sem teto de profundidade. Aqui é um UPDATE.
-- A perna de cada ancestral é o `lado` do FILHO dele no caminho — por isso o
-- unnest com ordinality e o passo seguinte.
create or replace function public.expansao_creditar(
  p_user uuid, p_olexp numeric, p_fonte text, p_ref text
) returns table (creditou boolean, motivo text)
language plpgsql security definer set search_path = public as $$
declare
  v_qualifica boolean;
  v_equipara  boolean;
begin
  if p_olexp <= 0 then return query select false, 'olexp_nao_positivo'; return; end if;
  if exists (select 1 from expansao_olexp where ref = p_ref) then
    return query select false, 'ref_ja_creditado'; return;
  end if;

  -- A régua de elegibilidade espelha ELEGIBILIDADE_PADRAO em unidade.ts.
  -- compra_dex não entra em NENHUM trilho: market buy não gera receita, então
  -- não pode gerar comissão. ajuste_admin nunca equipara.
  v_qualifica := p_fonte <> 'compra_dex';
  v_equipara  := p_fonte = 'compra_olefoot';

  insert into expansao_olexp (user_id, olexp, fonte, ref, qualificou, equiparou)
  values (p_user, p_olexp, p_fonte, p_ref, v_qualifica, v_equipara);

  if not v_qualifica and not v_equipara then
    return query select true, 'sem_trilho'; return;
  end if;

  -- ⚠️ NÃO credita na própria pessoa: o volume de perna é o que a REDE dela
  -- produziu. Se contasse, dava pra graduar sozinho comprando dos dois lados.
  insert into expansao_perna (user_id, lado, trilho, volume)
  select a.ancestral, a.lado, t.trilho, p_olexp
    from (
      select pa.elem as ancestral,
             coalesce(
               (select n2.lado from expansao_no n2
                 where n2.user_id = n.posicao_path[pa.pos + 1]),
               n.lado
             ) as lado
        from expansao_no n,
             unnest(n.posicao_path) with ordinality as pa(elem, pos)
       where n.user_id = p_user
    ) a
    cross join (
      select 'qualificacao' as trilho where v_qualifica
      union all
      select 'equiparacao'  where v_equipara
    ) t
   where a.lado is not null
  on conflict (user_id, lado, trilho)
    do update set volume = expansao_perna.volume + excluded.volume;

  return query select true, null::text;
end;
$$;
revoke all on function public.expansao_creditar(uuid,numeric,text,text) from public, anon, authenticated;
grant execute on function public.expansao_creditar(uuid,numeric,text,text) to service_role;

-- ─── ATIVAÇÃO: 1 indicado em CADA perna ───────────────────────────────────
-- Regra do fundador. Testa PATROCÍNIO, não posição: quem a pessoa trouxe, e em
-- qual perna dela cada um caiu. O MIN sozinho não pega isto — com derramamento
-- dá pra ter volume nos dois lados sem ter indicado ninguém.
create or replace function public.expansao_ativacao(p_user uuid)
returns table (ativo boolean, diretos_t1 integer, diretos_t2 integer, falta_na_perna smallint)
language sql stable security definer set search_path = public as $$
  with diretos as (
    select coalesce(
             (select n2.lado from expansao_no n2
               where n2.user_id = d.posicao_path[array_position(d.posicao_path, p_user) + 1]),
             d.lado
           ) as perna
      from expansao_no d
     where d.patrocinador_id = p_user
       and p_user = any(d.posicao_path)
  ), c as (
    select count(*) filter (where perna = 1)::int as t1,
           count(*) filter (where perna = 2)::int as t2
      from diretos
  )
  select (t1 >= 1 and t2 >= 1), t1, t2,
         case when t1 >= 1 and t2 >= 1 then null
              when t1 = 0 then 1::smallint else 2::smallint end
    from c;
$$;
revoke all on function public.expansao_ativacao(uuid) from public;
grant execute on function public.expansao_ativacao(uuid) to authenticated, service_role;

-- ─── O MAPA: janela de profundidade, com a privacidade embutida ───────────
-- Regra do fundador: mostra @username de quem é da MINHA EQUIPE (a cadeia de
-- patrocínio sobe até mim, em qualquer profundidade). Quem chegou por
-- derramamento ocupa a posição e conta no volume, mas só mostra a graduação.
--
-- 🔒 A trava que não pode sair: só retorna quem está ABAIXO de p_raiz. Sem
-- isso, qualquer um enumera a rede inteira.
create or replace function public.expansao_mapa(
  p_raiz uuid, p_de integer default 1, p_ate integer default 5
) returns table (
  user_id uuid, nivel integer, y_ordem bigint, perna smallint,
  da_minha_equipe boolean, pai_id uuid
) language sql stable security definer set search_path = public as $$
  select n.user_id,
         n.nivel - (select nivel from expansao_no r where r.user_id = p_raiz) as nivel,
         n.y_ordem,
         coalesce(
           (select n2.lado from expansao_no n2
             where n2.user_id = n.posicao_path[array_position(n.posicao_path, p_raiz) + 1]),
           n.lado
         ) as perna,
         (p_raiz = any(n.patrocinio_path)) as da_minha_equipe,
         n.pai_id
    from expansao_no n
   where p_raiz = any(n.posicao_path)
     and n.nivel - (select nivel from expansao_no r where r.user_id = p_raiz)
         between greatest(p_de, 1) and p_ate
   order by n.nivel, n.y_ordem;
$$;
revoke all on function public.expansao_mapa(uuid,integer,integer) from public;
grant execute on function public.expansao_mapa(uuid,integer,integer) to authenticated, service_role;

-- ─── RLS ──────────────────────────────────────────────────────────────────
alter table public.expansao_no          enable row level security;
alter table public.expansao_perna       enable row level security;
alter table public.expansao_olexp       enable row level security;
alter table public.expansao_ciclo       enable row level security;
alter table public.expansao_liquidacao  enable row level security;
alter table public.expansao_claim       enable row level security;

-- 🔒 A tabela da árvore NÃO tem policy de select: o acesso é só pela
-- expansao_mapa(), que aplica a privacidade. Ler a tabela direto entregaria a
-- rede inteira e os patrocinadores de todo mundo.
drop policy if exists expansao_perna_propria on public.expansao_perna;
create policy expansao_perna_propria on public.expansao_perna
  for select to authenticated using (user_id = auth.uid());
drop policy if exists expansao_olexp_proprio on public.expansao_olexp;
create policy expansao_olexp_proprio on public.expansao_olexp
  for select to authenticated using (user_id = auth.uid());
drop policy if exists expansao_liquidacao_propria on public.expansao_liquidacao;
create policy expansao_liquidacao_propria on public.expansao_liquidacao
  for select to authenticated using (user_id = auth.uid());
drop policy if exists expansao_claim_proprio on public.expansao_claim;
create policy expansao_claim_proprio on public.expansao_claim
  for select to authenticated using (user_id = auth.uid());
-- Ciclo é público de leitura: é o relógio que a tela mostra.
drop policy if exists expansao_ciclo_leitura on public.expansao_ciclo;
create policy expansao_ciclo_leitura on public.expansao_ciclo
  for select to anon, authenticated using (true);

comment on table public.expansao_no is
  'Árvore binária do bônus. patrocinio_path define quem vê o @username; posicao_path define de quem é a perna.';
comment on table public.expansao_perna is
  'DOIS trilhos: qualificacao gradua e nunca é consumido; equiparacao é o que o ciclo consome.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 CORREÇÃO APLICADA DEPOIS, e a lição fica aqui porque vai acontecer de novo
--
-- Os `revoke ... from public` acima NÃO bastaram. O Supabase tem DEFAULT
-- PRIVILEGES que concedem EXECUTE a anon/authenticated/service_role em toda
-- função nova do schema public — o grant chega pelos ROLES NOMEADOS, não por
-- PUBLIC, então revogar de PUBLIC não tira nada.
--
-- Conferido no proacl depois de aplicar: expansao_mapa e expansao_ativacao
-- estavam com anon=X. E expansao_mapa é justamente a função que existe pra NÃO
-- vazar a rede: com anon podendo chamá-la, bastava ter um uuid pra enumerar a
-- árvore de alguém sem nem ter sessão.
--
-- Mesmo portão-que-falha-aberto do /api/admin/profiles e do vault_ancestrais.
-- A regra: em Postgres, permissão se CONFERE lendo o ACL depois de aplicar —
-- nunca se deduz do que a gente escreveu.
-- ═══════════════════════════════════════════════════════════════════════════
revoke execute on function public.expansao_mapa(uuid,integer,integer) from anon;
revoke execute on function public.expansao_ativacao(uuid) from anon;
revoke execute on function public.expansao_append_only() from anon, authenticated;
