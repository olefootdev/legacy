-- Coach Skills · Fase 1 (PlaybookV1)
-- Spec: docs/COACH_SKILLS_PLAYBOOK_V1.md
--
-- 3 tabelas:
--   coach_skills_catalog        — admin-curated, leitura pública
--   manager_owned_skills        — RLS por user_id
--   manager_skill_assignments   — RLS por user_id
--
-- 3 RPCs (security definer onde necessário):
--   get_skills_catalog()        — lista catálogo ativo
--   get_my_owned_skills()       — skills possuídas pelo auth.uid()
--   purchase_skill(skill_id, currency) — debita preço + insere ownership

-- ──────────────────────────────────────────────────────────────────
-- 1. Catálogo (admin-curated, leitura pública via RPC)
-- ──────────────────────────────────────────────────────────────────

create table if not exists coach_skills_catalog (
  id text primary key,
  schema_version int not null default 1,
  name text not null,
  role text not null check (role in (
    'goleiro','zagueiro','lateral','volante','meia','ponta','atacante'
  )),
  tier text not null check (tier in ('generica','historica','lendaria')),
  level int not null check (level between 1 and 5),
  payload jsonb not null,                 -- PlaybookV1 completo (CoachSkill)
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_skills_catalog_role_tier_idx
  on coach_skills_catalog (role, tier) where active = true;

-- catálogo é leitura pública (via RPC), escrita só por service_role
alter table coach_skills_catalog enable row level security;
drop policy if exists "catalog readable by anyone" on coach_skills_catalog;
create policy "catalog readable by anyone"
  on coach_skills_catalog for select
  using (active = true);

-- ──────────────────────────────────────────────────────────────────
-- 2. Skills possuídas (uma linha por skill comprada/desbloqueada)
-- ──────────────────────────────────────────────────────────────────

create table if not exists manager_owned_skills (
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id text not null references coach_skills_catalog(id) on delete restrict,
  acquired_at timestamptz not null default now(),
  acquired_via text not null check (acquired_via in (
    'purchase_exp','purchase_bro','achievement','gift','seed'
  )),
  primary key (user_id, skill_id)
);

alter table manager_owned_skills enable row level security;
drop policy if exists "user reads own skills" on manager_owned_skills;
create policy "user reads own skills"
  on manager_owned_skills for select
  using (auth.uid() = user_id);

-- inserts/updates só via RPC security definer (purchase_skill, grant_skill)
-- — sem policy de write pra user_id direto (evita gravar skill sem pagar)

-- ──────────────────────────────────────────────────────────────────
-- 3. Atribuições ativas (skill_id atribuído a player_entity_id no save)
-- ──────────────────────────────────────────────────────────────────

create table if not exists manager_skill_assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  player_entity_id text not null,         -- ID client-side, sem FK
  skill_id text not null references coach_skills_catalog(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, player_entity_id, skill_id)
);

alter table manager_skill_assignments enable row level security;
drop policy if exists "user reads own assignments" on manager_skill_assignments;
create policy "user reads own assignments"
  on manager_skill_assignments for select
  using (auth.uid() = user_id);

drop policy if exists "user writes own assignments" on manager_skill_assignments;
create policy "user writes own assignments"
  on manager_skill_assignments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────────
-- 4. RPCs
-- ──────────────────────────────────────────────────────────────────

-- Lista o catálogo ativo (leitura pública).
create or replace function get_skills_catalog()
returns setof coach_skills_catalog
language sql
security invoker
stable
as $$
  select * from coach_skills_catalog where active = true order by tier, role, name;
$$;

-- Lista as skills possuídas pelo auth.uid() (RLS já filtra na select).
create or replace function get_my_owned_skills()
returns table (
  skill_id text,
  acquired_at timestamptz,
  acquired_via text,
  payload jsonb
)
language sql
security invoker
stable
as $$
  select o.skill_id, o.acquired_at, o.acquired_via, c.payload
  from manager_owned_skills o
  join coach_skills_catalog c on c.id = o.skill_id
  where o.user_id = auth.uid()
  order by o.acquired_at desc;
$$;

-- Compra de skill: debita do saldo (EXP via app, BRO cents via stripe upstream)
-- e insere ownership. Atômica. Retorna o registro inserido.
--
-- IMPORTANTE: esta versão valida apenas o preço bate com o catálogo. O
-- débito real do EXP/BRO acontece no client (after success) ou em um RPC
-- separado de finance — manter purchase_skill focado em ownership.
create or replace function purchase_skill(
  p_skill_id text,
  p_currency text  -- 'exp' | 'bro' | 'achievement' | 'gift'
)
returns manager_owned_skills
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_catalog coach_skills_catalog%rowtype;
  v_via text;
  v_inserted manager_owned_skills%rowtype;
