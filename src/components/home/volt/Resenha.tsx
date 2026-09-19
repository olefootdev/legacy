/**
 * A Resenha — o mundo se mexendo, uma linha por notícia (A VIRADA · V4).
 * Notícia vira nome + seta ou #hashtag; o que não cabe corta com reticências.
 * Dado real de `fetchMarketActivities` — sem atividade, a seção some.
 */
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Placa, UmaLinha } from '@/components/ui';
import type { MarketActivity } from '@/market/socialTrade';

function tempo(ts: Date, nowMs: number): string {
  const min = Math.max(0, Math.round((nowMs - ts.getTime()) / 60_000));
  if (min < 60) return `${Math.max(1, min)} MIN`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} H`;
  return `${Math.round(h / 24)} D`;
}

function Texto({ a }: { a: MarketActivity }) {
  const nome = <span className="font-bold text-white">{a.playerName}</span>;
  if (a.type === 'purchase' || a.type === 'auction_won') {
    return (
      <>
        {nome} → {a.userName}
      </>
    );
  }
  if (a.type === 'sale') {
    return (
      <>
        {nome} <span className="font-mono text-[11.5px] font-medium text-cimento">#vendido</span>
      </>
    );
  }
  return (
    <>
      {nome} <span className="font-mono text-[11.5px] font-medium text-cimento">#àvenda</span>
    </>
  );
}

export function Resenha({ activities, nowMs, max = 4 }: { activities: MarketActivity[]; nowMs: number; max?: number }) {
  const rows = activities.filter((a) => a.type !== 'auction_lost').slice(0, max);
  if (rows.length === 0) return null;
  return (
    <section aria-label="A Resenha" className="-mx-3 flex max-w-none flex-col gap-3 bg-panel px-4 pb-5 pt-[30px] sm:mx-0 sm:max-w-full">
      <Placa className="self-start px-3.5 pb-[5px] pt-2">
        <h2 className="font-impact text-[36px] uppercase leading-[0.95]">A Resenha</h2>
      </Placa>
      <ul className="flex flex-col">
        {rows.map((a) => (
          <li key={a.id} className="flex min-h-[60px] min-w-0 items-center gap-3 border-b border-white/[0.08] last:border-b-0">
            <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-card-hi font-mono text-[10px] font-medium text-giz">
              {a.playerPos}
            </span>
            <UmaLinha className="grow text-[14px] leading-[1.35] text-giz">
              <Texto a={a} />
            </UmaLinha>
            <span className="shrink-0 font-mono text-[10.5px] text-cimento">{tempo(a.timestamp, nowMs)}</span>
          </li>
        ))}
      </ul>
      <Link
        to="/mercado/transfer"
        className="ole-num inline-flex min-h-[44px] items-center gap-1.5 self-start text-[12.5px] uppercase text-neon-yellow"
      >
        Mercado
        <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2.6} />
      </Link>
    </section>
  );
}
