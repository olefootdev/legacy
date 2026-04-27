# 📘 Coach Skills · PlaybookV1

**Versão:** 1.0
**Status:** Spec aprovada — pronto pra implementação
**Última revisão:** 2026-04-24

## Visão geral

**Coach Skills** são pacotes de comportamento tático criados por treinadores fictícios (escolas/filosofias) que **managers compram, desbloqueiam e atribuem a jogadores**. Cada skill é um JSON estruturado consumido pelo `PlayerDecisionEngine` em runtime — zero LLM em partida, comportamento determinístico e auditável.

A skill **não inventa comportamento novo**: ela re-pesa os scores das ações que o motor já executa (passe, drible, chute, marcação, posicionamento). É como um treinador real instruindo *quando* e *como* o jogador deve fazer cada coisa.

### Por que isso importa

- Cria **mercado de lógica tática**, não só de stats — diferencial de manager engajado vs casual
- Reaproveita o motor existente (PlayerDecisionEngine + score-based decisions)
- Modela monetização não-pay-to-win: skill premium ainda depende de atributo do jogador
- Loop claro de progressão: novo tier desbloqueia novas escolas

---

## Arquitetura (alto nível)

```
AUTORIA (admin)                MERCADO (manager)             RUNTIME (partida)
┌─────────────────────┐        ┌────────────────────┐        ┌──────────────────┐
│ Admin curates       │        │ Manager browses    │        │ PlayerDecision   │
│ catálogo via Claude │ ────►  │ Academia, compra   │ ────►  │ Engine reads     │
│ Skill (autoring     │        │ ou desbloqueia     │        │ assignedSkills,  │
│ tool)               │        │ via missão. Atribui│        │ aplica bias em   │
│                     │        │ a jogador.         │        │ scores. Bias soma│
│ Output: PlaybookV1  │        │                    │        │ aos pesos das    │
│ JSON validado       │        │ Slots = nível do   │        │ ações candidatas │
│                     │        │ staff da role      │        │                  │
└─────────────────────┘        └────────────────────┘        └──────────────────┘
       ↓                                ↓                              ↓
   Salva em                       PlayerEntity.                 Decision pick
   coach_skills_catalog           assignedSkills[]              já enviesada
```

---

## Schema PlaybookV1

### TypeScript

```ts
export type SkillRole = 'goleiro' | 'zagueiro' | 'lateral' | 'volante' | 'meia' | 'ponta' | 'atacante';

export type SkillTier = 'generica' | 'historica' | 'lendaria';

export interface BehaviorBias {
  /** Mapa <chave-do-score: ajuste-aditivo>. Clamp ±0.30 por chave. */
  [scoreKey: string]: number;
}

export interface SkillBehavior {
  id: string;                    // ex: 'bh_saida_curta'
  name: string;                  // "Saída curta pro zagueiro"
  /**
   * DSL simples avaliada pelo runtime sem eval — combina campos do contexto:
   *   carrier_is_me, team_has_ball, zone, opp_press_nearby, no_press_nearby,
   *   ball_in_my_box_zone, opp_through_ball, attacker_isolated, my_zone_depth,
   *   shot_incoming, shot_power, opp_crossing, opp_counter, my_side_overlap, ...
   */
  when: string;
  bias: BehaviorBias;
  /** Cooldown em segundos (de jogo) entre ativações deste behavior. */
  cooldownSec?: number;
  /** Aplica bias secundário a colegas próximos da role indicada. */
  teammateEffect?: {
    scope: SkillRole | 'all';
    radius?: number;             // metros, default 25
    bias: BehaviorBias;
  };
  /** Behavior só ativo a partir de skill.level >= este valor. */
  minSkillLevel?: number;
}

export interface SkillUnlockRequirements {
  /** Tier mínimo de carreira (1=Fraldinha ... 8=Lenda). Default 1. */
  minCareerTier?: number;
  /** Custo em EXP (acumulado, gasta do saldo). */
  priceExp?: number;
  /** Custo em BRO cents. */
  priceBroCents?: number;
  /** Conquistas/missões necessárias (todas devem estar resgatadas). */
  requiredAchievementIds?: string[];
  /** Janela de disponibilidade (ISO). Fora da janela: invisível ou “esgotada”. */
  availableFromIso?: string;
  availableUntilIso?: string;
}

export interface CoachSkill {
  schema: 'playbook_v1';
  id: string;                    // 'skl_escola_taffarel'
  name: string;                  // "Escola Taffarel"
  role: SkillRole;
  tier: SkillTier;               // generica | historica | lendaria
  philosophy: string;            // texto curto de venda na loja
  level: number;                 // 1-5 (manager pode evoluir)
  attrRequirements?: Partial<Record<keyof PlayerAttributes, number>>;
  behaviors: SkillBehavior[];
  unlock: SkillUnlockRequirements;
  /** Campos de UI: imagem, cor, ícone. */
  presentation?: {
    badgeColor?: string;
    iconKey?: string;
    heroImageUrl?: string;
  };
  /** Para auditoria: refs usadas pelo Claude Skill ao gerar este playbook. */
  research?: { seeds: string[] };
}
```

