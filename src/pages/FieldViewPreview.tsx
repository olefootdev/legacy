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
export function FieldViewPreview() {
  const [camera, setCamera] = useState<'aerial' | 'broadcast'>('aerial');

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


  // Atualiza fanMood com base no placar e posse (após engine estar disponível)
  useEffect(() => {
    const diff = engine.homeScore - engine.awayScore;
    const possessionBonus = engine.possession === 'home' ? 5 : -5;
    const base = 60 + diff * 8 + possessionBonus;
    setFanMood(prev => {
      const target = Math.max(10, Math.min(100, base));
      return Math.round(prev + (target - prev) * 0.15);
    });
  }, [engine.homeScore, engine.awayScore, engine.possession, engine.minute]);

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

      {/* ── NarrativeBar — faixa editorial entre HUD e campo ── */}
      <NarrativeBar
        lastEventText={engine.events[0]?.text ?? null}
        lastEventKind={engine.events[0]?.kind}
        possession={engine.possession}
        ballX={engine.ballX}
        minute={engine.minute}
        isGoal={engine.lastEvent === 'goal'}
      />

      {/* ── Campo — flex-1, centra e contém aspect-locked, com zoom T1/T2 ── */}
      {/* Wrapper externo: items-stretch + justify-center + min-h-0 permite o
          FieldView interno (h-full + aspect-ratio) fittar pelo menor lado.
          T2 imersivo: perspectiva de baixo (rotateX) + zoom alto. */}
      <div
        className="flex-1 min-h-0 min-w-0 flex flex-col items-stretch justify-center overflow-hidden"
      >
      <div
        className="w-full h-full flex flex-col items-stretch justify-center min-h-0"
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
