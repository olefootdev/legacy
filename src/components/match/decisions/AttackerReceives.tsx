import { useCallback } from 'react';
import { Shield, RotateCw, Crosshair, ArrowDownLeft, PersonStanding, RefreshCw, Swords, ArrowUpLeft } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type AttackerReceivesChoice = 'hold' | 'turn' | 'shoot' | 'lay';

export function AttackerReceivesAttacker({ onChoose, onTimeout }: { onChoose: (c: AttackerReceivesChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as AttackerReceivesChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Recepção"
      timeoutMs={7000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'hold',  icon: <Shield       size={32} />, label: 'Segura', tone: 'safe' },
        { id: 'turn',  icon: <RotateCw     size={32} />, label: 'Vira',   tone: 'mid' },
        { id: 'shoot', icon: <Crosshair    size={32} />, label: 'Chuta',  tone: 'risk' },
        { id: 'lay',   icon: <ArrowDownLeft size={32} />, label: 'Toca',   tone: 'safe' },
      ]}
    />
  );
}

export function AttackerReceivesDefender({ onChoose, onTimeout }: { onChoose: (c: AttackerReceivesChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as AttackerReceivesChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Marcação"
      timeoutMs={7000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'hold',  icon: <PersonStanding size={32} />, label: 'Cola',   tone: 'safe' },
        { id: 'turn',  icon: <RefreshCw      size={32} />, label: 'Antec.', tone: 'mid' },
        { id: 'shoot', icon: <Swords         size={32} />, label: 'Fecha',  tone: 'risk' },
        { id: 'lay',   icon: <ArrowUpLeft    size={32} />, label: 'Corta',  tone: 'safe' },
      ]}
    />
  );
}

export function resolveAttackerReceives(att: AttackerReceivesChoice, def: AttackerReceivesChoice): 'intercept' | 'progress' {
  return att === def ? 'intercept' : 'progress';
}
