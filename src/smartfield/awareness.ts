/**
 * Awareness 360° + helpers de posicionamento.
 *
 * Modela o que cada jogador "sabe" do campo a partir da posição/orientação:
 *  - cone focal 90° (raio 15u UI) → tudo que é visto de frente
 *  - periférico 360° (raio 30u UI, ponto cego 90° atrás) → percebido
 *  - blind spot → existe pro motor mas o jogador não sabe (passes podem surpreender)
 *
 * Periférico encolhe -20% quando fadiga > 70.
 *
 * `PitchPlayerState` não carrega o time nativo; este módulo trabalha sobre
 * uma extensão `AwarePlayer` (adiciona `team: 'home' | 'away'`) que o caller
 * deve tagar antes de chamar.
 */

import type { PitchPlayerState } from '@/engine/types';
import {
  zoneAtUI,
  isBox,
  isFinalThird,
  distToOppGoalMeters,
  dangerToOppGoal01,
  type ZoneInfo,
} from '@/match/spatialZones';

/** Jogador com side associado (necessário pra distinguir aliado/adversário). */
export interface AwarePlayer extends PitchPlayerState {
  team: 'home' | 'away';
}

// ── Helpers de posicionamento ─────────────────────────────────────

export function distance2D(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** Ângulo (graus, -180..180) de B vista por A, considerando heading de A em graus. */
export function angleRelative(
  a: { ux: number; uy: number; headingDeg: number },
  b: { ux: number; uy: number },
): number {
  const dx = b.ux - a.ux;
  const dy = b.uy - a.uy;
  const target = (Math.atan2(dy, dx) * 180) / Math.PI;
  let delta = target - a.headingDeg;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

export function isNearSideline(uy: number, marginUI = 6): boolean {
  return uy <= marginUI || uy >= 100 - marginUI;
}

export function isNearOwnGoal(ux: number, side: 'home' | 'away', marginUI = 12): boolean {
  return side === 'home' ? ux <= marginUI : ux >= 100 - marginUI;
}

// ── Awareness 360° ────────────────────────────────────────────────

export interface AwarenessContext {
  ballZoneInfo: ZoneInfo;
  distanceToGoalM: number;
  dangerToGoal01: number;
  /** 0..1 — adversários no cone focal a < 8u UI. */
  pressureLevel: number;
  focalPlayers: AwarePlayer[];
  peripheralPlayers: AwarePlayer[];
  /** Existem mas o jogador NÃO sabe (atrás dele). */
  blindSpotPlayers: AwarePlayer[];
  availableTeammates: Array<AwarePlayer & { passQuality: number; zone: ZoneInfo }>;
  nearOpponents: AwarePlayer[];
  isUnderPressure: boolean;
  hasClearShot: boolean;
  bestPassOption: (AwarePlayer & { passQuality: number; zone: ZoneInfo }) | null;
}

export const FOCAL_RADIUS_UI = 15;
export const FOCAL_HALF_ANGLE = 45; // cone 90° = ±45°
export const BLIND_HALF_ANGLE = 45; // ponto cego traseiro 90° = >135° absoluto
export const PERIPHERAL_RADIUS_UI = 30;
export const PRESSURE_RADIUS_UI = 8;

export function getAwarenessContext(
  player: AwarePlayer,
  allPlayers: AwarePlayer[],
  side: 'home' | 'away',
): AwarenessContext {
  const z = zoneAtUI(player.x, player.y, side);

  const fatigue = player.fatigue ?? 0;
  const fatigueShrink = Math.max(0, (fatigue - 70) / 100) * 0.2;
  const peripheralR = PERIPHERAL_RADIUS_UI * (1 - fatigueShrink);

  const focalPlayers: AwarePlayer[] = [];
  const peripheralPlayers: AwarePlayer[] = [];
  const blindSpotPlayers: AwarePlayer[] = [];

  // PitchPlayerState.heading vem em radianos; convertemos pra graus para o cálculo.
  const headRad = player.heading ?? 0;
  const headingDeg = (headRad * 180) / Math.PI;
  const me = { ux: player.x, uy: player.y, headingDeg };

  for (const p of allPlayers) {
    if (p.playerId === player.playerId) continue;
    const d = distance2D(player.x, player.y, p.x, p.y);
    const angle = Math.abs(angleRelative(me, { ux: p.x, uy: p.y }));

    if (d <= FOCAL_RADIUS_UI && angle <= FOCAL_HALF_ANGLE) {
      focalPlayers.push(p);
    } else if (d <= peripheralR && angle < 180 - BLIND_HALF_ANGLE) {
      peripheralPlayers.push(p);
    } else if (d <= peripheralR) {
      blindSpotPlayers.push(p);
    }
  }

  const nearOpponents = focalPlayers.filter(
    (p) => p.team !== player.team && distance2D(player.x, player.y, p.x, p.y) < PRESSURE_RADIUS_UI,
  );
  const pressureLevel = Math.min(1, nearOpponents.length * 0.35);

  const availableTeammates = [...focalPlayers, ...peripheralPlayers]
    .filter((p) => p.team === player.team)
    .map((p) => {
      const teammateZone = zoneAtUI(p.x, p.y, side);
      const d = distance2D(player.x, player.y, p.x, p.y);
      const advance = side === 'home' ? p.x - player.x : player.x - p.x;
      const teammatePressure = allPlayers.filter(
        (o) => o.team !== p.team && distance2D(p.x, p.y, o.x, o.y) < PRESSURE_RADIUS_UI,
      ).length;
      const passQuality = Math.max(
        0,
        Math.min(1, 0.6 + advance * 0.01 - teammatePressure * 0.2 - d * 0.005),
      );
      return Object.assign({}, p, { passQuality, zone: teammateZone });
    })
    .sort((a, b) => b.passQuality - a.passQuality);

  const macroAllowsShoot = isFinalThird(z) || isBox(z);

  return {
    ballZoneInfo: z,
    distanceToGoalM: distToOppGoalMeters(player.x, player.y, side),
    dangerToGoal01: dangerToOppGoal01(player.x, player.y, side),
    pressureLevel,
    focalPlayers,
    peripheralPlayers,
    blindSpotPlayers,
    availableTeammates,
    nearOpponents,
    isUnderPressure: pressureLevel > 0.5,
    hasClearShot: pressureLevel < 0.3 && macroAllowsShoot,
    bestPassOption: availableTeammates[0] ?? null,
  };
}
