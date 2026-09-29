-- ═══════════════════════════════════════════════════════════════════════════
-- A PONTE: cadastro → árvore binária
--
-- Antes disto, `/cadastro/:código` gravava em `profiles.referred_by_code` (o
-- sistema plano, antigo) e NUNCA chamava expansao_inserir. A árvore existia e
-- não recebia ninguém — um link de indicação funcionaria visualmente e a
-- pessoa ficaria fora do binário, que é o pior tipo de falha: a que parece ter
-- dado certo.
--
-- 🔑 POR QUE O BFS PRECISOU VIR PRA SQL. O motor em TS (`vagaNaPerna`) é a
-- fonte da regra, mas o cadastro fala DIRETO com o Supabase — não passa pelo
-- Hono. Então a busca em largura precisa existir dos dois lados. A de cá é
-- conferida contra a de lá no self-test, senão viram duas regras diferentes
-- com o mesmo nome.
-- ═══════════════════════════════════════════════════════════════════════════

-- Perna escolhida pelo patrocinador. null = automático (a MENOR), que é o que
-- equilibra — e perna equilibrada é o que faz o MIN pagar.
alter table public.expansao_no
  add column if not exists perna_padrao smallint check (perna_padrao in (1, 2));

-- ─── a vaga, em largura, dentro da perna ──────────────────────────────────
-- Espelha `vagaNaPerna` de server/src/lib/expansao/arvore.ts:
-- se a perna está vazia, a vaga é o próprio patrocinador; senão desce em
-- LARGURA (nível, depois ordem de chegada) até achar o primeiro nó com espaço.
-- Nunca atravessa pro outro lado.
create or replace function public.expansao_vaga_na_perna(p_patrocinador uuid, p_lado smallint)
returns table (pai_id uuid, lado smallint)
language plpgsql stable security definer set search_path = public as $$
declare v_raiz uuid;
begin
  select n.user_id into v_raiz from expansao_no n
   where n.pai_id = p_patrocinador and n.lado = p_lado;

  if v_raiz is null then
    return query select p_patrocinador, p_lado; return;
  end if;

  -- 🐞 Ordenar por (nivel, y_ordem) NÃO é busca em largura. `y_ordem` é a
  -- ordem GLOBAL de chegada; dois nós do mesmo nível podem ter entrado fora
  -- da ordem esquerda→direita, e aí a vaga sai diferente da do motor em TS.
  -- Achado pelo self-test que compara os dois: 39/40 batiam, e a que faltava
  -- era exatamente esse caso.
  --
  -- A ordem certa é pelo CAMINHO de lados desde a raiz da perna. Array em
  -- Postgres compara lexicograficamente, que é justamente esquerda→direita
  -- com o Time 1 antes do Time 2 — a mesma ordem da fila do TS.
  return query
  with recursive sub as (
    select n.user_id, n.nivel, array[]::smallint[] as caminho
      from expansao_no n where n.user_id = v_raiz
    union all
    select c.user_id, c.nivel, s.caminho || c.lado
      from expansao_no c join sub s on c.pai_id = s.user_id
  )
  select s.user_id,
         case when not exists (select 1 from expansao_no f where f.pai_id = s.user_id and f.lado = 1)
              then 1::smallint else 2::smallint end
    from sub s
   where not exists (select 1 from expansao_no f where f.pai_id = s.user_id and f.lado = 1)
      or not exists (select 1 from expansao_no f where f.pai_id = s.user_id and f.lado = 2)
   order by s.nivel, s.caminho
   limit 1;
end;
$$;
revoke all on function public.expansao_vaga_na_perna(uuid,smallint) from public, anon, authenticated;
grant execute on function public.expansao_vaga_na_perna(uuid,smallint) to service_role;

