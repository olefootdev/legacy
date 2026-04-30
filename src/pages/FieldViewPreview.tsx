/**
 * Sandbox do novo campo Legacy Tech — /dev/field-view.
 * Dados mock estáticos: formação 4-3-3 casa vs 4-4-2 visitante.
 */
import { useState, useCallback, type ComponentType } from 'react';
import { FieldView, type FieldCameraMode } from '@/components/match/FieldView';
import type { PitchPlayerState } from '@/engine/types';
import {
  GoalkeeperDistribution,
  GoalkeeperPressure,
  resolveGoalkeeperDistribution,
  CornerAttacker,
  CornerDefender,
  resolveCorner,
  FreeKickAttacker,
  FreeKickDefender,
  resolveFreeKick,
  AttackerReceivesAttacker,
  AttackerReceivesDefender,
  resolveAttackerReceives,
  WingCrossAttacker,
  WingCrossDefender,
  resolveWingCross,
  WingerOneOnOneAttacker,
  WingerOneOnOneDefender,
  resolveWingerOneOnOne,
  TackleAttacker,
  TackleDefender,
  resolveTackle,
  LastLineAttacker,
  LastLineDefender,
  resolveLastLine,
  ReboundAttacker,
  ReboundDefender,
  resolveRebound,
  GegenpressAttacker,
  GegenpressDefender,
  resolveGegenpress,
  CounterAttacker,
  CounterDefender,
  resolveCounter,
  OneOnOneAttacker,
  OneOnOneKeeper,
  resolveOneOnOne,
  HeaderAttacker,
  HeaderDefender,
  resolveHeader,
} from '@/components/match/decisions';

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

// ── Decision moment registry ────────────────────────────────────────────────
type ChoiceCb = (c: string) => void;
type PromptComp = ComponentType<{ onChoose: ChoiceCb; onTimeout?: () => void }>;

interface MomentDef {
  id: string;
  label: string;
  Attacker: PromptComp;
  Defender: PromptComp;
  resolve: (att: string, def: string) => 'intercept' | 'progress';
  highlight?: string;
  defensiveAction?: boolean;
  fallbackAttacker: string;
  fallbackDefender: string;
}

