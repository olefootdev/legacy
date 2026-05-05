import { createAgent, type PlayerAgentState } from '../core/PlayerAgent';
import { GK_ZONE }       from '../positions/goalkeeper/goalkeeper';
import { CB_LEFT_ZONE }  from '../positions/defenders/center_back_left';
import { CB_RIGHT_ZONE } from '../positions/defenders/center_back_right';
import { LB_ZONE }       from '../positions/defenders/fullback_left';
import { RB_ZONE }       from '../positions/defenders/fullback_right';
import { LM_ZONE }       from '../positions/midfielders/midfielder_left';
import { CM_LEFT_ZONE }  from '../positions/midfielders/midfielder_center_left';
import { CM_RIGHT_ZONE } from '../positions/midfielders/midfielder_center_right';
import { RM_ZONE }       from '../positions/midfielders/midfielder_right';
import { ST_LEFT_ZONE }  from '../positions/forwards/striker_left';
import { ST_RIGHT_ZONE } from '../positions/forwards/striker_right';

export interface Team442 {
  id: string;
  name: string;
  players: PlayerAgentState[];
}

// Instantiate a full 4-4-2 team.
// All coordinates are normalized (0–100): x=depth (home→away), y=width (left→right).
// Attacking direction: home team attacks toward x=100.
export function create442Team(teamId: string, teamName: string): Team442 {
  const players: PlayerAgentState[] = [
    // ── Goalkeeper ────────────────────────────────────────────────────────────
    createAgent(`${teamId}_gk`,   'GK',   'defensive', 'defensive', GK_ZONE.baseZone,       GK_ZONE),

    // ── Defenders ─────────────────────────────────────────────────────────────
    createAgent(`${teamId}_lb`,   'LB',   'defensive', 'balanced',  LB_ZONE.baseZone,       LB_ZONE),
    createAgent(`${teamId}_cbl`,  'CB_L', 'defensive', 'defensive', CB_LEFT_ZONE.baseZone,  CB_LEFT_ZONE),
    createAgent(`${teamId}_cbr`,  'CB_R', 'defensive', 'defensive', CB_RIGHT_ZONE.baseZone, CB_RIGHT_ZONE),
    createAgent(`${teamId}_rb`,   'RB',   'defensive', 'balanced',  RB_ZONE.baseZone,       RB_ZONE),

    // ── Midfielders ───────────────────────────────────────────────────────────
    createAgent(`${teamId}_lm`,   'LM',   'support',   'balanced',  LM_ZONE.baseZone,       LM_ZONE, 100, 75, []),
    createAgent(`${teamId}_cml`,  'CM_L', 'support',   'balanced',  CM_LEFT_ZONE.baseZone,  CM_LEFT_ZONE, 100, 75, ['anchor-hold']),
    createAgent(`${teamId}_cmr`,  'CM_R', 'support',   'balanced',  CM_RIGHT_ZONE.baseZone, CM_RIGHT_ZONE, 100, 75, ['anchor-hold']),
    createAgent(`${teamId}_rm`,   'RM',   'support',   'balanced',  RM_ZONE.baseZone,       RM_ZONE, 100, 75, []),

    // ── Forwards ──────────────────────────────────────────────────────────────
    createAgent(`${teamId}_stl`,  'ST_L', 'offensive', 'offensive', ST_LEFT_ZONE.baseZone,  ST_LEFT_ZONE, 100, 75, ['clinical-finisher']),
    createAgent(`${teamId}_str`,  'ST_R', 'offensive', 'aggressive',ST_RIGHT_ZONE.baseZone, ST_RIGHT_ZONE, 100, 75, ['clinical-finisher']),
  ];

  return { id: teamId, name: teamName, players };
}
