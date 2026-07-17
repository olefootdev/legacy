/**
 * Assistente interativo do Olefoot — design BVB com tutorial passo a passo.
 * Componente flutuante que guia o usuário através das funcionalidades do jogo.
 * Agora com funcionalidade de arrastar para reposicionar.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'motion/react';
import {
  HelpCircle,
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Trophy,
  Users,
  Zap,
  Target,
  Wallet,
  ShoppingBag,
  PlayCircle,
  CheckCircle2,
  Move,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
  category: 'inicio' | 'partida' | 'time' | 'mercado' | 'economia';
  tips?: string[];
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao Olefoot',
    description: 'O simulador de futebol mais inteligente do Brasil. Aqui você monta seu time, disputa partidas e constrói uma carreira de manager.',
    icon: Sparkles,
    category: 'inicio',
    tips: [
      'Cada decisão importa — não é sorte, é estratégia',
      'Seus jogadores têm DNA único com IA embarcada',
      'Ganhe EXP, evolua seu time e conquiste títulos',
    ],
  },
  {
    id: 'first-match',
    title: 'Sua primeira partida',
    description: 'Escolha entre Partida Rápida (resultado instantâneo) ou Partida ao Vivo (simulação 2D completa com controle tático).',
    icon: PlayCircle,
    category: 'partida',
    tips: [
      'Partida Rápida: ideal para ganhar EXP rapidamente',
      'Partida ao Vivo: controle tático em tempo real',
      'Cada vitória rende EXP e melhora sua reputação',
    ],
    action: {
      label: 'Disputar partida',
      href: '/match',
    },
  },
  {
    id: 'build-squad',
    title: 'Monte seu elenco',
    description: 'Escale seus 11 titulares na formação ideal. Cada posição tem peso diferente nos atributos — escolha com inteligência.',
    icon: Users,
    category: 'time',
    tips: [
      'Formações: 4-3-3, 4-4-2, 4-2-3-1 e mais',
      'Atributos posicionais: cada slot valoriza skills diferentes',
      'Química do time: jogadores da mesma nacionalidade rendem mais',
    ],
    action: {
      label: 'Ver meu time',
      href: '/team',
    },
  },
  {
    id: 'market',
    title: 'Mercado de transferências',
    description: 'Compre jogadores Genesis (cartas fundadoras) ou negocie com outros managers. Leilões em EXP ou BRO.',
    icon: ShoppingBag,
    category: 'mercado',
    tips: [
      'Genesis: cartas limitadas com overall alto',
      'Leilões: dê lances e dispute com outros managers',
      'Compra imediata: leve o jogador na hora',
    ],
    action: {
      label: 'Explorar mercado',
      href: '/market/transfer',
    },
  },
  {
    id: 'economy',
    title: 'Sistema de economia',
    description: 'Olefoot tem 4 moedas: EXP (progressão), OLE (saldo genérico), BRO (mercado) e OLEFOOT (token do jogo).',
    icon: Wallet,
    category: 'economia',
    tips: [
      'EXP: ganhe em partidas e missões, use para evoluir',
      'BRO: moeda premium para leilões e compras especiais',
      'OLEFOOT: compre cards de lenda e renove contratos',
    ],
    action: {
      label: 'Ver carteira',
      href: '/wallet',
    },
  },
  {
    id: 'missions',
    title: 'Missões e progressão',
    description: 'Complete missões diárias, semanais e especiais para ganhar EXP, troféus e desbloquear conteúdo exclusivo.',
    icon: Target,
    category: 'inicio',
    tips: [
      'Missões de onboarding: primeiros passos no jogo',
      'Missões diárias: recompensas rápidas todo dia',
      'Troféus: conquistas permanentes na sua carreira',
    ],
    action: {
      label: 'Ver missões',
      href: '/missions',
    },
  },
  {
    id: 'career',
    title: 'Carreira de manager',
    description: 'Evolua de Fraldinha até Lenda. Cada tier desbloqueia novas funcionalidades e aumenta seu prestígio.',
    icon: Trophy,
    category: 'inicio',
    tips: [
      '8 tiers de carreira: de iniciante a lenda',
      'EXP acumulado define seu tier atual',
      'Cada tier desbloqueia benefícios exclusivos',
    ],
    action: {
      label: 'Ver carreira',
      href: '/manager',
    },
  },
  {
    id: 'tactics',
    title: 'Táticas avançadas',
    description: 'Use comandos de coach durante a partida ao vivo: pressão alta, contra-ataque, posse de bola e mais.',
    icon: Zap,
    category: 'partida',
    tips: [
      'Comandos táticos mudam o comportamento do time',
      'Pressão alta: recupera bola mais rápido, gasta stamina',
      'Contra-ataque: espera o adversário e explora espaços',
    ],
  },
];

const CATEGORY_CONFIG = {
  inicio: { label: 'Início', color: 'neon-yellow' },
  partida: { label: 'Partida', color: 'cyan-400' },
  time: { label: 'Time', color: 'emerald-400' },
  mercado: { label: 'Mercado', color: 'fuchsia-400' },
  economia: { label: 'Economia', color: 'amber-400' },
} as const;

interface OlefootAssistantProps {
  /** Se true, abre automaticamente no mount. */
  autoOpen?: boolean;
  /** Callback quando o usuário completa o tutorial. */
  onComplete?: () => void;
}

