/**
 * Legacy Mode — /dev/field-view.
 * Campo ao vivo limpo + SmartPanel.
 */
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
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
import { LegacySkillBanner } from '@/components/match/LegacySkillBanner';
import { SubstitutePickerModal } from '@/components/match/SubstitutePickerModal';
import { useNarrativeCamera } from '@/components/match/useNarrativeCamera';
import type { PitchPlayerState } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';
import type { FormationSchemeId } from '@/match-engine/types';
import { FORMATION_BASES } from '@/match-engine/formations/catalog';
import { useLegacyMatchEngine, type LegacyAwayRosterEntry } from './useLegacyMatchEngine';
import { useGameStore } from '@/game/store';
import { pitchPlayersFromLineup, roleFromPos } from '@/engine/pitchFromLineup';
import { mergeLineupWithDefaults, awayStartingElevenFromSquad } from '@/entities/lineup';
import { matchAttributesFromPlayerEntity, behaviorToCognitiveArchetype } from '@/match/playerInMatch';

// ── Formation position helpers ────────────────────────────────────────────────

/**
 * Retorna jogadores com posições fixas da formação (engine % 0-100).
 * Home: nx*100 = x (profundidade), nz*100 = y (largura).
 * Away: espelhado em x.
 */
function formationPositions(
  players: PitchPlayerState[],
  formation: FormationSchemeId,
  side: 'home' | 'away',
): PitchPlayerState[] {
  const bases = FORMATION_BASES[formation] ?? FORMATION_BASES['4-3-3'];
  return players.map((p) => {
    const slot = bases[p.slotId];
    if (!slot) return p;
    const x = side === 'home' ? slot.nx * 100 : (1 - slot.nx) * 100;
    const y = slot.nz * 100;
    return { ...p, x, y };
  });
}

/**
 * Posições de kickoff: todos no próprio meio-campo, linha de saída.
 * Home: x entre 35-48 (recuados para o próprio lado).
 * Away: x entre 52-65.
 */
function kickoffPositions(
  players: PitchPlayerState[],
  side: 'home' | 'away',
): PitchPlayerState[] {
  const bases = { gol: 0.08, def: 0.32, mid: 0.42, attack: 0.46 };
  return players.map((p) => {
    const depthNx = bases[p.role] ?? 0.4;
    const x = side === 'home' ? depthNx * 100 : (1 - depthNx) * 100;
    return { ...p, x };
  });
}

