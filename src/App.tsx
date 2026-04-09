import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { Layout } from './components/Layout';
import { GameProvider } from './game/GameProvider';
import { WorldClock } from './game/WorldClock';
import { UserSettingsEffects } from './components/UserSettingsEffects';

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Team = lazy(() => import('./pages/Team').then((m) => ({ default: m.Team })));
const TeamTactics = lazy(() => import('./pages/TeamTactics').then((m) => ({ default: m.TeamTactics })));
const TeamTraining = lazy(() => import('./pages/TeamTraining').then((m) => ({ default: m.TeamTraining })));
const TeamStaff = lazy(() => import('./pages/TeamStaff').then((m) => ({ default: m.TeamStaff })));
const YouthProspects = lazy(() => import('./pages/YouthProspects').then((m) => ({ default: m.YouthProspects })));
const City = lazy(() => import('./pages/City').then((m) => ({ default: m.City })));
const Transfer = lazy(() => import('./pages/Transfer').then((m) => ({ default: m.Transfer })));
const Store = lazy(() => import('./pages/Store').then((m) => ({ default: m.Store })));
const Wallet = lazy(() => import('./pages/Wallet').then((m) => ({ default: m.Wallet })));
const OlexpTab = lazy(() => import('./pages/wallet/OlexpTab').then((m) => ({ default: m.OlexpTab })));
const ReferralTab = lazy(() => import('./pages/wallet/ReferralTab').then((m) => ({ default: m.ReferralTab })));
const GatTab = lazy(() => import('./pages/wallet/GatTab').then((m) => ({ default: m.GatTab })));
const ExtractTab = lazy(() => import('./pages/wallet/ExtractTab').then((m) => ({ default: m.ExtractTab })));
const LiveMatch = lazy(() => import('./pages/LiveMatch').then((m) => ({ default: m.LiveMatch })));
const MatchAuto = lazy(() => import('./pages/MatchAuto').then((m) => ({ default: m.MatchAuto })));
const MatchQuick = lazy(() => import('./pages/MatchQuick').then((m) => ({ default: m.MatchQuick })));
const Missions = lazy(() => import('./pages/Missions').then((m) => ({ default: m.Missions })));
const Leagues = lazy(() => import('./pages/Leagues').then((m) => ({ default: m.Leagues })));
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })));
const Config = lazy(() => import('./pages/Config').then((m) => ({ default: m.Config })));
const RankingFull = lazy(() => import('./pages/RankingFull').then((m) => ({ default: m.RankingFull })));
const AdminDashboard = lazy(() =>
  import('./admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })),
);
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Cadastro = lazy(() => import('./pages/Cadastro').then((m) => ({ default: m.Cadastro })));

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
        <UserSettingsEffects />
        <WorldClock />
        <Routes>
          <Route
            path="/admin"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AdminDashboard />
              </Suspense>
            }
          />
          <Route
            path="/login"
            element={
              <Suspense fallback={<RouteFallback />}>
                <Login />
              </Suspense>
            }
          />
          <Route
            path="/cadastro"
            element={
              <Suspense fallback={<RouteFallback />}>
                <Cadastro />
              </Suspense>
            }
          />
          <Route element={<GameShell />}>
            <Route path="/" element={<Home />} />
            <Route path="/ranking" element={<RankingFull />} />
            <Route path="/missions" element={<Missions />} />
            <Route path="/leagues" element={<Leagues />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/config" element={<Config />} />
            <Route path="/team" element={<Team />} />
            <Route path="/team/tatica" element={<TeamTactics />} />
            <Route path="/team/treino" element={<TeamTraining />} />
            <Route path="/team/staff" element={<TeamStaff />} />
            <Route path="/city" element={<City />} />
            <Route path="/city/youth-prospects" element={<YouthProspects />} />
            <Route path="/transfer" element={<Transfer />} />
            <Route path="/store" element={<Store />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/wallet/olexp" element={<OlexpTab />} />
            <Route path="/wallet/referrals" element={<ReferralTab />} />
            <Route path="/wallet/gat" element={<GatTab />} />
            <Route path="/wallet/extract" element={<ExtractTab />} />
            <Route path="/match" element={<LiveMatch />} />
            <Route path="/match/auto" element={<MatchAuto />} />
            <Route path="/match/quick" element={<MatchQuick />} />
          </Route>
        </Routes>
      </Router>
    </GameProvider>
  );
}
