/**
 * ClassicBehaviorValidator — validates match events against football logic rules.
 * Produces [QA FAIL] alerts for unrealistic behaviors.
 */

import type { MatchEvent } from '../types';
import type { SimulatedMatch } from './ClassicAutoSimulator';
import type { MatchAnalysis, RoleGroup } from './ClassicMatchAnalyzer';
import { getTuning } from './classicTuningConfig';

export type AlertSeverity = 'FAIL' | 'WARNING' | 'INFO';

export interface QAAlert {
  severity: AlertSeverity;
  code: string;
  message: string;
  matchId?: number;
  minute?: number;
  player?: string;
}

export type ValidationStatus = 'PASS' | 'WARNING' | 'FAIL';

export interface ValidationResult {
  status: ValidationStatus;
  alerts: QAAlert[];
  summary: string;
}

export function validateAnalysis(analysis: MatchAnalysis): ValidationResult {
  const alerts: QAAlert[] = [];
  const tuning = getTuning();

  // Rule 1: Defender open play goals should be rare (< 5% of total)
  const defGoalPct = analysis.defenderOpenPlayGoals / Math.max(1, analysis.totalGoals);
  if (defGoalPct > 0.08) {
    alerts.push({
      severity: 'FAIL',
      code: 'DEFENDER_GOALS_HIGH',
      message: `[QA FAIL] Too many goals from defenders: ${analysis.defenderOpenPlayGoals} (${(defGoalPct * 100).toFixed(1)}% of total)`,
    });
  } else if (defGoalPct > 0.05) {
    alerts.push({
      severity: 'WARNING',
      code: 'DEFENDER_GOALS_ELEVATED',
      message: `[QA WARNING] Defender open play goals elevated: ${(defGoalPct * 100).toFixed(1)}%`,
    });
  }

  // Rule 2: Fullback shots should be minimal
  const fbShotPct = analysis.fullbackShots / Math.max(1, analysis.totalShots);
  if (fbShotPct > 0.06) {
    alerts.push({
      severity: 'FAIL',
      code: 'FULLBACK_SHOTS_HIGH',
      message: `[QA FAIL] Fullback shot rate too high: ${analysis.fullbackShots} shots (${(fbShotPct * 100).toFixed(1)}%)`,
    });
  }

  // Rule 3: Fullback goals should be extremely rare
  if (analysis.fullbackGoals > analysis.totalMatches * 0.03) {
    alerts.push({
      severity: 'FAIL',
      code: 'FULLBACK_GOALS_HIGH',
      message: `[QA FAIL] Fullbacks scoring too often: ${analysis.fullbackGoals} goals in ${analysis.totalMatches} matches`,
    });
  }

  // Rule 4: Invalid shots (from too far)
  const invalidShotPct = analysis.invalidShots / Math.max(1, analysis.totalShots);
  if (invalidShotPct > 0.02) {
    alerts.push({
      severity: 'FAIL',
      code: 'INVALID_SHOTS',
      message: `[QA FAIL] Shots from invalid zone: ${analysis.invalidShots} (${(invalidShotPct * 100).toFixed(1)}%)`,
    });
  }

  // Rule 5: Invalid goals (from midfield)
  if (analysis.invalidGoals > 0) {
    alerts.push({
      severity: 'FAIL',
      code: 'INVALID_GOALS',
      message: `[QA FAIL] Goals from invalid zone: ${analysis.invalidGoals}`,
    });
  }

  // Rule 6: Striker should shoot when receiving in box
  const strikerReceiveRate = analysis.strikerReceiveThenShotRate;
  if (strikerReceiveRate < 0.08 && analysis.strikerReceivedInBoxTotal > 20) {
    alerts.push({
      severity: 'FAIL',
      code: 'STRIKER_NOT_SHOOTING_IN_BOX',
      message: `[QA FAIL] Striker received in box but passed backward: receive-then-shot rate only ${(strikerReceiveRate * 100).toFixed(0)}%`,
    });
  } else if (strikerReceiveRate < 0.12 && analysis.strikerReceivedInBoxTotal > 20) {
    alerts.push({
      severity: 'WARNING',
      code: 'STRIKER_BOX_RATE_LOW',
      message: `[QA WARNING] Striker receive-then-shot rate below target: ${(strikerReceiveRate * 100).toFixed(0)}%`,
    });
  }

  // Rule 7: Goals should have build-up
  const noBuildUpPct = analysis.goalsWithoutBuildUp / Math.max(1, analysis.totalGoals);
  if (noBuildUpPct > 0.15) {
    alerts.push({
      severity: 'FAIL',
      code: 'GOALS_WITHOUT_BUILDUP',
      message: `[QA FAIL] Goals without build-up: ${analysis.goalsWithoutBuildUp} (${(noBuildUpPct * 100).toFixed(0)}%)`,
    });
  }

  // Rule 8: Chance created before goal
  if (analysis.chanceCreatedBeforeGoalPct < 0.70 && analysis.totalGoals > 20) {
    alerts.push({
      severity: 'WARNING',
      code: 'LOW_CHANCE_CREATED',
      message: `[QA WARNING] Goals with chance_created before shot: ${(analysis.chanceCreatedBeforeGoalPct * 100).toFixed(0)}%`,
    });
  }

  // Rule 9: ST/CF should lead goals
  const stGoals = analysis.goalsByPosition.ST;
  const totalGoals = analysis.totalGoals;
  const stGoalPct = stGoals / Math.max(1, totalGoals);
  if (stGoalPct < 0.25 && totalGoals > 20) {
    alerts.push({
      severity: 'FAIL',
      code: 'ATTACKERS_UNDERUSED',
      message: `[QA FAIL] Attackers underused in final third: ST goals only ${(stGoalPct * 100).toFixed(0)}%`,
    });
  } else if (stGoalPct < 0.30 && totalGoals > 20) {
    alerts.push({
      severity: 'WARNING',
      code: 'ST_GOALS_LOW',
      message: `[QA WARNING] ST goal share below ideal: ${(stGoalPct * 100).toFixed(0)}%`,
    });
  }

  // Rule 10: Attackers (ST+LW+RW) should have majority of shots
  const attackerShots = analysis.shotsByPosition.ST + analysis.shotsByPosition.LW + analysis.shotsByPosition.RW;
  const attackerShotPct = attackerShots / Math.max(1, analysis.totalShots);
  if (attackerShotPct < 0.50) {
    alerts.push({
      severity: 'WARNING',
      code: 'ATTACKER_SHOTS_LOW',
      message: `[QA WARNING] Attacker shot share low: ${(attackerShotPct * 100).toFixed(0)}%`,
    });
  }

  // Rule 11: CM/DM should not outscore wingers
  const cmDmGoals = analysis.goalsByPosition.CM + analysis.goalsByPosition.DM;
  const wingerGoals = analysis.goalsByPosition.LW + analysis.goalsByPosition.RW;
  if (cmDmGoals > wingerGoals && totalGoals > 20) {
    alerts.push({
      severity: 'WARNING',
      code: 'MIDFIELD_GOALS_HIGH',
      message: `[QA WARNING] CM+DM goals (${cmDmGoals}) exceed winger goals (${wingerGoals})`,
    });
  }

  // Determine overall status
  const hasFail = alerts.some(a => a.severity === 'FAIL');
  const hasWarning = alerts.some(a => a.severity === 'WARNING');
  const status: ValidationStatus = hasFail ? 'FAIL' : hasWarning ? 'WARNING' : 'PASS';

  const summary = alerts.length === 0
    ? 'All validations passed.'
    : `${alerts.filter(a => a.severity === 'FAIL').length} failures, ${alerts.filter(a => a.severity === 'WARNING').length} warnings.`;

  return { status, alerts, summary };
}

