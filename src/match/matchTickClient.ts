/**
 * Cliente para chamar endpoint de tick de partida no backend
 */

import type { PitchPlayerState, PossessionSide } from '@/engine/types';
import type { SpiritOutcome } from '@/gamespirit/types';

interface MatchTickPayload {
  minute: number;
  homeScore: number;
  awayScore: number;
  possession: PossessionSide;
  ball: { x: number; y: number };
  onBall?: PitchPlayerState;
  crowdSupport: number;
  tacticalMentality: number;
  tacticalStyle?: any;
  opponentStrength: number;
  homeRoster: any[];
  homePlayers: PitchPlayerState[];
  homeShort?: string;
  awayRoster?: any[];
  awayShort: string;
  causalSeqStart: number;
  momentum?: { home: number; away: number };
  pendingCornerForSide?: 'home' | 'away' | null;
  pendingFreeKickForSide?: 'home' | 'away' | null;
  smartfieldActionHint?: string;
}

interface MatchTickResponse {
  ok: boolean;
  outcome?: SpiritOutcome;
  error?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function fetchMatchTick(payload: MatchTickPayload): Promise<SpiritOutcome> {
  const response = await fetch(`${API_BASE}/api/match/tick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const data: MatchTickResponse = await response.json();

  if (!data.ok || !data.outcome) {
    throw new Error(data.error || 'Resposta inválida do servidor');
  }

  return data.outcome;
}
