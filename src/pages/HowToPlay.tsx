import {
  Users,
  Target,
  Dumbbell,
  Wallet,
  ShoppingBag,
  TrendingUp,
  BookOpen,
  RotateCcw,
  ChevronRight,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { SecaoVolt } from '@/components/ui';
import { BackButton } from '@/components/BackButton';

type Step = {
  icon: typeof Users;
  title: string;
  body: string;
  cta: { label: string; to: string };
};

const STEPS: Step[] = [
  {
    icon: Users,
    title: 'Conheça o plantel',
    body:
      'Abra MEU TIME, clique em cada jogador e observe atributos, fadiga, posição preferida e mentorias. Um manager sabe quem entra antes de escolher a tática.',
    cta: { label: 'Conhecer time', to: '/team' },
  },
  {
    icon: Target,
    title: 'Escolha uma tática coerente',
    body:
      'Formação e estilo precisam casar com quem joga. 4-3-3 ofensivo sem velocidade nas pontas perde. 5-3-2 defensivo sem zagueiros fortes também. Teste.',
    cta: { label: 'Definir tática', to: '/team' },
  },
  {
    icon: Dumbbell,
    title: 'Treine com foco',
    body:
      'Evolução vai pros atributos mais baixos de cada jogador. Se quer ataque, treine os atacantes em finalização e velocidade — não todos em tudo.',
    cta: { label: 'Ir ao treino', to: '/team/treino' },
  },
  {
    icon: Wallet,
    title: 'Controle as finanças',
    body:
      'OLE é o motor do jogo. Gaste antes de ganhar missão/liga e vai travar. Reserve para emergências (lesão, reposição de contrato).',
    cta: { label: 'Abrir wallet', to: '/wallet' },
  },
  {
    icon: ShoppingBag,
    title: 'Contrate com propósito',
    body:
      'Cada reforço deve resolver um buraco concreto. Legacy DNA ensina jogadores da mesma posição — comprar um mentor certo vale mais que 3 OVR altos sem sinergia.',
    cta: { label: 'Visitar mercado', to: '/transfer' },
  },
  {
    icon: TrendingUp,
    title: 'Evolua continuamente',
    body:
      'Jogue partidas rápidas pra gerar XP, complete missões diárias e acompanhe mentorias (+1/dia nos atributos ensinados). Pequeno, constante, todo dia.',
    cta: { label: 'Ver missões', to: '/missions' },
  },
  {
    icon: BookOpen,
    title: 'Leia o jogo após cada partida',
    body:
      'O Game Spirit dá o relatório pós-jogo com o que funcionou e o que falhou. Ajuste a tática antes da próxima. Managers que não revisam repetem erros.',
    cta: { label: 'Jogar partida rápida', to: '/match/quick' },
  },
];

export function HowToPlay() {
  const dispatch = useGameDispatch();
  const assistantEnabled = useGameStore(
    (s) => s.userSettings.assistantEnabled ?? true,
  );

  const toggleAssistant = () => {
    dispatch({
      type: 'SET_USER_SETTINGS',
      partial: { assistantEnabled: !assistantEnabled },
    });
  };

  const restartTutorial = () => {
    if (!window.confirm('Reiniciar o tutorial inicial?')) return;
    dispatch({ type: 'SET_USER_SETTINGS', partial: { tutorialStep: 0 } });
    window.location.href = '/';
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6 pb-8 overflow-x-hidden">
      <div className="px-3 sm:px-4 lg:px-8">
        <BackButton to="/ajuda" label="Ajuda" />
      </div>
      {/* ── HERO — volt chapado + título em Anton ── */}
      <section
        aria-label="Como jogar"
        className="relative w-full overflow-hidden bg-neon-yellow -mx-3 -mt-3 sm:-mx-4 sm:-mt-4 lg:-mx-8 lg:-mt-8 mb-2"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 mx-auto max-w-3xl px-5 sm:px-8 py-10 sm:py-14"
        >
          <span className="ole-eyebrow-poster" data-on="yellow" style={{ fontSize: '12px' }}>
            Tutorial · 7 passos
          </span>
          <h1
            className="mt-2 font-impact uppercase text-deep-black"
            style={{ fontSize: 'clamp(44px, 12vw, 88px)', lineHeight: 0.95, letterSpacing: '-0.01em' }}
          >
            Como jogar
          </h1>
        </motion.div>
      </section>

      {/* ── Opções ── */}
      <section className="space-y-3">
        <SecaoVolt label="Opções" />
        <div className="bg-panel border border-white/10 overflow-hidden divide-y divide-white/5">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Ativar assistente</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-cimento">
                Dicas flutuantes fora das partidas.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleAssistant}
              className={cn(
                'shrink-0 px-4 py-1.5 text-[10px] font-display font-bold uppercase tracking-[0.18em] transition-colors',
                assistantEnabled
                  ? 'bg-neon-yellow text-black hover:bg-white'
                  : 'border border-white/16 text-cimento hover:border-white/30 hover:text-white',
              )}
            >
              {assistantEnabled ? 'Ligado' : 'Desligado'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Refazer tutorial inicial</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-cimento">
                Plantel → tática → mercado → primeira partida.
              </p>
            </div>
            <button
              type="button"
              onClick={restartTutorial}
              className="inline-flex shrink-0 items-center gap-1.5 border border-white/30 bg-deep-black px-3 py-1.5 text-[10px] font-display font-bold uppercase tracking-[0.18em] text-white transition-colors hover:border-white"
            >
              <RotateCcw className="h-3 w-3" />
              Reiniciar
            </button>
          </div>
        </div>
      </section>

      {/* ── 7 passos ── */}
      <section className="space-y-3">
        <SecaoVolt label="Os 7 passos" />
        <ol className="space-y-3">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="border border-white/10 bg-panel p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center bg-neon-yellow text-black">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-neon-yellow">
                      Passo {String(i + 1).padStart(2, '0')}
                    </span>
                    <h3 className="mt-0.5 font-impact text-[20px] uppercase leading-[1.1] text-white">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-giz">
                      {step.body}
                    </p>
                    <Link
                      to={step.cta.to}
                      className="mt-3 inline-flex items-center gap-1.5 bg-neon-yellow px-4 py-2 text-[11px] font-display font-bold uppercase tracking-[0.18em] text-black transition-colors hover:bg-white [clip-path:var(--clip-corte)]"
                    >
                      {step.cta.label}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