### Validação ao salvar (server)

- `behaviors.length` entre 2 e 12
- Cada `bias` valor: clamped em `[-0.30, +0.30]`
- `attrRequirements` valores em `[0, 100]`
- `unlock`: pelo menos um requisito definido (tier OU price OU achievement)
- `id` deve casar regex `^skl_[a-z0-9_]{3,40}$`

---

## 3 Camadas de catálogo

### Camada 1 — Genéricas (`tier: 'generica'`)

- **Acesso**: liberadas pra todos no onboarding (tier Fraldinha)
- **Custo**: zero
- **Behaviors**: 2-3 por skill, bias suaves
- **Slots**: ocupam slot normal
- **Propósito**: o jogador casual tem o básico funcional sem pagar nada
- **Exemplos**:
  - `skl_goleiro_padrao` — distribuição segura, sair em cruzamento
  - `skl_atacante_padrao` — chute na área, recuperar no rival
  - `skl_meia_padrao` — passe pra frente quando livre

### Camada 2 — Históricas (`tier: 'historica'`)

- **Acesso**: compráveis (EXP ou BRO) **e/ou** desbloqueáveis por conquista
- **Custo típico**:
  - EXP: 50.000 a 500.000 (acessível pra quem joga)
  - BRO: R$ 4,99 a R$ 19,99 (atalho pra quem prefere pagar)
- **Behaviors**: 5-7, bias mais marcantes
- **Tier mínimo**: Juvenil (Tier 2) ou Amador (Tier 3)
- **Exemplos**:
  - `skl_escola_taffarel` — saída curta + reflexo + comando de linha
  - `skl_ferrolho_italiano` — antecipação + falta calculada
  - `skl_busquets_pivot` — cobertura zonal + passe vertical

### Camada 3 — Lendárias (`tier: 'lendaria'`)

- **Acesso**: combinação restrita
  - Tier mínimo Profissional+ (Tier 4)
  - Preço alto (>200k EXP ou >R$ 49,99 BRO)
  - Janela limitada (1 mês por temporada)
  - Conquista exclusiva (ex.: campeão de competição)
- **Behaviors**: 8-10, com behaviors únicos não disponíveis em outras
- **Status**: **exclusiva do dono** (não-transferível na v1; mercado secundário fica pra v2)
- **Exemplos**:
  - `skl_buffon_muralha` — defende impossível em 1v1, +reflex clutch
  - `skl_pirlo_orquestrador` — passes longos progressivos com 90%+ precisão
  - `skl_neuer_libero` — goleiro joga adiantado como zagueiro extra

---

## Modelo de slots (ativação)

### Por que slots

Sem limite, manager rico empilha 20 skills no mesmo zagueiro e quebra balance. Slots forçam **escolha estratégica**.

