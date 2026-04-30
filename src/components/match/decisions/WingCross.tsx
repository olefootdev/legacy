/**
 * Decision Moment — Lateral chega no fundo (linha de fundo, prestes a cruzar).
 *
 * Atacante: cruza alto / entra na pequena área / toca pra trás (volante).
 * Defensor (mirror): bloqueia cruzamento / marca pequena área / cobre volante.
 * Match → defesa intercepta. Mismatch → chance clara.
 */
import { useCallback } from 'react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type WingCrossChoice = 'cross' | 'enter' | 'cutback';

export function WingCrossAttacker({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: WingCrossChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as WingCrossChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Lateral fundo"
      timeoutMs={6000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'cross', arrow: 'cross', label: 'Cruza', tone: 'mid' },
        { id: 'enter', arrow: 'long-left', label: 'Entra', tone: 'risk' },
        { id: 'cutback', arrow: 'tap-back', label: 'Toca', tone: 'safe' },
      ]}
    />
  );
}

export function WingCrossDefender({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: WingCrossChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as WingCrossChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Cobertura"
      timeoutMs={6000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'cross', arrow: 'cross', label: 'Bloq.', tone: 'mid' },
        { id: 'enter', arrow: 'long-right', label: 'Marca', tone: 'risk' },
        { id: 'cutback', arrow: 'short-up', label: 'Cobre', tone: 'safe' },
      ]}
    />
  );
}

export function resolveWingCross(att: WingCrossChoice, def: WingCrossChoice): 'intercept' | 'progress' {
  return att === def ? 'intercept' : 'progress';
}
