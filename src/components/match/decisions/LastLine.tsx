import { useCallback } from 'react';
import { ChevronsUp, Minus, ChevronsDown, ArrowUpFromLine, ArrowRight, Footprints } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';
import { L } from '@/i18n/L';

export type LastLineDefChoice = 'push' | 'hold' | 'drop';
export type LastLineAttChoice = 'through' | 'feet' | 'dribble';

export function LastLineDefender({ onChoose, onTimeout }: { onChoose: (c: LastLineDefChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as LastLineDefChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title={L('Última linha', 'Last line')}
      timeoutMs={5000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'push', icon: <ChevronsUp   size={32} />, label: L('Sobe', 'Step up'),   tone: 'risk' },
        { id: 'hold', icon: <Minus        size={32} />, label: L('Segura', 'Hold'), tone: 'mid' },
        { id: 'drop', icon: <ChevronsDown size={32} />, label: L('Recua', 'Drop'),  tone: 'safe' },
      ]}
    />
  );
}

export function LastLineAttacker({ onChoose, onTimeout }: { onChoose: (c: LastLineAttChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as LastLineAttChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title={L('Lançamento', 'Long ball')}
      timeoutMs={5000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'through', icon: <ArrowUpFromLine size={32} />, label: L('Enfia', 'Through'),  tone: 'risk' },
        { id: 'feet',    icon: <ArrowRight      size={32} />, label: L('No Pé', 'To feet'),  tone: 'mid' },
        { id: 'dribble', icon: <Footprints      size={32} />, label: L('Drible', 'Dribble'), tone: 'safe' },
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
