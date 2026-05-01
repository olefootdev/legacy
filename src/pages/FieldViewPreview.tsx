/**
 * Legacy Mode — /dev/field-view.
 * Campo ao vivo limpo + SmartPanel + CommandCenter + decision moments cinematográficos.
 */
import { useState, useCallback, useEffect, useRef, type ComponentType } from 'react';
import { Mic } from 'lucide-react';
import { FieldView } from '@/components/match/FieldView';
import { AgentFeedbackStream, useAgentFeedbackStream } from '@/components/match/AgentFeedbackStream';
import { SectorFocus, type SectorZone } from '@/components/match/SectorFocus';
import { CommandCenter } from '@/components/match/CommandCenter';
import { SmartPanel, type PlayStyle } from '@/components/match/SmartPanel';
import { FieldDecisionOverlay, type FieldDecisionChoice } from '@/components/match/FieldDecisionOverlay';
import { NarrativeBar } from '@/components/match/NarrativeBar';
import { LiveEventTimeline } from '@/components/match/LiveEventTimeline';
import { PlayerBrainCard } from '@/components/match/PlayerBrainCard';
import { PressureZoneOverlay } from '@/components/match/PressureZoneOverlay';
import { ReadGamePanel } from '@/components/match/ReadGamePanel';
import type { VoiceIntent } from '@/voiceCommand/types';
import type { PitchPlayerState } from '@/engine/types';
import { useLegacyMatchEngine, type LegacyEventKind } from './useLegacyMatchEngine';
import type { FormationSchemeId } from '@/match-engine/types';
import { useGameStore } from '@/game/store';
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

// ── Camera targets ────────────────────────────────────────────────────────────
// Tier 1: zoom sutil 1.2× sobre a zona da ação. Voice bar permanece.
// Tier 2: zoom 1.6× + freeze frame + vignette editorial.
type CameraTarget = { x: number; y: number; zoom: number };
const T1_CAMERA_TARGETS: Record<string, CameraTarget> = {
  gk:    { x: 50, y: 86, zoom: 1.2 },
  gegen: { x: 50, y: 48, zoom: 1.2 },
};
const T2_CAMERA_TARGETS: Record<string, CameraTarget> = {
  corner:   { x: 50, y: 18, zoom: 1.6 }, // canto adversário (área superior)
  freekick: { x: 50, y: 30, zoom: 1.6 }, // zona de meia-lua adversária
  '1v1':    { x: 78, y: 32, zoom: 1.6 }, // ponta direita ataque
  '1v1gk':  { x: 50, y: 14, zoom: 1.7 }, // cara a cara — baliza adversária
  header:   { x: 50, y: 18, zoom: 1.6 }, // cabeçada na pequena área
  rebound:  { x: 50, y: 80, zoom: 1.5 }, // rebote na nossa área
};
const MOMENT_CAMERA_TARGETS: Record<string, CameraTarget> = {
  ...T1_CAMERA_TARGETS,
  ...T2_CAMERA_TARGETS,
};
const T2_MOMENT_IDS = new Set(Object.keys(T2_CAMERA_TARGETS));

// ── Color grade por momento ───────────────────────────────────────────────────
// Cada T2 ganha um filtro CSS distinto, vendendo emoção pelo grade da cena.
const MOMENT_GRADE: Record<string, string> = {
  corner:   'saturate(1.35) contrast(1.12) hue-rotate(-8deg) brightness(1.05)', // dourado quente
  freekick: 'saturate(1.6)  contrast(1.25) hue-rotate(-20deg) brightness(0.95)', // vermelho tenso
  '1v1':    'saturate(0.85) contrast(1.18) hue-rotate(15deg)  brightness(0.92)', // azul-frio cinematográfico
  '1v1gk':  'saturate(0.7)  contrast(1.3)  hue-rotate(20deg)  brightness(0.88)', // azul-frio máximo (decisivo)
  header:   'saturate(1.25) contrast(1.18) hue-rotate(-5deg)  brightness(1.02)', // dourado quente
  rebound:  'saturate(1.45) contrast(1.22) hue-rotate(-15deg) brightness(0.98)', // âmbar de tensão
};

