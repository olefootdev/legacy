# Olefoot — Referência de Field Context

> Consulte este arquivo ao implementar qualquer coisa relacionada a:
> zonas do campo, fases do jogo, territórios por posição, ou o tick loop.

---

## Dimensões do campo

Todas as coordenadas são percentuais do campo real.
Nunca use pixels fixos.

```typescript
const fieldWidth  = /* valor dinâmico do engine */
const fieldHeight = /* valor dinâmico do engine */

// converter porcentagem para coordenada real
const toX = (pct: number) => pct * fieldWidth / 100
const toY = (pct: number) => pct * fieldHeight / 100
```

---

## Zonas horizontais (terços)

```
|--- Defensive Third ---|--- Middle Third ---|--- Attacking Third ---|
0%                     33%                 66%                     100%  (x)
```

```typescript
defensiveThird:  { xMin: 0,   xMax: 33  }
middleThird:     { xMin: 33,  xMax: 66  }
attackingThird:  { xMin: 66,  xMax: 100 }
```

---

## Zonas verticais (corredores)

```
0%   leftCorridor       25%
25%  leftHalfSpace      40%
40%  centralCorridor    60%
60%  rightHalfSpace     75%
75%  rightCorridor     100%   (y)
```

---

## 15 zonas nomeadas (FieldZones)

| ID | Nome | xMin | xMax | yMin | yMax |
|----|------|------|------|------|------|
| OWN_BOX | Própria área | 0 | 17 | 30 | 70 |
| OWN_LEFT_FLANK | Flanco esquerdo defensivo | 0 | 33 | 0 | 30 |
| OWN_RIGHT_FLANK | Flanco direito defensivo | 0 | 33 | 70 | 100 |
| OWN_CENTER | Centro defensivo | 0 | 33 | 30 | 70 |
| DEF_LEFT_HALFSPACE | Half-space esquerdo def. | 17 | 33 | 25 | 40 |
| DEF_RIGHT_HALFSPACE | Half-space direito def. | 17 | 33 | 60 | 75 |
| MID_LEFT_FLANK | Flanco esquerdo central | 33 | 66 | 0 | 25 |
| MID_RIGHT_FLANK | Flanco direito central | 33 | 66 | 75 | 100 |
| MID_CENTER | Centro do campo | 33 | 66 | 25 | 75 |
| ATK_LEFT_FLANK | Flanco esquerdo ofensivo | 66 | 100 | 0 | 25 |
| ATK_RIGHT_FLANK | Flanco direito ofensivo | 66 | 100 | 75 | 100 |
| ATK_CENTER | Centro ofensivo | 66 | 100 | 25 | 75 |
| OPPONENT_BOX | Área adversária | 83 | 100 | 30 | 70 |
| LEFT_HALFSPACE | Half-space esq. ofensivo | 55 | 83 | 25 | 40 |
| RIGHT_HALFSPACE | Half-space dir. ofensivo | 55 | 83 | 60 | 75 |

---

## Territórios por posição (4-4-2)

### GK
- Primary: OWN_BOX
- Support: OWN_CENTER
- Forbidden: MIDDLE_THIRD, ATTACKING_THIRD
- Recovery: center of own goal line

### LB
- Primary: OWN_LEFT_FLANK
- Support: MID_LEFT_FLANK
- Allowed (com posse): ATK_LEFT_FLANK
- Forbidden: RIGHT_CORRIDOR, ATK_CENTER
- Recovery: (20, 20)

### CB_LEFT
- Primary: OWN_CENTER + DEF_LEFT_HALFSPACE
- Support: OWN_BOX + MID_CENTER (lateral esquerdo)
- Forbidden: ATTACKING_THIRD
- Recovery: (22, 38)

### CB_RIGHT
- Primary: OWN_CENTER + DEF_RIGHT_HALFSPACE
- Support: OWN_BOX + MID_CENTER (lateral direito)
- Forbidden: ATTACKING_THIRD
- Recovery: (22, 62)

### RB
- Primary: OWN_RIGHT_FLANK
- Support: MID_RIGHT_FLANK
- Allowed (com posse): ATK_RIGHT_FLANK
- Forbidden: LEFT_CORRIDOR, ATK_CENTER
- Recovery: (20, 80)

### LM
- Primary: MID_LEFT_FLANK
- Support: OWN_LEFT_FLANK + ATK_LEFT_FLANK
- Forbidden: MID_RIGHT_FLANK, OWN_RIGHT_FLANK
- Recovery: (48, 15)

### CM_LEFT
- Primary: MID_CENTER (metade esquerda) + LEFT_HALFSPACE
- Support: OWN_CENTER + ATK_CENTER
- Forbidden: MID_RIGHT_FLANK (sem trigger)
- Recovery: (46, 38)

### CM_RIGHT
- Primary: MID_CENTER (metade direita) + RIGHT_HALFSPACE
- Support: OWN_CENTER + ATK_CENTER
- Forbidden: MID_LEFT_FLANK (sem trigger)
- Recovery: (46, 62)

