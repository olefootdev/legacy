/**
 * Uma linha por jogador por evento (já expandido: equipa = N linhas).
 * Fatores compostos com exp(Σ ln(f)).
 */
export interface ImpactLedgerEntry {
  id: string;
  minute: number;
  playerId: string;
  factor: number;
  kind:
    | 'team_goal_scored'
    | 'team_goal_conceded'
    | 'goal_author'
    | 'card_yellow'
    | 'card_red'
    | 'narrative_bump'
    | 'def_reaction'
    | 'team_goal_scored_sync'
    | 'team_goal_conceded_sync';
  /** true se o fator já inclui amplificação de capitão (apenas individuais). */
  captainBoost?: boolean;
}
