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
import { StoreSectionHeadline } from '@/store/StoreSectionHeadline';

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
    cta: { label: 'Definir tática', to: '/team' },
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
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6 pb-8 overflow-x-hidden">
      {/* ── HERO BVB — amarelo full + watermark + Agency + Moret italic ── */}
      <section
        aria-label="Como jogar"
        className="relative w-full overflow-hidden bg-neon-yellow -mx-3 -mt-3 sm:-mx-4 sm:-mt-4 lg:-mx-8 lg:-mt-8 mb-2"
      >
        <div
          className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
          aria-hidden
        >
          <span
            className="font-display font-black uppercase whitespace-nowrap text-black/[0.05]"
            style={{
              fontSize: 'clamp(140px, 28vw, 360px)',
              lineHeight: '0.85',
              letterSpacing: '-0.05em',
            }}
          >
            GUIA
          </span>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 mx-auto max-w-3xl px-5 sm:px-8 py-10 sm:py-14 text-center"
        >
          <div
            className="ole-eyebrow !text-black mb-5 sm:mb-6"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            <span className="!text-black">Tutorial · 7 passos</span>
          </div>
          <h1 className="leading-[0.9]">
            <span
              className="block font-bold uppercase text-black"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.5rem, 8vw, 5.5rem)',
                letterSpacing: '0.005em',
              }}
            >
              Como jogar
            </span>
            <span
              className="block italic text-black"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontSize: 'clamp(1.75rem, 5.5vw, 3.5rem)',
                marginTop: '0.04em',
                letterSpacing: '-0.01em',
              }}
            >
              passo a passo.
            </span>
          </h1>
          <span aria-hidden className="mx-auto mt-6 block w-16 h-[3px] bg-black" />
          <p
            className="mt-5 text-black/65 mx-auto max-w-md"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'clamp(0.85rem, 1vw, 0.95rem)',
              lineHeight: 1.55,
            }}
          >
            Sete passos pra seres um bom manager do teu clube. Lê com calma — o resto é prática.
          </p>
        </motion.div>
      </section>

      {/* ── Opções ── */}
      <section className="space-y-3">
        <StoreSectionHeadline
          title="Opções"
          subtitle="Assistente flutuante e reinício do tutorial inicial."
        />
        <div className="bg-panel border border-white/10 rounded-sm overflow-hidden divide-y divide-white/5">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
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
                'shrink-0 rounded-sm px-4 py-1.5 text-[10px] font-display font-bold uppercase tracking-[0.18em] transition-colors',
                assistantEnabled
                  ? 'bg-neon-yellow text-black hover:bg-white'
                  : 'bg-white/5 text-gray-500 hover:bg-white/10 border border-white/10',
              )}
            >
              {assistantEnabled ? 'Ligado' : 'Desligado'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Refazer tutorial inicial</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400">
                Reinicia o fluxo guiado que apresenta plantel → tática → mercado → primeira partida.
              </p>
            </div>
            <button
              type="button"
              onClick={restartTutorial}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-black border border-white/15 px-3 py-1.5 text-[10px] font-display font-bold uppercase tracking-[0.18em] text-white hover:border-neon-yellow hover:text-neon-yellow transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reiniciar
            </button>
          </div>
        </div>
      </section>

      {/* ── 7 passos ── */}
      <section className="space-y-3">
        <StoreSectionHeadline
          title="Os 7 passos"
          subtitle="Manager bom é o que entende o ciclo: plantel → tática → treino → finanças → mercado → evolução → leitura."
        />
        <ol className="space-y-3">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="bg-[var(--color-card)] border border-white/8 rounded-sm border-l-4 border-l-neon-yellow p-4 transition-transform duration-150 hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-neon-yellow/10 text-neon-yellow border border-neon-yellow/30">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-neon-yellow">
                      Passo {String(i + 1).padStart(2, '0')}
                    </span>
                    <h3 className="mt-0.5 font-display font-black uppercase text-white text-base sm:text-lg tracking-wide">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-gray-300">
                      {step.body}
                    </p>
                    <Link
                      to={step.cta.to}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-sm bg-neon-yellow px-4 py-2 text-[11px] font-display font-bold uppercase tracking-[0.18em] text-black transition-colors hover:bg-white shadow-[0_4px_12px_rgba(253,225,0,0.25)]"
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