### RM
- Primary: MID_RIGHT_FLANK
- Support: OWN_RIGHT_FLANK + ATK_RIGHT_FLANK
- Forbidden: MID_LEFT_FLANK, OWN_LEFT_FLANK
- Recovery: (48, 85)

### ST_LEFT
- Primary: ATK_CENTER (metade esquerda) + LEFT_HALFSPACE
- Support: OPPONENT_BOX
- Forbidden: OWN_DEFENSIVE_THIRD (sem trigger defensivo)
- Recovery: (75, 38)

### ST_RIGHT
- Primary: ATK_CENTER (metade direita) + RIGHT_HALFSPACE
- Support: OPPONENT_BOX
- Forbidden: OWN_DEFENSIVE_THIRD (sem trigger defensivo)
- Recovery: (75, 62)

---

## Fases do jogo (GamePhase)

```typescript
type GamePhase =
  | 'POSSESSION'           // equipe tem a bola
  | 'DEFENDING'            // equipe adversária tem a bola
  | 'TRANSITION_ATTACK'    // equipe acabou de ganhar a bola
  | 'TRANSITION_DEFENSE'   // equipe acabou de perder a bola
```

### Como as zonas mudam por fase

| Fase | Fullbacks | Meias | Atacantes |
|------|-----------|-------|-----------|
| POSSESSION | Podem subir (support → atk corridor) | Expandem para half-spaces | Mantêm posição ofensiva |
| DEFENDING | Ficam no corredor defensivo | Compactam para bloco médio | Pressionam linha defensiva |
| TRANSITION_ATTACK | Sobem com cautela | Avançam rapidamente | Buscam profundidade |
| TRANSITION_DEFENSE | Recuam imediatamente | Fecham espaços centrais | Pressionam portador |

---

## MatchFieldContext — 3 camadas de estado

### Camada 1: FieldStructure (imutável)
```typescript
interface FieldStructure {
  zones: FieldZone[]
  territories: Territory[]
  fieldWidth: number
  fieldHeight: number
  penaltyAreas: { own: Zone, opponent: Zone }
}
```
Carrega uma vez no `FieldKnowledgeLoader`. Nunca muda durante a partida.

### Camada 2: PhaseFieldState (atualiza por evento de posse)
```typescript
interface PhaseFieldState {
  currentPhase: GamePhase
  possessionTeam: 'HOME' | 'AWAY' | null
  pressureZone: ZoneId | null
  compactnessFactor: number        // 0-1
  activeZonesByPosition: Map<PositionId, ZoneId[]>
}
```
Atualiza quando a posse muda. Não atualiza a cada tick.

### Camada 3: LiveFieldState (atualiza por tick)
```typescript
interface LiveFieldState {
  tick: number
  ballPosition: Vec2
  ballZone: ZoneId
  teamCentroid: Vec2              // centro geométrico dos 11 jogadores
  defensiveLine: number           // posição X da linha defensiva atual
  playersPerZone: Map<ZoneId, number>  // densidade por zona
}
```
Calculada uma vez por tick, antes de todos os agentes rodarem.

---

## AgentFieldQuery — o que cada agente recebe

```typescript
interface AgentFieldQuery {
  currentZone: ZoneId
  allowedZones: Zone[]
  primaryTerritory: Zone
  isOutOfPosition: boolean
  recoveryTarget: Vec2
  shouldIgnoreBall: boolean         // true quando recovery é prioridade absoluta
  pressurePriority: 'HIGH' | 'MEDIUM' | 'LOW'
}
```

Quando `shouldIgnoreBall` é `true`, o agente **ignora** ballPosition completamente
e usa apenas `recoveryTarget` como destino de movimento.

---

## Thresholds de soft territory

```typescript
const SOFT_THRESHOLD = 0.15   // 15% além do território → redireciona suavemente
const HARD_THRESHOLD = 0.30   // 30% além do território → força recovery imediato

// em unidades de campo (não pixels)
function distanceFromTerritory(player: PlayerAgent, zone: Zone): number {
  // retorna 0 se dentro, positivo se fora
}
```

---

## Log de briefing (obrigatório antes do tick 0)

Formato esperado no console antes da partida começar:

```
[BRIEFING] GK loaded
  Mission: protect own goal, hold position, distribute safely
  Primary Zone: OWN_BOX (x:0-17, y:30-70)
  Allowed Zones: OWN_BOX, OWN_CENTER
  Forbidden: MIDDLE_THIRD, ATTACKING_THIRD
  Recovery: (10, 50)
  Preferred Actions: HOLD, PASS, MOVE

[BRIEFING] LB loaded
  Mission: protect left flank, support wide, overlap only when possession is safe
  Primary Zone: OWN_LEFT_FLANK (x:0-33, y:0-30)
  Allowed Zones: OWN_LEFT_FLANK, MID_LEFT_FLANK
  Forbidden: RIGHT_CORRIDOR, ATK_CENTER
  Recovery: (20, 20)
  Preferred Actions: SUPPORT, PASS, RUN
```