### Regra: slots por staff role

Cada staff role do `/team/staff` (ja existente) governa quantas skills ativas dessa role o manager pode ter no plantel.

```
Preparador de Goleiros nível 1 → 1 skill ativa de role 'goleiro' no plantel
Preparador de Goleiros nível 3 → 3 skills ativas
Preparador de Goleiros nível 5 → 5 skills ativas

Preparador Físico nível N → N skills ativas de role 'lateral'/'volante'/'fisico-related'
... e assim por diante
```

Mapeamento staff → role:
- `preparador_goleiros` → `goleiro`
- `tatico` → `meia`, `volante`
- `treinador` → `atacante`, `ponta`, ataque em geral
- `mental` → `zagueiro`, `lateral` (postura, antecipação)

Isso integra Skills à economia de staff que **já existe** e dá motivo extra pra evoluir o staff (que hoje só tem buff coletivo).

### Atribuição

UI em `/team/staff` ganha 3ª seção (depois de "Profissionais" e "Buff por jogador"):

```
┌── ESCOLAS DE TREINADOR ──────────────────────────┐
│  3 escolas adquiridas · 1/3 slots usados         │
│                                                  │
│  📘 Escola Taffarel (goleiro)        [ATIVA]     │
│      → Ederson (slot 1/2 goleiro)                │
│                                                  │
│  📘 Ferrolho Italiano (zagueiro)     [INATIVA]   │
│      [Atribuir a jogador ▼]                      │
│                                                  │
│  📘 Atacante Padrão (atacante)       [ATIVA]     │
│      → Pedro (slot 1/3 atacante)                 │
│                                                  │
│  [Ir à Academia →]                               │
└──────────────────────────────────────────────────┘
```

---

## Mercado / Loja — Academia de Treinadores

### Onde fica

Nova rota `/store/academia` (sub-aba da `/store` atual) ou aba dentro de `/team/staff`. **Recomendação: sub-aba em `/store`** — coerente com fluxo de compra.

### Layout proposto

```
ACADEMIA DE TREINADORES                            [Filtros ▼]

[Tab: Genéricas | Históricas | Lendárias]

┌── HISTÓRICAS ────────────────────────────────────┐
│                                                  │
│ ┌──────────────────┐  ┌──────────────────┐      │
│ │ 🥅 Escola        │  │ 🛡 Ferrolho      │      │
│ │ Taffarel         │  │ Italiano         │      │
│ │                  │  │                  │      │
│ │ Goleiro · 5 bh.  │  │ Zagueiro · 6 bh. │      │
│ │                  │  │                  │      │
│ │ Saída curta +    │  │ Antecipação +    │      │
│ │ reflexo + linha  │  │ leitura de jogo  │      │
│ │                  │  │                  │      │
│ │ Tier: Juvenil+   │  │ Tier: Amador+    │      │
│ │                  │  │                  │      │
│ │ [120k EXP]       │  │ [180k EXP]       │      │
│ │ [R$ 9,99 BRO]    │  │ [R$ 14,99 BRO]   │      │
│ │ [Adquirir →]     │  │ [Adquirir →]     │      │
│ └──────────────────┘  └──────────────────┘      │
│                                                  │
│ ┌──────────────────┐                             │
│ │ ⚡ Carrasco da   │ [TRAVADA — Tier Profis.]    │
│ │ Área (ATA)       │                             │
│ └──────────────────┘                             │
└──────────────────────────────────────────────────┘
```

### Estados de cada card

- **Adquirir** (preço EXP/BRO disponíveis, requisitos OK)
- **Travada** (Tier insuficiente; mostra qual tier precisa)
- **Por conquista: "Vence 10 partidas"** (com barra de progresso)
- **Adquirida ✓** (cinza com check, "Atribuir em /team/staff")
- **Esgotada** (lendária fora da janela)

---

## Conquistas que destravam Skills

