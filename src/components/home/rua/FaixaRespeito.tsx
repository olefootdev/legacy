/**
 * Faixa de respeito — a pontuação do manager e o Pulso do clube na régua do
 * DS 2027 (barra de nível em segmentos, fio de rua à esquerda).
 * Saldo de moeda NUNCA aparece aqui: saldo é da Carteira.
 */
import type { ClubPulse } from '@/systems/clubPulse';
import { shouldShowTrend } from '@/systems/clubPulse';
import { BarraSegmentos, SeloRua } from '@/components/ui/Rua';
import { L, LOCALE } from '@/i18n/L';

export function FaixaRespeito({
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
    <section aria-label={L('Tua pontuação', 'Your score')} className="flex flex-col gap-4 border-l-[5px] border-rua bg-concreto px-[18px] py-4">
      <div className="flex min-w-0 items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.2em] text-papel">{L('Pontuação · T2027', 'Score · S2027')}</span>
          <span className="block min-w-0 truncate font-impact leading-none text-papel" style={{ fontSize: 'clamp(40px, 12vw, 60px)' }}>
            {scoreTotal.toLocaleString(LOCALE)}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {scoreToday > 0 && (
            <SeloRua tom="corre-contorno">
              +{scoreToday.toLocaleString(LOCALE)} {L('hoje', 'today')}
            </SeloRua>
          )}
          {rank != null && <SeloRua tom="ouro-contorno">#{rank} {L('no mundo', 'worldwide')}</SeloRua>}
        </div>
      </div>

      <div
        className="flex flex-col gap-2"
        aria-label={L(`Pulso do clube ${pulse.value} de 100 — ${pulse.label}`, `Club pulse ${pulse.value} of 100 — ${pulse.label}`)}
      >
        <div className="flex min-w-0 items-baseline justify-between gap-3 font-prova text-[12px] font-bold uppercase tracking-[0.1em]">
          <span className="min-w-0 truncate text-papel">
            {L('Pulso do clube', 'Club pulse')} · <span className="text-mudo">{pulse.label}</span>
          </span>
          <span className="shrink-0 text-ouro-27">
            {pulse.value}/100
            {showTrend && <span className="ml-1.5 text-papel">{pulse.trend === 'up' ? '▲' : '▼'}</span>}
          </span>
        </div>
        <BarraSegmentos valor={pulse.value} max={100} />
      </div>
    </section>
  );
}
