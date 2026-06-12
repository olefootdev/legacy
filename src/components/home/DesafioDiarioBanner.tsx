/**
 * DesafioDiarioBanner — resumo dos desafios diários no padrão StatBanner.
 * Mostra progresso (X/3) + EXP a ganhar, com Resgatar quando há recompensa.
 */

import { Gift } from 'lucide-react';
import { useGameStore, useGameDispatch } from '@/game/store';
import { StatBanner } from './StatBanner';

export function DesafioDiarioBanner() {
  const dispatch = useGameDispatch();
  const daily = useGameStore((s) => s.dailyChallenges);
  const challenges = daily?.challenges ?? [];
  if (challenges.length === 0) return null;

  const completed = challenges.filter((c) => c.completed).length;
  const total = challenges.length;
  const claimable = challenges.filter((c) => c.completed && !c.claimed);
  const claimableExp = claimable.reduce((s, c) => s + c.reward, 0);
  const totalExp = challenges.reduce((s, c) => s + c.reward, 0);
  const next = challenges.find((c) => !c.completed);

  const value = claimable.length
    ? `+${claimableExp} EXP a resgatar`
    : completed === total
      ? 'Todos completos!'
      : `${completed}/${total} concluídos`;
  const sub = next
    ? `Próximo: ${next.title} (${next.progress}/${next.target})`
    : claimable.length
      ? 'Toque em resgatar'
      : `${totalExp} EXP no total · volte amanhã`;

  return (
    <StatBanner
      tone={claimable.length ? 'yellow' : completed === total ? 'green' : 'neutral'}
      glow={claimable.length > 0}
      icon={<Gift size={18} />}
      eyebrow={`Desafio Diário · ${completed}/${total}`}
      value={value}
      sub={sub}
      cta={claimable.length ? { label: 'Resgatar', onClick: () => dispatch({ type: 'CLAIM_CHALLENGE_REWARD', challengeId: claimable[0]!.id }) } : undefined}
    />
  );
}
