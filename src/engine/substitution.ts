import type { LiveMatchSnapshot, MatchEventEntry, PitchPlayerState } from './types';
import type { PlayerEntity } from '@/entities/types';
import { roleFromPos } from './pitchFromLineup';
import { behaviorToCognitiveArchetype, matchAttributesFromPlayerEntity } from '@/match/playerInMatch';

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function findSlotForPlayer(matchLineup: Record<string, string>, playerId: string): string | undefined {
  for (const [slot, pid] of Object.entries(matchLineup)) {
    if (pid === playerId) return slot;
  }
  return undefined;
}

export function applySubstitution(input: {
  snapshot: LiveMatchSnapshot;
  players: Record<string, PlayerEntity>;
  outPlayerId: string;
  inPlayerId: string;
  minute: number;
}): { snapshot: LiveMatchSnapshot; error?: string } {
  const { snapshot, players, outPlayerId, inPlayerId, minute } = input;
  if (snapshot.phase !== 'playing') return { snapshot, error: 'Fora de jogo.' };
  const maxSubs = snapshot.mode === 'quick' ? 5 : 3;
  if (snapshot.substitutionsUsed >= maxSubs) {
    return { snapshot, error: `Limite de substituições (${maxSubs}).` };
  }
  if (snapshot.sentOffPlayerIds?.includes(outPlayerId)) {
    return { snapshot, error: 'Jogador expulso não pode ser substituído por si.' };
  }
  if (outPlayerId === inPlayerId) return { snapshot, error: 'Jogador inválido.' };

  const incoming = players[inPlayerId];
  const outgoing = players[outPlayerId];
  if (!incoming || !outgoing) return { snapshot, error: 'Jogador não encontrado.' };
  if (incoming.outForMatches > 0) return { snapshot, error: 'Jogador indisponível (lesão ou suspensão).' };

  const onPitch = new Set(snapshot.homePlayers.map((p) => p.playerId));
  if (!onPitch.has(outPlayerId)) return { snapshot, error: 'Titular não está em campo.' };
  if (onPitch.has(inPlayerId)) return { snapshot, error: 'Jogador já está em campo.' };

  const slot = findSlotForPlayer(snapshot.matchLineupBySlot, outPlayerId);
  if (!slot) return { snapshot, error: 'Posição não encontrada.' };

  const outPs = snapshot.homePlayers.find((p) => p.playerId === outPlayerId);
  if (!outPs) return { snapshot, error: 'Estado de campo inconsistente.' };

  const newPitch: PitchPlayerState = {
    playerId: incoming.id,
    slotId: outPs.slotId,
    name: incoming.name,
    num: incoming.num,
    pos: incoming.pos,
    x: outPs.x,
    y: outPs.y,
    fatigue: Math.round(incoming.fatigue),
    role: roleFromPos(incoming.pos),
    attributes: matchAttributesFromPlayerEntity(incoming),
    cognitiveArchetype: behaviorToCognitiveArchetype(incoming.behavior),
    strongFoot: incoming.strongFoot,
    archetype: incoming.archetype,
  };

  const homePlayers = snapshot.homePlayers.map((p) => (p.playerId === outPlayerId ? newPitch : p));
  const matchLineupBySlot = { ...snapshot.matchLineupBySlot, [slot]: inPlayerId };

  const ev: MatchEventEntry = {
    id: uid(),
    minute,
    text: `${minute}' — Substituição: ${outgoing.name} ↔ ${incoming.name}.`,
    kind: 'sub',
  };
  const events = [ev, ...snapshot.events].slice(0, 45);

  const homeStats = { ...snapshot.homeStats };
  homeStats[inPlayerId] = homeStats[inPlayerId] ?? {
    passesOk: 0,
    passesAttempt: 0,
    tackles: 0,
    km: 0,
    rating: 6.4,
  };

  return {
    snapshot: {
      ...snapshot,
      homePlayers,
      matchLineupBySlot,
      substitutionsUsed: snapshot.substitutionsUsed + 1,
      events,
      homeStats,
    },
  };
}
