-- ═══════════════════════════════════════════════════════════════════════════
-- QUEM TE INDICOU — a compra respeita o indicador que a pessoa declarou
--
-- Decisão do fundador (2026-10-02), depois da 1ª venda real cair na ORIGEM:
--   · novos cadastros: respeitar o link de indicação;
--   · quem já tem conta: o checkout pergunta "quem te indicou?";
--   · quem se cadastrou por link: o checkout já chega preenchido.
--
-- O furo: `expansao_entrar_por_compra` só subia pelo código de cadastro
-- (`referred_by_code`). O do @tiago_tri (MWMTK5T6) não pertencia a ninguém, ele
-- comprou sem abrir o convite e caiu sob a ORIGEM — precisou de correção manual.
--
-- O que muda:
--   · `expansao_patrocinador_escolhido` — o @ que a PRÓPRIA pessoa declarou no
--     checkout (ato dela, via auth.uid(); ninguém escolhe por outro);
--   · `expansao_entrar_por_compra` passa a usar, na ordem:
--       1. o patrocinador escolhido, se ainda válido (na árvore e ativado);
--       2. a cadeia do código de cadastro (como antes);
--       3. a ORIGEM (como antes);
--   · `expansao_meu_indicador()` — a sugestão que pré-preenche o checkout;
--   · `codigo_de_indicacao_de(username)` — pra página de convite mandar o
--     cadastro novo pra `/cadastro/<código>`, gravando quem indicou.
--
-- Quem já está na árvore não muda: posição é permanente.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.expansao_patrocinador_escolhido (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  patrocinador_id uuid not null references auth.users(id) on delete restrict,
  escolhido_em    timestamptz not null default now(),
  constraint expansao_patrocinador_escolhido_nao_a_si check (patrocinador_id <> user_id)
);
alter table public.expansao_patrocinador_escolhido enable row level security;
drop policy if exists expansao_patrocinador_escolhido_proprio on public.expansao_patrocinador_escolhido;
create policy expansao_patrocinador_escolhido_proprio on public.expansao_patrocinador_escolhido
  for select to authenticated using (user_id = auth.uid());

-- ─── declarar (ou limpar) quem me indicou ─────────────────────────────────
-- p_username null/vazio = "ninguém me indicou": apaga a escolha.
create or replace function public.expansao_escolher_patrocinador(p_username text)
returns table (ok boolean, motivo text, patrocinador text)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pat uuid;
  v_nome text;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;
  if exists (select 1 from expansao_no where user_id = v_uid) then
    return query select false, 'ja_esta_na_arvore'::text, null::text; return;
  end if;

  if p_username is null or length(trim(p_username)) = 0 then
    delete from expansao_patrocinador_escolhido where user_id = v_uid;
    return query select true, null::text, null::text; return;
  end if;

  select id, username into v_pat, v_nome from profiles
   where lower(username) = lower(trim(both '@ ' from p_username));
  if v_pat is null then
    return query select false, 'inexistente'::text, null::text; return; end if;
  if v_pat = v_uid then
    return query select false, 'auto_indicacao'::text, v_nome; return; end if;
  if not exists (select 1 from expansao_no where user_id = v_pat)
     or not public.expansao_pode_convidar_interno(v_pat) then
    return query select false, 'nao_ativado'::text, v_nome; return; end if;

  insert into expansao_patrocinador_escolhido (user_id, patrocinador_id)
  values (v_uid, v_pat)
  on conflict (user_id) do update set patrocinador_id = excluded.patrocinador_id, escolhido_em = now();
  return query select true, null::text, v_nome;
end;
$$;
revoke all on function public.expansao_escolher_patrocinador(text) from public, anon;
grant execute on function public.expansao_escolher_patrocinador(text) to authenticated, service_role;

