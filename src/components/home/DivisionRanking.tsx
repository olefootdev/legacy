/**
 * DivisionRanking — o Top 10 da DIVISÃO do manager na Liga Global.
 *
 * Pedido do fundador (2026-07-24): antes da Resenha, mostrar os 10 primeiros da
 * divisão em que o manager compete, e a posição dele nela.
 *
 * POR QUE A DIVISÃO, E NÃO O GERAL: numa liga com divisões, promoção e
 * rebaixamento acontecem DENTRO da divisão. O ranking geral (todos misturados)
 * diz menos ao manager que "onde estou entre meus pares diretos". O
 * RankingTop10 já cobre o geral; este é o recorte que importa pra decisão.
 *
 * DADO: as linhas já vêm ordenadas por score de `getGlobalLeagueRankingEntries`
 * e cada uma carrega `division`. A Home filtra pela divisão do manager e passa
 * pra cá — nenhum dado novo, só o recorte.
 */
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { globalDivisionName } from '@/match/globalLeagueMVP';

export type DivisionRankRow = { entryId: string; team: string; points: number; isMe: boolean };



export function DivisionRanking({
  division,
  top,
  myRow,
  myRank,
  divisionSize,
}: {
  division: number | null;
  /** Top 10 da divisão, já ordenado. */
  top: DivisionRankRow[];
  /** A linha do manager, para o caso de ele estar fora do top 10. */
  myRow: DivisionRankRow | null;
  /** Posição do manager DENTRO da divisão (1-based). */
  myRank: number | null;
  /** Total de clubes na divisão — dá a dimensão do "X de N". */
  divisionSize: number;
}) {
  // Sem divisão definida (liga ainda não classificou) → não mostra nada.
  if (division == null || top.length === 0) return null;

  const nome = globalDivisionName(division);
  const meNoTop = top.some((r) => r.isMe);

  return (
    <section
      aria-label={`Ranking da sua divisão — ${nome}`}
      className="ole-poster overflow-hidden"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4">
        <div>
          <h2 className="ole-eyebrow-poster" style={{ fontSize: '16px' }}>
            Sua divisão
          </h2>
          <span
            className="mt-0.5 block font-display font-black uppercase"
            style={{ fontSize: '9px', letterSpacing: '0.16em', color: '#C7A64E' }}
          >
            {`Série ${nome} · ${divisionSize} clubes`}
          </span>
        </div>

        {/* A posição do manager em destaque, mesmo quando ele está no top. */}
        {myRank != null && (
          <div className="text-right">
            <span className="font-impact tabular-nums text-neon-yellow" style={{ fontSize: '26px', lineHeight: 0.8 }}>
              {myRank}º
            </span>
            <span
              className="block font-display font-black uppercase text-white/45"
              style={{ fontSize: '8.5px', letterSpacing: '0.14em' }}
            >
              sua posição
            </span>
          </div>
        )}
      </div>

      <ul className="px-2.5 py-3">
        {top.map((r, i) => (
          <RankLine key={r.entryId} pos={i + 1} row={r} />
        ))}
      </ul>

      {/* Fora do top 10: a linha do manager entra separada, com sua posição real. */}
      {!meNoTop && myRow && myRank ? (
        <div className="mx-2.5 border-t border-dashed border-white/10 pb-1 pt-1">
          <RankLine pos={myRank} row={myRow} />
        </div>
      ) : null}

      <div className="border-t border-white/5 px-4 py-2">
        <Link
          to="/competicao/standings"
          className="inline-flex min-h-[44px] items-center gap-1 font-display font-black uppercase text-white/55 transition-colors hover:text-neon-yellow"
          style={{ fontSize: '10px', letterSpacing: '0.22em' }}
        >
          Classificação da divisão
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

function RankLine({ pos, row }: { pos: number; row: DivisionRankRow }) {
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
