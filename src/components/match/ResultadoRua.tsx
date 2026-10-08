/**
 * DS 2027 · "RESPEITO É OURO" — as peças de rua da PARTIDA (PDF págs. 5, 6 e 12).
 *
 *   · ConvocacaoRua — "X vs Y": o pôster de rodada antes da bola rolar
 *     (amarelo com alambrado em cima, asfalto embaixo, o "x" na voz).
 *   · ResultadoRua  — o "resultado": placar gigante em spray amarelo, nomes em
 *     Anton, a frase na voz ("Vitória na moral."), o MVP num post-it de ouro
 *     colado torto com fita adesiva e a fita amarela com o +EXP.
 *
 * Dado real ou nada: sem MVP, sem post-it; sem EXP, a fita só leva as hashtags.
 * Nada aqui anima pesado — a fita usa o trilho global (desliga em reduced-motion).
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { L } from '@/i18n/L';
import { FitaRua } from '@/components/ui/Rua';

export type ResultadoTipo = 'win' | 'draw' | 'loss';

/** A frase do resultado, na voz do DS (§7): curta, de igual pra igual. */
export function fraseDoResultado(r: ResultadoTipo): string {
  if (r === 'win') return L('Vitória na moral.', 'Won it with respect.');
  if (r === 'draw') return L('Empate. Ninguém saiu devendo.', 'A draw. Nobody owes anybody.');
  return L('Perdeu hoje. Volta amanhã.', 'Lost today. Back tomorrow.');
}

export interface ResultadoMvp {
  name: string;
  /** Nota 0–10 (já calculada pelo motor). */
  rating?: number | null;
  goals?: number | null;
  assists?: number | null;
}

/** Nome curto: apelido entre aspas ou o primeiro nome. */
function nomeCurto(n: string): string {
  return n.match(/"([^"]+)"/)?.[1] ?? n;
}

/**
 * MVP DA RESENHA — post-it de ouro colado torto, com o pedaço de fita adesiva
 * em cima. Ouro chapado (degrau LENDA): é o topo da partida.
 */
export function MvpPostIt({ mvp, className }: { mvp: ResultadoMvp; className?: string }) {
  const partes: string[] = [];
  if (mvp.goals && mvp.goals > 0) partes.push(`${mvp.goals} ${mvp.goals === 1 ? L('gol', 'goal') : L('gols', 'goals')}`);
  if (mvp.assists && mvp.assists > 0) partes.push(`${mvp.assists} ${L('assist.', 'ast.')}`);
  return (
    <div className={cn('relative w-[min(13.5rem,100%)] shrink-0 rotate-[3deg]', className)}>
      {/* fita adesiva (papel translúcido) */}
      <span aria-hidden className="absolute -top-3 left-3 z-10 h-6 w-[5.5rem] -rotate-[4deg] bg-papel/70" />
      <div className="bg-ouro-27 px-4 pb-4 pt-5 text-asfalto-27 shadow-[4px_4px_0_var(--color-asfalto-27)]">
        <p className="font-prova text-[10.5px] font-bold uppercase tracking-[0.2em]">
          {L('MVP da resenha', 'MVP of the day')}
        </p>
        {mvp.rating != null && Number.isFinite(mvp.rating) && (
          <p className="mt-1 font-impact text-[52px] leading-[0.9] tabular-nums">{mvp.rating.toFixed(1)}</p>
        )}
        <p className="mt-1 font-voz text-[26px] leading-[1.02] [overflow-wrap:anywhere]">{nomeCurto(mvp.name)}</p>
        {partes.length > 0 && (
          <p className="mt-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.14em]">{partes.join(' · ')}</p>
        )}
      </div>
    </div>
  );
}

/**
 * O resultado (PDF pág. 6). `minhaCasa` decide quem fica claro e quem fica mudo
 * nos nomes — o placar sempre na ordem casa × visitante.
 */
