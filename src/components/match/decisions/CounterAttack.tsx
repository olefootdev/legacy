/**
 * Decision Moment — Contra-ataque (3 atacantes vs 2 defensores).
 *
 * Atacante (POV principal): toca pro meio / arranca pelo lado / chuta de longe.
 * Defensor (mirror): atrasa o jogo / fecha por dentro / pressiona bola.
 */
import { useCallback } from 'react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type CounterAttChoice = 'middle' | 'wing' | 'shot';
export type CounterDefChoice = 'delay' | 'inside' | 'press';

export function CounterAttacker({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: CounterAttChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as CounterAttChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Contra-ataque"
      timeoutMs={5000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'middle', arrow: 'short-up', label: 'Meio', tone: 'mid' },
        { id: 'wing', arrow: 'curve-right', label: 'Lado', tone: 'safe' },
        { id: 'shot', arrow: 'long-up', label: 'Chuta', tone: 'risk' },
      ]}
    />
  );
}

export function CounterDefender({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: CounterDefChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as CounterDefChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Defesa"
      timeoutMs={5000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'delay', arrow: 'tap-back', label: 'Atrasa', tone: 'safe' },
        { id: 'inside', arrow: 'short-down', label: 'Dentro', tone: 'mid' },
        { id: 'press', arrow: 'long-down', label: 'Press.', tone: 'risk' },
      ]}
    />
  );
}

export function resolveCounter(
  att: CounterAttChoice,
  def: CounterDefChoice,
): 'intercept' | 'progress' {
  const map: Record<CounterAttChoice, CounterDefChoice> = {
    middle: 'inside',
    wing: 'delay',
    shot: 'press',
  };
  return map[att] === def ? 'intercept' : 'progress';
}
