import type { ReactNode } from 'react';

const SERIF = 'var(--font-serif-hero)';

/**
 * Stat card do padrão DS: rail 3px à esquerda (cor = intenção), label display
 * em dourado e número grande em serifa itálica. Reusado em Treino/Staff/Academia.
 */
export function RailStat({
  label,
  value,
  hint,
  rail = 'var(--color-neon-yellow)',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  rail?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-white/10 bg-[#1c1c1c] py-3.5 pl-[18px] pr-3">
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: rail }} aria-hidden />
      <div className="font-display text-[10px] font-semibold uppercase tracking-[0.13em] text-neon-yellow">{label}</div>
      <div className="mt-1 italic leading-none text-white" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: '32px' }}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[10px] text-white/40">{hint}</div>}
    </div>
  );
}
