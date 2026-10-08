import { useState } from 'react';
import { motion } from 'motion/react';
import { SecaoVolt } from '@/components/ui';
import { L } from '@/i18n/L';

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
        alt={L(`Troféu ${leagueName}`, `${leagueName} trophy`)}
        className="h-full w-full object-contain"
        loading="lazy"
        onError={() => setErrored(true)}
      />
    );
  }

  // Placeholder SVG estilo "troféu wireframe" enquanto o PNG 3D não chega.
  return (
    <svg viewBox="0 0 64 80" className="h-full w-full" aria-hidden>
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
  teaserMessage = L('O primeiro troféu te espera na Liga Global.', 'Your first trophy awaits in the Global League.'),
}: TrophyShowcaseProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <SecaoVolt label={L('Conquistas', 'Achievements')} tone="neutro" className="min-w-0 grow" />
        {trophies.length > 0 ? (
          <span className="shrink-0 font-prova text-[12px] font-bold text-ouro-27">
            {trophies.length} {trophies.length === 1 ? L('troféu', 'trophy') : L('troféus', 'trophies')}
          </span>
        ) : null}
      </div>

      {trophies.length === 0 ? (
        // DS 2027 · degrau CHÃO: contorno tracejado, promessa do que vem.
        <div className="flex items-center gap-5 border-2 border-dashed border-fio p-5">
          <div className="h-16 w-14 shrink-0 text-fio">
            <TrophyArt leagueName="placeholder" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-voz text-[28px] leading-none text-papel">{L('Vitrine vazia.', 'Empty cabinet.')}</p>
            <p className="font-prova text-[12px] text-mudo">{teaserMessage}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {trophies.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              // DS 2027 · degrau LENDA: troféu é ouro chapado, colado torto.
              className="relative overflow-hidden bg-ouro-27 p-5 text-asfalto-27 shadow-[6px_6px_0_rgba(0,0,0,0.6)]"
              style={{ transform: `rotate(${i % 2 === 0 ? -1.5 : 1.5}deg)` }}
            >
              <div className="mx-auto h-28 w-28">
                <TrophyArt imageSrc={t.imageSrc} leagueName={t.leagueName} />
              </div>
              <div className="mt-4 text-center">
                <p className="font-impact text-[22px] uppercase leading-none">
                  {t.leagueName}
                </p>
                {t.season ? (
                  <p className="mt-1 font-prova text-[11px] font-bold">
                    {t.season}
                  </p>
                ) : null}
                <div className="mt-3 inline-flex items-center bg-asfalto-27 px-2.5 pb-0.5 pt-1">
                  <span className="font-impact text-[14px] uppercase tracking-[0.04em] text-ouro-27">
                    {t.position}
                  </span>
                </div>
                {t.note ? (
                  <p className="mt-2 font-prova text-[11px]">{t.note}</p>
                ) : null}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
