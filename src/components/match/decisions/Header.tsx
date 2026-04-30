/**
 * Decision Moment — Cabeçada na área (após cruzamento aéreo).
 *
 * Atacante: testa firme / desvia / picada.
 * Defensor (mirror): salta junto / antecipa / fica na linha.
 */
import { useCallback } from 'react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type HeaderAttChoice = 'power' | 'flick' | 'lob';
export type HeaderDefChoice = 'jump' | 'anticipate' | 'line';

export function HeaderAttacker({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: HeaderAttChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as HeaderAttChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Cabeçada"
      timeoutMs={4000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'power', arrow: 'long-down', label: 'Firme', tone: 'risk' },
        { id: 'flick', arrow: 'curve-right', label: 'Desvia', tone: 'mid' },
        { id: 'lob', arrow: 'long-up', label: 'Picada', tone: 'safe' },
      ]}
    />
  );
}

export function HeaderDefender({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: HeaderDefChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as HeaderDefChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Marcação"
      timeoutMs={4000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'jump', arrow: 'long-up', label: 'Salta', tone: 'risk' },
        { id: 'anticipate', arrow: 'curve-left', label: 'Antec.', tone: 'mid' },
        { id: 'line', arrow: 'short-down', label: 'Linha', tone: 'safe' },
      ]}
    />
  );
}

export function resolveHeader(
  att: HeaderAttChoice,
  def: HeaderDefChoice,
): 'intercept' | 'progress' {
  const map: Record<HeaderAttChoice, HeaderDefChoice> = {
    power: 'jump',
    flick: 'anticipate',
    lob: 'line',
  };
  return map[att] === def ? 'intercept' : 'progress';
}
