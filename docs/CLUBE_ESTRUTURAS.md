# Clube — estruturas, níveis e efeitos de jogo

Este documento descreve as regras implementadas no cliente (reducer, simulação de partida, treinos e recuperação). Os custos de **upgrade** (EXP / BRO) continuam em `src/clubStructures/expCosts.ts` e `broDefaults.ts`.

## Tabelas por nível (1–5)

### Categoria de base (`youth_academy`)

| Nível | Efeito |
|------|--------|
| 1–2 | Promessas (`archetype === novo_talento`): **+20%** no ganho de atributos ao completar planos de treino (multiplicador sobre o resultado já amplificado por staff). |
| 3 | **+30%** |
| 4 | **+40%** |
| 5 | **+50%** |

Implementação: `youthAcademyProspectTrainingMultiplier` em `src/clubStructures/benefits.ts`, aplicada em `COMPLETE_DUE_TRAININGS` no reducer.

---

### Megaloja (`megastore`)

**Apoio da torcida (simulação e assistência)**  
Pontos somados ao `crowd.supportPercent` base (limitado a 99):

| Nível | Em casa | Fora |
|------|-----------|------|
| 1 | +10 | — |
| 2 | +20 | — |
| 3 | +30 | — |
| 4 | +40 | +10 |
| 5 | +50 | +20 |

Funções: `megastoreHomeConfidenceBonusPoints`, `megastoreAwayConfidenceBonusPoints`, `effectiveCrowdSupportPercent`.

**EXP em vitória**  
Só em **vitória**: EXP extra = `round(apoioEfectivo × coeficiente)`, com coeficiente por nível (0,35 … 1,15). Ver `megastoreWinExpFromCrowd`.

---

### Departamento médico (`medical_dept`)

| Nível | Slots de tratamento | Bónus velocidade recuperação |
|------|---------------------|------------------------------|
| 1 | 1 | +10% |
| 2 | 3 | +20% |
| 3 | 5 | +30% |
| 4 | 7 | +40% |
| 5 | 10 | +50% |

**Slots:** planos em `manager.treatmentPlans`; iniciar com acção `START_TREATMENT_PLAN` (UI em `/team/treino`). Conclusão automática com `COMPLETE_DUE_TRAININGS` (mesmo fluxo que treinos vencidos).

**Recuperação %** afecta:

- `tickRecoveryMatches` (chance de decrementar 2 jogos de lesão em vez de 1, por jogador, de forma determinística por id);
- `recoverOffMatch` em `worldCatchUp.ts`;
- efeito do mutirão rápido `CITY_QUICK_MEDICAL_MUTIRAO` (fadiga / risco escalados);
- efeito ao **concluir** um plano de tratamento (`applyTreatmentCompletionToPlayer`).

Constantes auxiliares: `medicalDeptTreatmentSlots`, `medicalDeptRecoverySpeedBonusPercent`.

---

### Centro de treinamento (`training_center`)

| Nível | Slots por **tipo** de treino | Colectivos simultâneos | AI Labs | Booster ganho atributos |
|------|------------------------------|-------------------------|---------|---------------------------|
| 1 | 1 | 1 | Não | — |
| 2 | 3 | 1 | Sim (`/team/ailabs`) | — |
| 3 | 5 | 3 | Sim | — |
| 4 | 7 | 3 | Sim | **+25%** |
| 5 | 10 | 3 | Sim | **+35%** |

- Slots por tipo: `maxSlotsByTrainingCenter` → `trainingCenterSlotsPerSkillType`.
- Limite de colectivos: `trainingCenterMaxConcurrentCollectivePlans` (bloqueio no reducer em `START_TEAM_TRAINING_PLAN` e `CITY_QUICK_TRAINING_INTENSIVO`).
- Booster CT: `trainingCenterAttributeGainMultiplier` (multiplicador composto com staff e base).

---

### Estádio (`stadium`)

| Nível | Capacidade | EXP por “assistente” (jogos em **casa**) |
|------|------------|------------------------------------------|
| 1 | 10 000 | 0,1 |
| 2 | 25 000 | 0,15 |
| 3 | 35 000 | 0,2 |
| 4 | 50 000 | 0,25 |
| 5 | 75 000 | 0,5 |

**Assistência:** `floor(capacidade × apoioEfectivo / 100)` com apoio efectivo já incluindo Megaloja em jogos em casa.

**EXP estádio:** `floor(assistência × taxa)` — creditada em **todo** o jogo oficial em casa (vitória ou não), no total da recompensa EXP da jornada (`FINALIZE_MATCH` e simulação de liga em `processLeagueSchedule.ts`).

O upgrade pontual do estádio continua a somar `STADIUM_UPGRADE_CROWD_DELTA` ao apoio base (`cityQuickConstants.ts`).

---

## Ficheiros principais

| Área | Ficheiro |
|------|-----------|
| Tabelas e puro | `src/clubStructures/benefits.ts` |
| Tratamentos | `src/systems/medicalTreatment.ts` |
| Treino slots | `src/systems/trainingPlans.ts` |
| Pós-jogo EXP / lesões | `src/game/reducer.ts`, `src/match/processLeagueSchedule.ts` |
| Recuperação offline | `src/game/worldCatchUp.ts` |
| Lesões pós-jornada | `src/systems/injury.ts` |

---

## Notas de desenho

- O apoio **base** (`crowd.supportPercent`) não é persistido por versão “efectiva”; a versão efectiva é calculada quando entra na simulação ou no cálculo de prémios.
- A Megaloja **não** duplica o cálculo do estádio: o estádio usa o apoio já “enchido” pela Megaloja para a assistência; a Megaloja acrescenta ainda um termo EXP só em **vitória**.
