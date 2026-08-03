-- ════════════════════════════════════════════════════════════════════════════
-- REVELA — O SCOUT AUTÔNOMO
-- ════════════════════════════════════════════════════════════════════════════
-- Decisão do fundador (2026-08-03): "é mais fácil a gente criar um SCOUT
-- autônomo do que eu começar a aprovar centenas de cadastros". Está certo — a
-- fila humana como PORTÃO não escala, e uma ficha parada 21h porque ninguém
-- clicou não protege ninguém.
--
-- ── O QUE MUDA ──────────────────────────────────────────────────────────────
-- O cadastro entra APROVADO, com uma ficha inicial calculada aqui. A revisão
-- humana deixa de ser porteiro e vira CURADORIA: quem ganha torcida sobe na
-- fila e recebe o olho do olheiro. Triagem por tração, não por ordem de
-- chegada — é isso que faz "centenas" virar "as vinte que importam".
--
-- ── ISTO GERA, NÃO AVALIA ───────────────────────────────────────────────────
-- Nada no cadastro mede se o moleque finaliza bem. Categoria, idade e altura
-- são declaradas; o DNA mede PREFERÊNCIA, não habilidade. Então o que esta
-- função faz é montar um perfil PLAUSÍVEL E COERENTE com o que ele disse: quem
-- respondeu "devolvo simples e me ofereço" sai com mais Passe e menos
-- Finalização que quem respondeu "encaro o marcador". Isso não é medição — é o
-- que faz a carta parecer com ELE em vez de um molde. E é honesto porque a
-- ficha nasce marcada como inicial.
--
-- Três travas contra a ficha automática virar mentira de mercado:
--   1. `rating_source = 'auto'` fica gravado, e a vitrine mostra a diferença.
--   2. Teto de 80 em atributo e 75 de base. Nota alta é decisão de humano.
--   3. O selo "Aval do OLE SCOUT" NÃO acende com ficha automática.
--
-- ── POR QUE A CONTA MORA NO BANCO ───────────────────────────────────────────
-- Diferente do Player DNA (que não paga nada), o OVR move o mercado: manager
-- escala carta por ele. Se o cliente calculasse, dava pra forjar um 99 e
-- envenenar a vitrine. Aqui é servidor, como o valor das missões do OLEKO.
-- ════════════════════════════════════════════════════════════════════════════

-- ── De onde veio a ficha ────────────────────────────────────────────────────
alter table public.revela_talents
  add column if not exists rating_source text not null default 'scout'
    check (rating_source in ('auto', 'scout'));

comment on column public.revela_talents.rating_source is
  'auto = ficha gerada no cadastro; scout = revisada por humano. Só o scout acende o selo.';

-- Quem já existe foi avaliado por gente — não vira 'auto' retroativamente.
update public.revela_talents
   set rating_source = 'scout'
 where overall is not null and rating_source is distinct from 'scout';


-- ════════════════════════════════════════════════════════════════════════════
-- A FICHA INICIAL
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.revela_rating_inicial(
  p_pos        text,
  p_category   text,
  p_birth_year int,
  p_height_cm  int,
  p_has_agent  boolean,
  p_tracos     jsonb   -- Player DNA, ou null enquanto ele não fez o teste
)
returns jsonb
language plpgsql
immutable
as $$
declare
  pos    text := upper(coalesce(trim(p_pos), ''));
  cat    text := lower(coalesce(trim(p_category), ''));
  idade  int;
  nivel  numeric;
  -- Deltas por posição: o que a posição PEDE. Somam ~zero de propósito, pra
  -- não inflar nem esvaziar o OVR — só mudam a forma do polígono.
  d      jsonb;
  attrs  jsonb := '{}'::jsonb;
  chave  text;
  traco  text;
  base   numeric;
  bonus  numeric;
  -- Cada atributo escuta UM traço. Disciplina puxa três porque é justamente o
  -- traço do trabalho chato que sustenta marcação, físico e fair play.
  mapa   jsonb := jsonb_build_object(
    'velocidade',  'competitividade',
    'drible',      'adaptacao',
    'finalizacao', 'decisao',
    'passe',       'construcao',
    'marcacao',    'disciplina',
    'fisico',      'disciplina',
    'tatico',      'estrategia',
    'mentalidade', 'lideranca',
    'confianca',   'lideranca',
    'fairPlay',    'disciplina'
  );
