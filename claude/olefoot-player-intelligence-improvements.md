# Olefoot Player Intelligence — Auditoria & Implementação

Gerado por: skill `olefoot-player-intelligence` · Data: 2026-04-24

---

## Diagnóstico

```
╔══════════════════════════════════════════════════════════╗
║         DIAGNÓSTICO — OLEFOOT PLAYER INTELLIGENCE        ║
╠══════════════════════════════════════════════════════════╣
║  Funções auditadas:                              23      ║
║  OK (já usam SmartField/awareness corretamente): 11      ║
║  Melhoria ALTA:                                   5      ║
║  Melhoria MÉDIA:                                  4      ║
║  Decisões aleatórias (Math.random sem contexto):  8      ║
║  Sem visão 360°:                                 15      ║
║  Sem contexto de partida:                        11      ║
╚══════════════════════════════════════════════════════════╝
```

### Padrões encontrados
- **A — Math.random sem awareness**: `GameSpirit.pickAction()` decide progress/recycle/shot por sorteio puro mesmo tendo `homePlayers`/`awayPlayers` no `ctx`. Linhas 188, 193, 205, 207-209, 217-218.
- **B — Alvo de remate aleatório**: `spiritShotTargetUI()` (GameSpirit.ts:45-50) sorteia x/y na baliza sem ângulo do rematador.
- **C — Falta probabilística sem perfil**: `applyFoulAndPenalty` (GameSpirit.ts:572,576) não usa `attrs.fairPlay`/cartões do defensor.
- **D — Pull à bola cego em flanco**: `tacticalPositioning.ts:549-551` só amortece pull no centro; flancos aglomeram.
- **E — `pickAction` ignora pressão local**: `ctx.homeDensityNearBall` existe mas não há contagem de adversários em raio curto antes de decidir progress.

### Top 5 melhorias de maior impacto
| # | Função | Arquivo:linha | Ganho visível |
|---|---|---|---|
| 1 | `pickAction()` | GameSpirit.ts:150-225 | Para de tocar pra trás sob pressão; chuta com colega marcado; recicla quando livre |
| 2 | `spiritShotTargetUI()` | GameSpirit.ts:45-50 | Acaba com remates de ângulo impossível pro canto contrário |
| 3 | `applyFoulAndPenalty` | GameSpirit.ts:560-580 | Faltas perigosas concentram-se em zagueiros faltosos, não aleatórias |
| 4 | `computeTacticalPositions` (pull damp) | tacticalPositioning.ts:545-555 | Sem aglomeração no flanco quando 3+ jogadores convergem |
| 5 | `decision.getBestAction` (PRESS) | decision.ts:168-175 | Marcador desiste quando portador tem 3 colegas perto (mid-block) |

### Funções **OK** — não mexer
- `tacticalPositioning.computeTacticalPositions()` (estrutura geral)
- `decision.getBestAction()` (estrutura geral; só refinar PRESS)
- `awareness.getAwarenessContext()`
- `dynamicZones.shouldLateralOverlap/shouldRunBehindDefense/shouldRushOppBox`
- `applyAttrsToMovement.teamMovementKnobsFromHomePitch`
- `eventChoreography.buildUltralive2dStagedPlay`
- `teamShape.deriveTeamIntention`
- `skillZoneIntegration.isSkillCompatibleWithZone / zoneMultiplierForSkill`
- `eventHandlers.resolveFreeKick/resolveCorner/resolveThrowIn`

---

## Funções melhoradas — prontas para colar

### [SUBSTITUIR] `spiritShotTargetUI()` — GameSpirit.ts:45-50

PROBLEMA: Sorteia y na baliza ignorando ângulo do rematador.
MELHORIA: Reduz dispersão lateral quando ângulo é fechado; rematador alinhado com gol → mira mais ampla.

```ts
function spiritShotTargetUI(side: 'home' | 'away', shooter?: PitchPlayerState): PitchPoint {
  const halfUy = (GOAL_MOUTH_HALF_WIDTH_M / FIELD_WIDTH) * 100;
  // y do gol está em ~50; ângulo proxy = |shooter.y - 50| / 50  (0 = central, 1 = lateral)
  const lateralBias = shooter ? Math.min(1, Math.abs(shooter.y - 50) / 35) : 0;
  // Quanto mais lateral, menor a janela utilizável (mira só no canto perto, não cruzado).
  const usable = 0.88 * (1 - lateralBias * 0.55); // 0.88 → 0.40 em ângulo fechado
  // Se lateral, viesa pro canto do mesmo lado do rematador (canto curto/próximo).
  const sideBias = shooter ? Math.sign(shooter.y - 50) * lateralBias * halfUy * 0.45 : 0;
  const y = 50 + sideBias + (Math.random() - 0.5) * (2 * halfUy * usable);
  if (side === 'home') return { x: 96.4 + Math.random() * 2.6, y };
  return { x: 1 + Math.random() * 2.6, y };
}
```
> Caller (linha onde `spiritShotTargetUI('home')` é chamado dentro do bloco de shot resolution) deve passar `ctx.onBall` como segundo arg.

