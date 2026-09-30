-- ═══════════════════════════════════════════════════════════════════════════
-- LICENÇA — ativa a conta na expansão sem comprar OLEFOOT
--
-- Pedido do fundador (2026-09-30): "contas que eu posso gerar uma licença e ao
-- serem usadas, ativam a conta porém não geram OLEFOOT, só habilita no plano de
-- equiparação".
--
-- É a TERCEIRA fonte de ativação, ao lado do pack pago e da ativação da casa, e
-- segue a mesma regra que a da casa estabeleceu: ativação sem dinheiro NÃO vira
-- linha em `presale_purchase`. O que a licença faz e o que ela não faz:
--
--   FAZ     · põe a conta na árvore (se ainda não estiver), com origem 'licenca';
--           · libera o convite (`expansao_pode_convidar_interno`);
--           · a conta conta como indicado direto de quem a patrocina — é uma
--             pessoa real na árvore, então vale pra regra "1 em cada time".
--   NÃO FAZ · nenhum OLEFOOT, nenhuma posição na pré-venda, nenhum BRO;
--           · nenhum OLEXP e nenhum volume de perna pra ninguém acima;
--           · nenhuma receita — o pool do ciclo é 25% do que ENTROU.
--
-- 🔒 O código não fica guardado, só o sha256 dele. Quem gera vê o código UMA
-- vez (e baixa a lista); quem lê a tabela depois não consegue usar nenhum.
-- Código perdido se revoga e se gera outro.
--
-- 🔒 12 caracteres de um alfabeto de 30 (sem 0/O, 1/I/L, U) ≈ 59 bits. Chute
-- não acha; mesmo assim, 10 erros na última hora travam a conta que tenta.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.expansao_licenca (
  id               bigserial primary key,
  codigo_hash      text not null unique,
  -- Os 4 últimos caracteres, pra achar a licença na lista sem guardar o código.
  final            text not null check (final ~ '^[2-9A-HJKMNP-TV-Z]{4}$'),
  lote             text not null check (length(trim(lote)) between 1 and 80),
  -- Opcional. Com patrocinador, a conta entra debaixo dele; sem, sobe a
  -- indicação do jogo como na compra, e na falta de todos, a ORIGEM.
  patrocinador_id  uuid references auth.users(id) on delete restrict,
  expira_em        timestamptz,
  criada_por       text not null,
  criada_em        timestamptz not null default now(),
  -- Uma licença ativa uma conta; uma conta usa uma licença.
  usada_por        uuid unique references auth.users(id) on delete restrict,
  usada_em         timestamptz,
  revogada_em      timestamptz,
  revogada_por     text,
  motivo_revogacao text,
  constraint expansao_licenca_uso_coerente check ((usada_por is null) = (usada_em is null)),
  constraint expansao_licenca_revogacao_coerente check ((revogada_em is null) = (revogada_por is null))
);
create index if not exists expansao_licenca_lote on public.expansao_licenca (lote, criada_em desc);

alter table public.expansao_licenca enable row level security;
-- Cada um lê a SUA licença (a tela diz "ativada por licença"). A lista inteira
-- só pelo servidor, com o gate de admin.
drop policy if exists expansao_licenca_propria on public.expansao_licenca;
create policy expansao_licenca_propria on public.expansao_licenca
  for select to authenticated using (usada_por = auth.uid());

-- Tentativas erradas, por conta. Só erro entra aqui.
create table if not exists public.expansao_licenca_tentativa (
  id       bigserial primary key,
  user_id  uuid not null references auth.users(id) on delete cascade,
  em       timestamptz not null default now()
);
create index if not exists expansao_licenca_tentativa_user on public.expansao_licenca_tentativa (user_id, em desc);
alter table public.expansao_licenca_tentativa enable row level security;

-- ─── a origem da entrada ganha 'licenca' ──────────────────────────────────
alter table public.expansao_confirmacao drop constraint if exists expansao_confirmacao_origem_check;
alter table public.expansao_confirmacao add constraint expansao_confirmacao_origem_check
  check (origem in ('convite', 'compra', 'licenca'));

