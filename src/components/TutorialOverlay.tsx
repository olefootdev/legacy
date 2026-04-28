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
        className="fixed bottom-24 right-4 z-[9998] inline-flex items-center gap-2 border border-neon-yellow/45 bg-deep-black px-3.5 py-2 font-display font-black uppercase text-neon-yellow shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur transition-all hover:bg-neon-yellow hover:text-black sm:bottom-4"
        style={{
          fontSize: '10px',
          letterSpacing: '0.22em',
          borderRadius: 'var(--radius-pill)',
        }}
      >
        <GraduationCap className="h-4 w-4" />
        Tutorial · {currentIdx + 1}/{STEPS.length}
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-24 z-[9998] flex justify-center px-3 pointer-events-none sm:bottom-4 sm:inset-auto sm:right-4 sm:px-0">
      <div
        className="pointer-events-auto w-full max-w-md overflow-hidden border border-l-[3px] border-[var(--color-border)] border-l-neon-yellow bg-dark-gray shadow-[0_20px_60px_rgba(0,0,0,0.7)] backdrop-blur"
        style={{ borderRadius: 'var(--radius-md)' }}
      >
        {/* Header editorial */}
        <div className="flex items-start gap-3 border-b border-[var(--color-divider-yellow)] bg-deep-black/60 px-4 py-3">
          <div
            className="grid h-9 w-9 shrink-0 place-items-center bg-neon-yellow text-black"
            style={{ borderRadius: 'var(--radius-sm)' }}
            aria-hidden
          >
            <Sparkles className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="font-display uppercase text-neon-yellow"
                style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  letterSpacing: '0.28em',
                }}
              >
                Passo {currentIdx + 1} / {STEPS.length}
              </span>
              {offRoute ? (
                <span
                  className="border border-[var(--color-warning)]/55 bg-[var(--color-warning)]/10 px-1.5 py-0.5 font-display uppercase text-[var(--color-warning)]"
                  style={{
                    fontSize: '8px',
                    fontWeight: 800,
                    letterSpacing: '0.22em',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  Fora da página
                </span>
              ) : null}
            </div>
            <h3
              className="text-white uppercase truncate"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '13px',
                fontWeight: 800,
                letterSpacing: '0.18em',
                lineHeight: 1.1,
              }}
            >
              {current.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            title="Minimizar"
            className="shrink-0 inline-flex h-7 w-7 items-center justify-center text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            style={{ borderRadius: 'var(--radius-sm)' }}
            aria-label="Minimizar"
          >
            <span aria-hidden className="block h-0.5 w-3 bg-current" />
          </button>
          <button
            type="button"
            onClick={skip}
            title="Pular tutorial"
            className="shrink-0 inline-flex h-7 w-7 items-center justify-center text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            style={{ borderRadius: 'var(--radius-sm)' }}
            aria-label="Pular tutorial"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Corpo: linhas de explicação */}
        <div className="space-y-1.5 px-4 py-3.5">
          {current.lines.map((line, i) => (
            <p
              key={i}
              className="text-white/85"
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              {line}
            </p>
          ))}
        </div>

        {/* Footer: skip + CTA */}
        <div className="flex items-center justify-between gap-2 border-t border-[var(--color-divider-yellow)] bg-deep-black/40 px-4 py-3">
          <button
            type="button"
            onClick={skip}
            className="font-display font-bold uppercase text-white/45 transition-colors hover:text-white/80"
            style={{
              fontSize: '10px',
              letterSpacing: '0.22em',
            }}
          >
            Pular
          </button>
          <button
            type="button"
            onClick={handleAction}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-2 font-display font-black uppercase transition-all hover:scale-[1.02] active:scale-[0.98]',
              current.action.kind === 'finish'
                ? 'bg-[var(--color-success)] text-black hover:bg-white'
                : 'bg-neon-yellow text-black hover:bg-white',
            )}
            style={{
              fontSize: '11px',
              letterSpacing: '0.22em',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 4px 14px rgba(253,225,0,0.18)',
            }}
          >
            {current.action.label}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
