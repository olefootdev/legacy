import { useCallback } from 'react';
import { Crosshair, ArrowUpRight, ArrowRight, ShieldCheck, Wind, Shield } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';
import { L } from '@/i18n/L';

export type FreeKickChoice = 'shot' | 'cross' | 'short';

export function FreeKickAttacker({ onChoose, onTimeout }: { onChoose: (c: FreeKickChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as FreeKickChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title={L('Falta', 'Free kick')}
      timeoutMs={8000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'shot',  icon: <Crosshair    size={32} />, label: L('Chuta', 'Shoot'), tone: 'risk' },
        { id: 'cross', icon: <ArrowUpRight size={32} />, label: L('Cruza', 'Cross'), tone: 'mid' },
        { id: 'short', icon: <ArrowRight   size={32} />, label: L('Toca', 'Pass'),  tone: 'safe' },
      ]}
    />
  );
}

export function FreeKickDefender({ onChoose, onTimeout }: { onChoose: (c: FreeKickChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as FreeKickChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title={L('Barreira', 'Wall')}
      timeoutMs={8000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'shot',  icon: <ShieldCheck size={32} />, label: L('Fixa', 'Hold'),   tone: 'risk' },
        { id: 'cross', icon: <Wind        size={32} />, label: L('Antec.', 'Antic.'), tone: 'mid' },
        { id: 'short', icon: <Shield      size={32} />, label: L('Press.', 'Press'),  tone: 'safe' },
      ]}
    />
  );
}

export function resolveFreeKick(att: FreeKickChoice, def: FreeKickChoice): 'intercept' | 'progress' {
  return att === def ? 'intercept' : 'progress';
}
