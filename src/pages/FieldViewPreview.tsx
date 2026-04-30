/**
 * Legacy Mode — /dev/field-view.
 * Campo ao vivo com TacticalSimLoop + decision moments no painel inferior.
 */
import { useState, useCallback, useRef, type ComponentType } from 'react';
import {
  Goal, Crosshair, ArrowUpRight, RotateCw, LogIn, CornerDownLeft,
  Zap, Shield, Minus, HandMetal, Users, ArrowUp, Timer, ArrowDownToLine,
  Swords, MoveLeft, ChevronsUp, MoveRight,
} from 'lucide-react';
import { FieldView, type FieldCameraMode } from '@/components/match/FieldView';
import type { PitchPlayerState } from '@/engine/types';
import { useLegacyMatchEngine, type LegacyEventKind } from './useLegacyMatchEngine';
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
  icon: React.ReactNode;
  category: 'bola-parada' | 'ataque' | 'defesa' | 'transicao';
  Attacker: Comp; Defender: Comp;
  resolve: (a: string, d: string) => 'intercept' | 'progress';
  highlight?: string; defensiveAction?: boolean;
  fa: string; fd: string;
}

const MOMENTS: MomentDef[] = [
  // Bola parada
  { id: 'gk', label: 'Saída', icon: <MoveLeft size={18} />, category: 'bola-parada', Attacker: GoalkeeperDistribution as Comp, Defender: GoalkeeperPressure as Comp, resolve: resolveGoalkeeperDistribution as MomentDef['resolve'], highlight: 'gk1', fa: 'long', fd: 'deep' },
  { id: 'corner', label: 'Escanteio', icon: <Goal size={18} />, category: 'bola-parada', Attacker: CornerAttacker as Comp, Defender: CornerDefender as Comp, resolve: resolveCorner as MomentDef['resolve'], fa: 'near', fd: 'near' },
  { id: 'freekick', label: 'Falta', icon: <Crosshair size={18} />, category: 'bola-parada', Attacker: FreeKickAttacker as Comp, Defender: FreeKickDefender as Comp, resolve: resolveFreeKick as MomentDef['resolve'], fa: 'cross', fd: 'cross' },
  // Ataque
  { id: 'recv', label: 'Recepção', icon: <RotateCw size={18} />, category: 'ataque', Attacker: AttackerReceivesAttacker as Comp, Defender: AttackerReceivesDefender as Comp, resolve: resolveAttackerReceives as MomentDef['resolve'], highlight: 'ata1', fa: 'hold', fd: 'hold' },
  { id: 'wing', label: 'Fundo', icon: <LogIn size={18} />, category: 'ataque', Attacker: WingCrossAttacker as Comp, Defender: WingCrossDefender as Comp, resolve: resolveWingCross as MomentDef['resolve'], highlight: 'pd1', fa: 'cross', fd: 'cross' },
  { id: '1v1', label: '1×1', icon: <CornerDownLeft size={18} />, category: 'ataque', Attacker: WingerOneOnOneAttacker as Comp, Defender: WingerOneOnOneDefender as Comp, resolve: resolveWingerOneOnOne as MomentDef['resolve'], highlight: 'pd1', fa: 'inside', fd: 'inside' },
  { id: 'header', label: 'Cabeça', icon: <ArrowUpRight size={18} />, category: 'ataque', Attacker: HeaderAttacker as Comp, Defender: HeaderDefender as Comp, resolve: resolveHeader as MomentDef['resolve'], fa: 'power', fd: 'jump' },
  { id: '1v1gk', label: 'Cara a cara', icon: <ChevronsUp size={18} />, category: 'ataque', Attacker: OneOnOneAttacker as Comp, Defender: OneOnOneKeeper as Comp, resolve: resolveOneOnOne as MomentDef['resolve'], defensiveAction: true, highlight: 'gk1', fa: 'placed', fd: 'angle' },
  // Defesa
  { id: 'tackle', label: 'Carrinho', icon: <Zap size={18} />, category: 'defesa', Attacker: TackleAttacker as Comp, Defender: TackleDefender as Comp, resolve: resolveTackle as MomentDef['resolve'], fa: 'shield', fd: 'cover' },
  { id: 'lastline', label: 'Última linha', icon: <Minus size={18} />, category: 'defesa', Attacker: LastLineAttacker as Comp, Defender: LastLineDefender as Comp, resolve: resolveLastLine as MomentDef['resolve'], fa: 'feet', fd: 'hold' },
  { id: 'rebound', label: 'Rebote', icon: <HandMetal size={18} />, category: 'defesa', Attacker: ReboundAttacker as Comp, Defender: ReboundDefender as Comp, resolve: resolveRebound as MomentDef['resolve'], defensiveAction: true, highlight: 'gk1', fa: 'first', fd: 'block' },
  // Transição
  { id: 'gegen', label: 'Gegenpress', icon: <Users size={18} />, category: 'transicao', Attacker: GegenpressAttacker as Comp, Defender: GegenpressDefender as Comp, resolve: resolveGegenpress as MomentDef['resolve'], fa: 'short', fd: 'swarm' },
  { id: 'counter', label: 'Contra-ataque', icon: <ArrowUp size={18} />, category: 'transicao', Attacker: CounterAttacker as Comp, Defender: CounterDefender as Comp, resolve: resolveCounter as MomentDef['resolve'], fa: 'wing', fd: 'delay' },
];

