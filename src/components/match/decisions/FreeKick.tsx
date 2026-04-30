/**
 * Decision Moment — Falta perigosa com barreira.
 *
 * Atacante: chuta direto / cruza / toca curto.
 * Defensor (mirror): barreira fixa / antecipa cruzamento / pressiona toque.
 * Match → defesa intercepta. Mismatch → progressão / chance.
 */
import { useCallback } from 'react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type FreeKickChoice = 'shot' | 'cross' | 'short';

export function FreeKickAttacker({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: FreeKickChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as FreeKickChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Falta"
      timeoutMs={8000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'shot', arrow: 'long-up', label: 'Chuta', tone: 'risk' },
        { id: 'cross', arrow: 'cross', label: 'Cruza', tone: 'mid' },
        { id: 'short', arrow: 'short-up', label: 'Toca', tone: 'safe' },
      ]}
    />
  );
}

export function FreeKickDefender({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: FreeKickChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as FreeKickChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Barreira"
      timeoutMs={8000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'shot', arrow: 'long-down', label: 'Fixa', tone: 'risk' },
        { id: 'cross', arrow: 'cross', label: 'Antec.', tone: 'mid' },
        { id: 'short', arrow: 'short-down', label: 'Press.', tone: 'safe' },
      ]}
    />
  );
}

export function resolveFreeKick(att: FreeKickChoice, def: FreeKickChoice): 'intercept' | 'progress' {
  return att === def ? 'intercept' : 'progress';
}
