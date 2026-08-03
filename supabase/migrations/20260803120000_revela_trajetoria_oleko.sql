-- ============================================================================
-- REVELA — A TRAJETÓRIA (OLEKO)
-- ============================================================================
-- O plano de carreira simulado do ATLETA. Ele divulga, acumula OLEKO, sobe de
-- divisão, e cada divisão libera um prêmio em EXP que só é sacado no game.
-- Plano completo: docs/REVELA_TRAJETORIA_PLANO.md
--
-- ── DUAS FONTES DE OLEKO, DE PROPÓSITO ──────────────────────────────────────
--   DERIVADO  — calculado do estado que já existe (tem foto? tem vídeo? quantos
--               fãs? quantos indicados aprovados?). Não guarda linha nenhuma:
--               se o dado muda, o OLEKO muda junto, e não há como dessincronizar.
--   CREDITADO — o que NÃO dá pra derivar (marcou no Instagram, pódio da semana).
--               Vira linha em `revela_oleko_events`, com par único por missão.
--
-- ── UMA FÓRMULA SÓ ──────────────────────────────────────────────────────────
-- `revela_oleko_missoes(talento)` é o ÚNICO lugar que decide quanto vale o quê.
-- O painel do atleta e o ranking público chamam a mesma função. Se cada um
-- tivesse a sua conta, um deles pagaria prêmio errado no primeiro ajuste de
-- regra — e o errado só apareceria depois de alguém reclamar.
-- ============================================================================


-- ─── 1. O livro-razão do que não dá pra derivar ─────────────────────────────
create table if not exists public.revela_oleko_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- Missão semanal carrega a semana no id ('insta_post:2026-W32'), que é o que
  -- faz o `unique` valer por semana em vez de pra sempre.
  mission    text not null,
  oleko      int  not null check (oleko > 0 and oleko <= 100000),
  note       text,
  created_at timestamptz not null default now(),
  unique (user_id, mission)
);

create index if not exists revela_oleko_events_user_idx
  on public.revela_oleko_events (user_id);

alter table public.revela_oleko_events enable row level security;

-- O atleta lê o próprio extrato. Ninguém escreve pelo cliente: crédito é ato de
-- servidor (`revela_oleko_grant`, sem grant pra anon/authenticated).
drop policy if exists revela_oleko_events_self_read on public.revela_oleko_events;
create policy revela_oleko_events_self_read
  on public.revela_oleko_events for select
  using (user_id = auth.uid());


-- ─── 2. As cinco divisões ───────────────────────────────────────────────────
create or replace function public.revela_oleko_divisao(p_oleko bigint)
returns jsonb
language sql
immutable
as $$
  select case
    when p_oleko >= 75000 then jsonb_build_object('id', 5, 'slug', 'campeao',   'nome', 'Campeão',   'meta', 75000, 'exp', 8000000)
    when p_oleko >= 30000 then jsonb_build_object('id', 4, 'slug', 'pro',       'nome', 'Pro',       'meta', 30000, 'exp', 2000000)
    when p_oleko >= 10000 then jsonb_build_object('id', 3, 'slug', 'sub17',     'nome', 'Sub 17',    'meta', 10000, 'exp',  500000)
    when p_oleko >=  2500 then jsonb_build_object('id', 2, 'slug', 'junior',    'nome', 'Junior',    'meta',  2500, 'exp',  250000)
    else                       jsonb_build_object('id', 1, 'slug', 'fraldinha', 'nome', 'Fraldinha', 'meta',     0, 'exp',       0)
  end;
$$;


