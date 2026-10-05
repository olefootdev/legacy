import { useCallback } from 'react';
import { Zap, Shield, ArrowUp, ShieldOff, Repeat, ChevronsUp } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';
import { L } from '@/i18n/L';

export type TackleDefenderChoice = 'slide' | 'cover' | 'press';
export type TackleAttackerChoice = 'shield' | 'wallpass' | 'sprint';

export function TackleDefender({ onChoose, onTimeout }: { onChoose: (c: TackleDefenderChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as TackleDefenderChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title={L('Carrinho', 'Tackle')}
      timeoutMs={5000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'slide', icon: <Zap    size={32} />, label: L('Carrinho', 'Slide'), tone: 'risk' },
        { id: 'cover', icon: <Shield size={32} />, label: L('Cobre', 'Cover'),    tone: 'safe' },
        { id: 'press', icon: <ArrowUp size={32} />, label: L('Press.', 'Press'),  tone: 'mid' },
      ]}
    />
  );
}

export function TackleAttacker({ onChoose, onTimeout }: { onChoose: (c: TackleAttackerChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as TackleAttackerChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title={L('Conduz', 'Carry')}
      timeoutMs={5000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'shield',   icon: <ShieldOff  size={32} />, label: L('Protege', 'Shield'), tone: 'safe' },
        { id: 'wallpass', icon: <Repeat     size={32} />, label: L('Tabela', '1-2'),  tone: 'mid' },
        { id: 'sprint',   icon: <ChevronsUp size={32} />, label: L('Acel.', 'Burst'),   tone: 'risk' },
      ]}
    />
  );
}

export function resolveTackle(att: TackleAttackerChoice, def: TackleDefenderChoice): 'intercept' | 'progress' {
  const map: Record<TackleAttackerChoice, TackleDefenderChoice> = {
    shield: 'press', wallpass: 'cover', sprint: 'slide',
  };
  return map[att] === def ? 'intercept' : 'progress';
}
