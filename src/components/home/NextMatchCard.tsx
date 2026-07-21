/**
 * NextMatchCard — módulo "Próxima Partida" do layout v3.
 *
 * Card cinematográfico com o confronto da próxima rodada da Liga Global,
 * countdown ao vivo e o selo Nemesis quando o adversário é o algoz da última
 * Liga Ole (revanche). Dados por props — Home liga em useNextGlobalFixture +
 * state.ligaOleNemesis. Se não houver rodada agendada, mostra empty-state.
 */

import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export function NextMatchCard({
  clubName,
  opponentName,
  countdownLabel,
  isLive,
  isNemesis,
}: {
  clubName: string;
  opponentName: string | null;
  countdownLabel: string | null;
  isLive: boolean;
  isNemesis: boolean;
}) {
  return (
    <section
      aria-label="Próxima partida"
      className="border border-[var(--color-border)] bg-dark-gray p-4"
      style={{ borderRadius: 'var(--radius-md)' }}
    >
      <div className="flex items-center justify-between">
        <span
          className="font-display font-black uppercase text-white/45"
          style={{ fontSize: '9px', letterSpacing: '0.2em' }}
        >
          Próxima partida
        </span>
        {opponentName ? (
          <span
            className="inline-flex items-center gap-1.5 font-display font-black uppercase"
            style={{ fontSize: '8px', letterSpacing: '0.12em', color: isLive ? 'var(--color-danger)' : 'var(--color-text-soft)' }}
          >
            {isLive && <i aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-danger)' }} />}
            {isLive ? 'Ao vivo' : 'Começa em'}
          </span>
        ) : null}
      </div>

      {opponentName ? (
        <>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex flex-1 flex-col items-center gap-1.5">
              <span aria-hidden className="h-7 w-7 rounded-md bg-neon-yellow" style={{ border: '1px solid var(--color-border)' }} />
              <span className="font-impact uppercase text-white" style={{ fontSize: '11px' }}>
                {clubName}
              </span>
            </div>
            <div className="text-center">
              <span className="block font-impact tabular-nums text-white" style={{ fontSize: '26px', lineHeight: 0.9 }}>
                {countdownLabel ?? '—'}
              </span>
              <span
                className="mt-0.5 block font-display font-black uppercase text-white/40"
                style={{ fontSize: '8px', letterSpacing: '0.14em' }}
              >
                Rodada Global
              </span>
            </div>
            <div className="flex flex-1 flex-col items-center gap-1.5">
              <span aria-hidden className="h-7 w-7 rounded-md bg-[#232323]" style={{ border: '1px solid var(--color-border)' }} />
              <span className="max-w-full truncate font-impact uppercase text-white" style={{ fontSize: '11px' }}>
                {opponentName}
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            {isNemesis ? (
              <span
                className="inline-flex items-center font-display font-black uppercase"
                style={{
                  fontSize: '8.5px',
                  letterSpacing: '0.12em',
                  color: 'var(--color-danger)',
                  border: '1px solid rgba(255,61,61,0.4)',
                  background: 'rgba(255,61,61,0.08)',
                  padding: '3px 8px',
                  borderRadius: '999px',
                }}
              >
                Nemesis · revanche
              </span>
            ) : (
              <span />
            )}
            <Link
              to="/competicao/standings"
              className="inline-flex min-h-[44px] items-center gap-1 font-display font-black uppercase text-white/55 transition-colors hover:text-neon-yellow"
              style={{ fontSize: '9px', letterSpacing: '0.16em' }}
            >
              Ver liga
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-white/55" style={{ fontFamily: 'var(--font-sans)', fontSize: '12px' }}>
            Sem rodada agendada.
          </p>
          <Link
            to="/competicao/standings"
            className="inline-flex min-h-[44px] items-center gap-1 font-display font-black uppercase text-white/55 transition-colors hover:text-neon-yellow"
            style={{ fontSize: '9px', letterSpacing: '0.16em' }}
          >
            Ver liga
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}
    </section>
  );
}
