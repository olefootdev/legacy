-- ════════════════════════════════════════════════════════════════════════════
-- REVELA — CATEGORIA DECLARADA NÃO VALE MAIS QUE A IDADE
-- ════════════════════════════════════════════════════════════════════════════
-- O buraco mais real que o SCOUT autônomo deixou: a categoria define a BASE do
-- rating (`profissional` 62, `sub15` 46) e ninguém conferia se ela cabia na
-- idade. Um moleque de 14 anos se declarando profissional ganhava 16 pontos de
-- base — e com o cadastro entrando aprovado sozinho, isso ia pro ar sem escala.
--
-- Vale nos dois sentidos: o Juan estava `sub15` nascido em 1999 (27 anos), e a
-- ficha nascia afundada em 46 por causa de um campo esquecido.
--
-- ── DUAS CAMADAS ────────────────────────────────────────────────────────────
--  1. No formulário (revela/src/data/categoria.ts): a categoria impossível nem
--     aparece pra escolher, e o ano de nascimento passou a ser perguntado ANTES
--     da categoria — perguntar categoria primeiro era pedir pro atleta chutar.
--  2. AQUI: teto de base por idade, aplicado sempre. Validação de formulário é
--     sugestão; esta é a camada que vale quando alguém edita a linha por fora,
--     importa dado antigo ou muda a categoria no painel.
--
-- ── O TETO NÃO É PUNIÇÃO ────────────────────────────────────────────────────
--   até 13 anos → 46      16–17 anos → 56
--   14–15 anos  → 50      18+        → sem teto (a categoria manda)
--
-- Ficha assinada por humano NÃO passa por esta função: o olheiro continua
-- podendo reconhecer o precoce de verdade. O teto só governa o que a máquina
-- gera sozinha a partir do que o atleta declarou sobre si mesmo.
--
-- Função EXTRAÍDA POR SCRIPT de 20260806100000 com uma mudança — conferido:
-- o ponto neutro 25 e o mapa traço→atributo continuam intactos.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.revela_rating_inicial(
  p_pos        text,
  p_category   text,
  p_birth_year int,
  p_height_cm  int,
  p_has_agent  boolean,
  p_tracos     jsonb
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
  d      jsonb;
  attrs  jsonb := '{}'::jsonb;
  chave  text;
  traco  text;
  base   numeric;
  bonus  numeric;
  -- O traço médio de qualquer atleta, dado o formato do teste. Se um dia o
  -- número de itens ou de alternativas mudar, ESTE número muda junto —
  -- é `99 / alternativas por item`.
  NEUTRO constant numeric := 25;
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
  nivel := case cat
    when 'profissional' then 62
    when 'legend'       then 68
    when 'sub20'        then 52
    when 'amador'       then 50
    when 'sub15'        then 46
    else 46
  end;

  if p_birth_year between 1940 and extract(year from now())::int then
    idade := extract(year from now())::int - p_birth_year;
    if cat = 'profissional' and idade <= 20 then nivel := nivel + 3; end if;
    if cat = 'sub20'        and idade <= 16 then nivel := nivel + 2; end if;
    if cat = 'amador'       and idade >= 30 then nivel := nivel - 2; end if;
  end if;

  if p_height_cm between 140 and 220 then
    nivel := nivel + case
      when pos = 'GOL' then greatest(-3, least(3, (p_height_cm - 185) / 5.0))
      when pos = 'ZAG' then greatest(-3, least(3, (p_height_cm - 183) / 5.0))
      when pos = 'ATA' then greatest(-2, least(2, (p_height_cm - 180) / 6.0))
      else 0
    end;
  end if;

  if coalesce(p_has_agent, false) then nivel := nivel + 1; end if;
  nivel := greatest(40, least(75, nivel));

  -- ── TETO POR IDADE ────────────────────────────────────────────────────────
  -- A categoria é DECLARADA e define a base: `profissional` vale 62, `sub15`
  -- vale 46. Sem este teto, um moleque de 14 anos se declara profissional e
  -- ganha 16 pontos sem ninguém olhar — e com o SCOUT autônomo isso entra no ar
  -- sozinho. O formulário já esconde a opção impossível, mas validação de
  -- formulário é sugestão: esta é a camada que vale quando alguém edita a linha
  -- por fora, importa dado antigo ou muda a categoria no painel.
  --
  -- Ficha assinada por humano NÃO passa por aqui (`revela_aplicar_rating_inicial`
  -- só age em rating_source='auto'), então o olheiro continua podendo reconhecer
  -- o moleque precoce de verdade.
  --
  -- ⚠️ ESPELHO de `tetoDeBasePorIdade` em revela/src/data/categoria.ts.
  -- Guardado por `npm run test:revela-categoria`.
  if idade is not null then
    nivel := least(nivel, case
      when idade <= 13 then 46
      when idade <= 15 then 50
      when idade <= 17 then 56
      else 999
    end);
  end if;

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

  for chave in select jsonb_object_keys(mapa) loop
    base := nivel + coalesce((d ->> chave)::numeric, 0);

    bonus := 0;
    if p_tracos is not null then
      traco := mapa ->> chave;
      if (p_tracos ? traco) then
        -- ERA `(traço − 50) / 10`. Ver o cabeçalho: 50 nunca foi o meio.
        bonus := greatest(-5, least(5, ((p_tracos ->> traco)::numeric - NEUTRO) / 8.0));
      end if;
    end if;

    attrs := attrs || jsonb_build_object(
      chave, greatest(30, least(80, round(base + bonus)))::int
    );
  end loop;

  return attrs;
end;
$$;


-- ── Recalcula quem já tem ficha automática ──────────────────────────────────
select t.slug,
       t.category,
       case when t.birth_year is not null
            then extract(year from now())::int - t.birth_year end as idade,
       t.overall as antes,
       (public.revela_aplicar_rating_inicial(t.id) ->> 'overall')::int as depois
  from public.revela_talents t
 where t.rating_source = 'auto'
 order by t.created_at desc;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — roda junto e derruba tudo se falhar
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  ovr_menor_pro int;
  ovr_adulto_pro int;
  ovr_sem_idade int;
begin
  -- O caso que motivou tudo: 14 anos declarando profissional.
  ovr_menor_pro := public.revela_ovr('ATA',
    public.revela_rating_inicial('ATA', 'profissional',
      extract(year from now())::int - 14, 170, false, null));

  -- O mesmo cadastro, com idade compatível.
  ovr_adulto_pro := public.revela_ovr('ATA',
    public.revela_rating_inicial('ATA', 'profissional',
      extract(year from now())::int - 24, 170, false, null));

  if ovr_menor_pro >= ovr_adulto_pro then
    raise exception 'teto de idade não pegou: 14 anos deu % e 24 anos deu %',
      ovr_menor_pro, ovr_adulto_pro;
  end if;

  -- Sem ano de nascimento, nada muda — não dá pra punir quem não informou.
  ovr_sem_idade := public.revela_ovr('ATA',
    public.revela_rating_inicial('ATA', 'profissional', null, 170, false, null));
  if ovr_sem_idade <> ovr_adulto_pro then
    raise exception 'sem idade deveria valer como adulto (% vs %)',
      ovr_sem_idade, ovr_adulto_pro;
  end if;

  raise notice 'verificação: teto por idade ok — 14 anos %, 24 anos %, sem idade %',
    ovr_menor_pro, ovr_adulto_pro, ovr_sem_idade;
end $$;
