/**
 * useAgentsFieldSim
 *
 * Hook que roda o TeamSimulator dos agentes autônomos para o /match/legacy.
 * Recebe o lineup real do store (PitchPlayerState[]) e devolve posições
 * interpoladas prontas para o FieldView.
 *
 * - Sim: 6fps (stepSimulator)
 * - Render: 16fps com lerp entre frames
 * - Possession sincronizada com o engine legacy (TacticalSimLoop)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PitchPlayerState } from '@/engine/types';
import { stepSimulator, resetContexts, type SimulatorState } from '../../agents/sim/TeamSimulator';
import { loadMatchBriefings } from '../../agents/context/PreMatchAgentLoader';
import { loadTeamFieldKnowledge } from '../../agents/fieldKnowledge/FieldKnowledgeLoader';
import { teamToAgents } from '../../agents/bridge/pitchPlayerToAgent';
import type { PlayerAgentState } from '../../agents/core/PlayerAgent';

const SIM_MS    = 1000 / 6;   // ~167ms — 6fps sim
const RENDER_MS = 1000 / 16;  // ~62ms  — 16fps render

function lerp(a: number, b: number, t: number) {
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

function agentToPitch(a: PlayerAgentState, ref: PitchPlayerState): PitchPlayerState {
  // Agentes: x=depth(0-100), y=width(0-100)
  // FieldView: p.x=width(0-100), p.y=depth(0-100) — eixos trocados
  return { ...ref, x: a.currentPosition.y, y: a.currentPosition.x };
}

export interface AgentsSimFrame {
  homePlayers: PitchPlayerState[];
  awayPlayers: PitchPlayerState[];
  ballX: number;
  ballY: number;
  onBallPlayerId: string | undefined;
  possession: 'home' | 'away';
}

export function useAgentsFieldSim(
  homeXI: PitchPlayerState[],
  awayXI: PitchPlayerState[],
  _playing: boolean,  // reservado para pausa futura (halftime/fulltime)
  externalPossession: 'home' | 'away',
): AgentsSimFrame {
  // Refs para o loop — evita re-renders desnecessários
  const simRef      = useRef<SimulatorState | null>(null);
  const rafRef      = useRef<number>(0);
  const lastSimRef  = useRef<number>(performance.now());
  const lastRenRef  = useRef<number>(performance.now());
  const tickRef     = useRef<number>(0);
  const possRef     = useRef(externalPossession);

  // Refs dos lineups para o loop sem stale closure
  const homeXIRef = useRef(homeXI);
  const awayXIRef = useRef(awayXI);

  useEffect(() => { homeXIRef.current = homeXI; }, [homeXI]);
  useEffect(() => { awayXIRef.current = awayXI; }, [awayXI]);
  useEffect(() => { possRef.current = externalPossession; }, [externalPossession]);

  // Frame interpolado exposto ao componente
  const [frame, setFrame] = useState<AgentsSimFrame>(() => ({
    homePlayers: homeXI,
    awayPlayers: awayXI,
    ballX: 50,
    ballY: 50,
    onBallPlayerId: undefined,
    possession: externalPossession,
  }));

  // Refs dos dois frames para interpolação
  const prevFrameRef = useRef<AgentsSimFrame>({
    homePlayers: homeXI, awayPlayers: awayXI,
    ballX: 50, ballY: 50, onBallPlayerId: undefined, possession: externalPossession,
  });
  const nextFrameRef = useRef<AgentsSimFrame>({ ...prevFrameRef.current });

  // Inicializa o SimulatorState a partir do lineup real
  const initSim = useCallback(() => {
    const home = homeXIRef.current;
    // Bug 2 fix: away pode ser vazio (sem fixture) — cria fallback espelhado do home
    const away = awayXIRef.current.length > 0
      ? awayXIRef.current
      : home.map(p => ({
          ...p,
          playerId: `away_${p.playerId}`,
          x: 100 - p.x,
          y: 100 - p.y,
        }));

    if (home.length === 0) return;

    const homeAgentsRaw = teamToAgents(home, 'home');
    const awayAgentsRaw = teamToAgents(away, 'away');

    // Aplica briefings táticos e field knowledge
    const { home: homeBriefed, away: awayBriefed } = loadMatchBriefings(
      { id: 'home', name: 'Home', players: homeAgentsRaw },
      { id: 'away', name: 'Away', players: awayAgentsRaw },
      true,
    );
    const homeFK = loadTeamFieldKnowledge(homeBriefed.players, 'home');
    const awayFK = loadTeamFieldKnowledge(awayBriefed.players, 'away');

    resetContexts();

    simRef.current = {
      homePlayers:      homeFK,
      awayPlayers:      awayFK,
      ballPosition:     { x: 50, y: 50 },
      ballCarrierId:    homeFK.find(p => p.position === 'ST_L')?.id ?? null,
      possession:       possRef.current,
      carrierTickCount: 0,
    };
  }, []);

  // Inicializa quando o lineup home chega — away pode ser vazio (usa fallback)
  useEffect(() => {
    if (homeXI.length > 0) initSim();
  }, [homeXI.length, initSim]);

  // Re-inicializa quando away chega depois do home
  useEffect(() => {
    if (homeXI.length > 0 && awayXI.length > 0) initSim();
  }, [awayXI.length, homeXI.length, initSim]);

  // Sincroniza possession externa → sim
  useEffect(() => {
    if (!simRef.current) return;
    simRef.current = { ...simRef.current, possession: externalPossession };
  }, [externalPossession]);

  // Bug 3 fix: sim roda sempre (pregame + playing) — não só quando playing=true
  // Isso garante que as posições estão prontas quando o jogo começa.
  // O FieldViewPreview já filtra via matchStarted para decidir o que mostrar.
  useEffect(() => {
    const loop = (now: number) => {
      if (simRef.current) {
        // ── Sim step a 6fps ──────────────────────────────────────────────────
        if (now - lastSimRef.current >= SIM_MS) {
          lastSimRef.current = now;
          tickRef.current += 1;

          const result = stepSimulator(simRef.current, tickRef.current);
          simRef.current = result;

          const home = homeXIRef.current;
          const away = awayXIRef.current.length > 0
            ? awayXIRef.current
            : home.map(p => ({ ...p, playerId: `away_${p.playerId}`, x: 100 - p.x, y: 100 - p.y }));

          prevFrameRef.current = nextFrameRef.current;
          nextFrameRef.current = {
            homePlayers: result.homePlayers.map((a, i) =>
              agentToPitch(a, home[i] ?? home[0]!),
            ),
            awayPlayers: result.awayPlayers.map((a, i) =>
              agentToPitch(a, away[i] ?? away[0]!),
            ),
            ballX: result.ballPosition.y, // agente y=width → FieldView ballX=width
            ballY: result.ballPosition.x, // agente x=depth → FieldView ballY=depth
            onBallPlayerId: result.ballCarrierId ?? undefined,
            possession: result.possession ?? possRef.current,
          };
        }

        // ── Render a 16fps com lerp ──────────────────────────────────────────
        if (now - lastRenRef.current >= RENDER_MS) {
          lastRenRef.current = now;
          const prev = prevFrameRef.current;
          const next = nextFrameRef.current;
          const elapsed = now - lastSimRef.current;
          const t = Math.min(1, elapsed / SIM_MS);

          setFrame({
            ...next,
            homePlayers: lerpPlayers(prev.homePlayers, next.homePlayers, t),
            awayPlayers: lerpPlayers(prev.awayPlayers, next.awayPlayers, t),
            ballX: lerp(prev.ballX, next.ballX, t),
            ballY: lerp(prev.ballY, next.ballY, t),
          });
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return frame;
}