begin
  ---------------------------------------------------------------- nível base
  nivel := case cat
    when 'profissional' then 62
    when 'legend'       then 68
    when 'sub20'        then 52
    when 'amador'       then 50
    when 'sub15'        then 46
    else 46                      -- escolinha, vazio, desconhecido
  end;

  if p_birth_year between 1940 and extract(year from now())::int then
    idade := extract(year from now())::int - p_birth_year;
    -- Chegar cedo é o sinal mais forte que um cadastro consegue dar.
    if cat = 'profissional' and idade <= 20 then nivel := nivel + 3; end if;
    if cat = 'sub20'        and idade <= 16 then nivel := nivel + 2; end if;
    if cat = 'amador'       and idade >= 30 then nivel := nivel - 2; end if;
  end if;

  -- Altura só conta onde ela conta.
  if p_height_cm between 140 and 220 then
    nivel := nivel + case
      when pos = 'GOL'            then greatest(-3, least(3, (p_height_cm - 185) / 5.0))
      when pos = 'ZAG'            then greatest(-3, least(3, (p_height_cm - 183) / 5.0))
      when pos = 'ATA'            then greatest(-2, least(2, (p_height_cm - 180) / 6.0))
      else 0
    end;
  end if;

  if coalesce(p_has_agent, false) then nivel := nivel + 1; end if;

  -- TETO DE 75: ficha automática não entrega craque. Isso é do humano.
  nivel := greatest(40, least(75, nivel));

  ------------------------------------------------------- perfil da posição
  d := case pos
    when 'GOL' then '{"marcacao":4,"fisico":3,"velocidade":-4,"drible":-10,"finalizacao":-12}'
    when 'ZAG' then '{"marcacao":8,"fisico":6,"drible":-6,"finalizacao":-8}'
    when 'LD'  then '{"velocidade":6,"fisico":4,"marcacao":2,"finalizacao":-5}'
    when 'LE'  then '{"velocidade":6,"fisico":4,"marcacao":2,"finalizacao":-5}'
    when 'VOL' then '{"marcacao":6,"passe":3,"tatico":3,"drible":-3,"finalizacao":-4}'
    when 'MC'  then '{"passe":7,"tatico":5,"drible":2,"marcacao":-2}'
    when 'MEI' then '{"passe":6,"drible":5,"finalizacao":3,"marcacao":-6}'
    when 'PD'  then '{"velocidade":8,"drible":7,"finalizacao":2,"marcacao":-8}'
    when 'PE'  then '{"velocidade":8,"drible":7,"finalizacao":2,"marcacao":-8}'
    when 'ATA' then '{"finalizacao":9,"fisico":2,"passe":-3,"marcacao":-9}'
    else '{}'
  end::jsonb;

  --------------------------------------------------------------- os dez
  for chave in select jsonb_object_keys(mapa) loop
    base := nivel + coalesce((d ->> chave)::numeric, 0);

    -- O DNA move ±5. Traço 50 (neutro) não mexe em nada; 99 empurra pra cima,
    -- 0 puxa pra baixo. Sem teste feito, a ficha fica só com posição e nível.
    bonus := 0;
    if p_tracos is not null then
      traco := mapa ->> chave;
      if (p_tracos ? traco) then
        bonus := greatest(-5, least(5, ((p_tracos ->> traco)::numeric - 50) / 10.0));
      end if;
    end if;

    attrs := attrs || jsonb_build_object(
      chave, greatest(30, least(80, round(base + bonus)))::int
    );
  end loop;

  return attrs;
end;
$$;

comment on function public.revela_rating_inicial(text, text, int, int, boolean, jsonb) is
  'Ficha inicial GERADA do cadastro + Player DNA. Não é avaliação — ver o cabeçalho '
  'de 20260805220000. Teto 75 de base e 80 por atributo; nota alta é do humano.';


