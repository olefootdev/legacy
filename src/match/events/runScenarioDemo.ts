/**
 * Cenário scriptado (10 eventos): kickoff → posse → passe → remate → escanteio.
 * Rodar: `npm run demo:sim-pipeline`
 */
import { MatchSimulationEventBus } from './matchSimulationEventBus';
import { narrativeLineForSimulationEvent } from './narrativeFromSimulationEvents';
import type { MatchSimulationEvent } from './matchSimulationContract';

const bus = new MatchSimulationEventBus();
const lines: string[] = [];
const kinds: MatchSimulationEvent['kind'][] = [];
bus.subscribe((e) => {
  lines.push(narrativeLineForSimulationEvent(e));
  kinds.push(e.kind);
});

let t = 0;
function emit(e: MatchSimulationEvent) {
  bus.emit(e);
}

emit({ kind: 'PhaseChanged', from: 'PREGAME', to: 'KICKOFF', at: t });
emit({ kind: 'Whistle', reason: 'Início da partida', at: t });
t += 0.4;
emit({ kind: 'KickoffTaken', at: t });
emit({ kind: 'PhaseChanged', from: 'KICKOFF', to: 'OPEN_PLAY', at: t });
t += 0.6;
emit({ kind: 'PossessionChanged', side: 'home', at: t });
emit({ kind: 'PassAttempt', fromPlayerId: 'h-mc1', at: t });
emit({ kind: 'PassCompleted', fromPlayerId: 'h-mc1', toPlayerId: 'h-ata', at: t });
t += 1.0;
emit({ kind: 'Shot', playerId: 'h-ata', at: t });
t += 0.5;
emit({ kind: 'PhaseChanged', from: 'OPEN_PLAY', to: 'SET_PIECE_CORNER', at: t });
emit({ kind: 'SetPiecePosition', piece: 'corner', side: 'away', at: t });

const expectedCount = 10;
if (lines.length !== expectedCount) {
  console.error(`Esperado ${expectedCount} linhas, obtido ${lines.length}`);
  process.exitCode = 1;
}

console.log('Engine events → narrativa (demo)\n');
console.log(lines.join('\n'));
console.log('\nOK:', kinds.join(' → '));
