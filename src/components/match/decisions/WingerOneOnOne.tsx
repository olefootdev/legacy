/**
 * Decision Moment — Ponta no 1×1 contra lateral.
 *
 * Atacante: drible por dentro / drible por fora / tabela curta.
 * Defensor (mirror): fecha por dentro / fecha por fora / pressiona tabela.
 * Match → defesa intercepta. Mismatch → ponta passa, chance.
 */
import { useCallback } from 'react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type WingerOneOnOneChoice = 'inside' | 'outside' | 'wallpass';

export function WingerOneOnOneAttacker({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: WingerOneOnOneChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as WingerOneOnOneChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="1×1"
      timeoutMs={6000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'inside', arrow: 'curve-right', label: 'Dentro', tone: 'risk' },
        { id: 'outside', arrow: 'curve-left', label: 'Fora', tone: 'mid' },
        { id: 'wallpass', arrow: 'tap-back', label: 'Tabela', tone: 'safe' },
      ]}
    />
  );
}

export function WingerOneOnOneDefender({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: WingerOneOnOneChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as WingerOneOnOneChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Marcação"
      timeoutMs={6000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'inside', arrow: 'curve-left', label: 'Dentro', tone: 'risk' },
        { id: 'outside', arrow: 'curve-right', label: 'Fora', tone: 'mid' },
        { id: 'wallpass', arrow: 'short-up', label: 'Press.', tone: 'safe' },
      ]}
    />
  );
}

export function resolveWingerOneOnOne(
  att: WingerOneOnOneChoice,
  def: WingerOneOnOneChoice,
): 'intercept' | 'progress' {
  return att === def ? 'intercept' : 'progress';
}
