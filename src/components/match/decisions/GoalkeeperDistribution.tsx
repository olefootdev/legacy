import { useCallback } from 'react';
import { MoveLeft, MoveRight, ChevronsUp, ArrowLeftToLine, ArrowRightToLine, ChevronsDown } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';

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
      title="Distribuição"
      timeoutMs={8000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'left',  icon: <MoveLeft  size={32} />, label: 'Lat Esq', tone: 'safe' },
        { id: 'long',  icon: <ChevronsUp size={32} />, label: 'Chutão', tone: 'risk' },
        { id: 'right', icon: <MoveRight size={32} />, label: 'Lat Dir', tone: 'safe' },
      ]}
    />
  );
}

export function GoalkeeperPressure({ onDefenderChoice, onTimeout }: { onDefenderChoice: (choice: DefensivePressure) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onDefenderChoice(id as DefensivePressure), [onDefenderChoice]);
  return (
    <DecisionPromptCard
      title="Pressão"
      timeoutMs={8000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'left',  icon: <ArrowLeftToLine  size={32} />, label: 'Esq',   tone: 'safe' },
        { id: 'deep',  icon: <ChevronsDown      size={32} />, label: 'Recua', tone: 'risk' },
        { id: 'right', icon: <ArrowRightToLine  size={32} />, label: 'Dir',   tone: 'safe' },
      ]}
    />
  );
}

export function resolveGoalkeeperDistribution(attacker: GkDistributionChoice, defender: DefensivePressure): 'intercept' | 'progress' {
  const map: Record<GkDistributionChoice, DefensivePressure> = { left: 'left', long: 'deep', right: 'right' };
  return map[attacker] === defender ? 'intercept' : 'progress';
}
