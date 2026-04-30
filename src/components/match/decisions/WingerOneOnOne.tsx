import { useCallback } from 'react';
import { CornerDownLeft, CornerDownRight, Repeat2, CornerUpLeft, CornerUpRight, ArrowRight } from 'lucide-react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type WingerOneOnOneChoice = 'inside' | 'outside' | 'wallpass';

export function WingerOneOnOneAttacker({ onChoose, onTimeout }: { onChoose: (c: WingerOneOnOneChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as WingerOneOnOneChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="1×1"
      timeoutMs={6000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'inside',   icon: <CornerDownLeft  size={32} />, label: 'Dentro', tone: 'risk' },
        { id: 'outside',  icon: <CornerDownRight size={32} />, label: 'Fora',   tone: 'mid' },
        { id: 'wallpass', icon: <Repeat2         size={32} />, label: 'Tabela', tone: 'safe' },
      ]}
    />
  );
}

export function WingerOneOnOneDefender({ onChoose, onTimeout }: { onChoose: (c: WingerOneOnOneChoice) => void; onTimeout?: () => void }) {
  const handle = useCallback((id: string) => onChoose(id as WingerOneOnOneChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Marcação"
      timeoutMs={6000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'inside',   icon: <CornerUpLeft  size={32} />, label: 'Dentro', tone: 'risk' },
        { id: 'outside',  icon: <CornerUpRight size={32} />, label: 'Fora',   tone: 'mid' },
        { id: 'wallpass', icon: <ArrowRight    size={32} />, label: 'Press.',  tone: 'safe' },
      ]}
    />
  );
}

export function resolveWingerOneOnOne(att: WingerOneOnOneChoice, def: WingerOneOnOneChoice): 'intercept' | 'progress' {
  return att === def ? 'intercept' : 'progress';
}
