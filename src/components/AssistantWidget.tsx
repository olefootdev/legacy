import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { usePlatformConfig } from '@/admin/platformConfigStore';

type Tip = { title: string; body: string };

const ROUTE_TIPS: Array<{ match: RegExp; tip: Tip }> = [
  {
    match: /^\/team\/tatica/,
    tip: {
      title: 'Tática',
      body: 'Se o plantel tem velocidade, experimenta 4-3-3 alto. Com zagueiros fortes mas lentos, 5-3-2 recua bem.',
    },
  },
  {
    match: /^\/team/,
    tip: {
      title: 'Plantel',
      body: 'Clica em qualquer jogador pra ver atributos, fadiga e mentorias. Quem estiver com fadiga alta, poupa na próxima.',
    },
  },
  {
    match: /^\/transfer/,
    tip: {
      title: 'Mercado',
      body: 'Um Legacy DNA no elenco ensina jogadores da mesma posição. Às vezes vale mais que um reforço direto.',
    },
  },
  {
    match: /^\/wallet/,
    tip: {
      title: 'Wallet',
      body: 'OLE é o saldo de jogo. Reserva uma parte pra lesões e renovação de contrato — não gasta tudo em reforços.',
    },
  },
  {
    match: /^\/missions/,
    tip: {
      title: 'Missões',
      body: 'Missões diárias são a fonte mais estável de OLE e XP. Faz todas antes de dormir.',
    },
  },
  {
    match: /^\/calendar/,
    tip: {
      title: 'Calendário',
      body: 'Olha 2-3 jogos à frente pra programar descanso e rotação do plantel.',
    },
  },
  {
    match: /^\/store/,
    tip: {
      title: 'Loja',
      body: 'Boosters pontuais ajudam em partidas decisivas. Pra jogos comuns, poupa.',
    },
  },
  {
    match: /^\/leagues/,
    tip: {
      title: 'Ligas',
      body: 'Liga paga mais que amistoso mas castiga derrotas seguidas com ânimo baixo.',
    },
  },
  {
    match: /^\/city/,
    tip: {
      title: 'Clube',
      body: 'Infraestrutura multiplica treino e recupera fadiga mais rápido. Investimento de médio prazo.',
    },
  },
  {
    match: /^\/profile/,
    tip: {
      title: 'Perfil',
      body: 'Troféus e memoráveis ficam aqui — bom pra rever o progresso quando der frustração.',
    },
  },
  {
    match: /^\/how-to-play/,
    tip: {
      title: 'Como jogar',
      body: 'Os 7 passos abaixo são o básico. Re-lê sempre que o time travar.',
    },
  },
  {
    match: /^\/$/,
    tip: {
      title: 'Home',
      body: 'Daqui vês o próximo jogo e resumos. Bom ponto de partida pra cada sessão.',
    },
  },
];

/** Rotas onde o assistente NÃO aparece (partidas, fluxos imersivos). */
const HIDE_ON = [/^\/match\//, /^\/postgame/, /^\/cadastro/, /^\/admin/];

export function AssistantWidget() {
  const location = useLocation();
  const enabled = useGameStore((s) => s.userSettings.assistantEnabled ?? true);
  const managerProfile = useGameStore((s) => s.userSettings.managerProfile);
  const tutorialStep = useGameStore((s) => s.userSettings.tutorialStep);
  const [open, setOpen] = useState(false);

  const hidden = useMemo(
    () => HIDE_ON.some((r) => r.test(location.pathname)),
    [location.pathname],
  );

  const tip = useMemo<Tip>(() => {
    const match = ROUTE_TIPS.find((t) => t.match.test(location.pathname));
    return (
      match?.tip ?? {
        title: 'Dica do assistente',
        body: 'Explora o menu lateral pra descobrir as funcionalidades.',
      }
    );
  }, [location.pathname]);

  // Esconde quando: desligado (user OU admin global), pré-cadastro, em partida, OU tutorial ativo.
  const { flags } = usePlatformConfig();
  if (flags.ASSISTANT_ENABLED === false) return null;
  if (!enabled || !managerProfile || hidden) return null;
  if (typeof tutorialStep === 'number' && tutorialStep >= 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[9997] inline-flex items-center gap-2 rounded-full border border-violet-500/50 bg-violet-950/90 px-3 py-2 text-[11px] font-bold text-violet-100 shadow-xl backdrop-blur transition-colors hover:bg-violet-900/95"
      >
        <Sparkles className="h-4 w-4 text-violet-300" />
        Assistente
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9997] flex justify-center px-3 pb-3 pointer-events-none sm:inset-auto sm:bottom-4 sm:right-4 sm:px-0 sm:pb-0">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-violet-500/50 bg-gradient-to-br from-violet-950/95 via-black/95 to-black/95 p-4 shadow-[0_20px_60px_rgba(139,92,246,0.25)] backdrop-blur">
        <div className="mb-2 flex items-start gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-500/20 text-violet-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-display text-[9px] font-bold uppercase tracking-widest text-violet-300/80">
              Assistente
            </span>
            <h3 className="mt-0.5 text-sm font-black text-white">{tip.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            title="Fechar"
            className="rounded-lg p-1 text-violet-200/60 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[13px] leading-relaxed text-violet-50/90">{tip.body}</p>
      </div>
    </div>
  );
}
