/**
 * Motor standalone do Legacy Mode — roda TacticalSimLoop sem game store.
 * Expõe: posições reais dos jogadores, clock, placar, feed, event bus.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PitchPlayerState, LiveMatchSnapshot } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';
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

export interface TeamStats {
  passesOk: number;
  passesAttempt: number;
  shots: number;
  shotsOn: number;
  tackles: number;
  km: number;
  goals: number;
  saves: number;
  dribblesOk: number;
}

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
  homeStats: TeamStats;
  awayStats: TeamStats;
  possessionPct: { home: number; away: number };
  expertBars: {
    decisions: { home: number; away: number };
    confidence: { home: number; away: number; homeLabel: string; awayLabel: string };
    tactical: { home: number; away: number };
  };
}

const RENDER_MS = 24;

/**
 * Skills mock atribuídas por role no Legacy mode standalone.
 * O mode não tem game store, então os jogadores ganham 1 skill default por posição.
 */
const MOCK_SKILLS_BY_ROLE: Record<'gk' | 'def' | 'mid' | 'attack', string> = {
  gk: 'skl_goleiro_padrao',
  def: 'skl_ferrolho_italiano',
  mid: 'skl_meia_padrao',
  attack: 'skl_artilheiro_clutch',
};

/**
 * Constrói playersById mock para o Legacy mode (sem game store).
 * Cada jogador recebe 1 skill default baseada na role.
 */
function buildMockPlayersById(homePlayers: PitchPlayerState[]): Record<string, PlayerEntity> {
  const out: Record<string, PlayerEntity> = {};
  for (const p of homePlayers) {
    const role = (p.role ?? 'mid') as keyof typeof MOCK_SKILLS_BY_ROLE;
    out[p.playerId] = {
      id: p.playerId,
      name: p.name,
      skills: [MOCK_SKILLS_BY_ROLE[role] ?? 'skl_meia_padrao'],
    } as unknown as PlayerEntity;
  }
  return out;
}

