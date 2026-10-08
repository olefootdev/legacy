import {
  Users,
  Target,
  Dumbbell,
  Wallet,
  ShoppingBag,
  TrendingUp,
  BookOpen,
  RotateCcw,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { SecaoRua } from '@/components/ui';
import { BackButton } from '@/components/BackButton';
import { L } from '@/i18n/L';

type Step = {
  icon: typeof Users;
  title: string;
  body: string;
  cta: { label: string; to: string };
};

const STEPS: Step[] = [
  {
    icon: Users,
    title: L('Conheça o plantel', 'Know your squad'),
    body:
      L('Abra MEU TIME, clique em cada jogador e observe atributos, fadiga, posição preferida e mentorias. Um manager sabe quem entra antes de escolher a tática.', 'Open MY TEAM, tap each player and check attributes, fatigue, preferred position and mentorships. A manager knows who starts before picking tactics.'),
    cta: { label: L('Conhecer time', 'View team'), to: '/team' },
  },
  {
    icon: Target,
    title: L('Escolha uma tática coerente', 'Pick tactics that fit'),
    body:
      L('Formação e estilo precisam casar com quem joga. 4-3-3 ofensivo sem velocidade nas pontas perde. 5-3-2 defensivo sem zagueiros fortes também. Teste.', 'Formation and style must match your players. An attacking 4-3-3 without pace on the wings loses. So does a defensive 5-3-2 without strong centre-backs. Test it.'),
    cta: { label: L('Definir tática', 'Set tactics'), to: '/team' },
  },
  {
    icon: Dumbbell,
    title: L('Treine com foco', 'Train with focus'),
    body:
      L('Evolução vai pros atributos mais baixos de cada jogador. Se quer ataque, treine os atacantes em finalização e velocidade — não todos em tudo.', "Growth goes to each player's lowest attributes. Want attack? Train your strikers in finishing and pace — not everyone in everything."),
    cta: { label: L('Ir ao treino', 'Go to training'), to: '/team/treino' },
  },
  {
    icon: Wallet,
    title: L('Controle as finanças', 'Control your finances'),
    body:
      L('OLE é o motor do jogo. Gaste antes de ganhar missão/liga e vai travar. Reserve para emergências (lesão, reposição de contrato).', 'OLE drives the game. Spend before winning missions/leagues and you will stall. Keep a reserve for emergencies (injury, contract renewal).'),
    cta: { label: L('Abrir wallet', 'Open wallet'), to: '/wallet' },
  },
  {
    icon: ShoppingBag,
    title: L('Contrate com propósito', 'Sign with purpose'),
    body:
      L('Cada reforço deve resolver um buraco concreto. Legacy DNA ensina jogadores da mesma posição — comprar um mentor certo vale mais que 3 OVR altos sem sinergia.', 'Every signing should fix a real gap. Legacy DNA teaches players in the same position — the right mentor beats 3 high OVRs with no synergy.'),
    cta: { label: L('Visitar mercado', 'Visit market'), to: '/transfer' },
  },
  {
    icon: TrendingUp,
    title: L('Evolua continuamente', 'Keep improving'),
    body:
      L('Jogue partidas rápidas pra gerar XP, complete missões diárias e acompanhe mentorias (+1/dia nos atributos ensinados). Pequeno, constante, todo dia.', 'Play quick matches to earn XP, complete daily missions and follow mentorships (+1/day on taught attributes). Small, steady, every day.'),
    cta: { label: L('Ver missões', 'View missions'), to: '/missions' },
  },
  {
    icon: BookOpen,
    title: L('Leia o jogo após cada partida', 'Read the game after every match'),
    body:
      L('O Game Spirit dá o relatório pós-jogo com o que funcionou e o que falhou. Ajuste a tática antes da próxima. Managers que não revisam repetem erros.', "Game Spirit gives the post-match report: what worked and what failed. Adjust tactics before the next one. Managers who don't review repeat mistakes."),
    cta: { label: L('Jogar partida rápida', 'Play quick match'), to: '/match/quick' },
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
    if (!window.confirm(L('Reiniciar o tutorial inicial?', 'Restart the intro tutorial?'))) return;
    dispatch({ type: 'SET_USER_SETTINGS', partial: { tutorialStep: 0 } });
    window.location.href = '/';
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-7 overflow-x-hidden px-3 pb-8 sm:px-4">
      <BackButton to="/ajuda" label={L('Ajuda', 'Help')} />

      {/* ── HERO — o grito em Anton ── */}
      <motion.section
        aria-label={L('Como jogar', 'How to play')}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-2 border-b-2 border-papel pb-4"
      >
        <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.22em] text-rua">
          — {L('Tutorial · 7 passos', 'Tutorial · 7 steps')}
        </span>
        <h1 className="font-impact uppercase leading-[0.86] text-papel" style={{ fontSize: 'clamp(56px, 17vw, 104px)' }}>
          {L('Como jogar', 'How to play')}
        </h1>
        <p className="font-voz text-[clamp(22px,6.4vw,30px)] leading-[1.05] text-suave">
          {L('Pequeno, constante, todo dia.', 'Small, steady, every day.')}
        </p>
      </motion.section>

      {/* ── 7 passos — a escada, um degrau por vez ── */}
      <section className="flex flex-col gap-2">
        <SecaoRua label={L('Os 7 passos', 'The 7 steps')} aside="07" />
        <ol className="flex flex-col">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="flex min-w-0 items-start gap-3.5 border-b border-linha py-5 last:border-b-0">
                <span className="w-12 shrink-0 font-spray font-black leading-[0.85] text-rua" style={{ fontSize: 'clamp(40px, 11vw, 52px)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-prova text-[10.5px] font-bold uppercase tracking-[0.18em] text-mudo">
                    <Icon aria-hidden className="h-3.5 w-3.5" />
                    {L('Passo', 'Step')} {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-1 font-impact text-[22px] uppercase leading-[1.05] text-papel">{step.title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-suave">{step.body}</p>
                  <Link
                    to={step.cta.to}
                    className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 border-2 border-papel px-4 font-impact text-[16px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27"
                  >
                    {step.cta.label}
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ── Opções ── */}
      <section className="flex flex-col gap-2">
        <SecaoRua label={L('Opções', 'Options')} />
        <div className="divide-y divide-linha bg-concreto">
          <div className="flex items-center justify-between gap-3 px-4 py-4">
            <div className="min-w-0">
              <p className="font-impact text-[18px] uppercase leading-[1.1] text-papel">{L('Ativar assistente', 'Enable assistant')}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-mudo">
                {L('Dicas flutuantes fora das partidas.', 'Floating tips outside matches.')}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleAssistant}
              aria-pressed={assistantEnabled}
              className={cn(
                'min-h-[42px] shrink-0 px-4 font-prova text-[11.5px] font-bold uppercase tracking-[0.14em] transition-colors',
                assistantEnabled
                  ? 'bg-rua text-asfalto-27 hover:bg-papel'
                  : 'border-2 border-dashed border-fio text-mudo hover:border-papel hover:text-papel',
              )}
            >
              {assistantEnabled ? L('Ligado', 'On') : L('Desligado', 'Off')}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-4">
            <div className="min-w-0">
              <p className="font-impact text-[18px] uppercase leading-[1.1] text-papel">{L('Refazer tutorial inicial', 'Redo intro tutorial')}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-mudo">
                {L('Plantel → tática → mercado → primeira partida.', 'Squad → tactics → market → first match.')}
              </p>
            </div>
            <button
              type="button"
              onClick={restartTutorial}
              className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 border-2 border-papel px-3 font-prova text-[11.5px] font-bold uppercase tracking-[0.14em] text-papel transition-colors hover:bg-papel hover:text-asfalto-27"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              {L('Reiniciar', 'Restart')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