-- ─── 3. A FÓRMULA — o catálogo de missões derivadas de um talento ───────────
create or replace function public.revela_oleko_missoes(p_talent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  t            public.revela_talents%rowtype;
  v_codigo     text;
  v_exp_game   bigint  := 0;
  v_tem_clube  boolean := false;
  v_fas        int     := 0;
  v_indicados  int     := 0;
  v_lendas     int     := 0;
begin
  select * into t from public.revela_talents where id = p_talent_id limit 1;
  if not found then
    return '[]'::jsonb;
  end if;

  if t.user_id is not null then
    select coalesce(p.exp_lifetime_earned, 0), p.my_referral_code
      into v_exp_game, v_codigo
    from public.profiles p where p.id = t.user_id;
    v_tem_clube := coalesce(v_exp_game, 0) > 0;
  end if;

  select count(*)::int into v_fas
  from public.revela_supports s where s.talent_id = t.id;

  -- Indicados: talentos que entraram com o código dele e passaram pelo scout.
  -- Cadastro não conta — aprovação exige um olheiro assistindo ao vídeo, que é
  -- a única trava que sobrevive a quem sabe fazer script.
  if v_codigo is not null then
    select
      count(*)::int,
      count(*) filter (where rt.game_situation = 'lenda')::int
      into v_indicados, v_lendas
    from public.revela_talents rt
    where rt.referral_code = v_codigo
      and rt.status in ('approved', 'carded')
      and rt.id <> t.id;
  end if;

  return jsonb_build_array(
    jsonb_build_object('id','foto',  'grupo','comece','label','Suba sua foto de perfil',
      'oleko',500,  'feita', t.portrait_url is not null),
    jsonb_build_object('id','video', 'grupo','comece','label','Suba um vídeo de 15 segundos jogando',
      'oleko',500,  'feita', t.video_url is not null),
    jsonb_build_object('id','handle','grupo','comece','label','Escolha seu @username',
      'oleko',500,  'feita', t.handle is not null),
    jsonb_build_object('id','scout', 'grupo','comece','label','Ficha avaliada pelo OLE SCOUT',
      'oleko',2000, 'feita', t.overall is not null),
    jsonb_build_object('id','clube', 'grupo','comece','label','Crie seu clube no game',
      'oleko',2500, 'feita', v_tem_clube)
  )
  -- Torcida. Os degraus baixos existem pra dar sinal de progresso na primeira
  -- semana: sem eles o primeiro marco fica a mil de distância e a barra não anda.
  || jsonb_build_object('id','fas_10',   'grupo','metas','label','10 fãs',     'oleko',  100,'alvo',   10,'atual',v_fas,'feita',v_fas >=    10)
  || jsonb_build_object('id','fas_100',  'grupo','metas','label','100 fãs',    'oleko', 2500,'alvo',  100,'atual',v_fas,'feita',v_fas >=   100)
  || jsonb_build_object('id','fas_1000', 'grupo','metas','label','1.000 fãs',  'oleko', 7500,'alvo', 1000,'atual',v_fas,'feita',v_fas >=  1000)
  || jsonb_build_object('id','fas_2500', 'grupo','metas','label','2.500 fãs',  'oleko',15000,'alvo', 2500,'atual',v_fas,'feita',v_fas >=  2500)
  || jsonb_build_object('id','fas_5000', 'grupo','metas','label','5.000 fãs',  'oleko',30000,'alvo', 5000,'atual',v_fas,'feita',v_fas >=  5000)
  || jsonb_build_object('id','fas_10000','grupo','metas','label','10.000 fãs', 'oleko',60000,'alvo',10000,'atual',v_fas,'feita',v_fas >= 10000)
  -- Rede. Lenda paga o dobro (1.250 + 1.250) porque traz a audiência dela junto.
  || jsonb_build_object('id','rede',  'grupo','metas','label','Atletas seus aprovados pelo scout',
       'oleko', 1250 * v_indicados + 1250 * v_lendas, 'atual', v_indicados, 'lendas', v_lendas, 'feita', v_indicados > 0)
  || jsonb_build_object('id','rede_5','grupo','metas','label','Bônus: 5 atletas aprovados na sua rede',
       'oleko',10000,'alvo',5,'atual',v_indicados,'feita', v_indicados >= 5)
  || jsonb_build_object('id','card',  'grupo','metas','label','Seu card jogável foi lançado',
       'oleko',10000,'feita', t.status = 'carded');
end;
$$;


-- ─── 4. Total = derivado cumprido + creditado ───────────────────────────────
create or replace function public.revela_oleko_total(p_talent_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce((
      select sum((m ->> 'oleko')::bigint)
      from jsonb_array_elements(public.revela_oleko_missoes(p_talent_id)) m
      where (m ->> 'feita')::boolean
    ), 0)
    +
    coalesce((
      select sum(e.oleko)
      from public.revela_oleko_events e
      join public.revela_talents rt on rt.user_id = e.user_id
      where rt.id = p_talent_id
    ), 0);
$$;


-- ─── 5. O painel do atleta ──────────────────────────────────────────────────
-- Devolve TUDO numa chamada: total, divisão, chave e o estado de cada missão.
-- Uma ida ao banco — é a tela que mais abre no celular, em 4G de vestiário.
create or replace function public.revela_my_trajetoria()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  t           public.revela_talents%rowtype;
  v_missoes   jsonb;
  v_oleko     bigint;
  v_creditado bigint := 0;
  v_div       jsonb;
  v_prox      jsonb;
  v_fas       int := 0;
  v_exp_game  bigint := 0;
begin
  select * into t from public.revela_talents
  where user_id = auth.uid() and status <> 'rejected'
  limit 1;

  if not found then
    return null;  -- conta sem ficha: a tela mostra o convite, não a Trajetória
  end if;

  v_missoes := public.revela_oleko_missoes(t.id);
  v_oleko   := public.revela_oleko_total(t.id);

  select coalesce(sum(e.oleko), 0) into v_creditado
  from public.revela_oleko_events e where e.user_id = auth.uid();

  select count(*)::int into v_fas
  from public.revela_supports s where s.talent_id = t.id;

  select coalesce(p.exp_lifetime_earned, 0) into v_exp_game
  from public.profiles p where p.id = auth.uid();

  v_div  := public.revela_oleko_divisao(v_oleko);
  v_prox := case
    when (v_div ->> 'id')::int >= 5 then null
    else public.revela_oleko_divisao(
      case (v_div ->> 'id')::int
        when 1 then 2500 when 2 then 10000 when 3 then 30000 else 75000 end)
  end;

  return jsonb_build_object(
    'oleko',     v_oleko,
    'creditado', v_creditado,
    'divisao',   v_div,
    'proxima',   v_prox,
    -- A chave em que ele corre. Sem situação declarada, cai na dos novos
    -- talentos: é a mais protegida, e errar pra proteger é o lado certo.
    'chave',     coalesce(t.game_situation, 'escolinha'),
    'fas',       v_fas,
    'indicados', coalesce((select (m ->> 'atual')::int from jsonb_array_elements(v_missoes) m where m ->> 'id' = 'rede'), 0),
    'lendas',    coalesce((select (m ->> 'lendas')::int from jsonb_array_elements(v_missoes) m where m ->> 'id' = 'rede'), 0),
    'temClube',  coalesce(v_exp_game, 0) > 0,
    'expGame',   v_exp_game,
    'slug',      t.slug,
    'missoes',   v_missoes
  );
end;
$$;


-- ─── 6. O ranking público, por chave ────────────────────────────────────────
-- Sem placar não existe campanha — existe lista de tarefas. E ele é POR CHAVE
-- porque uma lenda com 40 mil seguidores junta mil fãs numa tarde, enquanto um
-- moleque de 14 anos junta trinta em duas semanas. No mesmo ranking o segundo
-- desiste na primeira olhada, e ele é quem a campanha existe pra atrair.
--
-- Só campo público — mesma lista branca da vitrine, nada de contato.
create or replace function public.revela_trajetoria_ranking(
  p_chave text default null,
  p_limit int  default 20
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(x.payload order by x.pos), '[]'::jsonb)
  from (
    select
      jsonb_build_object(
        'pos',      row_number() over (order by q.oleko desc, q.created_at asc),
        'slug',     q.slug,
        'name',     q.name,
        'portrait', q.portrait,
        'chave',    q.chave,
        'oleko',    q.oleko,
        'fas',      q.fas,
        'divisao',  public.revela_oleko_divisao(q.oleko)
      ) as payload,
      row_number() over (order by q.oleko desc, q.created_at asc) as pos
    from (
      select
        rt.slug,
        coalesce(nullif(rt.nickname, ''), rt.name) as name,
        rt.portrait_url                            as portrait,
        coalesce(rt.game_situation, 'escolinha')   as chave,
        public.revela_oleko_total(rt.id)           as oleko,
        (select count(*)::int from public.revela_supports s where s.talent_id = rt.id) as fas,
        rt.created_at
      from public.revela_talents rt
      where rt.status in ('approved', 'carded')
        and (p_chave is null or coalesce(rt.game_situation, 'escolinha') = p_chave)
    ) q
    order by q.oleko desc, q.created_at asc
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  ) x;
$$;


-- ─── 7. Crédito manual (Instagram, pódio da semana) ─────────────────────────
-- SEM grant: só service role. O painel do OLE SCOUT chama pelo servidor, do
-- mesmo jeito que já chama a fila de aprovação. Crédito nascido no cliente é
-- crédito replicável no console do navegador.
create or replace function public.revela_oleko_grant(
  p_user_id uuid,
  p_mission text,
  p_oleko   int,
  p_note    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or coalesce(trim(p_mission), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'params');
  end if;
  if p_oleko is null or p_oleko <= 0 or p_oleko > 100000 then
    return jsonb_build_object('ok', false, 'reason', 'valor');
  end if;

  insert into public.revela_oleko_events (user_id, mission, oleko, note)
  values (p_user_id, trim(p_mission), p_oleko, nullif(trim(coalesce(p_note, '')), ''))
  on conflict (user_id, mission) do nothing;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'ja_creditado');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;


-- ─── Grants ─────────────────────────────────────────────────────────────────
grant execute on function public.revela_oleko_divisao(bigint)              to anon, authenticated;
grant execute on function public.revela_trajetoria_ranking(text, int)      to anon, authenticated;
grant execute on function public.revela_my_trajetoria()                    to authenticated;
-- `revela_oleko_missoes` e `revela_oleko_total` só existem pra servir as duas
-- acima. Expor daria a qualquer um a ficha completa de qualquer atleta.
revoke all on function public.revela_oleko_missoes(uuid)                   from public, anon, authenticated;
revoke all on function public.revela_oleko_total(uuid)                     from public, anon, authenticated;
revoke all on function public.revela_oleko_grant(uuid, text, int, text)    from public, anon, authenticated;


-- ─── Verificação ────────────────────────────────────────────────────────────
--   select public.revela_trajetoria_ranking(null, 10);       -- placar geral
--   select public.revela_trajetoria_ranking('escolinha', 10);-- por chave
--   select public.revela_my_trajetoria();                    -- logado como atleta
