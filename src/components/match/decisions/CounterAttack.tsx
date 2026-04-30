import { useCallback } from 'react';
import { ArrowUp, ArrowUpRight, Crosshair, Timer, ArrowDown, MoveDown } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type CounterAttChoice = 'middle' | 'wing' | 'shot';
export type CounterDefChoice = 'delay' | 'inside' | 'press';

export function CounterAttacker({ onChoose, onTimeout }: { onChoose: (c: CounterAttChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as CounterAttChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Contra-ataque"
      timeoutMs={5000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'middle', icon: <ArrowUp      size={32} />, label: 'Meio', tone: 'mid' },
        { id: 'wing',   icon: <ArrowUpRight size={32} />, label: 'Lado', tone: 'safe' },
        { id: 'shot',   icon: <Crosshair    size={32} />, label: 'Chuta', tone: 'risk' },
      ]}
    />
  );
}

export function CounterDefender({ onChoose, onTimeout }: { onChoose: (c: CounterDefChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as CounterDefChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Defesa"
      timeoutMs={5000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'delay',  icon: <Timer    size={32} />, label: 'Atrasa', tone: 'safe' },
        { id: 'inside', icon: <ArrowDown size={32} />, label: 'Dentro', tone: 'mid' },
        { id: 'press',  icon: <MoveDown  size={32} />, label: 'Press.', tone: 'risk' },
      ]}
    />
  );
}

export function resolveCounter(att: CounterAttChoice, def: CounterDefChoice): 'intercept' | 'progress' {
  const map: Record<CounterAttChoice, CounterDefChoice> = {
    middle: 'inside', wing: 'delay', shot: 'press',
  };
  return map[att] === def ? 'intercept' : 'progress';
}
