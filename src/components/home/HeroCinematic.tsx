/**
 * HeroCinematic — dobra 1 da Home nova (layout MATCHDAY v3 aprovado).
 *
 * Trailer do manager: foto grande de fundo (hero-legacy-full.png com fallback
 * gradiente), eyebrow "Teu clube · {club}", nome em bloco Anton, pontuação
 * neon com delta de hoje, posição real no mundo e o CTA único DESAFIE AS
 * LENDAS (→ /legends-cup). Todos os dados vêm por props (Home computa do estado
 * real). Presentational puro — nada de fetch aqui.
 */

import { Link } from 'react-router-dom';

const MORET = 'var(--font-serif-hero)';

export function HeroCinematic({
  clubName,
  managerName,
  scoreTotal,
  scoreToday,
  rank,
  heroImage,
  heroImgOk,
  onHeroError,
  cupSublabel,
}: {
  clubName: string;
  managerName: string;
  scoreTotal: number;
  scoreToday: number;
  rank: number | null;
  heroImage: string;
  heroImgOk: boolean;
  onHeroError: () => void;
  cupSublabel: string;
}) {
  return (
    <section
      aria-label="Cockpit do manager"
      className="relative overflow-hidden border border-[var(--color-border)]"
      style={{ borderRadius: 'var(--radius-md)' }}
    >
      {/* Fundo: fallback token-only + imagem + glow + shade de contraste */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-dark-gray to-deep-black" />
      {heroImgOk && (
        <img
          src={heroImage}
          alt=""
          aria-hidden
          draggable={false}
          onError={onHeroError}
          className="absolute inset-0 h-full w-full object-cover object-top opacity-70"
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'radial-gradient(78% 58% at 72% 18%, rgba(253,225,0,0.16), transparent 60%)' }}
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-deep-black via-deep-black/70 to-transparent" />
      {/* Número fantasma cinematográfico */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-6 right-1 select-none font-impact leading-[0.7] text-white/[0.05]"
        style={{ fontSize: 'clamp(120px, 34vw, 240px)' }}
      >
        10
      </span>

      <div className="relative flex flex-col items-start gap-1 px-5 py-8 sm:px-8 sm:py-11">
        {/* Eyebrow */}
        <span aria-hidden className="mb-1.5 block h-px w-8 bg-neon-yellow/60" />
        <span
          className="font-display font-black uppercase text-neon-yellow"
          style={{ fontSize: '10px', letterSpacing: '0.32em' }}
        >
          Teu clube · {clubName}
        </span>

        {/* Saudação + nome em bloco */}
        <p
          className="mt-3 font-display font-bold uppercase text-white/65"
          style={{ fontSize: '12px', letterSpacing: '0.24em' }}
        >
          Olá, manager
        </p>
        <h1
          className="font-impact uppercase text-white"
          style={{ fontSize: 'clamp(40px, 9vw, 76px)', lineHeight: 0.86, letterSpacing: '-0.01em' }}
        >
          {managerName}
        </h1>

        {/* Pontuação do manager + delta de hoje */}
        <div className="mt-3 flex items-end gap-3 flex-wrap">
          <p
            className="font-impact leading-none tabular-nums text-neon-yellow"
            style={{ fontSize: 'clamp(46px, 9vw, 68px)' }}
          >
            {scoreTotal.toLocaleString('pt-BR')}
          </p>
          {scoreToday > 0 ? (
            <span
              className="mb-2 inline-flex items-center px-2 py-0.5 font-display font-black uppercase tabular-nums"
              style={{
                fontSize: '10px',
                letterSpacing: '0.2em',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-success)',
                background: 'rgba(0,200,81,0.12)',
                border: '1px solid rgba(0,200,81,0.35)',
              }}
            >
              +{scoreToday.toLocaleString('pt-BR')} hoje
            </span>
          ) : (
            <span className="mb-2 text-white/55" style={{ fontFamily: 'var(--font-sans)', fontSize: '12px' }}>
              Toda ação pontua.
            </span>
          )}
        </div>
        {rank ? (
          <p
            className="uppercase tabular-nums text-white/65"
            style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.22em', fontWeight: 600 }}
          >
            #{rank} <span className="text-white">no mundo</span>
          </p>
        ) : null}

        {/* CTA dominante — única ação amarela da surface */}
        <Link
          to="/legends-cup"
          className="mt-5 flex w-full max-w-sm items-center justify-between bg-neon-yellow px-5 py-3.5 text-black transition-all hover:bg-white active:scale-[0.98]"
          style={{ borderRadius: 'var(--radius-md)', boxShadow: '0 10px 28px rgba(253,225,0,0.2)' }}
        >
          <span>
            <span className="block font-impact uppercase" style={{ fontSize: '17px', letterSpacing: '0.01em' }}>
              Desafie as lendas
            </span>
            <span
              className="block font-display font-black uppercase"
              style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(13,13,13,0.62)' }}
            >
              {cupSublabel}
            </span>
          </span>
          <span aria-hidden className="font-impact" style={{ fontSize: '18px', fontFamily: MORET }}>
            ▶
          </span>
        </Link>
      </div>
    </section>
  );
}