// ── Trajetórias fantasmas ─────────────────────────────────────────────────────
// Setas curvadas (SVG path) previsualizando cada escolha do atacante.
// Coordenadas em % do viewport — baseadas no MOMENT_CAMERA_TARGETS.
type Ghost = { id: string; label: string; from: { x: number; y: number }; to: { x: number; y: number }; color: string };
const MOMENT_GHOSTS: Record<string, Ghost[]> = {
  corner: [
    { id: 'short', label: 'CURTO', from: { x: 14, y: 14 }, to: { x: 26, y: 22 }, color: '#FDE100' },
    { id: 'near',  label: '1° PAU', from: { x: 14, y: 14 }, to: { x: 42, y: 20 }, color: '#FDE100' },
    { id: 'far',   label: '2° PAU', from: { x: 14, y: 14 }, to: { x: 60, y: 24 }, color: '#FDE100' },
  ],
  freekick: [
    { id: 'cross',  label: 'CRUZAMENTO', from: { x: 50, y: 36 }, to: { x: 50, y: 22 }, color: '#FDE100' },
    { id: 'shoot',  label: 'CHUTE',       from: { x: 50, y: 36 }, to: { x: 50, y: 12 }, color: '#FDE100' },
    { id: 'short',  label: 'CURTA',       from: { x: 50, y: 36 }, to: { x: 36, y: 38 }, color: '#FDE100' },
  ],
};

