/**
 * Token de escaneamento: "vira o pescoço" antes de pedir passe.
 * Estado por jogador: idle | scanning | ready.
 * scanDuration: 0.15-0.25s (visual apenas, não bloqueia decisão).
 */
export type ScanState = 'idle' | 'scanning' | 'ready';

export interface ScanToken {
  playerId: string;
  state: ScanState;
  startedAt: number;  // simTime
  scanDuration: number;  // segundos
}

/** Creates a new scan token in 'scanning' state */
export function createScanToken(playerId: string, simTime: number): ScanToken {
  // Random duration between 0.15 and 0.25s
  const scanDuration = 0.15 + Math.random() * 0.10;
  return {
    playerId,
    state: 'scanning',
    startedAt: simTime,
    scanDuration,
  };
}

/** Advances the scan token state based on current simTime */
export function tickScanToken(token: ScanToken, simTime: number): ScanToken {
  if (token.state === 'idle') return token;

  if (token.state === 'scanning') {
    const elapsed = simTime - token.startedAt;
    if (elapsed >= token.scanDuration) {
      return { ...token, state: 'ready' };
    }
    return token;
  }

  // 'ready' state: stays ready until caller resets to idle
  return token;
}

/** True se o jogador está em estado de scan (animação visível) */
export function isScanning(token: ScanToken): boolean {
  return token.state === 'scanning';
}