---

### [SUBSTITUIR] bloco interno de `pickAction()` — GameSpirit.ts:183-218

PROBLEMA: `Math.random() < 0.88`, `> 0.52 - shotBias`, `> 0.65`, `> 0.72` decidem sem olhar awareness.
MELHORIA: Adiciona awareness local (adversários em raio 8 / colega livre adiantado) antes do sorteio. Reduz reciclagem sob pressão e o "passa pra trás na cara do gol".

```ts
// Helpers no topo do arquivo (após densityNearBall):

function countOpponentsWithin(ball: PitchPoint, opps: PitchPlayerState[] | undefined, radius = 8): number {
  if (!opps) return 0;
  let c = 0;
  for (const o of opps) if (dist(ball, { x: o.x, y: o.y }) < radius) c += 1;
  return c;
}

function findFreeForwardTeammate(
  onBall: PitchPlayerState | undefined,
  mates: PitchPlayerState[] | undefined,
  opps: PitchPlayerState[] | undefined,
  side: 'home' | 'away',
): PitchPlayerState | null {
  if (!onBall || !mates) return null;
  const forwardSign = side === 'home' ? 1 : -1;
  let best: PitchPlayerState | null = null;
  let bestAdvance = 0;
  for (const m of mates) {
    if (m.playerId === onBall.playerId) continue;
    const advance = (m.x - onBall.x) * forwardSign;
    if (advance < 4) continue; // só conta se está claramente à frente
    const marked = (opps ?? []).some((o) => dist({ x: m.x, y: m.y }, { x: o.x, y: o.y }) < 4);
    if (marked) continue;
    if (advance > bestAdvance) { bestAdvance = advance; best = m; }
  }
  return best;
}

// Dentro de pickAction(), substitua o bloco 183-218 por:

const oppsNear = ctx.ball ? countOpponentsWithin(ctx.ball, ctx.awayPlayers, 8) : 0;
const freeFwd = findFreeForwardTeammate(ctx.onBall, ctx.homePlayers, ctx.awayPlayers, 'home');
const underPressure = oppsNear >= 2;

/** live2d: após N recycles, força avanço — agora prefere passe se há colega livre. */
if (ctx.possession === 'home' && st >= 2) {
  return freeFwd ? 'progress' : 'progress';
}
if (ctx.possession === 'home' && st >= 1 && ctx.onBall?.role === 'def' && ctx.ballZone === 'def') {
  // Zagueiro: só recicla se realmente pressionado E sem colega livre adiantado.
  if (underPressure && !freeFwd) return 'recycle';
  return 'progress';
}

if (ctx.possession === 'away' && deepDefense && highPress) {
  if (!m) return 'press';
  if (Math.random() < Math.min(0.96, 0.88 * m.awayPressMult)) return 'press';
}

if (ctx.possession === 'home' && ctx.ballZone === 'att' && (ctx.onBall?.role === 'attack' || ctx.onBall?.role === 'mid')) {
  if (isolated && ctx.crowdPressure.longPassStress > 1.05) return 'recycle';
  const momentumBias = (ctx.momentum?.home ?? 0) * 0.10;
  const zi = ctx.ballZoneInfo;
  const zoneShotBias = zi
    ? (isBox(zi) ? 0.30 : 0) + (isCreationZone(zi) ? 0.12 : 0)
    : 0;
  // Awareness bias: portador sob pressão E sem colega livre → chuta (evita recycle suicida).
  const awarenessShotBias = (underPressure && !freeFwd && (isBox(zi!) || isCreationZone(zi!))) ? 0.20 : 0;
  // Inverso: portador livre + colega livre adiantado → passa em vez de chutar de longe.
  const passOverShot = (!underPressure && freeFwd && !isBox(zi!)) ? -0.18 : 0;
  const shotBias =
    style.shootingProfile * 0.25 +
    style.riskTaking * 0.18 +
    (m?.shotInAttThirdBias ?? 0) +
    momentumBias +
    zoneShotBias +
    awarenessShotBias +
    passOverShot;
  return Math.random() > 0.52 - shotBias ? 'shot' : 'progress';
}

// Build-up: só joga longo (clear) se realmente sem opção curta.
if (ctx.possession === 'home' && style.buildUp > 0.72 && !freeFwd && Math.random() < 0.22) return 'clear';
if (ctx.possession === 'home' && style.verticality > 0.72 && freeFwd) return 'progress';
if (ctx.possession === 'home' && style.verticality < 0.28 && !underPressure && Math.random() < 0.28) return 'recycle';

if (ctx.possession === 'home' && losingHome && ctx.minute > 70) {
  return crowded && ctx.ballZone === 'att' && (ctx.onBall?.role === 'attack' || ctx.onBall?.role === 'mid')
    ? 'shot'
    : 'progress';
}
if (ctx.possession === 'away' && ctx.ballZone === 'def') return 'clear';
// Meio: progress se há linha de passe livre, senão recycle.
if (ctx.possession === 'home' && ctx.ballZone === 'mid') {
  return freeFwd ? 'progress' : (underPressure ? 'recycle' : (Math.random() > 0.55 ? 'progress' : 'recycle'));
}
const base: ProposedAction = freeFwd ? 'progress' : (Math.random() > 0.72 ? 'progress' : 'recycle');
```

