-- ════════════════════════════════════════════════════════════════════════════
-- REVELA — o ponto neutro do DNA estava errado (fazer o teste piorava a ficha)
-- ════════════════════════════════════════════════════════════════════════════
-- Sintoma: o Juan tirou OVR 48 no cadastro, fez o teste de DNA e caiu pra 46.
-- O incentivo inteiro do teste é o contrário disso — "responde e a ficha fica
-- mais tua" não pode significar "responde e teu número desce".
--
-- ── A CONTA ─────────────────────────────────────────────────────────────────
-- `revela_rating_inicial` movia cada atributo por `(traço − 50) / 10`, tratando
-- 50 como o meio da régua. Só que 50 NÃO é o meio desta régua.
--
-- São 13 situações, 7 traços, 4 alternativas por situação. A chance de um traço
-- ser escolhido numa situação onde ele aparece é ~1/4 — então o traço médio de
-- QUALQUER atleta fica perto de 25, não de 50. (Confirmado no dado real: os
-- sete traços do Juan somam uma média de 26,9.)
--
-- Com o neutro em 50, praticamente todo traço entrava como número NEGATIVO:
-- o atleta era punido em seis atributos pra ser premiado em um.
--
-- ── O CONSERTO ──────────────────────────────────────────────────────────────
-- Neutro em 25 e divisor 8, ainda com trava de ±5:
--
--   traço 99 → +5,0 (travado)   traço 50 → +3,1
--   traço 25 →  0,0             traço  0 → −3,1
--
-- Assimétrico de propósito: é mais fácil um traço ficar em zero (basta nunca
-- escolher aquela saída) do que chegar a 99. A trava em +5 mantém o teto de
-- antes, então nada aqui afrouxa o limite de 80 por atributo.
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


-- ── Recalcular quem já tem ficha automática ─────────────────────────────────
-- Só as 'auto'. Ficha assinada por humano não é tocada — a parede de
-- `revela_aplicar_rating_inicial` continua valendo.
select t.slug,
       t.overall as antes,
       (public.revela_aplicar_rating_inicial(t.id) ->> 'overall')::int as depois
  from public.revela_talents t
 where t.rating_source = 'auto'
 order by t.created_at desc;


-- ─── Verificação ────────────────────────────────────────────────────────────
-- O teste não pode mais derrubar a ficha de quem respondeu bem:
--
--   select public.revela_ovr('LD', public.revela_rating_inicial(
--     'LD','sub20',2007,178,false,null)) as sem_dna,
--          public.revela_ovr('LD', public.revela_rating_inicial(
--     'LD','sub20',2007,178,false,
--     '{"disciplina":50,"adaptacao":42,"lideranca":28,"estrategia":22,
--       "construcao":20,"decisao":14,"competitividade":12}'::jsonb)) as com_dna;
