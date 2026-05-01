import { Suspense, useEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { lazyRetry } from '@/lib/lazyRetry';
import { loadAdminPanelSession } from '@/supabase/adminPanelAuth';
const lazy = lazyRetry; // Bug fix: tela preta na 1ª carga (chunk failure após deploy)
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
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
import { WorldClock } from './game/WorldClock';
import { UserSettingsEffects } from './components/UserSettingsEffects';
import { FriendlyChallengeLayer } from './components/FriendlyChallengeLayer';
import { isDevRegistrationBypassed } from './lib/devRegistrationBypass';
import { useGlobalRoundScheduler } from './hooks/useGlobalRoundScheduler';

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
const MatchLive = lazy(() => import('./pages/MatchLive').then((m) => ({ default: m.MatchLive })));
const MatchAuto = lazy(() => import('./pages/MatchAuto').then((m) => ({ default: m.MatchAuto })));
const MatchQuick = lazy(() => import('./pages/MatchQuick').then((m) => ({ default: m.MatchQuick })));
const MatchPenalty = lazy(() => import('./pages/MatchPenalty').then((m) => ({ default: m.MatchPenalty })));
const MatchPenaltyV2 = lazy(() => import('./pages/MatchPenaltyV2').then((m) => ({ default: m.MatchPenaltyV2 })));
const MatchGlobal = lazy(() => import('./pages/MatchGlobal').then((m) => ({ default: m.default })));
const MatchGlobalSetup = lazy(() => import('./pages/MatchGlobalSetup').then((m) => ({ default: m.default })));
const OlefootLeague = lazy(() => import('./pages/OlefootLeague').then((m) => ({ default: m.default })));
const OlefootRanked = lazy(() => import('./pages/OlefootRanked').then((m) => ({ default: m.default })));
const GlobalLeagueRegistration = lazy(() => import('./pages/GlobalLeagueRegistration').then((m) => ({ default: m.default })));
const GlobalLeaguePlayoffs = lazy(() => import('./pages/GlobalLeaguePlayoffs').then((m) => ({ default: m.default })));
const Postgame = lazy(() => import('./pages/Postgame').then((m) => ({ default: m.default })));
const Missions = lazy(() => import('./pages/Missions').then((m) => ({ default: m.Missions })));
const CalendarPage = lazy(() => import('./pages/Calendar').then((m) => ({ default: m.Calendar })));
const Leagues = lazy(() => import('./pages/Leagues').then((m) => ({ default: m.Leagues })));
const Manager = lazy(() => import('./pages/Manager').then((m) => ({ default: m.Manager })));
const ManagerPro = lazy(() => import('./pages/ManagerPro').then((m) => ({ default: m.ManagerPro })));
const ManagerMessages = lazy(() => import('./pages/ManagerMessages').then((m) => ({ default: m.ManagerMessages })));
const ManagerNetwork = lazy(() => import('./pages/ManagerNetwork').then((m) => ({ default: m.ManagerNetwork })));
const Config = lazy(() => import('./pages/Config').then((m) => ({ default: m.Config })));
const HowToPlay = lazy(() => import('./pages/HowToPlay').then((m) => ({ default: m.HowToPlay })));
const RankingFull = lazy(() => import('./pages/RankingFull').then((m) => ({ default: m.RankingFull })));
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
  const registered = isDevRegistrationBypassed() || hasProfile;
  if (!registered) return <Navigate to="/login" replace />;
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
  return (
    <ErrorBoundary FallbackComponent={RootErrorFallback}>
      <GameProvider>
        <Router>
        <FriendlyChallengeLayer />
        <UserSettingsEffects />
        <WorldClock />
        <GlobalLeagueHydrator />
        <GlobalSchedulerMount />
        <OnboardingCeremony />
        <ManagerSquadHydrator />
        <GenesisCatalogPortraitsHydrate />
        <GenesisTestSquadsHydrate />
        <AnnouncementsHydrate />
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
          </Route>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<RequireRegistration />}>
            <Route element={<GameShell />}>
              <Route path="/" element={<Home />} />

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
            <Route path="/competicao/calendario" element={<CalendarPage />} />
            <Route path="/competicao/ranking" element={<RankingFull />} />

            {/* Mercado subpages */}
            <Route path="/mercado/transfer" element={<Transfer />} />
            <Route path="/mercado/exchange" element={<TransferExchange />} />
            <Route path="/mercado/leiloes" element={<LiveAuctionsPage />} />
            <Route path="/mercado/loja" element={<Store />} />

            {/* Manager subpages */}
            <Route path="/manager" element={<Manager />} />
            <Route path="/manager/mensagens" element={<ManagerMessages />} />
            <Route path="/manager/network" element={<ManagerNetwork />} />
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
            <Route path="/match/legacy" element={<FieldViewPreview />} />
            <Route path="/match/live" element={<MatchLive />} />
            <Route path="/match" element={<LiveMatch />} />
            <Route path="/match/test2d" element={<Navigate to="/match/live" replace />} />
            <Route path="/match/ultralive2d" element={<Navigate to="/match/live" replace />} />
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
            <Route path="/match/penalty" element={<MatchPenaltyV2 />} />
            <Route path="/match/penalty-legacy" element={<MatchPenalty />} />
            <Route path="/match/penalty-v2" element={<Navigate to="/match/penalty" replace />} />
            <Route path="/match/global" element={<MatchGlobal />} />
            <Route path="/match/global/setup" element={<MatchGlobalSetup />} />
            <Route path="/match/olefoot-liga" element={<OlefootLeague />} />
            <Route path="/olefoot/ranked" element={<OlefootRanked />} />
            <Route path="/liga-global/registro" element={<GlobalLeagueRegistration />} />
            <Route path="/liga-global/playoffs" element={<GlobalLeaguePlayoffs />} />
            <Route path="/postgame" element={<Postgame />} />
            </Route>
          </Route>
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
