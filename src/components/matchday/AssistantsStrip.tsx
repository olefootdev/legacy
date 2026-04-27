/**
 * Tira visual dos 5 assistentes — mostra eficácia + pulsa quando relay ativo.
 * Fica logo acima do VoiceCommandPanel.
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import {
  ASSISTANT_GLYPH,
  ASSISTANT_LABEL,
  type AssistantRole,
} from '@/voiceCommand/types';
import {
  DEFAULT_ASSISTANT_STAFF,
  qualityFromEffectiveness,
  type RelayQuality,
} from '@/voiceCommand/assistantRelay';

const ORDER: AssistantRole[] = ['tatico', 'ataque', 'defesa', 'fisico', 'mental'];

const QUALITY_COLOR: Record<RelayQuality, string> = {
  clean: 'text-emerald-300',
  basic: 'text-sky-300',
  partial_loss: 'text-amber-300',
  distorted: 'text-rose-300',
};

export function AssistantsStrip({
  lastActive,
  overrides,
}: {
  /** Role recém-ativado (pulsa por 1.5s). Reseta depois. */
  lastActive?: AssistantRole | null;
  /** Overrides de eficácia por role (vindo do save, opcional). */
  overrides?: Partial<Record<AssistantRole, { effectiveness: number; name?: string }>>;
}) {
  const [pulseRole, setPulseRole] = useState<AssistantRole | null>(null);

  useEffect(() => {
    if (!lastActive) return;
    setPulseRole(lastActive);
    const t = window.setTimeout(() => setPulseRole(null), 1500);
    return () => window.clearTimeout(t);
  }, [lastActive]);

  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2 sm:px-3 sm:py-2.5">
      <p className="mb-1 text-[9px] font-display font-bold uppercase tracking-widest text-white/50">
        Comissão técnica
      </p>
      <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
        {ORDER.map((role) => {
          const staff = overrides?.[role] ?? DEFAULT_ASSISTANT_STAFF[role];
          const eff = Math.round(staff.effectiveness);
          const quality = qualityFromEffectiveness(eff);
          const isPulsing = pulseRole === role;
          return (
            <motion.div
              key={role}
              animate={isPulsing ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={{ duration: 0.45 }}
              className={cn(
                'rounded-lg border px-1.5 py-1 text-center transition-colors',
                isPulsing
                  ? 'border-violet-400 bg-violet-500/25 shadow-[0_0_12px_rgba(167,139,250,0.5)]'
                  : 'border-white/10 bg-white/[0.03]',
              )}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-base leading-none">{ASSISTANT_GLYPH[role]}</span>
                <span className="text-[7px] font-bold uppercase tracking-wider text-white/60 leading-tight truncate max-w-full">
                  {ASSISTANT_LABEL[role].replace(/Auxiliar\s+|Preparador\s+/i, '').slice(0, 8)}
                </span>
                <span className={cn('font-mono text-[10px] font-black tabular-nums leading-none', QUALITY_COLOR[quality])}>
                  {eff}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
