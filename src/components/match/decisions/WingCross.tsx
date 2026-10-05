import { useCallback } from 'react';
import { ArrowUpLeft, LogIn, ArrowDown, Blocks, ArrowDownRight, ArrowUp } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';
import { L } from '@/i18n/L';

export type WingCrossChoice = 'cross' | 'enter' | 'cutback';

export function WingCrossAttacker({ onChoose, onTimeout }: { onChoose: (c: WingCrossChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as WingCrossChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title={L('Lateral fundo', 'Byline')}
      timeoutMs={6000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'cross',   icon: <ArrowUpLeft size={32} />, label: L('Cruza', 'Cross'), tone: 'mid' },
        { id: 'enter',   icon: <LogIn       size={32} />, label: L('Entra', 'Cut in'), tone: 'risk' },
        { id: 'cutback', icon: <ArrowDown   size={32} />, label: L('Toca', 'Pass'),  tone: 'safe' },
      ]}
    />
  );
}

export function WingCrossDefender({ onChoose, onTimeout }: { onChoose: (c: WingCrossChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as WingCrossChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title={L('Cobertura', 'Cover')}
      timeoutMs={6000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'cross',   icon: <Blocks        size={32} />, label: L('Bloq.', 'Block'),  tone: 'mid' },
        { id: 'enter',   icon: <ArrowDownRight size={32} />, label: L('Marca', 'Mark'),  tone: 'risk' },
        { id: 'cutback', icon: <ArrowUp        size={32} />, label: L('Cobre', 'Cover'),  tone: 'safe' },
      ]}
    />
  );
}

export function resolveWingCross(att: WingCrossChoice, def: WingCrossChoice): 'intercept' | 'progress' {
  return att === def ? 'intercept' : 'progress';
}
