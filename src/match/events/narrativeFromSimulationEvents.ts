import type { MatchSimulationEvent } from './matchSimulationContract';

/** Uma linha de comentário/narrativa por evento — só texto derivado do evento. */
export function narrativeLineForSimulationEvent(e: MatchSimulationEvent): string {
  switch (e.kind) {
    case 'PhaseChanged':
      return `[${e.at.toFixed(2)}s] Fase: ${e.from} → ${e.to}`;
    case 'BallPositionChanged':
      return `[${e.at.toFixed(2)}s] Bola em (${e.x.toFixed(1)}, ${e.z.toFixed(1)})`;
    case 'PossessionChanged':
      return `[${e.at.toFixed(2)}s] Posse: ${e.side === 'home' ? 'casa' : 'visitante'}`;
    case 'Whistle':
      return `[${e.at.toFixed(2)}s] Apito — ${e.reason}`;
    case 'PassAttempt':
      return `[${e.at.toFixed(2)}s] Passe tentado (${e.fromPlayerId})`;
    case 'PassCompleted':
      return `[${e.at.toFixed(2)}s] Passe concluído ${e.fromPlayerId} → ${e.toPlayerId}`;
    case 'Shot':
      return `[${e.at.toFixed(2)}s] Remate (${e.playerId})`;
    case 'SetPiecePosition':
      return `[${e.at.toFixed(2)}s] Bola parada: ${e.piece} (${e.side})`;
    case 'Goal':
      return `[${e.at.toFixed(2)}s] GOLO ${e.side === 'home' ? 'CASA' : 'FORA'}`;
    case 'KickoffTaken':
      return `[${e.at.toFixed(2)}s] Reinício / kickoff`;
    case 'EngineNarrativeLine':
      return `[${e.minute}' engine] ${e.text}`;
    case 'CausalShotAttempt':
      return `[${e.at.toFixed(2)}s] Remate tentado (${e.shooterId}, ${e.zone})`;
    case 'CausalShotResult':
      return `[${e.at.toFixed(2)}s] Resultado remate: ${e.outcome} (${e.side})`;
    case 'CausalEnginePhase':
      return `[${e.at.toFixed(2)}s] Motor: ${e.from} → ${e.to}${e.reason ? ` — ${e.reason}` : ''}`;
    case 'CausalBallState':
      return `[${e.at.toFixed(2)}s] Bola % (${e.xPercent.toFixed(0)}, ${e.yPercent.toFixed(0)}) — ${e.reason}`;
    default: {
      const _x: never = e;
      return `[evento] ${String(_x)}`;
    }
  }
}
