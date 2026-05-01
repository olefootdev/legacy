/**
 * Legacy Mode — /dev/field-view.
 * Campo ao vivo limpo + SmartPanel.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { FieldView } from '@/components/match/FieldView';
import { SmartPanel, type PlayStyle } from '@/components/match/SmartPanel';
import { NarrativeBar } from '@/components/match/NarrativeBar';
import { LiveEventTimeline } from '@/components/match/LiveEventTimeline';
import { PlayerBrainCard } from '@/components/match/PlayerBrainCard';
import { PressureZoneOverlay } from '@/components/match/PressureZoneOverlay';
import { ReadGamePanel } from '@/components/match/ReadGamePanel';
import type { PitchPlayerState } from '@/engine/types';
import type { FormationSchemeId } from '@/match-engine/types';
import { useLegacyMatchEngine } from './useLegacyMatchEngine';
import { useGameStore } from '@/game/store';

// ── Mock inicial ─────────────────────────────────────────────────────────────
function mkPlayer(id: string, name: string, num: number, pos: string,
  role: 'attack' | 'mid' | 'def' | 'gk', x: number, y: number, fatigue = 20): PitchPlayerState {
  return { playerId: id, slotId: id, name, num, pos, role, x, y, fatigue, heading: 0 };
}
const HOME_PLAYERS_INITIAL: PitchPlayerState[] = [
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

// ── Main ─────────────────────────────────────────────────────────────────────
type CameraTrackMode = 'static' | 'follow' | 'actioncam';

function computeFollowCameraTransform(
  ballX: number,
  ballY: number,
  viewportHeight: number,
): { panY: number; panX: number } {
  // Keep ball at ~70% of viewport height for follow mode
  const targetY = ballX * (viewportHeight * 0.25) - viewportHeight * 0.6;
  // Lateral pan for follow
  const panX = (ballY - 50) * (viewportHeight * 0.08);
  return { panY: targetY, panX };
}

function computeActionCamTransform(
  ballX: number,
  ballY: number,
  viewportHeight: number,
): { scale: number; translateX: number; translateY: number } {
  // Zoom: 0.85 at home goal → 1.3 at away goal
  const zoomFactor = 0.85 + (ballX / 100) * 0.45;
  // Pan to ball with slight lead
  const panX = (ballY - 50) * (viewportHeight * 0.15);
  const panY = ballX * (viewportHeight * 0.25) - viewportHeight * 0.6;
  return { scale: zoomFactor, translateX: panX, translateY: panY };
}

export function FieldViewPreview() {
  const [camera, setCamera] = useState<'aerial' | 'broadcast'>('aerial');
  const [cameraTrack, setCameraTrack] = useState<CameraTrackMode>('static');
  const [cameraPan, setCameraPan] = useState({ x: 0, y: 0 });
  const [cameraZoom, setCameraZoom] = useState(1);

  // ── SmartPanel state ──────────────────────────────────────────────────────
  const [formation, setFormation] = useState<FormationSchemeId>('4-3-3');
  const [playStyle, setPlayStyle] = useState<PlayStyle>('PRESSAO_ALTA');
  const [fanMood, setFanMood] = useState(72);

  // ── Away club picker ──────────────────────────────────────────────────────
  const [awayClub, setAwayClub] = useState<{ name: string; logo: string } | null>(null);

  // ── Home crest from game store (optional — page is standalone) ────────────
  const favoriteRealTeam = useGameStore((s) => s.userSettings?.favoriteRealTeam ?? null);

  // ── PlayerBrainCard ───────────────────────────────────────────────────────
  const [brainPlayer, setBrainPlayer] = useState<PitchPlayerState | null>(null);

  const engine = useLegacyMatchEngine(HOME_PLAYERS_INITIAL, () => {}, false, 1);

  // ── Camera tracking — Follow + Action Cam ─────────────────────────────────
  // TODO: Re-enable camera tracking with proper effect management
  // For now, keeping cameras in static mode to avoid update depth exceeded errors

  // Atualiza fanMood com base no placar e posse (disabled for now due to update depth issue)
  // const lastMinuteRef = useRef(-1);
  // useEffect(() => {
  //   // Only update fanMood once per game minute
  //   if (engine.minute === lastMinuteRef.current) return;
  //   lastMinuteRef.current = engine.minute;
  //   const diff = engine.homeScore - engine.awayScore;
  //   const possessionBonus = engine.possession === 'home' ? 5 : -5;
  //   const base = 60 + diff * 8 + possessionBonus;
  //   setFanMood(prev => {
  //     const target = Math.max(10, Math.min(100, base));
  //     return Math.round(prev + (target - prev) * 0.15);
  //   });
  // }, [engine.homeScore, engine.awayScore, engine.possession, engine.minute]);

  return (
    <div className="fixed inset-0 z-[200] bg-[#050505] flex flex-col" style={{ touchAction: 'none' }}>
      <style>{`
        @keyframes slideFromField {
          from { opacity: 0; transform: translateY(-100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vignetteIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes kineticWord {
          0%   { opacity: 0;    transform: scale(0.88); }
          15%  { opacity: 0.10; transform: scale(1.02); }
          60%  { opacity: 0.10; transform: scale(1); }
          100% { opacity: 0;    transform: scale(1.06); }
        }
        @keyframes hudScoreShake {
          0%,100% { transform: translateX(0) scale(1); }
          20%     { transform: translateX(-5px) scale(1.08); }
          40%     { transform: translateX(5px) scale(1.12); }
          60%     { transform: translateX(-3px) scale(1.06); }
          80%     { transform: translateX(2px) scale(1.02); }
        }
        @keyframes pressurePulse {
          0%,100% { transform: translate(-50%,-50%) scale(1); opacity: 0.6; }
          50%     { transform: translate(-50%,-50%) scale(1.8); opacity: 0; }
        }
      `}</style>

      {/* ── NarrativeBar — disabled to test for update depth error ── */}
      {/* <NarrativeBar
        lastEventText={engine.events[0]?.text ?? null}
        lastEventKind={engine.events[0]?.kind}
        possession={engine.possession}
        ballX={engine.ballX}
        minute={engine.minute}
        isGoal={engine.lastEvent === 'goal'}
      /> */}

      {/* ── Campo — flex-1, centra e contém aspect-locked, com zoom T1/T2 ── */}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col items-stretch justify-center overflow-hidden">
        <div
          className="w-full h-full flex flex-col items-stretch justify-center min-h-0"
          style={{
            transform: `translate(${cameraPan.x}px, ${cameraPan.y}px) scale(${cameraZoom})`,
            transformOrigin: '50% 50%',
            transition: cameraTrack === 'static' ? 'transform 600ms cubic-bezier(0.4, 0, 0.2, 1)' : 'transform 350ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        >
          <FieldView
            homePlayers={engine.homePlayers}
            awayPlayers={engine.awayPlayers}
            ballX={engine.ballX}
            ballY={engine.ballY}
            onBallPlayerId={engine.onBallPlayerId}
            cameraMode={camera}
            homeShort="OLE"
            awayShort={awayClub?.name?.slice(0, 3).toUpperCase() ?? 'ADV'}
            homeName="Olefoot FC"
            awayName={awayClub?.name}
            homeCrestUrl={favoriteRealTeam?.logo ?? null}
            awayClub={awayClub}
            onAwayClubChange={setAwayClub}
            homeScore={engine.homeScore}
            awayScore={engine.awayScore}
            matchMinute={engine.minute}
            possession={engine.possession}
            phase={engine.phase}
            showCameraSwitch={true}
            onCameraChange={(m) => setCamera(m as 'aerial' | 'broadcast')}
            onPlayerClick={(p) => {
              setBrainPlayer(p);
              window.setTimeout(() => setBrainPlayer(null), 4000);
            }}
            className="w-full"
          />

          {/* ── PressureZoneOverlay — zonas de tensão ── */}
          <PressureZoneOverlay
            ballX={engine.ballX}
            possession={engine.possession}
            phase={engine.phase}
          />

          {/* ── PlayerBrainCard — inteligência do jogador ── */}
          {brainPlayer && (
            <PlayerBrainCard
              player={brainPlayer}
              onClose={() => setBrainPlayer(null)}
            />
          )}
        </div>
      </div>

      {/* ── Camera tracking controls — Fixed position (top level) ── */}
      <div
        className="absolute top-4 right-4 z-[120] flex gap-1.5"
        style={{ pointerEvents: 'auto' }}
      >
        <button
          type="button"
          onClick={() => setCameraTrack('static')}
          className="font-display uppercase transition-all active:scale-95"
          style={{
            background: cameraTrack === 'static' ? '#FDE100' : 'rgba(253,225,0,0.2)',
            color: cameraTrack === 'static' ? '#000' : '#FDE100',
            border: '1px solid rgba(253,225,0,0.5)',
            padding: '6px 12px',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.18em',
            borderRadius: 2,
            cursor: 'pointer',
          }}
        >
          Estático
        </button>
        <button
          type="button"
          onClick={() => setCameraTrack('follow')}
          className="font-display uppercase transition-all active:scale-95"
          style={{
            background: cameraTrack === 'follow' ? '#FDE100' : 'rgba(253,225,0,0.2)',
            color: cameraTrack === 'follow' ? '#000' : '#FDE100',
            border: '1px solid rgba(253,225,0,0.5)',
            padding: '6px 12px',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.18em',
            borderRadius: 2,
            cursor: 'pointer',
          }}
        >
          Follow
        </button>
        <button
          type="button"
          onClick={() => setCameraTrack('actioncam')}
          className="font-display uppercase transition-all active:scale-95"
          style={{
            background: cameraTrack === 'actioncam' ? '#FDE100' : 'rgba(253,225,0,0.2)',
            color: cameraTrack === 'actioncam' ? '#000' : '#FDE100',
            border: '1px solid rgba(253,225,0,0.5)',
            padding: '6px 12px',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.18em',
            borderRadius: 2,
            cursor: 'pointer',
          }}
        >
          Action Cam
        </button>
      </div>

      {/* ── LiveEventTimeline — memória da partida ── */}
      <LiveEventTimeline
        events={engine.events}
        currentMinute={engine.minute}
      />

      {/* ── Rodapé: SmartPanel + ReadGamePanel + CommandCenter ── */}
      <div style={{ position: 'relative' }}>
        <ReadGamePanel
          possession={engine.possession}
          ballX={engine.ballX}
          homePlayers={engine.homePlayers}
          events={engine.events}
          playStyle={playStyle}
          homeScore={engine.homeScore}
          awayScore={engine.awayScore}
          minute={engine.minute}
        />
        <SmartPanel
          formation={formation}
          onFormationChange={setFormation}
          playStyle={playStyle}
          onStyleChange={setPlayStyle}
          fanMood={fanMood}
        />
      </div>
    </div>
  );
}
