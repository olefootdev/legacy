/**
 * Integração com Supabase Realtime para Match Global
 *
 * Sincroniza eventos de rodada em tempo real entre múltiplos usuários.
 */

import { getSupabase } from '@/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  GlobalRound,
  GlobalMatchEvent,
  GlobalHighlight,
  CoachCommands,
} from './globalMatch';

export type GlobalRealtimeEventType =
  | 'round_started'
  | 'round_finished'
  | 'match_event'
  | 'highlight'
  | 'commands_set'
  | 'round_status_changed';

export interface GlobalRealtimeMessage {
  type: GlobalRealtimeEventType;
  roundId: string;
  timestamp: number;
  payload: unknown;
}

export interface RoundStartedPayload {
  round: GlobalRound;
}

export interface RoundFinishedPayload {
  roundId: string;
  finishedAtMs: number;
}

export interface MatchEventPayload {
  event: GlobalMatchEvent;
}

export interface HighlightPayload {
  highlight: GlobalHighlight;
}

export interface CommandsSetPayload {
  fixtureId: string;
  clubId: string;
  side: 'home' | 'away';
  commands: CoachCommands;
}

export interface RoundStatusChangedPayload {
  roundId: string;
  status: GlobalRound['status'];
}

/**
 * Cliente Realtime para Match Global
 */
export class GlobalMatchRealtimeClient {
  private channel: RealtimeChannel | null = null;
  private listeners: Map<GlobalRealtimeEventType, Set<(payload: unknown) => void>> = new Map();

  /**
   * Conecta ao canal de broadcast da rodada
   */
  connect(roundId: string): boolean {
    const sb = getSupabase();
    if (!sb) {
      console.warn('[GlobalMatchRealtime] Supabase não configurado');
      return false;
    }

    // Desconectar canal anterior se existir
    this.disconnect();

    // Criar canal para a rodada
    this.channel = sb.channel(`global_match:${roundId}`, {
      config: {
        broadcast: { self: true },
      },
    });

    // Escutar eventos de broadcast
    this.channel.on('broadcast', { event: 'global_event' }, ({ payload }) => {
      this.handleBroadcast(payload as GlobalRealtimeMessage);
    });

    // Subscrever
    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[GlobalMatchRealtime] Conectado ao canal: ${roundId}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[GlobalMatchRealtime] Erro ao conectar ao canal');
      }
    });

    return true;
  }

  /**
   * Desconecta do canal atual
   */
  disconnect() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
      console.log('[GlobalMatchRealtime] Desconectado');
    }
  }

  /**
   * Envia evento para o canal
   */
  async broadcast(message: GlobalRealtimeMessage): Promise<boolean> {
    if (!this.channel) {
      console.warn('[GlobalMatchRealtime] Canal não conectado');
      return false;
    }

    const status = await this.channel.send({
      type: 'broadcast',
      event: 'global_event',
      payload: message,
    });

    if (status !== 'ok') {
      console.error('[GlobalMatchRealtime] Falha ao enviar broadcast:', status);
      return false;
    }

    return true;
  }

  /**
   * Registra listener para tipo de evento
   */
  on(eventType: GlobalRealtimeEventType, callback: (payload: unknown) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);
  }

  /**
   * Remove listener
   */
  off(eventType: GlobalRealtimeEventType, callback: (payload: unknown) => void) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Processa mensagem recebida
   */
  private handleBroadcast(message: GlobalRealtimeMessage) {
    const listeners = this.listeners.get(message.type);
    if (listeners) {
      listeners.forEach((callback) => callback(message.payload));
    }
  }

  /**
   * Helpers para enviar eventos específicos
   */

  async broadcastRoundStarted(round: GlobalRound): Promise<boolean> {
    return this.broadcast({
      type: 'round_started',
      roundId: round.id,
      timestamp: Date.now(),
      payload: { round } as RoundStartedPayload,
    });
  }

  async broadcastRoundFinished(roundId: string, finishedAtMs: number): Promise<boolean> {
    return this.broadcast({
      type: 'round_finished',
      roundId,
      timestamp: Date.now(),
      payload: { roundId, finishedAtMs } as RoundFinishedPayload,
    });
  }

  async broadcastMatchEvent(event: GlobalMatchEvent): Promise<boolean> {
    return this.broadcast({
      type: 'match_event',
      roundId: event.fixtureId.split('_')[0] ?? '',
      timestamp: Date.now(),
      payload: { event } as MatchEventPayload,
    });
  }

  async broadcastHighlight(highlight: GlobalHighlight): Promise<boolean> {
    return this.broadcast({
      type: 'highlight',
      roundId: highlight.fixtureId.split('_')[0] ?? '',
      timestamp: Date.now(),
      payload: { highlight } as HighlightPayload,
    });
  }

  async broadcastCommandsSet(
    roundId: string,
    fixtureId: string,
    clubId: string,
    side: 'home' | 'away',
    commands: CoachCommands,
  ): Promise<boolean> {
    return this.broadcast({
      type: 'commands_set',
      roundId,
      timestamp: Date.now(),
      payload: { fixtureId, clubId, side, commands } as CommandsSetPayload,
    });
  }

  async broadcastRoundStatusChanged(
    roundId: string,
    status: GlobalRound['status'],
  ): Promise<boolean> {
    return this.broadcast({
      type: 'round_status_changed',
      roundId,
      timestamp: Date.now(),
      payload: { roundId, status } as RoundStatusChangedPayload,
    });
  }
}

/**
 * Instância singleton do cliente Realtime
 */
let realtimeClientInstance: GlobalMatchRealtimeClient | undefined;

export function getGlobalRealtimeClient(): GlobalMatchRealtimeClient {
  if (!realtimeClientInstance) {
    realtimeClientInstance = new GlobalMatchRealtimeClient();
  }
  return realtimeClientInstance;
}

/**
 * Hook React para usar Realtime no Match Global
 */
export function useGlobalMatchRealtime(
  roundId: string | undefined,
  handlers: Partial<Record<GlobalRealtimeEventType, (payload: unknown) => void>>,
) {
  const client = getGlobalRealtimeClient();

  // Conectar/desconectar quando roundId muda
  if (roundId) {
    client.connect(roundId);

    // Registrar handlers
    Object.entries(handlers).forEach(([type, handler]) => {
      if (handler) {
        client.on(type as GlobalRealtimeEventType, handler);
      }
    });

    // Cleanup
    return () => {
      Object.entries(handlers).forEach(([type, handler]) => {
        if (handler) {
          client.off(type as GlobalRealtimeEventType, handler);
        }
      });
      client.disconnect();
    };
  }

  return () => {};
}

// Funções saveGlobalRound / loadGlobalRound / loadRecentGlobalRounds removidas.
// A tabela `global_rounds` nunca existiu no schema. Rodadas são persistidas
// nas tabelas relacionais global_league_rounds / global_league_fixtures pela
// Edge Function global-league-tick. Use loadGlobalLeagueFromSupabase() para
// hidratar o estado completo.
