/**
 * Decision Moment — Atacante recebe de costas pro gol.
 *
 * Atacante: segura/protege / vira pro gol / chuta de primeira / toca pro apoio.
 * Defensor (mirror): cola corpo / antecipa giro / fecha chute / corta passe.
 * Match → defesa intercepta. Mismatch → progressão / chance.
 */
import { useCallback } from 'react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type AttackerReceivesChoice = 'hold' | 'turn' | 'shoot' | 'lay';

export function AttackerReceivesAttacker({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: AttackerReceivesChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as AttackerReceivesChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Recepção"
      timeoutMs={7000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'hold', arrow: 'tap-back', label: 'Segura', tone: 'safe' },
        { id: 'turn', arrow: 'curve-right', label: 'Vira', tone: 'mid' },
        { id: 'shoot', arrow: 'long-up', label: 'Chuta', tone: 'risk' },
        { id: 'lay', arrow: 'short-down', label: 'Toca', tone: 'safe' },
      ]}
    />
  );
}

export function AttackerReceivesDefender({
  onChoose,
  onTimeout,
}: {
  onChoose: (c: AttackerReceivesChoice) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback((id: string) => onChoose(id as AttackerReceivesChoice), [onChoose]);
  return (
    <DecisionPromptCard
      title="Marcação"
      timeoutMs={7000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'hold', arrow: 'short-up', label: 'Cola', tone: 'safe' },
        { id: 'turn', arrow: 'curve-left', label: 'Antec.', tone: 'mid' },
        { id: 'shoot', arrow: 'long-down', label: 'Fecha', tone: 'risk' },
        { id: 'lay', arrow: 'short-up', label: 'Corta', tone: 'safe' },
      ]}
    />
  );
}

export function resolveAttackerReceives(
  att: AttackerReceivesChoice,
  def: AttackerReceivesChoice,
): 'intercept' | 'progress' {
  return att === def ? 'intercept' : 'progress';
}
