/**
 * Cliente para o endpoint Claude de interpretação semântica de comandos de voz.
 *
 * Chamado quando o parser determinístico (intentMatcher) não reconhece a frase.
 * Claude interpreta linguagem natural de futebol em pt-BR e devolve intents estruturados.
 */

import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import type { VoiceIntent, ParsedCommand, CommandTarget } from './types';

export interface LLMInterpretContext {
  players: Array<{ name: string; num?: number; role?: string; playerId: string }>;
  ballCarrier?: string;
  minute?: number;
  homeScore?: number;
  awayScore?: number;
}

export interface LLMInterpretResult {
  commands: ParsedCommand[];
  /** Frase curta do que Claude entendeu — para feedback na UI. */
  narrative: string;
}

interface RawCommand {
  intent: string;
  target: string;
  targetType: string;
}

function buildTarget(raw: RawCommand, players: LLMInterpretContext['players']): CommandTarget {
  const t = raw.targetType;
  if (t === 'player_name') {
    const name = raw.target.toLowerCase();
    const found = players.find((p) =>
      p.name.toLowerCase().includes(name) || name.includes(p.name.toLowerCase().split(' ')[0]!)
    );
    if (found) return { kind: 'player_id', playerId: found.playerId };
  }
  if (t === 'shirt_number') {
    const num = parseInt(raw.target, 10);
    const found = players.find((p) => p.num === num);
    if (found) return { kind: 'player_id', playerId: found.playerId };
  }
  if (t === 'role') {
    const roleMap: Record<string, 'gk' | 'def' | 'mid' | 'attack'> = {
      atacantes: 'attack', meias: 'mid', zagueiros: 'def', goleiro: 'gk',
      ataque: 'attack', defesa: 'def', meio: 'mid',
    };
    const role = roleMap[raw.target.toLowerCase()];
    if (role) return { kind: 'role', role };
  }
  if (t === 'ball_carrier') return { kind: 'ball_carrier' };
  return { kind: 'team' };
}

export async function llmInterpretCommand(
  transcript: string,
  ctx: LLMInterpretContext,
): Promise<LLMInterpretResult> {
  const base = olefootApiBase();
  try {
    const res = await fetch(`${base}/api/voice/parse-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        context: {
          players: ctx.players.map((p) => ({ name: p.name, num: p.num, role: p.role })),
          ballCarrier: ctx.ballCarrier,
          minute: ctx.minute,
          homeScore: ctx.homeScore,
          awayScore: ctx.awayScore,
        },
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return { commands: [], narrative: '' };

    const data = await res.json() as { commands?: RawCommand[]; narrative?: string };
    if (!Array.isArray(data.commands) || data.commands.length === 0) {
      return { commands: [], narrative: data.narrative ?? '' };
    }

    const commands: ParsedCommand[] = data.commands
      .filter((r) => r.intent && r.targetType)
      .map((r, i) => ({
        intent: r.intent as VoiceIntent,
        target: buildTarget(r, ctx.players),
        rawText: transcript,
        fragmentIndex: i,
      }));

    return { commands, narrative: data.narrative ?? '' };
  } catch {
    return { commands: [], narrative: '' };
  }
}
