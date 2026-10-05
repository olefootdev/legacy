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
import { Hashtag } from '@/components/ui';
import { moedaDoJogo } from '@/wallet/constants';
import { L } from '@/i18n/L';

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
    title: L('Bem-vindo ao Olefoot', 'Welcome to Olefoot'),
    description: L('O simulador de futebol mais inteligente do Brasil. Aqui você monta seu time, disputa partidas e constrói uma carreira de manager.', 'The smartest football sim from Brazil. Build your team, play matches and grow a manager career.'),
    icon: Sparkles,
    category: 'inicio',
    tips: [
      L('Cada decisão importa — não é sorte, é estratégia', 'Every decision matters — it is strategy, not luck'),
      L('Seus jogadores têm DNA único com IA embarcada', 'Your players have unique AI-powered DNA'),
      L('Ganhe EXP, evolua seu time e conquiste títulos', 'Earn EXP, improve your team and win titles'),
    ],
  },
  {
    id: 'first-match',
    title: L('Sua primeira partida', 'Your first match'),
    description: L('Escolha entre Partida Rápida (resultado instantâneo) ou Partida ao Vivo (simulação 2D completa com controle tático).', 'Pick Quick Match (instant result) or Live Match (full 2D sim with tactical control).'),
    icon: PlayCircle,
    category: 'partida',
    tips: [
      L('Partida Rápida: ideal para ganhar EXP rapidamente', 'Quick Match: best for earning EXP fast'),
      L('Partida ao Vivo: controle tático em tempo real', 'Live Match: real-time tactical control'),
      L('Cada vitória rende EXP e melhora sua reputação', 'Every win earns EXP and boosts your reputation'),
    ],
    action: {
      label: L('Disputar partida', 'Play match'),
      href: '/match',
    },
  },
  {
    id: 'build-squad',
    title: L('Monte seu elenco', 'Build your squad'),
    description: L('Escale seus 11 titulares na formação ideal. Cada posição tem peso diferente nos atributos — escolha com inteligência.', 'Pick your starting 11 in the right formation. Each position weighs attributes differently — choose wisely.'),
    icon: Users,
    category: 'time',
    tips: [
      L('Formações: 4-3-3, 4-4-2, 4-2-3-1 e mais', 'Formations: 4-3-3, 4-4-2, 4-2-3-1 and more'),
      L('Atributos posicionais: cada slot valoriza skills diferentes', 'Positional attributes: each slot values different skills'),
      L('Química do time: jogadores da mesma nacionalidade rendem mais', 'Team chemistry: same-nationality players perform better'),
    ],
    action: {
      label: L('Ver meu time', 'View my team'),
      href: '/team',
    },
  },
  {
    id: 'market',
    title: L('Mercado de transferências', 'Transfer Market'),
    description: L('Compre jogadores Genesis (cartas fundadoras) ou negocie com outros managers. Leilões em EXP ou BRO.', 'Buy Genesis players (founder cards) or trade with other managers. Auctions in EXP or BRO.'),
    icon: ShoppingBag,
    category: 'mercado',
    tips: [
      L('Genesis: cartas limitadas com overall alto', 'Genesis: limited cards with high overall'),
      L('Leilões: dê lances e dispute com outros managers', 'Auctions: place bids against other managers'),
      L('Compra imediata: leve o jogador na hora', 'Buy now: get the player instantly'),
    ],
    action: {
      label: L('Explorar mercado', 'Explore Market'),
      href: '/market/transfer',
    },
  },
  {
    id: 'economy',
    title: L('Sistema de economia', 'Economy'),
    // Dizia "OLEFOOT (token do jogo)". Nenhum saldo do jogo é token: OLEFOOT
    // passou a ser o nome do token na Solana; o saldo virou OLEXP e, em
    // 2026-09-28, VERBA — OLEXP passou a ser a unidade de expansão da rede.
    description: L(
      `Olefoot tem 3 saldos, todos do jogo: EXP (progressão), ${moedaDoJogo()} (lendas e contratos) e BRO (crédito comprado).`,
      `Olefoot has 3 in-game balances: EXP (progression), ${moedaDoJogo()} (legends and contracts) and BRO (purchased credit).`,
    ),
    icon: Wallet,
    category: 'economia',
    tips: [
      L('EXP: ganhe em partidas e missões, use para evoluir', 'EXP: earn it in matches and missions, use it to level up'),
      L('BRO: moeda premium para leilões e compras especiais', 'BRO: premium currency for auctions and special purchases'),
      L(`${moedaDoJogo()}: compre cards de lenda e renove contratos`, `${moedaDoJogo()}: buy legend cards and renew contracts`),
    ],
    action: {
      label: L('Ver carteira', 'View Wallet'),
      href: '/wallet',
    },
  },
  {
    id: 'missions',
    title: L('Missões e progressão', 'Missions and progression'),
    description: L('Complete missões diárias, semanais e especiais para ganhar EXP, troféus e desbloquear conteúdo exclusivo.', 'Complete daily, weekly and special missions to earn EXP, trophies and unlock exclusive content.'),
    icon: Target,
    category: 'inicio',
    tips: [
      L('Missões de onboarding: primeiros passos no jogo', 'Onboarding missions: your first steps'),
      L('Missões diárias: recompensas rápidas todo dia', 'Daily missions: quick rewards every day'),
      L('Troféus: conquistas permanentes na sua carreira', 'Trophies: permanent career achievements'),
    ],
    action: {
      label: L('Ver missões', 'View missions'),
      href: '/missions',
    },
  },
  {
    id: 'career',
    title: L('Carreira de manager', 'Manager Career'),
    description: L('Evolua de Fraldinha até Lenda. Cada tier desbloqueia novas funcionalidades e aumenta seu prestígio.', 'Rise from Fraldinha to Legend. Each tier unlocks new features and raises your prestige.'),
    icon: Trophy,
    category: 'inicio',
    tips: [
      L('8 tiers de carreira: de iniciante a lenda', '8 career tiers: from rookie to legend'),
      L('EXP acumulado define seu tier atual', 'Total EXP sets your current tier'),
      L('Cada tier desbloqueia benefícios exclusivos', 'Each tier unlocks exclusive perks'),
    ],
    action: {
      label: L('Ver carreira', 'View Career'),
      href: '/manager',
    },
  },
  {
    id: 'tactics',
    title: L('Táticas avançadas', 'Advanced Tactics'),
    description: L('Use comandos de coach durante a partida ao vivo: pressão alta, contra-ataque, posse de bola e mais.', 'Use coach commands during live matches: high press, counter-attack, possession and more.'),
    icon: Zap,
    category: 'partida',
    tips: [
      L('Comandos táticos mudam o comportamento do time', 'Tactical commands change how your team plays'),
      L('Pressão alta: recupera bola mais rápido, gasta stamina', 'High press: wins the ball back faster, costs stamina'),
      L('Contra-ataque: espera o adversário e explora espaços', 'Counter-attack: sit deep and exploit space'),
    ],
  },
];

