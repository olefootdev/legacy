/**
 * Motor standalone do Legacy Mode — roda TacticalSimLoop sem game store.
 * Expõe: posições reais dos jogadores, clock, placar, feed, event bus.
 */
import { useEffect, useRef, useState } from 'react';
import type { PitchPlayerState, LiveMatchSnapshot } from '@/engine/types';
import { TacticalSimLoop } from '@/simulation/TacticalSimLoop';
import { truthSnapshotToTest2dPitch } from '@/engine/test2d/truthToTest2dPitch';
import type { MatchSimulationEvent } from '@/match/events/matchSimulationContract';

export type LegacyEventKind =
  | 'corner'
  | 'freekick'
  | 'shot'
  | 'rebound'
  | 'possession_change'
  | 'goal';

export interface LegacyMatchState {
  minute: number;
  homeScore: number;
  awayScore: number;
  possession: 'home' | 'away';
  homePlayers: PitchPlayerState[];
  awayPlayers: PitchPlayerState[];
  ballX: number;
  ballY: number;
  onBallPlayerId: string | undefined;
  events: Array<{ minute: number; text: string; kind?: string }>;
  phase: 'playing' | 'halftime' | 'fulltime';
  lastEvent: (LegacyEventKind & string) | null;
}

const RENDER_MS = 24;

/** 4-3-3 slot→playerId para o time da casa mock */
const MOCK_HOME_LINEUP: Record<string, string> = {
  gol: 'gk1',
  zag1: 'zag1',
  zag2: 'zag2',
  le: 'lat1',
  ld: 'lat2',
  vol: 'vol1',
  mc1: 'mei1',
  mc2: 'mei2',
  pe: 'pe1',
  pd: 'pd1',
  ata: 'ata1',
};

/** Constrói LiveMatchSnapshot mínimo para inicializar TacticalSimLoop */
function buildMockLive(
  homePlayers: PitchPlayerState[],
  minute: number,
  homeScore: number,
  awayScore: number,
): LiveMatchSnapshot {
  // Garantir slotIds corretos para o TacticalSimLoop
  const playersWithSlots = homePlayers.map((p) => {
    const slot = Object.entries(MOCK_HOME_LINEUP).find(([, pid]) => pid === p.playerId)?.[0];
    return { ...p, slotId: slot ?? p.slotId };
  });

  return {
    mode: 'test2d',
    phase: 'playing',
    minute,
    footballElapsedSec: minute * 60,
    homeScore,
    awayScore,
    homeShort: 'OLE',
    awayShort: 'ADV',
    possession: 'home',
    ball: { x: 50, y: 50 },
    homePlayers: playersWithSlots,
    homeFormationScheme: '4-3-3',
    awayFormationScheme: '4-4-2',
    matchLineupBySlot: MOCK_HOME_LINEUP,
    homeStats: {},
    events: [],
    substitutionsUsed: 0,
    travelKm: 0,
  } as unknown as LiveMatchSnapshot;
}

const AWAY_ROSTER = [
  { id: 'agk1', num: 1, name: 'Silvio', pos: 'GOL' },
  { id: 'azag1', num: 4, name: 'Marcos', pos: 'ZAG' },
  { id: 'azag2', num: 5, name: 'Felipe', pos: 'ZAG' },
  { id: 'alat1', num: 2, name: 'Edu', pos: 'LAT' },
  { id: 'alat2', num: 3, name: 'Igor', pos: 'LAT' },
  { id: 'avol1', num: 6, name: 'Patrick', pos: 'VOL' },
  { id: 'avol2', num: 8, name: 'Mateus', pos: 'VOL' },
  { id: 'amei1', num: 10, name: 'Samuel', pos: 'MEI' },
  { id: 'ape1', num: 11, name: 'Kelvin', pos: 'PD' },
  { id: 'apd1', num: 7, name: 'Arthur', pos: 'PE' },
  { id: 'aata1', num: 9, name: 'Bruno M', pos: 'ATA' },
];

function simEventToLegacyKind(ev: MatchSimulationEvent): LegacyEventKind | null {
  if (ev.kind === 'SetPiecePosition' && ev.piece === 'corner') return 'corner';
  if (ev.kind === 'PhaseChanged' && ev.to === 'SET_PIECE_CORNER') return 'corner';
  if (ev.kind === 'Whistle') return 'freekick';
  if (ev.kind === 'Shot') return 'shot';
  if (ev.kind === 'CausalShotResult' && ev.outcome === 'save') return 'rebound';
  if (ev.kind === 'Goal') return 'goal';
  if (ev.kind === 'PossessionChanged') return 'possession_change';
  return null;
}

