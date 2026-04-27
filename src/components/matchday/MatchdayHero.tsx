/**
 * MatchdayHero — composição editorial BVB do /matchday/preview, reutilizável.
 *
 * É o JSX completo da página /matchday/preview empacotado num componente
 * que aceita props opcionais. Usado em:
 *   - /matchday/preview (página standalone com mock)
 *   - Home (com dados reais do fixture/club, mode "preview")
 *
 * NÃO mexa nos tamanhos / paddings / clamps — eles foram aprovados
 * visualmente como referência do nível "cinematográfico esportivo".
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';

export interface MatchdayHeroData {
  competition: string;
  /** Texto exibido no canto superior direito (ex: "72'", "SÁBADO 19h"). */
  statusPrimary: string;
  /** Texto secundário ao lado (ex: "AO VIVO"). Omitir esconde a tag. */
  statusSecondary?: string;
  /** 'live' = bolinha vermelha pulsante; 'preview' = bolinha amarela estática. */
  statusVariant: 'live' | 'preview';
  home: {
    short: string;
    name: string;
    /** Se omitido (modo preview), mostra "vs" no lugar do score. */
    score?: number;
    form?: { v: number; e: number; d: number };
    /** Subtítulo opcional embaixo do nome (ex: venue). Default = form pills. */
    sublabel?: string;
    /** URL do brasão real (time do coração). Se ausente, mostra crest sintético com `short`. */
    crestUrl?: string | null;
  };
  away: {
    short: string;
    name: string;
    score?: number;
    form?: { v: number; e: number; d: number };
    sublabel?: string;
    crestUrl?: string | null;
  };
  stats: { label: string; value: string }[];
  highlight: {
    /** Nome do jogador (vai no título grande em Moret italic). */
    name: string;
    /** Número decorativo gigante atrás (camisa, OVR, etc.). 1-3 dígitos. */
    number: number;
    quote: string;
    /** Foto do jogador (idealmente 4:5 portrait). Recebe filtro P&B BVB. */
    photoUrl?: string;
  };
  /** Botões de ação centrados no rodapé. Default = mock buttons. */
  actions?: { label: string; href?: string; onClick?: () => void; variant?: 'primary' | 'outline' }[];
  /** Link no canto superior esquerdo. Default = "/" com texto "Olefoot". */
  topLeft?: { label: string; href?: string };
  /** ID do destino do scroll cue (smooth scroll). Sem isso, o cue não aparece. */
  scrollCueTargetId?: string;
  /**
   * `true` = fundo amarelo total (sem split diagonal preto).
   * Texto/elementos do lado direito viram pretos pra contraste.
   * Mobile-first: evita texto branco em região que vira amarela em viewports
   * estreitos (causa de quebra/sumiço).
   */
  solidYellow?: boolean;
}

