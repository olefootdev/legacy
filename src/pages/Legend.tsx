/**
 * Legend Page — perfil de embaixador/lenda do futebol ("museu vivo").
 *
 * Modelo visual: BVB Rebrand 2023 (DesignStudio) + Legacy Tech Olefoot.
 * Composto por blocos reutilizáveis pra qualquer lenda futura:
 *  - Hero: fundo amarelo + foto B&W + OVR/era badge + quote Moret italic
 *  - Achievements: 4 mini-cards Moret italic (gols, mundiais, etc.)
 *  - Trajetória: timeline horizontal de marcos
 *  - DNA do Campeão: grid 3x2 de atributos
 *  - Tributos: citações de outros grandes sobre a lenda
 *  - Mural dos Managers: feed social (curtir + mensagens)
 *  - Store CTA: banner amarelo levando ao Legacy Pack
 *
 * Dados em src/data/legends.ts (LEGENDS_BY_SLUG, indexado por slug URL-safe).
 * Rota pública: game.olefoot.com/legend/{slug}
 */

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Eyebrow } from '@/components/ui';
import { ALL_LEGEND_SLUGS, findLegend } from '@/data/legends';
import { useLegendSocial } from '@/hooks/useLegendSocial';
import { useLegendMeta } from '@/hooks/useLegendMeta';
import { LegendActions } from '@/components/legend/LegendActions';
import { LegendMessages } from '@/components/legend/LegendMessages';
import { LegendSearchBar } from '@/components/legend/LegendSearchBar';
import { LegendSearchModal } from '@/components/legend/LegendSearchModal';
import { LegendStoreCTA } from '@/components/legend/LegendStoreCTA';

