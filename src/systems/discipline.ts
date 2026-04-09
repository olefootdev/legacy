import type { PlayerEntity } from '@/entities/types';

export type DisciplineOutcome = 'none' | 'yellow' | 'red';

/**
 * Cartões no jogo — mesmo pipeline de persistência que lesões (`outForMatches` no vermelho).
 * Amarelo: penaliza confiança. Vermelho: expulsão + 3 jogos de suspensão (via outForMatches).
 */
export function rollMatchDiscipline(player: PlayerEntity): {
  outcome: DisciplineOutcome;
  player: PlayerEntity;
  narrative?: string;
} {
  if (player.outForMatches > 0) return { outcome: 'none', player };

  const roll = Math.random();
  if (roll > 0.042) return { outcome: 'none', player };

  const secondYellow = roll < 0.008;
  if (secondYellow || roll < 0.022) {
    const next: PlayerEntity = {
      ...player,
      attrs: {
        ...player.attrs,
        confianca: Math.max(0, player.attrs.confianca - (secondYellow ? 12 : 5)),
        fairPlay: Math.max(0, player.attrs.fairPlay - (secondYellow ? 8 : 3)),
      },
    };
    const narrative = secondYellow
      ? `${player.name} vê o segundo amarelo e deixa os companheiros em inferioridade.`
      : `${player.name} entra atrasado; o árbitro mostra amarelo e a bancada assobia.`;
    if (secondYellow) {
      return {
        outcome: 'red',
        player: { ...next, outForMatches: Math.max(next.outForMatches, 3) },
        narrative,
      };
    }
    return { outcome: 'yellow', player: next, narrative };
  }

  return {
    outcome: 'red',
    player: {
      ...player,
      attrs: {
        ...player.attrs,
        confianca: Math.max(0, player.attrs.confianca - 10),
        fairPlay: Math.max(0, player.attrs.fairPlay - 12),
      },
      outForMatches: Math.max(player.outForMatches, 3),
    },
    narrative: `${player.name} recebe vermelho direto; o relvado fica em polvorosa.`,
  };
}
