import type { OlefootGameState } from '@/game/types';
import type { CoachAction } from './coachActions';
import type { CoachPersonality } from './types';
import type { FormationSchemeId } from '@/match-engine/types';
import type { PlayerEntity } from '@/entities/types';

/**
 * Gera ações TÁTICAS para a janela 3 do ciclo (5min "ajustes técnicos próximo jogo").
 *
 * Heurísticas:
 * - Avalia perfil do plantel (peso defesa/meio/ataque) + personalidade do coach.
 * - Sugere formação ideal se diferente da atual.
 * - Considera disponibilidade (lesionados/suspensos via SSOT).
 */
export function generateProactiveTacticalActions(
  state: OlefootGameState,
  opponentContext?: string,
): CoachAction[] {
  const out: CoachAction[] = [];
  const players = Object.values(state.players);
  if (players.length === 0) return out;
  const coach = state.manager.coach;
  if (!coach) return out;

  const health = state.playerHealth ?? {};
  const available = players.filter((p) => {
    const h = health[p.id];
    const out = h?.outForMatches ?? p.outForMatches ?? 0;
    const susp = h?.suspendedMatches ?? 0;
    return out <= 0 && susp <= 0;
  });

  // Não sugere se não tem 11 disponíveis — quem decide isso é o lock pré-jogo.
  if (available.length < 11) return out;

  const profile = computeSquadProfile(available);
  const recommended = recommendFormation(profile, coach.personality);
  const current = state.manager.formationScheme;

  if (recommended === current) return out;

  const now = Date.now();
  out.push({
    id: `coach-formation-${now}`,
    type: 'set_lineup_formation',
    title: `Mudar formação para ${recommended}`,
    description: opponentContext
      ? `Sugestão tática contra ${opponentContext}: trocar de ${current} para ${recommended}.`
      : `Sugestão: trocar de ${current} para ${recommended} com base no perfil do plantel.`,
    reasoning: `Perfil do plantel: defesa ${profile.defense.toFixed(0)} / meio ${profile.midfield.toFixed(0)} / ataque ${profile.attack.toFixed(0)} (médias OVR). Estilo do coach: ${coach.personality}.`,
    urgency: 'medium',
    status: 'pending',
    createdAt: now,
    data: {
      formationScheme: recommended,
      opponentContext,
    },
  });

  return out;
}

interface SquadProfile {
  defense: number;
  midfield: number;
  attack: number;
}

function computeSquadProfile(players: PlayerEntity[]): SquadProfile {
  const grp = (zone: string) => players.filter((p) => p.zone === zone);
  const avg = (arr: PlayerEntity[]) =>
    arr.length === 0 ? 0 : arr.reduce((s, p) => s + meanAttrs(p), 0) / arr.length;
  return {
    defense: avg([...grp('defesa'), ...grp('gol')]),
    midfield: avg(grp('meio')),
    attack: avg(grp('ataque')),
  };
}

function meanAttrs(p: PlayerEntity): number {
  const a = p.attrs as unknown as Record<string, number>;
  const vals = Object.values(a).filter((v) => typeof v === 'number');
  if (vals.length === 0) return 50;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function recommendFormation(profile: SquadProfile, personality: CoachPersonality): FormationSchemeId {
  const { defense, midfield, attack } = profile;
  const defStrong = defense >= midfield && defense >= attack;
  const midStrong = midfield >= defense && midfield >= attack;
  const atkStrong = attack >= midfield && attack >= defense;

  // Personalidade modula a escolha entre opções equivalentes.
  if (personality === 'Pragmatic') {
    if (defStrong) return '5-3-2';
    return '4-5-1';
  }
  if (personality === 'Visionary') {
    if (midStrong) return '4-3-3';
    return '4-2-3-1';
  }
  if (personality === 'Motivator') {
    if (atkStrong) return '4-3-3';
    return '3-4-3';
  }
  if (personality === 'Tactician') {
    return '4-2-3-1';
  }
  // Developer
  if (atkStrong) return '4-3-3';
  if (defStrong) return '4-4-2';
  return '4-3-3';
}
