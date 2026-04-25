import { lazy, Suspense } from 'react';
import { isAdminPanelSessionValid } from '@/supabase/adminPanelAuth';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Layout } from './components/Layout';
import { GameProvider } from './game/GameProvider';
import { useGameStore } from './game/store';
import { GenesisCatalogPortraitsHydrate } from './game/GenesisCatalogPortraitsHydrate';
import { GenesisTestSquadsHydrate } from './game/GenesisTestSquadsHydrate';
import { WelcomeGenesisPackHydrate } from './game/WelcomeGenesisPackHydrate';
import { WorldClock } from './game/WorldClock';
import { UserSettingsEffects } from './components/UserSettingsEffects';
import { FriendlyChallengeLayer } from './components/FriendlyChallengeLayer';
import { isDevRegistrationBypassed } from './lib/devRegistrationBypass';

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Legend = lazy(() => import('./pages/Legend').then((m) => ({ default: m.Legend })));
const MatchdayPreview = lazy(() => import('./pages/MatchdayPreview').then((m) => ({ default: m.MatchdayPreview })));
const Team = lazy(() => import('./pages/Team').then((m) => ({ default: m.Team })));
const TeamTraining = lazy(() => import('./pages/TeamTraining').then((m) => ({ default: m.TeamTraining })));
const TeamEvolutionLine = lazy(() =>
  import('./pages/TeamEvolutionLine').then((m) => ({ default: m.TeamEvolutionLine })),
);
const TeamStaff = lazy(() => import('./pages/TeamStaff').then((m) => ({ default: m.TeamStaff })));
const TeamAiLabs = lazy(() => import('./pages/TeamAiLabs').then((m) => ({ default: m.TeamAiLabs })));
const YouthProspects = lazy(() => import('./pages/YouthProspects').then((m) => ({ default: m.YouthProspects })));
const City = lazy(() => import('./pages/City').then((m) => ({ default: m.City })));
const Transfer = lazy(() => import('./pages/Transfer').then((m) => ({ default: m.Transfer })));
const TransferExchange = lazy(() =>
  import('./pages/TransferExchange').then((m) => ({ default: m.TransferExchange })),
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
const Postgame = lazy(() => import('./pages/Postgame').then((m) => ({ default: m.default })));
const Missions = lazy(() => import('./pages/Missions').then((m) => ({ default: m.Missions })));
const CalendarPage = lazy(() => import('./pages/Calendar').then((m) => ({ default: m.Calendar })));
const Leagues = lazy(() => import('./pages/Leagues').then((m) => ({ default: m.Leagues })));
const Manager = lazy(() => import('./pages/Manager').then((m) => ({ default: m.Manager })));
const ManagerPro = lazy(() => import('./pages/ManagerPro').then((m) => ({ default: m.ManagerPro })));
const Config = lazy(() => import('./pages/Config').then((m) => ({ default: m.Config })));
const HowToPlay = lazy(() => import('./pages/HowToPlay').then((m) => ({ default: m.HowToPlay })));
const RankingFull = lazy(() => import('./pages/RankingFull').then((m) => ({ default: m.RankingFull })));
const AdminDashboard = lazy(() =>
  import('./admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })),
);
const AdminTestesHub = lazy(() =>
  import('./admin/AdminTestesHub').then((m) => ({ default: m.AdminTestesHub })),
);
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Cadastro = lazy(() => import('./pages/Cadastro').then((m) => ({ default: m.Cadastro })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then((m) => ({ default: m.ResetPassword })));
const AdminLogin = lazy(() => import('./pages/AdminLogin').then((m) => ({ default: m.AdminLogin })));
const ReferralLanding = lazy(() => import('./pages/ReferralLanding').then((m) => ({ default: m.ReferralLanding })));

function RequireAdmin() {
  // Sessão do painel é independente do auth do jogo — separar intencionalmente.
  if (!isAdminPanelSessionValid()) return <Navigate to="/admin/login" replace />;
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

export default function App() {
  return (
    <GameProvider>
      <Router>
        <FriendlyChallengeLayer />
        <UserSettingsEffects />
        <WorldClock />
        <WelcomeGenesisPackHydrate />
        <GenesisCatalogPortraitsHydrate />
        <GenesisTestSquadsHydrate />
        <Routes>
          <Route
            path="/admin/login"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AdminLogin />
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
          </Route>
          <Route element={<RedirectIfRegistered />}>
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
          </Route>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<RequireRegistration />}>
          <Route element={<GameShell />}>
            <Route path="/" element={<Home />} />
            <Route path="/ranking" element={<RankingFull />} />
            <Route path="/missions" element={<Missions />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/leagues" element={<Leagues />} />
            <Route path="/manager" element={<Manager />} />
            <Route path="/manager/pro" element={<ManagerPro />} />
            <Route path="/profile" element={<Navigate to="/manager" replace />} />
            <Route path="/config" element={<Config />} />
            <Route path="/how-to-play" element={<HowToPlay />} />
            <Route path="/team" element={<Team />} />
            <Route path="/legend/:id" element={<Legend />} />
            <Route path="/legend" element={<Legend />} />
            <Route path="/matchday/preview" element={<MatchdayPreview />} />
            <Route path="/team/tatica" element={<Navigate to="/team" replace />} />
            <Route path="/team/treino" element={<TeamTraining />} />
            <Route path="/team/linha-evolutiva" element={<TeamEvolutionLine />} />
            <Route path="/team/staff" element={<TeamStaff />} />
            <Route path="/team/ailabs" element={<TeamAiLabs />} />
            <Route path="/city" element={<City />} />
            <Route path="/city/youth-prospects" element={<YouthProspects />} />
            <Route path="/transfer" element={<Transfer />} />
            <Route path="/transfer/exchange" element={<TransferExchange />} />
            <Route path="/store" element={<Store />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/wallet/olexp" element={<OlexpTab />} />
            <Route path="/wallet/referrals" element={<ReferralTab />} />
            <Route path="/wallet/gat" element={<GatTab />} />
            <Route path="/wallet/extract" element={<ExtractTab />} />
            <Route path="/match/live" element={<MatchLive />} />
            <Route path="/match" element={<LiveMatch />} />
            <Route path="/match/test2d" element={<Navigate to="/match/live" replace />} />
            <Route path="/match/ultralive2d" element={<Navigate to="/match/live" replace />} />
            <Route path="/match/auto" element={<MatchAuto />} />
            <Route path="/match/quick" element={<MatchQuick />} />
            <Route path="/match/penalty" element={<MatchPenalty />} />
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
  );
}