const CATEGORY_CONFIG = {
  inicio: { label: L('Início', 'Start'), color: 'neon-yellow' },
  partida: { label: L('Partida', 'Match'), color: 'cyan-400' },
  time: { label: L('Time', 'Team'), color: 'emerald-400' },
  mercado: { label: L('Mercado', 'Market'), color: 'fuchsia-400' },
  economia: { label: L('Economia', 'Economy'), color: 'amber-400' },
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
        className="fixed bottom-24 right-6 sm:bottom-8 sm:right-8 z-50 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-neon-yellow text-black transition-colors hover:bg-white"
        aria-label={L('Abrir assistente', 'Open assistant')}
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
          className="flex items-center gap-3 border border-white/16 bg-panel px-4 py-3 transition-colors hover:border-white/30"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card-hi">
            <HelpCircle className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="text-left">
            <p className="font-impact text-[15px] uppercase leading-[1.1] text-white">
              {L('Assistente', 'Assistant')}
            </p>
            <p className="font-mono text-[10.5px] text-cimento">
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
        <div className="relative overflow-hidden border border-white/16 bg-deep-black">

          {/* Header com handle para arrastar */}
          <div
            className="relative z-10 flex items-center justify-between border-b border-white/10 bg-nav px-4 py-3 cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/16 bg-card-hi">
                <HelpCircle className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="font-impact text-[17px] uppercase leading-[1.1] text-white flex items-center gap-2">
                  {L('Assistente Olefoot', 'Olefoot Assistant')}
                  <Move className="h-3 w-3 text-cimento" />
                </h3>
                <p className="font-mono text-[10.5px] text-cimento">
                  {L(`Passo ${currentStepIndex + 1} de ${TUTORIAL_STEPS.length} • Arraste para mover`, `Step ${currentStepIndex + 1} of ${TUTORIAL_STEPS.length} • Drag to move`)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMinimized(true)}
                className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label={L('Minimizar', 'Minimize')}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={handleClose}
                className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label={L('Fechar', 'Close')}
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
            className="h-full bg-neon-yellow"
          />
        </div>

        {/* Content */}
        <div className="relative z-10 p-5 space-y-4">
          {/* Categoria vira #hashtag (VOLT2) */}
          <Hashtag>#{categoryConfig.label.toLowerCase()}</Hashtag>

          {/* Step icon + title */}
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-white/16 bg-card-hi">
              <StepIcon className="h-7 w-7 text-white" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-impact text-xl uppercase leading-[1.1] text-white">
                {currentStep.title}
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-giz">
                {currentStep.description}
              </p>
            </div>
          </div>

          {/* Tips */}
          {currentStep.tips && currentStep.tips.length > 0 && (
            <div className="space-y-2 border border-white/10 bg-panel p-3">
              <p className="flex items-center gap-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-cimento">
                <Sparkles className="h-3 w-3" />
                {L('Dicas importantes', 'Key tips')}
              </p>
              <ul className="space-y-1.5">
                {currentStep.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-giz">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cimento" />
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
              className="block w-full border border-white/30 px-4 py-2.5 text-center font-display text-sm uppercase tracking-wider text-white transition-colors hover:border-white"
            >
              {currentStep.action.label}
            </a>
          )}
        </div>

        {/* Footer navigation */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 bg-nav px-4 py-3">
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
            {L('Anterior', 'Back')}
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
                      ? 'w-2 bg-alta'
                      : 'w-2 bg-white/20 hover:bg-white/40',
                )}
                aria-label={L(`Ir para passo ${i + 1}`, `Go to step ${i + 1}`)}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 rounded-sm bg-neon-yellow px-3 py-2 font-display text-xs font-bold uppercase tracking-wider text-black transition-all hover:bg-white"
          >
            {isLastStep ? (
              <>
                {L('Concluir', 'Finish')}
                <CheckCircle2 className="h-4 w-4" />
              </>
            ) : (
              <>
                {L('Próximo', 'Next')}
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
