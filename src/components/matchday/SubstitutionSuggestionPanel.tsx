/**
 * Painel de Sugestões de Substituição — Fase 3 Polish #4
 * Mostra sugestões inteligentes com impacto visual.
 */
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, TrendingUp, TrendingDown, AlertCircle, Zap, Shield, Battery } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SubstitutionSuggestion } from '@/match/smartSubstitutions';

interface SubstitutionSuggestionPanelProps {
  suggestions: SubstitutionSuggestion[];
  onAccept: (suggestion: SubstitutionSuggestion) => void;
  onDismiss: (suggestionId: string) => void;
  className?: string;
}

const REASON_CONFIGS = {
  fatigue: {
    icon: Battery,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  tactical: {
    icon: Zap,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  injury: {
    icon: AlertCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  momentum: {
    icon: TrendingUp,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
};

function ImpactIndicator({ value, label }: { value: number; label: string }) {
  if (value === 0) return null;

  const isPositive = value > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="flex items-center gap-1">
      <Icon className={cn('h-3 w-3', isPositive ? 'text-green-400' : 'text-red-400')} />
      <span className="text-xs text-gray-400">{label}</span>
      <span className={cn('text-xs font-bold', isPositive ? 'text-green-400' : 'text-red-400')}>
        {isPositive ? '+' : ''}{value}
      </span>
    </div>
  );
}

export function SubstitutionSuggestionPanel({
  suggestions,
  onAccept,
  onDismiss,
  className,
}: SubstitutionSuggestionPanelProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <AnimatePresence mode="popLayout">
        {suggestions.map((suggestion, i) => {
          const config = REASON_CONFIGS[suggestion.reason];
          const Icon = config.icon;

          return (
            <motion.div
              key={suggestion.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                'relative overflow-hidden rounded-lg border backdrop-blur-sm',
                config.bgColor,
                config.borderColor,
                suggestion.urgency === 'high' && 'animate-pulse',
              )}
            >
              {/* Urgência badge */}
              {suggestion.urgency === 'high' && (
                <div className="absolute right-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                  Urgente
                </div>
              )}

              <div className="p-3">
                {/* Header */}
                <div className="mb-2 flex items-center gap-2">
                  <Icon className={cn('h-4 w-4', config.color)} />
                  <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
                    {suggestion.reason === 'fatigue' && 'Fadiga'}
                    {suggestion.reason === 'tactical' && 'Tático'}
                    {suggestion.reason === 'injury' && 'Lesão'}
                    {suggestion.reason === 'momentum' && 'Momentum'}
                  </span>
                  <span className="ml-auto text-xs text-gray-500">{suggestion.minute}'</span>
                </div>

                {/* Narrativa */}
                <p className="mb-3 text-sm text-white">{suggestion.narrative}</p>

                {/* Substituição */}
                <div className="mb-3 flex items-center justify-between rounded-md bg-black/30 p-2">
                  <div className="flex-1">
                    <div className="text-xs text-gray-400">Sai</div>
                    <div className="font-bold text-white">{suggestion.playerOut.name}</div>
                    <div className="text-xs text-gray-500">#{suggestion.playerOut.num}</div>
                  </div>

                  <ArrowRight className="mx-2 h-5 w-5 text-yellow-400" />

                  <div className="flex-1 text-right">
                    <div className="text-xs text-gray-400">Entra</div>
                    <div className="font-bold text-white">{suggestion.playerIn.name}</div>
                    <div className="text-xs text-gray-500">#{suggestion.playerIn.num}</div>
                  </div>
                </div>

                {/* Impacto */}
                <div className="mb-3 flex flex-wrap gap-3">
                  <ImpactIndicator value={suggestion.impact.attack} label="Ataque" />
                  <ImpactIndicator value={suggestion.impact.defense} label="Defesa" />
                  <ImpactIndicator value={suggestion.impact.energy} label="Energia" />
                </div>

                {/* Ações */}
                <div className="flex gap-2">
                  <button
                    onClick={() => onAccept(suggestion)}
                    className="flex-1 rounded-md bg-yellow-400 px-3 py-2 text-sm font-bold uppercase tracking-wide text-black transition-all hover:bg-yellow-300 hover:shadow-lg"
                  >
                    Substituir
                  </button>
                  <button
                    onClick={() => onDismiss(suggestion.id)}
                    className="rounded-md border border-white/20 px-3 py-2 text-sm font-medium text-gray-400 transition-all hover:bg-white/5"
                  >
                    Ignorar
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
