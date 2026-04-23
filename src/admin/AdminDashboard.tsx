/**
 * Painel administrativo — /admin apenas (sem link na shell do jogo).
 * Dashboard interativo: KPIs, gestão de ligas persistidas, acções de utilizador no save local.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clearAdminPanelSession, loadAdminPanelSession } from '@/supabase/adminPanelAuth';
import {
  ArrowLeft,
  Banknote,
  Beaker,
  Brain,
  Brush,
  Camera,
  LayoutDashboard,
  Shield,
  ShoppingBag,
  Trophy,
  TrendingUp,
  Users,
  LineChart,
  Crown,
  Rocket,
  FileClock,
  ShieldAlert,
  BookOpen,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBroFromCents } from '@/systems/economy';
import { computePlatformAggregate, useAdminPlatformStore } from '@/admin/platformStore';
import { AdminOverviewPanel } from './panels/AdminOverviewPanel';
import { AdminLeaguesPanel } from './panels/AdminLeaguesPanel';
import { AdminUsuariosPanel } from './panels/AdminUsuariosPanel';
import { AdminFinanceiroPanel } from './panels/AdminFinanceiroPanel';
import { AdminGameSpiritPanel } from './panels/AdminGameSpiritPanel';
import { AdminProspectArtPanel } from './panels/AdminProspectArtPanel';
import { AdminPlayerEvolutionPanel } from './panels/AdminPlayerEvolutionPanel';
import { AdminGrowthPanel } from './panels/AdminGrowthPanel';
import { AdminGenesisPortraitsPanel } from './panels/AdminGenesisPortraitsPanel';
import { AdminShopPanel } from './panels/AdminShopPanel';
import { AdminMarketPanel } from './panels/AdminMarketPanel';
import { AdminLegacyPanel } from './panels/AdminLegacyPanel';
import { AdminAuditLogPanel } from './panels/AdminAuditLogPanel';
import { AdminProfanityPanel } from './panels/AdminProfanityPanel';
import { AdminLearnedPhrasesPanel } from './panels/AdminLearnedPhrasesPanel';
import { AdminCreatePlayerAgentsPanel } from './panels/AdminCreatePlayerAgentsPanel';
import { AdminGlobalPanel } from './panels/AdminGlobalPanel';

type TabId =
  | 'overview'
  | 'growth'
  | 'financeiro'
  | 'usuarios'
  | 'leagues'
  | 'shop'
  | 'market'
  | 'legacy'
  | 'global'
  | 'audit'
  | 'profanity'
  | 'learnedPhrases'
  | 'createPlayerAgents'
  | 'prospectArt'
  | 'playerEvolution'
  | 'gameSpirit'
  | 'genesisPortraits';

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Resumo', icon: LayoutDashboard },
  { id: 'growth', label: 'Growth', icon: LineChart },
  { id: 'financeiro', label: 'Financeiro', icon: Banknote },
  { id: 'global', label: 'Global', icon: Rocket },
  { id: 'shop', label: 'Loja', icon: ShoppingBag },
  { id: 'market', label: 'Market', icon: Shield },
  { id: 'legacy', label: 'Legacy DNA', icon: Crown },
  { id: 'audit', label: 'Auditoria', icon: FileClock },
  { id: 'profanity', label: 'Linguagem', icon: ShieldAlert },
  { id: 'learnedPhrases', label: 'Frases aprendidas', icon: BookOpen },
  { id: 'usuarios', label: 'Usuários', icon: Users },
  { id: 'gameSpirit', label: 'Game Spirit', icon: Brain },
  { id: 'createPlayerAgents', label: 'Agency', icon: Brain },
  { id: 'prospectArt', label: 'Academy players', icon: Brush },
  { id: 'playerEvolution', label: 'Evolução', icon: TrendingUp },
  { id: 'leagues', label: 'Ligas', icon: Trophy },
  { id: 'genesisPortraits', label: 'Fotos Genesis', icon: Camera },
];

/** Hash na URL pode usar alias (ex.: #academy-players; #academia-art mantém compat.). */
const HASH_TO_TAB: Record<string, TabId> = {
  'academy-players': 'prospectArt',
  'academia-art': 'prospectArt',
  'game-spirit': 'gameSpirit',
  'genesis-portraits': 'genesisPortraits',
  evolution: 'playerEvolution',
};

