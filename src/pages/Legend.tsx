/**
 * Legend Page — perfil de embaixador/lenda do futebol.
 *
 * Modelo visual: BVB Rebrand 2023 (DesignStudio).
 * - Hero: fundo amarelo + seção diagonal preta à direita
 * - Eyebrow + Agency FB caps + citação Moret italic
 * - Timeline TRAJETÓRIA (carrossel horizontal de cards pretos)
 * - DNA DO CAMPEÃO: grid 3x2 de atributos com barra amarela
 *
 * Dados estáticos por enquanto (LEGENDS_BY_ID). Quando o backend tiver
 * Hall of Fame, trocar para fetch real preservando este componente.
 */

import { useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Eyebrow } from '@/components/ui';

interface LegendEvent {
  year: number;
  text: string;
}

interface LegendAttribute {
  /** Nome curto exibido (ex: "FINALIZAÇÃO"). */
  label: string;
  /** Valor 0-100 (Football Manager scale). */
  value: number;
}

interface LegendData {
  id: string;
  name: string;
  /** Eyebrow do hero ("O REI DO FUTEBOL"). */
  epithet: string;
  /** Citação curta atribuída — exibida em Moret italic. */
  quote: string;
  /** Autor da citação ("— Edson Arantes do Nascimento"). */
  quoteAuthor?: string;
  /** Foto P&B 400×500 idealmente. Opcional — fallback decorativo abaixo. */
  photoUrl?: string;
  /** Marcos de carreira ordenados por ano. */
  trajectory: LegendEvent[];
  /** 6 atributos core (3×2 no DNA grid). */
  dna: LegendAttribute[];
  /** Cor de tema secundária — default amarelo. */
}

const LEGENDS_BY_ID: Record<string, LegendData> = {
  pele: {
    id: 'pele',
    name: 'PELÉ',
    epithet: 'O Rei do Futebol',
    quote:
      'Eu nasci para jogar futebol, da mesma forma que Beethoven nasceu para escrever música e Michelangelo nasceu para pintar.',
    quoteAuthor: 'Edson Arantes do Nascimento',
    trajectory: [
      { year: 1958, text: 'Copa do Mundo aos 17 anos — gol de placa contra a Suécia na final' },
      { year: 1962, text: 'Bicampeonato mundial — lesão na primeira fase, Brasil campeão' },
      { year: 1970, text: 'Tricampeonato — seleção de todos os tempos' },
      { year: 1977, text: 'Adeus ao futebol no Cosmos de Nova York' },
    ],
    dna: [
      { label: 'FINALIZAÇÃO', value: 98 },
      { label: 'DRIBLE', value: 96 },
      { label: 'VELOCIDADE', value: 94 },
      { label: 'PASSE', value: 92 },
      { label: 'FÍSICO', value: 88 },
      { label: 'MENTALIDADE', value: 99 },
    ],
  },
  garrincha: {
    id: 'garrincha',
    name: 'GARRINCHA',
    epithet: 'A Alegria do Povo',
    quote:
      'Eu jogava futebol pela alegria de jogar. Não pensava em prêmio, em dinheiro, em fama.',
    quoteAuthor: 'Manuel Francisco dos Santos',
    trajectory: [
      { year: 1958, text: 'Copa do Mundo — desequilibrou no flanco direito' },
      { year: 1962, text: 'Bola de Ouro do Mundial após Pelé se lesionar' },
      { year: 1966, text: 'Última Copa pela seleção brasileira' },
    ],
    dna: [
      { label: 'DRIBLE', value: 99 },
      { label: 'VELOCIDADE', value: 92 },
      { label: 'FINALIZAÇÃO', value: 84 },
      { label: 'PASSE', value: 80 },
      { label: 'FÍSICO', value: 78 },
      { label: 'MENTALIDADE', value: 76 },
    ],
  },
  zico: {
    id: 'zico',
    name: 'ZICO',
    epithet: 'O Galinho de Quintino',
    quote: 'O futebol arte é o futebol que faz a torcida sonhar.',
    quoteAuthor: 'Arthur Antunes Coimbra',
    trajectory: [
      { year: 1976, text: 'Estreia profissional pelo Flamengo' },
      { year: 1981, text: 'Mundial Interclubes — 3-0 sobre o Liverpool' },
      { year: 1982, text: 'Copa do Mundo na Espanha — geração de ouro' },
    ],
    dna: [
      { label: 'PASSE', value: 96 },
      { label: 'FINALIZAÇÃO', value: 92 },
      { label: 'MENTALIDADE', value: 90 },
      { label: 'DRIBLE', value: 88 },
      { label: 'VELOCIDADE', value: 80 },
      { label: 'FÍSICO', value: 78 },
    ],
  },
};

