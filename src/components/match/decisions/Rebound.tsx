import { useCallback } from 'react';
import { Zap, CircleDot, ArrowUpRight, HandMetal, Shrink, Blocks } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type ReboundAttChoice = 'first' | 'control' | 'cross';
export type ReboundDefChoice = 'block' | 'angle' | 'cut';

export function ReboundAttacker({ onChoose, onTimeout }: { onChoose: (c: ReboundAttChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as ReboundAttChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Rebote"
      timeoutMs={4000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'first',   icon: <Zap          size={32} />, label: '1ª',    tone: 'risk' },
        { id: 'control', icon: <CircleDot    size={32} />, label: 'Domina', tone: 'mid' },
        { id: 'cross',   icon: <ArrowUpRight size={32} />, label: 'Cruza',  tone: 'safe' },
      ]}
    />
  );
}

export function ReboundDefender({ onChoose, onTimeout }: { onChoose: (c: ReboundDefChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as ReboundDefChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Salva"
      timeoutMs={4000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'block', icon: <HandMetal size={32} />, label: 'Tapa',   tone: 'risk' },
        { id: 'angle', icon: <Shrink    size={32} />, label: 'Ângulo', tone: 'mid' },
        { id: 'cut',   icon: <Blocks    size={32} />, label: 'Corta',  tone: 'safe' },
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
