/**
 * Partida ao vivo (MVP) — campo 2D + `TacticalSimLoop` + `SIM_SYNC`.
 * Rota: `/match/live`
 */
import { Live2dMatchShell, type Live2dShellConfig } from '@/pages/Live2dMatchShell';

const LIVE_CONFIG: Live2dShellConfig = {
  productLabel: 'Partida ao vivo',
  productSub: 'Motor tático MVP',
};

export function MatchLive() {
  return <Live2dMatchShell config={LIVE_CONFIG} />;
}
