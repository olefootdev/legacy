/**
 * Matchday Hero — composição editorial estilo BVB do screenshot 3 do brief.
 *
 * Componente STANDALONE em /matchday/preview para validação visual sem
 * tocar o Live2dMatchShell (1700 linhas, alto risco). Quando aprovado,
 * pode ser plugado em:
 *   - Postgame header (substitui o card de placar atual)
 *   - Overlay de intervalo no Live2dMatchShell
 *   - Tela de "preview da partida" antes do kickoff
 *
 * Mock data: Flamengo 2-1 Palmeiras com Gabriel Barbosa como destaque.
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';

const MOCK = {
  competition: 'Brasileirão · Rodada 14',
  minute: '72',
  status: 'Ao vivo' as const,
  home: {
    short: 'FLA',
    name: 'Flamengo',
    score: 2,
    form: { v: 8, e: 3, d: 2 },
    crestColor: '#000000', // anel preto sobre amarelo
  },
  away: {
    short: 'PAL',
    name: 'Palmeiras',
    score: 1,
    form: { v: 7, e: 4, d: 2 },
    crestColor: '#FFFFFF',
  },
  stats: [
    { label: 'Posse', value: '58%' },
    { label: 'Chutes', value: '14' },
    { label: 'No gol', value: '7' },
    { label: 'Passes', value: '82%' },
    { label: 'Escanteios', value: '3' },
  ],
  highlight: {
    name: 'Gabriel Barbosa',
    number: 9,
    quote: 'Dois gols em 15 minutos. A camisa 9 pesou quando precisou pesar.',
  },
};

export function MatchdayPreview() {
  return (
    <div className="min-h-screen bg-deep-black text-white">
      {/* ── HERO: split diagonal amarelo (esq) + preto (dir) ─────── */}
      <section className="relative w-full overflow-hidden bg-deep-black min-h-[78vh] sm:min-h-[88vh]">
        {/* Camada amarela com clip-path (esq → 62%) */}
        <div
          className="absolute inset-0 bg-neon-yellow"
          style={{ clipPath: 'polygon(0 0, 62% 0, 38% 100%, 0% 100%)' }}
          aria-hidden
        />
        {/* Linhas verticais sutis (textura de campo) sobre o amarelo */}
        <svg
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ clipPath: 'polygon(0 0, 62% 0, 38% 100%, 0% 100%)' }}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <g stroke="#000" strokeOpacity="0.06" strokeWidth="0.15">
            <line x1="20" y1="0" x2="20" y2="100" />
            <line x1="40" y1="0" x2="40" y2="100" />
            <line x1="60" y1="0" x2="60" y2="100" />
            <line x1="80" y1="0" x2="80" y2="100" />
          </g>
        </svg>

        {/* Conteúdo */}
        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-8 py-5 sm:py-7">
          {/* Top bar: OLEFOOT | competição | minuto/status */}
          <div className="flex items-center justify-between gap-3 mb-8 sm:mb-12">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-black/80 hover:text-black font-display font-bold uppercase tracking-[0.18em] text-[11px] sm:text-[12px]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Olefoot
            </Link>
            <span className="text-black/70 font-display font-bold uppercase tracking-[0.22em] text-[10px] sm:text-[12px] text-center flex-1">
              {MOCK.competition}
            </span>
            <span className="inline-flex items-center gap-1.5 text-white font-display font-bold uppercase tracking-[0.18em] text-[11px] sm:text-[12px]">
              <span className="text-white/70">{MOCK.minute}'</span>
              <span aria-hidden className="text-white/40">—</span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-rose-500 live-dot"
                  aria-hidden
                />
                {MOCK.status}
              </span>
            </span>
          </div>

          {/* Scoreboard: [crest] FLA [score] – [score] PAL [crest] */}
          <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-3 sm:gap-5 mb-10 sm:mb-14">
            {/* Casa: crest + nome + form */}
            <CrestCircle short={MOCK.home.short} variant="onYellow" />
            <div>
              <h2
                className="ole-headline text-black leading-[0.85]"
                style={{ fontSize: 'clamp(24px, 4.5vw, 56px)' }}
              >
                {MOCK.home.name}
              </h2>
              <FormPills form={MOCK.home.form} variant="onYellow" />
            </div>

            {/* Score em Moret italic gigante (Vermelho do screenshot? não — tabular-nums white sobre split) */}
            <div className="self-stretch flex items-center justify-center px-1">
              <span
                className="leading-none text-black tabular-nums"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontSize: 'clamp(64px, 14vw, 144px)',
                }}
              >
                {MOCK.home.score}
              </span>
              <span
                className="leading-none mx-1 sm:mx-2 text-text-muted/60"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontSize: 'clamp(48px, 10vw, 96px)',
                }}
              >
                –
              </span>
              <span
                className="leading-none text-white tabular-nums"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontSize: 'clamp(64px, 14vw, 144px)',
                }}
              >
                {MOCK.away.score}
              </span>
            </div>

            {/* Visitante */}
            <div className="text-right">
              <h2
                className="ole-headline text-white leading-[0.85]"
                style={{ fontSize: 'clamp(24px, 4.5vw, 56px)' }}
              >
                {MOCK.away.name}
              </h2>
              <FormPills form={MOCK.away.form} variant="onDark" align="right" />
            </div>
            <CrestCircle short={MOCK.away.short} variant="onDark" />
          </div>

          {/* Stats strip: 5 cards alternados sobre o split */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 mb-10 sm:mb-14">
            {MOCK.stats.map((s, i) => {
              // 2 primeiros sobre amarelo (preto), últimos 3 sobre preto (amarelo)
              const onYellow = i < 2;
              return (
                <article
                  key={s.label}
                  className={
                    onYellow
                      ? 'bg-black px-3 py-3 sm:px-4 sm:py-4 text-center'
                      : 'bg-deep-black border border-white/8 px-3 py-3 sm:px-4 sm:py-4 text-center'
                  }
                >
                  <p
                    className="text-neon-yellow tabular-nums leading-none"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 900,
                      fontSize: 'clamp(28px, 4.8vw, 44px)',
                    }}
                  >
                    {s.value}
                  </p>
                  <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
                    {s.label}
                  </p>
                </article>
              );
            })}
          </div>

          {/* Destaque da partida — sobre split (esquerda preto, direita amarelo decorativo) */}
          <div className="relative grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6 items-end pb-4">
            <div>
              <div className="ole-eyebrow !justify-start mb-3">
                <span>★ Destaque da partida</span>
              </div>
              <h3
                className="ole-headline text-black leading-[0.9]"
                style={{ fontSize: 'clamp(36px, 7.5vw, 80px)' }}
              >
                {MOCK.highlight.name.split(' ').slice(0, 1)}
                <br />
                {MOCK.highlight.name.split(' ').slice(1).join(' ')}
              </h3>
              <blockquote
                className="ole-headline-italic mt-4 text-black/80 max-w-md leading-snug"
                style={{ fontSize: 'clamp(15px, 2vw, 19px)' }}
              >
                “{MOCK.highlight.quote}”
              </blockquote>
            </div>

            {/* Número gigante do destaque (sobre o lado preto do split) */}
            <div
              className="relative h-[160px] sm:h-[220px] flex items-center justify-center"
              aria-hidden
            >
              <span
                className="leading-none tabular-nums text-neon-yellow/15 select-none"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 'clamp(180px, 28vw, 320px)',
                  letterSpacing: '-0.04em',
                }}
              >
                {String(MOCK.highlight.number).padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons + scroll cue (centrado no rodapé) */}
        <div className="absolute inset-x-0 bottom-0 z-10 px-4 sm:px-8 pb-5 sm:pb-7">
          <div className="mx-auto max-w-6xl flex flex-col items-center gap-3">
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              <ActionButton label="Ver análise tática" />
              <ActionButton label="Replay" />
              <ActionButton label="Estatísticas" />
            </div>
            <button
              type="button"
              aria-label="Mais detalhes"
              className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-neon-yellow transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.25)]"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function CrestCircle({
  short,
  variant,
}: {
  short: string;
  variant: 'onYellow' | 'onDark';
}) {
  const ring = variant === 'onYellow' ? 'border-black' : 'border-white';
  const text = variant === 'onYellow' ? 'text-black' : 'text-white';
  const bg = variant === 'onYellow' ? 'bg-neon-yellow' : 'bg-deep-black';
  return (
    <div
      className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full border-[2.5px] grid place-items-center ${ring} ${bg}`}
    >
      <span
        className={`font-display font-black uppercase ${text} text-[11px] sm:text-[14px] tracking-[0.06em]`}
      >
        {short}
      </span>
    </div>
  );
}

function FormPills({
  form,
  variant,
  align = 'left',
}: {
  form: { v: number; e: number; d: number };
  variant: 'onYellow' | 'onDark';
  align?: 'left' | 'right';
}) {
  const sub = variant === 'onYellow' ? 'text-black/70' : 'text-white/70';
  return (
    <p
      className={`mt-1.5 font-display font-bold uppercase tracking-[0.18em] text-[11px] sm:text-[12px] ${sub} ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {form.v}V · {form.e}E · {form.d}D
    </p>
  );
}

function ActionButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="bg-black border border-white/15 text-white px-4 py-2.5 font-display font-bold uppercase tracking-[0.18em] text-[11px] sm:text-[12px] hover:border-neon-yellow hover:text-neon-yellow transition-colors rounded-sm"
    >
      {label}
    </button>
  );
}

export default MatchdayPreview;