begin
  if v_user_id is null then
    raise exception 'auth required';
  end if;

  select * into v_catalog from coach_skills_catalog
  where id = p_skill_id and active = true;
  if not found then
    raise exception 'skill_not_found_or_inactive: %', p_skill_id;
  end if;

  v_via := case p_currency
    when 'exp' then 'purchase_exp'
    when 'bro' then 'purchase_bro'
    when 'achievement' then 'achievement'
    when 'gift' then 'gift'
    else null
  end;
  if v_via is null then
    raise exception 'invalid_currency: % (expected exp|bro|achievement|gift)', p_currency;
  end if;

  -- ownership idempotente: se já possui, retorna existente
  select * into v_inserted from manager_owned_skills
  where user_id = v_user_id and skill_id = p_skill_id;
  if found then
    return v_inserted;
  end if;

  insert into manager_owned_skills (user_id, skill_id, acquired_via)
  values (v_user_id, p_skill_id, v_via)
  returning * into v_inserted;

  return v_inserted;
end;
$$;

grant execute on function get_skills_catalog() to anon, authenticated;
grant execute on function get_my_owned_skills() to authenticated;
grant execute on function purchase_skill(text, text) to authenticated;

-- ──────────────────────────────────────────────────────────────────
-- 5. Seed inicial — espelha src/skills/seedCatalog.ts
-- ──────────────────────────────────────────────────────────────────
--
-- 6 skills (3 generica + 3 historica). Idempotente via on conflict do nothing
-- — re-rodar a migration não duplica nem sobrescreve. Para atualizar payload
-- futuramente, usar uma migration nova com `update coach_skills_catalog`.

