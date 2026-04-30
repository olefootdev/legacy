/**
 * Decision Moment — Carrinho / dividida.
 *
 * Defensor (POV principal): carrinho frontal / cobertura / pressão alta.
 * Atacante (mirror): protege bola / tabela / acelera.
 * Match → defensor recupera. Mismatch → atacante progride.
 */
import { useCallback } from 'react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type TackleDefenderChoice = 'slide' | 'cover' | 'press';
export type TackleAttackerChoice = 'shield' | 'wallpass' | 'sprint';

export function TackleDefender({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: TackleDefenderChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as TackleDefenderChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Carrinho"
      timeoutMs={5000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'slide', arrow: 'long-up', label: 'Carrinho', tone: 'risk' },
        { id: 'cover', arrow: 'tap-back', label: 'Cobre', tone: 'safe' },
        { id: 'press', arrow: 'short-up', label: 'Press.', tone: 'mid' },
      ]}
    />
  );
}

export function TackleAttacker({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: TackleAttackerChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as TackleAttackerChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Conduz"
      timeoutMs={5000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'shield', arrow: 'short-down', label: 'Protege', tone: 'safe' },
        { id: 'wallpass', arrow: 'curve-right', label: 'Tabela', tone: 'mid' },
        { id: 'sprint', arrow: 'long-up', label: 'Acel.', tone: 'risk' },
      ]}
    />
  );
}

export function resolveTackle(
  att: TackleAttackerChoice,
  def: TackleDefenderChoice,
): 'intercept' | 'progress' {
  const map: Record<TackleAttackerChoice, TackleDefenderChoice> = {
    shield: 'press',
    wallpass: 'cover',
    sprint: 'slide',
  };
  return map[att] === def ? 'intercept' : 'progress';
}
