-- ============================================================================
-- REVELA — PLAYER DNA: como o atleta pensa
-- ============================================================================
-- Treze situações de futebol, escolha forçada, sem nenhuma pergunta sobre a
-- vida dele. O resultado é ARQUÉTIPO ("Líder Construtor"), não nota.
--
-- ── POR QUE ISTO É PÚBLICO, SENDO QUE OS OUTROS PILARES NÃO SERÃO ───────────
-- A régua do produto é: PÚBLICO É O QUE ELE CONQUISTOU, PRIVADO É O QUE ELE
-- PRECISA. Mentalidade é APTIDÃO — é mérito, e ninguém se machuca sendo chamado
-- de Líder Construtor na internet. Nutrição, material e estrutura são CONDIÇÃO,
-- e essas vão pra outra tabela, privada, na próxima fase. Não misturar as duas
-- naturezas na mesma tabela é o que impede a segunda de vazar junto com a
-- primeira no dia em que alguém acrescentar um campo à lista branca sem pensar.
--
-- ── ONDE MORA A CONTA, E POR QUÊ NÃO É AQUI ────────────────────────────────
-- O banco guarda as RESPOSTAS CRUAS e também o resultado já calculado. A conta
-- em si vive em `revela/src/data/dna.ts` — fonte única, com self-test
-- (`npm run test:revela-dna`). Duplicar o mapa item→traço em PL/pgSQL criaria
-- duas verdades que divergem no primeiro ajuste de item.
--
-- O risco de aceitar resultado calculado no cliente é um atleta forjar os
-- próprios traços. Assumido, e pequeno: é a ficha DELE, o teste é autorrelato
-- por natureza (mede preferência, não habilidade), e nada a jusante depende
-- disso — não há prêmio, ranking nem dinheiro amarrado ao arquétipo. Diferente
-- do OLEKO, onde o valor de cada missão mora no servidor justamente porque paga.
-- O que o RPC faz é validar FORMA (chaves conhecidas, faixa 0–99), não confiar
-- cegamente. E como as respostas cruas ficam guardadas, qualquer mudança de
-- fórmula pode ser reaplicada em cima delas depois.
-- ============================================================================

