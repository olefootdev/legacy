/**
 * CinematicHero — banner editorial full-bleed (preto + dourado) com texto
 * sobreposto, compartilhado pelas competições (Liga Ole, Legends Cup, Liga
 * Global). Um só componente garante o MESMO toque cinematográfico e o mesmo
 * respeito às lendas em toda a área competitiva.
 *
 * O scrim de baixo garante legibilidade; o texto claro/dourado fica ancorado no
 * rodapé esquerdo pra não cobrir o craque no centro da imagem. `children` abre
 * espaço pra um CTA ou selo extra logo abaixo da chamada.
 */
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

const MORET = 'var(--font-serif-hero)';

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
      style={{ borderRadius: 'var(--radius-md)', aspectRatio, boxShadow: '0 10px 30px rgba(0,0,0,0.45)' }}
    >
      <img
        src={image}
        alt=""
        aria-hidden
        loading="eager"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition }}
      />
      {/* Scrim inferior — legibilidade do texto sem apagar o craque */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.5) 36%, rgba(0,0,0,0) 64%)' }}
      />

      {badgeLabel && (
        <div
          className="absolute left-3 top-3 inline-flex items-center gap-1.5 px-2.5 py-1"
          style={{ borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(253,225,0,0.45)' }}
        >
          {BadgeIcon && <BadgeIcon className="h-3.5 w-3.5 text-neon-yellow" strokeWidth={2.5} aria-hidden />}
          <span
            className="font-display uppercase text-neon-yellow"
            style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.16em' }}
          >
            {badgeLabel}
          </span>
        </div>
      )}

      <div className="absolute inset-x-4 bottom-4 z-10">
        <p
          className="font-display uppercase mb-1.5"
          style={{ color: 'var(--color-neon-yellow)', fontSize: '10px', fontWeight: 800, letterSpacing: '0.28em' }}
        >
          {eyebrow}
        </p>
        <p
          style={{
            color: '#f5ead0',
            fontFamily: MORET,
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: 'clamp(38px, 11vw, 56px)',
            lineHeight: 0.92,
            letterSpacing: '-0.03em',
          }}
        >
          {title}
        </p>
        {caption && (
          <>
            <span aria-hidden className="block h-[3px] w-11 bg-neon-yellow mt-2.5 mb-2" />
            <p
              className="font-display uppercase"
              style={{ color: 'rgba(245,234,208,0.8)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.18em' }}
            >
              {caption}
            </p>
          </>
        )}
        {children}
      </div>
    </motion.div>
  );
}

export default CinematicHero;