-- ─── a sugestão do checkout ───────────────────────────────────────────────
-- Escolha já feita > dono do código de cadastro (se ativado). Só o @ — nada
-- de e-mail, nada de rede.
create or replace function public.expansao_meu_indicador()
returns table (sugerido text, fonte text, na_arvore boolean)
language sql stable security definer set search_path = public
as $$
  with eu as (select auth.uid() as uid),
  escolhido as (
    select p.username from expansao_patrocinador_escolhido e
      join profiles p on p.id = e.patrocinador_id
     where e.user_id = (select uid from eu)
  ),
  cadastro as (
    select r.username
      from profiles me
      join profiles r on r.my_referral_code = me.referred_by_code and r.id <> me.id
     where me.id = (select uid from eu)
       and exists (select 1 from expansao_no n where n.user_id = r.id)
       and public.expansao_pode_convidar_interno(r.id)
     limit 1
  )
  select coalesce((select username from escolhido), (select username from cadastro)),
         case when exists (select 1 from escolhido) then 'escolhido'
              when exists (select 1 from cadastro) then 'cadastro' end,
         exists (select 1 from expansao_no n where n.user_id = (select uid from eu))
   where (select uid from eu) is not null;
$$;
revoke all on function public.expansao_meu_indicador() from public, anon;
grant execute on function public.expansao_meu_indicador() to authenticated, service_role;

-- ─── o código de cadastro de quem convida ─────────────────────────────────
-- Público de propósito: é o mesmo código que já vai no link /cadastro/<código>.
-- Só devolve de quem está ativado — convite de conta não ativada não vale.
create or replace function public.codigo_de_indicacao_de(p_username text)
returns text
language sql stable security definer set search_path = public
as $$
  select p.my_referral_code
    from profiles p
   where lower(p.username) = lower(trim(both '@ ' from coalesce(p_username, '')))
     and exists (select 1 from expansao_no n where n.user_id = p.id)
     and public.expansao_pode_convidar_interno(p.id)
   limit 1;
$$;
revoke all on function public.codigo_de_indicacao_de(text) from public;
grant execute on function public.codigo_de_indicacao_de(text) to anon, authenticated, service_role;

-- ─── a compra respeita a escolha ──────────────────────────────────────────
-- Copiada de produção (md5 ec150e89…, igual a 20260929220000). O acréscimo é
-- o passo 1 (patrocinador escolhido) e a origem 'convite' quando ele vale.
create or replace function public.expansao_entrar_por_compra(p_user uuid)
returns table (entrou boolean, motivo text, patrocinador uuid)
language plpgsql security definer set search_path = public
as $$
declare
  v_pat uuid;
  v_pat_username text;
  v_elo record;
  v_r record;
  v_origem text := 'compra';
begin
  if exists (select 1 from expansao_no where user_id = p_user) then
    return query select false, 'ja_esta_na_arvore'::text, null::uuid; return;
  end if;

  -- 1. quem a própria pessoa declarou no checkout
  select e.patrocinador_id into v_pat
    from expansao_patrocinador_escolhido e
   where e.user_id = p_user
     and e.patrocinador_id <> p_user
     and exists (select 1 from expansao_no n where n.user_id = e.patrocinador_id)
     and public.expansao_pode_convidar_interno(e.patrocinador_id);
  if v_pat is not null then v_origem := 'convite'; end if;

  -- 2. a cadeia do código de cadastro
  if v_pat is null then
    for v_elo in
      select referrer_id from public.get_referral_chain(p_user, 25) order by level
    loop
      if exists (select 1 from expansao_no where user_id = v_elo.referrer_id)
         and public.expansao_pode_convidar_interno(v_elo.referrer_id) then
        v_pat := v_elo.referrer_id;
        exit;
      end if;
    end loop;
  end if;

  -- 3. a ORIGEM
  if v_pat is null then
    select user_id into v_pat from expansao_no
     where pai_id is null order by criado_em, y_ordem limit 1;
  end if;
  if v_pat is null then
    return query select false, 'arvore_sem_raiz'::text, null::uuid; return;
  end if;

  select * into v_r from public.expansao_entrar(p_user, v_pat);
  if not v_r.entrou then
    return query select false, v_r.motivo, v_pat; return;
  end if;

  select username into v_pat_username from profiles where id = v_pat;
  insert into expansao_confirmacao (user_id, patrocinador_id, username_convite, origem)
  values (p_user, v_pat, coalesce(v_pat_username, 'origem'), v_origem)
  on conflict (user_id) do nothing;

  return query select true, null::text, v_pat;
