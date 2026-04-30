/**
 * Decision Moment #2 — Saída de bola do goleiro.
 *
 * Atacante (manager da posse) escolhe distribuição: curto (rolar pro zaga),
 * médio (volante) ou lança (long ball pro atacante).
 *
 * Defensor adversário escolhe pressão: alta (corta médio/lança), media (cobre
 * volante) ou baixa (espera no campo). Se o palpite bater com o tipo de saída,
 * intercepta e recupera a posse.
 */
import { useCallback } from 'react';
import { DecisionPromptCard } from './DecisionPromptCard';

export type GkDistributionChoice = 'left' | 'long' | 'right';
export type DefensivePressure = 'left' | 'deep' | 'right';

export interface GoalkeeperDistributionProps {
  /** Side that the prompt is for: attacker chooses distribution. */
  onAttackerChoice: (choice: GkDistributionChoice) => void;
  onTimeout?: () => void;
}

export function GoalkeeperDistribution({
  onAttackerChoice,
  onTimeout,
}: GoalkeeperDistributionProps) {
  const handle = useCallback(
    (id: string) => onAttackerChoice(id as GkDistributionChoice),
    [onAttackerChoice],
  );

  return (
    <DecisionPromptCard
      title="Distribuição"
      timeoutMs={8000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'left', arrow: 'long-left', label: 'Lat Esq', tone: 'safe' },
        { id: 'long', arrow: 'long-up', label: 'Chutão', tone: 'risk' },
        { id: 'right', arrow: 'long-right', label: 'Lat Dir', tone: 'safe' },
      ]}
    />
  );
}

/** Defender's mirror choice — predict where the keeper will play. */
export function GoalkeeperPressure({
  onDefenderChoice,
  onTimeout,
}: {
  onDefenderChoice: (choice: DefensivePressure) => void;
  onTimeout?: () => void;
}) {
  const handle = useCallback(
    (id: string) => onDefenderChoice(id as DefensivePressure),
    [onDefenderChoice],
  );

  return (
    <DecisionPromptCard
      title="Pressão"
      timeoutMs={8000}
      onChoose={handle}
      onTimeout={onTimeout}
      choices={[
        { id: 'left', arrow: 'long-right', label: 'Esq', tone: 'safe' },
        { id: 'deep', arrow: 'tap-back', label: 'Recua', tone: 'risk' },
        { id: 'right', arrow: 'long-left', label: 'Dir', tone: 'safe' },
      ]}
    />
  );
}

/**
 * Resolve the outcome: defender predicts attacker's pressure-zone correctly →
 * intercept; mismatch → attacker keeps possession.
 *
 * Mapping (heuristic, can be tuned):
 *  - short ↔ high pressure (defender presses up high, blocks short pass)
 *  - medium ↔ mid pressure
 *  - long ↔ low pressure (defender drops, contests aerial)
 */
export function resolveGoalkeeperDistribution(
  attacker: GkDistributionChoice,
  defender: DefensivePressure,
): 'intercept' | 'progress' {
  const map: Record<GkDistributionChoice, DefensivePressure> = {
    left: 'left',
    long: 'deep',
    right: 'right',
  };
  return map[attacker] === defender ? 'intercept' : 'progress';
}
