import type { LiveMatchSnapshot, MatchEventEntry, PitchPlayerState } from './types';
import type { PlayerEntity } from '@/entities/types';
import type { PlayerHealth } from '@/systems/playerHealth/types';
import { roleFromPos } from './pitchFromLineup';
import { behaviorToCognitiveArchetype, matchAttributesFromPlayerEntity } from '@/match/playerInMatch';
import { overallFromAttributes } from '@/entities/player';
import { findSlotForPlayer } from './substitution';

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isAvailable(p: PlayerEntity, health?: Record<string, PlayerHealth>): boolean {
  const h = health?.[p.id];
  if (h) return (h.outForMatches ?? 0) <= 0 && (h.suspendedMatches ?? 0) <= 0;
  return p.outForMatches <= 0;
}

/** Primeiro reserva elegível (fora do campo, disponível), por OVR. */
export function pickBenchReplacement(
  snapshot: LiveMatchSnapshot,
  players: Record<string, PlayerEntity>,
  health?: Record<string, PlayerHealth>,
): PlayerEntity | undefined {
  const onPitch = new Set(snapshot.homePlayers.map((p) => p.playerId));
  const candidates = Object.values(players).filter((p) => !onPitch.has(p.id) && isAvailable(p, health));
  if (!candidates.length) return undefined;
  candidates.sort(
    (a, b) => overallFromAttributes(b.attrs, b.pos) - overallFromAttributes(a.attrs, a.pos),
  );
  return candidates[0];
}

/**
 * Após vermelho: entra substituto automático se houver vaga e banco.
 */
export function applyRedCardAutoSub(input: {
  snapshot: LiveMatchSnapshot;
  players: Record<string, PlayerEntity>;
  sentOffId: string;
  minute: number;
  health?: Record<string, PlayerHealth>;
}): { snapshot: LiveMatchSnapshot; events: MatchEventEntry[] } {
  const { snapshot, players, sentOffId, minute, health } = input;
  const slot = findSlotForPlayer(snapshot.matchLineupBySlot, sentOffId);
  const outPs = snapshot.homePlayers.find((p) => p.playerId === sentOffId);
  if (!slot || !outPs) return { snapshot, events: [] };

  /** Partida rápida: sem substituição automática — o gajo sai e o jogo segue com menos um. */
  if (snapshot.mode === 'quick' || snapshot.mode === 'test2d') {
    const ev: MatchEventEntry = {
      id: uid(),
      minute,
      text: `${minute}' — ${players[sentOffId]?.name ?? 'Jogador'} expulso. A tua equipa fica com menos um (sem substituição automática).`,
      kind: 'narrative',
    };
    const homePlayers = snapshot.homePlayers.filter((p) => p.playerId !== sentOffId);
    const matchLineupBySlot = { ...snapshot.matchLineupBySlot };
    delete matchLineupBySlot[slot];
    const sentOffPlayerIds = [...(snapshot.sentOffPlayerIds ?? []), sentOffId];
    const nextEvents = [ev, ...snapshot.events].slice(0, 45);
    return {
      snapshot: {
        ...snapshot,
        homePlayers,
        matchLineupBySlot,
        sentOffPlayerIds,
        events: nextEvents,
      },
      events: [ev],
    };
  }

  const incoming = pickBenchReplacement(snapshot, players, health);
  if (!incoming || snapshot.substitutionsUsed >= 5) {
    const ev: MatchEventEntry = {
      id: uid(),
      minute,
      text: `${minute}' — ${players[sentOffId]?.name ?? 'Jogador'} expulso; sem substituições disponíveis.`,
      kind: 'narrative',
    };
    const homePlayers = snapshot.homePlayers.filter((p) => p.playerId !== sentOffId);
    const matchLineupBySlot = { ...snapshot.matchLineupBySlot };
    delete matchLineupBySlot[slot];
    return {
      snapshot: {
        ...snapshot,
        homePlayers,
        matchLineupBySlot,
        events: [ev, ...snapshot.events].slice(0, 45),
      },
      events: [ev],
    };
  }

  const newPitch: PitchPlayerState = {
    playerId: incoming.id,
    slotId: outPs.slotId,
    name: incoming.name,
    num: incoming.num,
    pos: incoming.pos,
    x: outPs.x,
    y: outPs.y,
    fatigue: Math.round(health?.[incoming.id]?.fatigue ?? incoming.fatigue),
    role: roleFromPos(incoming.pos),
    attributes: matchAttributesFromPlayerEntity(incoming),
    cognitiveArchetype: behaviorToCognitiveArchetype(incoming.behavior),
    strongFoot: incoming.strongFoot,
    archetype: incoming.archetype,
  };

  const ev: MatchEventEntry = {
    id: uid(),
    minute,
    text: `${minute}' — Entra ${incoming.name} no lugar do expulso.`,
    kind: 'sub',
  };

  const homePlayers = snapshot.homePlayers.map((p) => (p.playerId === sentOffId ? newPitch : p));
  const matchLineupBySlot = { ...snapshot.matchLineupBySlot, [slot]: incoming.id };
  const homeStats = { ...snapshot.homeStats };
  homeStats[incoming.id] = homeStats[incoming.id] ?? {
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
      events: [ev, ...snapshot.events].slice(0, 45),
      homeStats,
    },
    events: [ev],
  };
}
