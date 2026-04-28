import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

type Rarity = 'normal' | 'ouro' | 'epico' | 'lenda' | 'genesis';

const RARITY_LABEL: Record<Rarity, string> = {
  normal: 'Normal',
  ouro: 'Ouro',
  epico: 'Épico',
  lenda: 'Lenda',
  genesis: 'Genesis',
};

const RARITY_RING: Record<Rarity, string> = {
  normal: 'ring-white/15',
  ouro: 'ring-yellow-400/60',
  epico: 'ring-purple-400/55',
  lenda: 'ring-orange-400/55',
  genesis: 'ring-neon-yellow/70',
};

const RARITY_TAG_BG: Record<Rarity, string> = {
  normal: 'bg-white/8 text-white/80',
  ouro: 'bg-yellow-400/15 text-yellow-300',
  epico: 'bg-purple-400/15 text-purple-300',
  lenda: 'bg-orange-400/15 text-orange-300',
  genesis: 'bg-neon-yellow text-black',
};

/**
 * Retrato editorial de jogador — moldura escura + glow amarelo + tag de
 * raridade. Reaproveita o pattern do Transfer Market (que já está bem
 * desenhado) e padroniza para uso em Plantel, Manager, modais.
 *
 * Tamanhos:
 *  - sm: 88×120 (chips, listas densas)
 *  - md: 160×220 (cards padrão)
 *  - lg: 240×320 (hero card)
 *  - xl: 320×440 (página dedicada)
 *
 * Sem ícones pequenos: só foto + número OVR + nome + raridade. Texto-claro.
 */
export function PlayerPortrait({
  src,
  alt,
  name,
  position,
  overall,
  rarity = 'normal',
  size = 'md',
  glow = true,
  onClick,
  className,
  style,
}: {
  src?: string | null;
  alt?: string;
  name?: string;
  position?: string;
  overall?: number;
  rarity?: Rarity;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  glow?: boolean;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  const dims =
    size === 'sm'
      ? 'w-[88px] h-[120px]'
      : size === 'lg'
        ? 'w-[240px] h-[320px]'
        : size === 'xl'
          ? 'w-[320px] h-[440px]'
          : 'w-[160px] h-[220px]';

  const ovrSize =
    size === 'sm'
      ? 'text-[20px]'
      : size === 'lg'
        ? 'text-[44px]'
        : size === 'xl'
          ? 'text-[56px]'
          : 'text-[32px]';

  const nameSize =
    size === 'sm' ? 'text-[10px]' : size === 'lg' || size === 'xl' ? 'text-[14px]' : 'text-[12px]';

  const interactive = typeof onClick === 'function';

  return (
    <div
      onClick={onClick}
      style={style}
      className={cn(
        'relative isolate flex flex-col rounded-[var(--radius-card)] overflow-hidden bg-deep-black ring-1',
        RARITY_RING[rarity],
        dims,
        glow && 'shadow-[var(--shadow-glow-yellow)]',
        interactive && 'cursor-pointer transition-transform hover:scale-[1.02] hover:shadow-[var(--shadow-glow-yellow-strong)]',
        className,
      )}
    >
      {/* Foto */}
      {src ? (
        <img
          src={src}
          alt={alt ?? name ?? 'Jogador'}
          className="absolute inset-0 h-full w-full object-cover object-top opacity-95"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-black/40" aria-hidden />
      )}

      {/* Vinheta vertical (escurece base e topo pra leitura de OVR/nome) */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/85"
        aria-hidden
      />

      {/* OVR — topo esquerdo, MORET grande */}
      {typeof overall === 'number' ? (
        <div className="absolute left-3 top-3 flex flex-col items-start leading-none">
          <span
            className={cn(
              'font-[var(--font-serif-hero)] font-bold text-neon-yellow drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]',
              ovrSize,
            )}
            style={{ fontFamily: 'var(--font-serif-hero)' }}
          >
            {overall}
          </span>
          {position ? (
            <span className="mt-1 font-display text-[10px] uppercase tracking-[0.18em] text-white/85">
              {position}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Tag de raridade — topo direito */}
      <span
        className={cn(
          'absolute right-3 top-3 rounded-[var(--radius-pill)] px-2.5 py-1 font-display text-[9px] font-bold uppercase tracking-[0.18em]',
          RARITY_TAG_BG[rarity],
        )}
      >
        {RARITY_LABEL[rarity]}
      </span>

      {/* Nome — base */}
      {name ? (
        <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-6">
          <p
            className={cn(
              'truncate font-display font-bold uppercase tracking-[0.08em] text-white',
              nameSize,
            )}
          >
            {name}
          </p>
        </div>
      ) : null}
    </div>
  );
}