const MOMENTS: MomentDef[] = [
  {
    id: 'gk',
    label: '▶ saída',
    Attacker: GoalkeeperDistribution as PromptComp,
    Defender: GoalkeeperPressure as PromptComp,
    resolve: resolveGoalkeeperDistribution as (a: string, d: string) => 'intercept' | 'progress',
    highlight: 'gk1',
    fallbackAttacker: 'long',
    fallbackDefender: 'deep',
  },
  {
    id: 'corner',
    label: '▶ escanteio',
    Attacker: CornerAttacker as PromptComp,
    Defender: CornerDefender as PromptComp,
    resolve: resolveCorner as (a: string, d: string) => 'intercept' | 'progress',
    fallbackAttacker: 'near',
    fallbackDefender: 'near',
  },
  {
    id: 'freekick',
    label: '▶ falta',
    Attacker: FreeKickAttacker as PromptComp,
    Defender: FreeKickDefender as PromptComp,
    resolve: resolveFreeKick as (a: string, d: string) => 'intercept' | 'progress',
    fallbackAttacker: 'cross',
    fallbackDefender: 'cross',
  },
  {
    id: 'recv',
    label: '▶ recepção',
    Attacker: AttackerReceivesAttacker as PromptComp,
    Defender: AttackerReceivesDefender as PromptComp,
    resolve: resolveAttackerReceives as (a: string, d: string) => 'intercept' | 'progress',
    highlight: 'ata1',
    fallbackAttacker: 'hold',
    fallbackDefender: 'hold',
  },
  {
    id: 'wing',
    label: '▶ fundo',
    Attacker: WingCrossAttacker as PromptComp,
    Defender: WingCrossDefender as PromptComp,
    resolve: resolveWingCross as (a: string, d: string) => 'intercept' | 'progress',
    highlight: 'pd1',
    fallbackAttacker: 'cross',
    fallbackDefender: 'cross',
  },
  {
    id: '1v1',
    label: '▶ 1×1',
    Attacker: WingerOneOnOneAttacker as PromptComp,
    Defender: WingerOneOnOneDefender as PromptComp,
    resolve: resolveWingerOneOnOne as (a: string, d: string) => 'intercept' | 'progress',
    highlight: 'pd1',
    fallbackAttacker: 'inside',
    fallbackDefender: 'inside',
  },
  {
    id: 'tackle',
    label: '▶ carrinho',
    Attacker: TackleAttacker as PromptComp,
    Defender: TackleDefender as PromptComp,
    resolve: resolveTackle as (a: string, d: string) => 'intercept' | 'progress',
    fallbackAttacker: 'shield',
    fallbackDefender: 'cover',
  },
  {
    id: 'lastline',
    label: '▶ linha',
    Attacker: LastLineAttacker as PromptComp,
    Defender: LastLineDefender as PromptComp,
    resolve: resolveLastLine as (a: string, d: string) => 'intercept' | 'progress',
    fallbackAttacker: 'feet',
    fallbackDefender: 'hold',
  },
  {
    id: 'rebound',
    label: '▶ rebote',
    Attacker: ReboundAttacker as PromptComp,
    Defender: ReboundDefender as PromptComp,
    resolve: resolveRebound as (a: string, d: string) => 'intercept' | 'progress',
    defensiveAction: true,
    highlight: 'gk1',
    fallbackAttacker: 'first',
    fallbackDefender: 'block',
  },
  {
    id: 'gegen',
    label: '▶ gegen',
    Attacker: GegenpressAttacker as PromptComp,
    Defender: GegenpressDefender as PromptComp,
    resolve: resolveGegenpress as (a: string, d: string) => 'intercept' | 'progress',
    fallbackAttacker: 'short',
    fallbackDefender: 'swarm',
  },
  {
    id: 'counter',
    label: '▶ contra',
    Attacker: CounterAttacker as PromptComp,
    Defender: CounterDefender as PromptComp,
    resolve: resolveCounter as (a: string, d: string) => 'intercept' | 'progress',
    fallbackAttacker: 'wing',
    fallbackDefender: 'delay',
  },
  {
    id: '1v1gk',
    label: '▶ cara',
    Attacker: OneOnOneAttacker as PromptComp,
    Defender: OneOnOneKeeper as PromptComp,
    resolve: resolveOneOnOne as (a: string, d: string) => 'intercept' | 'progress',
    defensiveAction: true,
    highlight: 'gk1',
    fallbackAttacker: 'placed',
    fallbackDefender: 'angle',
  },
  {
    id: 'header',
    label: '▶ cabeça',
    Attacker: HeaderAttacker as PromptComp,
    Defender: HeaderDefender as PromptComp,
    resolve: resolveHeader as (a: string, d: string) => 'intercept' | 'progress',
    fallbackAttacker: 'power',
    fallbackDefender: 'jump',
  },
];

