/**
 * CinematicHero — cartaz de abertura das competições (Liga Ole, Legends Cup,
 * Liga Global), no DS 2027 "Respeito é ouro".
 *
 * A foto vira lambe: asfalto por baixo, escurecida de baixo pra cima só pra
 * leitura (único degradê permitido — preto → transparente, nunca cor), retícula
 * de cartaz no canto, selo de rua colado torto e o título no GRITO (Anton)
 * ancorado no rodapé esquerdo pra não cobrir o craque. A API não mudou:
 * `children` abre espaço pra um CTA ou selo extra logo abaixo da chamada.
 */
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

export function CinematicHero({
  eyebrow,
  title,
  caption,
  image,
  badgeLabel,
  BadgeIcon,
  objectPosition = 'center',
  aspectRatio = '3 / 2',
  children,
}: {
  eyebrow: string;
  title: string;
  caption?: string;
  image: string;
  badgeLabel?: string;
  BadgeIcon?: LucideIcon;
  objectPosition?: string;
  aspectRatio?: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative min-w-0 overflow-hidden bg-asfalto-27"
      style={{ aspectRatio, minHeight: 280 }}
    >
      <img
        src={image}
        alt=""
        aria-hidden
        loading="eager"
        className="absolute inset-0 object-cover"
        // Inline de propósito: mobile-responsive.css tem `img { height: auto }`
        // fora de camada, que vence o h-full do Tailwind.
        style={{ width: '100%', height: '100%', maxWidth: 'none', objectPosition }}
      />
      {/* Escurece a foto pra leitura — preto → transparente, sem cor. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(13,13,12,0.96) 0%, rgba(13,13,12,0.62) 38%, rgba(13,13,12,0) 70%)' }}
      />
      {/* Retícula de cartaz no canto de cima — textura, não acabamento. */}
      <span
        aria-hidden
        className="rua-reticula absolute -right-4 -top-4 h-40 w-52 [--reticula:rgba(13,13,12,0.5)]"
        style={{
          WebkitMaskImage: 'radial-gradient(circle at 100% 0%, #000 0%, transparent 70%)',
          maskImage: 'radial-gradient(circle at 100% 0%, #000 0%, transparent 70%)',
        }}
      />

      {badgeLabel && (
        <div className="absolute left-3 top-4 inline-flex -rotate-2 items-center gap-1.5 bg-rua px-3 py-1.5 text-asfalto-27 shadow-[3px_3px_0_var(--color-asfalto-27)]">
          {BadgeIcon && <BadgeIcon className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
          <span className="font-impact text-[16px] uppercase leading-none">{badgeLabel}</span>
        </div>
      )}

      <div className="absolute inset-x-4 bottom-4 z-10 sm:inset-x-6 sm:bottom-6">
        <p className="mb-2 font-prova text-[11.5px] font-bold uppercase tracking-[0.2em] text-rua">{eyebrow}</p>
        <p
          className="font-impact uppercase text-papel [overflow-wrap:anywhere]"
          style={{ fontSize: 'clamp(44px, 13vw, 84px)', lineHeight: 0.86 }}
        >
          {title}
        </p>
        {caption && (
          <p className="mt-3 font-prova text-[11.5px] font-bold uppercase tracking-[0.16em] text-suave">{caption}</p>
        )}
        {children}
      </div>
    </motion.div>
  );
}

export default CinematicHero;
