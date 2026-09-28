-- ═══════════════════════════════════════════════════════════════════════════
-- PRÉ-VENDA DO OLEFOOT — packs, posições travadas e o livro de liberações
--
-- A régua está em docs/TOKENOMICS.md e a lógica pura em
-- server/src/lib/presale/{packs,travas}.ts. Aqui é só a persistência.
--
-- Disciplinas herdadas do livro do Vault, cada uma por um motivo já pago:
--   • numeric(78,0) e não bigint — 250M tokens × 1e9 de casas = 2,5e17, e
--     somado por conta estoura o bigint do Postgres (erro 22003, já visto).
--   • ledger append-only por trigger — histórico que não se reescreve.
--   • idempotência por índice único parcial em (ref) — webhook reentregue,
--     retry de rede e duplo clique não podem creditar duas vezes.
--   • revoke de public/anon/authenticated em função security definer — o
--     Postgres dá EXECUTE a PUBLIC em função nova, e "grant to service_role"
--     NÃO restringe. Foi o mesmo portão-que-falha-aberto do /api/admin/profiles.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── configuração da venda ────────────────────────────────────────────────
-- Linha única. O preço e a alocação NÃO ficam aqui por acaso: ficam no código
-- (packs.ts), porque preço em tabela editável é preço que um UPDATE errado
-- muda sem deixar rastro no git. Aqui fica só o que é operação: abrir/fechar
-- a venda e o teto por conta.
create table if not exists public.presale_config (
  id                    boolean primary key default true check (id),
  aberta                boolean not null default false,
  -- Teto por conta em centavos de dólar. null = sem teto.
  -- ⚠️ Com meta de $31.250, teto de $2.500 dá 12 compradores. Ver §3b do doc.
  teto_conta_usd_cents  integer check (teto_conta_usd_cents is null or teto_conta_usd_cents > 0),
  -- Degrau: acima deste % vendido, o teto sobe pro valor abaixo.
  degrau_vendido_bps    integer not null default 5000 check (degrau_vendido_bps between 0 and 10000),
  teto_apos_degrau_usd_cents integer check (teto_apos_degrau_usd_cents is null or teto_apos_degrau_usd_cents > 0),
  -- Tokens ENTREGUES já vendidos. A alocação (250M) vive no código.
  tokens_vendidos       numeric(78,0) not null default 0 check (tokens_vendidos >= 0),
  lancada_em            timestamptz,
  atualizado_em         timestamptz not null default now()
);

insert into public.presale_config (id, aberta) values (true, false)
on conflict (id) do nothing;

-- ─── compras ──────────────────────────────────────────────────────────────
create table if not exists public.presale_purchase (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete restrict,
  -- 🔑 Idempotência: o external_id do payment_intent. Webhook reentregue não
  -- vira segunda compra.
  ref             text not null,
  usd_cents       integer not null check (usd_cents > 0),
  brl_cents       bigint  not null check (brl_cents > 0),
  -- A cotação usada, congelada. Sem isso não dá pra auditar a conversão depois.
  brl_por_usd_micro bigint not null check (brl_por_usd_micro > 0),
  -- O que a pessoa RECEBE (a casa cobre a taxa de 5% — opção 2).
  tokens_entregues numeric(78,0) not null check (tokens_entregues > 0),
  -- O que sai da tesouraria, ~5,26% maior.
  tokens_brutos    numeric(78,0) not null check (tokens_brutos >= tokens_entregues),
  status          text not null default 'pendente'
                    check (status in ('pendente','pago','estornado','cancelado')),
  criada_em       timestamptz not null default now(),
  paga_em         timestamptz
);

create unique index if not exists presale_purchase_ref_unico
  on public.presale_purchase (ref);
create index if not exists presale_purchase_user
  on public.presale_purchase (user_id, criada_em desc);

