/**
 * Legacy Mode — /dev/field-view.
 * Campo ao vivo limpo + SmartPanel.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FieldView } from '@/components/match/FieldView';
import type { PlayStyle } from '@/components/match/SmartPanel';
import { NarrativeBar } from '@/components/match/NarrativeBar';
import { FalePlayerBar } from '@/components/match/FalePlayerBar';
import { LegacyEditorialHeader } from '@/components/match/LegacyEditorialHeader';
import { LegacyMinuteWatermark } from '@/components/match/LegacyMinuteWatermark';
import { PlayerBrainCard } from '@/components/match/PlayerBrainCard';
import { PressureZoneOverlay } from '@/components/match/PressureZoneOverlay';
import { ReadGamePanel } from '@/components/match/ReadGamePanel';
import { ExpertPanel } from '@/components/match/ExpertPanel';
import { useNarrativeCamera } from '@/components/match/useNarrativeCamera';
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
  const navigate = useNavigate();
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [camera, setCamera] = useState<'aerial' | 'broadcast'>('aerial');
  const [viewMode, setViewMode] = useState<'aerial' | 'expert'>('aerial');
  const [cameraTrack, setCameraTrack] = useState<CameraTrackMode>('static');
  const [cameraPan, setCameraPan] = useState({ x: 0, y: 0 });
  const [cameraZoom, setCameraZoom] = useState(1);

  // ── SmartPanel state ──────────────────────────────────────────────────────
  const [formation, setFormation] = useState<FormationSchemeId>('4-3-3');
  const [playStyle, setPlayStyle] = useState<PlayStyle>('PRESSAO_ALTA');
  const [fanMood, setFanMood] = useState(72);

  // ── Home crest from game store (optional — page is standalone) ────────────
  const favoriteRealTeam = useGameStore((s) => s.userSettings?.favoriteRealTeam ?? null);

  // ── PlayerBrainCard ───────────────────────────────────────────────────────
  const [brainPlayer, setBrainPlayer] = useState<PitchPlayerState | null>(null);

  const engine = useLegacyMatchEngine(HOME_PLAYERS_INITIAL, () => {}, false, 1);

  // Câmera narrativa — ref-based, escreve direto no DOM (zero re-render)
  const cameraRef = useRef<HTMLDivElement>(null);
  useNarrativeCamera(cameraRef, {
    ballX: engine.ballX,
    ballY: engine.ballY,
    possession: engine.possession,
    homePlayers: engine.homePlayers,
    awayPlayers: engine.awayPlayers,
    lastEvent: engine.lastEvent,
  });

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

      {/* ── Header editorial Legacy Tech ── */}
      <LegacyEditorialHeader
        homeName="Olefoot FC"
        awayName="Adversário"
        homeScore={engine.homeScore}
        awayScore={engine.awayScore}
        minute={engine.minute}
        possession={engine.possession}
        phase={engine.phase}
        formation={formation}
        onFormationChange={setFormation}
        onExit={() => setShowExitConfirm(true)}
      />

      {showExitConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 300,
            background: 'rgba(0,0,0,0.78)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#0D0D0D',
              border: '1px solid rgba(253,225,0,0.25)',
              borderLeft: '3px solid #FDE100',
              padding: '24px 24px 20px',
              maxWidth: 380,
              width: '100%',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.32em',
                color: '#FDE100',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Sair da partida
            </div>
            <div
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontStyle: 'italic',
                fontSize: 22,
                color: '#fff',
                lineHeight: 1.2,
                marginBottom: 16,
                letterSpacing: '-0.01em',
              }}
            >
              Tem certeza?
            </div>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                color: 'rgba(255,255,255,0.55)',
                lineHeight: 1.5,
                marginBottom: 20,
              }}
            >
              Em partida rankeada ou de campeonato, desistir conta como derrota de <strong style={{ color: '#EF4444' }}>5×0</strong>.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.7)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase',
                  padding: '8px 16px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                style={{
                  background: '#EF4444',
                  border: '1px solid #EF4444',
                  color: '#fff',
                  fontFamily: 'var(--font-display)',
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase',
                  padding: '8px 16px',
                  cursor: 'pointer',
                }}
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View mode toggle: Aerial / Expert ── */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 2,
        padding: '4px 0 2px', background: 'rgba(5,5,5,0.98)',
        borderBottom: '1px solid rgba(253,225,0,0.04)',
      }}>
        {(['aerial', 'expert'] as const).map((m) => (
          <button key={m} type="button" onClick={() => {
            setViewMode(m);
            if (m === 'expert') setCamera('broadcast');
            else setCamera('aerial');
          }}
            style={{
              background: viewMode === m ? '#FDE100' : 'rgba(255,255,255,0.04)',
              color: viewMode === m ? '#000' : 'rgba(255,255,255,0.3)',
              border: viewMode === m ? '1px solid #FDE100' : '1px solid rgba(255,255,255,0.06)',
              fontFamily: 'var(--font-display)',
              fontSize: 8, fontWeight: 800,
              letterSpacing: '0.25em', textTransform: 'uppercase',
              padding: '4px 14px', cursor: 'pointer',
              transition: 'all 150ms',
            }}>
            {m === 'aerial' ? 'Aerial' : 'Expert'}
          </button>
        ))}
      </div>

      {/* ── Campo — flex-1 in aerial, constrained in expert ── */}
      <div className={`${viewMode === 'expert' ? '' : 'flex-1'} min-h-0 min-w-0 flex flex-col items-stretch justify-end overflow-hidden relative`}
        style={viewMode === 'expert' ? { height: '38vh', flexShrink: 0 } : undefined}
      >
        <div
          ref={cameraRef}
          className="w-full h-full flex flex-col items-stretch justify-end min-h-0"
          style={{
            transformOrigin: '50% 50%',
            willChange: 'transform',
          }}
        >
          <FieldView
            homePlayers={engine.homePlayers}
            awayPlayers={engine.awayPlayers}
            ballX={engine.ballX}
            ballY={engine.ballY}
            onBallPlayerId={engine.onBallPlayerId}
            cameraMode={viewMode === 'expert' ? 'broadcast' : camera}
            homeShort="OLE"
            awayShort="ADV"
            homeName="Olefoot FC"
            homeCrestUrl={favoriteRealTeam?.logo ?? null}
            homeScore={engine.homeScore}
            awayScore={engine.awayScore}
            matchMinute={engine.minute}
            possession={engine.possession}
            phase={engine.phase}
            showCameraSwitch={viewMode !== 'expert'}
            hideHud={true}
            onCameraChange={(m) => setCamera(m as 'aerial' | 'broadcast')}
            onPlayerClick={(p) => {
              setBrainPlayer(p);
              window.setTimeout(() => setBrainPlayer(null), 4000);
            }}
            className="w-full"
          />

          {/* ── PressureZoneOverlay — zonas de tensão ── */}
          {viewMode !== 'expert' && (
            <PressureZoneOverlay
              ballX={engine.ballX}
              possession={engine.possession}
              phase={engine.phase}
            />
          )}

          {/* ── PlayerBrainCard — inteligência do jogador ── */}
          {brainPlayer && (
            <PlayerBrainCard
              player={brainPlayer}
              onClose={() => setBrainPlayer(null)}
            />
          )}
        </div>

        {/* ── Watermark do minuto (ambient) — only in aerial ── */}
        {viewMode !== 'expert' && (
          <LegacyMinuteWatermark
            minute={engine.minute}
            phase={engine.phase}
            momentLabel={engine.lastEvent === 'goal' ? 'GOL' : engine.ballX > 70 ? 'ATAQUE' : engine.ballX < 30 ? 'DEFESA' : 'BOLA ROLANDO'}
          />
        )}

        {/* ── Ler Jogo — overlay no campo, canto inferior esquerdo ── */}
        {viewMode !== 'expert' && (
          <div style={{ position: 'absolute', left: 16, bottom: 16, zIndex: 100 }}>
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
          </div>
        )}
      </div>

      {/* ── Expert Panel — stats below field ── */}
      {viewMode === 'expert' && (
        <ExpertPanel
          homeStats={engine.homeStats}
          awayStats={engine.awayStats}
          possessionPct={engine.possessionPct}
          homePlayers={engine.homePlayers}
          awayPlayers={engine.awayPlayers}
          homeScore={engine.homeScore}
          awayScore={engine.awayScore}
          minute={engine.minute}
        />
      )}

      {/* Spacer para FalePlayerBar fixa não cobrir o campo */}
      <div aria-hidden style={{ height: 110, flexShrink: 0 }} />

      {/* ── FALE COM OS JOGADORES — fixo no rodapé absoluto ── */}
      <FalePlayerBar
        players={engine.homePlayers}
        ballCarrierId={engine.onBallPlayerId}
        minute={engine.minute}
      />
    </div>
  );
}
