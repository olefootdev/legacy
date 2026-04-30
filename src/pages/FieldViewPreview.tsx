/**
 * Legacy Mode — /dev/field-view.
 * Campo ao vivo limpo + cards de decisão no painel inferior + voz.
 */
import { useState, useCallback, useRef, type ComponentType } from 'react';
import { Mic } from 'lucide-react';
import { FieldView, type FieldCameraMode } from '@/components/match/FieldView';
import type { PitchPlayerState } from '@/engine/types';
import { useLegacyMatchEngine, type LegacyEventKind } from './useLegacyMatchEngine';
import { InlineDecisionCtx } from '@/components/match/decisions';
import {
  GoalkeeperDistribution, GoalkeeperPressure, resolveGoalkeeperDistribution,
  CornerAttacker, CornerDefender, resolveCorner,
  FreeKickAttacker, FreeKickDefender, resolveFreeKick,
  AttackerReceivesAttacker, AttackerReceivesDefender, resolveAttackerReceives,
  WingCrossAttacker, WingCrossDefender, resolveWingCross,
  WingerOneOnOneAttacker, WingerOneOnOneDefender, resolveWingerOneOnOne,
  TackleAttacker, TackleDefender, resolveTackle,
  LastLineAttacker, LastLineDefender, resolveLastLine,
  ReboundAttacker, ReboundDefender, resolveRebound,
  GegenpressAttacker, GegenpressDefender, resolveGegenpress,
  CounterAttacker, CounterDefender, resolveCounter,
  OneOnOneAttacker, OneOnOneKeeper, resolveOneOnOne,
  HeaderAttacker, HeaderDefender, resolveHeader,
} from '@/components/match/decisions';

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

// ── Decision moments ──────────────────────────────────────────────────────────
type Cb = (c: string) => void;
type Comp = ComponentType<{ onChoose: Cb; onTimeout?: () => void }>;

interface MomentDef {
  id: string;
  label: string;
  category: 'bola-parada' | 'ataque' | 'defesa' | 'transicao';
  Attacker: Comp; Defender: Comp;
  resolve: (a: string, d: string) => 'intercept' | 'progress';
  highlight?: string; defensiveAction?: boolean;
  fa: string; fd: string;
}

const MOMENTS: MomentDef[] = [
  { id: 'gk',       label: 'Saída do goleiro', category: 'bola-parada', Attacker: GoalkeeperDistribution as Comp, Defender: GoalkeeperPressure as Comp,    resolve: resolveGoalkeeperDistribution as MomentDef['resolve'], highlight: 'gk1', fa: 'long',   fd: 'deep'  },
  { id: 'corner',   label: 'Escanteio',         category: 'bola-parada', Attacker: CornerAttacker as Comp,         Defender: CornerDefender as Comp,          resolve: resolveCorner as MomentDef['resolve'],                                    fa: 'near',   fd: 'near'  },
  { id: 'freekick', label: 'Falta',             category: 'bola-parada', Attacker: FreeKickAttacker as Comp,       Defender: FreeKickDefender as Comp,        resolve: resolveFreeKick as MomentDef['resolve'],                                  fa: 'cross',  fd: 'cross' },
  { id: 'recv',     label: 'Recepção',          category: 'ataque',      Attacker: AttackerReceivesAttacker as Comp, Defender: AttackerReceivesDefender as Comp, resolve: resolveAttackerReceives as MomentDef['resolve'], highlight: 'ata1',    fa: 'hold',   fd: 'hold'  },
  { id: 'wing',     label: 'Fundo',             category: 'ataque',      Attacker: WingCrossAttacker as Comp,      Defender: WingCrossDefender as Comp,       resolve: resolveWingCross as MomentDef['resolve'],        highlight: 'pd1',     fa: 'cross',  fd: 'cross' },
  { id: '1v1',      label: '1×1 ponta',         category: 'ataque',      Attacker: WingerOneOnOneAttacker as Comp, Defender: WingerOneOnOneDefender as Comp,  resolve: resolveWingerOneOnOne as MomentDef['resolve'],   highlight: 'pd1',     fa: 'inside', fd: 'inside'},
  { id: 'header',   label: 'Cabeçada',          category: 'ataque',      Attacker: HeaderAttacker as Comp,         Defender: HeaderDefender as Comp,          resolve: resolveHeader as MomentDef['resolve'],                                    fa: 'power',  fd: 'jump'  },
  { id: '1v1gk',    label: 'Cara a cara',       category: 'ataque',      Attacker: OneOnOneAttacker as Comp,       Defender: OneOnOneKeeper as Comp,          resolve: resolveOneOnOne as MomentDef['resolve'],         defensiveAction: true, highlight: 'gk1', fa: 'placed', fd: 'angle' },
  { id: 'tackle',   label: 'Carrinho',          category: 'defesa',      Attacker: TackleAttacker as Comp,         Defender: TackleDefender as Comp,          resolve: resolveTackle as MomentDef['resolve'],                                    fa: 'shield', fd: 'cover' },
  { id: 'lastline', label: 'Última linha',      category: 'defesa',      Attacker: LastLineAttacker as Comp,       Defender: LastLineDefender as Comp,        resolve: resolveLastLine as MomentDef['resolve'],                                  fa: 'feet',   fd: 'hold'  },
  { id: 'rebound',  label: 'Rebote',            category: 'defesa',      Attacker: ReboundAttacker as Comp,        Defender: ReboundDefender as Comp,         resolve: resolveRebound as MomentDef['resolve'],          defensiveAction: true, highlight: 'gk1', fa: 'first', fd: 'block' },
  { id: 'gegen',    label: 'Gegenpress',        category: 'transicao',   Attacker: GegenpressAttacker as Comp,     Defender: GegenpressDefender as Comp,      resolve: resolveGegenpress as MomentDef['resolve'],                                fa: 'short',  fd: 'swarm' },
  { id: 'counter',  label: 'Contra-ataque',     category: 'transicao',   Attacker: CounterAttacker as Comp,        Defender: CounterDefender as Comp,         resolve: resolveCounter as MomentDef['resolve'],                                   fa: 'wing',   fd: 'delay' },
];