export function useLegacyMatchEngine(
  homePlayers: PitchPlayerState[],
  onEvent: (kind: LegacyEventKind) => void,
  frozen = false,
  timeScale = 1,
) {
  const loopRef = useRef<TacticalSimLoop | null>(null);
  const homePlayersRef = useRef(homePlayers);
  homePlayersRef.current = homePlayers;
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;
  const timeScaleRef = useRef(timeScale);
  timeScaleRef.current = timeScale;

  const [state, setState] = useState<LegacyMatchState>({
    minute: 0,
    homeScore: 0,
    awayScore: 0,
    possession: 'home',
    homePlayers,
    awayPlayers: [],
    ballX: 50,
    ballY: 50,
    onBallPlayerId: undefined,
    events: [],
    phase: 'playing',
    lastEvent: null,
  });

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const loop = new TacticalSimLoop();
    loopRef.current = loop;

    // Cooldown por tipo de evento — evita spam mas não bloqueia eventos diferentes
    const lastEventKindRef = { current: null as (LegacyEventKind & string) | null };
    const lastEventByKind = new Map<string, number>();
    const COOLDOWN_MS: Partial<Record<LegacyEventKind, number>> = {
      corner:           12000,
      freekick:         12000,
      shot:             15000,
      rebound:           8000,
      goal:                 0,
      possession_change:    0,
    };
    const unsub = loop.eventBus.subscribe((ev) => {
      const kind = simEventToLegacyKind(ev);
      if (!kind) return;
      const now = performance.now();
      lastEventKindRef.current = kind;
      const cooldown = COOLDOWN_MS[kind] ?? 12000;
      if (cooldown > 0 && now - (lastEventByKind.get(kind) ?? 0) < cooldown) return;
      lastEventByKind.set(kind, now);
      onEventRef.current(kind);
    });

    let frameId = 0;
    let last = performance.now();
    let lastRenderMs = 0;

    const run = (now: number) => {
      const rawDt = Math.min(0.05, (now - last) / 1000);
      const dt = rawDt * timeScaleRef.current;
      last = now;

      // Freeze frame — pula simulação e render mas mantém a rAF rodando
      if (frozenRef.current) {
        frameId = requestAnimationFrame(run);
        return;
      }

      const hp = homePlayersRef.current;
      const simSt = loop.getSimState();
      const mockLive = buildMockLive(hp, simSt.minute, simSt.homeScore, simSt.awayScore);
      loop.syncLive(mockLive, {
        tacticalMentality: 55,
        defensiveLine: 50,
        tempo: 55,
      });
      loop.step(dt, { tacticalMentality: 55, defensiveLine: 50, tempo: 55 });

      if (now - lastRenderMs >= RENDER_MS) {
        lastRenderMs = now;
        const snap = loop.getSnapshot();
        if (snap) {
          const { homePitch, awayPitch, ball } = truthSnapshotToTest2dPitch({
            snap,
            homePlayers: hp,
            awayRoster: AWAY_ROSTER,
          });
          const carrierId = loop.getSimState().carrierId ?? undefined;

          setState({
            minute: simSt.minute,
            homeScore: simSt.homeScore,
            awayScore: simSt.awayScore,
            possession: simSt.possession ?? 'home',
            homePlayers: homePitch.length > 0 ? homePitch : hp,
            awayPlayers: awayPitch,
            ballX: ball.x,
            ballY: ball.y,
            onBallPlayerId: carrierId,
            events: (simSt.events ?? []).slice(-5).reverse().map((e) => ({
              minute: e.minute ?? simSt.minute,
              text: e.text ?? '',
              kind: e.kind,
            })),
            phase: simSt.phase === 'fulltime' ? 'fulltime' : simSt.phase === 'halftime' ? 'halftime' : 'playing',
            lastEvent: lastEventKindRef.current,
          });
        }
      }

      frameId = requestAnimationFrame(run);
    };

    frameId = requestAnimationFrame(run);
    return () => {
      cancelAnimationFrame(frameId);
      unsub();
      loopRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
