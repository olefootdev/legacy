/**
 * Missões do dia na Home 2027 (DS, peças 2c/3a) — a lista inteira à vista,
 * sem gaveta: feita = quadrado cheio e risco; pronta pra resgatar = rua cheia
 * com o botão; andando = contorno; parada = tracejado (degrau CHÃO).
 *
 * O resgate (CLAIM_CHALLENGE_REWARD) só existe na Home — por isso ele mora
 * aqui e não num link pra outra tela.
 */
import { cn } from '@/lib/utils';
import { SecaoRua, SeloRua } from '@/components/ui/Rua';
import type { DailyChallenge } from '@/game/dailyChallenges';
import { L, LOCALE } from '@/i18n/L';

export function MissoesRua({
  challenges,
  streak,
  onClaim,
}: {
  challenges: DailyChallenge[];
  streak?: number;
  onClaim: (challengeId: string) => void;
}) {
  if (challenges.length === 0) return null;
  const done = challenges.filter((c) => c.completed).length;

  return (
    <section aria-label={L('Missões do dia', "Today's missions")} className="flex flex-col gap-3">
      <SecaoRua label={L('Missões do dia', "Today's missions")} aside={`${done}/${challenges.length}`} />
      {streak != null && streak > 1 && (
        <SeloRua tom="corre-contorno" className="self-start">
          {L(`${streak} dias seguidos`, `${streak}-day streak`)}
        </SeloRua>
      )}
      <ul className="flex flex-col">
        {challenges.map((c) => {
          const claimable = c.completed && !c.claimed;
          const moving = !c.completed && c.progress > 0;
          return (
            <li key={c.id} className="flex min-w-0 items-center gap-3.5 border-b border-linha py-3.5 last:border-b-0">
              <span
                aria-hidden
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center font-impact text-[17px] leading-none',
                  c.claimed && 'bg-rua text-asfalto-27',
                  claimable && 'bg-rua',
                  moving && 'border-2 border-rua',
                  !c.completed && !moving && 'border-2 border-dashed border-fio',
                )}
              >
                {c.claimed ? '✓' : ''}
              </span>
              <div className="flex min-w-0 grow flex-col gap-1">
                <span
                  className={cn(
                    'block min-w-0 truncate font-voz text-[23px] leading-none',
                    c.claimed ? 'text-mudo line-through decoration-2' : 'text-papel',
                  )}
                >
                  {c.title}
                </span>
                <span className="block min-w-0 truncate font-prova text-[12px] text-mudo">
                  {c.description} · {c.claimed ? L('resgatado', 'claimed') : `${Math.min(c.progress, c.target)}/${c.target}`}
                </span>
              </div>
              {claimable ? (
                <button
                  type="button"
                  onClick={() => onClaim(c.id)}
                  className="inline-flex min-h-[44px] shrink-0 items-center bg-rua px-3.5 font-impact text-[17px] uppercase leading-none text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--color-papel)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rua"
                >
                  {L('Pegar', 'Claim')} +{c.reward.toLocaleString(LOCALE)}
                </button>
              ) : (
                <span className={cn('shrink-0 font-impact text-[24px] leading-none', c.claimed ? 'text-mudo' : 'text-rua')}>
                  +{c.reward.toLocaleString(LOCALE)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <span className="font-prova text-[11px] uppercase tracking-[0.18em] text-mudo">{L('Recompensa em EXP · reseta 00h UTC', 'Rewards in EXP · resets 00h UTC')}</span>
    </section>
  );
}
