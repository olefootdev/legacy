import { useCallback } from 'react';
import { ChevronsUp, Minus, ChevronsDown, ArrowUpFromLine, ArrowRight, Footprints } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type LastLineDefChoice = 'push' | 'hold' | 'drop';
export type LastLineAttChoice = 'through' | 'feet' | 'dribble';

export function LastLineDefender({ onChoose, onTimeout }: { onChoose: (c: LastLineDefChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as LastLineDefChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Última linha"
      timeoutMs={5000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'push', icon: <ChevronsUp   size={32} />, label: 'Sobe',   tone: 'risk' },
        { id: 'hold', icon: <Minus        size={32} />, label: 'Segura', tone: 'mid' },
        { id: 'drop', icon: <ChevronsDown size={32} />, label: 'Recua',  tone: 'safe' },
      ]}
    />
  );
}

export function LastLineAttacker({ onChoose, onTimeout }: { onChoose: (c: LastLineAttChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as LastLineAttChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Lançamento"
      timeoutMs={5000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'through', icon: <ArrowUpFromLine size={32} />, label: 'Enfia',  tone: 'risk' },
        { id: 'feet',    icon: <ArrowRight      size={32} />, label: 'No Pé',  tone: 'mid' },
        { id: 'dribble', icon: <Footprints      size={32} />, label: 'Drible', tone: 'safe' },
      ]}
    />
  );
}

export function resolveLastLine(att: LastLineAttChoice, def: LastLineDefChoice): 'intercept' | 'progress' {
  const map: Record<LastLineAttChoice, LastLineDefChoice> = {
    through: 'push', feet: 'hold', dribble: 'drop',
  };
  return map[att] === def ? 'intercept' : 'progress';
}
