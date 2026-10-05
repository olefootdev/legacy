import { useCallback } from 'react';
import { Users, Ban, RotateCcw, ArrowRight, ChevronsUp, Shield } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';
import { L } from '@/i18n/L';

export type GegenpressDefChoice = 'swarm' | 'foul' | 'recover';
export type GegenpressAttChoice = 'short' | 'vertical' | 'hold';

export function GegenpressDefender({ onChoose, onTimeout }: { onChoose: (c: GegenpressDefChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as GegenpressDefChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Gegenpress"
      timeoutMs={4000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'swarm',   icon: <Users     size={32} />, label: L('Press.', 'Press'),    tone: 'risk' },
        { id: 'foul',    icon: <Ban       size={32} />, label: L('Falta', 'Foul'),     tone: 'mid' },
        { id: 'recover', icon: <RotateCcw size={32} />, label: L('Recompõe', 'Recover'), tone: 'safe' },
      ]}
    />
  );
}

export function GegenpressAttacker({ onChoose, onTimeout }: { onChoose: (c: GegenpressAttChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as GegenpressAttChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title={L('Saída', 'Build-up')}
      timeoutMs={4000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'short',    icon: <ArrowRight size={32} />, label: L('Curto', 'Short'),    tone: 'safe' },
        { id: 'vertical', icon: <ChevronsUp size={32} />, label: L('Vertical', 'Direct'), tone: 'risk' },
        { id: 'hold',     icon: <Shield     size={32} />, label: L('Segura', 'Hold'),   tone: 'mid' },
      ]}
    />
  );
}

export function resolveGegenpress(att: GegenpressAttChoice, def: GegenpressDefChoice): 'intercept' | 'progress' {
  const map: Record<GegenpressAttChoice, GegenpressDefChoice> = {
    short: 'swarm', vertical: 'recover', hold: 'foul',
  };
  return map[att] === def ? 'intercept' : 'progress';
}
