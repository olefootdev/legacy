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
import { cn } from '@/lib/utils';

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
  stats: {
    label: string;
    value: string;
    /** Sprint C: se presente, vira link clicável (mini-painel manager). */
    href?: string;
    /** Sprint C: cor de acento opcional pro número (default neon-yellow). */
    tone?: 'accent' | 'success' | 'warning' | 'danger' | 'muted';
  }[];
  highlight: {
    /** Nome do jogador (vai no título grande em Moret italic). */
    name: string;
    /** Número decorativo gigante atrás (camisa, OVR, etc.). 1-3 dígitos. */
    number: number;
    quote: string;
    /** Foto do jogador (idealmente 4:5 portrait). Recebe filtro P&B BVB. */
    photoUrl?: string;
    /** Sprint C: tag editorial dinâmica (ex.: "Em forma", "Maestro"). */
    tag?: string;
    /** Sprint C: posição/role do jogador (ex.: "MEIA-CAMPISTA"). */
    position?: string;
    /** Sprint C: gols na temporada. */
    goalsSeason?: number;
    /** Sprint C: assistências na temporada. */
    assistsSeason?: number;
    /** Sprint C Fase D: vezes que foi MVP na temporada. */
    mvpsSeason?: number;
    /** Sprint C: forma últimos 5 jogos (W/D/L). */
    recentForm?: Array<'W' | 'D' | 'L'>;
    /** Sprint C: delta de OVR vs mintOverall (positivo = evoluiu). */
    deltaOvr?: number;
    /** Sprint C: CTA principal abaixo do destaque. */
    ctaPrimary?: { label: string; href?: string; onClick?: () => void };
    /** Sprint C: CTA secundário. */
    ctaSecondary?: { label: string; href?: string; onClick?: () => void };
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
    <section className={`relative w-full overflow-hidden ${sectionBg}`}>
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
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-8 pt-5 sm:pt-7 pb-16 sm:pb-20">
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

        {/* Stats strip — Sprint C: grade dinâmica (4 ou 5 colunas) + tiles clicáveis */}
        <div
          className={cn(
            'grid gap-1.5 sm:gap-2 md:gap-3 mb-10 sm:mb-14',
            data.stats.length === 4
              ? 'grid-cols-2 sm:grid-cols-4'
              : data.stats.length === 3
                ? 'grid-cols-3'
                : 'grid-cols-5',
          )}
        >
          {data.stats.map((s, i) => {
            const toneColor =
              s.tone === 'success'
                ? 'text-emerald-300'
                : s.tone === 'warning'
                  ? 'text-amber-300'
                  : s.tone === 'danger'
                    ? 'text-red-300'
                    : s.tone === 'muted'
                      ? 'text-white/65'
                      : 'text-neon-yellow';
            const inner = (
              <>
                <p
                  className={cn('tabular-nums leading-none italic', toneColor)}
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontWeight: 700,
                    fontSize: 'clamp(22px, 4.4vw, 44px)',
                  }}
                >
                  {s.value}
                </p>
                <p className="mt-1 sm:mt-1.5 text-white/65 uppercase tracking-[0.16em] sm:tracking-[0.22em] text-[9px] sm:text-[10px] md:text-[11px] font-bold">
                  {s.label}
                </p>
              </>
            );
            const baseCls = cn(
              statsBg(i),
              s.href && 'cursor-pointer transition-all hover:bg-black/85 hover:-translate-y-0.5',
            );
            if (s.href) {
              return (
                <Link key={s.label} to={s.href} className={baseCls}>
                  {inner}
                </Link>
              );
            }
            return (
              <article key={s.label} className={baseCls}>
                {inner}
              </article>
            );
          })}
        </div>

        {/* MVP — Sprint C Fase F: foto cinemática + info CENTRADA verticalmente com a foto */}
        <div className="relative grid grid-cols-[180px_1fr] sm:grid-cols-[260px_1fr] md:grid-cols-[360px_1fr] gap-5 sm:gap-7 md:gap-9 items-center pb-2">
          {/* Foto P&B + número decorativo — moldura editorial, ainda maior */}
          <div className="relative flex items-center justify-center">
            {/* Número decorativo atrás (oculto em viewports estreitos) */}
            <span
              aria-hidden
              className="hidden md:flex absolute inset-0 items-center justify-center leading-none tabular-nums text-neon-yellow/15 select-none pointer-events-none"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 'clamp(160px, 20vw, 320px)',
                letterSpacing: '-0.04em',
              }}
            >
              {String(data.highlight.number).padStart(2, '0')}
            </span>
            {data.highlight.photoUrl ? (
              <div className="relative z-10 w-full aspect-[4/5]">
                {/* Spotlight glow editorial atrás da foto */}
                <div
                  aria-hidden
                  className="absolute -inset-3 -z-10 bg-gradient-to-br from-neon-yellow/0 via-neon-yellow/0 to-black/35 blur-2xl"
                />
                <img
                  src={data.highlight.photoUrl}
                  alt={data.highlight.name}
                  className="w-full h-full object-cover object-top ole-player-photo-bw shadow-[0_24px_48px_rgba(0,0,0,0.45)]"
                  draggable={false}
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-x-0 bottom-0 h-[3px] bg-neon-yellow" aria-hidden />
              </div>
            ) : null}
          </div>

          {/* Info — direita, centrada verticalmente com a foto (Sprint C Fase F) */}
          <div className="min-w-0 sm:pl-2 flex flex-col gap-4 sm:gap-5">
            {/* Cabeçalho: Badges + Nome + Posição + Delta */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3 sm:mb-4">
                <span
                  className="inline-flex items-center rounded-[var(--radius-pill,9999px)] bg-black px-3 py-1 font-display text-[9px] font-black uppercase tracking-[0.22em] text-neon-yellow shadow-[0_2px_10px_rgba(0,0,0,0.25)]"
                >
                  MVP
                </span>
                {data.highlight.tag ? (
                  <span
                    className="inline-flex items-center rounded-[var(--radius-pill,9999px)] bg-black px-3 py-1 font-display text-[9px] font-black uppercase tracking-[0.22em] text-neon-yellow shadow-[0_2px_10px_rgba(0,0,0,0.25)]"
                  >
                    {data.highlight.tag}
                  </span>
                ) : null}
              </div>
              <h3
                className="ole-headline-italic text-black leading-[0.88] [overflow-wrap:anywhere]"
                style={{ fontSize: 'clamp(34px, 7vw, 88px)' }}
              >
                {data.highlight.name.split(' ').slice(0, 1)}
                <br />
                {data.highlight.name.split(' ').slice(1).join(' ')}
              </h3>
              {data.highlight.position ? (
                <p className="mt-3 sm:mt-4 flex flex-wrap items-center gap-2 font-display text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.28em] text-black/75">
                  <span>{data.highlight.position}</span>
                  {typeof data.highlight.deltaOvr === 'number' && data.highlight.deltaOvr !== 0 ? (
                    <span
                      className={cn(
                        'inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-black tracking-[0.18em]',
                        data.highlight.deltaOvr > 0
                          ? 'bg-emerald-500/90 text-black'
                          : 'bg-red-500/90 text-white',
                      )}
                    >
                      {data.highlight.deltaOvr > 0 ? '▲' : '▼'} {Math.abs(data.highlight.deltaOvr)} OVR
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>

            {/* Zona 2: Quote (centro vertical, opcional) */}
            <blockquote
              className="ole-headline-italic text-black/80 max-w-md leading-snug"
              style={{ fontSize: 'clamp(14px, 1.9vw, 19px)' }}
            >
              “{data.highlight.quote}”
            </blockquote>

            {/* Mini-stats (gols/assists/mvps/forma) — Sprint C Fase F: sem CTA, sem zona 3 wrapper */}
            {(typeof data.highlight.goalsSeason === 'number'
              || typeof data.highlight.assistsSeason === 'number'
              || typeof data.highlight.mvpsSeason === 'number'
              || (data.highlight.recentForm && data.highlight.recentForm.length > 0)) ? (
              <div className="flex flex-wrap items-end gap-5 sm:gap-7">
                {typeof data.highlight.goalsSeason === 'number' ? (
                  <div className="min-w-0">
                    <p
                      className="italic text-black tabular-nums leading-none"
                      style={{
                        fontFamily: 'var(--font-serif-hero)',
                        fontWeight: 700,
                        fontSize: 'clamp(28px, 5vw, 44px)',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {data.highlight.goalsSeason}
                    </p>
                    <p className="mt-1 font-display text-[9px] font-bold uppercase tracking-[0.22em] text-black/65">
                      Gols
                    </p>
                  </div>
                ) : null}
                {typeof data.highlight.assistsSeason === 'number' ? (
                  <div className="min-w-0">
                    <p
                      className="italic text-black tabular-nums leading-none"
                      style={{
                        fontFamily: 'var(--font-serif-hero)',
                        fontWeight: 700,
                        fontSize: 'clamp(28px, 5vw, 44px)',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {data.highlight.assistsSeason}
                    </p>
                    <p className="mt-1 font-display text-[9px] font-bold uppercase tracking-[0.22em] text-black/65">
                      Assistências
                    </p>
                  </div>
                ) : null}
                {typeof data.highlight.mvpsSeason === 'number' ? (
                  <div className="min-w-0">
                    <p
                      className="italic text-black tabular-nums leading-none"
                      style={{
                        fontFamily: 'var(--font-serif-hero)',
                        fontWeight: 700,
                        fontSize: 'clamp(28px, 5vw, 44px)',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {data.highlight.mvpsSeason}
                    </p>
                    <p className="mt-1 font-display text-[9px] font-bold uppercase tracking-[0.22em] text-black/65">
                      MVPs
                    </p>
                  </div>
                ) : null}
                {data.highlight.recentForm && data.highlight.recentForm.length > 0 ? (
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      {data.highlight.recentForm.slice(0, 5).map((r, i) => (
                        <span
                          key={i}
                          className={cn(
                            'inline-flex h-4 w-4 items-center justify-center font-display text-[9px] font-black uppercase',
                            r === 'W'
                              ? 'bg-emerald-500 text-black'
                              : r === 'D'
                                ? 'bg-amber-400 text-black'
                                : 'bg-red-500 text-white',
                          )}
                          style={{ borderRadius: '3px' }}
                          title={r === 'W' ? 'Vitória' : r === 'D' ? 'Empate' : 'Derrota'}
                        >
                          {r === 'W' ? 'V' : r === 'D' ? 'E' : 'D'}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1.5 font-display text-[9px] font-bold uppercase tracking-[0.22em] text-black/65">
                      Forma · 5 jogos
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* CTAs do destaque (Sprint C Fase E: dentro da zona 3) */}
            {(data.highlight.ctaPrimary || data.highlight.ctaSecondary) ? (
              <div className="flex flex-wrap gap-2">
                {data.highlight.ctaPrimary ? (
                  data.highlight.ctaPrimary.href ? (
                    <Link
                      to={data.highlight.ctaPrimary.href}
                      className="inline-flex items-center bg-black px-5 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.22em] text-neon-yellow shadow-[0_4px_14px_rgba(0,0,0,0.3)] transition-all hover:bg-deep-black hover:scale-[1.02]"
                      style={{ borderRadius: 'var(--radius-sm)' }}
                    >
                      {data.highlight.ctaPrimary.label}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={data.highlight.ctaPrimary.onClick}
                      className="inline-flex items-center bg-black px-5 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.22em] text-neon-yellow shadow-[0_4px_14px_rgba(0,0,0,0.3)] transition-all hover:bg-deep-black hover:scale-[1.02]"
                      style={{ borderRadius: 'var(--radius-sm)' }}
                    >
                      {data.highlight.ctaPrimary.label}
                    </button>
                  )
                ) : null}
                {data.highlight.ctaSecondary ? (
                  data.highlight.ctaSecondary.href ? (
                    <Link
                      to={data.highlight.ctaSecondary.href}
                      className="inline-flex items-center border border-black/70 bg-transparent px-5 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.22em] text-black transition-colors hover:bg-black/10"
                      style={{ borderRadius: 'var(--radius-sm)' }}
                    >
                      {data.highlight.ctaSecondary.label}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={data.highlight.ctaSecondary.onClick}
                      className="inline-flex items-center border border-black/70 bg-transparent px-5 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.22em] text-black transition-colors hover:bg-black/10"
                      style={{ borderRadius: 'var(--radius-sm)' }}
                    >
                      {data.highlight.ctaSecondary.label}
                    </button>
                  )
                ) : null}
              </div>
            ) : null}
          </div>

        </div>
      </div>

      {/* Action buttons + scroll cue — Sprint C Fase D: só renderiza se houver actions */}
      {actions.length > 0 || data.scrollCueTargetId ? (
        <div className="absolute inset-x-0 bottom-0 z-10 px-4 sm:px-8 pb-5 sm:pb-7">
          <div className="mx-auto max-w-6xl flex flex-col items-center gap-3">
            {actions.length > 0 ? (
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
            ) : null}
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
            ) : null}
          </div>
        </div>
      ) : null}
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
  align?: 'left' | 'right' | 'center';
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

