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

/**
 * Persistência de rodadas no Supabase
 */

export interface GlobalRoundRecord {
  id: string;
  round_number: number;
  status: GlobalRound['status'];
  scheduled_kickoff_ms: number;
  actual_kickoff_ms?: number;
  finished_at_ms?: number;
  duration_ms: number;
  fixtures: unknown; // JSON
  highlights: unknown; // JSON
  created_at: string;
  updated_at: string;
}

/**
 * Salva rodada no Supabase
 */
export async function saveGlobalRound(round: GlobalRound): Promise<{ ok: true } | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase não configurado' };

  try {
    const record: Partial<GlobalRoundRecord> = {
      id: round.id,
      round_number: round.roundNumber,
      status: round.status,
      scheduled_kickoff_ms: round.scheduledKickoffMs,
      actual_kickoff_ms: round.actualKickoffMs,
      finished_at_ms: round.finishedAtMs,
      duration_ms: round.durationMs,
      fixtures: round.fixtures as unknown,
      highlights: round.highlights as unknown,
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb.from('global_rounds').upsert(record as never);

    if (error) return { error: error.message };
    return { ok: true };
  } catch (err) {
    return { error: String(err) };
  }
}

/**
 * Carrega rodada do Supabase
 */
export async function loadGlobalRound(roundId: string): Promise<GlobalRound | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from('global_rounds')
      .select('*')
      .eq('id', roundId)
      .maybeSingle();

    if (error || !data) return null;

    const record = data as GlobalRoundRecord;

    return {
      id: record.id,
      roundNumber: record.round_number,
      status: record.status,
      scheduledKickoffMs: record.scheduled_kickoff_ms,
      actualKickoffMs: record.actual_kickoff_ms,
      finishedAtMs: record.finished_at_ms,
      durationMs: record.duration_ms,
      fixtures: record.fixtures as GlobalRound['fixtures'],
      highlights: record.highlights as GlobalRound['highlights'],
    };
  } catch {
    return null;
  }
}

/**
 * Carrega rodadas recentes do Supabase
 */
export async function loadRecentGlobalRounds(limit = 5): Promise<GlobalRound[]> {
  const sb = getSupabase();
  if (!sb) return [];

  try {
    const { data, error } = await sb
      .from('global_rounds')
      .select('*')
      .order('round_number', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((record: GlobalRoundRecord) => ({
      id: record.id,
      roundNumber: record.round_number,
      status: record.status,
      scheduledKickoffMs: record.scheduled_kickoff_ms,
      actualKickoffMs: record.actual_kickoff_ms,
      finishedAtMs: record.finished_at_ms,
      durationMs: record.duration_ms,
      fixtures: record.fixtures as GlobalRound['fixtures'],
      highlights: record.highlights as GlobalRound['highlights'],
    }));
  } catch {
    return [];
  }
}