const ENGINE_EVENT_MAP: Record<LegacyEventKind, string> = {
  corner: 'corner', freekick: 'freekick', shot: '1v1gk',
  rebound: 'rebound', possession_change: 'gegen', goal: 'gegen',
};

// ── Painel de voz — estado idle ───────────────────────────────────────────────
// Labels curtos para o grid de comandos de voz
const VOICE_LABEL: Record<string, string> = {
  gk: 'Saída', corner: 'Escanteio', freekick: 'Falta',
  recv: 'Recepção', wing: 'Fundo', '1v1': '1×1',
  header: 'Cabeça', '1v1gk': 'Cara a cara',
  tackle: 'Carrinho', lastline: 'Última linha', rebound: 'Rebote',
  gegen: 'Gegenpress', counter: 'Contra-ataque',
};

const CATEGORY_LABEL: Record<MomentDef['category'], string> = {
  'bola-parada': 'Parada',
  'ataque': 'Ataque',
  'defesa': 'Defesa',
  'transicao': 'Transição',
};

const CATEGORIES_ORDER: MomentDef['category'][] = [
  'bola-parada', 'ataque', 'defesa', 'transicao',
];

function VoiceIdlePanel({ onTrigger }: { onTrigger: (id: string) => void }) {
  return (
    <div
      className="flex items-center gap-2"
      style={{ height: 44, padding: '0 12px', overflow: 'hidden' }}
    >
      <style>{`
        @keyframes vbar {
          0%, 100% { transform: scaleY(0.3); opacity: 0.2; }
          50%       { transform: scaleY(1);   opacity: 0.6; }
        }
      `}</style>

      {/* Mic — quadrado editorial */}
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 24, height: 24, border: '1px solid rgba(253,225,0,0.5)', color: '#FDE100' }}
      >
        <Mic size={11} />
      </div>

      {/* Waveform */}
      <div className="flex items-end gap-px flex-shrink-0" style={{ height: 14 }}>
        {[0.5, 0.85, 1, 0.7, 0.4].map((base, i) => (
          <span key={i} style={{
            display: 'block', width: 2, height: `${base * 100}%`,
            background: '#FDE100', borderRadius: 1, transformOrigin: 'bottom',
            animation: `vbar ${0.65 + i * 0.14}s ease-in-out ${i * 0.07}s infinite`,
          }} />
        ))}
      </div>

      {/* Divisor vertical */}
      <div style={{ width: 1, height: 20, background: 'rgba(253,225,0,0.15)', flexShrink: 0 }} />

      {/* Pills — scroll horizontal, sem quebra de linha */}
      <div
        className="flex gap-1.5 items-center"
        style={{ overflowX: 'auto', scrollbarWidth: 'none', flex: 1 }}
      >
        {MOMENTS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onTrigger(m.id)}
            className="font-display uppercase flex-shrink-0 transition-all active:scale-95"
            style={{
              background: 'transparent',
              border: '1px solid rgba(253,225,0,0.2)',
              color: 'rgba(253,225,0,0.65)',
              fontSize: 8,
              letterSpacing: '0.15em',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 2,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {VOICE_LABEL[m.id] ?? m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function FieldViewPreview() {
  const [camera, setCamera] = useState<FieldCameraMode>('aerial');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [defensiveAction, setDefensiveAction] = useState(false);
  const [activeMoment, setActiveMoment] = useState<MomentDef | null>(null);
  const [attackerPick, setAttackerPick] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'intercept' | 'progress' | null>(null);
  const momentBusyRef = useRef(false);

  const startMoment = useCallback((m: MomentDef) => {
    if (momentBusyRef.current) return;
    momentBusyRef.current = true;
    setAttackerPick(null); setOutcome(null); setActiveMoment(m);
    setCamera('aerial');
    if (m.highlight) setHighlightId(m.highlight);
    if (m.defensiveAction) setDefensiveAction(true);
  }, []);

  const handleEngineEvent = useCallback((kind: LegacyEventKind) => {
    if (momentBusyRef.current) return;
    const m = MOMENTS.find((x) => x.id === ENGINE_EVENT_MAP[kind]);
    if (m) startMoment(m);
  }, [startMoment]);

  const engine = useLegacyMatchEngine(HOME_PLAYERS_INITIAL, handleEngineEvent);

  const handleAttackerChoice = useCallback((c: string) => setAttackerPick(c), []);

  const handleDefenderChoice = useCallback((c: string) => {
    if (!activeMoment || !attackerPick) return;
    const r = activeMoment.resolve(attackerPick, c);
    setOutcome(r);
    window.setTimeout(() => {
      setActiveMoment(null); setAttackerPick(null); setOutcome(null);
      setHighlightId(null); setDefensiveAction(false);
      momentBusyRef.current = false;
    }, 2200);
  }, [activeMoment, attackerPick]);

  const Attacker = activeMoment?.Attacker;
  const Defender = activeMoment?.Defender;

  return (
    <div className="fixed inset-0 z-[200] bg-[#050505] flex flex-col" style={{ touchAction: 'none' }}>

      {/* ── Campo — limpo, sem overlays de decisão ── */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-end">
        <div className="relative w-full">
          <FieldView
            homePlayers={engine.homePlayers}
            awayPlayers={engine.awayPlayers}
            ballX={engine.ballX}
            ballY={engine.ballY}
            onBallPlayerId={engine.onBallPlayerId}
            cameraMode={camera}
            homeShort="OLE"
            awayShort="ADV"
            homeScore={engine.homeScore}
            awayScore={engine.awayScore}
            matchMinute={engine.minute}
            showCameraSwitch={false}
            highlightPlayerId={highlightId}
            defensiveAction={defensiveAction}
            onPlayerClick={(p) => { setHighlightId(p.playerId); window.setTimeout(() => setHighlightId(null), 2500); }}
            className="w-full"
          />

          {/* Camera toggle — canto superior direito, discreto */}
          <div className="absolute top-2 right-2 flex gap-1 z-20">
            {(['aerial', 'broadcast'] as FieldCameraMode[]).map((m) => (
              <button key={m} type="button" onClick={() => setCamera(m)}
                className="font-display uppercase"
                style={{ background: camera === m ? '#FDE100' : 'rgba(0,0,0,0.7)', color: camera === m ? '#000' : 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)', fontSize: 9, letterSpacing: '0.16em', padding: '4px 8px', borderRadius: 3 }}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Flash de resultado — breve, sobre o campo, some em 2.2s */}
          {activeMoment && outcome && (
            <div className="absolute inset-x-0 z-[300]" style={{ bottom: 12 }}>
              <div
                className="mx-auto text-center font-display uppercase"
                style={{
                  width: 'fit-content',
                  background: outcome === 'intercept' ? '#EF4444' : '#FDE100',
                  color: '#000', padding: '10px 24px', fontWeight: 900,
                  letterSpacing: '0.32em', fontSize: 14,
                  border: '2px solid #000', borderRadius: 4,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
                }}
              >
                {outcome === 'intercept' ? 'Interceptado!' : 'Saiu jogando ✓'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Painel inferior — decisões ou voz ── */}
      <div
        style={{
          background: '#0a0a0a',
          borderTop: '1px solid rgba(253,225,0,0.18)',
          flexShrink: 0,
        }}
      >
        <InlineDecisionCtx.Provider value={true}>
          {activeMoment && Attacker && !attackerPick && !outcome && (
            <Attacker
              onChoose={handleAttackerChoice}
              onTimeout={() => handleAttackerChoice(activeMoment.fa)}
            />
          )}
          {activeMoment && Defender && attackerPick && !outcome && (
            <Defender
              onChoose={handleDefenderChoice}
              onTimeout={() => handleDefenderChoice(activeMoment.fd)}
            />
          )}
        </InlineDecisionCtx.Provider>

        {/* Idle: UI de voz */}
        {!activeMoment && (
          <VoiceIdlePanel
            onTrigger={(id) => {
              const m = MOMENTS.find((x) => x.id === id);
              if (m) startMoment(m);
            }}
          />
        )}

        {/* Resultado: feedback no painel enquanto flash some */}
        {activeMoment && outcome && (
          <div className="flex items-center justify-center py-4">
            <span
              className="font-display uppercase"
              style={{ fontSize: 11, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.35)' }}
            >
              {activeMoment.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
