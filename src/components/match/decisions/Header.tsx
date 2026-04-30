import { useCallback } from 'react';
import { Swords, CornerRightDown, ArrowUpFromLine, PersonStanding, Wind, Minus } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type HeaderAttChoice = 'power' | 'flick' | 'lob';
export type HeaderDefChoice = 'jump' | 'anticipate' | 'line';

export function HeaderAttacker({ onChoose, onTimeout }: { onChoose: (c: HeaderAttChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as HeaderAttChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Cabeçada"
      timeoutMs={4000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'power', icon: <Swords          size={32} />, label: 'Firme',  tone: 'risk' },
        { id: 'flick', icon: <CornerRightDown size={32} />, label: 'Desvia', tone: 'mid' },
        { id: 'lob',   icon: <ArrowUpFromLine size={32} />, label: 'Picada', tone: 'safe' },
      ]}
    />
  );
}

export function HeaderDefender({ onChoose, onTimeout }: { onChoose: (c: HeaderDefChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as HeaderDefChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Marcação"
      timeoutMs={4000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'jump',       icon: <PersonStanding size={32} />, label: 'Salta', tone: 'risk' },
        { id: 'anticipate', icon: <Wind           size={32} />, label: 'Antec.', tone: 'mid' },
        { id: 'line',       icon: <Minus          size={32} />, label: 'Linha',  tone: 'safe' },
      ]}
    />
  );
}

export function resolveHeader(att: HeaderAttChoice, def: HeaderDefChoice): 'intercept' | 'progress' {
  const map: Record<HeaderAttChoice, HeaderDefChoice> = {
    power: 'jump', flick: 'anticipate', lob: 'line',
  };
  return map[att] === def ? 'intercept' : 'progress';
}
