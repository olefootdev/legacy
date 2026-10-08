/**
 * A Resenha na Home 2027 — o mundo se mexendo, uma linha por notícia, com o
 * título em adesivo de papel colado torto (DS, "MVP DA RESENHA").
 * Dado real de `fetchMarketActivities` — sem atividade, a seção some.
 */
import { Link } from 'react-router-dom';
import type { MarketActivity } from '@/market/socialTrade';
import { posLabel } from '@/components/matchquick/posLabel';
import { L } from '@/i18n/L';

function tempo(ts: Date, nowMs: number): string {
  const min = Math.max(0, Math.round((nowMs - ts.getTime()) / 60_000));
  if (min < 60) return `${Math.max(1, min)} MIN`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} H`;
  return `${Math.round(h / 24)} D`;
}

function Texto({ a }: { a: MarketActivity }) {
  const nome = <span className="font-voz text-[21px] leading-none text-papel">{a.playerName}</span>;
  if (a.type === 'purchase' || a.type === 'auction_won') {
    return (
      <>
        {nome} <span className="text-mudo">→</span> {a.userName}
      </>
    );
  }
  return (
    <>
      {nome} <span className="font-prova text-[12px] text-mudo">{a.type === 'sale' ? L('#vendido', '#sold') : L('#àvenda', '#forsale')}</span>
    </>
  );
}

export function ResenhaRua({ activities, nowMs, max = 4 }: { activities: MarketActivity[]; nowMs: number; max?: number }) {
  const rows = activities.filter((a) => a.type !== 'auction_lost').slice(0, max);
  if (rows.length === 0) return null;
  return (
    <section aria-label={L('A Resenha', 'The Buzz')} className="flex flex-col gap-4">
      <h2 className="-rotate-2 self-start bg-papel px-4 pb-1 pt-1.5 font-impact text-[34px] uppercase leading-none text-asfalto-27">
        {L('A Resenha', 'The Buzz')}
      </h2>
      <ul className="flex flex-col">
        {rows.map((a) => (
          <li key={a.id} className="flex min-h-[62px] min-w-0 items-center gap-3 border-b border-linha last:border-b-0">
            <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center border-2 border-linha font-impact text-[13px] text-suave">
              {posLabel(a.playerPos)}
            </span>
            <span className="block min-w-0 grow truncate text-[14px] text-suave">
              <Texto a={a} />
            </span>
            <span className="shrink-0 font-prova text-[11px] text-mudo">{tempo(a.timestamp, nowMs)}</span>
          </li>
        ))}
      </ul>
      <Link
        to="/mercado/transfer"
        className="inline-flex min-h-[44px] items-center gap-2 self-start font-impact text-[18px] uppercase text-rua hover:text-papel"
      >
        {L('Mercado', 'Market')} <span aria-hidden>→</span>
      </Link>
    </section>
  );
}
