import { useState } from 'react';
import { PenaltyShoot } from '@/components/penalty';
import { L } from '@/i18n/L';
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
    homeLabel: L('BSC · Casa', 'BSC · Home'),
    awayLabel: L('ADV · Visitante', 'OPP · Away'),
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
      headerLabel={L('Olefoot · Disputa de Pênaltis', 'Olefoot · Penalty Shootout')}
      shooter={{
        id: 'adrien-ayo',
        displayName: 'Adrien Ayo',
        shirtNumber: 9,
        finishingRating: 78,
      }}
      keeper={{
        id: 'gk-adversario',
        displayName: L('Goleiro Adversário', 'Opponent Keeper'),
        readingRating: 72,
        positioningRating: 70,
        tendency: 'right',
      }}
      keeperHint={L('Goleiro lê bem o lado direito', 'Keeper reads the right side well')}
      shootoutContext={ctx}
      onResolved={handleResolved}
      onNextShooter={handleNextShooter}
      onReset={handleReset}
    />
  );
}

export default PenaltyPreview;
