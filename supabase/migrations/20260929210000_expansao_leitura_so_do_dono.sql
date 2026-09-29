-- ═══════════════════════════════════════════════════════════════════════════
-- EXPANSÃO — a leitura da rede é só do dono
--
-- 🔴 O furo, medido em produção em 2026-09-29: `expansao_mapa`,
-- `expansao_ativacao`, `expansao_carreira` e `expansao_pode_convidar` são
-- SECURITY DEFINER, executáveis por `authenticated`, e recebem como PARÂMETRO
-- o id de quem vai ser consultado. Nenhuma conferia `auth.uid()`. Qualquer
-- conta logada lia a árvore, a ativação e a carreira de qualquer outra:
-- bastava trocar o uuid na chamada.
--
-- Não vazava nome (o mapa devolve uuid e posição), mas vazava a FORMA da rede
-- de cada um — quem tem perna, de que tamanho, quem já ativou. Numa rede que
-- paga por equiparação isso é informação de negócio, e ela é do dono.
--
-- 🔑 Por que o conserto mantém a assinatura em vez de tirar o parâmetro: a
-- tela que está no ar chama `rpc('expansao_mapa', { p_raiz: meu_id })`. Trocar
-- a assinatura quebraria o painel entre esta migration e o próximo deploy do
-- Cloudflare. Então o parâmetro fica, e passa a valer só quando é o do próprio
-- chamador. Quem pede o de outro recebe VAZIO — não erro, pra tela antiga não
-- estourar.
--
-- ⚠️ `expansao_pode_convidar` é chamada POR DENTRO com o id de outra pessoa,
-- e de propósito: confirmar um convite pergunta se o PATROCINADOR pode
-- convidar. Pôr a trava nela quebraria o convite. Por isso ela se divide:
--   `expansao_pode_convidar_interno` — sem trava, só o servidor e as funções
--   `expansao_pode_convidar`         — a que a tela chama, com trava
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── quem pode ler a rede de quem ─────────────────────────────────────────
-- Três casos, e a ordem importa:
--   1. há usuário logado  → só o próprio id
--   2. não há, e o papel do JWT é service_role → o servidor lê qualquer um
--   3. não há JWT nenhum  → conexão direta no banco (cron, migration, MCP), que
--      já enxerga as tabelas inteiras; barrar aqui não protegeria nada
-- `anon` cai fora nos três: tem JWT, não tem usuário, e o papel não é o do
-- servidor.
create or replace function public.expansao_acesso(p_user uuid)
returns boolean language sql stable set search_path = public
as $$
  select case
    when auth.uid() is not null then p_user = auth.uid()
    else coalesce(auth.jwt() ->> 'role', 'direto') in ('service_role', 'direto')
  end;
$$;

revoke all on function public.expansao_acesso(uuid) from public, anon;
grant execute on function public.expansao_acesso(uuid) to authenticated, service_role;

-- ─── pode convidar: a versão de dentro e a da tela ────────────────────────
create or replace function public.expansao_pode_convidar_interno(p_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from presale_purchase
            where user_id = p_user and status = 'pago' and usd_cents >= 1000)
      or exists (select 1 from expansao_ativacao_casa where user_id = p_user);
$$;

-- 🔴 O Supabase dá EXECUTE a anon e authenticated em função nova por DEFAULT
-- PRIVILEGES. Sem o revoke nominal abaixo a trava da versão pública seria
-- contornada chamando esta direto.
revoke all on function public.expansao_pode_convidar_interno(uuid) from public, anon, authenticated;
grant execute on function public.expansao_pode_convidar_interno(uuid) to service_role;