export function OlefootAssistant({ autoOpen = false, onComplete }: OlefootAssistantProps) {
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragControls = useDragControls();
  const constraintsRef = useRef<HTMLDivElement>(null);

  const currentStep = TUTORIAL_STEPS[currentStepIndex];
  const progress = ((currentStepIndex + 1) / TUTORIAL_STEPS.length) * 100;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === TUTORIAL_STEPS.length - 1;

  useEffect(() => {
    // Carrega progresso do localStorage
    const saved = localStorage.getItem('olefoot_assistant_progress');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setCompletedSteps(new Set(data.completed || []));
        setCurrentStepIndex(data.currentIndex || 0);
        if (data.position) {
          setPosition(data.position);
        }
      } catch (e) {
        console.warn('Failed to load assistant progress', e);
      }
    }
  }, []);

  const saveProgress = (index: number, completed: Set<string>, pos?: { x: number; y: number }) => {
    localStorage.setItem(
      'olefoot_assistant_progress',
      JSON.stringify({
        currentIndex: index,
        completed: Array.from(completed),
        position: pos || position,
      }),
    );
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    const newPosition = { x: info.offset.x, y: info.offset.y };
    setPosition(newPosition);
    saveProgress(currentStepIndex, completedSteps, newPosition);
  };

  const handleNext = () => {
    const newCompleted = new Set<string>(completedSteps);
    newCompleted.add(currentStep.id);
    setCompletedSteps(newCompleted);

    if (isLastStep) {
      saveProgress(0, newCompleted);
      onComplete?.();
      setIsOpen(false);
    } else {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      saveProgress(nextIndex, newCompleted);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      const prevIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevIndex);
      saveProgress(prevIndex, completedSteps);
    }
  };

  const handleClose = () => {
    saveProgress(currentStepIndex, completedSteps);
    setIsOpen(false);
  };

  const handleStepSelect = (index: number) => {
    setCurrentStepIndex(index);
    setIsMinimized(false);
    saveProgress(index, completedSteps);
  };

  if (!isOpen) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 sm:bottom-8 sm:right-8 z-50 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-neon-yellow text-black shadow-[0_0_30px_rgba(253,225,0,0.6)] transition-all hover:scale-110 hover:shadow-[0_0_40px_rgba(253,225,0,0.8)]"
        aria-label="Abrir assistente"
      >
        <HelpCircle className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2.5} />
      </motion.button>
    );
  }

  if (isMinimized) {
    return (
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50"
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-3 rounded-lg border-2 border-neon-yellow/40 bg-black/95 px-4 py-3 shadow-[0_0_30px_rgba(253,225,0,0.3)] backdrop-blur-sm transition-all hover:border-neon-yellow/60 hover:shadow-[0_0_40px_rgba(253,225,0,0.5)]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neon-yellow/20">
            <HelpCircle className="h-5 w-5 text-neon-yellow" strokeWidth={2.5} />
          </div>
          <div className="text-left">
            <p className="font-display text-xs font-bold uppercase tracking-wider text-neon-yellow">
              Assistente
            </p>
            <p className="text-[10px] text-white/60">
              {currentStepIndex + 1}/{TUTORIAL_STEPS.length}
            </p>
          </div>
        </button>
      </motion.div>
    );
  }

  const categoryConfig = CATEGORY_CONFIG[currentStep.category];
  const StepIcon = currentStep.icon;

  return (
    <>
      {/* Constraints container - área onde o assistente pode ser arrastado */}
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-50" />

      <motion.div
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={constraintsRef}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        style={{ x: position.x, y: position.y }}
        className={cn(
          'fixed z-50 w-full max-w-md pointer-events-auto px-4',
          'bottom-20 right-0 sm:bottom-6 sm:right-6',
          isDragging && 'cursor-grabbing'
        )}
      >
        <div className="relative overflow-hidden rounded-lg border-2 border-neon-yellow/40 bg-deep-black shadow-[0_0_40px_rgba(253,225,0,0.4)]">
          {/* Watermark decorativo */}
          <div
            className="pointer-events-none absolute right-0 top-0 select-none opacity-[0.03]"
            aria-hidden
          >
            <span
              className="font-display font-black uppercase text-white"
              style={{
                fontSize: '180px',
                lineHeight: '0.85',
                letterSpacing: '-0.02em',
              }}
            >
              ?
            </span>
          </div>

          {/* Header com handle para arrastar */}
          <div
            className="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/60 px-4 py-3 backdrop-blur-sm cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neon-yellow/20 border-2 border-neon-yellow/40">
                <HelpCircle className="h-5 w-5 text-neon-yellow" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="font-display text-sm font-black uppercase tracking-wider text-neon-yellow flex items-center gap-2">
                  Assistente Olefoot
                  <Move className="h-3 w-3 text-neon-yellow/60" />
                </h3>
                <p className="text-[10px] text-white/50">
                  Passo {currentStepIndex + 1} de {TUTORIAL_STEPS.length} • Arraste para mover
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMinimized(true)}
                className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Minimizar"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={handleClose}
                className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

        {/* Progress bar */}
        <div className="relative h-1 bg-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
            className="h-full bg-gradient-to-r from-neon-yellow to-amber-400"
          />
        </div>

        {/* Content */}
        <div className="relative z-10 p-5 space-y-4">
          {/* Category badge */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider',
                `border-${categoryConfig.color}/40 bg-${categoryConfig.color}/10 text-${categoryConfig.color}`,
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', `bg-${categoryConfig.color}`)} />
              {categoryConfig.label}
            </span>
          </div>

          {/* Step icon + title */}
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-neon-yellow/15 border-2 border-neon-yellow/40">
              <StepIcon className="h-7 w-7 text-neon-yellow" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <h4
                className="font-display text-lg font-black uppercase leading-tight tracking-wide text-white"
                style={{ letterSpacing: '0.02em' }}
              >
                {currentStep.title}
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                {currentStep.description}
              </p>
            </div>
          </div>

          {/* Tips */}
          {currentStep.tips && currentStep.tips.length > 0 && (
            <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neon-yellow/80">
                <Sparkles className="h-3 w-3" />
                Dicas importantes
              </p>
              <ul className="space-y-1.5">
                {currentStep.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-neon-yellow/60" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action button */}
          {currentStep.action && (
            <a
              href={currentStep.action.href}
              onClick={currentStep.action.onClick}
              className="block w-full rounded-sm bg-neon-yellow/10 border border-neon-yellow/30 px-4 py-2.5 text-center font-display text-xs font-bold uppercase tracking-wider text-neon-yellow transition-all hover:bg-neon-yellow/20 hover:border-neon-yellow/50"
            >
              {currentStep.action.label}
            </a>
          )}
        </div>

        {/* Footer navigation */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 bg-black/60 px-4 py-3 backdrop-blur-sm">
          <button
            onClick={handlePrev}
            disabled={isFirstStep}
            className={cn(
              'flex items-center gap-1.5 rounded-sm px-3 py-2 font-display text-xs font-bold uppercase tracking-wider transition-all',
              isFirstStep
                ? 'cursor-not-allowed text-white/30'
                : 'text-white/70 hover:bg-white/10 hover:text-white',
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>

          <div className="flex items-center gap-1">
            {TUTORIAL_STEPS.map((step, i) => (
              <button
                key={step.id}
                onClick={() => handleStepSelect(i)}
                className={cn(
                  'h-2 rounded-full transition-all',
                  i === currentStepIndex
                    ? 'w-6 bg-neon-yellow'
                    : completedSteps.has(step.id)
                      ? 'w-2 bg-neon-green'
                      : 'w-2 bg-white/20 hover:bg-white/40',
                )}
                aria-label={`Ir para passo ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 rounded-sm bg-neon-yellow px-3 py-2 font-display text-xs font-bold uppercase tracking-wider text-black transition-all hover:bg-white"
          >
            {isLastStep ? (
              <>
                Concluir
                <CheckCircle2 className="h-4 w-4" />
              </>
            ) : (
              <>
                Próximo
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
    </>
  );
}
