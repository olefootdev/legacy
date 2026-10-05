import { useCallback } from 'react';
import { MoveLeft, MoveRight, ChevronsUp, ArrowLeftToLine, ArrowRightToLine, ChevronsDown } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';
import { L } from '@/i18n/L';

export type GkDistributionChoice = 'left' | 'long' | 'right';
export type DefensivePressure = 'left' | 'deep' | 'right';

export interface GoalkeeperDistributionProps {
  onAttackerChoice: (choice: GkDistributionChoice) => void;
  onTimeout?: () => void;
}

export function GoalkeeperDistribution({ onAttackerChoice, onTimeout }: GoalkeeperDistributionProps) {
  const handle = useCallback((id: string) => onAttackerChoice(id as GkDistributionChoice), [onAttackerChoice]);
  return (
    <DecisionPromptCard
      title={L('Distribuição', 'Distribution')}
      timeoutMs={8000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'left',  icon: <MoveLeft  size={32} />, label: L('Lat Esq', 'LB'), tone: 'safe' },
        { id: 'long',  icon: <ChevronsUp size={32} />, label: L('Chutão', 'Long'), tone: 'risk' },
        { id: 'right', icon: <MoveRight size={32} />, label: L('Lat Dir', 'RB'), tone: 'safe' },
      ]}
    />
  );
}

export function GoalkeeperPressure({ onDefenderChoice, onTimeout }: { onDefenderChoice: (choice: DefensivePressure) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onDefenderChoice(id as DefensivePressure), [onDefenderChoice]);
  return (
    <DecisionPromptCard
      title={L('Pressão', 'Press')}
      timeoutMs={8000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'left',  icon: <ArrowLeftToLine  size={32} />, label: L('Esq', 'Left'),   tone: 'safe' },
        { id: 'deep',  icon: <ChevronsDown      size={32} />, label: L('Recua', 'Drop'), tone: 'risk' },
        { id: 'right', icon: <ArrowRightToLine  size={32} />, label: L('Dir', 'Right'),   tone: 'safe' },
      ]}
    />
  );
}

export function resolveGoalkeeperDistribution(attacker: GkDistributionChoice, defender: DefensivePressure): 'intercept' | 'progress' {
  const map: Record<GkDistributionChoice, DefensivePressure> = { left: 'left', long: 'deep', right: 'right' };
  return map[attacker] === defender ? 'intercept' : 'progress';
}
