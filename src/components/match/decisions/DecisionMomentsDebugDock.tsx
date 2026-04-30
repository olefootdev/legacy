/**
 * Dock flutuante de decision moments — uso em qualquer página de partida
 * (MatchQuick, MatchLive, FieldViewPreview) para disparar moments manualmente
 * sobrepostos ao jogo em curso. Útil enquanto a engine não dispara automaticamente.
 *
 * Ativar via prop `enabled` (use URL flag `?decisions=1` no host).
 */
import { useCallback, useState, type ComponentType } from 'react';
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

type Cb = (id: string) => void;
type Comp = ComponentType<{ onChoose: Cb; onTimeout?: () => void }>;

interface MomentDef {
  id: string;
  label: string;
  Attacker: Comp;
  Defender: Comp;
  resolve: (a: string, d: string) => 'intercept' | 'progress';
  fa: string;
  fd: string;
}

const MOMENTS: MomentDef[] = [
  { id: 'gk', label: 'saída', Attacker: GoalkeeperDistribution as Comp, Defender: GoalkeeperPressure as Comp, resolve: resolveGoalkeeperDistribution as MomentDef['resolve'], fa: 'long', fd: 'deep' },
  { id: 'corner', label: 'escanteio', Attacker: CornerAttacker as Comp, Defender: CornerDefender as Comp, resolve: resolveCorner as MomentDef['resolve'], fa: 'near', fd: 'near' },
  { id: 'freekick', label: 'falta', Attacker: FreeKickAttacker as Comp, Defender: FreeKickDefender as Comp, resolve: resolveFreeKick as MomentDef['resolve'], fa: 'cross', fd: 'cross' },
  { id: 'recv', label: 'recepção', Attacker: AttackerReceivesAttacker as Comp, Defender: AttackerReceivesDefender as Comp, resolve: resolveAttackerReceives as MomentDef['resolve'], fa: 'hold', fd: 'hold' },
  { id: 'wing', label: 'fundo', Attacker: WingCrossAttacker as Comp, Defender: WingCrossDefender as Comp, resolve: resolveWingCross as MomentDef['resolve'], fa: 'cross', fd: 'cross' },
  { id: '1v1', label: '1×1', Attacker: WingerOneOnOneAttacker as Comp, Defender: WingerOneOnOneDefender as Comp, resolve: resolveWingerOneOnOne as MomentDef['resolve'], fa: 'inside', fd: 'inside' },
  { id: 'tackle', label: 'carrinho', Attacker: TackleAttacker as Comp, Defender: TackleDefender as Comp, resolve: resolveTackle as MomentDef['resolve'], fa: 'shield', fd: 'cover' },
  { id: 'lastline', label: 'linha', Attacker: LastLineAttacker as Comp, Defender: LastLineDefender as Comp, resolve: resolveLastLine as MomentDef['resolve'], fa: 'feet', fd: 'hold' },
  { id: 'rebound', label: 'rebote', Attacker: ReboundAttacker as Comp, Defender: ReboundDefender as Comp, resolve: resolveRebound as MomentDef['resolve'], fa: 'first', fd: 'block' },
  { id: 'gegen', label: 'gegen', Attacker: GegenpressAttacker as Comp, Defender: GegenpressDefender as Comp, resolve: resolveGegenpress as MomentDef['resolve'], fa: 'short', fd: 'swarm' },
  { id: 'counter', label: 'contra', Attacker: CounterAttacker as Comp, Defender: CounterDefender as Comp, resolve: resolveCounter as MomentDef['resolve'], fa: 'wing', fd: 'delay' },
  { id: '1v1gk', label: 'cara', Attacker: OneOnOneAttacker as Comp, Defender: OneOnOneKeeper as Comp, resolve: resolveOneOnOne as MomentDef['resolve'], fa: 'placed', fd: 'angle' },
  { id: 'header', label: 'cabeça', Attacker: HeaderAttacker as Comp, Defender: HeaderDefender as Comp, resolve: resolveHeader as MomentDef['resolve'], fa: 'power', fd: 'jump' },
];

export function DecisionMomentsDebugDock({ enabled = true }: { enabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<MomentDef | null>(null);
  const [attPick, setAttPick] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'intercept' | 'progress' | null>(null);

  const start = useCallback((m: MomentDef) => {
    setActive(m);
    setAttPick(null);
    setOutcome(null);
  }, []);

  const onAttacker = useCallback((c: string) => setAttPick(c), []);

  const onDefender = useCallback(
    (c: string) => {
      if (!active || !attPick) return;
      const r = active.resolve(attPick, c);
      setOutcome(r);
      window.setTimeout(() => {
        setActive(null);
        setAttPick(null);
        setOutcome(null);
      }, 2200);
    },
    [active, attPick],
  );

  if (!enabled) return null;

  const Att = active?.Attacker;
  const Def = active?.Defender;

  return (
    <>
      {/* Floating toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed z-[400] font-display uppercase"
        style={{
          right: 12,
          bottom: 12,
          background: open ? '#FDE100' : 'rgba(0,0,0,0.85)',
          color: open ? '#000' : '#FDE100',
          border: '2px solid #FDE100',
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: 11,
          letterSpacing: '0.22em',
          fontWeight: 800,
          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        }}
      >
        ▶ Decisions
      </button>

      {/* Dock */}
      {open && (
        <div
          className="fixed z-[400] flex flex-wrap gap-1.5 px-3 py-2 border-2 bg-black/90"
          style={{
            right: 12,
            bottom: 56,
            borderColor: 'rgba(253,225,0,0.5)',
            borderRadius: 6,
            maxWidth: 'calc(100vw - 24px)',
          }}
        >
          {MOMENTS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => start(m)}
              className="font-display uppercase tracking-wider px-2 py-1"
              style={{
                background: active?.id === m.id ? '#FDE100' : 'rgba(255,255,255,0.06)',
                color: active?.id === m.id ? '#000' : 'rgba(253,225,0,0.85)',
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
      )}

      {/* Overlays */}
      {active && Att && !attPick && (
        <Att onChoose={onAttacker} onTimeout={() => onAttacker(active.fa)} />
      )}
      {active && Def && attPick && !outcome && (
        <Def onChoose={onDefender} onTimeout={() => onDefender(active.fd)} />
      )}
      {active && outcome && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[500]"
          style={{ top: '8%', width: 'min(92%, 480px)' }}
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
    </>
  );
}
