/**
 * Decision Moment — Última linha (zagueiro decide entre subir, segurar, recuar).
 *
 * Defensor (POV principal): sobe linha / segura / recua.
 * Atacante (mirror): pisada profunda / pé direção / drible curto.
 * Match → impedimento/recuperação. Mismatch → enfiada / chance.
 */
import { useCallback } from 'react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type LastLineDefChoice = 'push' | 'hold' | 'drop';
export type LastLineAttChoice = 'through' | 'feet' | 'dribble';

export function LastLineDefender({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: LastLineDefChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as LastLineDefChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Última linha"
      timeoutMs={5000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'push', arrow: 'long-up', label: 'Sobe', tone: 'risk' },
        { id: 'hold', arrow: 'short-up', label: 'Segura', tone: 'mid' },
        { id: 'drop', arrow: 'tap-back', label: 'Recua', tone: 'safe' },
      ]}
    />
  );
}

export function LastLineAttacker({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: LastLineAttChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as LastLineAttChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Lançamento"
      timeoutMs={5000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'through', arrow: 'long-up', label: 'Enfia', tone: 'risk' },
        { id: 'feet', arrow: 'short-up', label: 'No Pé', tone: 'mid' },
        { id: 'dribble', arrow: 'curve-right', label: 'Drible', tone: 'safe' },
      ]}
    />
  );
}

export function resolveLastLine(
  att: LastLineAttChoice,
  def: LastLineDefChoice,
): 'intercept' | 'progress' {
  const map: Record<LastLineAttChoice, LastLineDefChoice> = {
    through: 'push',
    feet: 'hold',
    dribble: 'drop',
  };
  return map[att] === def ? 'intercept' : 'progress';
}