Algumas Skills são **só por mérito** — não vendem. Cria narrativa de glória.

### Exemplos

| Skill | Conquista pra desbloquear |
|---|---|
| `skl_muralha_italiana` (zagueiro) | 10 partidas oficiais com 0 gols sofridos |
| `skl_artilheiro_clutch` (atacante) | 5 gols decisivos (em jogos com diff ≤1 nos últimos 10 min) |
| `skl_passe_de_chapeu` (meia) | 50 dribles bem-sucedidos numa temporada |
| `skl_lider_vestiario` (capitão/qualquer) | Ganhar 1 título com plantel 100% academia (sem genesis) |

Manager vê barra de progresso pra cada conquista locked → motivação clara.

---

## 5 Skills canônicas exemplares (MVP)

### 1. `skl_goleiro_padrao` (Camada 1, free)

```jsonc
{
  "id": "skl_goleiro_padrao",
  "name": "Goleiro Padrão",
  "role": "goleiro",
  "tier": "generica",
  "philosophy": "Defesa segura + distribuição básica.",
  "level": 1,
  "behaviors": [
    {
      "id": "bh_passe_curto_seguro",
      "name": "Passe curto pro zagueiro mais próximo",
      "when": "team_has_ball && carrier_is_me && no_press_nearby",
      "bias": { "passShortToDefender": 0.20, "clearBall": -0.10 }
    },
    {
      "id": "bh_chutao_sob_pressao",
      "name": "Afastar quando pressionado",
      "when": "team_has_ball && carrier_is_me && opp_press_nearby",
      "bias": { "clearBall": 0.25, "passShortToDefender": -0.15 }
    }
  ],
  "unlock": { "minCareerTier": 1 }
}
```

### 2. `skl_escola_taffarel` (Camada 2, comprável)

```jsonc
{
  "id": "skl_escola_taffarel",
  "name": "Escola Taffarel",
  "role": "goleiro",
  "tier": "historica",
  "philosophy": "Defesa segura, reflexo elite e comando de linha defensiva.",
  "level": 3,
  "attrRequirements": { "mentalidade": 70 },
  "behaviors": [
    {
      "id": "bh_saida_curta",
      "name": "Saída curta pro zagueiro",
      "when": "team_has_ball && carrier_is_me && no_press_nearby",
      "bias": { "passShortToDefender": 0.30, "clearBall": -0.18 }
    },
    {
      "id": "bh_antecipar_cruzamento",
      "name": "Sair pra cortar cruzamento",
      "when": "opp_crossing && ball_in_my_box_zone",
      "bias": { "cornerCatch": 0.28, "stayOnLine": -0.15 },
      "cooldownSec": 30
    },
    {
      "id": "bh_defender_1v1",
      "name": "Fechar ângulo em 1v1",
      "when": "opp_through_ball && attacker_isolated",
      "bias": { "advanceToCloseAngle": 0.40, "diveEarly": -0.22 }
    },
    {
      "id": "bh_reflexo_rebote",
      "name": "Espalmar pro lado em rebote",
      "when": "shot_incoming && shot_power == 'power'",
      "bias": { "parryToSide": 0.28, "holdRisk": -0.18 }
    },
    {
      "id": "bh_comando_linha",
      "name": "Organiza linha de defesa",
      "when": "zone == 'def' && team_defending",
      "bias": { "organizeLine": 0.18 },
      "teammateEffect": {
        "scope": "zagueiro",
        "radius": 22,
        "bias": { "holdLine": 0.10, "trackRunner": 0.08 }
      }
    }
  ],
  "unlock": {
    "minCareerTier": 2,
    "priceExp": 120000,
    "priceBroCents": 999
  },
  "research": {
    "seeds": ["Cláudio Taffarel Copa 94 Brasil", "Liverpool Alisson saída curta"]
  }
}
```

### 3. `skl_ferrolho_italiano` (Camada 2, comprável)