/** Constrói LiveMatchSnapshot mínimo para inicializar TacticalSimLoop */
function buildMockLive(
  homePlayers: PitchPlayerState[],
  minute: number,
  homeScore: number,
  awayScore: number,
): LiveMatchSnapshot {
  // Build lineup from actual slotIds on the players (works for both mock and real squad)
  const lineupBySlot: Record<string, string> = {};
  homePlayers.forEach((p) => {
    if (p.slotId) lineupBySlot[p.slotId] = p.playerId;
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
    homePlayers,
    homeFormationScheme: '4-3-3',
    awayFormationScheme: '4-4-2',
    matchLineupBySlot: lineupBySlot,
    homeStats: {},
    events: [],
    substitutionsUsed: 0,
    travelKm: 0,
  } as unknown as LiveMatchSnapshot;
}

export type LegacyAwayRosterEntry = { id: string; num: number; name: string; pos: string };

const FALLBACK_AWAY_ROSTER: LegacyAwayRosterEntry[] = [
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
  awayRoster: LegacyAwayRosterEntry[] = FALLBACK_AWAY_ROSTER,
) {
  const loopRef = useRef<TacticalSimLoop | null>(null);
  const homePlayersRef = useRef(homePlayers);
  homePlayersRef.current = homePlayers;
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;
  const timeScaleRef = useRef(timeScale);
  timeScaleRef.current = timeScale;
  const awayRosterRef = useRef(awayRoster);
  awayRosterRef.current = awayRoster;

  const emptyStats: TeamStats = { passesOk: 0, passesAttempt: 0, shots: 0, shotsOn: 0, tackles: 0, km: 0, goals: 0, saves: 0, dribblesOk: 0 };
  const possessionTicksRef = useRef({ home: 0, away: 0 });
  const playersByIdRef = useRef<Record<string, PlayerEntity>>(buildMockPlayersById(homePlayers));
  playersByIdRef.current = buildMockPlayersById(homePlayers);
  const [activatedSkills, setActivatedSkills] = useState<Array<{ playerId: string; skillId: string; activatedAt: number }>>([]);
  const [legacyModeActive, setLegacyModeActive] = useState(false);

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
    homeStats: emptyStats,
    awayStats: emptyStats,
    possessionPct: { home: 50, away: 50 },
    expertBars: {
      decisions: { home: 50, away: 50 },
      confidence: { home: 50, away: 50, homeLabel: 'estável', awayLabel: 'estável' },
      tactical: { home: 50, away: 50 },
    },
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
            awayRoster: awayRosterRef.current,
          });
          const carrierId = loop.getSimState().carrierId ?? undefined;

          // Aggregate per-player stats into team totals
          const stats = simSt.stats ?? {};
          const homeIds = new Set(hp.map(p => p.playerId));
          const hs: TeamStats = { ...emptyStats };
          const as: TeamStats = { ...emptyStats };
          for (const [pid, s] of Object.entries(stats)) {
            const target = homeIds.has(pid) ? hs : as;
            target.passesOk += s.passesOk;
            target.passesAttempt += s.passesAttempt;
            target.shots += s.shots;
            target.shotsOn += s.shotsOn;
            target.tackles += s.tackles;
            target.km += s.km;
            target.goals += s.goals;
            target.saves += s.saves;
            target.dribblesOk += s.dribblesOk;
          }

          // Track possession ticks
          const poss = simSt.possession ?? 'home';
          possessionTicksRef.current[poss]++;
          const totalTicks = possessionTicksRef.current.home + possessionTicksRef.current.away;
          const homePoss = totalTicks > 0 ? Math.round((possessionTicksRef.current.home / totalTicks) * 100) : 50;

          // Expert bars: 3 composite metrics
          const expert = loop.getExpertMetrics();

          // DECISÕES CERTAS: weighted success rate of all actions
          const decisionScore = (st: TeamStats) => {
            const passW = 3, shotW = 5, dribW = 2, tackW = 2;
            const successes = st.passesOk * passW + st.shotsOn * shotW + st.dribblesOk * dribW + st.tackles * tackW;
            const attempts = st.passesAttempt * passW + st.shots * shotW + st.dribblesOk * dribW + st.tackles * tackW;
            if (attempts === 0) return 50;
            return Math.round((successes / attempts) * 100);
          };

          // CONFIANÇA: from TeamMoraleState
          const homeConf = expert.homeMorale?.confidence ?? 50;
          const awayConf = expert.awayMorale?.confidence ?? 50;
          const homeConfLabel = expert.homeMorale?.label ?? 'estável';
          const awayConfLabel = expert.awayMorale?.label ?? 'estável';

          // TÁTICO: tactical discipline 0-1 → 0-100
          const homeTact = Math.round(expert.homeTacticalDiscipline * 100);
          const awayTact = Math.round(expert.awayTacticalDiscipline * 100);

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
            homeStats: hs,
            awayStats: as,
            possessionPct: { home: homePoss, away: 100 - homePoss },
            expertBars: {
              decisions: { home: decisionScore(hs), away: decisionScore(as) },
              confidence: { home: homeConf, away: awayConf, homeLabel: homeConfLabel, awayLabel: awayConfLabel },
              tactical: { home: homeTact, away: awayTact },
            },
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

  /**
   * Ativa skill em um jogador específico via TacticalSimLoop.skillActivation.
   * Retorna { ok, message } para feedback de UI.
   */
  const applySkillToPlayer = useCallback((playerId: string, skillId: string): { ok: boolean; message: string } => {
    const loop = loopRef.current;
    if (!loop) return { ok: false, message: 'Engine não inicializado' };
    const gameTime = loop.getSimState().minute * 60;
    const res = loop.skillActivation.activateSkill(playerId, skillId, gameTime, playersByIdRef.current);
    if (res.success) {
      const player = homePlayersRef.current.find((p) => p.playerId === playerId);
      setActivatedSkills((prev) => [
        ...prev.filter((s) => !(s.playerId === playerId && s.skillId === skillId)),
        { playerId, skillId, activatedAt: gameTime },
      ]);
      window.setTimeout(() => {
        setActivatedSkills((prev) => prev.filter((s) => !(s.playerId === playerId && s.skillId === skillId && s.activatedAt === gameTime)));
      }, 30_000);
      return { ok: true, message: `${player?.name ?? playerId} ativou ${skillId}` };
    }
    return { ok: false, message: res.reason ?? 'Falha ao ativar skill' };
  }, []);

  /**
   * Ativa Legacy Mode: dispara skill default de cada jogador da casa simultaneamente.
   * Retorna número de skills ativadas.
   */
  const toggleLegacyMode = useCallback((): { active: boolean; activated: number } => {
    const next = !legacyModeActive;
    setLegacyModeActive(next);
    if (!next) return { active: false, activated: 0 };

    let count = 0;
    const players = homePlayersRef.current;
    const byId = playersByIdRef.current;
    for (const p of players) {
      const entity = byId[p.playerId];
      const skillId = entity?.skills?.[0];
      if (!skillId) continue;
      const res = applySkillToPlayer(p.playerId, skillId);
      if (res.ok) count++;
    }
    return { active: true, activated: count };
  }, [legacyModeActive, applySkillToPlayer]);

  return {
    ...state,
    activatedSkills,
    legacyModeActive,
    playersById: playersByIdRef.current,
    applySkillToPlayer,
    toggleLegacyMode,
  };
}
