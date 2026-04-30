import { useCallback } from 'react';
import { ArrowUpLeft, LogIn, ArrowDown, Blocks, ArrowDownRight, ArrowUp } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type WingCrossChoice = 'cross' | 'enter' | 'cutback';

export function WingCrossAttacker({ onChoose, onTimeout }: { onChoose: (c: WingCrossChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as WingCrossChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Lateral fundo"
      timeoutMs={6000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'cross',   icon: <ArrowUpLeft size={32} />, label: 'Cruza', tone: 'mid' },
        { id: 'enter',   icon: <LogIn       size={32} />, label: 'Entra', tone: 'risk' },
        { id: 'cutback', icon: <ArrowDown   size={32} />, label: 'Toca',  tone: 'safe' },
      ]}
    />
  );
}

export function WingCrossDefender({ onChoose, onTimeout }: { onChoose: (c: WingCrossChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as WingCrossChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Cobertura"
      timeoutMs={6000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'cross',   icon: <Blocks        size={32} />, label: 'Bloq.',  tone: 'mid' },
        { id: 'enter',   icon: <ArrowDownRight size={32} />, label: 'Marca',  tone: 'risk' },
        { id: 'cutback', icon: <ArrowUp        size={32} />, label: 'Cobre',  tone: 'safe' },
      ]}
    />
  );
}

export function resolveWingCross(att: WingCrossChoice, def: WingCrossChoice): 'intercept' | 'progress' {
  return att === def ? 'intercept' : 'progress';
}