export const MOCK_MATCHDAY: MatchdayHeroData = {
  competition: 'Brasileirão · Rodada 14',
  statusPrimary: '72\'',
  statusSecondary: 'Ao vivo',
  statusVariant: 'live',
  home: {
    short: 'FLA',
    name: 'Flamengo',
    score: 2,
    form: { v: 8, e: 3, d: 2 },
  },
  away: {
    short: 'PAL',
    name: 'Palmeiras',
    score: 1,
    form: { v: 7, e: 4, d: 2 },
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
  actions: [
    { label: 'Ver análise tática', variant: 'outline' },
    { label: 'Replay', variant: 'outline' },
    { label: 'Estatísticas', variant: 'outline' },
  ],
  topLeft: { label: 'Olefoot', href: '/' },
};

export function MatchdayHero({ data = MOCK_MATCHDAY }: { data?: MatchdayHeroData }) {
  const showScore = data.home.score != null && data.away.score != null;
  const actions = data.actions ?? MOCK_MATCHDAY.actions ?? [];
  const solid = data.solidYellow === true;

  // Cores do lado direito — quando solidYellow, tudo preto pra contraste
  const rightTextStrong = solid ? 'text-black' : 'text-white';
  const rightTextSoft = solid ? 'text-black/70' : 'text-white/70';
  const rightTextMuted = solid ? 'text-black/40' : 'text-white/40';
  const rightCrestRing = solid ? 'border-black' : 'border-white';
  const rightCrestBg = solid ? 'bg-neon-yellow' : 'bg-deep-black';
  const rightCrestText = solid ? 'text-black' : 'text-white';
  const statusPrimaryColor = solid ? 'text-black/85' : 'text-white';
  const statusSubColor = solid ? 'text-black/65' : 'text-white/70';

  // Stats: solid → todos bg-black uniforme; split → alternados
  const statsBg = (i: number) => {
    if (solid) return 'bg-black px-3 py-3 sm:px-4 sm:py-4 text-center';
    return i < 2
      ? 'bg-black px-3 py-3 sm:px-4 sm:py-4 text-center'
      : 'bg-deep-black border border-white/8 px-3 py-3 sm:px-4 sm:py-4 text-center';
  };

  // Bg da section: solid amarelo, ou dark com split
  const sectionBg = solid ? 'bg-neon-yellow' : 'bg-deep-black';

  return (
    <section className={`relative w-full overflow-hidden ${sectionBg} min-h-[78vh] sm:min-h-[88vh]`}>
      {/* Camada amarela com clip-path (esq → 62%) — só no modo split */}
      {!solid && (
        <div
          className="absolute inset-0 bg-neon-yellow"
          style={{ clipPath: 'polygon(0 0, 62% 0, 38% 100%, 0% 100%)' }}
          aria-hidden
        />
      )}
      {/* Linhas verticais sutis (textura de campo) — full width no solid, clipped no split */}
      <svg
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={solid ? undefined : { clipPath: 'polygon(0 0, 62% 0, 38% 100%, 0% 100%)' }}
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
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 mb-8 sm:mb-12">
          {data.topLeft?.href ? (
            <Link
              to={data.topLeft.href}
              className="inline-flex items-center gap-2 text-black/80 hover:text-black font-display font-bold uppercase tracking-[0.18em] text-[11px] sm:text-[12px]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {data.topLeft.label}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-2 text-black/80 font-display font-bold uppercase tracking-[0.18em] text-[11px] sm:text-[12px]">
              {data.topLeft?.label ?? 'Olefoot'}
            </span>
          )}
          <span className="text-black/70 font-display font-bold uppercase tracking-[0.22em] text-[10px] sm:text-[12px] text-center flex-1 truncate">
            {data.competition}
          </span>
          <span className={`inline-flex items-center gap-1.5 ${statusPrimaryColor} font-display font-bold uppercase tracking-[0.18em] text-[11px] sm:text-[12px]`}>
            <span className={statusSubColor}>{data.statusPrimary}</span>
            {data.statusSecondary ? (
              <>
                <span aria-hidden className={rightTextMuted}>—</span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={
                      data.statusVariant === 'live'
                        ? 'w-1.5 h-1.5 rounded-full bg-rose-500 live-dot'
                        : solid
                          ? 'w-1.5 h-1.5 rounded-full bg-black'
                          : 'w-1.5 h-1.5 rounded-full bg-neon-yellow'
                    }
                    aria-hidden
                  />
                  {data.statusSecondary}
                </span>
              </>
            ) : null}
          </span>
        </div>

        {/* Scoreboard */}
        <div className="grid grid-cols-[auto_auto_auto] items-end gap-3 sm:gap-5 mb-10 sm:mb-14 justify-center">
          {/* Casa */}
          <div className="flex flex-col items-center gap-2 min-w-0">
            <CrestCircle
              short={data.home.short}
              variant="onYellow"
              crestUrl={data.home.crestUrl}
              alt={data.home.name}
            />
            <div className="text-center min-w-0 w-full">
              <h2
                className="ole-headline text-black leading-[0.85] uppercase"
                style={{ fontSize: 'clamp(20px, 3.5vw, 40px)' }}
              >
                {data.home.name}
              </h2>
              {data.home.form ? (
                <div className="flex justify-center mt-1.5">
                  <FormPills form={data.home.form} variant="onYellow" />
                </div>
              ) : data.home.sublabel ? (
                <p className="mt-1.5 font-display font-bold uppercase tracking-[0.18em] text-[11px] sm:text-[12px] text-black/70">
                  {data.home.sublabel}
                </p>
              ) : null}
            </div>
          </div>

          {/* Score / vs em Moret italic gigante */}
          <div className="self-stretch flex items-center justify-center px-1">
            {showScore ? (
              <>
                <span
                  className="leading-none text-black tabular-nums"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontStyle: 'italic',
                    fontSize: 'clamp(64px, 14vw, 144px)',
                  }}
                >
                  {data.home.score}
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
                  className={`leading-none tabular-nums ${rightTextStrong}`}
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontStyle: 'italic',
                    fontSize: 'clamp(64px, 14vw, 144px)',
                  }}
                >
                  {data.away.score}
                </span>
              </>
            ) : (
              <span
                className="leading-none text-black/85 select-none"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontSize: 'clamp(64px, 14vw, 144px)',
                }}
              >
                vs
              </span>
            )}
          </div>

          {/* Visitante */}
          <div className="flex flex-col items-center gap-2 min-w-0">
            {data.away.crestUrl?.trim() ? (
              <img
                src={data.away.crestUrl}
                alt={data.away.name}
                className="w-12 h-12 sm:w-16 sm:h-16 object-contain shrink-0"
                referrerPolicy="no-referrer"
                draggable={false}
              />
            ) : (
              <div
                className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full border-[2.5px] grid place-items-center shrink-0 ${rightCrestRing} ${rightCrestBg}`}
              >
                <span
                  className={`font-display font-black uppercase ${rightCrestText} text-[11px] sm:text-[14px] tracking-[0.06em]`}
                >
                  {data.away.short}
                </span>
              </div>
            )}
            <div className="text-center min-w-0 w-full">
              <h2
                className={`ole-headline ${rightTextStrong} leading-[0.85] uppercase`}
                style={{ fontSize: 'clamp(20px, 3.5vw, 40px)' }}
              >
                {data.away.name}
              </h2>
              {data.away.form ? (
                <div className="flex justify-center mt-1.5">
                  <FormPills form={data.away.form} variant={solid ? 'onYellow' : 'onDark'} align="center" />
                </div>
              ) : data.away.sublabel ? (
                <p className={`mt-1.5 font-display font-bold uppercase tracking-[0.18em] text-[11px] sm:text-[12px] ${rightTextSoft}`}>
                  {data.away.sublabel}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 md:gap-3 mb-10 sm:mb-14">
          {data.stats.map((s, i) => {
            return (
              <article key={s.label} className={statsBg(i)}>
                <p
                  className="text-neon-yellow tabular-nums leading-none italic"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontWeight: 700,
                    fontSize: 'clamp(20px, 4.2vw, 44px)',
                  }}
                >
                  {s.value}
                </p>
                <p className="mt-1 sm:mt-1.5 text-white/65 uppercase tracking-[0.12em] sm:tracking-[0.18em] text-[8px] sm:text-[9px] md:text-[10px] font-medium">
                  {s.label}
                </p>
              </article>
            );
          })}
        </div>

        {/* MVP */}
        <div className="relative grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6 items-end pb-4">
          <div>
            {/* Eyebrow forçado a preto — sobre o lado amarelo do split fica
                ilegível em yellow. text-black + linhas pretas via override. */}
            <div
              className="flex items-center justify-start gap-3 mb-3 uppercase tracking-[0.35em] text-[10px] font-medium text-black"
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              <span aria-hidden className="h-px w-8 bg-black/40" />
              <span>★ DESTAQUE DA PARTIDA ★ </span>
            </div>
            <h3
              className="ole-headline-italic text-black leading-[0.85]"
              style={{ fontSize: 'clamp(48px, 10vw, 96px)' }}
            >
              {data.highlight.name.split(' ').slice(0, 1)}
              <br />
              {data.highlight.name.split(' ').slice(1).join(' ')}
            </h3>
            <blockquote
              className="ole-headline-italic mt-4 text-black/80 max-w-md leading-snug"
              style={{ fontSize: 'clamp(15px, 2vw, 19px)' }}
            >
              “{data.highlight.quote}”
            </blockquote>
          </div>

          {/* Foto + Número gigante decorativo (layered: número atrás, foto na frente) */}
          <div
            className="relative h-[220px] sm:h-[280px] md:h-[320px] flex items-center justify-center"
          >
            {/* Número decorativo atrás — z-0 */}
            <span
              aria-hidden
              className="absolute inset-0 flex items-center justify-center leading-none tabular-nums text-neon-yellow/15 select-none pointer-events-none"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 'clamp(180px, 28vw, 320px)',
                letterSpacing: '-0.04em',
              }}
            >
              {String(data.highlight.number).padStart(2, '0')}
            </span>
            {/* Foto P&B (filtro grayscale) — z-10 sobre o número */}
            {data.highlight.photoUrl ? (
              <div className="relative z-10 h-full aspect-[4/5] max-h-full">
                <img
                  src={data.highlight.photoUrl}
                  alt={data.highlight.name}
                  className="w-full h-full object-cover object-top ole-player-photo-bw shadow-[0_24px_48px_rgba(0,0,0,0.45)]"
                  draggable={false}
                  referrerPolicy="no-referrer"
                />
                {/* Borda inferior amarela 3px — assinatura BVB */}
                <div className="absolute inset-x-0 bottom-0 h-[3px] bg-neon-yellow" aria-hidden />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Action buttons + scroll cue (centrado no rodapé) */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-4 sm:px-8 pb-5 sm:pb-7">
        <div className="mx-auto max-w-6xl flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {actions.map((a) => {
              const cls =
                a.variant === 'primary'
                  ? 'bg-neon-yellow text-black hover:bg-white px-4 py-2.5 font-display font-bold uppercase tracking-[0.18em] text-[11px] sm:text-[12px] transition-colors rounded-sm shadow-[0_4px_12px_rgba(253,225,0,0.25)]'
                  : 'bg-black border border-white/15 text-white px-4 py-2.5 font-display font-bold uppercase tracking-[0.18em] text-[11px] sm:text-[12px] hover:border-neon-yellow hover:text-neon-yellow transition-colors rounded-sm';
              if (a.href) {
                return (
                  <Link key={a.label} to={a.href} className={cls}>
                    {a.label}
                  </Link>
                );
              }
              return (
                <button key={a.label} type="button" onClick={a.onClick} className={cls}>
                  {a.label}
                </button>
              );
            })}
          </div>
          {data.scrollCueTargetId ? (
            <button
              type="button"
              aria-label="Mais detalhes"
              onClick={() => {
                const el = document.getElementById(data.scrollCueTargetId!);
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-neon-yellow transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.25)]"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Mais detalhes"
              className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-neon-yellow transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.25)]"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function CrestCircle({
  short,
  variant,
  crestUrl,
  alt,
}: {
  short: string;
  variant: 'onYellow' | 'onDark';
  crestUrl?: string | null;
  alt?: string;
}) {
  const ring = variant === 'onYellow' ? 'border-black' : 'border-white';
  const text = variant === 'onYellow' ? 'text-black' : 'text-white';
  const bg = variant === 'onYellow' ? 'bg-neon-yellow' : 'bg-deep-black';
  const baseSize = 'w-12 h-12 sm:w-16 sm:h-16';
  if (crestUrl?.trim()) {
    // Brasão real — sem circle/border/bg, só a logo respirando sobre o fundo
    return (
      <img
        src={crestUrl}
        alt={alt ?? short}
        className={`${baseSize} object-contain shrink-0`}
        referrerPolicy="no-referrer"
        draggable={false}
      />
    );
  }
  return (
    <div
      className={`${baseSize} rounded-full border-[2.5px] grid place-items-center shrink-0 ${ring} ${bg}`}
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