-- ─── qual perna usar ──────────────────────────────────────────────────────
-- 🐞 Balancear por VOLUME não serve pra quem está começando: patrocinador novo
-- tem zero nos dois lados, empate vai pro Time 1, e três cadastros seguidos
-- caem todos na mesma perna — deixando a pessoa INATIVA, já que ativar exige 1
-- indicado em CADA lado. Foi o que o teste de ponta a ponta mostrou.
--
-- Então o 1º critério é o que destrava o bônus: a perna com MENOS indicados
-- diretos. Volume só desempata.
create or replace function public.expansao_perna_alvo(p_patrocinador uuid)
returns smallint language sql stable security definer set search_path = public as $$
  with diretos as (
    select coalesce((select n2.lado from expansao_no n2
              where n2.user_id = d.posicao_path[array_position(d.posicao_path, p_patrocinador) + 1]), d.lado) as perna
      from expansao_no d
     where d.patrocinador_id = p_patrocinador and p_patrocinador = any(d.posicao_path)
  ), c as (
    select count(*) filter (where perna = 1) as t1, count(*) filter (where perna = 2) as t2 from diretos
  )
  select coalesce(
    (select perna_padrao from expansao_no where user_id = p_patrocinador),
    case
      when (select t1 from c) < (select t2 from c) then 1::smallint
      when (select t2 from c) < (select t1 from c) then 2::smallint
      when coalesce((select volume from expansao_perna where user_id=p_patrocinador and lado=1 and trilho='qualificacao'),0)
        <= coalesce((select volume from expansao_perna where user_id=p_patrocinador and lado=2 and trilho='qualificacao'),0)
      then 1::smallint else 2::smallint end);
$$;
revoke all on function public.expansao_perna_alvo(uuid) from public, anon, authenticated;
grant execute on function public.expansao_perna_alvo(uuid) to service_role;

-- ─── entrar na árvore ─────────────────────────────────────────────────────
create or replace function public.expansao_entrar(p_user uuid, p_patrocinador uuid)
returns table (entrou boolean, motivo text, pai uuid, lado smallint)
language plpgsql security definer set search_path = public as $$
declare v_lado smallint; v_vaga record;
begin
  if p_user = p_patrocinador then return query select false,'auto_patrocinio',null::uuid,null::smallint; return; end if;
  if exists (select 1 from expansao_no where user_id = p_user) then
    return query select false,'ja_esta_na_arvore',null::uuid,null::smallint; return; end if;
  if not exists (select 1 from expansao_no where user_id = p_patrocinador) then
    return query select false,'patrocinador_fora_da_arvore',null::uuid,null::smallint; return; end if;

  v_lado := public.expansao_perna_alvo(p_patrocinador);
  select * into v_vaga from public.expansao_vaga_na_perna(p_patrocinador, v_lado);
  perform public.expansao_inserir(p_user, p_patrocinador, v_vaga.pai_id, v_vaga.lado);
  return query select true, null::text, v_vaga.pai_id, v_vaga.lado;
end;
$$;
revoke all on function public.expansao_entrar(uuid,uuid) from public, anon, authenticated;
grant execute on function public.expansao_entrar(uuid,uuid) to service_role;

-- ─── quem ficou de fora ───────────────────────────────────────────────────
-- 🔴 A entrada na árvore é best-effort pra NUNCA quebrar o cadastro — mas
-- falhar calado deixaria a pessoa fora do binário sem ninguém saber. Então
-- toda falha vira linha aqui, e dá pra reprocessar.
create table if not exists public.expansao_pendente (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  patrocinador_id uuid,
  codigo         text,
  motivo         text not null,
  criado_em      timestamptz not null default now(),
  resolvido_em   timestamptz
);
alter table public.expansao_pendente enable row level security;