export function Legend() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const legend = useMemo(() => findLegend(id), [id]);
  const social = useLegendSocial(legend.slug);
  const [searchOpen, setSearchOpen] = useState(false);

  // SEO + Open Graph (para divulgação social)
  useLegendMeta(legend);

  return (
    <div className="min-h-screen bg-deep-black text-white">
      {/* ── HERO: fundo amarelo + foto + OVR/era badge ─────────────── */}
      <section className="relative w-full overflow-hidden bg-neon-yellow">
        {/* Watermark sutil do nome */}
        <div
          className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
          aria-hidden
        >
          <span
            className="font-display font-black uppercase tracking-tight whitespace-nowrap text-black/[0.04]"
            style={{ fontSize: 'clamp(160px, 28vw, 420px)', lineHeight: '0.85' }}
          >
            {legend.name}
          </span>
        </div>

        <div className="relative z-10 mx-auto max-w-3xl px-5 sm:px-8 py-8 sm:py-12">
          {/* 1. Topbar: Voltar (esquerda) */}
          <div className="flex items-center justify-between mb-7 sm:mb-9">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-black/70 hover:text-black font-display uppercase font-black"
              style={{ fontSize: '11px', letterSpacing: '0.22em' }}
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
          </div>

          {/* Search centralizada com borda preta — sinaliza claramente
              que há uma galeria de outras lendas pra explorar */}
          <div className="mb-9 sm:mb-12">
            <LegendSearchBar
              onOpen={() => setSearchOpen(true)}
              totalCount={ALL_LEGEND_SLUGS.length}
            />
          </div>

          {/* 2. Eyebrow (frase) */}
          <Eyebrow align="center" className="!text-black mb-5 sm:mb-6">
            <span className="!text-black">{legend.epithet}</span>
          </Eyebrow>

          {/* 3. Nome */}
          <h1
            className="ole-headline-italic text-black text-center leading-[0.9]"
            style={{ fontSize: 'clamp(72px, 16vw, 144px)' }}
          >
            {legend.name.charAt(0) + legend.name.slice(1).toLowerCase()}
          </h1>

          {/* 4. Régua editorial */}
          <div
            className="mx-auto mt-5 w-12 h-[3px] bg-black"
            aria-hidden
          />

          {/* 5. Data/conquista textual editorial — substitui "era · país" */}
          <p
            className="mt-4 text-center font-display font-black uppercase text-black/75"
            style={{
              fontSize: 'clamp(11px, 1.3vw, 12px)',
              letterSpacing: '0.28em',
              lineHeight: 1.4,
            }}
          >
            {legend.signature}
          </p>

          {/* 6. Foto + OVR overlay */}
          <div className="relative mx-auto mt-8 sm:mt-10 w-full max-w-[320px] aspect-[4/5]">
            {legend.photoUrl ? (
              <img
                src={legend.photoUrl}
                alt={legend.fullName}
                className="w-full h-full object-cover ole-player-photo-bw shadow-[0_24px_48px_rgba(0,0,0,0.18)] transition-all duration-500 hover:[filter:none]"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full bg-black/90 grid place-items-center shadow-[0_24px_48px_rgba(0,0,0,0.22)]">
                <span
                  className="font-display font-black text-white/15 uppercase"
                  style={{
                    fontSize: 'clamp(96px, 18vw, 160px)',
                    lineHeight: 1,
                  }}
                  aria-hidden
                >
                  {legend.name.charAt(0)}
                </span>
              </div>
            )}
            {/* OVR badge — Moret italic neon-yellow no preto */}
            <div className="absolute top-3 left-3 z-10 bg-black/90 px-2.5 py-1.5 shadow-[0_4px_14px_rgba(0,0,0,0.45)]">
              <p
                className="italic text-neon-yellow tabular-nums leading-none"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontWeight: 700,
                  fontSize: 'clamp(28px, 4.5vw, 40px)',
                  letterSpacing: '-0.04em',
                }}
              >
                {legend.ovr}
              </p>
              <p
                className="mt-0.5 font-display font-black uppercase text-white/85"
                style={{ fontSize: '8px', letterSpacing: '0.22em' }}
              >
                OVR
              </p>
            </div>
            {/* Era ribbon — canto superior direito */}
            <div className="absolute top-3 right-3 z-10 bg-neon-yellow border border-black/30 px-2.5 py-1 shadow-[0_4px_14px_rgba(0,0,0,0.25)]">
              <p
                className="font-display font-black uppercase text-black"
                style={{ fontSize: '9px', letterSpacing: '0.22em' }}
              >
                Lenda
              </p>
            </div>
          </div>

          {/* 7. Frase — quote em Moret italic logo abaixo da foto */}
          <blockquote
            className="ole-headline-italic mt-8 sm:mt-10 text-black/85 text-center max-w-2xl mx-auto leading-snug"
            style={{ fontSize: 'clamp(17px, 2.4vw, 22px)' }}
          >
            "{legend.quote}"
          </blockquote>
          {legend.quoteAuthor ? (
            <p
              className="mt-3 text-black/60 font-display uppercase font-bold text-center"
              style={{ fontSize: '11px', letterSpacing: '0.22em' }}
            >
              — {legend.quoteAuthor}
            </p>
          ) : null}

          {/* 8. CTA Treinar + 9. Modal social (Curtir + Compartilhar) */}
          <div className="mt-9 sm:mt-11">
            <LegendActions
              slug={legend.slug}
              name={legend.name}
              liked={social.liked}
              likeCount={social.likeCount}
              onToggleLike={social.toggleLike}
              storeHighlightId={legend.storeHighlightId}
              variant="on-yellow"
            />
          </div>
        </div>
      </section>

      {/* ── TRAJETÓRIA — timeline horizontal ──────────────────────── */}
      <section className="relative bg-deep-black py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <header className="flex items-center gap-3 mb-6">
            <span aria-hidden className="w-1 h-8 bg-neon-yellow" />
            <h2
              className="italic text-neon-yellow leading-none"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontWeight: 700,
                fontSize: 'clamp(28px, 4.5vw, 40px)',
                letterSpacing: '-0.02em',
              }}
            >
              Trajetória
            </h2>
          </header>

          <div className="relative">
            <div
              className="ole-scroll-x hide-scrollbar flex gap-3 sm:gap-4 pb-2 snap-x snap-mandatory scroll-smooth"
              style={{ scrollPaddingLeft: '0px' }}
              role="list"
              aria-label={`Marcos da carreira de ${legend.name}`}
            >
              {legend.trajectory.map((ev) => (
                <article
                  key={ev.year}
                  role="listitem"
                  className="shrink-0 snap-start w-[210px] sm:w-[230px] bg-[var(--color-card)] border border-[var(--color-border)] border-l-2 border-l-neon-yellow p-4 transition-transform duration-200 hover:-translate-y-0.5"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                >
                  <p
                    className="italic text-neon-yellow tabular-nums leading-none"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontWeight: 700,
                      fontSize: 'clamp(28px, 3.8vw, 32px)',
                      letterSpacing: '-0.03em',
                    }}
                  >
                    {ev.year}
                  </p>
                  <p className="mt-3 text-white/85 text-[12px] sm:text-[13px] leading-snug">
                    {ev.text}
                  </p>
                </article>
              ))}
            </div>
            <div className="mt-3 h-[3px] bg-white/8 relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1/3 bg-neon-yellow/85" aria-hidden />
            </div>
          </div>
        </div>
      </section>

      {/* ── DNA DO CAMPEÃO — grid 3x2 ─────────────────────────────── */}
      <section className="relative bg-deep-black pb-10 sm:pb-14">
        <div
          className="diagonal-accent"
          style={{ top: '-40px', right: '-60px', width: '300px', height: '300px' }}
          aria-hidden
        />
        <div className="mx-auto max-w-6xl px-5 sm:px-8 relative">
          <header className="flex items-center gap-3 mb-6">
            <span aria-hidden className="w-1 h-8 bg-neon-yellow" />
            <h2
              className="italic text-neon-yellow leading-none"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontWeight: 700,
                fontSize: 'clamp(28px, 4.5vw, 40px)',
                letterSpacing: '-0.02em',
              }}
            >
              DNA do Campeão
            </h2>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {legend.dna.map((attr) => {
              const v = Math.max(0, Math.min(100, attr.value));
              return (
                <div
                  key={attr.label}
                  className="relative bg-[var(--color-card)] border border-[var(--color-border)] p-4 overflow-hidden"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className="font-display font-bold uppercase text-white/65"
                      style={{ fontSize: '11px', letterSpacing: '0.18em' }}
                    >
                      {attr.label}
                    </span>
                    <span
                      className="text-neon-yellow tabular-nums leading-none italic"
                      style={{
                        fontFamily: 'var(--font-serif-hero)',
                        fontWeight: 700,
                        fontSize: '32px',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {v}
                    </span>
                  </div>
                  <div className="mt-3 h-[3px] bg-white/8 overflow-hidden">
                    <div
                      className="h-full bg-neon-yellow transition-all duration-500"
                      style={{ width: `${v}%` }}
                      aria-hidden
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── TRIBUTOS — outras lendas falando sobre esta ────────────── */}
      {legend.tributes && legend.tributes.length > 0 ? (
        <section className="relative bg-deep-black pb-10 sm:pb-14">
          <div className="mx-auto max-w-3xl px-5 sm:px-8">
            <header className="flex items-center gap-3 mb-6">
              <span aria-hidden className="w-1 h-8 bg-neon-yellow" />
              <h2
                className="italic text-neon-yellow leading-none"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontWeight: 700,
                  fontSize: 'clamp(28px, 4.5vw, 40px)',
                  letterSpacing: '-0.02em',
                }}
              >
                A Voz do Povo
              </h2>
            </header>
            <div className="flex flex-col gap-4">
              {legend.tributes.map((t, i) => (
                <blockquote
                  key={i}
                  className="border-l-[3px] border-l-neon-yellow bg-[var(--color-card)] px-5 py-5 sm:px-7 sm:py-7"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                >
                  <p
                    className="italic text-white/90 leading-snug"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontWeight: 700,
                      fontSize: 'clamp(17px, 2.4vw, 22px)',
                    }}
                  >
                    "{t.text}"
                  </p>
                  <footer
                    className="mt-3 font-display font-bold uppercase text-neon-yellow/85"
                    style={{ fontSize: '11px', letterSpacing: '0.22em' }}
                  >
                    — {t.author}
                    {t.context ? (
                      <span className="text-white/40 ml-2 normal-case font-normal">
                        ({t.context})
                      </span>
                    ) : null}
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── MURAL DOS MANAGERS — social ─────────────────────────────── */}
      <LegendMessages
        legendName={legend.name}
        messages={social.messages}
        onPost={social.postMessage}
        onRemove={social.removeMessage}
      />

      {/* ── STORE CTA ───────────────────────────────────────────────── */}
      <LegendStoreCTA
        legendName={legend.name}
        storeHighlightId={legend.storeHighlightId}
      />

      {/* ── Modal de busca (galeria de outras lendas) ───────────────── */}
      <LegendSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        currentSlug={legend.slug}
      />
    </div>
  );
}

export default Legend;
