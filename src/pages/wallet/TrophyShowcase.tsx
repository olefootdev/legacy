import { useState } from 'react';
import { motion } from 'motion/react';

export type TrophyEntry = {
  id: string;
  /** Path opcional do render 3D em /public (ex: /trophy-global-2026.png). */
  imageSrc?: string;
  leagueName: string;
  season: string;
  /** "Campeão", "Vice", "3º lugar", "Bonus", etc. */
  position: string;
  /** Texto secundário opcional (ex: "Bonus +500 OLE"). */
  note?: string;
};

type TrophyShowcaseProps = {
  trophies: TrophyEntry[];
  /** Mensagem de teaser exibida quando vazio. */
  teaserMessage?: string;
};

function TrophyArt({ imageSrc, leagueName }: { imageSrc?: string; leagueName: string }) {
  const [errored, setErrored] = useState(false);

  if (imageSrc && !errored) {
    return (
      <img
        src={imageSrc}
        alt={`Troféu ${leagueName}`}
        className="h-full w-full object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
        loading="lazy"
        onError={() => setErrored(true)}
      />
    );
  }

  // Placeholder SVG estilo "troféu wireframe" enquanto o PNG 3D não chega.
  return (
    <svg viewBox="0 0 64 80" className="h-full w-full text-neon-yellow/70" aria-hidden>
      <defs>
        <linearGradient id="trophy-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <path
        d="M16 8 L48 8 L48 22 Q48 38 32 42 Q16 38 16 22 Z"
        fill="url(#trophy-grad)"
      />
      <path d="M16 14 Q4 14 4 24 Q4 32 16 32" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M48 14 Q60 14 60 24 Q60 32 48 32" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="26" y="42" width="12" height="14" fill="url(#trophy-grad)" />
      <rect x="18" y="56" width="28" height="6" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="14" y="62" width="36" height="10" rx="2" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

export function TrophyShowcase({
  trophies,
  teaserMessage = 'O primeiro troféu te espera na Liga Global.',
}: TrophyShowcaseProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/80">
            Vitrine
          </p>
          <h2
            className="mt-1 font-display text-[22px] font-black uppercase leading-none tracking-tight text-white sm:text-[26px]"
            style={{ letterSpacing: '0.005em' }}
          >
            Conquistas
          </h2>
        </div>
        {trophies.length > 0 ? (
          <span className="text-[10px] font-display font-bold uppercase tracking-[0.2em] text-white/55">
            {trophies.length} {trophies.length === 1 ? 'troféu' : 'troféus'}
          </span>
        ) : null}
      </div>

      {trophies.length === 0 ? (
        <div
          className="relative overflow-hidden border border-neon-yellow/15 p-6 text-center"
          style={{
            borderRadius: 'var(--radius-card)',
            background:
              'radial-gradient(ellipse at top, rgba(255,235,80,0.04), transparent 60%), var(--color-panel-elevated,#0b0b0b)',
          }}
        >
          <div className="mx-auto h-20 w-20 opacity-40">
            <TrophyArt leagueName="placeholder" />
          </div>
          <p
            className="mt-4 font-display text-[14px] font-bold uppercase tracking-[0.15em] text-white/65"
            style={{ letterSpacing: '0.005em' }}
          >
            Vitrine vazia
          </p>
          <p className="mt-1 text-[12px] text-white/45">{teaserMessage}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {trophies.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className="relative overflow-hidden border border-neon-yellow/15 p-5"
              style={{
                borderRadius: 'var(--radius-card)',
                background:
                  'radial-gradient(ellipse at top, rgba(255,235,80,0.06), transparent 65%), var(--color-panel-elevated,#0b0b0b)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div className="mx-auto h-28 w-28">
                <TrophyArt imageSrc={t.imageSrc} leagueName={t.leagueName} />
              </div>
              <div className="mt-4 text-center">
                <p
                  className="font-display text-[13px] font-black uppercase leading-tight tracking-tight text-white"
                  style={{ letterSpacing: '0.005em' }}
                >
                  {t.leagueName}
                </p>
                <p className="mt-1 font-display text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">
                  {t.season}
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-neon-yellow/30 bg-neon-yellow/[0.08] px-3 py-1">
                  <span className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-neon-yellow">
                    {t.position}
                  </span>
                </div>
                {t.note ? (
                  <p className="mt-2 text-[10px] text-white/45">{t.note}</p>
                ) : null}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