-- ─── o gancho no cadastro ─────────────────────────────────────────────────
-- Recria save_onboarding_profile PRESERVANDO tudo o que ela já fazia (perfil,
-- código de indicação imutável, auto-amizade best-effort) e somando a entrada
-- na árvore no fim.
create or replace function public.save_onboarding_profile(
  p_display_name text, p_club_name text, p_club_short text,
  p_onboarding_data jsonb, p_referred_by_code text default null::text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_referrer_id uuid;
  v_referrer_club text;
  v_entrada record;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;

  v_code := nullif(regexp_replace(upper(coalesce(p_referred_by_code, '')), '[^A-Z0-9]', '', 'g'), '');
  if v_code is not null and (char_length(v_code) < 6 or char_length(v_code) > 8) then v_code := null; end if;
  if v_code is not null then
    if not exists (select 1 from public.profiles where my_referral_code = v_code and id <> v_uid) then
      v_code := null;
    end if;
  end if;

  insert into public.profiles (id, display_name, club_name, club_short, onboarding_data, referred_by_code)
  values (v_uid, p_display_name, p_club_name, p_club_short, p_onboarding_data, v_code)
  on conflict (id) do update set
    display_name = excluded.display_name,
    club_name = excluded.club_name,
    club_short = excluded.club_short,
    onboarding_data = excluded.onboarding_data,
    referred_by_code = coalesce(public.profiles.referred_by_code, excluded.referred_by_code),
    updated_at = now();

  -- Auto-amizade com quem indicou. Best-effort: onboarding NUNCA pode quebrar.
  begin
    select p.referred_by_code into v_code from public.profiles p where p.id = v_uid;
    if v_code is not null then
      select id, club_name into v_referrer_id, v_referrer_club
        from public.profiles where my_referral_code = v_code and id <> v_uid limit 1;
      if v_referrer_id is not null then
        insert into public.manager_friendships
          (requester_id, addressee_id, requester_club_name, addressee_club_name, status, responded_at)
        values (v_referrer_id, v_uid, v_referrer_club, p_club_name, 'accepted', now())
        on conflict (requester_id, addressee_id) do update
          set status = case when public.manager_friendships.status in ('rejected','cancelled')
                            then public.manager_friendships.status else 'accepted' end,
              addressee_club_name = excluded.addressee_club_name,
              updated_at = now();
      end if;
    end if;
  exception when others then null;
  end;

  -- ─── ÁRVORE BINÁRIA ───────────────────────────────────────────────────
  -- Best-effort também, pelo mesmo motivo — mas com uma diferença que importa:
  -- quando falha, GRAVA. Ficar de fora do binário calado é o erro que ninguém
  -- descobre até alguém reclamar do bônus.
  begin
    if not exists (select 1 from public.expansao_no where user_id = v_uid) then
      select p.referred_by_code into v_code from public.profiles p where p.id = v_uid;
      v_referrer_id := null;
      if v_code is not null then
        select id into v_referrer_id from public.profiles
         where my_referral_code = v_code and id <> v_uid limit 1;
      end if;

      if v_referrer_id is null then
        insert into public.expansao_pendente (user_id, patrocinador_id, codigo, motivo)
        values (v_uid, null, v_code, 'sem_patrocinador')
        on conflict (user_id) do nothing;
      else
        select * into v_entrada from public.expansao_entrar(v_uid, v_referrer_id);
        if not v_entrada.entrou then
          insert into public.expansao_pendente (user_id, patrocinador_id, codigo, motivo)
          values (v_uid, v_referrer_id, v_code, v_entrada.motivo)
          on conflict (user_id) do nothing;
        end if;
      end if;
    end if;
  exception when others then
    insert into public.expansao_pendente (user_id, patrocinador_id, codigo, motivo)
    values (v_uid, null, null, 'excecao: ' || sqlerrm)
    on conflict (user_id) do nothing;
  end;
end;
$function$;

-- ─── perfil e código de indicação para as contas-selo ─────────────────────
-- Sem profile elas não têm my_referral_code, logo não existe URL de convite.
-- O trigger trg_generate_referral_code gera o código no insert.
insert into public.profiles (id, display_name, club_name, club_short)
select u.id,
       u.raw_user_meta_data->>'display_name',
       u.raw_user_meta_data->>'display_name',
       upper(replace(u.raw_user_meta_data->>'display_name', 'ORIGEM', 'OR'))
  from auth.users u
 where u.email like 'origem%@olefoot.ai'
   and (u.raw_user_meta_data->>'conta_selo')::boolean is true
on conflict (id) do nothing;
