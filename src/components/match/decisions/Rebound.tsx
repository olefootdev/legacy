/**
 * Decision Moment — Rebote do goleiro (após defesa parcial).
 *
 * Atacante (POV principal): chuta de primeira / domina e finaliza / cruza pra área.
 * Defensor (mirror — goleiro/zaga): tapa primeiro / fecha ângulo / corta cruzamento.
 */
import { useCallback } from 'react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type ReboundAttChoice = 'first' | 'control' | 'cross';
export type ReboundDefChoice = 'block' | 'angle' | 'cut';

export function ReboundAttacker({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: ReboundAttChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as ReboundAttChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Rebote"
      timeoutMs={4000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'first', arrow: 'long-up', label: '1ª', tone: 'risk' },
        { id: 'control', arrow: 'short-up', label: 'Domina', tone: 'mid' },
        { id: 'cross', arrow: 'cross', label: 'Cruza', tone: 'safe' },
      ]}
    />
  );
}

export function ReboundDefender({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: ReboundDefChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as ReboundDefChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Salva"
      timeoutMs={4000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'block', arrow: 'long-down', label: 'Tapa', tone: 'risk' },
        { id: 'angle', arrow: 'short-down', label: 'Ângulo', tone: 'mid' },
        { id: 'cut', arrow: 'cross', label: 'Corta', tone: 'safe' },
      ]}
    />
  );
}

export function resolveRebound(
  att: ReboundAttChoice,
  def: ReboundDefChoice,
): 'intercept' | 'progress' {
  const map: Record<ReboundAttChoice, ReboundDefChoice> = {
    first: 'block',
    control: 'angle',
    cross: 'cut',
  };
  return map[att] === def ? 'intercept' : 'progress';
}
