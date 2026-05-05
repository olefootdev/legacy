import type { Intention } from './AgentTypes';
import type { AgentPerception } from './AgentPerception';
import { distanceTo } from './AgentPerception';
import type { ArchetypeModifiers } from '../archetypes/balanced';
import type { PlayerMatchBriefing } from '../context/PlayerMatchBriefing';
import { decideTactica, getZoneDepth, POSITION_BEHAVIORS } from '../knowledge/TacticaDoZero';

export function decideIntention(
  perception: AgentPerception,
  archetype: ArchetypeModifiers,
  confidence = 75,
  briefing: PlayerMatchBriefing | null = null,
  position = '',
  teamSide: 'home' | 'away' = 'home',
  possession: 'home' | 'away' | null = null,
): Intention {
  const { ownPosition, goalPosition, teamHasBall, hasBall } = perception;

  const distToGoal = distanceTo(ownPosition, goalPosition);
  const distToBall = distanceTo(ownPosition, perception.ballPosition);
  const zoneDepth  = getZoneDepth(ownPosition.x, teamSide);

  if (position) {
    const tactica = decideTactica(
      position, hasBall, teamHasBall,
      distToGoal, distToBall, zoneDepth,
      perception.nearestOpponentDist,
      teamSide, possession,
    );
    const behavior = POSITION_BEHAVIORS[position];
    const offPrinciples = behavior?.offensivePrinciples ?? {};
    const defPrinciples = behavior?.defensivePrinciples ?? {};

    // ── COM BOLA ─────────────────────────────────────────────────────────────
    if (hasBall) {
      if (tactica.shouldShoot)   return 'FINISH';

      // Hold-up: atacantes na zona 3-4 sob pressão seguram a bola
      const isStriker = position === 'ST_L' || position === 'ST_R';
      if (isStriker && perception.nearestOpponentDist < 6 && zoneDepth >= 3) return 'HOLD_UP';

      // Dribble: superioridade qualitativa — espaço para 1x1 na zona ofensiva
      if (tactica.shouldDribble) return 'DRIBBLE';

      // Pass: apoio/circulação
      if (tactica.shouldPass)    return 'PASS';

      return 'PROGRESS';
    }

    // ── SEM BOLA — FASE OFENSIVA ──────────────────────────────────────────────
    if (teamHasBall) {
      // Desmarque de ruptura: ST, LM, RM, CM_R correm nas costas da defesa
      if (offPrinciples.demarking === 'run' && zoneDepth >= 3) return 'RUN_BEHIND';

      // Overlap: laterais projetam-se pelo corredor
      if (offPrinciples.overlap && (position === 'LB' || position === 'RB')) return 'OVERLAP';

      // Amplitude: meias laterais mantêm largura
      if (offPrinciples.width && (position === 'LM' || position === 'RM')) return 'HOLD_WIDTH';

      // Apoio: todos os outros oferecem opção próxima
      return 'SUPPORT_BALL';
    }

    // ── SEM BOLA — FASE DEFENSIVA ─────────────────────────────────────────────

    // Temporização: jogadores que não devem entrar no duelo sozinhos
    if (defPrinciples.delay && distToBall < 12) return 'DELAY';

    // Pressão: jogadores com pressing total/parcial e próximos da bola
    if (tactica.shouldPress) return 'PRESS';

    // Cobertura: jogador próximo ao companheiro que está marcando
    if (defPrinciples.coverage && distToBall < 20 && perception.nearestTeammateDist < 10) return 'COVER';

    // Vigilância: rastrear adversário sem bola perigoso (zona ofensiva)
    if (zoneDepth >= 3 && perception.nearestOpponentDist < 15) return 'TRACK_RUNNER';

    // Recuo: fora da zona permitida → voltar imediatamente
    if (tactica.shouldRetreat) return 'RECOVER';

    return 'HOLD_SHAPE';
  }

  // ── Fallback genérico (sem position) ─────────────────────────────────────
  const maxChaseDist = briefing?.resolved.maxDistToChaseBall ?? 12;
  const minShootDist = briefing?.resolved.minDistToShoot     ?? 25;
  const recoveryPrio = briefing?.resolved.recoveryPriority   ?? 0.5;
  const aggrLevel    = briefing?.resolved.aggressionLevel    ?? 0.5;
  const confMult     = 0.7 + (confidence / 100) * 0.6;
  const nearBall     = maxChaseDist * archetype.reachBias  * confMult;
  const nearGoal     = minShootDist * archetype.attackBias * confMult;

  if (!hasBall && !teamHasBall && recoveryPrio > 0.8) return 'HOLD_SHAPE';
  if (hasBall) {
    if (distToGoal < nearGoal) return 'FINISH';
    return 'PROGRESS';
  }
  const chase = aggrLevel < 0.3 ? nearBall * 0.6 : nearBall;
  if (distToBall < chase && distToGoal < nearGoal) return 'FINISH';
  if (distToBall < chase) return 'PRESS';
  if (teamHasBall) return 'SUPPORT_BALL';
  return 'HOLD_SHAPE';
}

