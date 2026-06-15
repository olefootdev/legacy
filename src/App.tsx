import { Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { lazyRetry } from '@/lib/lazyRetry';
import { loadAdminPanelSession } from '@/supabase/adminPanelAuth';
const lazy = lazyRetry; // Bug fix: tela preta na 1ª carga (chunk failure após deploy)
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';

/** Sobe ao topo a cada troca de rota — a página abre sempre no hero, nunca no meio.
 *  useLayoutEffect = reset antes do paint (sem flash). Só observa o pathname, então
 *  mudanças de query/hash não resetam. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    // Desliga a restauração automática do navegador (senão reload abre no meio).
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    document.scrollingElement?.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
import { Layout } from './components/Layout';
import { GameProvider } from './game/GameProvider';
import { useGameStore, useGameDispatch } from './game/store';
import { loadGlobalLeagueFromSupabase } from './supabase/globalLeague';
import { subscribeGlobalLeagueChanges } from './supabase/globalLeagueRealtime';
import { GenesisCatalogPortraitsHydrate } from './game/GenesisCatalogPortraitsHydrate';
import { GenesisTestSquadsHydrate } from './game/GenesisTestSquadsHydrate';
import { AnnouncementsHydrate } from './game/AnnouncementsHydrate';
import { OnboardingCeremony } from './onboarding/OnboardingCeremony';
import { ManagerSquadHydrator } from './game/ManagerSquadHydrator';
import { ManagerGameStateHydrator } from './game/ManagerGameStateHydrator';
import { OlefootPythonModeHydrator } from './game/OlefootPythonModeHydrator';
import { PersistenceGuard } from './game/PersistenceGuard';
import { PlatformDataHydrator } from './game/PlatformDataHydrator';
import { WorldClock } from './game/WorldClock';
import { UserSettingsEffects } from './components/UserSettingsEffects';
import { FriendlyChallengeLayer } from './components/FriendlyChallengeLayer';
import { isDevRegistrationBypassed } from './lib/devRegistrationBypass';
import { useGlobalRoundScheduler } from './hooks/useGlobalRoundScheduler';
import { useGlobalPlayoffScheduler } from './hooks/useGlobalPlayoffScheduler';
import { useAutoRegisterGlobalLeague } from './hooks/useAutoRegisterGlobalLeague';
import { useGlobalLeagueMilestoneRewards } from './hooks/useGlobalLeagueMilestoneRewards';
import { useGlobalLeagueCrowdSync } from './hooks/useGlobalLeagueCrowdSync';
import { useGlobalConsequencesSync } from './hooks/useGlobalConsequencesSync';
import { EmergencyTransferWindow } from './components/EmergencyTransferWindow';
import { useRecoverOrphanManager } from './onboarding/recoverOrphanManager';
import { getSupabase, isSupabaseConfigured } from './supabase/client';

/**
 * SessionGuard — verifica no boot se há sessão válida no Supabase atual.
 * Se o manager tem save local mas não tem sessão no banco atual (ex: migração
 * de banco), limpa o save local e redireciona para /login.
 * Não age em rotas públicas (/login, /cadastro) para evitar loops.
 */
function SessionGuard() {
  useEffect(() => {
    // Não age em rotas públicas
    const path = window.location.pathname;
    if (
      path === '/login' ||
      path === '/cadastro' ||
      path.startsWith('/cadastro/') ||
      path.startsWith('/admin') ||
      path === '/reset-password'
    )
      return;

    // Só age se houver save local — sem save não há nada a limpar
    const hasSave = Object.keys(localStorage).some(k => k.startsWith('olefoot'));
    if (!hasSave) return;

    if (!isSupabaseConfigured()) return;
    const sb = getSupabase();
    if (!sb) return;

    void sb.auth.getSession().then(({ data }) => {
      if (!data.session) {
        // Sem sessão válida — limpa save e vai para login
        try {
          Object.keys(localStorage)
            .filter(k => k.startsWith('olefoot'))
            .forEach(k => localStorage.removeItem(k));
        } catch { /* noop */ }
        window.location.href = '/login';
      }
    });
  }, []);
  return null;
}

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const ClubHub = lazy(() => import('./pages/ClubHub').then((m) => ({ default: m.ClubHub })));
const CompetitionHub = lazy(() => import('./pages/CompetitionHub').then((m) => ({ default: m.CompetitionHub })));
const MarketHub = lazy(() => import('./pages/MarketHub').then((m) => ({ default: m.MarketHub })));
const HelpHub = lazy(() => import('./pages/HelpHub').then((m) => ({ default: m.HelpHub })));
const Legend = lazy(() => import('./pages/Legend').then((m) => ({ default: m.Legend })));
const DesignSystemShowcase = lazy(() =>
  import('./pages/DesignSystemShowcase').then((m) => ({ default: m.DesignSystemShowcase })),
);
const MatchdayPreview = lazy(() => import('./pages/MatchdayPreview').then((m) => ({ default: m.MatchdayPreview })));
const PenaltyPreview = lazy(() => import('./pages/PenaltyPreview').then((m) => ({ default: m.PenaltyPreview })));
const SetPiecePreview = lazy(() => import('./pages/SetPiecePreview').then((m) => ({ default: m.SetPiecePreview })));
const LegacyCardPreview = lazy(() => import('./pages/LegacyCardPreview').then((m) => ({ default: m.LegacyCardPreview })));
const CeremonyPreview = lazy(() => import('./pages/CeremonyPreview').then((m) => ({ default: m.CeremonyPreview })));
const FieldViewPreview = lazy(() => import('./pages/FieldViewPreview').then((m) => ({ default: m.FieldViewPreview })));
const AgentsDebugLog = lazy(() => import('./pages/AgentsDebugLog').then((m) => ({ default: m.AgentsDebugLog })));
const AgentsFieldView = lazy(() => import('./pages/AgentsFieldView').then((m) => ({ default: m.AgentsFieldView })));
const OleFieldLab = lazy(() => import('./pages/OleFieldLab').then((m) => ({ default: m.OleFieldLab })));
const OleFieldLabLegacy = lazy(() => import('./pages/OleFieldLabLegacy').then((m) => ({ default: m.OleFieldLabLegacy })));
const OleFieldLabAerea = lazy(() => import('./pages/OleFieldLabAerea').then((m) => ({ default: m.OleFieldLabAerea })));
const Team = lazy(() => import('./pages/Team').then((m) => ({ default: m.Team })));
const TeamTraining = lazy(() => import('./pages/TeamTraining').then((m) => ({ default: m.TeamTraining })));
const TeamStaff = lazy(() => import('./pages/TeamStaff').then((m) => ({ default: m.TeamStaff })));
const TeamAiLabs = lazy(() => import('./pages/TeamAiLabs').then((m) => ({ default: m.TeamAiLabs })));
const CoachChat = lazy(() => import('./pages/CoachChat').then((m) => ({ default: m.CoachChat })));
const YouthProspects = lazy(() => import('./pages/YouthProspects').then((m) => ({ default: m.YouthProspects })));
const City = lazy(() => import('./pages/City').then((m) => ({ default: m.City })));
const Transfer = lazy(() => import('./pages/Transfer').then((m) => ({ default: m.Transfer })));
const TransferExchange = lazy(() =>
  import('./pages/TransferExchange').then((m) => ({ default: m.TransferExchange })),
);
const LiveAuctionsPage = lazy(() =>
  import('./pages/LiveAuctionsPage').then((m) => ({ default: m.LiveAuctionsPage })),
);
const Store = lazy(() => import('./pages/Store').then((m) => ({ default: m.Store })));
const Wallet = lazy(() => import('./pages/Wallet').then((m) => ({ default: m.Wallet })));
const OlexpTab = lazy(() => import('./pages/wallet/OlexpTab').then((m) => ({ default: m.OlexpTab })));
const ReferralTab = lazy(() => import('./pages/wallet/ReferralTab').then((m) => ({ default: m.ReferralTab })));
const GatTab = lazy(() => import('./pages/wallet/GatTab').then((m) => ({ default: m.GatTab })));
const ExtractTab = lazy(() => import('./pages/wallet/ExtractTab').then((m) => ({ default: m.ExtractTab })));
const LiveMatch = lazy(() => import('./pages/LiveMatch').then((m) => ({ default: m.LiveMatch })));
const MatchClassic = lazy(() => import('./pages/MatchClassic').then((m) => ({ default: m.MatchClassic })));
const MatchAuto = lazy(() => import('./pages/MatchAuto').then((m) => ({ default: m.MatchAuto })));
const MatchQuick = lazy(() => import('./pages/MatchQuick').then((m) => ({ default: m.MatchQuick })));
const QuickPlanPreview = lazy(() => import('./pages/QuickPlanPreview').then((m) => ({ default: m.default })));
const MatchPenalty = lazy(() => import('./pages/MatchPenalty').then((m) => ({ default: m.MatchPenalty })));
const MatchPenaltyV2 = lazy(() => import('./pages/MatchPenaltyV2').then((m) => ({ default: m.MatchPenaltyV2 })));
const LigaOle = lazy(() => import('./pages/LigaOle').then((m) => ({ default: m.LigaOle })));
const MatchGlobal = lazy(() => import('./pages/MatchGlobal').then((m) => ({ default: m.default })));
const MatchGlobalSetup = lazy(() => import('./pages/MatchGlobalSetup').then((m) => ({ default: m.default })));
const GlobalLeagueHistory = lazy(() => import('./pages/GlobalLeagueHistory').then((m) => ({ default: m.default })));
const GlobalLeagueClubProfile = lazy(() => import('./pages/GlobalLeagueClubProfile').then((m) => ({ default: m.default })));
const GlobalLeagueAllTime = lazy(() => import('./pages/GlobalLeagueAllTime').then((m) => ({ default: m.default })));
const LocalLeagues = lazy(() => import('./pages/LocalLeagues').then((m) => ({ default: m.default })));
const OlefootRanked = lazy(() => import('./pages/OlefootRanked').then((m) => ({ default: m.default })));
const GlobalLeagueRegistration = lazy(() => import('./pages/GlobalLeagueRegistration').then((m) => ({ default: m.default })));
const GlobalLeaguePlayoffs = lazy(() => import('./pages/GlobalLeaguePlayoffs').then((m) => ({ default: m.default })));
const GlobalLeagueDaily = lazy(() => import('./pages/GlobalLeagueDaily').then((m) => ({ default: m.default })));
const GlobalLeagueCrowns = lazy(() => import('./pages/GlobalLeagueCrowns').then((m) => ({ default: m.default })));
const Postgame = lazy(() => import('./pages/Postgame').then((m) => ({ default: m.default })));
const Missions = lazy(() => import('./pages/Missions').then((m) => ({ default: m.Missions })));
const CalendarPage = lazy(() => import('./pages/Calendar').then((m) => ({ default: m.Calendar })));
const Leagues = lazy(() => import('./pages/Leagues').then((m) => ({ default: m.Leagues })));
const PremiumLeagues = lazy(() => import('./pages/PremiumLeagues').then((m) => ({ default: m.PremiumLeagues })));
const Manager = lazy(() => import('./pages/Manager').then((m) => ({ default: m.Manager })));
const ManagerPro = lazy(() => import('./pages/ManagerPro').then((m) => ({ default: m.ManagerPro })));
const ManagerMessages = lazy(() => import('./pages/ManagerMessages').then((m) => ({ default: m.ManagerMessages })));
const ManagerNetwork = lazy(() => import('./pages/ManagerNetwork').then((m) => ({ default: m.ManagerNetwork })));
const ManagerCareer = lazy(() => import('./pages/ManagerCareer').then((m) => ({ default: m.ManagerCareer })));
const ManagerScouts = lazy(() => import('./pages/ManagerScouts').then((m) => ({ default: m.ManagerScouts })));
const ManagerScoutsPlayer = lazy(() => import('./pages/ManagerScoutsPlayer').then((m) => ({ default: m.ManagerScoutsPlayer })));
const Config = lazy(() => import('./pages/Config').then((m) => ({ default: m.Config })));
const HowToPlay = lazy(() => import('./pages/HowToPlay').then((m) => ({ default: m.HowToPlay })));
const RankingFull = lazy(() => import('./pages/RankingFull').then((m) => ({ default: m.RankingFull })));
const PvpStandings = lazy(() => import('./pages/PvpStandings').then((m) => ({ default: m.PvpStandings })));
const AdminDashboard = lazy(() =>
  import('./admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })),
);
const AdminTestesHub = lazy(() =>
  import('./admin/AdminTestesHub').then((m) => ({ default: m.AdminTestesHub })),
);
const AdminBetaTesters = lazy(() =>
  import('./admin/AdminBetaTesters').then((m) => ({ default: m.AdminBetaTesters })),
);
const RedeemInvite = lazy(() =>
  import('./pages/RedeemInvite').then((m) => ({ default: m.RedeemInvite })),
);
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Cadastro = lazy(() => import('./pages/Cadastro').then((m) => ({ default: m.Cadastro })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then((m) => ({ default: m.ResetPassword })));
const AdminLogin = lazy(() => import('./pages/AdminLogin').then((m) => ({ default: m.AdminLogin })));
const ReferralLanding = lazy(() => import('./pages/ReferralLanding').then((m) => ({ default: m.ReferralLanding })));

function RequireAdmin() {
  const [isValid, setIsValid] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const session = await loadAdminPanelSession();
      setIsValid(session !== null);
    };
    void checkSession();
  }, []);

  if (isValid === null) {
    return <RouteFallback />;
  }

  if (!isValid) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}

