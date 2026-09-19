/**
 * A divisão do manager na Home VOLT2 — 5 linhas em volta dele, a linha da zona
 * de acesso e quanto falta (A VIRADA · V4).
 *
 * A ordem e a zona saem de `buildDivisionView`, que repete a regra de
 * promoção do motor da liga — não da nota composta do ranking geral.
 */
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Hashtag, SecaoVolt, UmaLinha } from '@/components/ui';
import { globalDivisionName } from '@/match/globalLeagueMVP';
import type { DivisionView, StandingRow } from '@/ranking/divisionStandings';

export function DivisaoTabela({
  view,
  roundsLeft,
  nextOpponent,
}: {
  view: DivisionView;
  roundsLeft: number | null;
  /** Adversário da próxima rodada — ganha o selo HOJE/PRÓXIMO na tabela. */
  nextOpponent: { name: string; isToday: boolean } | null;
}) {
  const hasAccess = view.promotionCount > 0;
  const tag = [
    hasAccess ? `#sobem${view.promotionCount}` : '#título',
    roundsLeft ? `${roundsLeft} rodada${roundsLeft > 1 ? 's' : ''}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const opp = nextOpponent?.name.trim().toLowerCase() ?? null;

  return (
    <section aria-label={`Sua divisão — ${globalDivisionName(view.division)}`} className="flex flex-col gap-3">
      <SecaoVolt label={`Divisão ${view.division} · ${globalDivisionName(view.division)}`} tone="neutro">
        <Hashtag>{tag}</Hashtag>
      </SecaoVolt>

      <div className="border border-white/10 bg-panel">
        {view.window.map((row) => (
          <div key={row.id}>
            <Linha
              row={row}
              inZone={hasAccess && row.pos <= view.promotionCount}
              chip={opp && row.team.trim().toLowerCase() === opp ? (nextOpponent!.isToday ? 'HOJE' : 'PRÓXIMO') : null}
            />
            {view.zoneAfterPos === row.pos && (
              <div className="flex h-6 items-center gap-2 px-4" aria-label="Zona de acesso acima desta linha">
                <span className="block h-0 grow border-t border-dashed border-alta" />
                <span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-alta">ZONA DE ACESSO</span>
                <span className="block h-0 grow border-t border-dashed border-alta" />
              </div>
            )}
          </div>
        ))}

        {hasAccess && (
          <div className="flex flex-col gap-2 border-b border-white/[0.06] px-4 py-3.5">
            {view.pointsToZone == null ? (
              <UmaLinha className="text-[13.5px] font-semibold text-alta">Na zona de acesso</UmaLinha>
            ) : (
              <>
                <div className="flex min-w-0 items-baseline justify-between gap-3">
                  <UmaLinha className="text-[13.5px] font-semibold text-white">
                    {view.pointsToZone === 0 ? 'Empatado com o acesso' : `−${view.pointsToZone} pro acesso`}
                  </UmaLinha>
                  <span className="shrink-0 font-mono text-[11px] text-cimento">
                    {view.me.points} / {view.zoneTargetPoints}
                  </span>
                </div>
                <div className="h-1.5 bg-card-hi" aria-hidden>
                  <span
                    className="block h-1.5 bg-neon-yellow"
                    style={{
                      width: `${Math.max(2, Math.min(100, view.zoneTargetPoints ? (view.me.points / view.zoneTargetPoints) * 100 : 0))}%`,
                    }}
                  />
                </div>
              </>
            )}
          </div>
        )}

        <Link
          to="/competicao/standings"
          className="ole-num flex h-12 items-center justify-between px-4 text-[12.5px] uppercase text-white transition-colors hover:text-neon-yellow"
        >
          Tabela
          <ChevronRight aria-hidden className="h-4 w-4 text-neon-yellow" strokeWidth={2.6} />
        </Link>
      </div>
    </section>
  );
}

function Linha({ row, inZone, chip }: { row: StandingRow; inZone: boolean; chip: string | null }) {
  if (row.isMe) {
    return (
      <div className="flex h-[50px] min-w-0 items-center gap-3 bg-neon-yellow px-4 text-black">
        <span className="ole-num w-6 shrink-0 text-[17px]">{row.pos}</span>
        <UmaLinha className="grow text-[15px] font-bold">{row.team}</UmaLinha>
        <span className="ole-num shrink-0 text-[17px]">{row.points}</span>
      </div>
    );
  }
  return (
    <div className="flex h-11 min-w-0 items-center gap-3 border-b border-white/[0.06] px-4">
      <span className={`ole-num w-6 shrink-0 text-[15px] ${inZone ? 'text-alta' : 'text-cimento'}`}>{row.pos}</span>
      <UmaLinha className="grow text-[14px] text-giz">{row.team}</UmaLinha>
      {chip && (
        <span className="shrink-0 bg-giz px-[5px] py-0.5 font-mono text-[9.5px] tracking-[0.12em] text-black">{chip}</span>
      )}
      <span className="ole-num shrink-0 text-[15px] text-white">{row.points}</span>
    </div>
  );
}