-- ─── pode convidar: a terceira fonte ──────────────────────────────────────
-- Licença revogada deixa de ativar. A posição na árvore fica — é permanente.
create or replace function public.expansao_pode_convidar_interno(p_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from presale_purchase
            where user_id = p_user and status = 'pago' and usd_cents >= 1000)
      or exists (select 1 from expansao_ativacao_casa where user_id = p_user)
      or exists (select 1 from expansao_licenca
                  where usada_por = p_user and revogada_em is null);
$$;
revoke all on function public.expansao_pode_convidar_interno(uuid) from public, anon, authenticated;
grant execute on function public.expansao_pode_convidar_interno(uuid) to service_role;

-- ─── código: forma e hash ─────────────────────────────────────────────────
-- Aceita o que a pessoa cola: minúscula, espaço, hífen, o prefixo OLE, e as
-- trocas clássicas de quem digita (O→0 não existe no alfabeto, então O e 0
-- viram erro; I/L → 1 idem). Devolve os 12 caracteres, ou null.
create or replace function public.expansao_licenca_normalizar(p_codigo text)
returns text language sql immutable set search_path = public
as $$
  select case when c ~ '^[2-9A-HJKMNP-TV-Z]{12}$' then c end
    from (select case when length(s) = 15 and left(s, 3) = 'OLE' then substr(s, 4) else s end as c
            from (select regexp_replace(upper(coalesce(p_codigo, '')), '[^A-Z0-9]', '', 'g') as s) a) b;
$$;
revoke all on function public.expansao_licenca_normalizar(text) from public, anon, authenticated;
grant execute on function public.expansao_licenca_normalizar(text) to service_role;

create or replace function public.expansao_licenca_hash(p_normalizado text)
returns text language sql immutable set search_path = public
as $$
  select encode(extensions.digest('olefoot-licenca:' || p_normalizado, 'sha256'), 'hex');
$$;
revoke all on function public.expansao_licenca_hash(text) from public, anon, authenticated;
grant execute on function public.expansao_licenca_hash(text) to service_role;

-- ─── gerar (só o servidor, atrás do gate de admin) ────────────────────────
create or replace function public.expansao_licenca_gerar(
  p_quantidade integer, p_lote text, p_patrocinador uuid, p_expira_em timestamptz, p_criada_por text
) returns table (licenca_id bigint, codigo text)
language plpgsql security definer set search_path = public
as $$
declare
  v_alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_i integer;
  v_c text;
  v_b integer;
  v_bytes bytea;
  v_k integer;
  v_id bigint;
begin
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 500 then
    raise exception 'LICENCA_QUANTIDADE: de 1 a 500 por lote, veio %', p_quantidade;
  end if;
  if p_lote is null or length(trim(p_lote)) not between 1 and 80 then
    raise exception 'LICENCA_LOTE: o lote precisa de um nome (até 80 caracteres)';
  end if;
  if p_criada_por is null or length(trim(p_criada_por)) = 0 then
    raise exception 'LICENCA_AUTOR: quem gerou tem que ficar escrito';
  end if;
  if p_expira_em is not null and p_expira_em <= now() then
    raise exception 'LICENCA_VALIDADE: a validade já passou';
  end if;
  -- Patrocinador tem que poder receber: estar na árvore e estar ativado.
  if p_patrocinador is not null and (
       not exists (select 1 from expansao_no where user_id = p_patrocinador)
       or not public.expansao_pode_convidar_interno(p_patrocinador)) then
    raise exception 'LICENCA_PATROCINADOR: o patrocinador não está na árvore ou não está ativado';
  end if;

  for v_i in 1..p_quantidade loop
    loop
      v_c := '';
      -- Rejeição: byte >= 240 volta pro sorteio, senão o módulo 30 viciaria
      -- os 16 primeiros caracteres.
      while length(v_c) < 12 loop
        v_bytes := extensions.gen_random_bytes(16);
        for v_k in 0..15 loop
          v_b := get_byte(v_bytes, v_k);
          if v_b < 240 and length(v_c) < 12 then
            v_c := v_c || substr(v_alfabeto, (v_b % 30) + 1, 1);
          end if;
        end loop;
      end loop;
      begin
        insert into expansao_licenca (codigo_hash, final, lote, patrocinador_id, expira_em, criada_por)
        values (public.expansao_licenca_hash(v_c), right(v_c, 4), trim(p_lote), p_patrocinador,
                p_expira_em, trim(p_criada_por))
        returning id into v_id;
        exit;
      exception when unique_violation then
        null; -- colisão de 59 bits: sorteia de novo
      end;
    end loop;
    licenca_id := v_id;
    codigo := 'OLE-' || substr(v_c, 1, 4) || '-' || substr(v_c, 5, 4) || '-' || substr(v_c, 9, 4);
    return next;
  end loop;
