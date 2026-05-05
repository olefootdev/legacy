/**
 * /agents/fieldKnowledge/FieldKnowledge.ts
 *
 * Core types for the field intelligence layer.
 *
 * Coordinate system (canonical normalized 0–100):
 *   x: 0=left edge → 100=right edge   (width)
 *   y: 0=home goal → 100=away goal    (depth / attacking direction)
 *
 * Home team attacks toward y=100.
 * Away team attacks toward y=0.
 *
 * Source of truth: src/tactical/fieldGeometry.ts
 */

import type { Vec2 } from '../core/AgentTypes';

// ── Zone descriptor ───────────────────────────────────────────────────────────

export interface FieldZone {
  id: string;
  name: string;
  xMin: number;   // normalized 0–100
  xMax: number;
  yMin: number;
  yMax: number;
  center: Vec2;
}

// ── Territory descriptor per position ────────────────────────────────────────

export interface PositionTerritory {
  positionId: string;
  primaryZoneIds: string[];
  supportZoneIds: string[];
  forbiddenZoneIds: string[];
  recoveryPoint: Vec2;
  // Soft boundary: how far outside primary zone before forced recovery (normalized)
  softBoundaryRadius: number;
}

// ── Game state snapshot for territory queries ─────────────────────────────────

export interface TerritoryGameState {
  teamHasBall: boolean;
  ballPosition: Vec2;
  teamSide: 'home' | 'away';
}

// ── Full field knowledge object attached to each agent ───────────────────────

export interface FieldKnowledge {
  zones: Map<string, FieldZone>;
  territory: PositionTerritory;
  teamSide: 'home' | 'away';
  attackingDirection: 'up' | 'down'; // 'up' = toward y=100 (home), 'down' = toward y=0 (away)
}

// ── Query result ──────────────────────────────────────────────────────────────

export interface TerritoryValidation {
  isInPrimary: boolean;
  isInSupport: boolean;
  isForbidden: boolean;
  isOutOfTerritory: boolean;
  currentZoneId: string;
  shouldRecover: boolean;
  recoveryTarget: Vec2;
  adjustedTarget: Vec2;   // final target after territory validation
}
