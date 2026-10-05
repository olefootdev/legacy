import { useCallback } from 'react';
import { Zap, CircleDot, ArrowUpRight, HandMetal, Shrink, Blocks } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';
import { L } from '@/i18n/L';

export type ReboundAttChoice = 'first' | 'control' | 'cross';
export type ReboundDefChoice = 'block' | 'angle' | 'cut';

export function ReboundAttacker({ onChoose, onTimeout }: { onChoose: (c: ReboundAttChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as ReboundAttChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title={L('Rebote', 'Rebound')}
      timeoutMs={4000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'first',   icon: <Zap          size={32} />, label: L('1ª', '1st time'),    tone: 'risk' },
        { id: 'control', icon: <CircleDot    size={32} />, label: L('Domina', 'Control'), tone: 'mid' },
        { id: 'cross',   icon: <ArrowUpRight size={32} />, label: L('Cruza', 'Cross'),  tone: 'safe' },
      ]}
    />
  );
}

export function ReboundDefender({ onChoose, onTimeout }: { onChoose: (c: ReboundDefChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as ReboundDefChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title={L('Salva', 'Clear')}
      timeoutMs={4000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'block', icon: <HandMetal size={32} />, label: L('Tapa', 'Block'),   tone: 'risk' },
        { id: 'angle', icon: <Shrink    size={32} />, label: L('Ângulo', 'Angle'), tone: 'mid' },
        { id: 'cut',   icon: <Blocks    size={32} />, label: L('Corta', 'Cut'),  tone: 'safe' },
      ]}
    />
  );
}

export function resolveRebound(att: ReboundAttChoice, def: ReboundDefChoice): 'intercept' | 'progress' {
  const map: Record<ReboundAttChoice, ReboundDefChoice> = {
    first: 'block', control: 'angle', cross: 'cut',
  };
  return map[att] === def ? 'intercept' : 'progress';
}