-- ─── posição travada ──────────────────────────────────────────────────────
create table if not exists public.presale_position (
  user_id              uuid primary key references auth.users(id) on delete restrict,
  -- Base da razão de dólar da liberação por compra.
  compra_original_usd_cents integer not null default 0 check (compra_original_usd_cents >= 0),
  tokens_totais        numeric(78,0) not null default 0 check (tokens_totais >= 0),
  liberado_por_compra  numeric(78,0) not null default 0 check (liberado_por_compra >= 0),
  liberado_por_tempo   numeric(78,0) not null default 0 check (liberado_por_tempo >= 0),
  sacado               numeric(78,0) not null default 0 check (sacado >= 0),
  versao               bigint not null default 0,
  atualizado_em        timestamptz not null default now(),
  -- Nenhuma porta pode passar da posição, e o sacado nunca passa do liberado.
  constraint presale_position_compra_cabe check (liberado_por_compra <= tokens_totais),
  constraint presale_position_tempo_cabe  check (liberado_por_tempo  <= tokens_totais),
  constraint presale_position_sacado_cabe check (sacado <= tokens_totais)
);

-- ─── livro de liberações (append-only) ────────────────────────────────────
create table if not exists public.presale_unlock (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete restrict,
  porta        text not null check (porta in ('compra','tempo','saque')),
  -- Ref da compra que destravou, quando a porta é 'compra'.
  ref          text,
  tokens       numeric(78,0) not null check (tokens > 0),
  -- Qual limite mordeu: razao_usd | paridade_token | teto_85 | posicao
  limitado_por text,
  criado_em    timestamptz not null default now()
);

create index if not exists presale_unlock_user
  on public.presale_unlock (user_id, criado_em desc);
-- Uma mesma compra destrava uma vez só.
create unique index if not exists presale_unlock_ref_unico
  on public.presale_unlock (ref) where porta = 'compra' and ref is not null;

create or replace function public.presale_unlock_imutavel()
returns trigger language plpgsql as $$
begin
  raise exception 'presale_unlock é append-only (tentou % no id %)', tg_op, old.id;
end;
$$;

drop trigger if exists presale_unlock_sem_update on public.presale_unlock;
create trigger presale_unlock_sem_update before update or delete on public.presale_unlock
  for each row execute function public.presale_unlock_imutavel();

-- ─── RLS ──────────────────────────────────────────────────────────────────
alter table public.presale_config   enable row level security;
alter table public.presale_purchase enable row level security;
alter table public.presale_position enable row level security;
alter table public.presale_unlock   enable row level security;

-- A config é pública de leitura (a tela precisa saber se a venda está aberta
-- e quanto resta) mas só o servidor escreve.
drop policy if exists presale_config_leitura on public.presale_config;
create policy presale_config_leitura on public.presale_config
  for select to anon, authenticated using (true);

drop policy if exists presale_purchase_propria on public.presale_purchase;
create policy presale_purchase_propria on public.presale_purchase
  for select to authenticated using (user_id = auth.uid());

drop policy if exists presale_position_propria on public.presale_position;
create policy presale_position_propria on public.presale_position
  for select to authenticated using (user_id = auth.uid());

drop policy if exists presale_unlock_proprio on public.presale_unlock;
create policy presale_unlock_proprio on public.presale_unlock
  for select to authenticated using (user_id = auth.uid());

-- Nenhuma policy de INSERT/UPDATE/DELETE de propósito: escrita só pela
-- service_role do servidor, que passa por cima de RLS. Cliente não escreve
-- posição nem liberação — foi exatamente o furo do `finance` escrito pelo
-- cliente (docs/FRONTEIRA-TOKEN.md).

-- ─── quanto resta da alocação ─────────────────────────────────────────────
-- A alocação (250.000.000 × 1e9) entra como parâmetro porque quem manda nela é
-- o código, não a tabela.
create or replace function public.presale_restam(p_alocacao numeric)
returns numeric language sql stable security invoker as $$
  select greatest(p_alocacao - coalesce((select tokens_vendidos from public.presale_config where id), 0), 0);
$$;

revoke all on function public.presale_restam(numeric) from public;
grant execute on function public.presale_restam(numeric) to anon, authenticated, service_role;

comment on table public.presale_config is
  'Configuração operacional da pré-venda. Preço e alocação vivem no código (packs.ts), não aqui.';
comment on table public.presale_position is
  'Posição travada da pré-venda. Duas portas de liberação: compra (teto 85%) e tempo.';
comment on table public.presale_unlock is
  'Livro append-only de liberações. Uma compra destrava uma vez só (índice único em ref).';