end;
$$;
revoke all on function public.expansao_licenca_gerar(integer, text, uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.expansao_licenca_gerar(integer, text, uuid, timestamptz, text) to service_role;

-- ─── resgatar (a própria pessoa) ──────────────────────────────────────────
create or replace function public.expansao_resgatar_licenca(p_codigo text)
returns table (ativou boolean, motivo text, patrocinador text)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_norm text;
  v_lic record;
  v_pat uuid;
  v_r record;
  v_pat_username text;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;

  if (select count(*) from expansao_licenca_tentativa t
       where t.user_id = v_uid and t.em > now() - interval '1 hour') >= 10 then
    return query select false, 'muitas_tentativas'::text, null::text; return;
  end if;

  v_norm := public.expansao_licenca_normalizar(p_codigo);
  if v_norm is not null then
    select * into v_lic from expansao_licenca l
     where l.codigo_hash = public.expansao_licenca_hash(v_norm)
     for update;
  end if;
  if v_norm is null or v_lic.id is null then
    insert into expansao_licenca_tentativa (user_id) values (v_uid);
    return query select false, 'licenca_invalida'::text, null::text; return;
  end if;

  if v_lic.revogada_em is not null then
    return query select false, 'licenca_revogada'::text, null::text; return; end if;
  if v_lic.usada_por = v_uid then
    return query select false, 'ja_ativada_por_esta_licenca'::text, null::text; return; end if;
  if v_lic.usada_por is not null then
    return query select false, 'licenca_ja_usada'::text, null::text; return; end if;
  if v_lic.expira_em is not null and v_lic.expira_em <= now() then
    return query select false, 'licenca_expirada'::text, null::text; return; end if;
  -- Quem já está ativado não gasta licença: ela vale pra outra pessoa.
  if public.expansao_pode_convidar_interno(v_uid) then
    return query select false, 'conta_ja_ativada'::text, null::text; return; end if;

  if not exists (select 1 from expansao_no n where n.user_id = v_uid) then
    if v_lic.patrocinador_id is not null
       and v_lic.patrocinador_id <> v_uid
       and public.expansao_pode_convidar_interno(v_lic.patrocinador_id) then
      v_pat := v_lic.patrocinador_id;
      select * into v_r from public.expansao_entrar(v_uid, v_pat);
      if not v_r.entrou then
        return query select false, v_r.motivo, null::text; return; end if;
      select p.username into v_pat_username from profiles p where p.id = v_pat;
      insert into expansao_confirmacao (user_id, patrocinador_id, username_convite, origem)
      values (v_uid, v_pat, coalesce(v_pat_username, 'origem'), 'licenca')
      on conflict (user_id) do nothing;
    else
      -- Sem patrocinador na licença (ou ele perdeu a ativação): o mesmo
      -- caminho de quem compra sem convite — sobe a indicação do jogo, e na
      -- falta, a ORIGEM. A função grava 'compra'; aqui vira 'licenca'.
      select * into v_r from public.expansao_entrar_por_compra(v_uid);
      if not v_r.entrou then
        return query select false, v_r.motivo, null::text; return; end if;
      v_pat := v_r.patrocinador;
      update expansao_confirmacao c set origem = 'licenca' where c.user_id = v_uid;
      select p.username into v_pat_username from profiles p where p.id = v_pat;
    end if;
  end if;

  update expansao_licenca l set usada_por = v_uid, usada_em = now() where l.id = v_lic.id;

  return query select true, null::text, v_pat_username;
end;
$$;
revoke all on function public.expansao_resgatar_licenca(text) from public, anon;
grant execute on function public.expansao_resgatar_licenca(text) to authenticated, service_role;

-- ─── revogar (só o servidor) ──────────────────────────────────────────────
-- Antes do uso: a licença morre. Depois do uso: a conta perde a ativação (não
-- convida mais), mas continua na árvore onde está.
create or replace function public.expansao_licenca_revogar(p_id bigint, p_por text, p_motivo text)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if p_por is null or length(trim(p_por)) = 0 then
    raise exception 'LICENCA_AUTOR: quem revogou tem que ficar escrito';
  end if;
  update expansao_licenca l
     set revogada_em = now(), revogada_por = trim(p_por), motivo_revogacao = nullif(trim(coalesce(p_motivo, '')), '')
   where l.id = p_id and l.revogada_em is null;
  return found;
end;
$$;
revoke all on function public.expansao_licenca_revogar(bigint, text, text) from public, anon, authenticated;
grant execute on function public.expansao_licenca_revogar(bigint, text, text) to service_role;

-- ─── listar (só o servidor) ───────────────────────────────────────────────
create or replace function public.expansao_licenca_listar(p_limite integer default 200)
returns table (
  licenca_id bigint, final text, lote text, patrocinador text, expira_em timestamptz,
  criada_por text, criada_em timestamptz, usada_por text, usada_em timestamptz,
  revogada_em timestamptz, motivo_revogacao text, situacao text
) language sql stable security definer set search_path = public
as $$
  select l.id, l.final, l.lote, pp.username, l.expira_em, l.criada_por, l.criada_em,
         pu.username, l.usada_em, l.revogada_em, l.motivo_revogacao,
         case when l.revogada_em is not null then 'revogada'
              when l.usada_por is not null then 'usada'
              when l.expira_em is not null and l.expira_em <= now() then 'expirada'
              else 'livre' end
    from expansao_licenca l
    left join profiles pp on pp.id = l.patrocinador_id
    left join profiles pu on pu.id = l.usada_por
   order by l.criada_em desc, l.id desc
   limit least(greatest(coalesce(p_limite, 200), 1), 1000);
$$;
revoke all on function public.expansao_licenca_listar(integer) from public, anon, authenticated;
grant execute on function public.expansao_licenca_listar(integer) to service_role;

comment on table public.expansao_licenca is
  'Licenças de ativação da expansão. Ativam sem compra: sem OLEFOOT, sem OLEXP,
   sem receita. Guarda só o sha256 do código.';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — resgate REAL num savepoint que termina em raise. Nada fica.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_chegou boolean := false;
  v_user uuid;
  v_raiz uuid;
  v_codigo text;
  v_id bigint;
  v_r record;
  v_antes numeric;
  v_n numeric;
begin
  -- As portas: o cliente só resgata. Gerar, revogar e listar é do servidor.
  if has_function_privilege('authenticated', 'public.expansao_licenca_gerar(integer,text,uuid,timestamptz,text)', 'execute')
     or has_function_privilege('anon', 'public.expansao_licenca_gerar(integer,text,uuid,timestamptz,text)', 'execute')
     or has_function_privilege('authenticated', 'public.expansao_licenca_revogar(bigint,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.expansao_licenca_listar(integer)', 'execute')
     or has_function_privilege('anon', 'public.expansao_resgatar_licenca(text)', 'execute')
     or has_function_privilege('authenticated', 'public.expansao_pode_convidar_interno(uuid)', 'execute') then
    raise exception 'uma função de licença ficou aberta a quem não devia';
  end if;
  if public.expansao_licenca_normalizar(' ole-abcd-efgh-jkmn ') is distinct from 'ABCDEFGHJKMN' then
    raise exception 'a normalização não aceitou o código colado';
  end if;
  if public.expansao_licenca_normalizar('OLE-ABCD-EFGH-JKM0') is not null then
    raise exception 'a normalização aceitou um caractere fora do alfabeto';
  end if;

  select user_id into v_raiz from public.expansao_no
   where pai_id is null order by criado_em, y_ordem limit 1;
  select p.id into v_user from public.profiles p
   where not exists (select 1 from public.expansao_no n where n.user_id = p.id)
     and not exists (select 1 from public.presale_purchase c where c.user_id = p.id)
     and not exists (select 1 from public.expansao_ativacao_casa a where a.user_id = p.id)
     and exists (select 1 from auth.users u where u.id = p.id)
   limit 1;
  if v_user is null or v_raiz is null then
    raise notice 'sem conta livre ou sem raiz neste ambiente: verificação do resgate pulada';
    return;
  end if;

  begin
    select g.licenca_id, g.codigo into v_id, v_codigo
      from public.expansao_licenca_gerar(1, 'verifica', null, null, 'verifica') g;
    if v_codigo !~ '^OLE-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$' then
      raise exception 'código fora do formato: %', v_codigo;
    end if;
    if exists (select 1 from public.expansao_licenca where id = v_id and codigo_hash like '%' || v_codigo || '%') then
      raise exception 'o código ficou guardado em claro';
    end if;

    select coalesce(sum(volume), 0) into v_antes from public.expansao_perna;

    perform set_config('request.jwt.claims',
      json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

    select * into v_r from public.expansao_resgatar_licenca('OLE-2222-2222-2222');
    if v_r.ativou or v_r.motivo <> 'licenca_invalida' then
      raise exception 'código errado: esperava licenca_invalida, veio %', v_r.motivo;
    end if;

    select * into v_r from public.expansao_resgatar_licenca(lower(v_codigo));
    if not v_r.ativou then raise exception 'o resgate falhou: %', v_r.motivo; end if;

    -- Sem patrocinador na licença: sobe a indicação do jogo ou cai na ORIGEM.
    -- O caminho com patrocinador é provado no teste (test:licenca-expansao).
    if not exists (select 1 from public.expansao_no where user_id = v_user) then
      raise exception 'a licença não pôs a conta na árvore';
    end if;
    if not exists (select 1 from public.expansao_confirmacao where user_id = v_user and origem = 'licenca') then
      raise exception 'a entrada não ficou registrada como licença';
    end if;
    if not public.expansao_pode_convidar_interno(v_user) then
      raise exception 'a licença não liberou o convite';
    end if;
    if exists (select 1 from public.presale_purchase where user_id = v_user)
       or exists (select 1 from public.presale_position where user_id = v_user and tokens_totais > 0)
       or exists (select 1 from public.expansao_olexp where user_id = v_user) then
      raise exception 'a licença gerou compra, posição ou OLEXP';
    end if;
    select coalesce(sum(volume), 0) into v_n from public.expansao_perna;
    if v_n <> v_antes then raise exception 'a licença mexeu no volume de alguma perna'; end if;

    select * into v_r from public.expansao_resgatar_licenca(v_codigo);
    if v_r.ativou or v_r.motivo <> 'ja_ativada_por_esta_licenca' then
      raise exception 'resgate repetido: veio %', v_r.motivo;
    end if;

    perform set_config('request.jwt.claims', '', true);
    if not public.expansao_licenca_revogar(v_id, 'verifica', 'teste') then
      raise exception 'a revogação não pegou';
    end if;
    if public.expansao_pode_convidar_interno(v_user) then
      raise exception 'licença revogada continuou ativando';
    end if;
    if not exists (select 1 from public.expansao_no where user_id = v_user) then
      raise exception 'a revogação tirou a conta da árvore — posição é permanente';
    end if;

    v_chegou := true;
    raise exception 'DESFAZ_A_VERIFICACAO';
  exception when others then
    if sqlerrm <> 'DESFAZ_A_VERIFICACAO' then raise; end if;
  end;

  perform set_config('request.jwt.claims', '', true);
  if not v_chegou then raise exception 'a verificação não chegou ao fim'; end if;
  if exists (select 1 from public.expansao_no where user_id = v_user)
     or exists (select 1 from public.expansao_licenca where lote = 'verifica') then
    raise exception 'a verificação deixou rastro';
  end if;
end $$;