function RequireRegistration() {
  const hasProfile = useGameStore((s) => !!s.userSettings?.managerProfile);
  const hasSquad = useGameStore((s) => Object.keys(s.players ?? {}).length > 0);
  const managerEmail = useGameStore((s) => s.userSettings?.managerProfile?.email);
  const dispatch = useGameDispatch();

  // OLEFOOT PYTHON MODE — registra presença + tick de consequências expiradas
  useEffect(() => {
    if (!managerEmail) return;
    dispatch({ type: 'RECORD_CHECK_IN', managerId: managerEmail });
    dispatch({ type: 'TICK_CONSEQUENCES' });
  }, [managerEmail, dispatch]);

  const registered = isDevRegistrationBypassed() || hasProfile;
  if (!registered) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/**
 * [2026-05-18] Guard relaxado.
 *
 * Antes redirecionava TODA rota interna pra `/` quando `players === {}`.
 * Problema: enquanto a hidratação do Supabase manager_squad ainda não
 * chegou, o user clicava em qualquer botão do menu e VOLTAVA pra Home
 * silenciosamente — parecia que "nada funcionava".
 *
 * Agora só bloqueia se o manager NÃO TIVER perfil (ou seja, usuário
 * realmente não-logado). Páginas internas já tratam empty squad
 * defensivamente (mostram estado vazio + CTA pra completar cerimônia).
 */
function RequireSquad() {
  const hasProfile = useGameStore((s) => !!s.userSettings?.managerProfile);
  if (!hasProfile && !isDevRegistrationBypassed()) return <Navigate to="/" replace />;
  return <Outlet />;
}

function RedirectIfRegistered() {
  /** Só perfil real — em dev o bypass atua só em `RequireRegistration`, para `/login` e `/cadastro` continuarem testáveis. */
  const registered = useGameStore((s) => !!s.userSettings?.managerProfile);
  if (registered) return <Navigate to="/" replace />;
  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
    </Suspense>
  );
}