-- ════════════════════════════════════════════════════════════════════════════
-- APLICAR — no cadastro e sempre que o DNA mudar
-- ════════════════════════════════════════════════════════════════════════════
-- Uma função só, chamada dos dois lugares. `rating_source = 'scout'` é parede:
-- depois que um humano encostou na ficha, nada aqui sobrescreve o trabalho dele.
create or replace function public.revela_aplicar_rating_inicial(p_talent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t      public.revela_talents;
  tracos jsonb;
  attrs  jsonb;
  ovr    int;
begin
  select * into t from public.revela_talents where id = p_talent_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if t.rating_source <> 'auto' then
    return jsonb_build_object('ok', false, 'reason', 'revisada_por_humano');
  end if;

  select d.tracos into tracos
    from public.revela_talent_dna d
   where d.talent_id = t.id;

  attrs := public.revela_rating_inicial(
    t.pos, t.category, t.birth_year, t.height_cm, t.has_agent, tracos
  );
  ovr := public.revela_ovr(t.pos, attrs);

  update public.revela_talents
     set attributes = attrs,
         overall    = ovr,
         updated_at = now()
   where id = t.id;

  return jsonb_build_object('ok', true, 'overall', ovr, 'comDna', tracos is not null);
end;
$$;


-- ── No cadastro: entra aprovado, com ficha ──────────────────────────────────
-- Trigger AFTER INSERT em vez de mexer em `revela_submit_talent`: aquela função
-- tem 120 linhas de validação que não têm nada a ver com isto, e recriá-la
-- inteira só pra acrescentar duas linhas é onde erro de transcrição mora.
create or replace function public.revela_autoscout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.revela_talents
     set status        = 'approved',
         rating_source = 'auto',
         approved_at   = now()
   where id = new.id
     and status = 'pending';

  perform public.revela_aplicar_rating_inicial(new.id);
  return null;   -- AFTER trigger: o retorno é ignorado
end;
$$;

drop trigger if exists revela_talents_autoscout on public.revela_talents;
create trigger revela_talents_autoscout
  after insert on public.revela_talents
  for each row
  execute function public.revela_autoscout();


-- ── Quando o DNA chega: a ficha se ajusta ao jeito dele ─────────────────────
-- É isto que dá motivo pro atleta fazer o teste: a ficha dele muda de forma.
create or replace function public.revela_dna_reaplica_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.revela_aplicar_rating_inicial(new.talent_id);
  return null;
end;
$$;

drop trigger if exists revela_dna_rating on public.revela_talent_dna;
create trigger revela_dna_rating
  after insert or update of tracos on public.revela_talent_dna
  for each row
  execute function public.revela_dna_reaplica_rating();


-- ════════════════════════════════════════════════════════════════════════════
-- A FILA DO OLEIRO VIRA CURADORIA
-- ════════════════════════════════════════════════════════════════════════════
-- Ninguém mais fica 'pending', então ordenar por espera não diz nada. A ordem
-- passa a ser: ficha automática com MAIS TORCIDA primeiro. Quem o público está
-- descobrindo é quem merece o olho humano — e é assim que "centenas de
-- cadastros" vira "as vinte que importam esta semana".
--
-- ⚠️ AS 29 COLUNAS DE 20260723210000 CONTINUAM TODAS AQUI, na mesma ordem.
-- `ScoutTalent` em src/admin/revelaScoutClient.ts lê cada uma; derrubar
-- qualquer uma cega a tela de revisão. As duas do fim são novas e opcionais no
-- TypeScript, então painel velho com banco novo continua de pé.
drop function if exists public.revela_admin_queue();

create or replace function public.revela_admin_queue()
returns table (
  id             uuid,
  slug           text,
  name           text,
  nickname       text,
  pos            text,
  category       text,
  game_situation text,
  club           text,
  city           text,
  uf             text,
  birth_year     int,
  idade          int,
  strong_foot    text,
  height_cm      int,
  has_agent      boolean,
  agent_name     text,
  dream          text,
  status         text,
  overall        int,
  portrait_url   text,
  video_url      text,
  instagram_url  text,
  tiktok_url     text,
  contact_phone  text,
  contact_email  text,
  guardian_name  text,
  guardian_phone text,
  user_id        uuid,
  created_at     timestamptz,
  rating_source  text,
  supporters     int
)
language sql
security definer
set search_path = public
stable
as $$
  select t.id, t.slug, t.name, t.nickname, t.pos, t.category, t.game_situation,
         t.club, t.city, t.uf, t.birth_year,
         case when t.birth_year is not null
              then extract(year from now())::int - t.birth_year end,
         t.strong_foot, t.height_cm, t.has_agent, t.agent_name, t.dream,
         t.status, t.overall, t.portrait_url, t.video_url, t.instagram_url,
         t.tiktok_url, t.contact_phone, t.contact_email,
         t.guardian_name, t.guardian_phone, t.user_id, t.created_at,
         t.rating_source,
         (select count(*)::int from public.revela_supports s where s.talent_id = t.id)
  from public.revela_talents t
  order by
    -- 0 = ficha automática esperando curadoria · 1 = resto da fila antiga
    -- (pending/in_review que sobrou) · 2 = já revisada por humano
    case
      when t.rating_source = 'auto' and t.status in ('approved','carded') then 0
      when t.status in ('pending','in_review')                            then 1
      else 2
    end,
    (select count(*) from public.revela_supports s where s.talent_id = t.id) desc,
    t.created_at desc;
$$;

revoke execute on function public.revela_admin_queue() from anon, authenticated;


-- ── O humano encosta = a ficha vira dele ────────────────────────────────────
-- Sem isto o SCOUT autônomo é um vândalo: o olheiro corrigiria os dez atributos
-- e a próxima resposta do teste de DNA jogaria tudo fora. Revisar é o que
-- carimba `rating_source = 'scout'` — e é aquela parede que
-- `revela_aplicar_rating_inicial` respeita.
--
-- Cópia da versão de 20260723140000 com UMA linha a mais. O resto é idêntico:
-- overall continua saindo de revela_ovr(pos, attrs) quando p_overall vem null.
create or replace function public.revela_admin_review_talent(
  p_id         uuid,
  p_status     text,
  p_attributes jsonb default null,
  p_overall    int  default null,
  p_note       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_after public.revela_talents;
begin
  if p_status not in ('pending','in_review','approved','rejected','carded') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_status');
  end if;

  update public.revela_talents t
  set status        = p_status,
      attributes    = coalesce(p_attributes, t.attributes),
      overall       = coalesce(
                        p_overall,
                        case
                          when coalesce(p_attributes, t.attributes) <> '{}'::jsonb
                            then public.revela_ovr(t.pos, coalesce(p_attributes, t.attributes))
                          else t.overall
                        end
                      ),
      -- A linha nova. Olheiro que revisou é dono da ficha daqui pra frente.
      rating_source = 'scout',
      scout_note    = coalesce(p_note, t.scout_note),
      approved_at   = case when p_status in ('approved','carded') then now() else t.approved_at end,
      updated_at    = now()
  where t.id = p_id
  returning t.* into row_after;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object(
    'ok',      true,
    'slug',    row_after.slug,
    'overall', row_after.overall,
    'status',  row_after.status
  );
end;
$$;

revoke execute on function public.revela_admin_review_talent(uuid, text, jsonb, int, text)
  from anon, authenticated;


-- ── A vitrine conta a verdade ───────────────────────────────────────────────
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
    'ratingSource',  rt.rating_source,
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


-- ─── Verificação ────────────────────────────────────────────────────────────
-- Como fica a ficha de um lateral-direito de 19 anos, 1,78m, sub20, sem DNA:
--
--   select public.revela_rating_inicial('LD','sub20',2007,178,false,null);
--
-- E o mesmo moleque depois de um DNA bem competitivo:
--
--   select public.revela_rating_inicial('LD','sub20',2007,178,false,
--     '{"competitividade":90,"disciplina":80,"lideranca":70,"construcao":30,
--       "estrategia":40,"adaptacao":50,"decisao":45}'::jsonb);
