import { useCallback } from 'react';
import { Crosshair, ArrowUpRight, ArrowRight, ShieldCheck, Wind, Shield } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type FreeKickChoice = 'shot' | 'cross' | 'short';

export function FreeKickAttacker({ onChoose, onTimeout }: { onChoose: (c: FreeKickChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as FreeKickChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Falta"
      timeoutMs={8000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'shot',  icon: <Crosshair    size={32} />, label: 'Chuta', tone: 'risk' },
        { id: 'cross', icon: <ArrowUpRight size={32} />, label: 'Cruza', tone: 'mid' },
        { id: 'short', icon: <ArrowRight   size={32} />, label: 'Toca',  tone: 'safe' },
      ]}
    />
  );
}

export function FreeKickDefender({ onChoose, onTimeout }: { onChoose: (c: FreeKickChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as FreeKickChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Barreira"
      timeoutMs={8000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'shot',  icon: <ShieldCheck size={32} />, label: 'Fixa',   tone: 'risk' },
        { id: 'cross', icon: <Wind        size={32} />, label: 'Antec.', tone: 'mid' },
        { id: 'short', icon: <Shield      size={32} />, label: 'Press.',  tone: 'safe' },
      ]}
    />
  );
}

export function resolveFreeKick(att: FreeKickChoice, def: FreeKickChoice): 'intercept' | 'progress' {
  return att === def ? 'intercept' : 'progress';
}
