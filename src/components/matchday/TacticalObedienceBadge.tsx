/**
 * Barra visual da obediência tática coletiva do time (30-100).
 * Fica em destaque no HUD — atualiza em tempo real conforme comandos
 * são emitidos e aceitos.
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';

export function TacticalObedienceBadge() {
  const obed = useGameStore((s) => s.tacticalObedience ?? 30);
  const [flashUp, setFlashUp] = useState(false);
  const [lastObed, setLastObed] = useState(obed);

  // Flash quando sobe de faixa de 10 (30→40, 40→50, ...).
  useEffect(() => {
    const prevFloor = Math.floor(lastObed / 10);
    const curFloor = Math.floor(obed / 10);
    if (curFloor > prevFloor) {
      setFlashUp(true);
      const t = window.setTimeout(() => setFlashUp(false), 900);
      setLastObed(obed);
      return () => window.clearTimeout(t);
    }
    setLastObed(obed);
  }, [obed, lastObed]);

  // Cor pelo nível
  const color =
    obed >= 85 ? 'from-emerald-500 to-green-400' :
    obed >= 65 ? 'from-sky-500 to-cyan-400' :
    obed >= 45 ? 'from-amber-500 to-yellow-400' :
    'from-rose-500 to-rose-400';

  return (
    <motion.div
      animate={flashUp ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={{ duration: 0.6 }}
      className={cn(
        'rounded-xl border px-3 py-2 transition-colors',
        flashUp
          ? 'border-emerald-400 bg-emerald-500/15 shadow-[0_0_16px_rgba(16,185,129,0.4)]'
          : 'border-white/10 bg-black/30',
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Megaphone className="h-3 w-3 text-violet-300" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">
            Obediência Tática
          </span>
        </div>
        <span className="font-mono text-[11px] font-black tabular-nums text-white">
          {Math.round(obed)}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          animate={{ width: `${obed}%` }}
          transition={{ duration: 0.4 }}
          className={cn('h-full bg-gradient-to-r', color)}
        />
      </div>
      {flashUp ? (
        <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-300">
          ✨ Time mais obediente
        </p>
      ) : null}
    </motion.div>
  );
}