function GameShell() {
  return (
    <Layout>
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
}

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-white/60">
      Carregando…
    </div>
  );
}

function MatchQuickErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  console.error('MatchQuick Error:', error);
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="font-display text-sm font-bold uppercase tracking-wider text-red-500">Erro na Partida Rápida</p>
      <pre className="max-w-2xl overflow-auto rounded bg-black/50 p-4 text-left text-xs text-white/80">
        {error.message}
        {'\n\n'}
        {error.stack}
      </pre>
      <button
        onClick={resetErrorBoundary}
        className="mt-4 rounded bg-neon-yellow px-6 py-2 font-display text-xs font-bold uppercase tracking-wider text-black hover:bg-white transition-colors"
      >
        Tentar novamente
      </button>
      <a
        href="/"
        className="text-sm text-white/60 hover:text-neon-yellow transition-colors"
      >
        ← Voltar para Home
      </a>
    </div>
  );
}

function GlobalSchedulerMount() {
  useGlobalRoundScheduler();
  useGlobalPlayoffScheduler();
  useAutoRegisterGlobalLeague();
  useGlobalLeagueMilestoneRewards();
  useGlobalLeagueCrowdSync();
  useGlobalConsequencesSync();
  useRecoverOrphanManager();
  return null;
}

/**
 * Bug fix: tela preta na 1ª carga.
 * Boundary raiz pra capturar qualquer erro não tratado (ChunkLoadError,
 * ReferenceError em hot path, etc.). Mostra mensagem visível com botão
 * "Recarregar" — substitui o branco/preto que o React produz quando a
 * árvore desmonta sem fallback.
 */
function RootErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  console.error('[RootErrorBoundary]', error);
  const isChunkErr =
    /Failed to fetch dynamically imported module/i.test(error.message)
    || /Loading chunk/i.test(error.message)
    || /ChunkLoadError/i.test(error.message)
    || error.name === 'ChunkLoadError';
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 px-6 text-center"
      style={{ background: 'var(--color-deep-black, #0D0D0D)' }}
    >
      <div
        className="font-display font-black uppercase"
        style={{ color: 'var(--color-neon-yellow, #FDE100)', fontSize: 'clamp(24px, 5vw, 36px)', letterSpacing: '0.04em' }}
      >
        {isChunkErr ? 'Atualizando o jogo' : 'Algo deu errado'}
      </div>
      <p
        className="max-w-md leading-relaxed"
        style={{ color: 'rgba(255,255,255,0.72)', fontFamily: 'var(--font-ui)', fontSize: '14px' }}
      >
        {isChunkErr
          ? 'Estamos a carregar a versão mais recente. Recarrega a página pra continuar.'
          : 'Recarrega a página. Se persistir, contacta o suporte.'}
      </p>
      <button
        type="button"
        onClick={() => {
          resetErrorBoundary();
          if (typeof window !== 'undefined') window.location.reload();
        }}
        className="-skew-x-6 px-7 py-3 font-display font-black uppercase tracking-[0.18em] transition-all"
        style={{
          background: 'var(--color-neon-yellow, #FDE100)',
          color: '#000',
          fontSize: '14px',
          boxShadow: '4px 4px 0 rgba(255,255,255,0.16)',
        }}
      >
        <span className="skew-x-6 inline-block">Recarregar</span>
      </button>
      {!isChunkErr && (
        <details className="mt-3 max-w-md text-left" style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px' }}>
          <summary className="cursor-pointer">Detalhes técnicos</summary>
          <pre className="mt-2 overflow-auto rounded bg-black/40 p-3 text-[10px]">{error.message}</pre>
        </details>
      )}
    </div>
  );
}

