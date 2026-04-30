/**
 * Decision Moment — Gegenpressing (perdeu a posse, decide reação imediata).
 *
 * Defensor (POV principal — quem perdeu): pressão coletiva / falta tática / recompõe.
 * Atacante (mirror — quem recuperou): toca curto / vertical / segura.
 */
import { useCallback } from 'react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type GegenpressDefChoice = 'swarm' | 'foul' | 'recover';
export type GegenpressAttChoice = 'short' | 'vertical' | 'hold';

export function GegenpressDefender({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: GegenpressDefChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as GegenpressDefChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Gegenpress"
      timeoutMs={4000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'swarm', arrow: 'fan-left', label: 'Press.', tone: 'risk' },
        { id: 'foul', arrow: 'cross', label: 'Falta', tone: 'mid' },
        { id: 'recover', arrow: 'tap-back', label: 'Recompõe', tone: 'safe' },
      ]}
    />
  );
}

export function GegenpressAttacker({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: GegenpressAttChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as GegenpressAttChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Saída"
      timeoutMs={4000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'short', arrow: 'short-up', label: 'Curto', tone: 'safe' },
        { id: 'vertical', arrow: 'long-up', label: 'Vertical', tone: 'risk' },
        { id: 'hold', arrow: 'tap-back', label: 'Segura', tone: 'mid' },
      ]}
    />
  );
}

export function resolveGegenpress(
  att: GegenpressAttChoice,
  def: GegenpressDefChoice,
): 'intercept' | 'progress' {
  const map: Record<GegenpressAttChoice, GegenpressDefChoice> = {
    short: 'swarm',
    vertical: 'recover',
    hold: 'foul',
  };
  return map[att] === def ? 'intercept' : 'progress';
}