function readHashTab(): TabId {
  const h = (typeof window !== 'undefined' && window.location.hash.replace(/^#/, '')) || '';
  const alias = HASH_TO_TAB[h];
  if (alias) return alias;
  if (TABS.some((t) => t.id === h)) return h as TabId;
  return 'overview';
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const adminSession = loadAdminPanelSession();
  const [tab, setTab] = useState<TabId>(readHashTab);

  const signOutAdminPanel = () => {
    clearAdminPanelSession();
    navigate('/admin/login', { replace: true });
  };
  /** Referência estável do estado; nunca usar selector que devolve objeto novo (useSyncExternalStore + Object.is → loop infinito). */
  const platform = useAdminPlatformStore((s) => s);
  const platformUserCount = platform.users.length;
  const platformAg = useMemo(() => computePlatformAggregate(platform), [platform]);

  useEffect(() => {
    const onHash = () => setTab(readHashTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setHashTab = (id: TabId) => {
    if (id === 'prospectArt') window.location.hash = 'academy-players';
    else if (id === 'gameSpirit') window.location.hash = 'game-spirit';
    else if (id === 'genesisPortraits') window.location.hash = 'genesis-portraits';
    else if (id === 'playerEvolution') window.location.hash = 'evolution';
    else window.location.hash = id;
    setTab(id);
  };

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="flex shrink-0 flex-col border-b border-white/10 bg-black/50 md:w-52 md:border-b-0 md:border-r">
          <div className="flex items-center gap-2 p-4">
            <Shield className="h-8 w-8 text-neon-yellow" />
            <div>
              <div className="font-display text-lg font-black">ADMIN</div>
              <div className="text-[9px] uppercase tracking-widest text-white/35">OLEFOOT</div>
            </div>
          </div>
          <nav className="ole-scroll-x flex gap-1 px-2 pb-2 md:flex-col md:overflow-x-visible md:overflow-y-auto md:px-3 md:pb-4">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setHashTab(t.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide transition-colors',
                    active ? 'bg-neon-yellow text-black' : 'text-white/50 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto hidden flex-col gap-2 p-3 md:flex">
            <Link
              to="/admin/testes"
              className="flex items-center gap-2 rounded-lg border border-neon-yellow/25 bg-neon-yellow/10 px-3 py-2 text-xs font-bold text-neon-yellow/90 hover:bg-neon-yellow/15"
            >
              <Beaker className="h-4 w-4" />
              Área de testes
            </Link>
            <Link
              to="/"
              className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao jogo
            </Link>
            <button
              type="button"
              onClick={signOutAdminPanel}
              className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/15 hover:text-rose-100"
              title="Encerra a sessão do painel admin (mantém o login do jogo)"
            >
              <LogOut className="h-4 w-4" />
              Sair do painel
            </button>
            {adminSession ? (
              <p className="px-1 pt-1 text-[10px] leading-snug text-white/35">
                <span className="text-white/55">Logado:</span>{' '}
                <span className="font-mono text-white/75">{adminSession.email}</span>
              </p>
            ) : null}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-white/10 bg-black/30 px-4 py-4 md:px-8">
            <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-black tracking-tight md:text-3xl">Dashboard</h1>
                <p className="mt-1 text-sm text-white/45">
                  <span className="text-white/55">Plataforma:</span>{' '}
                  <span className="text-white/85">{platformUserCount}</span> conta(s) · Σ BRO{' '}
                  <span className="font-mono text-neon-yellow/90">{formatBroFromCents(platformAg.sumBroCents)}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:hidden">
                <Link
                  to="/admin/testes"
                  className="rounded-lg border border-neon-yellow/25 bg-neon-yellow/10 px-3 py-2 text-xs font-bold text-neon-yellow/90 hover:bg-neon-yellow/15"
                >
                  Testes
                </Link>
                <Link
                  to="/"
                  className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10"
                >
                  ← Jogo
                </Link>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 md:px-8">
            <div className="mx-auto min-w-0 w-full max-w-6xl">
              {tab === 'overview' ? <AdminOverviewPanel /> : null}
              {tab === 'growth' ? <AdminGrowthPanel /> : null}
              {tab === 'financeiro' ? <AdminFinanceiroPanel /> : null}
              {tab === 'global' ? <AdminGlobalPanel /> : null}
              {tab === 'shop' ? <AdminShopPanel /> : null}
              {tab === 'market' ? <AdminMarketPanel /> : null}
              {tab === 'legacy' ? <AdminLegacyPanel /> : null}
              {tab === 'audit' ? <AdminAuditLogPanel /> : null}
              {tab === 'profanity' ? <AdminProfanityPanel /> : null}
              {tab === 'learnedPhrases' ? <AdminLearnedPhrasesPanel /> : null}
              {tab === 'usuarios' ? <AdminUsuariosPanel /> : null}
              {tab === 'leagues' ? <AdminLeaguesPanel /> : null}
              {tab === 'gameSpirit' ? <AdminGameSpiritPanel /> : null}
              {tab === 'genesisPortraits' ? <AdminGenesisPortraitsPanel /> : null}
              {tab === 'createPlayerAgents' ? <AdminCreatePlayerAgentsPanel /> : null}
              {tab === 'prospectArt' ? <AdminProspectArtPanel /> : null}
              {tab === 'playerEvolution' ? <AdminPlayerEvolutionPanel /> : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
