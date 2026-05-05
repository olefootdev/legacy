import { createAgent, type PlayerAgentState } from '../core/PlayerAgent';
import type { ZoneConstraint } from '../core/AgentTypes';
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
import type { Team442 } from './create442Team';

// Mirror a zone: away team attacks toward x=0, so x is flipped (100 - x).
function mirrorZone(zone: ZoneConstraint): ZoneConstraint {
  return {
    ...zone,
    baseZone: { x: 100 - zone.baseZone.x, y: zone.baseZone.y },
  };
}

export function create442TeamAway(teamId: string, teamName: string): Team442 {
  const players: PlayerAgentState[] = [
    createAgent(`${teamId}_gk`,  'GK',   'defensive', 'defensive', mirrorZone(GK_ZONE).baseZone,       mirrorZone(GK_ZONE)),
    createAgent(`${teamId}_lb`,  'LB',   'defensive', 'balanced',  mirrorZone(LB_ZONE).baseZone,       mirrorZone(LB_ZONE)),
    createAgent(`${teamId}_cbl`, 'CB_L', 'defensive', 'defensive', mirrorZone(CB_LEFT_ZONE).baseZone,  mirrorZone(CB_LEFT_ZONE)),
    createAgent(`${teamId}_cbr`, 'CB_R', 'defensive', 'defensive', mirrorZone(CB_RIGHT_ZONE).baseZone, mirrorZone(CB_RIGHT_ZONE)),
    createAgent(`${teamId}_rb`,  'RB',   'defensive', 'balanced',  mirrorZone(RB_ZONE).baseZone,       mirrorZone(RB_ZONE)),
    createAgent(`${teamId}_lm`,  'LM',   'support',   'balanced',  mirrorZone(LM_ZONE).baseZone,       mirrorZone(LM_ZONE)),
    createAgent(`${teamId}_cml`, 'CM_L', 'support',   'balanced',  mirrorZone(CM_LEFT_ZONE).baseZone,  mirrorZone(CM_LEFT_ZONE)),
    createAgent(`${teamId}_cmr`, 'CM_R', 'support',   'balanced',  mirrorZone(CM_RIGHT_ZONE).baseZone, mirrorZone(CM_RIGHT_ZONE)),
    createAgent(`${teamId}_rm`,  'RM',   'support',   'balanced',  mirrorZone(RM_ZONE).baseZone,       mirrorZone(RM_ZONE)),
    createAgent(`${teamId}_stl`, 'ST_L', 'offensive', 'offensive', mirrorZone(ST_LEFT_ZONE).baseZone,  mirrorZone(ST_LEFT_ZONE)),
    createAgent(`${teamId}_str`, 'ST_R', 'offensive', 'aggressive',mirrorZone(ST_RIGHT_ZONE).baseZone, mirrorZone(ST_RIGHT_ZONE)),
  ];

  return { id: teamId, name: teamName, players };
}
