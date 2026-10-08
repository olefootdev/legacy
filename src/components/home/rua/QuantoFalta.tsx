/**
 * A divisão do manager na Home 2027 — "Quanto falta pra subir" (DS, peça 2e).
 *
 * Cinco linhas em volta dele, o líder com fio de ouro (respeito), a linha dele
 * em rua colada torta, a zona de acesso e o número em spray do que falta. A
 * ordem e a zona saem de `buildDivisionView`, que repete a regra de promoção
 * do motor da liga — não a nota composta do ranking geral.
 *
 * Voz: "Faltam 412 pontos pro acesso", nunca "você está em 19º de 20".
 */
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SecaoRua, SeloRua } from '@/components/ui/Rua';
import { globalDivisionName } from '@/match/globalLeagueMVP';
import type { DivisionView, StandingRow } from '@/ranking/divisionStandings';
import { L, LOCALE } from '@/i18n/L';

export function QuantoFalta({
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
  const opp = nextOpponent?.name.trim().toLowerCase() ?? null;
  const inZone = hasAccess && view.pointsToZone == null;
  const meta = [
    L(`Divisão ${view.division} · ${globalDivisionName(view.division)}`, `Division ${view.division} · ${globalDivisionName(view.division)}`),
    roundsLeft ? L(`${roundsLeft} rodada${roundsLeft > 1 ? 's' : ''}`, `${roundsLeft} round${roundsLeft > 1 ? 's' : ''}`) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const titulo = !hasAccess
    ? L('Rumo ao título', 'Chasing the title')
    : inZone
      ? L('Tá na zona. Segura.', "In the zone. Hold it.")
      : L('Quanto falta pra subir', 'How far to go up');

  return (
    <section aria-label={L(`Tua divisão — ${globalDivisionName(view.division)}`, `Your division — ${globalDivisionName(view.division)}`)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <SecaoRua label={meta} />
        <h2 className="font-voz text-[clamp(38px,10vw,54px)] leading-[0.95] text-papel">{titulo}</h2>
      </div>

      <div className="flex flex-col gap-1.5">
        {view.window.map((row) => (
          <div key={row.id} className="flex flex-col gap-1.5">
            <Linha
              row={row}
              leader={row.pos === 1}
              inZone={hasAccess && row.pos <= view.promotionCount}
              below={row.pos > view.me.pos}
              chip={opp && row.team.trim().toLowerCase() === opp ? (nextOpponent!.isToday ? L('Hoje', 'Today') : L('Próximo', 'Next')) : null}
            />
            {view.zoneAfterPos === row.pos && (
              <div className="flex h-6 items-center gap-2" aria-label={L('Zona de acesso acima desta linha', 'Promotion zone above this line')}>
                <span className="block h-0 grow border-t-2 border-dashed border-rua" />
                <span className="font-prova text-[11px] font-bold tracking-[0.2em] text-rua">{L('ZONA DE ACESSO', 'PROMOTION ZONE')}</span>
                <span className="block h-0 grow border-t-2 border-dashed border-rua" />
              </div>
            )}
          </div>
        ))}
      </div>

      {hasAccess && !inZone && view.pointsToZone != null && (
        <div className="flex flex-col gap-1">
          {view.pointsToZone === 0 ? (
            <span className="font-spray text-[clamp(52px,15vw,84px)] font-black uppercase leading-[0.9] text-rua">{L('Empatado', 'Level')}</span>
          ) : (
            <span className="font-spray text-[clamp(64px,19vw,104px)] font-black uppercase leading-[0.85] text-rua">
              {view.pointsToZone.toLocaleString(LOCALE)} {L('pts', 'pts')}
            </span>
          )}
          <span className="font-impact text-[clamp(18px,5vw,24px)] uppercase leading-tight text-papel">
            {view.pointsToZone === 0
              ? L('com o acesso. Um jogo decide.', 'with promotion. One game decides it.')
              : L('é o que separa tu do acesso.', "is all that's between you and promotion.")}
          </span>
        </div>
      )}

      <Link
        to="/competicao/standings"
        className="inline-flex min-h-[44px] items-center gap-2 self-start font-impact text-[18px] uppercase text-rua hover:text-papel"
      >
        {L('Tabela completa', 'Full table')} <span aria-hidden>→</span>
      </Link>
    </section>
  );
}

function Linha({
  row,
  leader,
  inZone,
  below,
  chip,
}: {
  row: StandingRow;
  leader: boolean;
  inZone: boolean;
  below: boolean;
  chip: string | null;
}) {
  if (row.isMe) {
    // Lambe colado torto: inclinação mínima e a borda de papel deslocada.
    return (
      <div className="relative z-[1] my-1 flex h-[60px] min-w-0 -rotate-1 items-center gap-4 bg-rua px-4 text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)]">
        <span className="w-12 shrink-0 font-impact text-[26px] leading-none">#{String(row.pos).padStart(2, '0')}</span>
        <span className="block min-w-0 grow truncate font-impact text-[26px] uppercase leading-none">{row.team}</span>
        <span className="shrink-0 font-impact text-[28px] leading-none">{row.points.toLocaleString(LOCALE)}</span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        'flex h-[50px] min-w-0 items-center gap-4 px-4',
        leader ? 'border-2 border-ouro-27 text-ouro-27' : 'bg-concreto',
        !leader && (below ? 'text-mudo' : 'text-papel'),
      )}
    >
      <span className={cn('w-12 shrink-0 font-impact text-[21px] leading-none', !leader && inZone && 'text-rua')}>
        #{String(row.pos).padStart(2, '0')}
      </span>
      <span className="block min-w-0 grow truncate font-impact text-[21px] uppercase leading-none">{row.team}</span>
      {chip && <SeloRua tom="cal" className="py-0.5 text-[10.5px]">{chip}</SeloRua>}
      <span className="shrink-0 font-impact text-[21px] leading-none">{row.points.toLocaleString(LOCALE)}</span>
    </div>
  );
}
