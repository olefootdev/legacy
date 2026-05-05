/**
 * /dev/agents-field
 *
 * Campo vertical Legacy alimentado pelo novo sistema de agentes isolado.
 * Roda TeamSimulator a 24fps — zero dependência do engine existente.
 *
 * Stack completo:
 *   create442Team → loadMatchBriefings → loadTeamFieldKnowledge
 *   → stepSimulator (MatchFieldContext + queryForAgent + TerritoryRules)
 *   → MovementBridge → FieldView
 */
import { useEffect, useRef, useState } from 'react';
import { FieldView } from '@/components/match/FieldView';
import type { PitchPlayerState } from '@/engine/types';
import { create442Team }          from '../../agents/team/create442Team';
import { create442TeamAway }      from '../../agents/team/create442TeamAway';
import { loadMatchBriefings }     from '../../agents/context/PreMatchAgentLoader';
import { loadTeamFieldKnowledge } from '../../agents/fieldKnowledge/FieldKnowledgeLoader';
import { stepSimulator, resetContexts, type SimulatorState } from '../../agents/sim/TeamSimulator';
import type { PlayerAgentState } from '../../agents/core/PlayerAgent';
import { POSITION_BEHAVIORS } from '../../agents/knowledge/TacticaDoZero';

// ── Adapter: PlayerAgentState → PitchPlayerState ──────────────────────────────

const POS_MAP: Record<string, string> = {
  GK: 'GK', CB_L: 'CB', CB_R: 'CB', LB: 'LB', RB: 'RB',
  LM: 'LM', CM_L: 'CM', CM_R: 'CM', RM: 'RM', ST_L: 'ST', ST_R: 'ST',
};
const ROLE_MAP: Record<string, 'gk' | 'def' | 'mid' | 'attack'> = {
  GK: 'gk',
  CB_L: 'def', CB_R: 'def', LB: 'def', RB: 'def',
  LM: 'mid', CM_L: 'mid', CM_R: 'mid', RM: 'mid',
  ST_L: 'attack', ST_R: 'attack',
};

function toPitch(agent: PlayerAgentState, num: number): PitchPlayerState {
  return {
    playerId: agent.id,
    slotId:   agent.position.toLowerCase(),
    name:     agent.id.split('_').slice(1).join('_').toUpperCase(),
    num,
    pos:      POS_MAP[agent.position] ?? agent.position,
    role:     ROLE_MAP[agent.position] ?? 'mid',
    x:        agent.currentPosition.x,
    y:        agent.currentPosition.y,
    heading:  0,
    fatigue:  100 - agent.stamina,
  };
}

// ── Initial sim state (with full context stack) ───────────────────────────────

function buildInitial(): SimulatorState {
  const homeRaw = create442Team('home', 'Olefoot FC');
  const awayRaw = create442TeamAway('away', 'Rival SC');

  // Layer 1: tactical identity briefing
  const { home: homeBriefed, away: awayBriefed } = loadMatchBriefings(homeRaw, awayRaw, true);

  // Layer 2: field knowledge (territories + zones)
  const homeFK = loadTeamFieldKnowledge(homeBriefed.players, 'home');
  const awayFK = loadTeamFieldKnowledge(awayBriefed.players, 'away');

  // Reset MatchFieldContext for fresh simulation
  resetContexts();

  return {
    homePlayers:   homeFK,
    awayPlayers:   awayFK,
    ballPosition:  { x: 50, y: 50 },
    ballCarrierId: homeFK.find(p => p.position === 'ST_L')?.id ?? null,
    possession:    'home',
    carrierTickCount: 0,
  };
}

