# Orientação espacial ao gol

Documento para managers e devs: como o motor referencia o gol atacado e como decisões ofensivas "buscam o gol".

## Convenção de campo

- **Eixo X** = comprimento do campo (0..105 m). **Eixo Z** = largura (0..68 m).
- `x = 0` = gol oeste (casa no 1.o tempo). `x = FIELD_LENGTH` = gol leste (visitante no 1.o tempo).
- **1.o tempo**: HOME ataca para `+X` (gol em `x = 105`), AWAY ataca para `-X` (gol em `x = 0`).
- **2.o tempo (IFAB)**: sides invertem — HOME ataca para `-X`, AWAY para `+X`.

## Helpers puros

| Função | Ficheiro | Retorna |
|--------|----------|---------|
| `getAttackingGoalX(side, half)` | `fieldZones.ts` | `number` — coordenada X do gol atacado |
| `getDefendingGoalX(side, half)` | `fieldZones.ts` | `number` — coordenada X do gol defendido |
| `getSideAttackDir(side, half)` | `fieldZones.ts` | `+1 \| -1` — vetor unitário no eixo X |
| `computeProgressToGoal(x, side, half)` | `goalContext.ts` | `0..1` — 0 no próprio gol, 1 no gol adversário |
| `depthFromOwnGoal(x, side, half)` | `fieldZones.ts` | metros a partir do gol defendido |
| `buildGoalContext(x, z, side, half, opp)` | `goalContext.ts` | `GoalContext` struct completa |
| `estimateShotXG(shooter, ballX, ballZ, gc, opp)` | `goalContext.ts` | xG estimado 0..1 |
| `estimatePositionalXG(x, z, side, half, fin)` | `goalContext.ts` | xG posicional leve (sem opositores) |

## GoalContext (struct)

Injetado em `DecisionContext.goalContext` para cada agente, a cada tick:

```
targetGoalX       — centro do gol atacado (X)
targetGoalZ       — centro do gol atacado (Z = FIELD_WIDTH/2)
attackUnitX       — +1 ou -1
distToGoal        — distância euclideana ao centro do gol
angleToGoal       — ângulo em radianos (0 = frontal)
lineOfSightScore  — 0..1 (1 = sem bloqueio na linha de tiro)
progressToGoal    — 0..1 (progresso normalizado ao gol atacado)
```

## Proxy xG

`estimateShotXG` combina:
- Distância ao gol (bandas: < 12m, < 20m, > 30m)
- Ângulo à baliza (penaliza ângulos abertos)
- Line-of-sight (bloqueadores no cone do remate)
- Pressão imediata (adversários < 4m)
- Atributos: `finalizacao`, `mentalidade`, `confianca`
- Runtime: `confidenceRuntime`, `stamina`

Constantes centralizadas em `src/match/xgTuning.ts`.

## "Buscar o gol o tempo inteiro"

Na pontuação de passes (`scorePassForIntention` em `OnBallDecision.ts`):

- **xG-delta bonus**: se o alvo do passe tem xG posicional maior que a posição atual do portador, o passe recebe bonus proporcional (`PASS_XG_DELTA_WEIGHT`).
- O bonus é escalado pela intenção: `create_chance`/`finish` recebem 1.5x, `maintain_possession` recebe 0.5x, `protect_result` recebe 0.15x.
- `pass_safe` para trás/lateral só ganha se não houver alternativa melhor orientada ao gol.

Na `ContextReading`, os campos `progressToGoal`, `angleToGoal`, `lineOfSightScore` estão disponíveis para toda decisão.

## Finalização e mudança de posse

Após `shoot`:
- **GOAL** → placar, KICKOFF no centro, posse do time que sofreu.
- **SAVE** (on target) → posse para o goleiro defensor.
- **MISS** (fora / trave) → posse defensor (tiro de meta simplificado).

Proibido: remate sem ramificação de posse.

## 2.o tempo

`half === 2` inverte `attackDirectionX` e mapeamento do gol atacado/defendido automaticamente em `fieldZones.ts`. Todos os helpers (`getAttackingGoalX`, `progressToGoal`, `buildGoalContext`) recebem `half` e reagem corretamente.

## Kickoff

- Bola no centro (`FIELD_LENGTH/2`, `FIELD_WIDTH/2`).
- HOME em média `x < FIELD_LENGTH/2`, AWAY em média `x > FIELD_LENGTH/2` (1.o tempo).
- Direção de ataque conforme `getSideAttackDir(side, half)`.

## Ficheiros

| Ficheiro | Papel |
|----------|-------|
| `src/match/goalContext.ts` | `GoalContext`, `buildGoalContext`, `progressToGoal`, `estimateShotXG`, `estimatePositionalXG`, `computeLineOfSight` |
| `src/match/xgTuning.ts` | Constantes centralizadas: `XG_*`, `LOS_*`, `PASS_XG_DELTA_*` |
| `src/match/fieldZones.ts` | `getAttackingGoalX`, `getDefendingGoalX`, `getSideAttackDir`, `depthFromOwnGoal`, zonas IFAB |
| `src/playerDecision/types.ts` | `GoalContext` field em `DecisionContext` e `ContextReading` |
| `src/playerDecision/ContextScanner.ts` | Popula `angleToGoal`, `lineOfSightScore`, `progressToGoal` no `ContextReading` |
| `src/playerDecision/OnBallDecision.ts` | xG-delta bonus em `scorePassForIntention` |
| `src/simulation/TacticalSimLoop.ts` | Injeta `goalContext` em cada `DecisionContext` |
| `src/match/runSpatialGoalsSelfTest.ts` | Testes unitários de orientação, inversão, xG, LOS |
