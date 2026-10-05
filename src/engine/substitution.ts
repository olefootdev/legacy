import type { LiveMatchSnapshot, MatchEventEntry, PitchPlayerState } from './types';
import type { PlayerEntity } from '@/entities/types';
import { roleFromPos } from './pitchFromLineup';
import { behaviorToCognitiveArchetype, matchAttributesFromPlayerEntity } from '@/match/playerInMatch';
import { L } from '@/i18n/L';

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
  if (snapshot.phase !== 'playing') return { snapshot, error: L('Fora de jogo.', 'Not in play.') };
  const maxSubs = snapshot.mode === 'quick' ? 5 : 3;
  if (snapshot.substitutionsUsed >= maxSubs) {
    return { snapshot, error: L(`Limite de substituições (${maxSubs}).`, `Substitution limit (${maxSubs}).`) };
  }
  if (snapshot.sentOffPlayerIds?.includes(outPlayerId)) {
    return { snapshot, error: L('Jogador expulso não pode ser substituído por si.', 'A sent-off player can\'t be replaced by himself.') };
  }
  if (outPlayerId === inPlayerId) return { snapshot, error: L('Jogador inválido.', 'Invalid player.') };

  const incoming = players[inPlayerId];
  const outgoing = players[outPlayerId];
  if (!incoming || !outgoing) return { snapshot, error: L('Jogador não encontrado.', 'Player not found.') };
  if (incoming.outForMatches > 0) return { snapshot, error: L('Jogador indisponível (lesão ou suspensão).', 'Player unavailable (injury or suspension).') };

  const pendingInjury = snapshot.quickInjurySub;
  const injurySubOut =
    pendingInjury &&
    pendingInjury.outPlayerId === outPlayerId &&
    snapshot.mode === 'quick';

  const onPitch = new Set(snapshot.homePlayers.map((p) => p.playerId));
  if (!onPitch.has(outPlayerId) && !injurySubOut) {
    return { snapshot, error: L('Titular não está em campo.', 'Starter is not on the pitch.') };
  }
  if (onPitch.has(inPlayerId)) return { snapshot, error: L('Jogador já está em campo.', 'Player is already on the pitch.') };

  const slot = findSlotForPlayer(snapshot.matchLineupBySlot, outPlayerId);
  if (!slot) return { snapshot, error: L('Posição não encontrada.', 'Position not found.') };

  const outPs = injurySubOut
    ? ({
        playerId: outPlayerId,
        slotId: pendingInjury!.slotId,
        name: pendingInjury!.name,
        x: pendingInjury!.x,
        y: pendingInjury!.y,
        num: outgoing.num,
        pos: outgoing.pos,
        fatigue: Math.round(outgoing.fatigue),
        role: roleFromPos(outgoing.pos),
        attributes: matchAttributesFromPlayerEntity(outgoing),
        cognitiveArchetype: behaviorToCognitiveArchetype(outgoing.behavior),
        strongFoot: outgoing.strongFoot,
        archetype: outgoing.archetype,
      } satisfies PitchPlayerState)
    : snapshot.homePlayers.find((p) => p.playerId === outPlayerId);
  if (!outPs) return { snapshot, error: L('Estado de campo inconsistente.', 'Inconsistent pitch state.') };

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

  const homePlayers = injurySubOut
    ? [...snapshot.homePlayers, newPitch]
    : snapshot.homePlayers.map((p) => (p.playerId === outPlayerId ? newPitch : p));
  const matchLineupBySlot = { ...snapshot.matchLineupBySlot, [slot]: inPlayerId };

  const ev: MatchEventEntry = {
    id: uid(),
    minute,
    text: L(`${minute}' — Substituição: ${outgoing.name} ↔ ${incoming.name}.`, `${minute}' — Substitution: ${outgoing.name} ↔ ${incoming.name}.`),
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
      quickInjurySub: injurySubOut ? null : snapshot.quickInjurySub,
    },
  };
}
