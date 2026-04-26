/**
 * Efeitos Visuais de Skills — Fase 2 Core Gameplay #7
 * Mostra efeitos visuais quando skills ativam durante a partida.
 */
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Shield, Target, Wind } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SkillVisualType = 'SHOOT' | 'DEFEND' | 'PASS' | 'DRIBBLE' | 'HEADER' | 'FREEKICK';

interface SkillVisualEffectProps {
  playerId: string;
  skillType: SkillVisualType;
  playerName: string;
  duration?: number;
}

const SKILL_CONFIGS: Record<SkillVisualType, {
  icon: typeof Zap;
  color: string;
  label: string;
  glowColor: string;
}> = {
  SHOOT: {
    icon: Zap,
    color: 'text-yellow-400',
    label: 'FINALIZADOR!',
    glowColor: 'rgba(253,225,0,0.8)',
  },
  DEFEND: {
    icon: Shield,
    color: 'text-blue-400',
    label: 'MURALHA!',
    glowColor: 'rgba(96,165,250,0.8)',
  },
  PASS: {
    icon: Target,
    color: 'text-green-400',
    label: 'PASSE PERFEITO!',
    glowColor: 'rgba(74,222,128,0.8)',
  },
  DRIBBLE: {
    icon: Wind,
    color: 'text-orange-400',
    label: 'DRIBLADOR!',
    glowColor: 'rgba(251,146,60,0.8)',
  },
  HEADER: {
    icon: Zap,
    color: 'text-purple-400',
    label: 'CABECEADOR!',
    glowColor: 'rgba(192,132,252,0.8)',
  },
  FREEKICK: {
    icon: Target,
    color: 'text-cyan-400',
    label: 'ESPECIALISTA!',
    glowColor: 'rgba(34,211,238,0.8)',
  },
};

export function SkillVisualEffect({ playerId, skillType, playerName, duration = 2000 }: SkillVisualEffectProps) {
  const config = SKILL_CONFIGS[skillType];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      <motion.div
        key={`skill-${playerId}-${skillType}`}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="pointer-events-none absolute inset-0 z-[5]"
      >
        {/* Anel pulsante */}
        <motion.div
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: config.glowColor }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.8, 0.3, 0.8],
          }}
          transition={{
            duration: 1,
            repeat: Math.floor(duration / 1000),
            ease: 'easeInOut',
          }}
        />

        {/* Glow effect */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 20px ${config.glowColor}`,
          }}
          animate={{
            opacity: [0.6, 1, 0.6],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Ícone + Label */}
        <motion.div
          className="absolute -top-8 left-1/2 -translate-x-1/2"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -10, opacity: 0 }}
        >
          <div className="flex flex-col items-center gap-1">
            <div className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full',
              'bg-black/80 backdrop-blur-sm'
            )}>
              <Icon className={cn('h-4 w-4', config.color)} strokeWidth={2.5} />
            </div>
            <span className={cn(
              'whitespace-nowrap rounded-full bg-black/80 px-2 py-0.5',
              'text-[9px] font-bold uppercase tracking-wider backdrop-blur-sm',
              config.color
            )}>
              {config.label}
            </span>
          </div>
        </motion.div>

        {/* Rastro para DRIBBLE */}
        {skillType === 'DRIBBLE' && (
          <>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-full bg-orange-400/20"
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{
                  scale: 1.5,
                  opacity: 0,
                }}
                transition={{
                  duration: 0.8,
                  delay: i * 0.2,
                  repeat: Math.floor(duration / 1000),
                }}
              />
            ))}
          </>
        )}

        {/* Escudo para DEFEND */}
        {skillType === 'DEFEND' && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
          >
            <Shield
              className="h-8 w-8 text-blue-400/40"
              strokeWidth={1.5}
            />
          </motion.div>
        )}

        {/* Linha tracejada para PASS */}
        {skillType === 'PASS' && (
          <motion.div
            className="absolute left-full top-1/2 h-0.5 w-12 -translate-y-1/2 bg-green-400"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: [0, 1, 0] }}
            transition={{ duration: 0.6, repeat: Math.floor(duration / 1000) }}
            style={{
              transformOrigin: 'left',
            }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/** Hook para gerenciar skills visuais ativos */
import { useState, useEffect } from 'react';

interface ActiveSkillVisual {
  playerId: string;
  skillType: SkillVisualType;
  playerName: string;
  expiresAt: number;
}

export function useSkillVisuals() {
  const [activeSkills, setActiveSkills] = useState<ActiveSkillVisual[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveSkills(prev => prev.filter(s => s.expiresAt > now));
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const addSkillVisual = (playerId: string, skillType: SkillVisualType, playerName: string, duration = 2000) => {
    setActiveSkills(prev => [
      ...prev.filter(s => s.playerId !== playerId), // remove anterior do mesmo jogador
      {
        playerId,
        skillType,
        playerName,
        expiresAt: Date.now() + duration,
      },
    ]);
  };

  return { activeSkills, addSkillVisual };
}
