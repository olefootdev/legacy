/**
 * ChallengeSlide — um desafio diário como slide do HomeBannerSlider.
 *
 * Reaproveita os mapas de ícone/cor do DailyChallengesCard. Mesma altura/peso
 * dos outros banners pra o carrossel ficar coeso.
 */

import { motion } from 'motion/react';
import type { DailyChallenge } from '@/game/dailyChallenges';
import { CHALLENGE_ICONS, CHALLENGE_COLORS } from '@/components/match/DailyChallengesCard';

export function ChallengeSlide({ challenge, onClaim }: {
  challenge: DailyChallenge;
  onClaim: (id: string) => void;
}) {
  const Icon = CHALLENGE_ICONS[challenge.type];
  const color = CHALLENGE_COLORS[challenge.type];
  const pct = Math.min(100, (challenge.progress / challenge.target) * 100);

  return (
    <div
      className="w-full px-5 py-6 border bg-gradient-to-br from-gray-900 to-black"
      style={{ borderRadius: 'var(--radius-md)', borderColor: challenge.completed ? 'var(--color-neon-yellow)' : 'rgba(255,255,255,0.1)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}22`, border: `2px solid ${color}` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </span>
        <span className="font-display uppercase tracking-[0.26em] text-[10px] font-black text-white/45">Desafio Diário</span>
        <span className="ml-auto font-display uppercase tracking-[0.1em] text-[11px] font-black text-neon-yellow">+{challenge.reward} EXP</span>
      </div>

      <p className="text-white leading-tight mb-1" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(18px, 5vw, 24px)', textTransform: 'uppercase', letterSpacing: '0.01em' }}>
        {challenge.title}
      </p>
      <p className="text-white/55 text-[12px] mb-4 leading-snug">{challenge.description}</p>

      <div className="relative h-2 bg-black/60 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: challenge.completed ? `linear-gradient(to right, ${color}, var(--color-neon-yellow))` : `linear-gradient(to right, ${color}80, ${color})` }}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="font-display tabular-nums text-[11px] font-bold text-white/55">{challenge.progress}/{challenge.target}</span>
        {challenge.completed && !challenge.claimed && (
          <button
            type="button"
            onClick={() => onClaim(challenge.id)}
            className="bg-neon-yellow text-black px-4 py-1.5 rounded-full font-display uppercase tracking-[0.12em] text-[11px] font-black active:scale-95 transition-transform"
          >
            Resgatar
          </button>
        )}
        {challenge.claimed && <span className="font-display uppercase tracking-[0.1em] text-[10px] font-black text-success">✓ Resgatado</span>}
      </div>
    </div>
  );
}
