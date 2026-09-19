import { useState } from 'react';
import { motion } from 'motion/react';
import { SecaoVolt } from '@/components/ui';

export type TrophyEntry = {
  id: string;
  /** Path opcional do render 3D em /public (ex: /trophy-global-2026.png). */
  imageSrc?: string;
  leagueName: string;
  /** Só quando a temporada real for conhecida — nunca derivar do ano atual. */
  season?: string;
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
        className="h-full w-full object-contain"
        loading="lazy"
        onError={() => setErrored(true)}
      />
    );
  }

  // Placeholder SVG estilo "troféu wireframe" enquanto o PNG 3D não chega.
  return (
    <svg viewBox="0 0 64 80" className="h-full w-full text-giz/70" aria-hidden>
      <path
        d="M16 8 L48 8 L48 22 Q48 38 32 42 Q16 38 16 22 Z"
        fill="currentColor"
        opacity="0.8"
      />
      <path d="M16 14 Q4 14 4 24 Q4 32 16 32" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M48 14 Q60 14 60 24 Q60 32 48 32" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="26" y="42" width="12" height="14" fill="currentColor" opacity="0.6" />
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
      <div className="flex items-center justify-between gap-3">
        <SecaoVolt label="Conquistas" tone="neutro" className="min-w-0 grow" />
        {trophies.length > 0 ? (
          <span className="shrink-0 font-mono text-[11px] text-cimento">
            {trophies.length} {trophies.length === 1 ? 'troféu' : 'troféus'}
          </span>
        ) : null}
      </div>

      {trophies.length === 0 ? (
        <div
          className="relative overflow-hidden border border-white/10 bg-panel p-6 text-center"
          style={{ borderRadius: 'var(--radius-card)' }}
        >
          <div className="mx-auto h-20 w-20 opacity-40">
            <TrophyArt leagueName="placeholder" />
          </div>
          <p className="mt-4 font-impact text-[16px] uppercase leading-[1.1] text-giz">
            Vitrine vazia
          </p>
          <p className="mt-1 text-[12px] text-cimento">{teaserMessage}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {trophies.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className="relative overflow-hidden border border-white/10 bg-panel p-5"
              style={{ borderRadius: 'var(--radius-card)' }}
            >
              <div className="mx-auto h-28 w-28">
                <TrophyArt imageSrc={t.imageSrc} leagueName={t.leagueName} />
              </div>
              <div className="mt-4 text-center">
                <p className="font-impact text-[15px] uppercase leading-[1.1] text-white">
                  {t.leagueName}
                </p>
                {t.season ? (
                  <p className="mt-1 font-mono text-[10.5px] text-cimento">
                    {t.season}
                  </p>
                ) : null}
                <div className="mt-3 inline-flex items-center bg-giz px-2.5 pb-0.5 pt-1">
                  <span className="font-impact text-[13px] uppercase tracking-[0.06em] text-black">
                    {t.position}
                  </span>
                </div>
                {t.note ? (
                  <p className="mt-2 font-mono text-[10.5px] text-cimento">{t.note}</p>
                ) : null}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
