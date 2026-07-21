/**
 * RankingTop10 — módulo "Ranking de Clubes" do layout v3.
 *
 * Leaderboard com abas de período. A aba GERAL é REAL (getGlobalLeagueRanking
 * pontos de temporada), com a TUA linha destacada e mostrada separada quando
 * fora do top 10. As abas Diário/Semanal/Mensal ainda não têm fonte por período
 * → empty-state honesto ("Ranking por período chega em breve"), nunca dado
 * falso. Dados por props.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RankRow = { entryId: string; team: string; points: number; isMe: boolean };

type Period = 'dia' | 'sem' | 'mes' | 'all';
const TABS: { key: Period; label: string }[] = [
  { key: 'dia', label: 'Diário' },
  { key: 'sem', label: 'Semanal' },
  { key: 'mes', label: 'Mensal' },
  { key: 'all', label: 'Geral' },
];

export function RankingTop10({
  top,
  myRow,
  myRank,
}: {
  top: RankRow[];
  myRow: RankRow | null;
  myRank: number | null;
}) {
  const [period, setPeriod] = useState<Period>('all');
  const meInTop = top.some((r) => r.isMe);

  return (
    <section
      aria-label="Ranking de clubes"
      className="overflow-hidden border border-[var(--color-border)] bg-dark-gray"
      style={{ borderRadius: 'var(--radius-md)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <div>
          <h2 className="font-impact uppercase text-white" style={{ fontSize: '18px', lineHeight: 0.9 }}>
            Ranking de Clubes
          </h2>
          <span
            className="mt-0.5 block font-display font-black uppercase"
            style={{ fontSize: '9px', letterSpacing: '0.16em', color: '#C7A64E' }}
          >
            Top 10 · ao vivo
          </span>
        </div>
        <div
          role="tablist"
          aria-label="Período do ranking"
          className="flex gap-1 border border-[var(--color-border)] bg-[var(--color-card)] p-1"
          style={{ borderRadius: '999px' }}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={period === t.key}
              onClick={() => setPeriod(t.key)}
              className={cn(
                'font-display font-black uppercase transition-all',
                period === t.key ? 'bg-neon-yellow text-black' : 'text-white/40 hover:text-white/70',
              )}
              style={{ fontSize: '9.5px', letterSpacing: '0.08em', padding: '6px 11px', borderRadius: '999px' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {period !== 'all' ? (
        <div className="px-4 py-10 text-center">
          <p className="font-impact uppercase text-white/70" style={{ fontSize: '13px' }}>
            Em breve
          </p>
          <p className="mt-1 text-white/45" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px' }}>
            Ranking por período chega em breve. Por enquanto, veja o Geral.
          </p>
        </div>
      ) : top.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-white/55" style={{ fontFamily: 'var(--font-sans)', fontSize: '12px' }}>
            A liga ainda carrega.
          </p>
        </div>
      ) : (
        <>
          <ul className="px-2.5 py-3">
            {top.map((r, i) => (
              <RankLine key={r.entryId} pos={i + 1} row={r} />
            ))}
          </ul>
          {!meInTop && myRow && myRank ? (
            <div className="mx-2.5 border-t border-dashed border-white/10 pb-1 pt-1">
              <RankLine pos={myRank} row={myRow} />
            </div>
          ) : null}
        </>
      )}

      <div className="border-t border-white/5 px-4 py-2">
        <Link
          to="/competicao/ranking"
          className="inline-flex min-h-[44px] items-center gap-1 font-display font-black uppercase text-white/55 transition-colors hover:text-neon-yellow"
          style={{ fontSize: '10px', letterSpacing: '0.22em' }}
        >
          Ranking completo
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

function RankLine({ pos, row }: { pos: number; row: RankRow }) {
  return (
    <li
      className={cn(
        'grid grid-cols-[26px_1fr_auto] items-center gap-3 px-2 py-2.5',
        row.isMe && 'border-l-[3px] border-l-neon-yellow bg-neon-yellow/[0.06]',
      )}
      style={row.isMe ? { borderRadius: 'var(--radius-sm)' } : undefined}
    >
      <span
        className="text-center font-impact tabular-nums"
        style={{ fontSize: '16px', color: row.isMe ? 'var(--color-neon-yellow)' : pos === 1 ? '#C7A64E' : 'rgba(255,255,255,0.4)' }}
      >
        {pos}
      </span>
      <span
        className={cn('min-w-0 truncate font-impact uppercase', row.isMe ? 'text-neon-yellow' : 'text-white')}
        style={{ fontSize: '13px' }}
      >
        {row.isMe ? `${row.team} — você` : row.team}
      </span>
      <span
        className="text-right font-impact tabular-nums"
        style={{ fontSize: '17px', color: row.isMe ? 'var(--color-neon-yellow)' : '#fff' }}
      >
        {row.points.toLocaleString('pt-BR')}
      </span>
    </li>
  );
}
