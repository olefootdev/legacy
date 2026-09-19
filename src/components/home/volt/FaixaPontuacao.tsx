/**
 * Faixa de pontuação — sai de dentro do herói e vira uma linha só (A VIRADA · V4).
 * Um número grande (a pontuação), o ganho de hoje, a posição e o Pulso como
 * selo pequeno. Saldo de moeda NUNCA aparece aqui: saldo é da Carteira.
 */
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { ClubPulse } from '@/systems/clubPulse';
import { shouldShowTrend } from '@/systems/clubPulse';

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
      aria-label="Sua pontuação"
      className="flex items-center justify-between gap-3 border border-white/10 bg-panel px-[18px] py-4"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="font-mono text-[10.5px] font-medium tracking-[0.2em] text-cimento">SUA PONTUAÇÃO</span>
        <span className="ole-num block min-w-0 truncate leading-none text-white" style={{ fontSize: 'clamp(24px, 8.4vw, 34px)' }}>
          {scoreTotal.toLocaleString('pt-BR')}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {scoreToday > 0 && (
          <span className="bg-alta px-[7px] py-[3px] font-mono text-[11px] font-semibold text-black">
            +{scoreToday.toLocaleString('pt-BR')} hoje
          </span>
        )}
        {rank != null && (
          <span className="font-mono text-[11px] tracking-[0.1em] text-giz">#{rank} NO MUNDO</span>
        )}
        <span
          aria-label={`Pulso do clube ${pulse.value} de 100 — ${pulse.label}`}
          className="inline-flex h-[22px] items-center gap-1 border border-white/20 px-2 text-[11.5px] font-semibold text-giz"
        >
          Pulso {pulse.value}
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
