import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GraduationCap, ChevronRight, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { usePlatformConfig } from '@/admin/platformConfigStore';

type StepAction =
  | { kind: 'goto'; path: string; label: string }
  | { kind: 'observe'; label: string }
  | { kind: 'finish'; label: string };

type TutorialStep = {
  route: string | RegExp;
  title: string;
  lines: string[];
  action: StepAction;
  /** Se definido, avança automaticamente quando a rota bater (sem precisar de clique). */
  autoAdvanceOnRoute?: string;
};

const STEPS: TutorialStep[] = [
  {
    route: '/',
    title: 'Bem-vindo ao OLEFOOT',
    lines: [
      'Sou teu assistente, vou te mostrar o essencial em 60 segundos.',
      'Antes da primeira partida, vê o teu plantel e escolhe a tática.',
    ],
    action: { kind: 'goto', path: '/team', label: 'Ver o plantel' },
  },
  {
    route: '/team',
    title: 'Teu plantel',
    lines: [
      'Aqui está o time que recebes no Welcome Pack — 15 jogadores pra começar.',
      'Clica em qualquer jogador pra ver atributos, evolução e mentoria.',
    ],
    action: { kind: 'goto', path: '/team', label: 'Agora a tática' },
  },
  {
    route: '/team',
    title: 'Tática',
    lines: [
      'Aqui defines a formação e o estilo de jogo.',
      'Começa com um 4-3-3 equilibrado — dá pra mudar depois.',
    ],
    action: { kind: 'goto', path: '/transfer', label: 'Visitar o mercado' },
  },
  {
    route: '/transfer',
    title: 'Mercado',
    lines: [
      'Reforços entram por aqui: catálogo Genesis e Legacies (mentores).',
      'Dá uma olhada. Comprar é opcional agora — tens time suficiente pra jogar.',
    ],
    action: { kind: 'goto', path: '/match/quick', label: 'Primeira partida rápida' },
  },
  {
    route: /^\/match\/quick/,
    title: 'Primeira partida',
    lines: [
      'Partida rápida = resultado em segundos, adversário ajustado ao teu nível.',
      'A contagem 3-2-1 inicia sozinha. Aguarda o apito.',
    ],
    action: { kind: 'observe', label: 'Deixa rolar' },
  },
  {
    route: /^\/match\/quick/,
    title: 'Tudo pronto',
    lines: [
      'Depois da partida: recebes XP, OLE e podes explorar missões, treino e ligas.',
      'Bom jogo.',
    ],
    action: { kind: 'finish', label: 'Fechar tutorial' },
  },
];

function routeMatches(current: string, pattern: string | RegExp): boolean {
  if (typeof pattern === 'string') return current === pattern;
  return pattern.test(current);
}

export function TutorialOverlay() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const { flags } = usePlatformConfig();
  const tutorialEnabledFlag = (flags as Record<string, boolean>).TUTORIAL_ENABLED;
  const step = useGameStore((s) => s.userSettings.tutorialStep);
  const managerProfile = useGameStore((s) => s.userSettings.managerProfile);
  const [minimized, setMinimized] = useState(false);

  // Tutorial só ativa quando há manager cadastrado e ainda não terminou (-1).
  const active = useMemo(() => {
    if (tutorialEnabledFlag === false) return false;
    if (!managerProfile) return false;
    if (step === -1) return false;
    return true;
  }, [tutorialEnabledFlag, managerProfile, step]);

  // Inicializa em 0 na primeira aparição.
  useEffect(() => {
    if (active && step == null) {
      dispatch({ type: 'SET_USER_SETTINGS', partial: { tutorialStep: 0 } });
    }
  }, [active, step, dispatch]);

  if (!active) return null;
  const currentIdx = typeof step === 'number' && step >= 0 ? step : 0;
  const current = STEPS[currentIdx];
  if (!current) return null;

  const onRoute = routeMatches(location.pathname, current.route);

  const advance = () => {
    const next = currentIdx + 1;
    if (next >= STEPS.length) {
      dispatch({ type: 'SET_USER_SETTINGS', partial: { tutorialStep: -1 } });
    } else {
      dispatch({ type: 'SET_USER_SETTINGS', partial: { tutorialStep: next } });
    }
  };

  const skip = () => {
    if (!window.confirm('Pular o tutorial? Podes ligar de volta em Config.')) return;
    dispatch({ type: 'SET_USER_SETTINGS', partial: { tutorialStep: -1 } });
  };

  const handleAction = () => {
    if (current.action.kind === 'goto') {
      navigate(current.action.path);
      advance();
    } else if (current.action.kind === 'finish') {
      dispatch({ type: 'SET_USER_SETTINGS', partial: { tutorialStep: -1 } });
    } else {
      advance();
    }
  };

  // Se o user já está na rota-alvo antes de clicar (ex: navegou manual), mantemos o card.
  // Se NÃO está na rota-alvo, o card ainda aparece mas com aviso sutil.
  const offRoute = !onRoute;

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-[9998] inline-flex items-center gap-2 rounded-full border border-violet-500/50 bg-violet-950/90 px-3 py-2 text-[11px] font-bold text-violet-100 shadow-xl backdrop-blur hover:bg-violet-900/95"
      >
        <GraduationCap className="h-4 w-4" />
        Tutorial ({currentIdx + 1}/{STEPS.length})
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9998] flex justify-center px-3 pb-3 pointer-events-none sm:inset-auto sm:bottom-4 sm:right-4 sm:px-0 sm:pb-0">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-violet-500/50 bg-gradient-to-br from-violet-950/95 via-black/95 to-black/95 p-4 shadow-[0_20px_60px_rgba(139,92,246,0.25)] backdrop-blur">
        <div className="mb-2 flex items-start gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-500/20 text-violet-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-display text-[9px] font-bold uppercase tracking-widest text-violet-300/80">
                Passo {currentIdx + 1}/{STEPS.length}
              </span>
              {offRoute ? (
                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
                  fora da página
                </span>
              ) : null}
            </div>
            <h3 className="mt-0.5 text-sm font-black text-white">{current.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            title="Minimizar"
            className="rounded-lg p-1 text-violet-200/60 hover:bg-white/5 hover:text-white"
          >
            <span className="block h-0.5 w-3 bg-current" />
          </button>
          <button
            type="button"
            onClick={skip}
            title="Pular tutorial"
            className="rounded-lg p-1 text-violet-200/60 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          {current.lines.map((line, i) => (
            <p key={i} className="text-[13px] leading-relaxed text-violet-50/90">
              {line}
            </p>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={skip}
            className="text-[10px] font-bold uppercase tracking-wider text-violet-300/50 hover:text-violet-200"
          >
            Pular
          </button>
          <button
            type="button"
            onClick={handleAction}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider transition-colors',
              current.action.kind === 'finish'
                ? 'bg-green-500 text-black hover:bg-green-400'
                : 'bg-violet-500 text-black hover:bg-violet-400',
            )}
          >
            {current.action.label}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
