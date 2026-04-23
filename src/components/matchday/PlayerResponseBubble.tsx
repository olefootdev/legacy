/**
 * Balão de fala que aparece sobre o token do jogador quando ele recebe
 * comando de voz. Mostra a resposta de obediência em tempo real.
 *
 * Consome `live.voiceCommands[playerId]` — quando há comando ativo (não expirado),
 * renderiza a bolha com tier e texto. Fade-out automático após 2.5s.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import {
  OBEDIENCE_TIER_BUBBLE,
  type ObedienceTier,
  type PendingCommand,
} from '@/voiceCommand/types';

/** Variante que lê o comando direto do game state pelo playerId. */
export function PlayerVoiceBubble({ playerId }: { playerId: string }) {
  const cmd = useGameStore((s) => s.liveMatch?.voiceCommands?.[playerId]);
  return <PlayerResponseBubble command={cmd} />;
}

export function PlayerResponseBubble({ command }: { command?: PendingCommand }) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<PendingCommand | null>(null);

  useEffect(() => {
    if (!command) return;
    // Detecta comando novo — só mostra quando issuedAt muda.
    if (current?.issuedAt === command.issuedAt) return;
    setCurrent(command);
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 2500);
    return () => window.clearTimeout(t);
  }, [command?.issuedAt]);

  if (!current) return null;

  const tier: ObedienceTier = current.tier;
  const bubbleText = OBEDIENCE_TIER_BUBBLE[tier];
  const color =
    tier === 'critical_accept' ? 'border-emerald-400 bg-emerald-500 text-white' :
    tier === 'accept' ? 'border-yellow-400 bg-yellow-500 text-black' :
    tier === 'weak_accept' ? 'border-orange-400 bg-orange-500 text-black' :
    'border-rose-500 bg-rose-600 text-white';

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 420, damping: 24 }}
          className={cn(
            'pointer-events-none absolute left-1/2 -top-8 -translate-x-1/2 whitespace-nowrap rounded-full border-2 px-2 py-0.5 font-display text-[9px] font-black uppercase tracking-wider shadow-lg z-20',
            color,
            tier === 'protest' ? 'animate-pulse' : '',
          )}
        >
          {bubbleText}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
