import { useCallback } from 'react';
import { ArrowRight, CornerLeftUp, CornerRightUp, ArrowLeft, CornerLeftDown, CornerRightDown } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type CornerChoice = 'short' | 'near' | 'far';

export function CornerAttacker({ onChoose, onTimeout }: { onChoose: (c: CornerChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as CornerChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Escanteio"
      timeoutMs={8000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'short', icon: <ArrowRight    size={32} />, label: 'Curto', tone: 'safe' },
        { id: 'near',  icon: <CornerLeftUp  size={32} />, label: '1º Pau', tone: 'mid' },
        { id: 'far',   icon: <CornerRightUp size={32} />, label: '2º Pau', tone: 'risk' },
      ]}
    />
  );
}

export function CornerDefender({ onChoose, onTimeout }: { onChoose: (c: CornerChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as CornerChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Marcação"
      timeoutMs={8000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'short', icon: <ArrowLeft      size={32} />, label: 'Curto', tone: 'safe' },
        { id: 'near',  icon: <CornerLeftDown size={32} />, label: '1º Pau', tone: 'mid' },
        { id: 'far',   icon: <CornerRightDown size={32} />, label: '2º Pau', tone: 'risk' },
      ]}
    />
  );
}

export function resolveCorner(att: CornerChoice, def: CornerChoice): 'intercept' | 'progress' {
  return att === def ? 'intercept' : 'progress';
}