end;
$$;
revoke all on function public.expansao_entrar_por_compra(uuid) from public, anon, authenticated;
grant execute on function public.expansao_entrar_por_compra(uuid) to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — num savepoint, desfeita com raise
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_chegou boolean := false;
  v_comprador uuid;
  v_padrinho uuid;
  v_padrinho_nome text;
  v_r record;
begin
  if has_function_privilege('anon', 'public.expansao_escolher_patrocinador(text)', 'execute')
     or has_function_privilege('anon', 'public.expansao_meu_indicador()', 'execute')
     or has_function_privilege('authenticated', 'public.expansao_entrar_por_compra(uuid)', 'execute') then
    raise exception 'uma função de indicação ficou aberta a quem não devia';
  end if;

  -- um padrinho ativado, na árvore, que NÃO seja a raiz
  select n.user_id, p.username into v_padrinho, v_padrinho_nome
    from expansao_no n join profiles p on p.id = n.user_id
   where n.pai_id is not null and p.username is not null
     and public.expansao_pode_convidar_interno(n.user_id)
   limit 1;
  select p.id into v_comprador from profiles p
   where not exists (select 1 from expansao_no n where n.user_id = p.id)
     and exists (select 1 from auth.users u where u.id = p.id)
   limit 1;
  if v_padrinho is null or v_comprador is null then
    raise notice 'sem padrinho ativado fora da raiz ou sem conta livre: verificação pulada';
    return;
  end if;

  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_comprador, 'role', 'authenticated')::text, true);

    select * into v_r from public.expansao_escolher_patrocinador('@naoexiste_' || md5(random()::text));
    if v_r.ok or v_r.motivo <> 'inexistente' then raise exception 'aceitou @ inexistente'; end if;

    select * into v_r from public.expansao_escolher_patrocinador(upper(v_padrinho_nome));
    if not v_r.ok then raise exception 'recusou padrinho válido: %', v_r.motivo; end if;

    select * into v_r from public.expansao_meu_indicador();
    if v_r.sugerido is distinct from v_padrinho_nome or v_r.fonte <> 'escolhido' then
      raise exception 'a sugestão não trouxe a escolha: % / %', v_r.sugerido, v_r.fonte;
    end if;

    perform set_config('request.jwt.claims', '', true);
    select * into v_r from public.expansao_entrar_por_compra(v_comprador);
    if not v_r.entrou or v_r.patrocinador <> v_padrinho then
      raise exception 'a compra não respeitou a escolha (entrou % sob %)', v_r.entrou, v_r.patrocinador;
    end if;
    if not exists (select 1 from expansao_confirmacao
                    where user_id = v_comprador and patrocinador_id = v_padrinho and origem = 'convite') then
      raise exception 'a entrada não ficou registrada como convite do padrinho';
    end if;

    -- depois de entrar, não dá mais pra trocar
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_comprador, 'role', 'authenticated')::text, true);
    select * into v_r from public.expansao_escolher_patrocinador(v_padrinho_nome);
    if v_r.ok or v_r.motivo <> 'ja_esta_na_arvore' then raise exception 'trocou depois de entrar'; end if;
    perform set_config('request.jwt.claims', '', true);

    v_chegou := true;
    raise exception 'DESFAZ_A_VERIFICACAO';
  exception when others then
    if sqlerrm <> 'DESFAZ_A_VERIFICACAO' then raise; end if;
  end;

  perform set_config('request.jwt.claims', '', true);
  if not v_chegou then raise exception 'a verificação não chegou ao fim'; end if;
  if exists (select 1 from expansao_no where user_id = v_comprador)
     or exists (select 1 from expansao_patrocinador_escolhido where user_id = v_comprador) then
    raise exception 'a verificação deixou rastro';
  end if;
end $$;