// ── Stat-chave do closeup ─────────────────────────────────────────────────────
const MOMENT_KEY_STAT: Record<string, { label: string; value: number }> = {
  '1v1gk':  { label: 'Finalização', value: 88 },
  header:   { label: 'Cabeceio',    value: 84 },
  rebound:  { label: 'Reflexo',     value: 82 },
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
  const [camera, setCamera] = useState<'aerial' | 'broadcast'>('aerial');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [defensiveAction, setDefensiveAction] = useState(false);
  const [activeMoment, setActiveMoment] = useState<MomentDef | null>(null);
  const [attackerPick, setAttackerPick] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'intercept' | 'progress' | 'goal' | null>(null);
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [timeScale, setTimeScale] = useState(1);
  const momentBusyRef = useRef(false);

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

  // ── Editorial overlays ────────────────────────────────────────────────────
  const [sectorZone, setSectorZone] = useState<SectorZone>(null);
  const [kineticWord, setKineticWord] = useState<string | null>(null);
  const kineticTimerRef = useRef<number | null>(null);

  const startMoment = useCallback((m: MomentDef) => {
    if (momentBusyRef.current) return;
    momentBusyRef.current = true;
    setAttackerPick(null); setOutcome(null); setActiveMoment(m);
    setCamera('aerial');
    setCameraTarget(MOMENT_CAMERA_TARGETS[m.id] ?? null);

    if (T2_MOMENT_IDS.has(m.id)) {
      // Bullet-time entry: 280ms a 0.3× → freeze. Vende a câmera "entrando" na cena.
      setTimeScale(0.3);
      window.setTimeout(() => {
        setFrozen(true);
        setTimeScale(1);
      }, 280);
    }

    if (m.highlight) setHighlightId(m.highlight);
    if (m.defensiveAction) setDefensiveAction(true);
  }, []);

  // Ref para detectar gol recente — bloqueia shot decision após gol
  const lastGoalMsRef = useRef(0);
  // Ref para cooldown pós-momento — evita double-trigger imediato
  const lastMomentEndMsRef = useRef(0);

  const handleEngineEvent = useCallback((kind: LegacyEventKind) => {
    if (kind === 'goal') {
      lastGoalMsRef.current = performance.now();
      return; // gol não abre decision moment
    }
    // Ignora shot/rebound se gol aconteceu nos últimos 3s
    if ((kind === 'shot' || kind === 'rebound') && performance.now() - lastGoalMsRef.current < 3000) return;
    // Cooldown de 8s após qualquer momento fechar — evita double-trigger
    if (performance.now() - lastMomentEndMsRef.current < 8000) return;
    if (momentBusyRef.current) return;
    const momentId = ENGINE_EVENT_MAP[kind];
    if (!momentId) return;
    const m = MOMENTS.find((x) => x.id === momentId);
    if (m) startMoment(m);
  }, [startMoment]);

  const engine = useLegacyMatchEngine(HOME_PLAYERS_INITIAL, handleEngineEvent, frozen, timeScale);

  // ── AgentFeedbackStream ───────────────────────────────────────────────────
  const { entries: feedbackEntries, push: pushFeedback } = useAgentFeedbackStream(
    engine.homePlayers,
    30,
  );

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

  // ── Cancela decision moment se gol acontecer enquanto está aberto ─────────
  useEffect(() => {
    if (engine.lastEvent === 'goal' && activeMoment && momentBusyRef.current) {
      setActiveMoment(null);
      setAttackerPick(null);
      setOutcome('goal');
      setHighlightId(null);
      setDefensiveAction(false);
      setCameraTarget(null);
      setFrozen(false);
      setTimeScale(1);
      momentBusyRef.current = false;
      lastMomentEndMsRef.current = performance.now();
      window.setTimeout(() => setOutcome(null), 2800);
    }
  }, [engine.lastEvent, engine.homeScore, engine.awayScore]);

  // ── Sector + kinetic word helpers ─────────────────────────────────────────
  const INTENT_SECTOR: Partial<Record<VoiceIntent, SectorZone>> = {
    team_press_high:     'att',
    team_retreat:        'def',
    left_back_overlap:   'mid',
    stretch_team:        'mid',
    pedal_to_metal:      'att',
    team_hold_possession:'mid',
  };

  const INTENT_WORD: Partial<Record<VoiceIntent, string>> = {
    team_press_high:     'PRESSÃO',
    team_retreat:        'RECUAR',
    left_back_overlap:   'OVERLAP',
    stretch_team:        'ABRIR',
    pedal_to_metal:      'ACELERAR',
    team_hold_possession:'SEGURAR',
  };

  const triggerEditorialOverlays = useCallback((intent: VoiceIntent, targetIds?: string[]) => {
    pushFeedback(intent, targetIds);

    const zone = INTENT_SECTOR[intent];
    if (zone) setSectorZone(zone);

    const word = INTENT_WORD[intent];
    if (word) {
      setKineticWord(word);
      if (kineticTimerRef.current) window.clearTimeout(kineticTimerRef.current);
      kineticTimerRef.current = window.setTimeout(() => setKineticWord(null), 1200);
    }
  }, [pushFeedback]);

  const handleCommandSubmit = useCallback((transcript: string) => {
    // Mapeia hashtag transcripts para intents coletivos
    const TRANSCRIPT_INTENT: Record<string, VoiceIntent> = {
      'pressiona alto':     'team_press_high',
      'recua todo mundo':   'team_retreat',
      'sobe o lateral':     'left_back_overlap',
      'estica o time':      'stretch_team',
      'pisa no acelerador': 'pedal_to_metal',
      'segura a bola':      'team_hold_possession',
    };
    const intent = TRANSCRIPT_INTENT[transcript.toLowerCase().trim()];
    if (intent) {
      triggerEditorialOverlays(intent);
    } else {
      // Comando livre — feedback genérico no primeiro atacante
      pushFeedback('free_play', [engine.homePlayers.find((p) => p.role === 'attack')?.playerId ?? '']);
    }
  }, [triggerEditorialOverlays, pushFeedback, engine.homePlayers]);

  const handleTagDispatch = useCallback((transcript: string, intent: VoiceIntent) => {
    triggerEditorialOverlays(intent);
    handleCommandSubmit(transcript);
  }, [triggerEditorialOverlays, handleCommandSubmit]);

  // ── Ambient camera — narrativa emocional pela posse e profundidade ────────
  // Engine x: 0 = nosso gol, 100 = gol adversário.
  //  • OLE atacando (possession=home): aproxima de 1.0x → 1.25x conforme avança.
  //  • OLE defendendo: afasta para 0.92x dando sensação de "campo aberto, tensão".
  //  • Meio-campo neutro: volta a 1.0x (sem target).
  const engineRef = useRef(engine);
  engineRef.current = engine;

  useEffect(() => {
    if (activeMoment) return; // T1/T2 assumem o controle
    const tick = () => {
      const e = engineRef.current;

      // Defesa: bola no nosso campo + posse adversária → recua
      if (e.possession === 'away' && e.ballX < 50) {
        const danger = Math.min(1, (50 - e.ballX) / 40);
        const zoom = 1.0 - danger * 0.08; // 1.0 → 0.92
        setCameraTarget({ x: 50, y: 78, zoom });
        return;
      }

      // Ataque: posse OLE no campo adversário → aproxima
      if (e.possession === 'home' && e.ballX > 50) {
        const depth = Math.min(1, (e.ballX - 50) / 45);
        // Curva ease-in: começa lento e acelera perto do gol (mais emocionante)
        const eased = depth * depth;
        const zoom = 1.0 + eased * 0.25; // 1.0 → 1.25
        const screenY = Math.max(10, 88 - 0.82 * e.ballX);
        setCameraTarget({ x: 50, y: screenY, zoom });
        return;
      }

      // Neutro: meio-campo sem definição
      setCameraTarget(null);
    };
    tick();
    const id = window.setInterval(tick, 280);
    return () => window.clearInterval(id);
  }, [activeMoment]);

  const handleAttackerChoice = useCallback((c: string) => setAttackerPick(c), []);

  const handleDefenderChoice = useCallback((c: string) => {
    if (!activeMoment || !attackerPick) return;
    const r = activeMoment.resolve(attackerPick, c);

    // Em situações de finalização (1×1 GK, cabeçada, rebote), progress = GOL.
    const isShotMoment = activeMoment.id === '1v1gk' || activeMoment.id === 'header' || activeMoment.id === 'rebound';
    const finalOutcome: 'intercept' | 'progress' | 'goal' =
      isShotMoment && r === 'progress' ? 'goal' : r;

    const cleanup = () => {
      setActiveMoment(null); setAttackerPick(null); setOutcome(null);
      setHighlightId(null); setDefensiveAction(false);
      setCameraTarget(null); setFrozen(false); setTimeScale(1);
      momentBusyRef.current = false;
      lastMomentEndMsRef.current = performance.now();
    };

    // Córner: câmera segue a bola — bandeira → área → outcome
    if (activeMoment.id === 'corner') {
      setCameraTarget({ x: 14, y: 12, zoom: 2.0 });   // bandeira de córner
      window.setTimeout(() => {
        setCameraTarget({ x: 50, y: 22, zoom: 1.7 }); // pequena área (cabeçada)
      }, 280);
      window.setTimeout(() => setOutcome(finalOutcome), 820);
      window.setTimeout(cleanup, finalOutcome === 'goal' ? 3200 : 2700);
      return;
    }

    // 1×1 com goleiro: aproxima ainda mais para a baliza
    if (activeMoment.id === '1v1gk') {
      setCameraTarget({ x: 50, y: 8, zoom: 2.2 });
      window.setTimeout(() => setOutcome(finalOutcome), 360);
      window.setTimeout(cleanup, finalOutcome === 'goal' ? 3200 : 2200);
      return;
    }

    setOutcome(finalOutcome);
    window.setTimeout(cleanup, finalOutcome === 'goal' ? 3200 : 2200);
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
        @keyframes vignetteIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes eyebrowIn {
          from { opacity: 0; transform: translateY(-8px); letter-spacing: 0.5em; }
          to   { opacity: 1; transform: translateY(0);    letter-spacing: 0.32em; }
        }
        @keyframes ghostDraw {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes closeupIn {
          from { opacity: 0; transform: translateX(20px) scale(0.9); }
          to   { opacity: 1; transform: translateX(0)    scale(1); }
        }
        @keyframes feedbackIn {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes sectorIn {
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
        style={{
          perspective: frozen ? '900px' : 'none',
          perspectiveOrigin: '50% 100%',
          transition: 'perspective 480ms ease',
        }}
      >
      <div
        className="w-full h-full flex flex-col items-stretch justify-center min-h-0"
        style={{
          transformOrigin: cameraTarget ? `${cameraTarget.x}% ${cameraTarget.y}%` : '50% 50%',
          transform: frozen
            ? `scale(${(cameraTarget?.zoom ?? 1) * 1.15}) rotateX(22deg)`
            : cameraTarget ? `scale(${cameraTarget.zoom})` : 'scale(1)',
          // Color grade por momento — vende emoção pelo filtro
          filter: frozen && activeMoment && MOMENT_GRADE[activeMoment.id]
            ? MOMENT_GRADE[activeMoment.id]
            : 'none',
          // Abertura snappy (cubic-bezier overshooting), retorno suave (linear-ease).
          transition: cameraTarget || frozen
            ? 'transform 480ms cubic-bezier(0.22, 1.4, 0.36, 1), transform-origin 480ms cubic-bezier(0.22, 1.4, 0.36, 1), filter 600ms ease-out'
            : 'transform 720ms cubic-bezier(0.4, 0, 0.2, 1), transform-origin 720ms cubic-bezier(0.4, 0, 0.2, 1), filter 400ms ease-out',
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
          highlightPlayerId={highlightId}
          defensiveAction={defensiveAction}
          onPlayerClick={(p) => {
            setBrainPlayer(p);
            setHighlightId(p.playerId);
            window.setTimeout(() => { setBrainPlayer(null); setHighlightId(null); }, 4000);
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

      {/* Vinheta T2 — escurece bordas durante freeze */}
      {frozen && (
        <div
          className="absolute inset-0 z-[150] pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.78) 95%)',
            animation: 'vignetteIn 320ms ease-out both',
          }}
        />
      )}

      {/* Eyebrow editorial T2 — MOMENTO · TIPO · MIN' */}
      {frozen && activeMoment && (
        <div
          className="absolute z-[200] pointer-events-none flex items-center gap-2"
          style={{ top: 18, left: 16, animation: 'eyebrowIn 360ms cubic-bezier(0.34,1.2,0.64,1) both' }}
        >
          <span aria-hidden style={{ width: 24, height: 2, background: '#FDE100' }} />
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 800,
            letterSpacing: '0.32em', fontSize: 10, textTransform: 'uppercase',
            color: '#FDE100',
          }}>
            Momento · {activeMoment.label} · {engine.minute}'
          </span>
        </div>
      )}

      {/* ── Trajetórias fantasmas — setas curvadas previewando escolhas ── */}
      {frozen && activeMoment && !attackerPick && MOMENT_GHOSTS[activeMoment.id] && (
        <svg
          className="absolute inset-0 z-[180] pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ animation: 'vignetteIn 480ms ease-out 200ms both' }}
        >
          <defs>
            <marker id="ghost-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#FDE100" opacity="0.85" />
            </marker>
          </defs>
          {MOMENT_GHOSTS[activeMoment.id].map((g, i) => {
            // Curva de Bézier quadrática: ponto de controle entre from/to com offset perpendicular
            const mx = (g.from.x + g.to.x) / 2;
            const my = (g.from.y + g.to.y) / 2 - 8 + i * 2;
            return (
              <g key={g.id}>
                <path
                  d={`M ${g.from.x} ${g.from.y} Q ${mx} ${my} ${g.to.x} ${g.to.y}`}
                  fill="none"
                  stroke={g.color}
                  strokeWidth="0.4"
                  strokeDasharray="1.2 0.8"
                  strokeLinecap="round"
                  opacity="0.55"
                  markerEnd="url(#ghost-arrow)"
                  style={{ animation: `ghostDraw 600ms ease-out ${300 + i * 80}ms both` }}
                />
                <text
                  x={g.to.x}
                  y={g.to.y - 1.5}
                  fill={g.color}
                  fontSize="1.6"
                  fontFamily="var(--font-display)"
                  fontWeight="800"
                  letterSpacing="0.18em"
                  textAnchor="middle"
                  opacity="0.85"
                  style={{ animation: `ghostDraw 400ms ease-out ${500 + i * 80}ms both` }}
                >
                  {g.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {/* ── Closeup do jogador-chave — mini-card pre-shot ── */}
      {frozen && activeMoment && MOMENT_KEY_STAT[activeMoment.id] && (() => {
        // Closeup do atacante (finalizador) — não do goleiro/zagueiro adversário
        const player = engine.homePlayers.find((p) => p.playerId === 'ata1')
          ?? engine.homePlayers.find((p) => p.role === 'attack');
        if (!player) return null;
        const stat = MOMENT_KEY_STAT[activeMoment.id];
        return (
          <div
            className="absolute z-[200] pointer-events-none"
            style={{
              top: 64, right: 14,
              animation: 'closeupIn 440ms cubic-bezier(0.22, 1.4, 0.36, 1) 180ms both',
            }}
          >
            <div style={{
              background: 'rgba(13,13,13,0.92)',
              border: '1px solid #FDE100',
              padding: '8px 10px',
              minWidth: 96,
              boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
            }}>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '0.32em',
                color: '#FDE100', textTransform: 'uppercase', fontWeight: 800, marginBottom: 4,
              }}>
                {player.pos} · {player.num}
              </div>
              <div style={{
                fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic',
                fontSize: 18, color: '#fff', lineHeight: 1, marginBottom: 6,
              }}>
                {player.name}
              </div>
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 6,
                borderTop: '1px solid rgba(253,225,0,0.2)', paddingTop: 6,
              }}>
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '0.22em',
                  color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', fontWeight: 800,
                }}>
                  {stat.label}
                </span>
                <span style={{
                  fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic',
                  fontSize: 22, color: '#FDE100', fontWeight: 700, marginLeft: 'auto',
                }}>
                  {stat.value}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Resultado — flash centralizado sobre o painel ── */}
      {outcome && (
        <div
          className="absolute left-0 right-0 flex justify-center z-[500]"
          style={{ bottom: showDecision ? 116 : 64, animation: 'outcomeIn 200ms ease both' }}
        >
          <div
            className="font-display uppercase"
            style={{
              background: outcome === 'intercept' ? '#EF4444' : outcome === 'goal' ? '#10B981' : '#FDE100',
              color: '#000',
              padding: outcome === 'goal' ? '12px 36px' : '8px 28px',
              fontWeight: 900,
              letterSpacing: outcome === 'goal' ? '0.5em' : '0.32em',
              fontSize: outcome === 'goal' ? 22 : 12,
              boxShadow:
                outcome === 'intercept' ? '0 4px 32px rgba(239,68,68,0.45)'
                : outcome === 'goal'    ? '0 6px 48px rgba(16,185,129,0.65)'
                :                          '0 4px 32px rgba(253,225,0,0.45)',
            }}
          >
            {outcome === 'intercept' ? 'Interceptado' : outcome === 'goal' ? 'GOOOL' : 'Saiu jogando'}
          </div>
        </div>
      )}

      {/* ── FieldDecisionOverlay — cinematográfico, dentro do campo ── */}
      {showDecision && activeMoment && (() => {
        const focusPlayer = activeMoment.highlight
          ? (engine.homePlayers.find(p => p.playerId === activeMoment.highlight) ?? engine.homePlayers[0])
          : engine.homePlayers.find(p => p.role === 'attack') ?? engine.homePlayers[0];

        // Monta 2 choices a partir das opções do momento
        const isAttackerTurn = showAttacker;
        const choiceMap: Record<string, [FieldDecisionChoice, FieldDecisionChoice]> = {
          gk:       [{ id: 'long', label: 'LONGO' }, { id: 'short', label: 'CURTO' }],
          corner:   [{ id: 'near', label: '1° PAU' }, { id: 'far', label: '2° PAU' }],
          freekick: [{ id: 'shoot', label: 'CHUTE' }, { id: 'cross', label: 'CRUZAR' }],
          recv:     [{ id: 'hold', label: 'SEGURAR' }, { id: 'turn', label: 'GIRAR' }],
          wing:     [{ id: 'cross', label: 'CRUZAR' }, { id: 'cut', label: 'CORTAR' }],
          '1v1':    [{ id: 'inside', label: 'DENTRO' }, { id: 'outside', label: 'FORA' }],
          header:   [{ id: 'power', label: 'FORÇA' }, { id: 'place', label: 'COLOCAR' }],
          '1v1gk':  [{ id: 'placed', label: 'COLOCAR' }, { id: 'power', label: 'FORÇA' }],
          tackle:   [{ id: 'cover', label: 'COBRIR' }, { id: 'slide', label: 'CARRINHO' }],
          lastline: [{ id: 'hold', label: 'SEGURAR' }, { id: 'step', label: 'AVANÇAR' }],
          rebound:  [{ id: 'first', label: 'PRIMEIRO' }, { id: 'wait', label: 'ESPERAR' }],
          gegen:    [{ id: 'swarm', label: 'PRESSÃO' }, { id: 'short', label: 'CURTO' }],
          counter:  [{ id: 'wing', label: 'PELAS PONTAS' }, { id: 'center', label: 'CENTRO' }],
        };
        const choices = choiceMap[activeMoment.id] ?? [{ id: 'a', label: 'OPÇÃO A' }, { id: 'b', label: 'OPÇÃO B' }];

        return (
          <FieldDecisionOverlay
            key={activeMoment.id + (attackerPick ?? '')}
            playerName={focusPlayer?.name ?? 'Jogador'}
            playerPos={focusPlayer?.pos ?? '—'}
            playerNum={focusPlayer?.num ?? 0}
            momentLabel={activeMoment.label.toUpperCase()}
            choices={choices}
            onChoose={isAttackerTurn ? handleAttackerChoice : handleDefenderChoice}
            onTimeout={() => isAttackerTurn
              ? handleAttackerChoice(activeMoment.fa)
              : handleDefenderChoice(activeMoment.fd)
            }
            timeoutMs={5000}
          />
        );
      })()}

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
      <CommandCenter onSubmit={handleCommandSubmit} onTagDispatch={handleTagDispatch} />

      {/* ── AgentFeedbackStream — timeline lateral direita ── */}
      <AgentFeedbackStream entries={feedbackEntries} />

      {/* ── SectorFocus — overlay de zona ── */}
      <SectorFocus zone={sectorZone} />

      {/* ── Tipografia Cinética — palavra no centro do campo ── */}
      {kineticWord && (
        <div
          className="absolute inset-0 z-[155] pointer-events-none flex items-center justify-center"
          key={kineticWord + Date.now()}
        >
          <span style={{
            fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic',
            fontSize: 'clamp(48px, 10vw, 96px)', fontWeight: 900,
            color: 'rgba(255,255,255,0.10)', letterSpacing: '0.08em',
            textTransform: 'uppercase', animation: 'kineticWord 1200ms ease-out both',
            userSelect: 'none',
          }}>
            {kineticWord}
          </span>
        </div>
      )}
    </div>
  );
}