export function ResultadoRua({
  homeName,
  awayName,
  homeScore,
  awayScore,
  resultado,
  rotuloEsq,
  rotuloDir,
  detalhe,
  mvp,
  exp,
  minhaCasa = true,
  className,
  children,
}: {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  resultado: ResultadoTipo;
  /** Ex.: "FIM DE JOGO". Padrão: "Fim de jogo". */
  rotuloEsq?: string;
  /** Ex.: "PARTIDA RÁPIDA", "RODADA 12". */
  rotuloDir?: string;
  /** Linha de prova abaixo da frase (ex.: "nos pênaltis 4–3"). */
  detalhe?: string | null;
  mvp?: ResultadoMvp | null;
  /** EXP real ganho (só entra na fita se > 0). */
  exp?: number | null;
  /** O manager é o mandante? (padrão sim). */
  minhaCasa?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const tags = exp != null && exp > 0 ? ['#correloko', `+${Math.round(exp)} EXP`] : ['#correloko', '#persista'];
  const meuNome = minhaCasa ? 'text-papel' : 'text-mudo';
  const deleNome = minhaCasa ? 'text-mudo' : 'text-papel';
  return (
    <section
      aria-label={L(
        `Fim de jogo: ${homeName} ${homeScore} × ${awayScore} ${awayName}`,
        `Full time: ${homeName} ${homeScore} × ${awayScore} ${awayName}`,
      )}
      className={cn('rua-grao relative overflow-hidden bg-concreto text-papel', className)}
    >
      <div className="flex flex-col gap-5 px-5 pt-5 sm:px-7 sm:pt-7">
        <div className="flex min-w-0 items-center justify-between gap-3 font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-suave">
          <span className="truncate">{rotuloEsq ?? L('Fim de jogo', 'Full time')}</span>
          {rotuloDir && <span className="shrink-0">{rotuloDir}</span>}
        </div>

        {/* PLACAR em spray — o centro de tudo */}
        <p
          aria-hidden
          className="text-center font-spray font-black leading-[0.82] tracking-tight text-rua tabular-nums"
          style={{ fontSize: 'clamp(96px, 34vw, 200px)' }}
        >
          {homeScore}
          <span className="mx-[0.06em] inline-block align-[0.08em] text-[0.62em]">×</span>
          {awayScore}
        </p>

        <div className="flex min-w-0 items-baseline justify-between gap-4 font-impact uppercase leading-none" style={{ fontSize: 'clamp(18px, 5.4vw, 26px)' }}>
          <span className={cn('min-w-0 truncate', meuNome)}>{homeName}</span>
          <span className={cn('min-w-0 truncate text-right', deleNome)}>{awayName}</span>
        </div>

        <div className="flex min-w-0 flex-col gap-5 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="font-voz leading-[0.98] text-papel" style={{ fontSize: 'clamp(40px, 12vw, 64px)' }}>
              {fraseDoResultado(resultado)}
            </p>
            {detalhe && (
              <p className="mt-2 font-prova text-[12px] font-bold uppercase tracking-[0.16em] text-mudo">{detalhe}</p>
            )}
          </div>
          {mvp && <MvpPostIt mvp={mvp} className="self-end sm:self-auto" />}
        </div>
        {children}
      </div>

      <FitaRua tags={tags} inclinacao={-2} className="-mt-1 pb-4" />
    </section>
  );
}

/**
 * Convocação "X vs Y" (PDF pág. 5): metade amarela com alambrado e o mandante
 * em preto; metade asfalto com o visitante em amarelo; o "x" na voz entre os dois.
 */
export function ConvocacaoRua({
  homeName,
  awayName,
  rotuloEsq,
  rotuloDir,
  frase,
  children,
  className,
}: {
  homeName: string;
  awayName: string;
  rotuloEsq?: string;
  rotuloDir?: string;
  frase?: string;
  children?: ReactNode;
  className?: string;
}) {
  const NOME = 'block font-impact uppercase leading-[0.86] [overflow-wrap:anywhere]';
  const TAM = { fontSize: 'clamp(40px, 13vw, 84px)' } as const;
  return (
    <section
      aria-label={L(`${homeName} contra ${awayName}`, `${homeName} vs ${awayName}`)}
      className={cn('relative flex min-w-0 flex-col overflow-hidden', className)}
    >
      <div className="relative bg-rua px-5 pb-10 pt-5 text-asfalto-27 sm:px-7">
        <span aria-hidden className="rua-alambrado absolute inset-x-0 top-0 h-32 [--alambrado:rgba(13,13,12,0.28)]" />
        <div className="relative mb-5 flex min-w-0 items-center justify-between gap-3 font-prova text-[11px] font-bold uppercase tracking-[0.22em]">
          <span className="truncate">{rotuloEsq ?? L('Partida rápida', 'Quick match')}</span>
          {rotuloDir && <span className="shrink-0">{rotuloDir}</span>}
        </div>
        <span className={cn(NOME, 'relative')} style={TAM}>
          {homeName}
        </span>
      </div>
      <div className="rua-grao relative bg-asfalto-27 px-5 pb-6 pt-2 text-right sm:px-7">
        <span
          aria-hidden
          className="absolute -top-9 left-1/2 -translate-x-1/2 -rotate-6 font-voz text-papel"
          style={{ fontSize: 'clamp(56px, 15vw, 88px)', lineHeight: 1 }}
        >
          x
        </span>
        <span className={cn(NOME, 'pt-6 text-rua')} style={TAM}>
          {awayName}
        </span>
        {frase && <p className="mt-5 text-left font-voz text-[clamp(22px,6vw,30px)] leading-[1.05] text-papel">{frase}</p>}
        {children}
      </div>
    </section>
  );
}