const CATEGORIES: { id: MomentDef['category']; label: string }[] = [
  { id: 'bola-parada', label: 'Bola parada' },
  { id: 'ataque', label: 'Ataque' },
  { id: 'defesa', label: 'Defesa' },
  { id: 'transicao', label: 'Transição' },
];

const ENGINE_EVENT_MAP: Record<LegacyEventKind, string> = {
  corner: 'corner', freekick: 'freekick', shot: '1v1gk',
  rebound: 'rebound', possession_change: 'gegen', goal: 'gegen',
};

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

      {/* Campo — empurrado para baixo (gap no topo, campo junto aos botões) */}
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

          {/* Decision overlays */}
          {activeMoment && Attacker && !attackerPick && (
            <Attacker onChoose={handleAttackerChoice} onTimeout={() => handleAttackerChoice(activeMoment.fa)} />
          )}
          {activeMoment && Defender && attackerPick && !outcome && (
            <Defender onChoose={handleDefenderChoice} onTimeout={() => handleDefenderChoice(activeMoment.fd)} />
          )}
          {activeMoment && outcome && (
            <div className="absolute left-1/2 -translate-x-1/2 z-[300]" style={{ top: '6%', width: 'min(92%, 480px)' }}>
              <div className="text-center font-display uppercase"
                style={{ background: outcome === 'intercept' ? '#EF4444' : '#FDE100', color: '#000', padding: '14px 12px', fontWeight: 900, letterSpacing: '0.32em', fontSize: 16, border: '2px solid #000', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}
              >
                {outcome === 'intercept' ? 'Interceptado!' : 'Saiu jogando ✓'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Painel de escolhas — abaixo do campo */}
      <div
        style={{
          background: '#0a0a0a',
          borderTop: '1px solid rgba(253,225,0,0.18)',
          padding: '10px 12px 14px',
          flexShrink: 0,
        }}
      >
        {CATEGORIES.map((cat) => {
          const catMoments = MOMENTS.filter((m) => m.category === cat.id);
          return (
            <div key={cat.id} className="mb-2 last:mb-0">
              <div
                className="font-display uppercase mb-1.5"
                style={{ fontSize: 8, letterSpacing: '0.35em', color: 'rgba(253,225,0,0.45)' }}
              >
                {cat.label}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {catMoments.map((m) => {
                  const isActive = activeMoment?.id === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => startMoment(m)}
                      disabled={!!activeMoment && !isActive}
                      className="flex items-center gap-1.5 font-display uppercase transition-all active:scale-95"
                      style={{
                        background: isActive ? '#FDE100' : 'rgba(255,255,255,0.05)',
                        color: isActive ? '#000' : 'rgba(253,225,0,0.9)',
                        border: `1px solid ${isActive ? '#FDE100' : 'rgba(253,225,0,0.25)'}`,
                        fontSize: 10,
                        letterSpacing: '0.14em',
                        fontWeight: 700,
                        padding: '6px 10px',
                        borderRadius: 4,
                        opacity: activeMoment && !isActive ? 0.35 : 1,
                      }}
                    >
                      <span style={{ opacity: isActive ? 1 : 0.7, display: 'flex' }}>{m.icon}</span>
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
