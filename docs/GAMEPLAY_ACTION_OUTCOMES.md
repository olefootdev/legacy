# Gameplay: ações contestadas → outcomes → posse

Documento para managers e devs: o que o motor tático faz **depois** de escolher uma ação (decisão ≠ execução).

## Princípios

- **RNG determinístico**: `simulationSeed` (live) + tick + `playerId` + tipo de ação — reprodutível com `globalThis.__OF_ACTION_RESOLVER_DEBUG__ = true`.
- **Tetos suaves**: ver `src/match/actionResolutionTuning.ts` (`ACTION_SOFT_CAP_*`, `SHOT_*`).
- **Cooldown de posse**: `POSSESSION_LOCK_SEC` em `src/match/matchSimulationTuning.ts`.
- **Zonas IFAB**: `src/match/fieldZones.ts` — **2.º tempo inverte** gol defendido / direção de ataque (`getSideAttackDir`).

## Tabela resumo

| Ação escolhida | Sucesso (ex.) | Falha (ex.) | Efeito na posse |
|----------------|---------------|-------------|------------------|
| Passe (curto/progressivo/longo…) | Bola em voo ao alvo com `targetPlayerId` | Bola solta no meio / interceptação | **Intercept**: posse do interceptador + `applyTurnoverPlay`. **Loose**: sem portador até `pickUpLooseBall`. |
| Cruzamento | Voo ao alvo (área) | Voo com alvo errado (ainda sem `targetPlayerId`) | Portador perde bola; recuperação por proximidade / defesa. |
| Drible (arriscado) | `setArriveTarget` mantém condução | Perda / adversário mais próximo | **Desarme lógico**: posse adversária + turnover play; senão bola solta. |
| Remate | `goal` → reinício FIFA (posse quem sofreu) | `miss` / `save` / `block` | **MVP**: posse vai para o **GR defensor** (ou bola solta perto do golo se não houver GR). Sem voo de bola para não-golo. |
| Desarme (automático) | Defensor ganha | — | Posse defensor + turnover. |
| Clearance | Voo afastando | — | Portador null; recuperação subsequente. |

## Métricas de QA

- `SimMatchState.possessionChangesTotal` e `possessionChangeMinutes`.
- Função `possessionChangesPerMinuteInWindow` / `isPossessionAlternationBelowQaThreshold` em `src/match/possessionMetrics.ts` (limiar em `actionResolutionTuning.ts`).
- **Remates (motor tático)**: `SimMatchState.shotTelemetry` — `attempts`, `onTarget` (≠ miss), `goals`, `saves`, `offTarget`, `shootCandidatesAsCarrier`, `shootChosen`, `shotBudgetForcesUsed`. Callbacks em `DecisionContext` (`noteShoot*`, `noteCarrierDecisionDebug`) são preenchidos em `TacticalSimLoop.runAgentDecisions`. Consumo do orçamento e contadores de resultado em `executeOnBallAction` (ramo `shoot` / `shoot_long_range`).
- **Elegibilidade / peso**: `src/match/shootDecisionTuning.ts`, `src/match/shootEligibility.ts`; piso vs `pass_safe` e `SHOT_BUDGET_*` em `collectiveIndividualDecision` + veto/alívio em `OnBallDecision`.
- **Log opcional fim de jogo**: `globalThis.__OF_SHOT_TELEMETRY_LOG__ = true` — ao entrar em `full_time`, o loop escreve um resumo (tentativas, SOT, cauda de decisões do portador).

## Deliberação pós-receção

Quando `BALL_RECEIVED` ocorre, o `PlayerDecisionEngine` entra em fase **`deliberating`** antes de executar qualquer ação (passe, chute, condução). O campo/FieldZones fornece contexto geométrico; **não escolhe a ação**.

### Fluxo (step por step)

1. `pre_receiving` — jogador ajusta corpo enquanto bola está em voo.
2. `receiving` — toque na bola (com roll de sucesso/fumble).
3. **`deliberating`** — jogador lê o campo. Duração `T_deliberate` depende de `mentalidade`, `confianca`, pressão, zona. Durante esta janela só micro-carry / shield.
4. `deciding` — `decideOnBall()` avalia ≥ 3 candidatos em paralelo (utility scoring).
5. `executing` — ação escolhida é despachada ao `ActionResolver`.

### Anti-regressão

- **Proibido passe no mesmo tick que `BALL_RECEIVED`** — verificado por `test:deliberation`.
- Caminho legado `first_touch_pass → execute immediately` foi removido; `first_touch_pass` agora reduz `T_deliberate` mas não a elimina.
- `oriented_forward` / `let_run` também passam por deliberação (com factor 0.6x).

### Instinct clear (atalho sob pressão extrema)

Se durante `deliberating` um oponente está a < 2 m, a deliberação aborta e o jogador decide imediatamente (auto-preservação).

### Constantes centralizadas

| Constante | Valor default | Ficheiro |
|-----------|---------------|----------|
| `DELIBERATION_BASE_SEC` | 0.12 s | `matchSimulationTuning.ts` |
| `DELIBERATION_MIN_SEC` | 0.03 s | `matchSimulationTuning.ts` |
| `DELIBERATION_MAX_SEC` | 0.28 s | `matchSimulationTuning.ts` |
| `DELIBERATION_PRESSURE_RADIUS` | 8 m | `matchSimulationTuning.ts` |

### Candidatos mínimos avaliados em `decideOnBall`

| ID | Significado |
|----|-------------|
| `pass_safe` | Passe ao mais próximo com linha razoável |
| `pass_progressive` | Passe ao companheiro mais avançado (eixo de ataque) |
| `carry` | Condução curta na direção do gol |
| `dribble_risk` | Drible arriscado |
| `shoot` | Remate (sujeito a elegibilidade) |
| `clearance` | Alívio |
| `cross` | Cruzamento (quando em ala) |

Scoring combina: `roleActionFit`, `actionCapability` (atributos), `archetypeBias`, `contextualRisk` (pressão/stamina), `zoneActionBias`, com ruído via top-N aleatório.

## Ficheiros principais

- `src/match/fieldZones.ts` — zonas e meios-tempos.
- `src/match/roleZoneTactics.ts` — viés papel × zona na decisão.
- `src/simulation/ActionResolver.ts` — acerto/erro com seed.
- `src/simulation/TacticalSimLoop.ts` — integração, telemetria de remate, orçamento "shot budget", acumulação de stall ofensivo, posse pós-remate.
- `src/playerDecision/PlayerDecisionEngine.ts` — máquina de estados: `pre_receiving → receiving → deliberating → deciding → executing`. Deliberação impõe latência entre receção e ação. Re-planeamento forçado no terço final.
- `src/playerDecision/OnBallDecision.ts` — `decideOnBall()` avalia candidatos via intention + collective scoring.
- `src/playerDecision/PreReception.ts` — intenção e orientação corporal antes da bola chegar.
- `src/playerDecision/Reception.ts` — tipo de receção e roll de sucesso.
- `src/match/matchSimulationTuning.ts` — constantes de deliberação e timing.
- `src/match/actionResolutionTuning.ts` — constantes de resolução contestada.
