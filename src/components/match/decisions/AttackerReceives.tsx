import { useCallback } from 'react';
import { Shield, RotateCw, Crosshair, ArrowDownLeft, PersonStanding, RefreshCw, Swords, ArrowUpLeft } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';
import { L } from '@/i18n/L';

export type AttackerReceivesChoice = 'hold' | 'turn' | 'shoot' | 'lay';

export function AttackerReceivesAttacker({ onChoose, onTimeout }: { onChoose: (c: AttackerReceivesChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as AttackerReceivesChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title={L('Recepção', 'Receive')}
      timeoutMs={7000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'hold',  icon: <Shield       size={32} />, label: L('Segura', 'Hold'), tone: 'safe' },
        { id: 'turn',  icon: <RotateCw     size={32} />, label: L('Vira', 'Turn'),   tone: 'mid' },
        { id: 'shoot', icon: <Crosshair    size={32} />, label: L('Chuta', 'Shoot'),  tone: 'risk' },
        { id: 'lay',   icon: <ArrowDownLeft size={32} />, label: L('Toca', 'Pass'),   tone: 'safe' },
      ]}
    />
  );
}

export function AttackerReceivesDefender({ onChoose, onTimeout }: { onChoose: (c: AttackerReceivesChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as AttackerReceivesChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title={L('Marcação', 'Marking')}
      timeoutMs={7000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'hold',  icon: <PersonStanding size={32} />, label: L('Cola', 'Tight'),   tone: 'safe' },
        { id: 'turn',  icon: <RefreshCw      size={32} />, label: L('Antec.', 'Antic.'), tone: 'mid' },
        { id: 'shoot', icon: <Swords         size={32} />, label: L('Fecha', 'Close'),  tone: 'risk' },
        { id: 'lay',   icon: <ArrowUpLeft    size={32} />, label: L('Corta', 'Cut'),  tone: 'safe' },
      ]}
    />
  );
}

export function resolveAttackerReceives(att: AttackerReceivesChoice, def: AttackerReceivesChoice): 'intercept' | 'progress' {
  return att === def ? 'intercept' : 'progress';
}