create or replace function public.expansao_pode_convidar(p_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.expansao_acesso(p_user)
     and public.expansao_pode_convidar_interno(p_user);
$$;

create or replace function public.expansao_convite_de(p_username text)
returns table (username text, existe boolean, pode_convidar boolean)
language sql stable security definer set search_path = public
as $$
  select coalesce(p.username, lower(trim(p_username))),
         (p.id is not null),
         coalesce(public.expansao_pode_convidar_interno(p.id), false)
    from (select 1) z
    left join public.profiles p on lower(p.username) = lower(trim(p_username));
$$;

create or replace function public.expansao_confirmar_convite(p_username text)
returns table (entrou boolean, motivo text, patrocinador text)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pat uuid;
  v_pat_username text;
  v_r record;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;

  select id, username into v_pat, v_pat_username
    from profiles where lower(username) = lower(trim(p_username));
  if v_pat is null then
    return query select false, 'convite_inexistente', null::text; return; end if;
  if v_pat = v_uid then
    return query select false, 'auto_convite', v_pat_username; return; end if;
  if exists (select 1 from expansao_no where user_id = v_uid) then
    return query select false, 'ja_esta_na_expansao', v_pat_username; return; end if;

  -- A trava de ativação. Sem pack de $10 pago, o convite não vale.
  if not public.expansao_pode_convidar_interno(v_pat) then
    return query select false, 'convite_nao_ativado', v_pat_username; return; end if;

  -- Patrocinador precisa estar na árvore. Se ativou e ainda não entrou, é
  -- estado inconsistente do lado dele — e a pessoa não pode pagar por isso.
  if not exists (select 1 from expansao_no where user_id = v_pat) then
    return query select false, 'patrocinador_fora_da_arvore', v_pat_username; return; end if;

  select * into v_r from public.expansao_entrar(v_uid, v_pat);
  if not v_r.entrou then
    return query select false, v_r.motivo, v_pat_username; return; end if;

  insert into expansao_confirmacao (user_id, patrocinador_id, username_convite)
  values (v_uid, v_pat, v_pat_username)
  on conflict (user_id) do nothing;

  return query select true, null::text, v_pat_username;
end;
$$;

-- ─── as três leituras do painel ───────────────────────────────────────────
create or replace function public.expansao_mapa(
  p_raiz uuid, p_de integer default 1, p_ate integer default 5
) returns table (
  user_id uuid, nivel integer, y_ordem bigint, perna smallint,
  da_minha_equipe boolean, pai_id uuid
) language sql stable security definer set search_path = public
as $$
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
   where public.expansao_acesso(p_raiz)
     and p_raiz = any(n.posicao_path)
     and n.nivel - (select nivel from expansao_no r where r.user_id = p_raiz)
         between greatest(p_de, 1) and p_ate
   order by n.nivel, n.y_ordem;
$$;

create or replace function public.expansao_ativacao(p_user uuid)
returns table (ativo boolean, diretos_t1 integer, diretos_t2 integer, falta_na_perna smallint)
language sql stable security definer set search_path = public
as $$
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
    from c
   where public.expansao_acesso(p_user);
$$;

create or replace function public.expansao_carreira(p_user uuid)
returns table (equiparado_acumulado numeric, degrau text, proximo text, falta numeric)
language sql stable security definer set search_path = public
as $$
  with a as (
    select coalesce((select equiparado_acumulado from expansao_no where user_id = p_user), 0) as v
  ), d(nome, exige) as (
    values ('CAMPEAO', 10000::numeric), ('DUPLO_CAMPEAO', 50000), ('TRI_CAMPEAO', 100000),
           ('TETRA', 250000), ('PENTA', 500000)
  )
  select (select v from a),
         (select nome from d where exige <= (select v from a) order by exige desc limit 1),
         (select nome from d where exige >  (select v from a) order by exige asc  limit 1),
         coalesce((select exige - (select v from a) from d
                    where exige > (select v from a) order by exige asc limit 1), 0)
   where public.expansao_acesso(p_user);
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — roda junto e derruba tudo se falhar
-- ════════════════════════════════════════════════════════════════════════════
-- Loga como um ESTRANHO e pede a rede de alguém que existe; depois loga como o
-- dono e pede a própria. O estranho tem que receber vazio e o dono, não.
-- `set_config(..., true)` vale só nesta transação.
do $$
declare
  v_alvo uuid;
  v_n integer;
begin
  select user_id into v_alvo from public.expansao_no order by criado_em limit 1;
  if v_alvo is null then
    raise notice 'árvore vazia neste ambiente: a verificação de dono não tem quem consultar';
    return;
  end if;

  -- 1. um estranho logado
  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);

  select count(*) into v_n from public.expansao_ativacao(v_alvo);
  if v_n <> 0 then raise exception 'estranho leu a ATIVAÇÃO de outra conta'; end if;
  select count(*) into v_n from public.expansao_carreira(v_alvo);
  if v_n <> 0 then raise exception 'estranho leu a CARREIRA de outra conta'; end if;
  select count(*) into v_n from public.expansao_mapa(v_alvo, 1, 50);
  if v_n <> 0 then raise exception 'estranho leu o MAPA de outra conta (% nós)', v_n; end if;
  if public.expansao_pode_convidar(v_alvo) then
    raise exception 'estranho leu se outra conta PODE CONVIDAR';
  end if;

  -- 2. o dono
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_alvo, 'role', 'authenticated')::text, true);

  select count(*) into v_n from public.expansao_ativacao(v_alvo);
  if v_n <> 1 then raise exception 'o dono NÃO leu a própria ativação (% linhas)', v_n; end if;
  select count(*) into v_n from public.expansao_carreira(v_alvo);
  if v_n <> 1 then raise exception 'o dono NÃO leu a própria carreira (% linhas)', v_n; end if;
  if public.expansao_pode_convidar(v_alvo)
     is distinct from public.expansao_pode_convidar_interno(v_alvo) then
    raise exception 'a versão da tela e a de dentro discordam para o próprio dono';
  end if;

  -- 3. visitante sem login: a tela do convite continua abrindo
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  if public.expansao_pode_convidar(v_alvo) then
    raise exception 'anon leu se uma conta pode convidar pela função da tela';
  end if;

  perform set_config('request.jwt.claims', '', true);

  if has_function_privilege('authenticated', 'public.expansao_pode_convidar_interno(uuid)', 'execute')
     or has_function_privilege('anon', 'public.expansao_pode_convidar_interno(uuid)', 'execute') then
    raise exception 'a versão de dentro ficou executável pelo cliente';
  end if;
end $$;
