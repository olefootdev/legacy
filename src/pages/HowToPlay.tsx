import {
  GraduationCap,
  Users,
  Target,
  Dumbbell,
  Wallet,
  ShoppingBag,
  TrendingUp,
  BookOpen,
  Sparkles,
  RotateCcw,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';

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
      'Abre MEU TIME, clica em cada jogador e observa atributos, fadiga, posição preferida e mentorias. Um manager sabe quem entra antes de escolher a tática.',
    cta: { label: 'Conhecer time', to: '/team' },
  },
  {
    icon: Target,
    title: 'Escolhe uma tática coerente',
    body:
      'Formação e estilo têm de casar com quem joga. 4-3-3 ofensivo sem velocidade nas pontas perde. 5-3-2 defensivo sem zagueiros fortes também. Testa.',
    cta: { label: 'Definir tática', to: '/team/tatica' },
  },
  {
    icon: Dumbbell,
    title: 'Treine com foco',
    body:
      'Evolução vai pros atributos mais baixos de cada jogador. Se queres ataque, treina os atacantes em finalização e velocidade — não todos em tudo.',
    cta: { label: 'Ir ao treino', to: '/team/treino' },
  },
  {
    icon: Wallet,
    title: 'Controla as finanças',
    body:
      'OLE é o motor do jogo. Gasta antes de ganhar missão/liga e vai travar. Reserva para emergências (lesão, reposição de contrato).',
    cta: { label: 'Abrir wallet', to: '/wallet' },
  },
  {
    icon: ShoppingBag,
    title: 'Contrata com propósito',
    body:
      'Cada reforço deve resolver um buraco concreto. Legacy DNA ensina jogadores da mesma posição — comprar um mentor certo vale mais que 3 OVR altos sem sinergia.',
    cta: { label: 'Visitar mercado', to: '/transfer' },
  },
  {
    icon: TrendingUp,
    title: 'Evolui continuamente',
    body:
      'Joga partidas rápidas pra gerar XP, completa missões diárias e acompanha mentorias (+1/dia nos atributos ensinados). Pequeno, constante, todo dia.',
    cta: { label: 'Ver missões', to: '/missions' },
  },
  {
    icon: BookOpen,
    title: 'Lê o jogo após cada partida',
    body:
      'O Game Spirit dá o relatório pós-jogo com o que funcionou e o que falhou. Ajusta tática antes da próxima. Managers que não revisam repetem erros.',
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
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/20 text-violet-300">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-xl font-black text-white">Como jogar</h1>
          <p className="text-[11px] text-gray-400">
            Sete passos pra seres um bom manager do teu clube. Lê com calma — o resto é prática.
          </p>
        </div>
      </header>

      {/* Opções */}
      <section className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.04] p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-white">
          <Sparkles className="h-4 w-4 text-violet-300" />
          Opções
        </h2>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Ativar assistente</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400">
                Mostra uma pílula flutuante com dicas contextuais sempre que não estás numa partida.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleAssistant}
              className={cn(
                'shrink-0 rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors',
                assistantEnabled
                  ? 'bg-green-500/20 text-green-300'
                  : 'bg-white/5 text-gray-500 hover:bg-white/10',
              )}
            >
              {assistantEnabled ? 'Ligado' : 'Desligado'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Refazer tutorial inicial</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400">
                Reinicia o fluxo guiado que apresenta plantel → tática → mercado → primeira partida.
              </p>
            </div>
            <button
              type="button"
              onClick={restartTutorial}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-white/10"
            >
              <RotateCcw className="h-3 w-3" />
              Reiniciar
            </button>
          </div>
        </div>
      </section>

      {/* 7 passos */}
      <ol className="space-y-3">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <li
              key={step.title}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-[10px] font-bold uppercase tracking-widest text-violet-300/80">
                      Passo {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-0.5 text-base font-black text-white">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-gray-300">
                    {step.body}
                  </p>
                  <Link
                    to={step.cta.to}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-black transition-colors hover:bg-violet-400"
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
    </div>
  );
}