// ── Fallback mock (used only when store has no squad) ─────────────────────────
function mkPlayer(id: string, name: string, num: number, pos: string,
  role: 'attack' | 'mid' | 'def' | 'gk', x: number, y: number, fatigue = 20): PitchPlayerState {
  return { playerId: id, slotId: id, name, num, pos, role, x, y, fatigue, heading: 0 };
}
const FALLBACK_PLAYERS: PitchPlayerState[] = [
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

/** Fallback bench mock — só é usado quando a loja está vazia (dev preview). */
function mkBenchEntity(id: string, name: string, num: number, pos: string): PlayerEntity {
  return {
    id, name, num, pos,
    fatigue: 0,
    outForMatches: 0,
    skills: [],
    attrs: {
      passe: 70, drible: 65, marcacao: 65, velocidade: 70, fairPlay: 75,
      finalizacao: 60, fisico: 70, tatico: 65, mentalidade: 70, confianca: 65,
    },
    behavior: {},
    strongFoot: 'right',
    archetype: 'box_to_box',
  } as unknown as PlayerEntity;
}
const FALLBACK_BENCH: PlayerEntity[] = [
  mkBenchEntity('bench_gk', 'Helder Reserva', 12, 'GOL'),
  mkBenchEntity('bench_zag', 'Felipe Reserva', 14, 'ZAG'),
  mkBenchEntity('bench_lat', 'Ramon Reserva', 13, 'LAT'),
  mkBenchEntity('bench_vol', 'Paulinho Reserva', 15, 'VOL'),
  mkBenchEntity('bench_mei', 'Renato Reserva', 16, 'MEI'),
  mkBenchEntity('bench_pe', 'Thiago Reserva', 17, 'PE'),
  mkBenchEntity('bench_pd', 'Joaquim Reserva', 18, 'PD'),
  mkBenchEntity('bench_ata', 'Jonas Reserva', 19, 'ATA'),
];

// ── Main ─────────────────────────────────────────────────────────────────────
type CameraTrackMode = 'static' | 'follow' | 'actioncam';

function computeFollowCameraTransform(
  ballX: number,
  ballY: number,
  viewportHeight: number,
): { panY: number; panX: number } {
  // ballX = 0–100 no eixo do comprimento (horizontal no campo, vertical na tela broadcast)
  // ballY = 0–100 no eixo da largura (lateral)
  // panY: bola no centro vertical da tela (campo vai de cima a baixo)
  const panY = (ballX / 100 - 0.5) * viewportHeight * 0.35;
  // panX: pan lateral seguindo a largura do campo
  const panX = (ballY - 50) * (viewportHeight * 0.06);
  return { panY, panX };
}

function computeActionCamTransform(
  ballX: number,
  ballY: number,
  viewportHeight: number,
): { scale: number; translateX: number; translateY: number } {
  // Zoom: 0.9 quando bola está no meio → 1.35 perto dos gols
  const distFromCenter = Math.abs(ballX - 50) / 50;
  const zoomFactor = 0.9 + distFromCenter * 0.45;
  // Pan lateral pela largura
  const translateX = (ballY - 50) * (viewportHeight * 0.12);
  // Pan vertical pelo comprimento
  const translateY = (ballX / 100 - 0.5) * viewportHeight * 0.35;
  return { scale: zoomFactor, translateX, translateY };
}

// ── Expert Ball Animation ─────────────────────────────────────────────────────
// Interpola a bola entre jogadores fixos com física de arco, passes encadeados,
// pulso no receptor e linha de passe pontilhada.

interface BallAnimState {
  ballX: number;
  ballY: number;
  pulsingId: string | null;
  passLine: { fromX: number; fromY: number; toX: number; toY: number } | null;
}
/**
 * Easing ease-in-out cúbico.
 */
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Arco parabólico: eleva a bola no meio do trajeto para simular passe aéreo.
 * height: 0 = linha reta, 1 = arco alto.
 */
function arcBall(
  fromX: number, fromY: number,
  toX: number, toY: number,
  t: number,
  height = 0.18,
): { x: number; y: number } {
  const et = easeInOut(t);
  const x = fromX + (toX - fromX) * et;
  const y = fromY + (toY - fromY) * et;
  // Arco perpendicular ao trajeto (deslocamento lateral no campo 2D)
  const arc = Math.sin(Math.PI * t) * height;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular normalizado
  const px = -dy / len;
  const py = dx / len;
  const arcScale = Math.min(len * 0.4, 12); // arco proporcional à distância, máx 12%
  return { x: x + px * arc * arcScale, y: y + py * arc * arcScale };
}

function useExpertBallAnimation(
  active: boolean,
  targetBallX: number,
  targetBallY: number,
  onBallPlayerId: string | null,
  homePlayers: PitchPlayerState[],
  awayPlayers: PitchPlayerState[],
): BallAnimState {
  const stateRef = useRef<BallAnimState>({ ballX: targetBallX, ballY: targetBallY, pulsingId: null, passLine: null });
  const [rendered, setRendered] = useState<BallAnimState>({ ballX: targetBallX, ballY: targetBallY, pulsingId: null, passLine: null });

  // Animação em curso
  const animRef = useRef<{
    fromX: number; fromY: number;
    toX: number; toY: number;
    startMs: number; durationMs: number;
    recipientId: string | null;
    // Fila de passes encadeados pendentes
    queue: Array<{ toX: number; toY: number; recipientId: string | null; durationMs: number }>;
  } | null>(null);

  const rafRef = useRef<number>(0);
  const prevCarrierRef = useRef<string | null>(onBallPlayerId);
  const prevTargetRef = useRef({ x: targetBallX, y: targetBallY });

  // Encontra posição de um jogador pelo id
  const findPlayerPos = useCallback((id: string | null): { x: number; y: number } | null => {
    if (!id) return null;
    const all = [...homePlayers, ...awayPlayers];
    const p = all.find(pl => pl.playerId === id);
    return p ? { x: p.x, y: p.y } : null;
  }, [homePlayers, awayPlayers]);

  // Inicia nova animação de passe
  const startPass = useCallback((
    fromX: number, fromY: number,
    toX: number, toY: number,
    recipientId: string | null,
    durationMs: number,
    queue: Array<{ toX: number; toY: number; recipientId: string | null; durationMs: number }> = [],
  ) => {
    animRef.current = { fromX, fromY, toX, toY, startMs: performance.now(), durationMs, recipientId, queue };
    // Mostra linha de passe imediatamente
    stateRef.current = { ...stateRef.current, passLine: { fromX, fromY, toX, toY } };
    setRendered({ ...stateRef.current });
    // Pulso no receptor 300ms antes da chegada
    if (recipientId) {
      const pulseDelay = Math.max(0, durationMs - 300);
      window.setTimeout(() => {
        stateRef.current = { ...stateRef.current, pulsingId: recipientId };
        setRendered({ ...stateRef.current });
        window.setTimeout(() => {
          stateRef.current = { ...stateRef.current, pulsingId: null };
          setRendered({ ...stateRef.current });
        }, 500);
      }, pulseDelay);
    }
  }, []);

  // Loop de animação
  useEffect(() => {
    if (!active) return;
    let running = true;

    const tick = (now: number) => {
      if (!running) return;
      const anim = animRef.current;
      if (anim) {
        const elapsed = now - anim.startMs;
        const t = Math.min(1, elapsed / anim.durationMs);
        const pos = arcBall(anim.fromX, anim.fromY, anim.toX, anim.toY, t);
        stateRef.current = { ...stateRef.current, ballX: pos.x, ballY: pos.y };
        setRendered({ ...stateRef.current });

        if (t >= 1) {
          // Chegou ao destino — próximo da fila?
          if (anim.queue.length > 0) {
            const next = anim.queue[0]!;
            const rest = anim.queue.slice(1);
            startPass(anim.toX, anim.toY, next.toX, next.toY, next.recipientId, next.durationMs, rest);
          } else {
            // Limpa linha de passe ao terminar
            animRef.current = null;
            stateRef.current = { ...stateRef.current, passLine: null };
            setRendered({ ...stateRef.current });
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [active, startPass]);

  // Detecta mudança de portador → dispara passe visual encadeado
  useEffect(() => {
    if (!active) return;
    const prevCarrier = prevCarrierRef.current;
    const prevTarget = prevTargetRef.current;
    prevCarrierRef.current = onBallPlayerId;
    prevTargetRef.current = { x: targetBallX, y: targetBallY };

    if (onBallPlayerId === prevCarrier) return; // mesmo portador, sem passe

    const fromX = stateRef.current.ballX;
    const fromY = stateRef.current.ballY;
    const recipientPos = findPlayerPos(onBallPlayerId);
    const toX = recipientPos?.x ?? targetBallX;
    const toY = recipientPos?.y ?? targetBallY;

    // Distância determina duração: passe curto ~320ms, longo ~620ms
    const dist = Math.hypot(toX - fromX, toY - fromY);
    const durationMs = Math.max(280, Math.min(650, 280 + dist * 5.5));

    // Passes encadeados: se a bola está longe do portador anterior,
    // cria um passe intermediário pelo meio-campo para simular construção
    const queue: Array<{ toX: number; toY: number; recipientId: string | null; durationMs: number }> = [];
    if (dist > 35 && prevCarrier) {
      // Ponto intermediário: médio mais próximo da linha de passe
      const midX = (fromX + toX) / 2 + (Math.random() - 0.5) * 8;
      const midY = (fromY + toY) / 2 + (Math.random() - 0.5) * 10;
      const allPlayers = [...homePlayers, ...awayPlayers];
      // Encontra jogador de meio-campo mais próximo do ponto intermediário
      const midfielders = allPlayers.filter(p => p.role === 'mid');
      let midPlayer: PitchPlayerState | null = null;
      let bestDist = Infinity;
      for (const mp of midfielders) {
        if (mp.playerId === prevCarrier || mp.playerId === onBallPlayerId) continue;
        const d = Math.hypot(mp.x - midX, mp.y - midY);
        if (d < bestDist) { bestDist = d; midPlayer = mp; }
      }
      if (midPlayer && bestDist < 28) {
        const d1 = Math.hypot(midPlayer.x - fromX, midPlayer.y - fromY);
        const d2 = Math.hypot(toX - midPlayer.x, toY - midPlayer.y);
        const dur1 = Math.max(240, Math.min(480, 240 + d1 * 5));
        const dur2 = Math.max(240, Math.min(480, 240 + d2 * 5));
        // Passe intermediário pelo médio, depois para o destino final
        startPass(fromX, fromY, midPlayer.x, midPlayer.y, midPlayer.playerId, dur1, [
          { toX, toY, recipientId: onBallPlayerId, durationMs: dur2 },
        ]);
        return;
      }
    }

    startPass(fromX, fromY, toX, toY, onBallPlayerId, durationMs, queue);
  }, [active, onBallPlayerId, targetBallX, targetBallY, findPlayerPos, homePlayers, awayPlayers, startPass]);

  if (!active) return { ballX: targetBallX, ballY: targetBallY, pulsingId: null, passLine: null };
  return rendered;
}

export function FieldViewPreview() {
  const navigate = useNavigate();
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [camera, setCamera] = useState<'aerial' | 'broadcast' | 'firstperson'>('aerial');
  const [viewMode, setViewMode] = useState<'aerial' | 'expert'>('aerial');
  const [cameraTrack, setCameraTrack] = useState<CameraTrackMode>('static');
  const [cameraPan, setCameraPan] = useState({ x: 0, y: 0 });
  const [cameraZoom, setCameraZoom] = useState(1);

  // ── Formation fixed positions state ──────────────────────────────────────
  // matchStarted: false = kickoff positions, true = formation positions (fixed)
  const [matchStarted, setMatchStarted] = useState(false);
  // playerTransition: true during the 1.4s animation from kickoff → formation
  const [playerTransition, setPlayerTransition] = useState(false);
  // cinematicAction: true when a dramatic event triggers zoom (goal, shot)
  const [cinematicAction, setCinematicAction] = useState(false);

  // ── SmartPanel state ──────────────────────────────────────────────────────
  const [playStyle, setPlayStyle] = useState<PlayStyle>('PRESSAO_ALTA');
  const [fanMood, setFanMood] = useState(72);

  // ── Real game state from store ────────────────────────────────────────────
  const club = useGameStore((s) => s.club);
  const lineup = useGameStore((s) => s.lineup);
  const players = useGameStore((s) => s.players);
  const formationFromStore = useGameStore((s) => s.manager?.formationScheme ?? '4-3-3') as FormationSchemeId;
  const nextFixture = useGameStore((s) => s.nextFixture);
  const favoriteRealTeam = useGameStore((s) => s.userSettings?.favoriteRealTeam ?? null);

  const [formation, setFormation] = useState<FormationSchemeId>(formationFromStore);

  // ── Home XI: real lineup from store (fallback to mock if empty) ───────────
  const initialHomeXI = useMemo<PitchPlayerState[]>(() => {
    const playersCount = players ? Object.keys(players).length : 0;
    if (playersCount === 0) return FALLBACK_PLAYERS;
    const fullLineup = mergeLineupWithDefaults(lineup ?? {}, players);
    const pitch = pitchPlayersFromLineup(fullLineup, players, formation);
    return pitch.length === 11 ? pitch : FALLBACK_PLAYERS;
  }, [players, lineup, formation]);

  // homeXI is mutable: substituições atualizam aqui sem mexer no store global.
  const [homeXI, setHomeXI] = useState<PitchPlayerState[]>(initialHomeXI);
  // Sincroniza quando lineup/formation/players do store mudam.
  useEffect(() => { setHomeXI(initialHomeXI); }, [initialHomeXI]);

  const [usedSubs, setUsedSubs] = useState(0);
  const [subbedInIds, setSubbedInIds] = useState<Set<string>>(() => new Set());
  const [subPickerOut, setSubPickerOut] = useState<PitchPlayerState | null>(null);
  const [subToast, setSubToast] = useState<{ ok: boolean; text: string } | null>(null);

  // Banco = jogadores do plantel não-titulares + ainda não usados como entrada.
  // Fallback: quando a loja está vazia (dev preview), usa FALLBACK_BENCH.
  const benchPlayers = useMemo<PlayerEntity[]>(() => {
    const storeHasPlayers = players && Object.keys(players).length > 0;
    const pool: PlayerEntity[] = storeHasPlayers ? Object.values(players) : FALLBACK_BENCH;
    const onPitch = new Set(homeXI.map((p) => p.playerId));
    return pool.filter((p) => !onPitch.has(p.id) && !subbedInIds.has(p.id));
  }, [players, homeXI, subbedInIds]);

  // playersById expandido inclui FALLBACK_BENCH quando store está vazia (para applySubstitutionLocal).
  const effectivePlayersById = useMemo<Record<string, PlayerEntity>>(() => {
    const storeHasPlayers = players && Object.keys(players).length > 0;
    if (storeHasPlayers) return players;
    const map: Record<string, PlayerEntity> = {};
    for (const p of FALLBACK_BENCH) map[p.id] = p;
    return map;
  }, [players]);

  // ── Away roster: opponent squad from nextFixture (fallback to mock) ───────
  const awayRoster = useMemo<LegacyAwayRosterEntry[] | undefined>(() => {
    const squad = nextFixture?.opponent?.genesisAwayPlayers;
    if (!squad || squad.length === 0) return undefined;
    const eleven = awayStartingElevenFromSquad(squad);
    if (eleven.length < 11) return undefined;
    return eleven.map((p) => ({ id: p.id, num: p.num, name: p.name, pos: p.pos }));
  }, [nextFixture]);

  const homeName = club?.name ?? 'Olefoot FC';
  const homeShort = club?.shortName ?? 'OLE';
  const awayName = nextFixture?.opponent?.name ?? 'Adversário';
  const awayShort = nextFixture?.opponent?.shortName ?? 'ADV';

  // ── PlayerBrainCard ───────────────────────────────────────────────────────
  const [brainPlayer, setBrainPlayer] = useState<PitchPlayerState | null>(null);

  const engine = useLegacyMatchEngine(homeXI, () => {}, false, 1, awayRoster, effectivePlayersById);

  // ── Substituição local (não persiste no store, vale só na partida) ────────
  const applySubstitutionLocal = useCallback((outId: string, inId: string): { ok: boolean; message: string } => {
    if (usedSubs >= 5) return { ok: false, message: 'Limite de 5 substituições atingido' };
    const outgoing = homeXI.find((p) => p.playerId === outId);
    if (!outgoing) return { ok: false, message: 'Jogador não está em campo' };
    const incoming = effectivePlayersById[inId];
    if (!incoming) return { ok: false, message: 'Reserva não encontrada' };
    const newPitch: PitchPlayerState = {
      playerId: incoming.id,
      slotId: outgoing.slotId,
      name: incoming.name,
      num: incoming.num,
      pos: incoming.pos,
      x: outgoing.x,
      y: outgoing.y,
      heading: outgoing.heading,
      fatigue: Math.round(incoming.fatigue),
      role: roleFromPos(incoming.pos),
      attributes: matchAttributesFromPlayerEntity(incoming),
      cognitiveArchetype: behaviorToCognitiveArchetype(incoming.behavior),
      strongFoot: incoming.strongFoot,
      archetype: incoming.archetype,
    };
    setHomeXI((prev) => prev.map((p) => (p.playerId === outId ? newPitch : p)));
    setSubbedInIds((prev) => new Set(prev).add(inId));
    setUsedSubs((n) => n + 1);
    const inLast = (incoming.name ?? '').split(' ').pop();
    const outLast = (outgoing.name ?? '').split(' ').pop();
    return { ok: true, message: `↪ ${outLast} sai · ${inLast} entra` };
  }, [homeXI, effectivePlayersById, usedSubs]);

  // Voz: "substituir <nome>" → escolhe melhor reserva por role.
  const substituteByName = useCallback((rawName: string): { ok: boolean; message: string } => {
    const name = rawName.trim().toLowerCase();
    if (!name) return { ok: false, message: 'Nome vazio' };
    const target = homeXI.find((p) => {
      const n = p.name?.toLowerCase() ?? '';
      return n.includes(name) || (n.split(' ').pop() ?? '').startsWith(name);
    });
    if (!target) return { ok: false, message: `"${rawName}" não está em campo` };
    if (benchPlayers.length === 0) return { ok: false, message: 'Sem reservas disponíveis' };
    const sameRole = benchPlayers.filter((p) => roleFromPos(p.pos) === target.role);
    const pool = sameRole.length > 0 ? sameRole : benchPlayers;
    const incoming = pool[0];
    return applySubstitutionLocal(target.playerId, incoming.id);
  }, [homeXI, benchPlayers, applySubstitutionLocal]);

  // Toast feedback efêmero
  useEffect(() => {
    if (!subToast) return;
    const t = window.setTimeout(() => setSubToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [subToast]);

  // ── Legacy banner: visível enquanto Legacy ativo + dismiss em clique ──────
  const [legacyBannerVisible, setLegacyBannerVisible] = useState(false);
  const [legacyHighlightIdx, setLegacyHighlightIdx] = useState(0);
  const [legacyBuffDurationSec, setLegacyBuffDurationSec] = useState(0);

  // Sessões totais acumuladas pelo elenco com positionKnowledge
  const legacyTotalSessions = useMemo(() => {
    return homeXI.reduce((sum, p) => {
      const entity = effectivePlayersById[p.playerId];
      return sum + (entity?.positionKnowledge?.sessionsCompleted ?? 0);
    }, 0);
  }, [homeXI, effectivePlayersById]);

  // Nome da lenda dominante no elenco (a que tem mais sessões)
  const legacyDominantLegendName = useMemo(() => {
    let best: { name: string; sessions: number } | null = null;
    for (const p of homeXI) {
      const pk = effectivePlayersById[p.playerId]?.positionKnowledge;
      if (!pk) continue;
      if (!best || pk.sessionsCompleted > best.sessions) {
        best = { name: pk.legendSource ?? '', sessions: pk.sessionsCompleted };
      }
    }
    return best?.name ?? undefined;
  }, [homeXI, effectivePlayersById]);

  // Reabre banner sempre que Legacy é (re)ativado
  useEffect(() => {
    if (engine.legacyModeActive && engine.activatedSkills.length > 0) {
      setLegacyBannerVisible(true);
      setLegacyHighlightIdx(0);
    } else {
      setLegacyBannerVisible(false);
    }
  }, [engine.legacyModeActive, engine.activatedSkills.length]);

  // Carrossel — alterna jogador em destaque a cada 2.4s
  useEffect(() => {
    if (!legacyBannerVisible) return;
    if (engine.activatedSkills.length <= 1) return;
    const id = window.setInterval(() => {
      setLegacyHighlightIdx((i) => i + 1);
    }, 2400);
    return () => window.clearInterval(id);
  }, [legacyBannerVisible, engine.activatedSkills.length]);

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

  // ── Match started: kickoff → formation animation ──────────────────────────
  // Quando o jogo sai de 'pregame' para 'playing', anima jogadores para formação.
  useEffect(() => {
    if (engine.phase === 'playing' && !matchStarted) {
      setMatchStarted(true);
      setPlayerTransition(true);
      const t = window.setTimeout(() => setPlayerTransition(false), 1400);
      return () => window.clearTimeout(t);
    }
  }, [engine.phase, matchStarted]);

  // ── Cinematic cuts: zoom dramático em gol/chute ───────────────────────────
  const lastEventRef = useRef(engine.lastEvent);
  useEffect(() => {
    if (engine.lastEvent === lastEventRef.current) return;
    lastEventRef.current = engine.lastEvent;
    const dramatic = engine.lastEvent === 'goal' || engine.lastEvent === 'shot';
    if (dramatic) {
      setCinematicAction(true);
      const t = window.setTimeout(() => setCinematicAction(false), 2800);
      return () => window.clearTimeout(t);
    }
  }, [engine.lastEvent]);

  // ── Firstperson: câmera segue a bola (actioncam) ─────────────────────────
  // Quando camera==='firstperson', aplica pan+zoom no cameraRef seguindo a bola.
  useEffect(() => {
    if (camera !== 'firstperson') return;
    const el = cameraRef.current;
    if (!el) return;
    const { scale, translateX, translateY } = computeActionCamTransform(
      engine.ballX,
      engine.ballY,
      el.offsetHeight || 400,
    );
    el.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    el.style.transition = 'transform 0.6s cubic-bezier(0.4,0,0.2,1)';
  }, [camera, engine.ballX, engine.ballY]);

  // Reset transform quando sai do firstperson
  useEffect(() => {
    if (camera !== 'firstperson') {
      const el = cameraRef.current;
      if (el) {
        el.style.transform = 'none';
        el.style.transition = 'transform 0.4s ease-out';
      }
    }
  }, [camera]);

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

  // Normaliza 'pregame' → 'playing' para componentes que não aceitam 'pregame' no tipo phase
  const displayPhase = engine.phase === 'pregame' ? 'playing' as const : engine.phase;

  // ── Players para o campo: fixos na formação (expert) ou do engine (outros modos) ──
  const aerialHomePlayers = useMemo(() => {
    const base = homeXI.length > 0 ? homeXI : engine.homePlayers;
    if (!matchStarted) return kickoffPositions(base, 'home');
    return formationPositions(base, formation, 'home');
  }, [homeXI, engine.homePlayers, matchStarted, formation]);

  const aerialAwayPlayers = useMemo(() => {
    const base = engine.awayPlayers;
    // Usa formação real do adversário se disponível, senão espelha a formação do home
    const awayFormation = (nextFixture?.opponent?.formationScheme as FormationSchemeId | undefined)
      ?? formation;
    if (!matchStarted) return kickoffPositions(base, 'away');
    return formationPositions(base, awayFormation, 'away');
  }, [engine.awayPlayers, matchStarted, formation, nextFixture]);

  // ── Expert ball animation: trajetória física + passes encadeados + pulso ──
  const expertBallAnim = useExpertBallAnimation(
    viewMode === 'expert' && matchStarted,
    engine.ballX,
    engine.ballY,
    engine.onBallPlayerId ?? null,
    aerialHomePlayers,
    aerialAwayPlayers,
  );

  // Posição final da bola: animada no expert, real nos outros modos
  const displayBallX = viewMode === 'expert' && matchStarted ? expertBallAnim.ballX : engine.ballX;
  const displayBallY = viewMode === 'expert' && matchStarted ? expertBallAnim.ballY : engine.ballY;
  // Jogadores com pulso no receptor
  const expertHomePlayers = viewMode === 'expert' && matchStarted
    ? aerialHomePlayers.map(p => expertBallAnim.pulsingId === p.playerId ? { ...p, _pulsing: true } : p)
    : aerialHomePlayers;
  const expertAwayPlayers = viewMode === 'expert' && matchStarted
    ? aerialAwayPlayers.map(p => expertBallAnim.pulsingId === p.playerId ? { ...p, _pulsing: true } : p)
    : aerialAwayPlayers;

  return (
    <div
      className="fixed inset-0 z-[200] bg-[#050505] flex flex-col"
      style={{
        touchAction: 'none',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
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
        @keyframes expertPulse {
          0%   { r: 18; opacity: 0.85; }
          100% { r: 32; opacity: 0; }
        }
      `}</style>

      {/* ── Header editorial Legacy Tech ── */}
      <LegacyEditorialHeader
        homeName={homeName}
        awayName={awayName}
        homeScore={engine.homeScore}
        awayScore={engine.awayScore}
        minute={engine.minute}
        possession={engine.possession}
        phase={displayPhase}
        formation={formation}
        onFormationChange={setFormation}
        onExit={() => setShowExitConfirm(true)}
        viewMode={viewMode}
        onViewModeChange={(m) => {
          setViewMode(m);
          setCamera(m === 'expert' ? 'broadcast' : 'aerial');
        }}
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

      {/* ── Campo — flex-1 in aerial, constrained in expert ── */}
      <div
        className={`${viewMode === 'expert' ? '' : 'flex-1'} min-h-0 min-w-0 flex flex-col items-stretch justify-end overflow-hidden relative`}
        style={viewMode === 'expert' ? { height: '32vh', flexShrink: 0 } : undefined}
        onClickCapture={() => { if (legacyBannerVisible) setLegacyBannerVisible(false); }}
      >
        {/* ── Legacy Skill Banner — canto superior esquerdo ── */}
        <AnimatePresence>
          {legacyBannerVisible && engine.activatedSkills.length > 0 && (
            <motion.div
              key="legacy-banner"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              style={{ position: 'absolute', left: 16, top: 16, zIndex: 110, pointerEvents: 'none' }}
            >
              <LegacySkillBanner
                entries={engine.activatedSkills.map((s) => ({ playerId: s.playerId, skillId: s.skillId }))}
                players={engine.homePlayers}
                highlightIndex={legacyHighlightIdx}
                legendName={legacyDominantLegendName}
                buffDurationSec={legacyBuffDurationSec}
                sessionsCompleted={legacyTotalSessions > 0 ? legacyTotalSessions : undefined}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <div
          ref={cameraRef}
          className="relative w-full h-full flex flex-col items-stretch justify-end min-h-0"
          style={{
            transformOrigin: '50% 50%',
            willChange: 'transform',
          }}
        >
          <FieldView
            homePlayers={viewMode === 'expert' ? expertHomePlayers : engine.homePlayers}
            awayPlayers={viewMode === 'expert' ? expertAwayPlayers : engine.awayPlayers}
            ballX={displayBallX}
            ballY={displayBallY}
            onBallPlayerId={engine.onBallPlayerId}
            cameraMode={viewMode === 'expert' ? 'broadcast' : camera}
            homeShort={homeShort}
            awayShort={awayShort}
            homeName={homeName}
            homeCrestUrl={favoriteRealTeam?.logo ?? null}
            homeScore={engine.homeScore}
            awayScore={engine.awayScore}
            matchMinute={engine.minute}
            possession={engine.possession}
            phase={displayPhase}
            showCameraSwitch={viewMode !== 'expert'}
            hideHud={true}
            playerTransition={viewMode === 'expert' ? playerTransition : false}
            defensiveAction={cinematicAction}
            passLine={viewMode === 'expert' && matchStarted ? expertBallAnim.passLine : null}
            onCameraChange={(m) => setCamera(m as 'aerial' | 'broadcast' | 'firstperson')}
            onPlayerClick={(p) => {
              setBrainPlayer(p);
              window.setTimeout(() => setBrainPlayer(null), 4000);
            }}
            className="w-full"
          />

          {/* ── Cerimônia de abertura: botão Apitar ── */}
          {engine.phase === 'pregame' && engine.legacyModeActive && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <button
                className="pointer-events-auto bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-bold px-8 py-4 rounded-full text-lg shadow-2xl transition-colors"
                onClick={() => engine.startMatch()}
                aria-label="Apitar início da partida"
              >
                ▶ Apitar
              </button>
            </div>
          )}

          {/* ── PressureZoneOverlay — zonas de tensão ── */}
          {viewMode !== 'expert' && (
            <PressureZoneOverlay
              ballX={engine.ballX}
              possession={engine.possession}
              phase={displayPhase}
            />
          )}

          {/* ── PlayerBrainCard — inteligência do jogador ── */}
          {brainPlayer && (
            <PlayerBrainCard
              player={brainPlayer}
              onClose={() => setBrainPlayer(null)}
              onSubstitute={benchPlayers.length > 0 ? (pid) => {
                const onPitch = homeXI.find((p) => p.playerId === pid);
                if (onPitch) setSubPickerOut(onPitch);
                setBrainPlayer(null);
              } : undefined}
            />
          )}
        </div>

        {/* ── Watermark do minuto (ambient) — only in aerial ── */}
        {viewMode !== 'expert' && (
          <LegacyMinuteWatermark
            minute={engine.minute}
            phase={displayPhase}
            momentLabel={engine.lastEvent === 'goal' ? 'GOL' : engine.ballX > 70 ? 'ATAQUE' : engine.ballX < 30 ? 'DEFESA' : 'BOLA ROLANDO'}
            possessionPct={engine.possessionPct}
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
          expertBars={engine.expertBars}
          homePlayers={engine.homePlayers}
          minute={engine.minute}
        />
      )}

      {/* Spacer para FalePlayerBar fixa não cobrir o campo */}
      <div aria-hidden style={{ height: 110, flexShrink: 0 }} />

      {/* ── Substitute Picker ── */}
      {subPickerOut && (
        <SubstitutePickerModal
          outgoing={subPickerOut}
          bench={benchPlayers}
          onClose={() => setSubPickerOut(null)}
          onPick={(inId) => {
            const result = applySubstitutionLocal(subPickerOut.playerId, inId);
            setSubToast({ ok: result.ok, text: result.message });
            setSubPickerOut(null);
          }}
        />
      )}

      {/* ── Toast feedback de substituição ── */}
      {subToast && (
        <div
          style={{
            position: 'fixed',
            top: 84,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 250,
            background: '#0D0D0D',
            border: `1px solid ${subToast.ok ? 'rgba(253,225,0,0.45)' : 'rgba(239,68,68,0.55)'}`,
            borderLeft: `3px solid ${subToast.ok ? '#FDE100' : '#EF4444'}`,
            padding: '10px 16px',
            fontFamily: 'var(--font-serif-hero)',
            fontStyle: 'italic',
            fontSize: 14,
            color: '#fff',
            boxShadow: '0 12px 36px rgba(0,0,0,0.55)',
            pointerEvents: 'none',
          }}
        >
          {subToast.text}
        </div>
      )}

      {/* ── FALE COM OS JOGADORES — fixo no rodapé absoluto ── */}
      <FalePlayerBar
        players={engine.homePlayers}
        ballCarrierId={engine.onBallPlayerId}
        minute={engine.minute}
        playersById={engine.playersById}
        onSubstituteByName={substituteByName}
        legacyActive={engine.legacyModeActive}
        onLegacyToggle={() => {
          // Se Legacy já está ativo e o banner foi dismissado, apenas re-exibe.
          if (engine.legacyModeActive && !legacyBannerVisible && engine.activatedSkills.length > 0) {
            setLegacyBannerVisible(true);
            setLegacyHighlightIdx(0);
            return { active: true, activated: engine.activatedSkills.length, buffDurationSec: legacyBuffDurationSec };
          }
          const result = engine.toggleLegacyMode();
          if (result.active) setLegacyBuffDurationSec(result.buffDurationSec);
          return result;
        }}
        onSkillCommand={(playerId, skillId) => {
          if (playerId) return engine.applySkillToPlayer(playerId, skillId);
          // team-wide: ativa skill em todos jogadores que têm equipada
          let count = 0;
          let lastMessage = '';
          for (const p of engine.homePlayers) {
            const equipped = engine.playersById[p.playerId]?.skills ?? [];
            if (!equipped.includes(skillId)) continue;
            const r = engine.applySkillToPlayer(p.playerId, skillId);
            if (r.ok) count++;
            lastMessage = r.message;
          }
          return count > 0
            ? { ok: true, message: `${count} jogador(es) ativaram ${skillId}` }
            : { ok: false, message: lastMessage || `Ninguém tem ${skillId} equipada` };
        }}
      />
    </div>
  );
}
