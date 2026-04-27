/**
 * Balão de fala que aparece sobre o token do jogador quando ele recebe
 * comando de voz. Mostra a resposta de obediência em tempo real.
 *
 * Consome `live.voiceCommands[playerId]` — quando há comando ativo (não expirado),
 * renderiza a bolha com tier e texto. Fade-out automático após 2.5s.
 *
 * NOVO: Indicador persistente enquanto comando está ativo (contador regressivo).
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
import { isCommandActive } from '@/voiceCommand/commandQueue';

/** Variante que lê o comando direto do game state pelo playerId. */
export function PlayerVoiceBubble({ playerId }: { playerId: string }) {
  const cmd = useGameStore((s) => s.liveMatch?.voiceCommands?.[playerId]);
  return <PlayerResponseBubble command={cmd} />;
}

export function PlayerResponseBubble({ command }: { command?: PendingCommand }) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<PendingCommand | null>(null);
  const [now, setNow] = useState(Date.now());

  // Tick para atualizar contador regressivo
  useEffect(() => {
    const iv = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!command) return;
    // Detecta comando novo — só mostra quando issuedAt muda.
    if (current?.issuedAt === command.issuedAt) return;
    setCurrent(command);
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 2500);
    return () => window.clearTimeout(t);
  }, [command?.issuedAt, current?.issuedAt]);

  if (!current) return null;

  const tier: ObedienceTier = current.tier;
  const bubbleText = OBEDIENCE_TIER_BUBBLE[tier];
  const color =
    tier === 'critical_accept' ? 'border-emerald-400 bg-emerald-500 text-white' :
    tier === 'accept' ? 'border-yellow-400 bg-yellow-500 text-black' :
    tier === 'weak_accept' ? 'border-orange-400 bg-orange-500 text-black' :
    'border-rose-500 bg-rose-600 text-white';

  // Comando ativo (não expirado e aceito)
  const active = isCommandActive(command, now);
  const timeLeftSecs = active && command ? Math.ceil((command.expiresAt - now) / 1000) : 0;

  return (
    <>
      {/* Bolha inicial de resposta (fade-out após 2.5s) */}
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

      {/* Indicador persistente enquanto comando está ativo */}
      <AnimatePresence>
        {active && timeLeftSecs > 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute left-1/2 -top-12 -translate-x-1/2 z-20"
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              className="flex items-center gap-1 rounded-full border border-cyan-400/60 bg-cyan-500/90 px-2 py-0.5 shadow-lg"
            >
              <span className="text-[10px] font-black text-black">🎯</span>
              <span className="font-mono text-[9px] font-bold text-black">{timeLeftSecs}s</span>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
