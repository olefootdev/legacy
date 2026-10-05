import { useMemo, useState, useRef, useEffect, type MouseEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles, X, GripVertical } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { usePlatformConfig } from '@/admin/platformConfigStore';
import { L } from '@/i18n/L';

type Tip = { title: string; body: string };

const ROUTE_TIPS: Array<{ match: RegExp; tip: Tip }> = [
  {
    match: /^\/team/,
    tip: {
      title: L('Plantel', 'Squad'),
      body: L('Clica em qualquer jogador pra ver atributos, fadiga e mentorias. Quem estiver com fadiga alta, poupa na próxima.', 'Tap any player to see attributes, fatigue and mentoring. Rest anyone with high fatigue next game.'),
    },
  },
  {
    match: /^\/transfer/,
    tip: {
      title: L('Mercado', 'Market'),
      body: L('Um Legacy DNA no elenco ensina jogadores da mesma posição. Às vezes vale mais que um reforço direto.', 'A Legacy DNA in the squad teaches players in the same position. Sometimes worth more than a direct signing.'),
    },
  },
  {
    match: /^\/wallet/,
    tip: {
      title: L('Wallet', 'Wallet'),
      body: L('OLE é o saldo de jogo. Reserva uma parte pra lesões e renovação de contrato — não gasta tudo em reforços.', 'OLE is your game balance. Keep some for injuries and contract renewals — don’t spend it all on signings.'),
    },
  },
  {
    match: /^\/missions/,
    tip: {
      title: L('Missões', 'Missions'),
      body: L('Missões diárias são a fonte mais estável de OLE e XP. Faz todas antes de dormir.', 'Daily missions are the steadiest source of OLE and XP. Finish them all before bed.'),
    },
  },
  {
    match: /^\/calendar/,
    tip: {
      title: L('Calendário', 'Calendar'),
      body: L('Olha 2-3 jogos à frente pra programar descanso e rotação do plantel.', 'Look 2-3 games ahead to plan rest and squad rotation.'),
    },
  },
  {
    match: /^\/store/,
    tip: {
      title: L('Loja', 'Store'),
      body: L('Boosters pontuais ajudam em partidas decisivas. Pra jogos comuns, poupa.', 'Boosters help in decisive matches. Save them for the big ones.'),
    },
  },
  {
    match: /^\/leagues/,
    tip: {
      title: L('Ligas', 'Leagues'),
      body: L('Liga paga mais que amistoso mas castiga derrotas seguidas com ânimo baixo.', 'Leagues pay more than friendlies but losing streaks hurt morale.'),
    },
  },
  {
    match: /^\/city/,
    tip: {
      title: L('Clube', 'Club'),
      body: L('Infraestrutura multiplica treino e recupera fadiga mais rápido. Investimento de médio prazo.', 'Facilities boost training and speed up fatigue recovery. A mid-term investment.'),
    },
  },
  {
    match: /^\/profile/,
    tip: {
      title: L('Perfil', 'Profile'),
      body: L('Troféus e memoráveis ficam aqui — bom pra rever o progresso quando der frustração.', 'Trophies and memorabilia live here — good for reviewing progress when it gets tough.'),
    },
  },
  {
    match: /^\/how-to-play/,
    tip: {
      title: L('Como jogar', 'How to play'),
      body: L('Os 7 passos abaixo são o básico. Re-lê sempre que o time travar.', 'The 7 steps below are the basics. Re-read them whenever the team stalls.'),
    },
  },
  {
    match: /^\/$/,
    tip: {
      title: L('Home', 'Home'),
      body: L('Daqui vês o próximo jogo e resumos. Bom ponto de partida pra cada sessão.', 'See your next game and recaps from here. A good starting point for each session.'),
    },
  },
];

/** Rotas onde o assistente NÃO aparece (partidas, fluxos imersivos). */
const HIDE_ON = [/^\/match\//, /^\/postgame/, /^\/cadastro/, /^\/admin/, /^\/coach\/chat/];

export function AssistantWidget() {
  const location = useLocation();
  const enabled = useGameStore((s) => s.userSettings.assistantEnabled ?? true);
  const managerProfile = useGameStore((s) => s.userSettings.managerProfile);
  const tutorialStep = useGameStore((s) => s.userSettings.tutorialStep);
  const hasDoneOnboarding = useGameStore((s) => s.userSettings.hasDoneOnboarding ?? false);
  const playersCount = useGameStore((s) => Object.keys(s.players ?? {}).length);
  // Cerimônia de boas-vindas em curso = plantel vazio + onboarding ainda não feito.
  const ceremonyActive = !!managerProfile && !hasDoneOnboarding && playersCount === 0;
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  const hidden = useMemo(
    () => HIDE_ON.some((r) => r.test(location.pathname)),
    [location.pathname],
  );

  const tip = useMemo<Tip>(() => {
    const match = ROUTE_TIPS.find((t) => t.match.test(location.pathname));
    return (
      match?.tip ?? {
        title: L('Dica do assistente', 'Assistant tip'),
        body: L('Explora o menu lateral pra descobrir as funcionalidades.', 'Explore the side menu to discover the features.'),
      }
    );
  }, [location.pathname]);

  // Esconde quando: desligado (user OU admin global), pré-cadastro, em partida, OU tutorial ativo.
  const { flags } = usePlatformConfig();
  const visibilityHidden =
    flags.ASSISTANT_ENABLED === false ||
    !enabled ||
    !managerProfile ||
    hidden ||
    ceremonyActive ||
    (typeof tutorialStep === 'number' && tutorialStep >= 0);

  useEffect(() => {
    if (visibilityHidden) return;
    if (!isDragging) return;
    const onMove = (e: globalThis.MouseEvent) => {
      if (!dragRef.current) return;
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      setPosition({
        x: dragRef.current.initialX + deltaX,
        y: dragRef.current.initialY + deltaY,
      });
    };
    const onUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, visibilityHidden]);

  if (visibilityHidden) return null;

  const handleMouseDown = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-white/16 bg-panel px-3 py-2 text-[11px] font-bold text-white transition-colors hover:border-white/30"
      >
        <Sparkles className="h-4 w-4 text-white" />
        {L('Assistente', 'Assistant')}
      </button>
    );
  }

  return (
    <div
      className="fixed z-40 pointer-events-auto"
      style={{
        bottom: position.y === 0 ? '1rem' : 'auto',
        right: position.x === 0 ? '1rem' : 'auto',
        top: position.y !== 0 ? `calc(50% + ${position.y}px)` : 'auto',
        left: position.x !== 0 ? `calc(50% + ${position.x}px)` : 'auto',
        transform: position.x !== 0 || position.y !== 0 ? 'translate(-50%, -50%)' : 'none',
      }}
    >
      <div className="w-full max-w-[calc(100vw-2rem)] sm:max-w-sm border border-white/16 bg-panel p-3 sm:p-4">
        <div className="mb-2 flex items-start gap-2">
          <button
            type="button"
            onMouseDown={handleMouseDown}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-card-hi text-cimento cursor-move hover:text-white transition-colors"
            title={L('Arrastar', 'Drag')}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-cimento">
              {L('Assistente', 'Assistant')}
            </span>
            <h3 className="mt-0.5 text-sm font-black text-white">{tip.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            title={L('Fechar', 'Close')}
            className="p-1 text-cimento hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[13px] leading-relaxed text-giz">{tip.body}</p>
      </div>
    </div>
  );
}