```jsonc
{
  "id": "skl_ferrolho_italiano",
  "name": "Ferrolho Italiano",
  "role": "zagueiro",
  "tier": "historica",
  "philosophy": "Antecipação + leitura + falta calculada quando necessário.",
  "level": 3,
  "attrRequirements": { "marcacao": 75, "tatico": 70 },
  "behaviors": [
    {
      "id": "bh_antecipar_passe",
      "name": "Roubar antes do atacante",
      "when": "opp_through_ball && my_distance_to_ball < 6",
      "bias": { "interceptionAttempt": 0.35, "stayInLine": -0.15 }
    },
    {
      "id": "bh_falta_estrategica",
      "name": "Falta tática pra parar contra",
      "when": "opp_counter && my_zone_depth < 0.4 && no_other_defender",
      "bias": { "tacticalFoul": 0.30, "letRunGo": -0.25 }
    },
    {
      "id": "bh_marca_homem",
      "name": "Marcação individual no homem-gol",
      "when": "opp_in_box && opponent_is_top_scorer",
      "bias": { "manMark": 0.32, "zonalMark": -0.20 }
    },
    {
      "id": "bh_lider_defesa",
      "name": "Sobe linha quando time tem posse",
      "when": "team_has_ball && my_zone == 'def'",
      "bias": { "stepUpLine": 0.20 },
      "teammateEffect": {
        "scope": "zagueiro",
        "bias": { "stepUpLine": 0.15 }
      }
    }
  ],
  "unlock": {
    "minCareerTier": 3,
    "priceExp": 180000,
    "priceBroCents": 1499
  }
}
```

### 4. `skl_artilheiro_clutch` (Camada 2, **só por conquista**)

```jsonc
{
  "id": "skl_artilheiro_clutch",
  "name": "Artilheiro Clutch",
  "role": "atacante",
  "tier": "historica",
  "philosophy": "Sangue frio nos minutos finais. Decide o jogo.",
  "level": 3,
  "attrRequirements": { "mentalidade": 80, "finalizacao": 75 },
  "behaviors": [
    {
      "id": "bh_chute_clutch",
      "name": "Finaliza com calma na pressão",
      "when": "minute > 75 && score_diff <= 1",
      "bias": { "shotPlaced": 0.30, "shotPower": -0.15 }
    },
    {
      "id": "bh_busca_jogada",
      "name": "Pede a bola no minuto final",
      "when": "minute > 85 && team_has_ball",
      "bias": { "callForBall": 0.40, "stayPositioned": -0.20 }
    },
    {
      "id": "bh_chute_panico_inverso",
      "name": "Não força em vantagem",
      "when": "score_diff > 1 && minute > 70",
      "bias": { "passSafe": 0.25, "shotForce": -0.20 }
    }
  ],
  "unlock": {
    "minCareerTier": 3,
    "requiredAchievementIds": ["clutch_goal_5x"]
  }
}
```

### 5. `skl_buffon_muralha` (Camada 3, lendária)

```jsonc
{
  "id": "skl_buffon_muralha",
  "name": "Buffon — Muralha",
  "role": "goleiro",
  "tier": "lendaria",
  "philosophy": "Goleiro absoluto. Defende o impossível, intimida atacante.",
  "level": 5,
  "attrRequirements": { "mentalidade": 88, "fisico": 78, "marcacao": 80 },
  "behaviors": [
    {
      "id": "bh_defesa_impossivel",
      "name": "Reflexo extremo em chute esperado",
      "when": "shot_incoming",
      "bias": { "parryToSide": 0.28, "spectacularSave": 0.30 }
    },
    {
      "id": "bh_intimida_penalti",
      "name": "Intimida o batedor de pênalti",
      "when": "penalty_shootout_or_kick",
      "bias": { "penaltyMindGame": 0.35 },
      "teammateEffect": {
        "scope": "all",
        "bias": { "moraleBoost": 0.08 }
      }
    },
    {
      "id": "bh_lider_de_grupo",
      "name": "Empurra moral em momento crítico",
      "when": "score_diff <= -1 && minute > 70",
      "bias": {},
      "teammateEffect": {
        "scope": "all",
        "bias": { "moraleBoost": 0.12, "willToWin": 0.10 }
      }
    },
    {
      "id": "bh_distribuicao_longa",
      "name": "Lançamento longo certeiro",
      "when": "team_recovered_ball && counter_window",
      "bias": { "longLaunchAccurate": 0.32 }
    }
  ],
  "unlock": {
    "minCareerTier": 4,
    "priceBroCents": 4999,
    "availableFromIso": "2026-10-01T00:00:00Z",
    "availableUntilIso": "2026-10-31T23:59:59Z"
  }
}
```

