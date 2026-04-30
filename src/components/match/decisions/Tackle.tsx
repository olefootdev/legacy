import { useCallback } from 'react';
import { Zap, Shield, ArrowUp, ShieldOff, Repeat, ChevronsUp } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type TackleDefenderChoice = 'slide' | 'cover' | 'press';
export type TackleAttackerChoice = 'shield' | 'wallpass' | 'sprint';

export function TackleDefender({ onChoose, onTimeout }: { onChoose: (c: TackleDefenderChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as TackleDefenderChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Carrinho"
      timeoutMs={5000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'slide', icon: <Zap    size={32} />, label: 'Carrinho', tone: 'risk' },
        { id: 'cover', icon: <Shield size={32} />, label: 'Cobre',    tone: 'safe' },
        { id: 'press', icon: <ArrowUp size={32} />, label: 'Press.',  tone: 'mid' },
      ]}
    />
  );
}

export function TackleAttacker({ onChoose, onTimeout }: { onChoose: (c: TackleAttackerChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as TackleAttackerChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Conduz"
      timeoutMs={5000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'shield',   icon: <ShieldOff  size={32} />, label: 'Protege', tone: 'safe' },
        { id: 'wallpass', icon: <Repeat     size={32} />, label: 'Tabela',  tone: 'mid' },
        { id: 'sprint',   icon: <ChevronsUp size={32} />, label: 'Acel.',   tone: 'risk' },
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
