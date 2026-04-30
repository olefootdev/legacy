/**
 * Sandbox do novo campo Legacy Tech — /dev/field-view.
 * Dados mock estáticos: formação 4-3-3 casa vs 4-4-2 visitante.
 */
import { useState, useCallback } from 'react';
import { FieldView, type FieldCameraMode } from '@/components/match/FieldView';
import type { PitchPlayerState } from '@/engine/types';

// ── Mock players ────────────────────────────────────────────────────────────
function mkPlayer(
  id: string,
  name: string,
  num: number,
  pos: string,
  role: 'attack' | 'mid' | 'def' | 'gk',
  x: number,
  y: number,
  fatigue = 20,
): PitchPlayerState {
  return {
    playerId: id,
    slotId: id,
    name,
    num,
    pos,
    role,
    x,
    y,
    fatigue,
    heading: 0,
  };
}

// Casa: ataca pra direita (x=0 gol próprio, x=100 gol adversário)
const HOME_PLAYERS: PitchPlayerState[] = [
  mkPlayer('gk1', 'Murilo Sá', 1, 'GOL', 'gk', 5, 50, 10),
  mkPlayer('zag1', 'Rafael Lima', 4, 'ZAG', 'def', 22, 32, 15),
  mkPlayer('zag2', 'Bruno Costa', 5, 'ZAG', 'def', 22, 68, 12),
  mkPlayer('lat1', 'Diego Ramos', 2, 'LAT', 'def', 18, 15, 28),
  mkPlayer('lat2', 'André Paulo', 3, 'LAT', 'def', 18, 85, 22),
  mkPlayer('vol1', 'Thiago Cruz', 8, 'VOL', 'mid', 40, 50, 35),
  mkPlayer('mei1', 'Lucas Brito', 10, 'MEI', 'mid', 52, 28, 18),
  mkPlayer('mei2', 'Caio Alves', 6, 'MEI', 'mid', 52, 72, 42),
  mkPlayer('pe1', 'Vini Santos', 11, 'PE', 'attack', 68, 18, 55),
  mkPlayer('pd1', 'Rodry Neto', 7, 'PD', 'attack', 68, 82, 60),
  mkPlayer('ata1', 'Gabri Gol', 9, 'ATA', 'attack', 76, 50, 30),
];

// Visitante: ataca pra esquerda
const AWAY_PLAYERS: PitchPlayerState[] = [
  mkPlayer('agk1', 'Silvio', 1, 'GOL', 'gk', 95, 50, 8),
  mkPlayer('azag1', 'Marcos', 4, 'ZAG', 'def', 78, 35, 14),
  mkPlayer('azag2', 'Felipe', 5, 'ZAG', 'def', 78, 65, 11),
  mkPlayer('alat1', 'Edu', 2, 'LAT', 'def', 82, 18, 20),
  mkPlayer('alat2', 'Igor', 3, 'LAT', 'def', 82, 82, 19),
  mkPlayer('avol1', 'Patrick', 6, 'VOL', 'mid', 62, 35, 38),
  mkPlayer('avol2', 'Mateus', 8, 'VOL', 'mid', 62, 65, 44),
  mkPlayer('amei1', 'Samuel', 10, 'MEI', 'mid', 48, 50, 29),
  mkPlayer('ape1', 'Kelvin', 11, 'PD', 'attack', 38, 22, 50),
  mkPlayer('apd1', 'Arthur', 7, 'PE', 'attack', 38, 78, 48),
  mkPlayer('aata1', 'Bruno M', 9, 'ATA', 'attack', 28, 50, 25),
];

export function FieldViewPreview() {
  const [camera, setCamera] = useState<FieldCameraMode>('aerial');
  const [onBallId, setOnBallId] = useState<string>('ata1');
  const [ballX, setBallX] = useState(76);
  const [ballY, setBallY] = useState(50);
  const [minute, setMinute] = useState(67);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const handlePlayerClick = useCallback((p: PitchPlayerState) => {
    setOnBallId(p.playerId);
    setBallX(p.x);
    setBallY(p.y);
  }, []);

  return (
    <div className="fixed inset-0 z-[200] bg-[#050505] flex flex-col" style={{ touchAction: 'none' }}>
      {/* Dev bar */}
      <div
        className="absolute top-3 left-3 z-50 flex flex-wrap gap-1.5 px-3 py-2 border border-white/15 bg-black/90"
        style={{ borderRadius: 6 }}
      >
        <span
          className="font-display uppercase text-neon-yellow self-center"
          style={{ fontSize: 9, letterSpacing: '0.3em' }}
        >
          CAMPO ·
        </span>
        {(['aerial', 'broadcast'] as FieldCameraMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setCamera(m)}
            className="font-display uppercase tracking-wider px-2 py-1 transition-all"
            style={{
              background: camera === m ? '#FDE100' : 'rgba(255,255,255,0.06)',
              color: camera === m ? '#000' : 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.12)',
              fontSize: 10,
              letterSpacing: '0.18em',
              borderRadius: 4,
            }}
          >
            {m}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setCamera('aerial');
            setHighlightId(onBallId);
            window.setTimeout(() => setHighlightId(null), 3500);
          }}
          className="font-display uppercase tracking-wider px-2 py-1 transition-all"
          style={{
            background: highlightId ? '#FDE100' : 'rgba(255,255,255,0.06)',
            color: highlightId ? '#000' : 'rgba(253,225,0,0.85)',
            border: '1px solid rgba(253,225,0,0.4)',
            fontSize: 10,
            letterSpacing: '0.18em',
            borderRadius: 4,
          }}
        >
          ▶ destaque
        </button>
        <span className="text-white/40 self-center" style={{ fontSize: 9, marginLeft: 6 }}>
          · clique num jogador pra mover a bola
        </span>
      </div>

      {/* Field — fills width, natural height on portrait; fills height on landscape */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <FieldView
          homePlayers={HOME_PLAYERS}
          awayPlayers={AWAY_PLAYERS}
          ballX={ballX}
          ballY={ballY}
          onBallPlayerId={onBallId}
          cameraMode={camera}
          homeShort="OLE"
          awayShort="ADV"
          homeScore={2}
          awayScore={1}
          matchMinute={minute}
          showCameraSwitch={false}
          highlightPlayerId={highlightId}
          onPlayerClick={handlePlayerClick}
          className="w-full"
        />
        {/* Below-field panel: live events placeholder */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-4 border-t border-white/8">
          <div
            className="font-display uppercase text-neon-yellow mb-3"
            style={{ fontSize: 9, letterSpacing: '0.35em' }}
          >
            Ao vivo
          </div>
          {[
            { min: 67, text: 'Rodry Neto conduz pelo lado direito, toca pra Gabri Gol…' },
            { min: 66, text: 'Falta cometida por Patrick no meio-campo.' },
            { min: 65, text: 'GOL! Gabri Gol cabeceia no segundo pau — 2×1!' },
            { min: 63, text: 'Escanteio pra casa após defesa do goleiro.' },
            { min: 61, text: 'Silvio fecha bem e afasta o perigo na pequena área.' },
          ].map((e, i) => (
            <div
              key={i}
              className="flex gap-2 mb-2"
              style={{ opacity: 1 - i * 0.15 }}
            >
              <span
                className="shrink-0 font-display font-black tabular-nums text-neon-yellow"
                style={{ fontSize: 11, minWidth: 24 }}
              >
                {e.min}&prime;
              </span>
              <span className="text-white/70" style={{ fontSize: 12, lineHeight: 1.45 }}>
                {e.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