export function validateMatchEvents(match: SimulatedMatch): QAAlert[] {
  const alerts: QAAlert[] = [];
  const { events } = match;

  for (let i = 0; i < events.length; i++) {
    const evt = events[i];
    const role = extractRole(evt, match);
    const xRel = computeXRel(evt);

    // CB scored from open play
    if (evt.type === 'goal' && role === 'CB' && !isSetPieceContext(events, i)) {
      alerts.push({
        severity: 'FAIL',
        code: 'CB_OPEN_PLAY_GOAL',
        message: `[QA FAIL] CB scored from open play`,
        matchId: match.id,
        minute: evt.minute,
        player: evt.playerName,
      });
    }

    // Fullback shot from invalid zone
    if ((evt.type === 'shot' || evt.type === 'goal') && (role === 'LB' || role === 'RB')) {
      if (xRel < 0.70) {
        alerts.push({
          severity: 'FAIL',
          code: 'FULLBACK_INVALID_SHOT',
          message: `[QA FAIL] Fullback shot from invalid zone (xRel=${xRel.toFixed(2)})`,
          matchId: match.id,
          minute: evt.minute,
          player: evt.playerName,
        });
      }
    }

    // Shot from invalid zone became goal
    if (evt.type === 'goal' && xRel < 0.65) {
      alerts.push({
        severity: 'FAIL',
        code: 'GOAL_FROM_INVALID_ZONE',
        message: `[QA FAIL] Shot from invalid zone became goal (xRel=${xRel.toFixed(2)})`,
        matchId: match.id,
        minute: evt.minute,
        player: evt.playerName,
      });
    }

    // Goal without any preceding team event (no build-up)
    if (evt.type === 'goal') {
      let teamEventsBeforeGoal = 0;
      for (let j = Math.max(0, i - 5); j < i; j++) {
        if (events[j].team === evt.team) teamEventsBeforeGoal++;
      }
      if (teamEventsBeforeGoal === 0) {
        alerts.push({
          severity: 'FAIL',
          code: 'GOAL_NO_BUILDUP',
          message: `[QA FAIL] Ball travelled from GK to ST with no build-up`,
          matchId: match.id,
          minute: evt.minute,
          player: evt.playerName,
        });
      }
    }
  }

  return alerts;
}

function extractRole(evt: MatchEvent, match?: SimulatedMatch): string | undefined {
  if (match && evt.playerId != null) {
    const player = match.players.find(p => p.id === evt.playerId);
    if (player) return player.role;
  }
  if (match && evt.playerName) {
    const player = match.players.find(p => p.shortName === evt.playerName);
    if (player) return player.role;
  }
  return undefined;
}

function computeXRel(evt: MatchEvent): number {
  const fieldW = 600;
  if (evt.team === 'home') return evt.ballX / fieldW;
  return 1 - evt.ballX / fieldW;
}

function isSetPieceContext(events: MatchEvent[], goalIdx: number): boolean {
  for (let i = Math.max(0, goalIdx - 3); i < goalIdx; i++) {
    if (events[i].type === 'corner' || events[i].type === 'foul') return true;
  }
  return false;
}
