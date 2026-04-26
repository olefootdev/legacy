import { cn } from '@/lib/utils';

interface HeadlineDuoProps {
  line1: string;
  line2: string;
  className?: string;
  /** Tamanho. `hero` = clamp grande (Hero principal); `section` = mais contido. */
  size?: 'hero' | 'section';
}

/**
 * Padrão de headline aprovado:
 *   Linha 1 — Agency FB bold uppercase (impacto)
 *   Linha 2 — Moret italic em amarelo neon (personalidade)
 *
 * Brief: branco/amarelo, sem hardcode de cor, clamp responsivo.
 */
export function HeadlineDuo({ line1, line2, className, size = 'hero' }: HeadlineDuoProps) {
  const isHero = size === 'hero';
  return (
    <h1 className={cn('flex flex-col leading-[0.95]', className)}>
      <span
        className="font-bold uppercase text-white"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: isHero ? 'clamp(3rem, 7vw, 6rem)' : 'clamp(2rem, 4.5vw, 3.5rem)',
          letterSpacing: '0.01em',
        }}
      >
        {line1}
      </span>
      <span
        className="italic text-[var(--color-neon-yellow)]"
        style={{
          fontFamily: 'var(--font-serif-hero)',
          fontSize: isHero ? 'clamp(2.5rem, 6vw, 5rem)' : 'clamp(1.75rem, 4vw, 3rem)',
          marginTop: '0.05em',
        }}
      >
        {line2}
      </span>
    </h1>
  );
}
