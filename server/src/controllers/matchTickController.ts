/**
 * Controller para tick de partida Quick Match
 * Move lógica do GameSpirit para o servidor (anti-cheat + replay)
 */

import type { Context } from 'hono';
import { gameSpiritTick, buildSpiritContext } from '../../../src/gamespirit/GameSpirit.js';
import type { PitchPlayerState, PossessionSide } from '../../../src/engine/types.js';

interface MatchTickRequest {
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

export async function postMatchTick(c: Context): Promise<Response> {
  let body: MatchTickRequest;

  try {
    body = await c.req.json() as MatchTickRequest;
  } catch {
    return c.json({ error: 'JSON inválido.' }, 400);
  }

  // Validação básica
  if (typeof body.minute !== 'number' || body.minute < 0 || body.minute > 120) {
    return c.json({ error: 'minute inválido.' }, 400);
  }

  if (!body.possession || !['home', 'away'].includes(body.possession)) {
    return c.json({ error: 'possession inválido.' }, 400);
  }

  if (!body.ball || typeof body.ball.x !== 'number' || typeof body.ball.y !== 'number') {
    return c.json({ error: 'ball inválido.' }, 400);
  }

  if (!Array.isArray(body.homeRoster) || !Array.isArray(body.homePlayers)) {
    return c.json({ error: 'homeRoster ou homePlayers inválido.' }, 400);
  }

  try {
    // Build context
    const ctx = buildSpiritContext({
      minute: body.minute,
      homeScore: body.homeScore,
      awayScore: body.awayScore,
      possession: body.possession,
      ball: body.ball,
      onBall: body.onBall,
      crowdSupport: body.crowdSupport,
      tacticalMentality: body.tacticalMentality,
      tacticalStyle: body.tacticalStyle,
      opponentStrength: body.opponentStrength,
      homeRoster: body.homeRoster,
      homePlayers: body.homePlayers,
      homeShort: body.homeShort,
      awayRoster: body.awayRoster,
      momentum: body.momentum,
      pendingCornerForSide: body.pendingCornerForSide,
      pendingFreeKickForSide: body.pendingFreeKickForSide,
      smartfieldActionHint: body.smartfieldActionHint,
    });

    // Run tick
    const outcome = gameSpiritTick(
      ctx,
      body.awayShort,
      body.causalSeqStart,
      Date.now(),
    );

    return c.json({
      ok: true,
      outcome,
    });
  } catch (error) {
    console.error('Match tick error:', error);
    return c.json(
      {
        error: 'Erro ao processar tick da partida.',
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}
