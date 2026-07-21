/**
 * HeroCinematic — dobra 1 da Home nova (layout MATCHDAY v3 APROVADO).
 *
 * Fiel ao design: é um CARD DE FOTO CONTIDO (não full-bleed espalhado) — a foto
 * preenche o card, escurece pra baixo, e o bloco de texto fica ANCORADO NA BASE
 * (eyebrow + nome empilhado em Anton + pontuação inline + CTA). Compacto.
 * Dados reais por props; presentational puro.
 */

import { Link } from 'react-router-dom';

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
  // Nome empilhado (poster): cada palavra numa linha, igual ao aprovado.
  const nameLines = managerName.trim().split(/\s+/).slice(0, 2);

  return (
    <section
      aria-label="Cockpit do manager"
      className="relative flex flex-col justify-end overflow-hidden"
      style={{
        borderRadius: 'var(--radius-md)',
        minHeight: 'min(78vw, 420px)',
        padding: '18px 16px',
      }}
    >
      {/* Fundo: fallback token-only + foto (escurecida) */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#241f06] via-[#14120a] to-deep-black" />
      {heroImgOk && (
        <img
          src={heroImage}
          alt=""
          aria-hidden
          draggable={false}
          onError={onHeroError}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: '70% 20%', opacity: 0.6 }}
        />
      )}
      {/* Glow neon + número fantasma + shade forte na base (texto legível) */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'radial-gradient(72% 55% at 74% 20%, rgba(253,225,0,0.18), transparent 60%)' }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute select-none font-impact leading-[0.7] text-white/[0.05]"
        style={{ top: '-2%', right: '2%', fontSize: 'min(42vw, 210px)' }}
      >
        10
      </span>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, transparent 30%, rgba(12,12,12,0.62) 64%, var(--color-deep-black) 100%)' }}
      />

      {/* Bloco de texto ancorado na base */}
      <div className="relative">
        <span
          className="inline-flex items-center gap-2 font-display font-black uppercase text-neon-yellow"
          style={{ fontSize: '10px', letterSpacing: '0.26em' }}
        >
          <span aria-hidden className="h-0.5 w-4 bg-neon-yellow" />
          Teu clube · {clubName}
        </span>

        <h1
          className="mt-2 font-impact uppercase text-white"
          style={{ fontSize: 'clamp(44px, 13vw, 92px)', lineHeight: 0.82, letterSpacing: '0.004em' }}
        >
          {nameLines.map((w, i) => (
            <span key={i} className="block">
              {w}
            </span>
          ))}
        </h1>

        {/* Pontuação inline: score + delta + rank, tudo na mesma linha de base */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className="font-impact leading-[0.8] tabular-nums text-neon-yellow"
            style={{ fontSize: 'clamp(40px, 11vw, 64px)' }}
          >
            {scoreTotal.toLocaleString('pt-BR')}
          </span>
          {scoreToday > 0 ? (
            <span
              className="inline-flex items-center font-display font-black uppercase tabular-nums"
              style={{
                fontSize: '10px',
                letterSpacing: '0.12em',
                padding: '3px 7px',
                borderRadius: '3px',
                color: 'var(--color-deep-black)',
                background: 'var(--color-neon-green)',
              }}
            >
              +{scoreToday.toLocaleString('pt-BR')} hoje
            </span>
          ) : (
            <span className="text-white/50" style={{ fontFamily: 'var(--font-sans)', fontSize: '12px' }}>
              Toda ação pontua.
            </span>
          )}
          {rank ? (
            <span
              className="uppercase tabular-nums text-white/45"
              style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', letterSpacing: '0.18em', fontWeight: 700 }}
            >
              #{rank} <span className="text-white">no mundo</span>
            </span>
          ) : null}
        </div>

        {/* CTA dominante — única ação amarela */}
        <Link
          to="/legends-cup"
          className="mt-3.5 flex items-center justify-between bg-neon-yellow px-4 text-black transition-all hover:bg-white active:scale-[0.99]"
          style={{ borderRadius: '10px', padding: '12px 15px', boxShadow: '0 10px 26px rgba(253,225,0,0.2)' }}
        >
          <span className="min-w-0">
            <span className="block font-impact uppercase leading-none" style={{ fontSize: '17px' }}>
              Desafie as lendas
            </span>
            <span
              className="mt-0.5 block truncate font-display font-black uppercase"
              style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(13,13,13,0.6)' }}
            >
              {cupSublabel}
            </span>
          </span>
          <span aria-hidden className="ml-3 flex-none font-impact" style={{ fontSize: '15px' }}>
            ▶
          </span>
        </Link>
      </div>
    </section>
  );
}
