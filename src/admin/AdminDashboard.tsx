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
import { AdminProfanityPanel } from './panels/AdminProfanityPanel';
import { AdminLearnedPhrasesPanel } from './panels/AdminLearnedPhrasesPanel';
import { AdminFootballVocabularyPanel } from './panels/AdminFootballVocabularyPanel';
import { AdminCreatePlayerAgentsPanel } from './panels/AdminCreatePlayerAgentsPanel';
import { AdminGlobalPanel } from './panels/AdminGlobalPanel';
import { AdminOlefootLigaPanel } from './panels/AdminOlefootLigaPanel';
import { AdminAuditLogPanel } from './panels/AdminAuditLogPanel';
import { AdminSkillsPanel } from './panels/AdminSkillsPanel';
import { AdminSecurityPanel } from './panels/AdminSecurityPanel';
import { AdminBroadcastPanel } from './panels/AdminBroadcastPanel';
import { AdminLaunchPanel } from './panels/AdminLaunchPanel';
import { AdminPlatformConfigPanel } from './panels/AdminPlatformConfigPanel';
import { AdminAgentsPanel } from './AdminAgentsPanel';
import { AdminCreativePanel } from './AdminCreativePanel';
import { AdminCoachAgentsPanel } from './panels/AdminCoachAgentsPanel';

type TabId =
  | 'overview'
  | 'growth'
  | 'usuarios'
  | 'audit'
  | 'economia'
  | 'jogadores'
  | 'ia'
  | 'leagues'
  | 'creative'
  | 'sistema';

type SubTabId =
  | 'financeiro'
  | 'shop'
  | 'market'
  | 'prospectArt'
  | 'playerEvolution'
  | 'genesisPortraits'
  | 'legacy'
  | 'skills'
  | 'gameSpirit'
  | 'createPlayerAgents'
  | 'agents'
  | 'coachAgents'
  | 'profanity'
  | 'learnedPhrases'
  | 'footballVocabulary'
  | 'global'
  | 'olefootLiga'
  | 'security'
  | 'platformConfig'
  | 'broadcast'
  | 'launch';

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard; subTabs?: { id: SubTabId; label: string }[] }[] = [
  { id: 'overview', label: 'Resumo', icon: LayoutDashboard },
  { id: 'growth', label: 'Growth', icon: LineChart },
  { id: 'usuarios', label: 'Usuários', icon: Users },
  { id: 'audit', label: 'Auditoria', icon: FileClock },
  {
    id: 'economia',
    label: 'Economia',
    icon: Banknote,
    subTabs: [
      { id: 'financeiro', label: 'Financeiro' },
      { id: 'shop', label: 'Loja' },
      { id: 'market', label: 'Market' },
    ],
  },
  {
    id: 'jogadores',
    label: 'Jogadores',
    icon: Users,
    subTabs: [
      { id: 'prospectArt', label: 'Academy' },
      { id: 'playerEvolution', label: 'Evolução' },
      { id: 'genesisPortraits', label: 'Fotos Genesis' },
      { id: 'legacy', label: 'Legacy DNA' },
      { id: 'skills', label: 'Skills' },
    ],
  },
  {
    id: 'ia',
    label: 'IA & Moderação',
    icon: Brain,
    subTabs: [
      { id: 'gameSpirit', label: 'Game Spirit' },
      { id: 'createPlayerAgents', label: 'Agency' },
      { id: 'agents', label: 'Agentes Offline' },
      { id: 'coachAgents', label: 'Coach Agents' },
      { id: 'profanity', label: 'Linguagem' },
      { id: 'learnedPhrases', label: 'Frases aprendidas' },
      { id: 'footballVocabulary', label: 'Vocabulário de Futebol' },
    ],
  },
  { id: 'leagues', label: 'Ligas', icon: Trophy },
  { id: 'creative', label: 'Creative', icon: Brush },
  {
    id: 'sistema',
    label: 'Sistema',
    icon: Rocket,
    subTabs: [
      { id: 'global', label: 'Global' },
      { id: 'olefootLiga', label: 'Liga Global (legado)' },
      { id: 'security', label: 'Segurança' },
      { id: 'platformConfig', label: 'Plataforma' },
      { id: 'broadcast', label: 'Broadcast' },
      { id: 'launch', label: 'Launch' },
    ],
  },
];

/** Hash na URL pode usar alias (ex.: #academy-players; #academia-art mantém compat.). */
const HASH_TO_TAB: Record<string, TabId | SubTabId> = {
  'academy-players': 'prospectArt',
  'academia-art': 'prospectArt',
  'game-spirit': 'gameSpirit',
  'genesis-portraits': 'genesisPortraits',
  evolution: 'playerEvolution',
  financeiro: 'financeiro',
  shop: 'shop',
  market: 'market',
  legacy: 'legacy',
  skills: 'skills',
  profanity: 'profanity',
  learnedPhrases: 'learnedPhrases',
  footballVocabulary: 'footballVocabulary',
  createPlayerAgents: 'createPlayerAgents',
  coachAgents: 'coachAgents',
  global: 'global',
  security: 'security',
  platformConfig: 'platformConfig',
  broadcast: 'broadcast',
  launch: 'launch',
};