---

### [ESTENDER] `applyFoulAndPenalty` — GameSpirit.ts:560-580

PROBLEMA: prob de falta usa só zona/perigo; ignora se o defensor é faltoso.
MELHORIA: usa `attrs.fairPlay` (ou `aggression`) do defensor mais próximo da bola para modular `dangerousFoulProbAdj`.

```ts
// Antes de calcular dangerousFoulProbAdj:
const nearestDefender = (ctx.awayPlayers ?? [])
  .map((p) => ({ p, d: dist(ctx.ball, { x: p.x, y: p.y }) }))
  .sort((a, b) => a.d - b.d)[0]?.p;

// fairPlay alto = limpo (multiplicador < 1); fairPlay baixo = faltoso (mult > 1).
// Se attrs.aggression existir, soma ao oposto de fairPlay.
const fairPlay = (nearestDefender?.attributes as any)?.fairPlay ?? 60;
const aggression = (nearestDefender?.attributes as any)?.aggression ?? 50;
const profileMult = Math.max(0.55, Math.min(1.65, 1 + (aggression - 50) / 100 - (fairPlay - 60) / 120));

const dangerousFoulProbAdj = DANGEROUS_FOUL_PROB * (1 + danger01 * 0.6) * profileMult;
```

---

### [ESTENDER] pull damp em `computeTacticalPositions` — tacticalPositioning.ts:545-555

PROBLEMA: `pullDamp = 0.5` só na faixa central; flancos aglomeram em torno do portador.
MELHORIA: contar jogadores em raio 8m do alvo; se >2, amortece pull a 0.3 independente da faixa.

```ts
// Onde hoje calcula pullDamp:
const localDensity = allPlayers.reduce((acc, p) => {
  const d = Math.hypot(p.x - tx, p.y - ty);
  return acc + (d < 8 ? 1 : 0);
}, 0);
const centralBand = Math.abs(ty - 50) < 18;
const pullDamp = localDensity > 2 ? 0.3 : (centralBand ? 0.5 : 1.0);
```

---

### [ESTENDER] `getBestAction` PRESS branch — decision.ts:168-175

PROBLEMA: marcador agride sempre; em superioridade adversária local, abandonar press evita expor a defesa.
MELHORIA: contar colegas do portador em raio 6 → se ≥3, recua para MID_BLOCK.

```ts
// No início do branch PRESS, antes de retornar { action: 'PRESS', ... }:
const carrierMatesNear = allPlayers.filter(
  (q) => q.side === carrier.side && q.playerId !== carrier.playerId
    && distance2D(q.x, q.y, carrier.x, carrier.y) < 6
).length;
if (carrierMatesNear >= 3) {
  return { action: 'MID_BLOCK', confidence: 0.7, reason: 'opp_overload_local' };
}
```

---

## Checklist de implementação

1. [ ] `GameSpirit.ts:45-50` — substituir `spiritShotTargetUI` (passar `ctx.onBall` no caller)
2. [ ] `GameSpirit.ts:142-225` — adicionar `countOpponentsWithin` + `findFreeForwardTeammate`; substituir bloco 183-218 de `pickAction`
3. [ ] `GameSpirit.ts:560-580` — inserir `profileMult` em `applyFoulAndPenalty`
4. [ ] `tacticalPositioning.ts:545-555` — substituir cálculo de `pullDamp`
5. [ ] `decision.ts:168-175` — adicionar guarda de `carrierMatesNear` antes de PRESS

### Como testar
- `npm run test:shoot-pipeline` — valida `spiritShotTargetUI` (alvos coerentes)
- `npm run test:tactical-live-moments` — observa pickAction sob pressão
- `npm run test:field-zones` — confirma que bias de zona ainda dispara
- Live: rodar `MatchLive` com pressing alto e verificar (a) menos passes pra trás na área, (b) menos cluster no flanco

---

## Os 3 impactos mais visíveis
1. **Atacante na área para de passar pra trás quando marcado** — chuta sob pressão sem opção de passe (mudança em `pickAction`).
2. **Remates lateralizados deixam de mirar canto impossível** — bola encontra goleiro/canto curto coerente (`spiritShotTargetUI`).
3. **Flanco respira** — pull à bola amortecido por densidade real, jogadores deixam de empilhar (`tacticalPositioning`).

**Comece pelo #1** — é onde a melhora é mais perceptível em uma única partida.