// ── Interpolation helpers ─────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPlayers(
  from: PitchPlayerState[],
  to: PitchPlayerState[],
  t: number,
): PitchPlayerState[] {
  return to.map((p, i) => {
    const f = from[i];
    if (!f) return p;
    return { ...p, x: lerp(f.x, p.x, t), y: lerp(f.y, p.y, t) };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SimFrame {
  homePlayers: PitchPlayerState[];
  awayPlayers: PitchPlayerState[];
  ball: { x: number; y: number };
  carrierId: string | null;
  possession: 'home' | 'away';
  phase: string;
  tick: number;
}

const SIM_FPS    = 6;
const SIM_MS     = 1000 / SIM_FPS;   // ~167ms between sim steps
const RENDER_MS  = 1000 / 16;        // ~62ms between renders (16fps)

export function AgentsFieldView() {
  const simRef     = useRef<SimulatorState>(buildInitial());
  const rafRef     = useRef<number>(0);
  const lastSimRef = useRef<number>(performance.now());
  const lastRenRef = useRef<number>(performance.now());
  const tickRef    = useRef<number>(0);

  // Two sim frames: prev and next — render interpolates between them
  const prevFrameRef = useRef<SimFrame | null>(null);
  const nextFrameRef = useRef<SimFrame | null>(null);

  const [frame, setFrame] = useState<SimFrame>(() => {
    const f: SimFrame = {
      homePlayers: simRef.current.homePlayers.map((a, i) => toPitch(a, i + 1)),
      awayPlayers: simRef.current.awayPlayers.map((a, i) => toPitch(a, i + 1)),
      ball: { x: 50, y: 50 },
      carrierId: null,
      possession: 'home',
      phase: '—',
      tick: 0,
    };
    prevFrameRef.current = f;
    nextFrameRef.current = f;
    return f;
  });

  useEffect(() => {
    const loop = (now: number) => {
      // ── Sim step at SIM_FPS ──────────────────────────────────────────────
      if (now - lastSimRef.current >= SIM_MS) {
        lastSimRef.current = now;
        tickRef.current += 1;

        simRef.current = stepSimulator(simRef.current, tickRef.current);
        const s = simRef.current;
        const q = s.homePlayers[0]?.lastFieldQuery;

        prevFrameRef.current = nextFrameRef.current;
        nextFrameRef.current = {
          homePlayers: s.homePlayers.map((a, i) => toPitch(a, i + 1)),
          awayPlayers: s.awayPlayers.map((a, i) => toPitch(a, i + 1)),
          ball: { ...s.ballPosition },
          carrierId: s.ballCarrierId,
          possession: s.possession ?? 'home',
          phase: q ? q.phase : '—',
          tick: tickRef.current,
        };
      }

      // ── Render at RENDER_FPS with interpolation ──────────────────────────
      if (now - lastRenRef.current >= RENDER_MS) {
        lastRenRef.current = now;

        const prev = prevFrameRef.current;
        const next = nextFrameRef.current;

        if (prev && next) {
          // t: how far we are between prev and next sim frames (0–1)
          const elapsed = now - lastSimRef.current;
          const t = Math.min(1, elapsed / SIM_MS);

          setFrame({
            ...next,
            homePlayers: lerpPlayers(prev.homePlayers, next.homePlayers, t),
            awayPlayers: lerpPlayers(prev.awayPlayers, next.awayPlayers, t),
            ball: {
              x: lerp(prev.ball.x, next.ball.x, t),
              y: lerp(prev.ball.y, next.ball.y, t),
            },
          });
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const { homePlayers, awayPlayers, ball, carrierId, tick, possession, phase } = frame;

  return (
    <div style={{ background: '#050505', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        width: '100%', maxWidth: 720, padding: '12px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid rgba(253,225,0,0.15)',
      }}>
        <span style={{ color: '#FDE100', fontFamily: 'Oswald, sans-serif', fontSize: 13, letterSpacing: 2 }}>
          AGENTS FIELD — 4-4-2 vs 4-4-2
        </span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 11 }}>
          tick {tick} · {possession === 'home' ? '🟡 HOME' : '⚪ AWAY'} · {phase}
        </span>
      </div>

      <div style={{ width: '100%', maxWidth: 720, flex: 1 }}>
        <FieldView
          homePlayers={homePlayers}
          awayPlayers={awayPlayers}
          ballX={ball.x}
          ballY={ball.y}
          onBallPlayerId={carrierId ?? undefined}
          cameraMode="firstperson"
          highlightPlayerId={carrierId ?? null}
        />
      </div>

      <div style={{
        width: '100%', maxWidth: 720, padding: '10px 16px',
        display: 'flex', gap: 24, flexWrap: 'wrap',
        borderTop: '1px solid rgba(253,225,0,0.1)',
      }}>
        <span style={{ color: '#FDE100', fontSize: 11, fontFamily: 'Oswald, sans-serif' }}>■ HOME</span>
        <span style={{ color: '#ffffff', fontSize: 11, fontFamily: 'Oswald, sans-serif' }}>■ AWAY</span>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: 'monospace' }}>
          home attacks → x=100 · away attacks → x=0
        </span>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: 'monospace' }}>
          carrier: {carrierId ?? 'loose'}
        </span>
      </div>
    </div>
  );
}

