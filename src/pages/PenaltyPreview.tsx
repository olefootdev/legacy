import { useState } from 'react';
import { PenaltyShoot } from '@/components/penalty';
import type {
  PenaltyShootResult,
  ShootoutContext,
  ShotResult,
} from '@/components/penalty';

const SHOOTOUT_ROUNDS = 5;

/**
 * Demo standalone do componente <PenaltyShoot />, mantém o fluxo de disputa
 * (5 batedores cada lado) que tinha no protótipo original.
 */
export function PenaltyPreview() {
  const [homeShots, setHomeShots] = useState<ShotResult[]>([
    'goal',
    'goal',
    'pending',
    'pending',
    'pending',
  ]);
  const [awayShots, setAwayShots] = useState<ShotResult[]>([
    'goal',
    'save',
    'pending',
    'pending',
    'pending',
  ]);
  const [currentShooter, setCurrentShooter] = useState(2);
  const [reseed, setReseed] = useState(0);

  const ctx: ShootoutContext = {
    homeShots,
    awayShots,
    currentShooter,
    rounds: SHOOTOUT_ROUNDS,
    homeLabel: 'BSC · Casa',
    awayLabel: 'ADV · Visitante',
  };

  function handleResolved(result: PenaltyShootResult) {
    const isGoal = result.outcome === 'goal';
    const next: ShotResult = isGoal ? 'goal' : 'save';
    const nextHome = [...homeShots];
    nextHome[currentShooter] = next;
    setHomeShots(nextHome);

    if (currentShooter < SHOOTOUT_ROUNDS - 1) {
      const nextAway = [...awayShots];
      nextAway[currentShooter + 1] = Math.random() > 0.3 ? 'goal' : 'save';
      setAwayShots(nextAway);
    }
  }

  function handleNextShooter() {
    setCurrentShooter((c) => Math.min(c + 1, SHOOTOUT_ROUNDS - 1));
  }

  function handleReset() {
    setHomeShots(['pending', 'pending', 'pending', 'pending', 'pending']);
    setAwayShots(['pending', 'pending', 'pending', 'pending', 'pending']);
    setCurrentShooter(0);
    setReseed((s) => s + 1);
  }

  return (
    <PenaltyShoot
      key={reseed}
      headerLabel="Olefoot · Disputa de Pênaltis"
      shooter={{
        id: 'adrien-ayo',
        displayName: 'Adrien Ayo',
        shirtNumber: 9,
        finishingRating: 78,
      }}
      keeper={{
        id: 'gk-adversario',
        displayName: 'Goleiro Adversário',
        readingRating: 72,
        positioningRating: 70,
        tendency: 'right',
      }}
      keeperHint="Goleiro lê bem o lado direito"
      shootoutContext={ctx}
      onResolved={handleResolved}
      onNextShooter={handleNextShooter}
      onReset={handleReset}
    />
  );
}

export default PenaltyPreview;
