/**
 * Faixa de pontuação — sai de dentro do herói e vira uma linha só (A VIRADA · V4).
 * Um número grande (a pontuação), o ganho de hoje, a posição e o Pulso como
 * selo pequeno. Saldo de moeda NUNCA aparece aqui: saldo é da Carteira.
 */
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { ClubPulse } from '@/systems/clubPulse';
import { shouldShowTrend } from '@/systems/clubPulse';
import { L, LOCALE } from '@/i18n/L';

export function FaixaPontuacao({
  scoreTotal,
  scoreToday,
  rank,
  pulse,
}: {
  scoreTotal: number;
  scoreToday: number;
  rank: number | null;
  pulse: ClubPulse;
}) {
  const showTrend = shouldShowTrend(pulse);
  return (
    <section
      aria-label={L('Sua pontuação', 'Your score')}
      className="flex items-center justify-between gap-3 border border-white/10 bg-panel px-[18px] py-4"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="font-mono text-[10.5px] font-medium tracking-[0.2em] text-cimento">{L('SUA PONTUAÇÃO', 'YOUR SCORE')}</span>
        <span className="ole-num block min-w-0 truncate leading-none text-white" style={{ fontSize: 'clamp(24px, 8.4vw, 34px)' }}>
          {scoreTotal.toLocaleString(LOCALE)}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {scoreToday > 0 && (
          <span className="bg-alta px-[7px] py-[3px] font-mono text-[11px] font-semibold text-black">
            +{scoreToday.toLocaleString(LOCALE)} {L('hoje', 'today')}
          </span>
        )}
        {rank != null && (
          <span className="font-mono text-[11px] tracking-[0.1em] text-giz">#{rank} {L('NO MUNDO', 'WORLDWIDE')}</span>
        )}
        <span
          aria-label={L(`Pulso do clube ${pulse.value} de 100 — ${pulse.label}`, `Club pulse ${pulse.value} of 100 — ${pulse.label}`)}
          className="inline-flex h-[22px] items-center gap-1 border border-white/20 px-2 text-[11.5px] font-semibold text-giz"
        >
          {L('Pulso', 'Pulse')} {pulse.value}
          {showTrend &&
            (pulse.trend === 'up' ? (
              <ArrowUp aria-hidden className="h-3 w-3 text-alta" strokeWidth={3} />
            ) : (
              <ArrowDown aria-hidden className="h-3 w-3 text-baixa" strokeWidth={3} />
            ))}
        </span>
      </div>
    </section>
  );
}
