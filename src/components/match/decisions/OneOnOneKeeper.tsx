import { useCallback } from 'react';
import { CornerLeftUp, ChevronsUp, CornerRightUp, Expand, ArrowDownToLine, Clock } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';
import { L } from '@/i18n/L';

export type OneOnOneAttChoice = 'placed' | 'chip' | 'dribble';
export type OneOnOneGkChoice = 'angle' | 'rush' | 'wait';

export function OneOnOneAttacker({ onChoose, onTimeout }: { onChoose: (c: OneOnOneAttChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as OneOnOneAttChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title={L('Cara a cara', 'One-on-one')}
      timeoutMs={4000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'placed',  icon: <CornerLeftUp  size={32} />, label: L('Coloca', 'Place'), tone: 'safe' },
        { id: 'chip',    icon: <ChevronsUp    size={32} />, label: L('Cavada', 'Chip'), tone: 'risk' },
        { id: 'dribble', icon: <CornerRightUp size={32} />, label: L('Drible', 'Dribble'), tone: 'mid' },
      ]}
    />
  );
}

export function OneOnOneKeeper({ onChoose, onTimeout }: { onChoose: (c: OneOnOneGkChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as OneOnOneGkChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title={L('Goleiro', 'Keeper')}
      timeoutMs={4000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'angle', icon: <Expand          size={32} />, label: L('Ângulo', 'Angle'), tone: 'safe' },
        { id: 'rush',  icon: <ArrowDownToLine size={32} />, label: L('Sai', 'Rush'),    tone: 'risk' },
        { id: 'wait',  icon: <Clock           size={32} />, label: L('Espera', 'Wait'), tone: 'mid' },
      ]}
    />
  );
}

export function resolveOneOnOne(att: OneOnOneAttChoice, gk: OneOnOneGkChoice): 'intercept' | 'progress' {
  const map: Record<OneOnOneAttChoice, OneOnOneGkChoice> = {
    placed: 'angle', chip: 'wait', dribble: 'rush',
  };
  return map[att] === gk ? 'intercept' : 'progress';
}
