/**
 * Legend Page — perfil de embaixador/lenda do futebol ("museu vivo").
 *
 * DS 2027 "Respeito é ouro": a lenda é o topo da escada — OURO CHAPADO.
 * Composto por blocos reutilizáveis pra qualquer lenda futura:
 *  - Hero: ouro chapado + nome na voz + a carta colada torta (OVR em Anton)
 *  - Achievements: mini-cards com número em ole-num
 *  - Trajetória: timeline horizontal de marcos
 *  - DNA do Campeão: grid 3x2 de atributos
 *  - Tributos: citações de outros grandes sobre a lenda
 *  - Mural dos Managers: feed social (curtir + mensagens)
 *  - Store CTA: banner amarelo levando ao Legacy Pack
 *
 * Dados em src/data/legends.ts (LEGENDS_BY_SLUG, indexado por slug URL-safe).
 * Rota pública: game.olefoot.ai/legend/{slug}
 */

import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BarraSegmentos, FitaRua, MarcaRua, SecaoRua } from '@/components/ui';
import { ALL_LEGEND_SLUGS, findLegend } from '@/data/legends';
import { useLegendSocial } from '@/hooks/useLegendSocial';
import { useLegendMeta } from '@/hooks/useLegendMeta';
import { LegendActions } from '@/components/legend/LegendActions';
import { LegendMessages } from '@/components/legend/LegendMessages';
import { LegendSearchBar } from '@/components/legend/LegendSearchBar';
import { LegendSearchModal } from '@/components/legend/LegendSearchModal';
import { LegendStoreCTA } from '@/components/legend/LegendStoreCTA';
import { L } from '@/i18n/L';

