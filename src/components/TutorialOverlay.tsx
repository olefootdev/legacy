import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GraduationCap, ChevronRight, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { usePlatformConfig } from '@/admin/platformConfigStore';
import { TutorialSpotlight } from './TutorialSpotlight';

type StepAction =
  | { kind: 'goto'; path: string; label: string }
  | { kind: 'observe'; label: string }
  | { kind: 'finish'; label: string };

type TutorialStep = {
  route: string | RegExp;
  /** ID do elemento alvo (data-tutorial-anchor). Ausente = sem spotlight. */
  anchor?: string;
  title: string;
  lines: string[];
  action: StepAction;
};

/**
 * 4 capítulos pós-cerimônia: Home → Plantel/Tática → Match Quick → Postgame (auto-finish).
 *
 * Copy alinhada à cerimônia editorial: 25 jogadores Genesis + EXP inicial + linguagem
 * "primeira partida". Steps com `anchor` ganham spotlight visual no alvo.
 */
const STEPS: TutorialStep[] = [
  {
    route: '/',
    title: 'Bem-vindo ao Olefoot',
    lines: [
      'Esse é teu painel. Daqui acessas plantel, tática, mercado e jogos.',
      'Já tens 25 jogadores Genesis e EXP inicial. Vamos ver teu time antes da estreia.',
    ],
    action: { kind: 'goto', path: '/clube/elenco', label: 'Ver o plantel' },
  },
  {
    route: /^\/(team|clube\/elenco)/,
    anchor: 'team-hero',
    title: 'Teu plantel e tática',
    lines: [
      'Aqui está teu time — 25 jogadores. Toca em qualquer um pra ver atributos e mentoria.',
      'A tática começa em 4-3-3 equilibrado. Dá pra mudar quando quiseres.',
    ],
    action: { kind: 'goto', path: '/match/quick', label: 'Primeira partida' },
  },
  {
    route: /^\/match\/quick/,
    anchor: 'match-quick-board',
    title: 'A estreia começa',
    lines: [
      'Partida rápida = resultado em segundos contra um adversário ajustado.',
      'A contagem 3-2-1 inicia sozinha. Senta e assiste.',
    ],
    action: { kind: 'observe', label: 'Deixa rolar' },
  },
  {
    route: /^\/postgame/,
    title: 'Boa estreia',
    lines: [
      'Recebeste XP da partida. Agora podes explorar missões, treino, ligas e mercado.',
      'O assistente fica no canto da tela pra qualquer dúvida.',
    ],
    action: { kind: 'finish', label: 'Começar' },
  },
];

function routeMatches(current: string, pattern: string | RegExp): boolean {
  if (typeof pattern === 'string') return current === pattern;
  return pattern.test(current);
}

/** Modal editorial pra confirmação de pular tutorial — alinhado ao ExitConfirmModal da cerimônia. */
function SkipConfirmModal(props: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[440px] sports-panel p-7 flex flex-col gap-5"
        style={{ background: '#0D0D0D', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        <div
          className="font-display uppercase text-neon-yellow"
          style={{ fontSize: 11, letterSpacing: '0.35em' }}
        >
          Aviso · Pular tutorial
        </div>
        <h3
          className="font-serif-hero italic text-white"
          style={{ fontSize: 26, lineHeight: 1.05 }}
        >
          Tens certeza? Podes ligar de volta nas configurações.
        </h3>
        <p className="text-white/70" style={{ fontSize: 14, lineHeight: 1.55 }}>
          O tutorial dura menos de um minuto. Mas se já tás à vontade, sem
          drama.
        </p>
        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={props.onCancel}
            className="bg-dark-gray text-white border border-white/20 font-display font-bold uppercase tracking-wider px-5 py-2 -skew-x-6 hover:bg-white/10 transition-all"
            style={{ fontSize: 13, letterSpacing: '0.18em' }}
          >
            <span className="inline-block skew-x-6">Continuar</span>
          </button>
          <button
            type="button"
            onClick={props.onConfirm}
            className="bg-white/10 text-white border border-white/30 font-display font-bold uppercase tracking-wider px-5 py-2 -skew-x-6 hover:bg-white/20 transition-all"
            style={{ fontSize: 13, letterSpacing: '0.18em' }}
          >
            <span className="inline-block skew-x-6">Pular</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function TutorialOverlay() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const { flags } = usePlatformConfig();
  const tutorialEnabledFlag = (flags as Record<string, boolean>).TUTORIAL_ENABLED;
  const step = useGameStore((s) => s.userSettings.tutorialStep);
  const managerProfile = useGameStore((s) => s.userSettings.managerProfile);
  const playersCount = useGameStore((s) => Object.keys(s.players ?? {}).length);
  const [minimized, setMinimized] = useState(false);
  const [askingSkip, setAskingSkip] = useState(false);

  // Tutorial só ativa quando há manager + plantel já entregue (cerimônia concluída) + não terminado.
  const active = useMemo(() => {
    if (tutorialEnabledFlag === false) return false;
    if (!managerProfile) return false;
    if (step === -1) return false;
    if (playersCount === 0) return false; // ainda na cerimônia, espera entrega do plantel
    return true;
  }, [tutorialEnabledFlag, managerProfile, step, playersCount]);

  // Inicializa em 0 logo que vira ativo.
  useEffect(() => {
    if (active && step == null) {
      dispatch({ type: 'SET_USER_SETTINGS', partial: { tutorialStep: 0 } });
    }
  }, [active, step, dispatch]);

  const currentIdx = typeof step === 'number' && step >= 0 ? step : 0;
  const current = STEPS[currentIdx];

  // Auto-finish quando manager chega em /postgame durante o tutorial — mesmo sem clicar.
  useEffect(() => {
    if (!active) return;
    if (typeof step !== 'number' || step < 0) return;
    if (!/^\/postgame/.test(location.pathname)) return;
    // Se já está no último passo, esse efeito não força finish — deixa o user
    // ler o último card e clicar "Começar". Mas se ainda está em passos anteriores
    // (ex: pulou a partida quick), avança direto pro último step.
    const lastIdx = STEPS.length - 1;
    if (step < lastIdx) {
      dispatch({ type: 'SET_USER_SETTINGS', partial: { tutorialStep: lastIdx } });
    }
  }, [active, step, location.pathname, dispatch]);

  if (!active) return null;
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

  const offRoute = !onRoute;
  const showSpotlight = onRoute && !!current.anchor && !minimized && !askingSkip;

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
    <>
      {showSpotlight && <TutorialSpotlight anchorId={current.anchor} />}

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
              onClick={() => setAskingSkip(true)}
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
              onClick={() => setAskingSkip(true)}
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

      {askingSkip && (
        <SkipConfirmModal
          onCancel={() => setAskingSkip(false)}
          onConfirm={() => {
            setAskingSkip(false);
            dispatch({ type: 'SET_USER_SETTINGS', partial: { tutorialStep: -1 } });
          }}
        />
      )}
    </>
  );
}
