/**
 * Decision Moment — Cara a cara com goleiro.
 *
 * Atacante: chuta colocado / cobertura (cavadinha) / drible.
 * Goleiro (mirror): fecha ângulo / sai aos pés / espera no gol.
 */
import { useCallback } from 'react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type OneOnOneAttChoice = 'placed' | 'chip' | 'dribble';
export type OneOnOneGkChoice = 'angle' | 'rush' | 'wait';

export function OneOnOneAttacker({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: OneOnOneAttChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as OneOnOneAttChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Cara a cara"
      timeoutMs={4000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'placed', arrow: 'curve-left', label: 'Coloca', tone: 'safe' },
        { id: 'chip', arrow: 'long-up', label: 'Cavada', tone: 'risk' },
        { id: 'dribble', arrow: 'curve-right', label: 'Drible', tone: 'mid' },
      ]}
    />
  );
}

export function OneOnOneKeeper({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: OneOnOneGkChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as OneOnOneGkChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Goleiro"
      timeoutMs={4000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'angle', arrow: 'fan-left', label: 'Ângulo', tone: 'safe' },
        { id: 'rush', arrow: 'long-down', label: 'Sai', tone: 'risk' },
        { id: 'wait', arrow: 'tap-back', label: 'Espera', tone: 'mid' },
      ]}
    />
  );
}

export function resolveOneOnOne(
  att: OneOnOneAttChoice,
  gk: OneOnOneGkChoice,
): 'intercept' | 'progress' {
  const map: Record<OneOnOneAttChoice, OneOnOneGkChoice> = {
    placed: 'angle',
    chip: 'wait',
    dribble: 'rush',
  };
  return map[att] === gk ? 'intercept' : 'progress';
}
