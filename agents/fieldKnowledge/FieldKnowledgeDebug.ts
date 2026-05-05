/**
 * /agents/fieldKnowledge/FieldKnowledgeDebug.ts
 *
 * Validation logger for field knowledge.
 * Prints per-player spatial state: zone, territory status, recovery target.
 * Used in pre-match validation and smoke tests.
 */

import type { PlayerAgentState } from '../core/PlayerAgent';
import type { FieldAwareAgentState } from './FieldKnowledgeLoader';
import type { TerritoryGameState } from './FieldKnowledge';
import {
  getZoneIdForPoint,
  isPointInZone,
  FIELD_ZONES,
} from './FieldZones';
import {
  isPointInsidePrimaryTerritory,
  isPointInsideSupportTerritory,
  isPointForbidden,
  shouldRecoverPosition,
  getRecoveryTarget,
  validateAgentTarget,
} from './TerritoryRules';

// ── Single agent debug ────────────────────────────────────────────────────────

export function debugAgentTerritory(
  agent: FieldAwareAgentState,
  gameState: TerritoryGameState,
  proposedTarget?: { x: number; y: number },
): void {
  const pos = agent.currentPosition;
  const fk  = agent.fieldKnowledge;
  const t   = fk.territory;

  const currentZone = FIELD_ZONES[getZoneIdForPoint(pos.x, pos.y)];
  const inPrimary   = isPointInsidePrimaryTerritory(t, pos);
  const inSupport   = isPointInsideSupportTerritory(t, pos);
  const forbidden   = isPointForbidden(t, pos);
  const recover     = shouldRecoverPosition(t, pos, gameState);
  const recovTarget = getRecoveryTarget(t, gameState);

  console.log(`\n[FK] ${agent.id} (${agent.position}) @ (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
  console.log(`  Zone:       ${currentZone?.id ?? 'unknown'} — ${currentZone?.name ?? ''}`);
  console.log(`  Primary:    ${inPrimary ? '✅ YES' : '❌ NO'}  | Support: ${inSupport ? '✅ YES' : '❌ NO'}  | Forbidden: ${forbidden ? '🚫 YES' : 'NO'}`);
  console.log(`  Recover:    ${recover ? '⬅️  YES → (' + recovTarget.x.toFixed(1) + ', ' + recovTarget.y.toFixed(1) + ')' : 'NO'}`);

  if (proposedTarget) {
    const validation = validateAgentTarget(fk, pos, proposedTarget, gameState);
    const adj = validation.adjustedTarget;
    const changed = Math.hypot(adj.x - proposedTarget.x, adj.y - proposedTarget.y) > 0.5;
    console.log(`  Target:     (${proposedTarget.x.toFixed(1)}, ${proposedTarget.y.toFixed(1)}) → adjusted: (${adj.x.toFixed(1)}, ${adj.y.toFixed(1)}) ${changed ? '🔀 REDIRECTED' : '✅ OK'}`);
  }
}

// ── Team debug ────────────────────────────────────────────────────────────────

export function debugTeamTerritory(
  agents: FieldAwareAgentState[],
  gameState: TerritoryGameState,
): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`FIELD KNOWLEDGE DEBUG — ${gameState.teamSide.toUpperCase()} | ball=(${gameState.ballPosition.x.toFixed(1)},${gameState.ballPosition.y.toFixed(1)}) | possession=${gameState.teamHasBall}`);
  console.log('─'.repeat(60));

  let outOfTerritory = 0;
  let forbidden = 0;
  let recovering = 0;

  for (const agent of agents) {
    const pos = agent.currentPosition;
    const t   = agent.fieldKnowledge.territory;
    const inP = isPointInsidePrimaryTerritory(t, pos);
    const inS = isPointInsideSupportTerritory(t, pos);
    const inF = isPointForbidden(t, pos);
    const rec = shouldRecoverPosition(t, pos, gameState);
    const zone = FIELD_ZONES[getZoneIdForPoint(pos.x, pos.y)];

    if (inF) forbidden++;
    if (rec) recovering++;
    if (!inP && !inS) outOfTerritory++;

    const status = inF ? '🚫' : rec ? '⬅️ ' : inP ? '✅' : inS ? '🔵' : '⚠️ ';
    console.log(
      `  ${status} ${agent.id.padEnd(14)} ${agent.position.padEnd(5)}` +
      ` @ (${pos.x.toFixed(1).padStart(5)}, ${pos.y.toFixed(1).padStart(5)})` +
      ` zone=${zone?.id.padEnd(22) ?? 'unknown'.padEnd(22)}` +
      ` ${inP ? 'PRIMARY' : inS ? 'SUPPORT' : inF ? 'FORBIDDEN' : 'OUTSIDE'}`
    );
  }

  console.log(`\n  Summary: ${outOfTerritory} out-of-territory | ${forbidden} forbidden | ${recovering} recovering`);
}

// ── 10-tick simulation validation ────────────────────────────────────────────

export interface TerritoryViolation {
  tick: number;
  agentId: string;
  position: string;
  violationType: 'forbidden' | 'out_of_territory';
  coord: { x: number; y: number };
  zoneId: string;
}

export function validateSimulationTerritories(
  snapshots: Array<{ tick: number; homePlayers: PlayerAgentState[]; awayPlayers: PlayerAgentState[] }>,
  homeKnowledge: Map<string, FieldAwareAgentState>,
  awayKnowledge: Map<string, FieldAwareAgentState>,
  gameState: TerritoryGameState,
): TerritoryViolation[] {
  const violations: TerritoryViolation[] = [];

  for (const snap of snapshots) {
    for (const p of snap.homePlayers) {
      const fka = homeKnowledge.get(p.id);
      if (!fka) continue;
      const t = fka.fieldKnowledge.territory;
      const pos = p.currentPosition;
      const zoneId = getZoneIdForPoint(pos.x, pos.y);
      if (isPointForbidden(t, pos)) {
        violations.push({ tick: snap.tick, agentId: p.id, position: p.position, violationType: 'forbidden', coord: pos, zoneId });
      }
    }
    for (const p of snap.awayPlayers) {
      const fka = awayKnowledge.get(p.id);
      if (!fka) continue;
      const t = fka.fieldKnowledge.territory;
      const pos = p.currentPosition;
      const zoneId = getZoneIdForPoint(pos.x, pos.y);
      if (isPointForbidden(t, pos)) {
        violations.push({ tick: snap.tick, agentId: p.id, position: p.position, violationType: 'forbidden', coord: pos, zoneId });
      }
    }
  }

  return violations;
}