export function Legend() {
  const { id } = useParams<{ id: string }>();
  const legend = useMemo(() => findLegend(id), [id]);
  const social = useLegendSocial(legend.slug);
  const [searchOpen, setSearchOpen] = useState(false);

  // SEO + Open Graph (para divulgação social)
  useLegendMeta(legend);

  const ordem = ALL_LEGEND_SLUGS.indexOf(legend.slug) + 1;
  const nome = legend.name.charAt(0) + legend.name.slice(1).toLowerCase();

  return (
    <div className="min-h-screen text-papel">
      {/* ── HERO: degrau LENDA — ouro chapado, a carta colada torta ───── */}
      <section className="rua-grao relative w-full overflow-hidden bg-ouro-27 text-asfalto-27">
        <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-8 px-5 py-7 sm:px-8 sm:py-10">
          <div className="flex items-center justify-between gap-3 border-b-2 border-asfalto-27 pb-3 font-prova text-[11.5px] font-bold uppercase tracking-[0.2em]">
            <span>{L('Olefoot · Legends', 'Olefoot · Legends')}</span>
            {ordem > 0 && (
              <span className="tabular-nums">
                Nº {String(ordem).padStart(2, '0')}/{String(ALL_LEGEND_SLUGS.length).padStart(2, '0')}
              </span>
            )}
          </div>

          <LegendSearchBar onOpen={() => setSearchOpen(true)} totalCount={ALL_LEGEND_SLUGS.length} />

          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[1.1fr_1fr]">
            <div className="flex min-w-0 flex-col gap-4 text-center md:text-left">
              <p className="font-impact text-[clamp(18px,4.6vw,26px)] uppercase leading-tight">{legend.epithet}</p>
              <h1 className="font-voz leading-[0.85] [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(76px, 22vw, 168px)' }}>
                {nome}
              </h1>
              <p className="font-prova text-[12px] font-bold uppercase leading-relaxed tracking-[0.14em]">{legend.signature}</p>
            </div>

            {/* A carta — moldura de asfalto, OVR em Anton, inclinada como lambe. */}
            <div className="relative mx-auto w-full max-w-[320px] -rotate-2 bg-asfalto-27 p-3 shadow-[10px_10px_0_rgba(13,13,12,0.85)] transition-transform duration-300 hover:rotate-0">
              <div className="flex items-start justify-between gap-2 pb-3">
                <div className="flex flex-col">
                  <span className="font-impact text-[64px] leading-[0.82] text-ouro-27">{legend.ovr}</span>
                  <span className="mt-1 font-prova text-[10.5px] font-bold uppercase tracking-[0.2em] text-papel">OVR</span>
                </div>
                <MarcaRua tipo="escudo" className="h-10 bg-ouro-27" />
              </div>
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-concreto">
                {legend.photoUrl ? (
                  <img
                    src={legend.photoUrl}
                    alt={legend.fullName}
                    className="ole-player-photo-bw h-full w-full object-cover transition-all duration-500 hover:[filter:none]"
                    draggable={false}
                  />
                ) : (
                  <span aria-hidden className="grid h-full w-full place-items-center font-voz text-[160px] leading-none text-ouro-27/30">
                    {legend.name.charAt(0)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 pt-3 font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-ouro-27">
                <span>04 · {L('Lenda', 'Legend')}</span>
                <span className="block min-w-0 truncate font-voz text-[22px] normal-case tracking-normal text-papel">{nome}</span>
              </div>
            </div>
          </div>

          <figure className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
            <blockquote className="font-voz leading-[1.05]" style={{ fontSize: 'clamp(28px, 6.5vw, 44px)' }}>
              “{legend.quote}”
            </blockquote>
            {legend.quoteAuthor ? (
              <figcaption className="font-prova text-[11.5px] font-bold uppercase tracking-[0.16em]">— {legend.quoteAuthor}</figcaption>
            ) : null}
          </figure>

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
      </section>

      <FitaRua tags={['#persista', '#lenda', '#correloko', '#respeitoéouro']} inclinacao={2} className="-mt-5 py-2" />

      {/* ── TRAJETÓRIA — datas em spray, marcos em concreto com fio de ouro ── */}
      <section className="py-10 sm:py-14">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 sm:px-8">
          <div className="flex flex-col gap-1.5">
            <SecaoRua label={L('Trajetória', 'Career path')} aside={legend.trajectory.length} />
            <h2 className="font-voz text-[clamp(40px,10vw,60px)] leading-none">{L('Do chão até lenda.', 'From the ground to legend.')}</h2>
          </div>
          <div
            className="ole-scroll-x hide-scrollbar flex snap-x snap-mandatory gap-3 pb-2 sm:gap-4"
            role="list"
            aria-label={L(`Marcos da carreira de ${legend.name}`, `${legend.name} career milestones`)}
          >
            {legend.trajectory.map((ev, i) => (
              <article
                key={ev.year}
                role="listitem"
                className={`flex w-[220px] shrink-0 snap-start flex-col gap-3 p-4 sm:w-[240px] ${
                  i === legend.trajectory.length - 1 ? 'bg-ouro-27 text-asfalto-27' : 'border-l-[5px] border-ouro-27 bg-concreto'
                }`}
              >
                <p className={`font-spray text-[44px] font-black leading-none ${i === legend.trajectory.length - 1 ? '' : 'text-papel'}`}>{ev.year}</p>
                <p className={`text-[13px] leading-snug ${i === legend.trajectory.length - 1 ? 'font-medium' : 'text-suave'}`}>{ev.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── DNA DO CAMPEÃO — barras em segmentos de ouro ─────────────── */}
      <section className="pb-10 sm:pb-14">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 sm:px-8">
          <div className="flex flex-col gap-1.5">
            <SecaoRua label={L('DNA do campeão', "Champion's DNA")} />
            <h2 className="font-impact text-[clamp(40px,10vw,64px)] uppercase leading-[0.9]">
              {L('O que não', 'What you')} <span className="text-ouro-27">{L('se ensina.', "can't teach.")}</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {legend.dna.map((attr) => {
              const v = Math.max(0, Math.min(100, attr.value));
              return (
                <div key={attr.label} className="flex flex-col gap-3 border-l-[5px] border-ouro-27 bg-concreto px-4 py-3.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate font-prova text-[12px] font-bold uppercase tracking-[0.14em] text-papel">{attr.label}</span>
                    <span className="shrink-0 font-impact text-[32px] leading-none text-ouro-27 tabular-nums">{v}</span>
                  </div>
                  <BarraSegmentos valor={v} max={100} tom="ouro" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── A VOZ DO POVO — tributos colados no muro como lambe ───────── */}
      {legend.tributes && legend.tributes.length > 0 ? (
        <section className="pb-12 sm:pb-16">
          <div className="mx-auto flex max-w-3xl flex-col gap-8 px-5 sm:px-8">
            <SecaoRua label={L('A voz do povo', 'Voice of the people')} />
            {legend.tributes.map((t, i) => (
              <blockquote
                key={i}
                className="bg-cal px-5 py-6 text-asfalto-27 shadow-[8px_8px_0_rgba(0,0,0,0.6)] sm:px-7"
                style={{ transform: `rotate(${i % 2 === 0 ? -1.5 : 1.2}deg)` }}
              >
                <p className="font-voz leading-[1.1]" style={{ fontSize: 'clamp(24px, 5.6vw, 34px)' }}>
                  “{t.text}”
                </p>
                <footer className="mt-4 font-prova text-[11.5px] font-bold uppercase tracking-[0.14em]">
                  — {t.author}
                  {t.context ? <span className="ml-2 font-normal normal-case tracking-normal">({t.context})</span> : null}
                </footer>
              </blockquote>
            ))}
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
