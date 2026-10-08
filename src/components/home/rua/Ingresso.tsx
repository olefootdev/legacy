/**
 * Herói da Home 2027 — o INGRESSO DE RODADA (DS "Respeito é ouro", peça 3c).
 *
 * O próximo jogo vira um ingresso de papel: corpo amarelo (é ação: escalar) com
 * alambrado no topo e retícula no canto, picote, e o canhoto de asfalto com
 * setor, divisão, posição no mundo e o código de barras do clube. Sem jogo
 * marcado, o ingresso é da Partida Rápida — nunca um herói vazio.
 */
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { L } from '@/i18n/L';
import { SeloRua } from '@/components/ui/Rua';

export interface IngressoFixture {
  opponentName: string;
  /** "Hoje · 21:00", "20/09 · 21:00", "14:32" (contagem) ou "Agora". */
  kickoffLabel: string;
  isLive: boolean;
}

const NOME = 'block font-impact uppercase leading-[0.86] [overflow-wrap:anywhere]';
const NOME_SIZE = { fontSize: 'clamp(42px, 12.5vw, 88px)' } as const;

/** Barras do código: determinísticas pelo nome do clube (cada ingresso é único). */
function barras(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return Array.from({ length: 30 }, () => {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return 1 + ((h >>> 0) % 3);
  });
}

export function Ingresso({
  clubName,
  fixture,
  division,
  rank,
}: {
  clubName: string;
  fixture: IngressoFixture | null;
  division: number | null;
  rank: number | null;
}) {
  const live = !!fixture?.isLive;
  return (
    <section
      aria-label={
        fixture
          ? L(`Próximo jogo: ${clubName} contra ${fixture.opponentName}`, `Next match: ${clubName} vs ${fixture.opponentName}`)
          : L('Partida rápida', 'Quick Match')
      }
      className="flex min-w-0 flex-col sm:flex-row"
    >
      {/* ── Corpo do ingresso ─────────────────────────────────────────── */}
      <div className="relative flex min-w-0 grow flex-col gap-5 overflow-hidden bg-rua p-5 text-asfalto-27 sm:p-7">
        <span aria-hidden className="rua-alambrado absolute inset-x-0 top-0 h-36 [--alambrado:rgba(13,13,12,0.28)]" />
        <span
          aria-hidden
          className="rua-reticula absolute -bottom-4 -right-4 h-48 w-56 [--reticula:rgba(13,13,12,0.55)] sm:h-60 sm:w-72"
          style={{
            WebkitMaskImage: 'radial-gradient(circle at 100% 100%, #000 0%, transparent 72%)',
            maskImage: 'radial-gradient(circle at 100% 100%, #000 0%, transparent 72%)',
          }}
        />

        <div className="relative flex min-w-0 items-center justify-between gap-3 font-prova text-[11.5px] font-bold uppercase tracking-[0.2em]">
          <span className="min-w-0 truncate">
            {fixture ? L('Olefoot · Liga Global', 'Olefoot · Global League') : L('Olefoot · Partida rápida', 'Olefoot · Quick match')}
          </span>
          {fixture &&
            (live ? (
              <SeloRua tom="corre" className="bg-asfalto-27 text-rua">
                ● {L('Ao vivo', 'Live')}
              </SeloRua>
            ) : (
              <span className="shrink-0">{fixture.kickoffLabel}</span>
            ))}
        </div>

        <div className="relative flex min-w-0 flex-col">
          <span className={NOME} style={NOME_SIZE}>
            {clubName}
          </span>
          <span aria-hidden className="-my-1 block font-voz text-[clamp(40px,10vw,64px)] leading-none">
            x
          </span>
          <span className={NOME} style={NOME_SIZE}>
            {fixture ? fixture.opponentName : L('Quem vier', 'Anyone')}
          </span>
        </div>

        <p className="relative font-voz text-[clamp(22px,5.6vw,28px)] leading-[1.05]">
          {fixture
            ? L('Quem chega com respeito, entra.', 'Walk in with respect.')
            : L('Rodada parada? A bola rola igual.', 'No fixture? The ball still rolls.')}
        </p>

        <div className="relative flex min-w-0 flex-wrap items-center gap-3">
          <Link
            to={fixture ? '/team' : '/match/quick'}
            className="inline-flex min-h-[54px] items-center gap-2 bg-asfalto-27 px-6 font-impact text-[21px] uppercase leading-none text-rua transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-asfalto-27"
          >
            {fixture ? L('Escalar time', 'Set lineup') : L('Jogar agora', 'Play now')} <span aria-hidden>→</span>
          </Link>
          <Link
            to={fixture ? '/match/quick' : '/team'}
            className="inline-flex min-h-[54px] items-center border-2 border-asfalto-27 px-5 font-impact text-[19px] uppercase leading-none transition-colors hover:bg-asfalto-27 hover:text-rua focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-asfalto-27"
          >
            {fixture ? L('Rápida', 'Quick') : L('Escalar', 'Lineup')}
          </Link>
        </div>
      </div>

      {/* ── Picote: horizontal no celular, vertical do sm pra cima ─────── */}
      <div aria-hidden className="relative h-3 shrink-0 bg-rua sm:h-auto sm:w-3">
        <span className="rua-picote-h absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 sm:hidden" />
        <span className="rua-picote-v absolute inset-y-0 left-1/2 hidden w-2 -translate-x-1/2 sm:block" />
      </div>

      {/* ── Canhoto ────────────────────────────────────────────────────── */}
      <div className="rua-grao flex shrink-0 flex-row items-end justify-between gap-4 bg-concreto p-5 text-papel sm:w-[188px] sm:flex-col sm:items-stretch sm:justify-between sm:p-6">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-mudo">{L('Setor', 'Section')}</span>
            <span className="font-impact text-[34px] uppercase leading-none text-rua">{L('Rua', 'Street')}</span>
          </div>
          <div className="flex gap-5">
            <Campo label={L('Div', 'Div')} valor={division != null ? String(division).padStart(2, '0') : '—'} />
            <Campo label={L('Mundo', 'World')} valor={rank != null ? `#${rank}` : '—'} ouro={rank != null} />
          </div>
        </div>
        <div aria-hidden className="flex h-14 w-[132px] shrink-0 items-stretch gap-[2px] sm:w-full">
          {barras(clubName).map((w, i) => (
            <span key={i} className={cn('bg-papel', i % 4 === 3 && 'bg-transparent')} style={{ flexGrow: w }} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Campo({ label, valor, ouro }: { label: string; valor: string; ouro?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="font-prova text-[11px] uppercase tracking-[0.16em] text-mudo">{label}</span>
      <span className={cn('font-impact text-[28px] leading-none', ouro ? 'text-ouro-27' : 'text-papel')}>{valor}</span>
    </div>
  );
}