function readHashTab(): { tab: TabId; subTab: SubTabId | null } {
  const h = (typeof window !== 'undefined' && window.location.hash.replace(/^#/, '')) || '';
  const alias = HASH_TO_TAB[h];
  const target = alias || h;

  // Check if it's a main tab
  const mainTab = TABS.find((t) => t.id === target);
  if (mainTab) return { tab: mainTab.id, subTab: null };

  // Check if it's a subtab
  for (const tab of TABS) {
    if (tab.subTabs) {
      const subTab = tab.subTabs.find((st) => st.id === target);
      if (subTab) return { tab: tab.id, subTab: subTab.id };
    }
  }

  return { tab: 'overview', subTab: null };
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [adminSession, setAdminSession] = useState<ReturnType<typeof loadAdminPanelSession> extends Promise<infer T> ? T : never>(null);
  const [tab, setTab] = useState<TabId>(() => readHashTab().tab);
  const [subTab, setSubTab] = useState<SubTabId | null>(() => readHashTab().subTab);

  useEffect(() => {
    const loadSession = async () => {
      const session = await loadAdminPanelSession();
      setAdminSession(session);
    };
    void loadSession();
  }, []);

  const signOutAdminPanel = () => {
    clearAdminPanelSession();
    navigate('/admin/login', { replace: true });
  };
  /** Referência estável do estado; nunca usar selector que devolve objeto novo (useSyncExternalStore + Object.is → loop infinito). */
  const platform = useAdminPlatformStore((s) => s);
  const platformUserCount = platform.users.length;
  const platformAg = useMemo(() => computePlatformAggregate(platform), [platform]);

  useEffect(() => {
    const onHash = () => {
      const { tab: newTab, subTab: newSubTab } = readHashTab();
      setTab(newTab);
      setSubTab(newSubTab);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setHashTab = (id: TabId, subId?: SubTabId) => {
    if (subId) {
      window.location.hash = subId;
      setTab(id);
      setSubTab(subId);
    } else {
      window.location.hash = id;
      setTab(id);
      setSubTab(null);
    }
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
                <div key={t.id} className="flex flex-col gap-1">
                  <button
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
                  {active && t.subTabs ? (
                    <div className="ml-6 flex flex-col gap-0.5">
                      {t.subTabs.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setHashTab(t.id, st.id)}
                          className={cn(
                            'rounded px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide transition-colors',
                            subTab === st.id
                              ? 'bg-neon-yellow/20 text-neon-yellow'
                              : 'text-white/40 hover:bg-white/5 hover:text-white/70',
                          )}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
          <div className="mt-auto hidden flex-col gap-2 p-3 md:flex">
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
              {tab === 'usuarios' ? <AdminUsuariosPanel /> : null}
              {tab === 'audit' ? <AdminAuditLogPanel /> : null}
              {tab === 'leagues' ? <AdminLeaguesPanel /> : null}
              {tab === 'creative' ? <AdminCreativePanel /> : null}

              {/* Economia group */}
              {tab === 'economia' && subTab === 'financeiro' ? <AdminFinanceiroPanel /> : null}
              {tab === 'economia' && subTab === 'shop' ? <AdminShopPanel /> : null}
              {tab === 'economia' && subTab === 'market' ? <AdminMarketPanel /> : null}
              {tab === 'economia' && !subTab ? <AdminFinanceiroPanel /> : null}

              {/* Jogadores group */}
              {tab === 'jogadores' && subTab === 'prospectArt' ? <AdminProspectArtPanel /> : null}
              {tab === 'jogadores' && subTab === 'playerEvolution' ? <AdminPlayerEvolutionPanel /> : null}
              {tab === 'jogadores' && subTab === 'genesisPortraits' ? <AdminGenesisPortraitsPanel /> : null}
              {tab === 'jogadores' && subTab === 'legacy' ? <AdminLegacyPanel /> : null}
              {tab === 'jogadores' && subTab === 'skills' ? <AdminSkillsPanel /> : null}
              {tab === 'jogadores' && !subTab ? <AdminProspectArtPanel /> : null}

              {/* IA & Moderação group */}
              {tab === 'ia' && subTab === 'gameSpirit' ? <AdminGameSpiritPanel /> : null}
              {tab === 'ia' && subTab === 'createPlayerAgents' ? <AdminCreatePlayerAgentsPanel /> : null}
              {tab === 'ia' && subTab === 'agents' ? <AdminAgentsPanel /> : null}
              {tab === 'ia' && subTab === 'coachAgents' ? <AdminCoachAgentsPanel /> : null}
              {tab === 'ia' && subTab === 'profanity' ? <AdminProfanityPanel /> : null}
              {tab === 'ia' && subTab === 'learnedPhrases' ? <AdminLearnedPhrasesPanel /> : null}
              {tab === 'ia' && subTab === 'footballVocabulary' ? <AdminFootballVocabularyPanel /> : null}
              {tab === 'ia' && !subTab ? <AdminGameSpiritPanel /> : null}

              {/* Sistema group */}
              {tab === 'sistema' && subTab === 'global' ? <AdminGlobalPanel /> : null}
              {tab === 'sistema' && subTab === 'olefootLiga' ? <AdminOlefootLigaPanel /> : null}
              {tab === 'sistema' && subTab === 'security' ? <AdminSecurityPanel /> : null}
              {tab === 'sistema' && subTab === 'platformConfig' ? <AdminPlatformConfigPanel /> : null}
              {tab === 'sistema' && subTab === 'broadcast' ? <AdminBroadcastPanel /> : null}
              {tab === 'sistema' && subTab === 'launch' ? <AdminLaunchPanel /> : null}
              {tab === 'sistema' && !subTab ? <AdminGlobalPanel /> : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