export function FieldViewPreview() {
  const [camera, setCamera] = useState<FieldCameraMode>('aerial');
  const [onBallId, setOnBallId] = useState<string>('ata1');
  const [ballX, setBallX] = useState(76);
  const [ballY, setBallY] = useState(50);
  const [minute] = useState(67);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [defensiveAction, setDefensiveAction] = useState(false);

  // Generic moment state
  const [activeMoment, setActiveMoment] = useState<MomentDef | null>(null);
  const [attackerPick, setAttackerPick] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'intercept' | 'progress' | null>(null);

  const startMoment = useCallback((m: MomentDef) => {
    setAttackerPick(null);
    setOutcome(null);
    setActiveMoment(m);
    setCamera('aerial');
    if (m.highlight) setHighlightId(m.highlight);
    if (m.defensiveAction) setDefensiveAction(true);
  }, []);

  const handleAttackerChoice = useCallback((c: string) => {
    setAttackerPick(c);
  }, []);

  const handleDefenderChoice = useCallback(
    (c: string) => {
      if (!activeMoment || !attackerPick) return;
      const r = activeMoment.resolve(attackerPick, c);
      setOutcome(r);
      window.setTimeout(() => {
        setActiveMoment(null);
        setAttackerPick(null);
        setOutcome(null);
        setHighlightId(null);
        setDefensiveAction(false);
      }, 2200);
    },
    [activeMoment, attackerPick],
  );

  const handlePlayerClick = useCallback((p: PitchPlayerState) => {
    setOnBallId(p.playerId);
    setBallX(p.x);
    setBallY(p.y);
  }, []);

  const Attacker = activeMoment?.Attacker;
  const Defender = activeMoment?.Defender;

  return (
    <div className="fixed inset-0 z-[200] bg-[#050505] flex flex-col" style={{ touchAction: 'none' }}>
      {/* Dev bar */}
      <div
        className="absolute top-3 left-3 z-50 flex flex-wrap gap-1.5 px-3 py-2 border border-white/15 bg-black/90"
        style={{ borderRadius: 6, maxWidth: 'calc(100% - 24px)' }}
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
        <button
          type="button"
          onClick={() => {
            setCamera('aerial');
            setDefensiveAction(true);
            setHighlightId('gk1');
            window.setTimeout(() => {
              setDefensiveAction(false);
              setHighlightId(null);
            }, 4000);
          }}
          className="font-display uppercase tracking-wider px-2 py-1 transition-all"
          style={{
            background: defensiveAction ? '#FDE100' : 'rgba(255,255,255,0.06)',
            color: defensiveAction ? '#000' : 'rgba(253,225,0,0.85)',
            border: '1px solid rgba(253,225,0,0.4)',
            fontSize: 10,
            letterSpacing: '0.18em',
            borderRadius: 4,
          }}
        >
          ▶ defesa
        </button>
        {MOMENTS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => startMoment(m)}
            className="font-display uppercase tracking-wider px-2 py-1 transition-all"
            style={{
              background: activeMoment?.id === m.id ? '#FDE100' : 'rgba(255,255,255,0.06)',
              color: activeMoment?.id === m.id ? '#000' : 'rgba(253,225,0,0.85)',
              border: '1px solid rgba(253,225,0,0.4)',
              fontSize: 10,
              letterSpacing: '0.18em',
              borderRadius: 4,
            }}
          >
            {m.label}
          </button>
        ))}
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
          defensiveAction={defensiveAction}
          onPlayerClick={handlePlayerClick}
          className="w-full"
        />

        {/* Decision Moment overlay */}
        {activeMoment && Attacker && !attackerPick && (
          <Attacker
            onChoose={handleAttackerChoice}
            onTimeout={() => handleAttackerChoice(activeMoment.fallbackAttacker)}
          />
        )}
        {activeMoment && Defender && attackerPick && !outcome && (
          <Defender
            onChoose={handleDefenderChoice}
            onTimeout={() => handleDefenderChoice(activeMoment.fallbackDefender)}
          />
        )}
        {activeMoment && outcome && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-[300]"
            style={{ top: '6%', width: 'min(92%, 480px)' }}
          >
            <div
              className="text-center font-display uppercase"
              style={{
                background: outcome === 'intercept' ? '#EF4444' : '#FDE100',
                color: '#000',
                padding: '14px 12px',
                fontWeight: 900,
                letterSpacing: '0.32em',
                fontSize: 16,
                border: '2px solid #000',
                borderRadius: 6,
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              }}
            >
              {outcome === 'intercept' ? 'Interceptado!' : 'Saiu jogando ✓'}
            </div>
          </div>
        )}

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
