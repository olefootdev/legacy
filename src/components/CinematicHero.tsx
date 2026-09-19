/**
 * CinematicHero — banner editorial full-bleed (asfalto + volt) com texto
 * sobreposto, compartilhado pelas competições (Liga Ole, Legends Cup, Liga
 * Global). Um só componente garante o MESMO toque cinematográfico e o mesmo
 * respeito às lendas em toda a área competitiva.
 *
 * O scrim de baixo garante legibilidade (único degradê permitido pelo VOLT2);
 * sem sombra, sem serifa. O texto giz/volt fica ancorado no
 * rodapé esquerdo pra não cobrir o craque no centro da imagem. `children` abre
 * espaço pra um CTA ou selo extra logo abaixo da chamada.
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
      className="relative overflow-hidden"
      style={{ aspectRatio }}
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
      {/* Scrim inferior — legibilidade do texto sem apagar o craque */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.5) 36%, rgba(0,0,0,0) 64%)' }}
      />

      {badgeLabel && (
        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 bg-neon-yellow px-2.5 py-1 text-black">
          {BadgeIcon && <BadgeIcon className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />}
          <span className="font-impact text-[13px] uppercase leading-none tracking-[0.06em]">
            {badgeLabel}
          </span>
        </div>
      )}

      <div className="absolute inset-x-4 bottom-4 z-10">
        <p className="ole-eyebrow-poster mb-2">{eyebrow}</p>
        <p
          className="font-impact uppercase text-white [overflow-wrap:anywhere]"
          style={{ fontSize: 'clamp(38px, 11vw, 56px)', lineHeight: 1.02, letterSpacing: '-0.01em' }}
        >
          {title}
        </p>
        {caption && (
          <p className="mt-2 font-mono text-[11.5px] font-medium uppercase tracking-[0.14em] text-giz">
            {caption}
          </p>
        )}
        {children}
      </div>
    </motion.div>
  );
}

export default CinematicHero;