export function Legend() {
  const { id = 'pele' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const legend: LegendData = useMemo(
    () => LEGENDS_BY_ID[id] ?? (LEGENDS_BY_ID.pele as LegendData),
    [id],
  );

  return (
    <div className="min-h-screen bg-deep-black text-white">
      {/* ── HERO: fundo amarelo + diagonal preta à direita ───────── */}
      <section className="relative w-full overflow-hidden bg-neon-yellow">
        {/* Watermark sutil do nome — preto sobre amarelo, opacidade baixa */}
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

        {/* Conteúdo do hero — vertical, centrado, na sequência: epithet → nome → foto → frase → CTA */}
        <div className="relative z-10 mx-auto max-w-3xl px-5 sm:px-8 py-8 sm:py-12">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-10 sm:mb-14">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-black/70 hover:text-black font-display text-[12px] uppercase tracking-[0.18em] font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
            <Link
              to="/"
              className="text-black/55 hover:text-black font-display text-[12px] uppercase tracking-[0.18em] font-bold"
            >
              Olefoot
            </Link>
          </div>

          {/* 1. Epithet */}
          <Eyebrow align="center" className="!text-black mb-5 sm:mb-6">
            <span className="!text-black">{legend.epithet}</span>
          </Eyebrow>

          {/* 2. Nome */}
          <h1
            className="ole-headline text-black text-center leading-[0.85]"
            style={{ fontSize: 'clamp(64px, 14vw, 128px)' }}
          >
            {legend.name}
          </h1>

          {/* Régua decorativa */}
          <div className="mx-auto mt-5 w-16 h-[3px] bg-black" aria-hidden />

          {/* 3. Foto */}
          <div className="relative mx-auto mt-8 sm:mt-10 w-full max-w-[320px] aspect-[4/5]">
            {legend.photoUrl ? (
              <img
                src={legend.photoUrl}
                alt={legend.name}
                className="w-full h-full object-cover ole-player-photo-bw shadow-[0_24px_48px_rgba(0,0,0,0.18)]"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full bg-black/90 grid place-items-center shadow-[0_24px_48px_rgba(0,0,0,0.22)]">
                <span
                  className="font-display font-black text-white/15 uppercase"
                  style={{ fontSize: 'clamp(96px, 18vw, 160px)', lineHeight: 1 }}
                  aria-hidden
                >
                  {legend.name.charAt(0)}
                </span>
              </div>
            )}
          </div>

          {/* 4. Frase */}
          <blockquote
            className="ole-headline-italic mt-8 sm:mt-10 text-black/85 text-center max-w-2xl mx-auto leading-snug"
            style={{ fontSize: 'clamp(17px, 2.4vw, 22px)' }}
          >
            “{legend.quote}”
          </blockquote>
          {legend.quoteAuthor ? (
            <p className="mt-3 text-black/60 text-[12px] uppercase tracking-[0.18em] font-medium text-center">
              — {legend.quoteAuthor}
            </p>
          ) : null}

          {/* 5. CTA Treinar com */}
          <div className="flex justify-center mt-8 sm:mt-10">
            <button
              type="button"
              className="inline-flex items-center gap-2 bg-black text-neon-yellow px-7 py-3 font-display font-bold uppercase tracking-[0.2em] text-[13px] hover:bg-deep-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
            >
              Treinar com {legend.name}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── TRAJETÓRIA — timeline horizontal ──────────────────────── */}
      <section className="relative bg-deep-black py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <header className="flex items-center gap-3 mb-6">
            <span className="w-1 h-7 bg-neon-yellow" aria-hidden />
            <h2 className="font-display font-black uppercase text-neon-yellow text-[18px] sm:text-[22px] tracking-[0.18em]">
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
                  className="shrink-0 snap-start w-[210px] sm:w-[230px] bg-[var(--color-card)] border border-[var(--border)] border-l-2 border-l-neon-yellow rounded-sm p-4 transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <p className="ole-headline text-neon-yellow text-[28px] sm:text-[32px] leading-none">
                    {ev.year}
                  </p>
                  <p className="mt-3 text-white/85 text-[12px] sm:text-[13px] leading-snug">
                    {ev.text}
                  </p>
                </article>
              ))}
            </div>
            {/* Track decorativa abaixo */}
            <div className="mt-3 h-[3px] bg-white/8 relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1/3 bg-neon-yellow/85" aria-hidden />
            </div>
          </div>
        </div>
      </section>

      {/* ── DNA DO CAMPEÃO — grid 3x2 ─────────────────────────────── */}
      <section className="relative bg-deep-black pb-16">
        {/* Diagonal accent (assinatura BVB) */}
        <div
          className="diagonal-accent"
          style={{
            top: '-40px',
            right: '-60px',
            width: '300px',
            height: '300px',
          }}
          aria-hidden
        />
        <div className="mx-auto max-w-6xl px-5 sm:px-8 relative">
          <header className="flex items-center gap-3 mb-6">
            <span className="w-1 h-7 bg-neon-yellow" aria-hidden />
            <h2 className="font-display font-black uppercase text-neon-yellow text-[18px] sm:text-[22px] tracking-[0.18em]">
              DNA do Campeão
            </h2>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {legend.dna.map((attr) => {
              const v = Math.max(0, Math.min(100, attr.value));
              return (
                <div
                  key={attr.label}
                  className="relative bg-[var(--color-card)] border border-[var(--border)] rounded-sm p-4 overflow-hidden"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display font-bold uppercase tracking-[0.15em] text-white/65 text-[11px]">
                      {attr.label}
                    </span>
                    <span
                      className="text-neon-yellow tabular-nums leading-none"
                      style={{
                        fontFamily: 'var(--font-serif-hero)',
                        fontStyle: 'italic',
                        fontSize: '32px',
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
    </div>
  );
}

export default Legend;
