/**
 * Sistema de Replay de Partidas
 * Salva log causal completo e permite assistir depois
 */

import type { CausalMatchEvent } from '@/match/causal/matchCausalTypes';
import type { PossessionSide } from '@/engine/types';

export interface MatchReplayData {
  id: string;
  timestamp: number;
  homeTeam: string;
  awayTeam: string;
  finalScore: { home: number; away: number };
  duration: number; // minutos
  events: CausalMatchEvent[];
  metadata: {
    homeRoster: any[];
    awayRoster: any[];
    formation: string;
    tacticalStyle?: any;
  };
}

export interface ReplayPlayerState {
  currentEventIndex: number;
  isPlaying: boolean;
  speed: 1 | 2 | 4 | 8;
  currentMinute: number;
  currentScore: { home: number; away: number };
  currentPossession: PossessionSide;
}

const REPLAY_STORAGE_KEY = 'olefoot_match_replays';
const MAX_REPLAYS = 20;

export class MatchReplayManager {
  /**
   * Salva replay no localStorage
   */
  static saveReplay(data: MatchReplayData): void {
    try {
      const existing = this.getAllReplays();
      existing.unshift(data);

      // Mantém apenas os últimos MAX_REPLAYS
      const trimmed = existing.slice(0, MAX_REPLAYS);

      localStorage.setItem(REPLAY_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (error) {
      console.error('Failed to save replay:', error);
    }
  }

  /**
   * Carrega todos os replays salvos
   */
  static getAllReplays(): MatchReplayData[] {
    try {
      const raw = localStorage.getItem(REPLAY_STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to load replays:', error);
      return [];
    }
  }

  /**
   * Carrega replay específico por ID
   */
  static getReplay(id: string): MatchReplayData | null {
    const all = this.getAllReplays();
    return all.find((r) => r.id === id) || null;
  }

  /**
   * Deleta replay
   */
  static deleteReplay(id: string): void {
    try {
      const all = this.getAllReplays();
      const filtered = all.filter((r) => r.id !== id);
      localStorage.setItem(REPLAY_STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to delete replay:', error);
    }
  }

  /**
   * Limpa todos os replays
   */
  static clearAll(): void {
    localStorage.removeItem(REPLAY_STORAGE_KEY);
  }

  /**
   * Exporta replay como JSON para download
   */
  static exportReplay(id: string): void {
    const replay = this.getReplay(id);
    if (!replay) return;

    const blob = new Blob([JSON.stringify(replay, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `olefoot-replay-${replay.homeTeam}-vs-${replay.awayTeam}-${replay.timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Importa replay de arquivo JSON
   */
  static async importReplay(file: File): Promise<MatchReplayData | null> {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as MatchReplayData;

      // Validação básica
      if (!data.id || !data.events || !Array.isArray(data.events)) {
        throw new Error('Invalid replay format');
      }

      this.saveReplay(data);
      return data;
    } catch (error) {
      console.error('Failed to import replay:', error);
      return null;
    }
  }
}

/**
 * Hook para controlar player de replay
 */
import { useState, useCallback, useRef, useEffect } from 'react';

export function useReplayPlayer(replayData: MatchReplayData | null) {
  const [state, setState] = useState<ReplayPlayerState>({
    currentEventIndex: 0,
    isPlaying: false,
    speed: 1,
    currentMinute: 0,
    currentScore: { home: 0, away: 0 },
    currentPossession: 'home',
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const play = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: true }));
  }, []);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: false }));
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const setSpeed = useCallback((speed: 1 | 2 | 4 | 8) => {
    setState((prev) => ({ ...prev, speed }));
  }, []);

  const seekToEvent = useCallback((index: number) => {
    if (!replayData) return;

    const clampedIndex = Math.max(0, Math.min(index, replayData.events.length - 1));
    const event = replayData.events[clampedIndex];

    if (!event) return;

    // Recalcula estado até este evento
    let homeScore = 0;
    let awayScore = 0;
    let possession: PossessionSide = 'home';

    for (let i = 0; i <= clampedIndex; i++) {
      const e = replayData.events[i];
      if (!e) continue;

      if (e.kind === 'goal_home') homeScore++;
      if (e.kind === 'goal_away') awayScore++;
      if (e.type === 'possession_change') {
        possession = (e.payload as any)?.to || possession;
      }
    }

    setState({
      currentEventIndex: clampedIndex,
      isPlaying: false,
      speed: state.speed,
      currentMinute: (event as any).minute || 0,
      currentScore: { home: homeScore, away: awayScore },
      currentPossession: possession,
    });
  }, [replayData, state.speed]);

  const seekToMinute = useCallback((minute: number) => {
    if (!replayData) return;

    const index = replayData.events.findIndex((e) => (e as any).minute >= minute);
    if (index !== -1) {
      seekToEvent(index);
    }
  }, [replayData, seekToEvent]);

  const reset = useCallback(() => {
    seekToEvent(0);
  }, [seekToEvent]);

  // Loop de playback
  useEffect(() => {
    if (!state.isPlaying || !replayData) return;

    const msPerEvent = 1000 / state.speed;

    intervalRef.current = setInterval(() => {
      setState((prev) => {
        const nextIndex = prev.currentEventIndex + 1;

        if (nextIndex >= replayData.events.length) {
          // Fim do replay
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return { ...prev, isPlaying: false };
        }

        const event = replayData.events[nextIndex];
        if (!event) return prev;

        let newScore = { ...prev.currentScore };
        let newPossession = prev.currentPossession;

        if (event.kind === 'goal_home') newScore.home++;
        if (event.kind === 'goal_away') newScore.away++;
        // possession_change não existe em MatchEventEntry.kind, removendo
        // if (event.kind === 'possession_change') {
        //   newPossession = (event.payload as any)?.to || newPossession;
        // }

        return {
          ...prev,
          currentEventIndex: nextIndex,
          currentMinute: (event as any).minute || prev.currentMinute,
          currentScore: newScore,
          currentPossession: newPossession,
        };
      });
    }, msPerEvent);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.isPlaying, state.speed, replayData]);

  const currentEvent = replayData?.events[state.currentEventIndex] || null;

  return {
    state,
    currentEvent,
    play,
    pause,
    setSpeed,
    seekToEvent,
    seekToMinute,
    reset,
    totalEvents: replayData?.events.length || 0,
    progress: replayData ? state.currentEventIndex / replayData.events.length : 0,
  };
}
