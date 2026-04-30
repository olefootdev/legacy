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

// Apenas situações decisivas disparam um decision moment.
// possession_change e goal são eventos normais — não devem interromper.
const ENGINE_EVENT_MAP: Partial<Record<LegacyEventKind, string>> = {
  corner:   'corner',
  freekick: 'freekick',
  shot:     '1v1gk',   // cara a cara com o goleiro
  rebound:  'rebound', // rebote após defesa
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
      style={{ height: 48, padding: '0 12px', overflow: 'hidden' }}
    >
      {/* Mic — quadrado editorial */}
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 26, height: 26, border: '1px solid rgba(253,225,0,0.45)', color: '#FDE100' }}
      >
        <Mic size={12} />
      </div>

      {/* Waveform */}
      <div className="flex items-end gap-px flex-shrink-0" style={{ height: 16 }}>
        {[0.5, 0.85, 1, 0.7, 0.4].map((base, i) => (
          <span key={i} style={{
            display: 'block', width: 2, height: `${base * 100}%`,
            background: '#FDE100', borderRadius: 1, transformOrigin: 'bottom',
            animation: `vbar ${0.65 + i * 0.14}s ease-in-out ${i * 0.07}s infinite`,
          }} />
        ))}
      </div>

      {/* Divisor vertical */}
      <div style={{ width: 1, height: 22, background: 'rgba(253,225,0,0.15)', flexShrink: 0 }} />

      {/* Pills — Agency FB uppercase, scroll horizontal */}
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
              fontSize: 10,
              letterSpacing: '0.22em',
              fontWeight: 800,
              padding: '3px 10px',
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
    const momentId = ENGINE_EVENT_MAP[kind];
    if (!momentId) return;
    const m = MOMENTS.find((x) => x.id === momentId);
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

  const showDecision = !!activeMoment && !outcome;
  const showAttacker = showDecision && !!Attacker && !attackerPick;
  const showDefender = showDecision && !!Defender && !!attackerPick;

  const voiceTrigger = useCallback((id: string) => {
    const m = MOMENTS.find((x) => x.id === id);
    if (m) startMoment(m);
  }, [startMoment]);

  return (
    <div className="fixed inset-0 z-[200] bg-[#050505] flex flex-col" style={{ touchAction: 'none' }}>
      <style>{`
        @keyframes slideFromField {
          from { opacity: 0; transform: translateY(-100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vbar {
          0%, 100% { transform: scaleY(0.3); opacity: 0.2; }
          50%       { transform: scaleY(1);   opacity: 0.6; }
        }
        @keyframes outcomeIn {
          from { opacity: 0; transform: translateY(6px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>

      {/* ── Campo — flex-1, push para baixo ── */}
      <div className="flex-1 min-h-0 flex flex-col justify-end overflow-hidden">
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
      </div>

      {/* Camera toggle — canto superior direito, sobre o campo */}
      <div className="absolute flex gap-1 z-20" style={{ top: 56, right: 8 }}>
        {(['aerial', 'broadcast'] as FieldCameraMode[]).map((m) => (
          <button key={m} type="button" onClick={() => setCamera(m)}
            className="font-display uppercase"
            style={{ background: camera === m ? '#FDE100' : 'rgba(13,13,13,0.8)', color: camera === m ? '#000' : 'rgba(255,255,255,0.45)', border: `1px solid ${camera === m ? 'transparent' : 'rgba(253,225,0,0.15)'}`, fontSize: 10, letterSpacing: '0.22em', fontWeight: 800, padding: '4px 10px', borderRadius: 2 }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* ── Resultado — flash centralizado sobre o painel ── */}
      {outcome && (
        <div
          className="absolute left-0 right-0 flex justify-center z-[500]"
          style={{ bottom: showDecision ? 116 : 64, animation: 'outcomeIn 200ms ease both' }}
        >
          <div
            className="font-display uppercase"
            style={{
              background: outcome === 'intercept' ? '#EF4444' : '#FDE100',
              color: '#000', padding: '8px 28px', fontWeight: 900,
              letterSpacing: '0.32em', fontSize: 12,
              boxShadow: outcome === 'intercept'
                ? '0 4px 32px rgba(239,68,68,0.45)'
                : '0 4px 32px rgba(253,225,0,0.45)',
            }}
          >
            {outcome === 'intercept' ? 'Interceptado' : 'Saiu jogando'}
          </div>
        </div>
      )}

      {/* ── Card de decisão — desliza de baixo do campo, acima do voice bar ── */}
      {showDecision && (
        <div
          key={activeMoment.id + (attackerPick ?? '')}
          style={{ flexShrink: 0, animation: 'slideFromField 280ms cubic-bezier(0.34,1.56,0.64,1) both' }}
        >
          <InlineDecisionCtx.Provider value={true}>
            {showAttacker && (
              <Attacker
                onChoose={handleAttackerChoice}
                onTimeout={() => handleAttackerChoice(activeMoment.fa)}
              />
            )}
            {showDefender && (
              <Defender
                onChoose={handleDefenderChoice}
                onTimeout={() => handleDefenderChoice(activeMoment.fd)}
              />
            )}
          </InlineDecisionCtx.Provider>
        </div>
      )}

      {/* ── Voice bar — sempre visível, no fundo ── */}
      <div
        style={{ flexShrink: 0, background: 'rgba(8,8,8,0.97)', borderTop: '1px solid rgba(253,225,0,0.1)' }}
      >
        <VoiceIdlePanel onTrigger={voiceTrigger} />
      </div>
    </div>
  );
}