---

## Banco de dados (proposta)

```sql
-- Catálogo (admin-curated)
create table coach_skills_catalog (
  id text primary key,            -- 'skl_escola_taffarel'
  schema_version int not null default 1,
  name text not null,
  role text not null,
  tier text not null,
  level int not null,
  payload jsonb not null,         -- PlaybookV1 completo
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Skills que cada manager possui (compradas/desbloqueadas)
create table manager_owned_skills (
  user_id uuid references auth.users(id) on delete cascade,
  skill_id text references coach_skills_catalog(id),
  acquired_at timestamptz not null default now(),
  acquired_via text not null,     -- 'purchase_exp' | 'purchase_bro' | 'achievement' | 'gift'
  primary key (user_id, skill_id)
);
alter table manager_owned_skills enable row level security;
create policy "user reads own skills" on manager_owned_skills
  for select using (auth.uid() = user_id);

-- Atribuições ativas (skill_id atribuído a player_id no save do manager)
create table manager_skill_assignments (
  user_id uuid references auth.users(id) on delete cascade,
  player_entity_id text not null,  -- ID do jogador no save (não FK porque é client-state)
  skill_id text references coach_skills_catalog(id),
  assigned_at timestamptz not null default now(),
  primary key (user_id, player_entity_id, skill_id)
);
alter table manager_skill_assignments enable row level security;
```

---

## Plano de implementação (4 fases)

### Fase 1 — Foundation (1-2 dias)
1. Migrations: `coach_skills_catalog`, `manager_owned_skills`, `manager_skill_assignments`
2. TypeScript types + validador (zod ou manual) do PlaybookV1
3. Seed: 3 Camada 1 (genéricas, free) + 3 Camada 2 (compráveis)
4. RPCs: `get_skills_catalog()`, `get_my_owned_skills()`, `purchase_skill(skill_id, currency)`

### Fase 2 — Loja + Atribuição (1-2 dias)
1. Sub-aba `/store/academia` com cards visuais filtrando por role/tier
2. Botão "Adquirir" → confirma → debita EXP/BRO → grava em `manager_owned_skills`
3. Seção "Escolas" no `/team/staff` (3ª seção do accordion)
4. Atribuição: dropdown de jogador compatível (role + attrRequirements) por skill possuída
5. RPCs: `assign_skill_to_player(player_id, skill_id)`, `unassign_skill(...)`
6. Slots: respeita `maxStaffSlotsByLevel(staffRoleForSkill)`

### Fase 3 — Runtime (1-2 dias)
1. Player.assignedSkills (array de skill_ids) hidratado de Supabase
2. Helper `applySkillBiasToScores(player, ctx, scores)` em `src/playerDecision/skillBias.ts`
3. Wire em `OnBallDecision.decideOnBall` e `OffBallDecision.decideOffBall`: aplica bias após scores baseline
4. Tradutor `when`-DSL → função TS: começa simples (parser direto, sem eval)
5. Cooldowns por behavior (Map<skillId+behaviorId, lastTickMs>)

