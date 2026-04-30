/**
 * Decision Moment — Escanteio.
 *
 * Atacante: curto / 1º pau / 2º pau.
 * Defensor (mirror): marca curto / cobre 1º pau / cobre 2º pau.
 * Match → defesa intercepta. Mismatch → cruzamento aberto, chance.
 */
import { useCallback } from 'react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type CornerChoice = 'short' | 'near' | 'far';

export function CornerAttacker({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: CornerChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as CornerChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Escanteio"
      timeoutMs={8000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'short', arrow: 'short-right', label: 'Curto', tone: 'safe' },
        { id: 'near', arrow: 'curve-left', label: '1º Pau', tone: 'mid' },
        { id: 'far', arrow: 'long-left', label: '2º Pau', tone: 'risk' },
      ]}
    />
  );
}

export function CornerDefender({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: CornerChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as CornerChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Marcação"
      timeoutMs={8000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'short', arrow: 'short-left', label: 'Curto', tone: 'safe' },
        { id: 'near', arrow: 'curve-right', label: '1º Pau', tone: 'mid' },
        { id: 'far', arrow: 'long-right', label: '2º Pau', tone: 'risk' },
      ]}
    />
  );
}

export function resolveCorner(att: CornerChoice, def: CornerChoice): 'intercept' | 'progress' {
  return att === def ? 'intercept' : 'progress';
}
