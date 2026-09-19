/**
 * Legend Page — perfil de embaixador/lenda do futebol ("museu vivo").
 *
 * Modelo visual: BVB Rebrand 2023 (DesignStudio) + Legacy Tech Olefoot.
 * Composto por blocos reutilizáveis pra qualquer lenda futura:
 *  - Hero: fundo amarelo + foto B&W + OVR (ole-num) + nome em Anton
 *  - Achievements: mini-cards com número em ole-num
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
import { useParams } from 'react-router-dom';
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
  const legend = useMemo(() => findLegend(id), [id]);
  const social = useLegendSocial(legend.slug);
  const [searchOpen, setSearchOpen] = useState(false);

  // SEO + Open Graph (para divulgação social)
  useLegendMeta(legend);

  return (
    <div className="min-h-screen bg-deep-black text-white">
      {/* ── HERO: fundo amarelo + foto + OVR/era badge ─────────────── */}
      <section className="relative w-full overflow-hidden bg-neon-yellow">
        <div className="relative z-10 mx-auto max-w-3xl px-5 sm:px-8 py-8 sm:py-12">
          {/* 1. Search centralizada com borda preta — primeiro elemento
              do hero. Navegação back disponível pelo header global +
              bottom nav; mudança de lenda via este search. */}
          <div className="mb-9 sm:mb-12 mt-2">
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
            className="font-impact uppercase break-words text-black text-center leading-[1.1]"
            style={{ fontSize: 'clamp(56px, 15vw, 128px)' }}
          >
            {legend.name.charAt(0) + legend.name.slice(1).toLowerCase()}
          </h1>

          {/* 5. Data/conquista textual editorial — substitui "era · país" */}
          <p
            className="mt-4 text-center font-mono uppercase text-black/75"
            style={{
              fontSize: '11.5px',
              letterSpacing: '0.16em',
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
                className="w-full h-full object-cover ole-player-photo-bw transition-all duration-500 hover:[filter:none]"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full bg-black grid place-items-center">
                <span
                  className="font-impact text-white/15 uppercase"
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
            {/* OVR badge — número Archivo volt no preto */}
            <div className="absolute top-3 left-3 z-10 bg-black px-2.5 py-1.5">
              <p
                className="ole-num text-neon-yellow leading-none"
                style={{ fontSize: 'clamp(26px, 4.2vw, 36px)' }}
              >
                {legend.ovr}
              </p>
              <p className="mt-0.5 font-mono uppercase text-giz" style={{ fontSize: '9px', letterSpacing: '0.16em' }}>
                OVR
              </p>
            </div>
            {/* Selo — canto superior direito */}
            <div className="absolute top-3 right-3 z-10 bg-black px-2 py-1">
              <p className="font-mono uppercase text-neon-yellow" style={{ fontSize: '9.5px', letterSpacing: '0.14em' }}>
                Lenda
              </p>
            </div>
          </div>

          {/* 7. Frase — quote logo abaixo da foto */}
          <blockquote
            className="mt-8 sm:mt-10 font-semibold text-black/85 text-center max-w-2xl mx-auto leading-snug"
            style={{ fontSize: 'clamp(17px, 2.4vw, 22px)' }}
          >
            "{legend.quote}"
          </blockquote>
          {legend.quoteAuthor ? (
            <p
              className="mt-3 text-black/60 font-mono uppercase text-center"
              style={{ fontSize: '11px', letterSpacing: '0.14em' }}
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
              className="font-impact uppercase text-neon-yellow leading-[1.1]"
              style={{ fontSize: 'clamp(28px, 4.5vw, 40px)' }}
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
                  className="shrink-0 snap-start w-[210px] sm:w-[230px] bg-card border border-white/10 border-l-2 border-l-neon-yellow p-4 transition-colors hover:bg-card-hi"
                >
                  <p
                    className="ole-num text-neon-yellow leading-none"
                    style={{ fontSize: 'clamp(24px, 3.4vw, 28px)' }}
                  >
                    {ev.year}
                  </p>
                  <p className="mt-3 text-giz text-[12px] sm:text-[13px] leading-snug">
                    {ev.text}
                  </p>
                </article>
              ))}
            </div>
            <div className="mt-3 h-[3px] bg-card-hi relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1/3 bg-neon-yellow" aria-hidden />
            </div>
          </div>
        </div>
      </section>

      {/* ── DNA DO CAMPEÃO — grid 3x2 ─────────────────────────────── */}
      <section className="relative bg-deep-black pb-10 sm:pb-14">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 relative">
          <header className="flex items-center gap-3 mb-6">
            <span aria-hidden className="w-1 h-8 bg-neon-yellow" />
            <h2
              className="font-impact uppercase text-neon-yellow leading-[1.1]"
              style={{ fontSize: 'clamp(28px, 4.5vw, 40px)' }}
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
                  className="relative bg-card border border-white/10 p-4 overflow-hidden"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate font-mono uppercase text-cimento" style={{ fontSize: '11px', letterSpacing: '0.14em' }}>
                      {attr.label}
                    </span>
                    <span className="ole-num shrink-0 text-neon-yellow leading-none" style={{ fontSize: '28px' }}>
                      {v}
                    </span>
                  </div>
                  <div className="mt-3 h-[3px] bg-card-hi overflow-hidden">
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
                className="font-impact uppercase text-neon-yellow leading-[1.1]"
                style={{ fontSize: 'clamp(28px, 4.5vw, 40px)' }}
              >
                A Voz do Povo
              </h2>
            </header>
            <div className="flex flex-col gap-4">
              {legend.tributes.map((t, i) => (
                <blockquote
                  key={i}
                  className="border-l-[3px] border-l-neon-yellow bg-card px-5 py-5 sm:px-7 sm:py-7"
                >
                  <p
                    className="font-semibold text-giz leading-snug"
                    style={{ fontSize: 'clamp(17px, 2.4vw, 22px)' }}
                  >
                    "{t.text}"
                  </p>
                  <footer
                    className="mt-3 font-mono uppercase text-neon-yellow"
                    style={{ fontSize: '11px', letterSpacing: '0.14em' }}
                  >
                    — {t.author}
                    {t.context ? (
                      <span className="text-cimento ml-2 normal-case font-normal">
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