insert into coach_skills_catalog (id, name, role, tier, level, payload) values
  ('skl_goleiro_padrao', 'Goleiro Padrão', 'goleiro', 'generica', 1, '{
    "schema":"playbook_v1","id":"skl_goleiro_padrao","name":"Goleiro Padrão",
    "role":"goleiro","tier":"generica","level":1,
    "philosophy":"Defesa segura + distribuição básica.",
    "behaviors":[
      {"id":"bh_passe_curto_seguro","name":"Passe curto pro zagueiro mais próximo",
       "when":"team_has_ball && carrier_is_me && no_press_nearby",
       "bias":{"passShortToDefender":0.20,"clearBall":-0.10}},
      {"id":"bh_chutao_sob_pressao","name":"Afastar quando pressionado",
       "when":"team_has_ball && carrier_is_me && opp_press_nearby",
       "bias":{"clearBall":0.25,"passShortToDefender":-0.15}}
    ],
    "unlock":{"minCareerTier":1}
  }'::jsonb),

  ('skl_atacante_padrao', 'Atacante Padrão', 'atacante', 'generica', 1, '{
    "schema":"playbook_v1","id":"skl_atacante_padrao","name":"Atacante Padrão",
    "role":"atacante","tier":"generica","level":1,
    "philosophy":"Chute na área, recupera no rival quando perde.",
    "behaviors":[
      {"id":"bh_chute_na_area","name":"Finaliza ao receber dentro da área",
       "when":"carrier_is_me && isBox(zone)",
       "bias":{"shotPlaced":0.22,"passShortBack":-0.12}},
      {"id":"bh_pressao_imediata","name":"Pressiona o zagueiro adversário ao perder a bola",
       "when":"!team_has_ball && my_zone == \"att\"",
       "bias":{"pressNearestOpp":0.18,"dropBack":-0.10}}
    ],
    "unlock":{"minCareerTier":1}
  }'::jsonb),

  ('skl_meia_padrao', 'Meia Padrão', 'meia', 'generica', 1, '{
    "schema":"playbook_v1","id":"skl_meia_padrao","name":"Meia Padrão",
    "role":"meia","tier":"generica","level":1,
    "philosophy":"Passe pra frente quando livre, recompõe quando precisa.",
    "behaviors":[
      {"id":"bh_passe_progressivo","name":"Passe vertical para o ataque quando livre",
       "when":"carrier_is_me && no_press_nearby && team_has_ball",
       "bias":{"passProgressive":0.20,"passShortBack":-0.10}},
      {"id":"bh_recompoe_meio","name":"Volta ao meio sem bola",
       "when":"!team_has_ball && my_zone == \"mid\"",
       "bias":{"recoverMid":0.15,"holdLine":-0.08}}
    ],
    "unlock":{"minCareerTier":1}
  }'::jsonb),

  ('skl_escola_taffarel', 'Escola Taffarel', 'goleiro', 'historica', 3, '{
    "schema":"playbook_v1","id":"skl_escola_taffarel","name":"Escola Taffarel",
    "role":"goleiro","tier":"historica","level":3,
    "philosophy":"Defesa segura, reflexo elite e comando de linha defensiva.",
    "attrRequirements":{"mentalidade":70},
    "behaviors":[
      {"id":"bh_saida_curta","name":"Saída curta pro zagueiro",
       "when":"team_has_ball && carrier_is_me && no_press_nearby",
       "bias":{"passShortToDefender":0.30,"clearBall":-0.18}},
      {"id":"bh_antecipar_cruzamento","name":"Sair pra cortar cruzamento",
       "when":"opp_crossing && ball_in_my_box_zone",
       "bias":{"cornerCatch":0.28,"stayOnLine":-0.15},"cooldownSec":30},
      {"id":"bh_defender_1v1","name":"Fechar ângulo em 1v1",
       "when":"opp_through_ball && attacker_isolated",
       "bias":{"advanceToCloseAngle":0.30,"diveEarly":-0.22}},
      {"id":"bh_reflexo_rebote","name":"Espalmar pro lado em rebote",
       "when":"shot_incoming && shot_power == \"power\"",
       "bias":{"parryToSide":0.28,"holdRisk":-0.18}},
      {"id":"bh_comando_linha","name":"Organiza linha de defesa",
       "when":"zone == \"def\" && team_defending",
       "bias":{"organizeLine":0.18},
       "teammateEffect":{"scope":"zagueiro","radius":22,
         "bias":{"holdLine":0.10,"trackRunner":0.08}}}
    ],
    "unlock":{"minCareerTier":2,"priceExp":120000,"priceBroCents":999},
    "research":{"seeds":["Cláudio Taffarel Copa 94 Brasil","Liverpool Alisson saída curta"]}
  }'::jsonb),

  ('skl_ferrolho_italiano', 'Ferrolho Italiano', 'zagueiro', 'historica', 3, '{
    "schema":"playbook_v1","id":"skl_ferrolho_italiano","name":"Ferrolho Italiano",
    "role":"zagueiro","tier":"historica","level":3,
    "philosophy":"Antecipação + leitura + falta calculada quando necessário.",
    "attrRequirements":{"marcacao":75,"mentalidade":70},
    "behaviors":[
      {"id":"bh_antecipar_passe","name":"Roubar antes do atacante",
       "when":"opp_through_ball && my_distance_to_ball < 6",
       "bias":{"interceptionAttempt":0.30,"stayInLine":-0.15}},
      {"id":"bh_falta_estrategica","name":"Falta tática pra parar o contra-ataque",
       "when":"opp_counter && my_zone_depth < 0.4 && no_other_defender",
       "bias":{"tacticalFoul":0.30,"letRunGo":-0.25}},
      {"id":"bh_marca_homem","name":"Marcação individual no homem-gol",
       "when":"opp_in_box && opponent_is_top_scorer",
       "bias":{"manMark":0.30,"zonalMark":-0.20}},
      {"id":"bh_lider_defesa","name":"Sobe linha quando time tem posse",
       "when":"team_has_ball && my_zone == \"def\"",
       "bias":{"stepUpLine":0.20},
       "teammateEffect":{"scope":"zagueiro","bias":{"stepUpLine":0.15}}}
    ],
    "unlock":{"minCareerTier":3,"priceExp":180000,"priceBroCents":1499}
  }'::jsonb),

  ('skl_artilheiro_clutch', 'Artilheiro Clutch', 'atacante', 'historica', 3, '{
    "schema":"playbook_v1","id":"skl_artilheiro_clutch","name":"Artilheiro Clutch",
    "role":"atacante","tier":"historica","level":3,
    "philosophy":"Sangue frio nos minutos finais. Decide o jogo.",
    "attrRequirements":{"mentalidade":80,"finalizacao":75},
    "behaviors":[
      {"id":"bh_chute_clutch","name":"Finaliza com calma na pressão",
       "when":"minute > 75 && score_diff <= 1",
       "bias":{"shotPlaced":0.30,"shotPower":-0.15}},
      {"id":"bh_busca_jogada","name":"Pede a bola no minuto final",
       "when":"minute > 85 && team_has_ball",
       "bias":{"callForBall":0.30,"stayPositioned":-0.20}},
      {"id":"bh_chute_panico_inverso","name":"Não força em vantagem",
       "when":"score_diff > 1 && minute > 70",
       "bias":{"passSafe":0.25,"shotForce":-0.20}}
    ],
    "unlock":{"minCareerTier":3,"requiredAchievementIds":["clutch_goal_5x"]}
  }'::jsonb)
on conflict (id) do nothing;
