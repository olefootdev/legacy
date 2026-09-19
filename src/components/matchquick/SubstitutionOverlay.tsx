/**
 * SubstitutionOverlay — Sprint D Fase 1.
 * Overlay editorial Legacy Tech: SAI ↔ ENTRA com foto do jogador, sem emojis.
 *
 * - Foto do jogador (picsum seed por playerId) com OVR-style overlay opcional
 * - Tipografia VOLT2: ole-num nos números, Anton no título, uppercase nos labels
 * - Rail amarelo de assinatura, tokens de cor (--color-danger / --color-success)
 * - Clicável (toque em qualquer área) — mobile-first, sem dependência de teclado
 * - Auto-dismiss em 3s com timer estável (callback via ref)
 */
import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

interface SubstitutionPlayerInfo {
  playerId?: string;
  name: string;
  number: number;
  position: string;
}

interface SubstitutionOverlayProps {
  playerOut: SubstitutionPlayerInfo;
  playerIn: SubstitutionPlayerInfo;
  reason?: 'injury' | 'tactical' | 'red_card';
  onDismiss?: () => void;
}

function reasonConfig(reason?: 'injury' | 'tactical' | 'red_card') {
  if (reason === 'injury') {
    return { label: 'Substituição por Lesão', accent: 'var(--color-danger)' };
  }
  if (reason === 'red_card') {
    return { label: 'Substituição por Expulsão', accent: 'var(--color-danger)' };
  }
  return { label: 'Substituição Tática', accent: 'var(--color-neon-yellow)' };
}

function PlayerHalf({
  player,
  kind,
}: {
  player: SubstitutionPlayerInfo;
  kind: 'out' | 'in';
}) {
  const isOut = kind === 'out';
  const seed = player.playerId ?? `${player.number}-${player.name}`;
  const photoUrl = `https://picsum.photos/seed/sub-${seed}/240/300`;
  const accent = isOut ? 'var(--color-danger)' : 'var(--color-success)';
  const label = isOut ? 'Sai' : 'Entra';

  return (
    <motion.div
      initial={{ x: isOut ? -30 : 30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.18, duration: 0.32 }}
      className="flex w-[150px] sm:w-[180px] flex-col overflow-hidden border border-l-[3px] border-[var(--color-border)] bg-dark-gray"
      style={{
        borderLeftColor: accent,
        borderRadius: 'var(--radius-md)',
      }}
    >
      {/* Foto + número overlay */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-black">
        <img
          src={photoUrl}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover object-top ${isOut ? 'grayscale' : ''}`}
          referrerPolicy="no-referrer"
          aria-hidden
        />
        {/* Scrim da foto: legibilidade do número e da posição. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/20 to-black/85"
        />
        {/* Número grande */}
        <div className="absolute top-2 left-2 z-10 bg-black/75 px-1.5 py-1">
          <p
            className="ole-num leading-none"
            style={{
              fontSize: 'clamp(26px, 4vw, 36px)',
              color: accent,
            }}
          >
            {player.number}
          </p>
        </div>
        {/* Tag SAI/ENTRA */}
        <div className="absolute top-2 right-2 z-10">
          <span
            className="inline-flex items-center px-2 py-0.5 font-display font-black uppercase"
            style={{
              fontSize: '10px',
              letterSpacing: '0.22em',
              backgroundColor: accent,
              color: 'var(--color-deep-black)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {label}
          </span>
        </div>
        {/* POS chip rodapé */}
        <div className="absolute bottom-2 left-2 z-10">
          <span
            className="inline-flex items-center bg-black/70 px-1.5 py-0.5 font-display font-bold uppercase text-white/90"
            style={{
              fontSize: '9px',
              letterSpacing: '0.22em',
            }}
          >
            {player.position}
          </span>
        </div>
      </div>
      {/* Nome */}
      <div className="px-3 py-2.5">
        <p
          className="truncate text-white uppercase"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '13px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            lineHeight: 1.1,
          }}
        >
          {player.name}
        </p>
      </div>
    </motion.div>
  );
}

export function SubstitutionOverlay({
  playerOut,
  playerIn,
  reason,
  onDismiss,
}: SubstitutionOverlayProps) {
  const cfg = reasonConfig(reason);

  // Estabiliza onDismiss pra timer não resetar a cada render do pai.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const handleDismiss = () => {
    onDismissRef.current?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={handleDismiss}
      role="button"
      tabIndex={0}
      aria-label="Fechar overlay de substituição"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-deep-black cursor-pointer"
    >
      {/* Hint discreto no topo */}
      <p
        className="absolute top-6 left-1/2 -translate-x-1/2 text-white/40 uppercase pointer-events-none"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '10px',
          letterSpacing: '0.28em',
          fontWeight: 700,
        }}
      >
        Toque pra continuar
      </p>

      {/* Conteúdo (não fecha ao clicar dentro) */}
      <motion.div
        initial={{ scale: 0.94, y: 18 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 18 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col items-center gap-5 px-4"
      >
        {/* Eyebrow + Título editorial duo */}
        <div className="flex flex-col items-center gap-2">
          <span aria-hidden className="block w-10 h-[3px]" style={{ backgroundColor: cfg.accent }} />
          <h2
            className="font-impact uppercase text-center leading-[1.1]"
            style={{
              fontSize: 'clamp(24px, 5vw, 34px)',
              color: cfg.accent,
            }}
          >
            {cfg.label}
          </h2>
        </div>

        {/* Cards SAI ↔ ENTRA */}
        <div className="flex items-stretch gap-3 sm:gap-5">
          <PlayerHalf player={playerOut} kind="out" />

          {/* Divisor ↔ */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.32, type: 'spring', stiffness: 240 }}
            className="flex flex-col items-center justify-center"
          >
            <span
              className="font-bold text-neon-yellow leading-none"
              style={{ fontSize: 'clamp(28px, 5vw, 38px)' }}
              aria-hidden
            >
              ↔
            </span>
          </motion.div>

          <PlayerHalf player={playerIn} kind="in" />
        </div>

        {/* Barra de progresso 3s */}
        <div className="h-[2px] w-24 overflow-hidden bg-white/10">
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 3, ease: 'linear' }}
            className="h-full bg-neon-yellow"
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
