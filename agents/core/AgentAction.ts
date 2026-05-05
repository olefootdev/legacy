import type { Intention, AgentAction, Vec2, ZoneConstraint } from './AgentTypes';
import type { ArchetypeModifiers } from '../archetypes/balanced';
import { distanceTo } from './AgentPerception';
import { applyOffsideTrap, isTrapEligible } from './OffsideTrap';

/**
 * Traduz uma Intention (princípio tático do ebook) em AgentAction (movimento concreto).
 *
 * Cada case mapeia diretamente um princípio de "Táctica do Zero":
 *   FINISH       → Finalização
 *   PASS         → Apoio / Circulação
 *   DRIBBLE      → Superioridade qualitativa (1x1)
 *   PROGRESS     → Progressão com bola
 *   HOLD_UP      → Hold-up (ST segura de costas)
 *   RUN_BEHIND   → Desmarque de ruptura (ultrapassa o portador)
 *   SUPPORT_BALL → Desmarque de apoio (não ultrapassa)
 *   OVERLAP      → Desdobramento (lateral projeta-se pelo corredor)
 *   HOLD_WIDTH   → Amplitude (meia lateral mantém largura)
 *   PRESS        → Pressionamento (vai ao encontro do portador)
 *   COVER        → Cobertura (apoia companheiro que marca)
 *   TRACK_RUNNER → Vigilância (segue adversário sem bola)
 *   DELAY        → Temporização (freia sem entrar no duelo)
 *   RECOVER      → Recuo (retorna à posição)
 *   HOLD_SHAPE   → Manter bloco compacto
 */
export function resolveAction(
  intention: Intention,
  ownPosition: Vec2,
  ballPosition: Vec2,
  goalPosition: Vec2,
  zone: ZoneConstraint,
  archetype: ArchetypeModifiers,
  hasBall = false,
  stamina = 100,
  nearestOpponentDist = 100,
  teamHasBall = false,
  position = '',
  archetypeId = '',
): AgentAction {
  const canRun = stamina > 20;

  switch (intention) {

    // ── COM BOLA ──────────────────────────────────────────────────────────────

    case 'FINISH':
      return { type: 'SHOOT', target: goalPosition };

    case 'PASS':
      // TeamSimulator resolve o destinatário — target é placeholder
      return { type: 'PASS', target: ballPosition };

    case 'DRIBBLE':
      // Conduzir em direção ao gol sem clampar à zona — superioridade qualitativa
      return { type: canRun ? 'RUN' : 'MOVE', target: goalPosition };

    case 'PROGRESS':
      // Progressão com bola: direto ao gol sem clampar à zona
      return { type: canRun ? 'RUN' : 'MOVE', target: goalPosition };

    case 'HOLD_UP': {
      // ST segura a bola de costas para o gol — recua levemente para criar espaço
      const holdTarget: Vec2 = {
        x: ownPosition.x - (goalPosition.x > 50 ? 3 : -3),
        y: ownPosition.y,
      };
      return { type: 'MOVE', target: clampToZone(holdTarget, zone) };
    }

    // ── SEM BOLA — FASE OFENSIVA ──────────────────────────────────────────────

    case 'RUN_BEHIND': {
      // Desmarque de ruptura: correr nas costas da defesa em direção ao gol
      // Ultrapassa o portador — vai além da bola em direção ao gol adversário
      const runTarget: Vec2 = {
        x: goalPosition.x > 50
          ? Math.min(95, ballPosition.x + 20)   // home: avança além da bola
          : Math.max(5,  ballPosition.x - 20),  // away: recua além da bola
        y: ownPosition.y + (Math.random() - 0.5) * 8, // leve variação lateral
      };
      return { type: canRun ? 'RUN' : 'MOVE', target: runTarget };
    }

    case 'SUPPORT_BALL': {
      // Desmarque de apoio: oferecer opção próxima ao portador, não ultrapassa
      const supportTarget: Vec2 = {
        x: (zone.baseZone.x + ballPosition.x) / 2,
        y: (zone.baseZone.y + ballPosition.y) / 2,
      };
      return { type: 'MOVE', target: clampToZone(supportTarget, zone) };
    }

    case 'OVERLAP': {
      // Desdobramento: lateral projeta-se pelo corredor além da bola
      const overlapTarget: Vec2 = {
        x: goalPosition.x > 50
          ? Math.min(90, ballPosition.x + 15)
          : Math.max(10, ballPosition.x - 15),
        y: zone.baseZone.y, // mantém o corredor lateral
      };
      return { type: canRun ? 'RUN' : 'MOVE', target: overlapTarget };
    }

    case 'HOLD_WIDTH': {
      // Amplitude: meia lateral mantém-se aberto na largura máxima do corredor
      const widthTarget: Vec2 = {
        x: ballPosition.x, // acompanha a profundidade da bola
        y: zone.baseZone.y, // mantém a largura da sua zona
      };
      return { type: 'MOVE', target: clampToZone(widthTarget, zone) };
    }

    // ── SEM BOLA — FASE DEFENSIVA ─────────────────────────────────────────────

    case 'PRESS': {
      // Pressionamento: ir ao encontro do portador, direto e rápido
      return { type: canRun ? 'RUN' : 'MOVE', target: ballPosition };
    }

    case 'COVER': {
      // Cobertura: posicionar-se entre a bola e o próprio gol, atrás do companheiro
      const coverTarget: Vec2 = {
        x: (ballPosition.x + zone.baseZone.x) / 2,
        y: (ballPosition.y + zone.baseZone.y) / 2,
      };
      return { type: 'MOVE', target: clampToZone(coverTarget, zone) };
    }

    case 'TRACK_RUNNER': {
      // Vigilância: seguir adversário sem bola — mover para interceptar corrida
      const trackTarget: Vec2 = {
        x: clampToZone(ballPosition, zone).x,
        y: ownPosition.y, // mantém largura, ajusta profundidade
      };
      return { type: 'MOVE', target: trackTarget };
    }

    case 'DELAY': {
      // Temporização: recuar levemente sem entrar no duelo — cria distância segura
      const delayTarget: Vec2 = {
        x: goalPosition.x > 50
          ? Math.max(zone.baseZone.x, ownPosition.x - 4)  // home: recua
          : Math.min(zone.baseZone.x, ownPosition.x + 4), // away: recua
        y: ownPosition.y,
      };
      return { type: 'MOVE', target: clampToZone(delayTarget, zone) };
    }

    case 'RECOVER':
      // Recuo: retornar à posição base o mais rápido possível
      return { type: canRun ? 'RUN' : 'MOVE', target: zone.baseZone };

    case 'HOLD_SHAPE':
    default: {
      const distFromBase = distanceTo(ownPosition, zone.baseZone);
      if (distFromBase < 3) {
        if (isTrapEligible(position)) {
          const trapTarget = applyOffsideTrap(
            ownPosition, zone.baseZone, nearestOpponentDist, teamHasBall, archetypeId,
          );
          if (trapTarget !== zone.baseZone) {
            return { type: 'MOVE', target: trapTarget };
          }
        }
        return { type: 'HOLD' };
      }
      return { type: 'MOVE', target: zone.baseZone };
    }
  }
}

function clampToZone(target: Vec2, zone: ZoneConstraint): Vec2 {
  const dx = target.x - zone.baseZone.x;
  const dy = target.y - zone.baseZone.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= zone.maxRoam) return target;
  const scale = zone.maxRoam / dist;
  return {
    x: zone.baseZone.x + dx * scale,
    y: zone.baseZone.y + dy * scale,
  };
}