### Fase 4 — Conquista + Polish (1-2 dias)
1. Tabela `manager_achievements` se ainda não existe; integra catálogo
2. Skills com `requiredAchievementIds` aparecem na loja com barra de progresso
3. Ao completar achievement, RPC concede skill automaticamente
4. UI feedback: notificação inbox "Você desbloqueou Escola Buffon!"
5. Stats pós-jogo: linha "+X% pass success com Escola Busquets ativa" no Postgame

---

## Vocabulário espacial (SmartField)

A `when` clause de cada behavior pode referenciar **36 zonas reais** definidas no SmartField (`src/smartfield/smartfield_snapshot.json`) e helpers semânticos em `src/match/spatialZones.ts`.

### Predicados disponíveis

```
isBox(zone)           — bola na grande área (box_left/center/right)
isSixYard(zone)       — bola na pequena área (six_yard_*)
isGoalmouth(zone)     — bola colada no gol
isCreationZone(zone)  — zona criativa (creation_left/center/right)
isPressZone(zone)     — zona de pressão alta
isBuildUpZone(zone)   — zona de construção
isFinalThird(zone)    — terço final atacante (attacking_*)
isMidThird(zone)      — meio campo
isDefThird(zone)      — terço defensivo
isWing(zone)          — corredor lateral
isHalfspace(zone)     — meio-corredor
isCentralLane(zone)   — corredor central
laneOf(zone)          — 'left' | 'center' | 'right'
distToOppGoalMeters() — distância em metros ao gol adversário
dangerToOppGoal01()   — perigo 0..1 (1 = colado no gol)
```

### IDs canônicos referenciáveis em `when`

```
defensive_left_wing | defensive_left_halfspace | defensive_center | defensive_right_halfspace | defensive_right_wing
middle_left_wing | middle_left_halfspace | middle_center | middle_right_halfspace | middle_right_wing
attacking_left_wing | attacking_left_halfspace | attacking_center | attacking_right_halfspace | attacking_right_wing
recovery_left | recovery_center | recovery_right
build_up_left | build_up_center | build_up_right
press_left | press_center | press_right
creation_left | creation_center | creation_right
box_left | box_center | box_right
six_yard_left | six_yard_center | six_yard_right
goalmouth_left | goalmouth_center | goalmouth_right
```

### Exemplo aplicado a Skill

```jsonc
{
  "id": "bh_finalizar_dentro_box",
  "when": "carrier_is_me && isBox(zone)",
  "bias": { "shotPlaced": 0.45, "passShortBack": -0.30 }
}
```

Sem isso o jogo vira o que você descreveu: jogador toca pra trás na cara do gol porque não sabe **onde** está. Com o vocabulário acima, todo behavior fica espacialmente coerente.

## Pontos a definir antes de implementar

- [ ] Lista exata de **chaves de score** (vocabulário do bias) — extrair de `OnBallDecision.scorePassForIntention` e similares
- [ ] DSL final do `when` — começar com gramática mínima (`&&`, `==`, `<`, `>`) + chamadas a predicados (`isBox(zone)`, `laneOf(zone)`)
- [ ] Política de **refund**: manager pode devolver skill recém-comprada por engano? (sugestão: 24h, 1x por skill)
- [ ] **Equilíbrio**: jogadores precisam testar skills compradas em modo treino sem custo? (sugestão: 1 partida-trial por skill ao adquirir)

---

## Mercado projetado

- **20-30 skills** no catálogo inicial
- **5-7** Camada 1 (genéricas, free)
- **12-18** Camada 2 (históricas, EXP ou BRO)
- **3-5** Camada 3 (lendárias, premium + sazonal)
- Preços médios: 80-300k EXP / R$ 5-20 BRO Camada 2; R$ 30-50 BRO Camada 3
- Loop: manager joga → ganha EXP → compra skill → atribui → vê resultado → quer próxima

A inovação real: **não é mais buff numérico fechado** (como o staff atual), é **lógica de decisão** que muda como o jogador joga. Mercado vira de *conhecimento tático*, não só de *boosters numéricos*.