function GlobalLeagueHydrator() {
  const dispatch = useGameDispatch();
  useEffect(() => {
    let cancelled = false;

    const rehydrate = async () => {
      const remote = await loadGlobalLeagueFromSupabase();
      if (cancelled || !remote) return;
      dispatch({ type: 'HYDRATE_GLOBAL_LEAGUE_MVP', payload: remote });
    };

    void rehydrate();
    const unsubscribe = subscribeGlobalLeagueChanges(() => {
      void rehydrate();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [dispatch]);
  return null;
}

export default function App() {
  useEffect(() => {
    console.log(`
%c🚀 Hey Hacker 👋
%c
I know you understand much more than me about game development.
If you find this message, it's because I'm not an expert — just one
football lover trying to launch a game to back us to the best
moment of our lives.

Please, contact me to share vulnerabilities.
We are open and truly believe in the power of community.

I created this game by myself using AI tools just to share my IDEA
as a nice MVP. Let's Play Together! ⚽

📧 Contact: exp@olefoot.com
    `, 'font-size: 16px; font-weight: bold; color: #00ff00;', 'color: #00ff00;');
  }, []);

  return (
    <ErrorBoundary FallbackComponent={RootErrorFallback}>
      <GameProvider>
        <Router>
        <SessionGuard />
        <FriendlyChallengeLayer />
        <UserSettingsEffects />
        <WorldClock />
        <GlobalLeagueHydrator />
        <GlobalSchedulerMount />
        <OnboardingCeremony />
        <ManagerSquadHydrator />
        <ManagerGameStateHydrator />
        <OlefootPythonModeHydrator />
        <PersistenceGuard />
        <PlatformDataHydrator />
        <GenesisCatalogPortraitsHydrate />
        <GenesisTestSquadsHydrate />
        <AnnouncementsHydrate />
        <EmergencyTransferWindow />
        <ScrollToTop />
        <Routes>
          <Route
            path="/admin/login"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AdminLogin />
              </Suspense>
            }
          />
          <Route
            path="/design-system"
            element={
              <Suspense fallback={<RouteFallback />}>
                <DesignSystemShowcase />
              </Suspense>
            }
          />
          <Route element={<RequireAdmin />}>
            <Route
              path="/admin"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <AdminDashboard />
                </Suspense>
              }
            />
            <Route
              path="/admin/testes"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <AdminTestesHub />
                </Suspense>
              }
            />
            <Route
              path="/admin/beta-testers"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <AdminBetaTesters />
                </Suspense>
              }
            />
          </Route>
          <Route
            path="/redeem"
            element={
              <Suspense fallback={<RouteFallback />}>
                <RedeemInvite />
              </Suspense>
            }
          />
          <Route element={<RedirectIfRegistered />}>
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/cadastro/:inviteCode" element={<Cadastro />} />
          </Route>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<RequireRegistration />}>
            <Route element={<GameShell />}>
              <Route path="/" element={<Home />} />

            <Route element={<RequireSquad />}>
            {/* Hub pages */}
            <Route path="/clube" element={<ClubHub />} />
            <Route path="/competicao" element={<CompetitionHub />} />
            <Route path="/mercado" element={<MarketHub />} />
            <Route path="/ajuda" element={<HelpHub />} />

            {/* Clube subpages */}
            <Route path="/clube/elenco" element={<Team />} />
            <Route path="/clube/treino" element={<TeamTraining />} />
            <Route path="/clube/staff" element={<TeamStaff />} />
            <Route path="/coach/chat" element={<CoachChat />} />
            <Route path="/clube/academia" element={<YouthProspects />} />
            <Route path="/clube/estruturas" element={<City />} />
            <Route path="/clube/ailabs" element={<TeamAiLabs />} />

            {/* Competição subpages */}
            <Route path="/competicao/ligas" element={<Leagues />} />
            <Route path="/rewards" element={<PremiumLeagues />} />
            <Route path="/rewards/:leagueSlug" element={<PremiumLeagues />} />
            <Route path="/premiadas" element={<Navigate to="/rewards" replace />} />
            <Route path="/competicao/calendario" element={<CalendarPage />} />
            <Route path="/competicao/ranking" element={<RankingFull />} />
            <Route path="/competicao/standings" element={<PvpStandings />} />

            {/* Mercado subpages */}
            <Route path="/mercado/transfer" element={<Transfer />} />
            <Route path="/mercado/exchange" element={<TransferExchange />} />
            <Route path="/mercado/leiloes" element={<LiveAuctionsPage />} />
            <Route path="/mercado/loja" element={<Store />} />

            {/* Manager subpages */}
            <Route path="/manager" element={<Manager />} />
            <Route path="/manager/mensagens" element={<ManagerMessages />} />
            <Route path="/manager/network" element={<ManagerNetwork />} />
            <Route path="/manager/career" element={<ManagerCareer />} />
            <Route path="/manager/scouts" element={<ManagerScouts />} />
            <Route path="/manager/scouts/player/:playerId" element={<ManagerScoutsPlayer />} />
            <Route path="/manager/pro" element={<ManagerPro />} />
            <Route path="/manager/missoes" element={<Missions />} />
            <Route path="/manager/config" element={<Config />} />

            {/* Ajuda subpages */}
            <Route path="/ajuda/como-jogar" element={<HowToPlay />} />

            {/* Wallet (mantém estrutura atual) */}
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/wallet/olexp" element={<OlexpTab />} />
            <Route path="/wallet/referrals" element={<ReferralTab />} />
            <Route path="/wallet/gat" element={<GatTab />} />
            <Route path="/wallet/extract" element={<ExtractTab />} />

            {/* Redirects - URLs antigas → novas */}
            <Route path="/team" element={<Navigate to="/clube/elenco" replace />} />
            <Route path="/team/tatica" element={<Navigate to="/clube/elenco" replace />} />
            <Route path="/team/treino" element={<Navigate to="/clube/treino" replace />} />
            <Route path="/team/staff" element={<Navigate to="/clube/staff" replace />} />
            <Route path="/team/ailabs" element={<Navigate to="/clube/ailabs" replace />} />
            <Route path="/city" element={<Navigate to="/clube/estruturas" replace />} />
            <Route path="/city/youth-prospects" element={<Navigate to="/clube/academia" replace />} />
            <Route path="/transfer" element={<Navigate to="/mercado/transfer" replace />} />
            <Route path="/transfer/exchange" element={<Navigate to="/mercado/exchange" replace />} />
            <Route path="/store" element={<Navigate to="/mercado/loja" replace />} />
            <Route path="/leagues" element={<Navigate to="/competicao/ligas" replace />} />
            <Route path="/calendar" element={<Navigate to="/competicao/calendario" replace />} />
            <Route path="/ranking" element={<Navigate to="/competicao/ranking" replace />} />
            <Route path="/missions" element={<Navigate to="/manager/missoes" replace />} />
            <Route path="/config" element={<Navigate to="/manager/config" replace />} />
            <Route path="/how-to-play" element={<Navigate to="/ajuda/como-jogar" replace />} />
            <Route path="/profile" element={<Navigate to="/manager" replace />} />

            {/* Match pages (mantém estrutura atual) */}
            <Route path="/legend/:id" element={<Legend />} />
            <Route path="/legend" element={<Legend />} />
            <Route path="/matchday/preview" element={<MatchdayPreview />} />
            <Route path="/dev/penalty-preview" element={<PenaltyPreview />} />
            <Route path="/dev/setpiece-preview" element={<SetPiecePreview />} />
            <Route path="/dev/legacy-card" element={<LegacyCardPreview />} />
            <Route path="/dev/ceremony-preview" element={<CeremonyPreview />} />
            <Route path="/dev/field-view" element={<FieldViewPreview />} />
            <Route path="/dev/agents-field" element={<AgentsFieldView />} />
            <Route
              path="/dev/agents-debug"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <AgentsDebugLog />
                </Suspense>
              }
            />
            <Route path="/match/legacy" element={<FieldViewPreview />} />
            <Route path="/match" element={<LiveMatch />} />
            <Route path="/match/auto" element={<MatchAuto />} />
            <Route
              path="/match/quick"
              element={
                <ErrorBoundary
                  FallbackComponent={MatchQuickErrorFallback}
                  onReset={() => window.location.href = '/match/quick'}
                >
                  <MatchQuick />
                </ErrorBoundary>
              }
            />
            <Route path="/match/quick-plan-preview" element={<QuickPlanPreview />} />
            <Route path="/liga-ole" element={<LigaOle />} />
            <Route path="/match/penalty" element={<MatchPenaltyV2 />} />
            <Route path="/match/penalty-legacy" element={<MatchPenalty />} />
            <Route path="/match/penalty-v2" element={<Navigate to="/match/penalty" replace />} />
            <Route path="/match/global" element={<MatchGlobal />} />
            <Route path="/match/global/setup" element={<MatchGlobalSetup />} />
            <Route path="/match/global/history" element={<GlobalLeagueHistory />} />
            <Route path="/match/global/all-time" element={<GlobalLeagueAllTime />} />
            <Route path="/ligas-locais" element={<LocalLeagues />} />
            <Route path="/match/global/club/:teamId" element={<GlobalLeagueClubProfile />} />
            {/* OLEFOOT LIGA mockada (Flamengo/Palmeiras/...) deletada em 2026-05-18 — manter apenas Liga Global com managers reais. Redireciona pra /match/global. */}
            <Route path="/match/olefoot-liga" element={<Navigate to="/match/global" replace />} />
            <Route path="/olefoot/ranked" element={<OlefootRanked />} />
            <Route path="/liga-global/registro" element={<GlobalLeagueRegistration />} />
            <Route path="/liga-global/playoffs" element={<GlobalLeaguePlayoffs />} />
            <Route path="/liga-global/hoje" element={<GlobalLeagueDaily />} />
            <Route path="/liga-global/coroas" element={<GlobalLeagueCrowns />} />
            <Route path="/postgame" element={<Postgame />} />
            </Route>{/* /RequireSquad */}
            </Route>{/* /GameShell */}
            {/* Fullscreen match modes — sem GameShell (sem nav global) */}
            <Route path="/match/classic" element={<MatchClassic />} />
          </Route>
          <Route
            path="/dev/field-lab"
            element={
              <Suspense fallback={<RouteFallback />}>
                <OleFieldLab />
              </Suspense>
            }
          />
          <Route
            path="/dev/field-lab/legacy"
            element={
              <Suspense fallback={<RouteFallback />}>
                <OleFieldLabLegacy />
              </Suspense>
            }
          />
          <Route
            path="/dev/field-lab/aerea"
            element={
              <Suspense fallback={<RouteFallback />}>
                <OleFieldLabAerea />
              </Suspense>
            }
          />
          <Route
            path="/:inviteCode"
            element={
              <Suspense fallback={<RouteFallback />}>
                <ReferralLanding />
              </Suspense>
            }
          />
        </Routes>
        </Router>
      </GameProvider>
    </ErrorBoundary>
  );
}
