import { useCallback } from 'react';
import { ArrowRight, CornerLeftUp, CornerRightUp, ArrowLeft, CornerLeftDown, CornerRightDown } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';
import { L } from '@/i18n/L';

export type CornerChoice = 'short' | 'near' | 'far';

export function CornerAttacker({ onChoose, onTimeout }: { onChoose: (c: CornerChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as CornerChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title={L('Escanteio', 'Corner')}
      timeoutMs={8000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'short', icon: <ArrowRight    size={32} />, label: L('Curto', 'Short'), tone: 'safe' },
        { id: 'near',  icon: <CornerLeftUp  size={32} />, label: L('1º Pau', 'Near post'), tone: 'mid' },
        { id: 'far',   icon: <CornerRightUp size={32} />, label: L('2º Pau', 'Far post'), tone: 'risk' },
      ]}
    />
  );
}

export function CornerDefender({ onChoose, onTimeout }: { onChoose: (c: CornerChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as CornerChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title={L('Marcação', 'Marking')}
      timeoutMs={8000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'short', icon: <ArrowLeft      size={32} />, label: L('Curto', 'Short'), tone: 'safe' },
        { id: 'near',  icon: <CornerLeftDown size={32} />, label: L('1º Pau', 'Near post'), tone: 'mid' },
        { id: 'far',   icon: <CornerRightDown size={32} />, label: L('2º Pau', 'Far post'), tone: 'risk' },
      ]}
    />
  );
}

export function resolveCorner(att: CornerChoice, def: CornerChoice): 'intercept' | 'progress' {
  return att === def ? 'intercept' : 'progress';
}