create table if not exists public.revela_talent_dna (
  talent_id  uuid primary key references public.revela_talents(id) on delete cascade,
  -- { "a1": 0, "a2": 3, ... } — índice da alternativa escolhida em cada item.
  respostas  jsonb       not null,
  -- { "lideranca": 86, ... } — desnormalizado pra leitura barata no perfil.
  tracos     jsonb       not null,
  arquetipo  text        not null,
  -- Versão do banco de itens. Se os itens mudarem, dá pra saber o que recalcular.
  versao     int         not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Acesso é SÓ por função security definer. RLS ligada e sem política = ninguém
-- lê nem escreve direto, nem com a anon key que está no bundle do site.
alter table public.revela_talent_dna enable row level security;

comment on table public.revela_talent_dna is
  'Player DNA do atleta. Aptidão, público. Condição de vida vai em outra tabela, privada.';


-- ────────────────────────────────────────────────────────────────────────────
-- Gravar
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.revela_save_dna(
  p_respostas jsonb,
  p_tracos    jsonb,
  p_arquetipo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_talent uuid;
  v_valor  numeric;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;

  select id into v_talent
    from public.revela_talents
   where user_id = auth.uid()
     and status <> 'rejected'
   limit 1;

  if v_talent is null then
    return jsonb_build_object('ok', false, 'reason', 'no_talent');
  end if;

  -- ── Validação de FORMA ────────────────────────────────────────────────
  -- Não valida se o resultado "bate" com as respostas (a conta mora no
  -- cliente, ver cabeçalho). Valida que nada absurdo entra: objeto, tamanho
  -- plausível, traços conhecidos, faixa 0–99, arquétipo curto.
  if jsonb_typeof(p_respostas) <> 'object'
     or jsonb_typeof(p_tracos) <> 'object' then
    return jsonb_build_object('ok', false, 'reason', 'bad_shape');
  end if;

  if (select count(*) from jsonb_object_keys(p_respostas)) not between 1 and 60 then
    return jsonb_build_object('ok', false, 'reason', 'bad_shape');
  end if;

  if exists (
    select 1 from jsonb_object_keys(p_tracos) k
     where k not in ('lideranca','construcao','estrategia',
                     'competitividade','adaptacao','decisao','disciplina')
  ) then
    return jsonb_build_object('ok', false, 'reason', 'bad_traits');
  end if;

  for v_valor in select (value #>> '{}')::numeric from jsonb_each(p_tracos) loop
    if v_valor < 0 or v_valor > 99 then
      return jsonb_build_object('ok', false, 'reason', 'bad_range');
    end if;
  end loop;

  if p_arquetipo is null
     or length(trim(p_arquetipo)) = 0
     or length(p_arquetipo) > 60 then
    return jsonb_build_object('ok', false, 'reason', 'bad_archetype');
  end if;

  insert into public.revela_talent_dna (talent_id, respostas, tracos, arquetipo)
  values (v_talent, p_respostas, p_tracos, trim(p_arquetipo))
  on conflict (talent_id) do update
     set respostas  = excluded.respostas,
         tracos     = excluded.tracos,
         arquetipo  = excluded.arquetipo,
         updated_at = now();

  return jsonb_build_object('ok', true, 'arquetipo', trim(p_arquetipo));
exception
  when others then
    -- Números fora de formato no jsonb caem aqui em vez de derrubar a tela.
    return jsonb_build_object('ok', false, 'reason', 'bad_payload');
end;
$$;

grant execute on function public.revela_save_dna(jsonb, jsonb, text) to authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- Ler — no perfil público
-- ────────────────────────────────────────────────────────────────────────────
-- Sai o ARQUÉTIPO e os TRAÇOS. As respostas cruas NÃO saem: item a item é o
-- rascunho, e ninguém precisa saber o que ele marcou na pergunta da dor na
-- véspera do jogo pra entender que ele é Líder Construtor.
create or replace function public.revela_get_talent(p_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id',            rt.id,
    'slug',          rt.slug,
    'name',          coalesce(nullif(rt.nickname, ''), rt.name),
    'pos',           rt.pos,
    'category',      rt.category,
    'gameSituation', rt.game_situation,
    'club',          rt.club,
    'city',          rt.city,
    'uf',            rt.uf,
    'country',       rt.country,
    'birthYear',     rt.birth_year,
    'strongFoot',    rt.strong_foot,
    'bio',           rt.bio,
    'dream',         rt.dream,
    'portrait',      rt.portrait_url,
    'video',         rt.video_url,
    'instagram',     rt.instagram_url,
    'attributes',    rt.attributes,
    'overall',       rt.overall,
    'status',        rt.status,
    'featured',      rt.featured,
    'carded',        rt.status = 'carded',
    'dna',           (
      select jsonb_build_object('arquetipo', d.arquetipo, 'tracos', d.tracos)
        from public.revela_talent_dna d
       where d.talent_id = rt.id
    ),
    'supporters',    (select count(*)::int from public.revela_supports s where s.talent_id = rt.id),
    'createdAt',     rt.created_at
  )
  from public.revela_talents rt
  where rt.slug = p_slug
    and rt.status in ('approved', 'carded')
  limit 1;
$$;

grant execute on function public.revela_get_talent(text) to anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- Ler — no painel do próprio atleta
-- ────────────────────────────────────────────────────────────────────────────
-- Aqui SAEM as respostas cruas: é o dono lendo o próprio teste, e é o que
-- permite ele refazer sem começar do zero.
create or replace function public.revela_my_talent()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id',         rt.id,
    'slug',       rt.slug,
    'handle',     rt.handle,
    'name',       coalesce(nullif(rt.nickname, ''), rt.name),
    'pos',        rt.pos,
    'category',   rt.category,
    'club',       rt.club,
    'city',       rt.city,
    'uf',         rt.uf,
    'portrait',   rt.portrait_url,
    'overall',    rt.overall,
    'status',     rt.status,
    'scoutNote',  rt.scout_note,
    'supporters', (select count(*)::int from public.revela_supports s where s.talent_id = rt.id),
    'indicacaoAtiva', exists (
      select 1 from public.profiles p
      where p.id = rt.user_id and p.my_referral_code is not null
    ),
    'dna',        (
      select jsonb_build_object(
               'arquetipo', d.arquetipo,
               'tracos',    d.tracos,
               'respostas', d.respostas
             )
        from public.revela_talent_dna d
       where d.talent_id = rt.id
    ),
    'createdAt',  rt.created_at
  )
  from public.revela_talents rt
  where rt.user_id = auth.uid()
    and rt.status <> 'rejected'
  limit 1;
$$;

grant execute on function public.revela_my_talent() to authenticated;


-- ─── Verificação ────────────────────────────────────────────────────────────
--   select public.revela_get_talent('breno-liborge') -> 'dna';
-- Volta null até ele responder. O bloco some sozinho nesse caso.
