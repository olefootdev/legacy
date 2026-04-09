/**
 * Painel administrativo — /admin apenas (sem link na shell do jogo).
 * Dashboard interativo: KPIs, gestão de ligas persistidas, acções de utilizador no save local.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  Brain,
  LayoutDashboard,
  Shield,
  Sparkles,
  Trophy,
  UserCog,
  Users,
  Image,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import { formatBroFromCents } from '@/systems/economy';
import { computePlatformAggregate, useAdminPlatformStore } from '@/admin/platformStore';
import { AdminOverviewPanel } from './panels/AdminOverviewPanel';
import { AdminLeaguesPanel } from './panels/AdminLeaguesPanel';
import { AdminUserPanel } from './panels/AdminUserPanel';
import { AdminUsuariosPanel } from './panels/AdminUsuariosPanel';
import { AdminFinanceiroPanel } from './panels/AdminFinanceiroPanel';
import { AdminCreatePlayerPanel } from './panels/AdminCreatePlayerPanel';
import { AdminGameSpiritPanel } from './panels/AdminGameSpiritPanel';
import { AdminBannersPanel } from './panels/AdminBannersPanel';
import { AdminSaveHubPanel } from './panels/AdminSaveHubPanel';

type TabId =
  | 'overview'
  | 'financeiro'
  | 'usuarios'
  | 'leagues'
  | 'user'
  | 'createPlayer'
  | 'gameSpirit'
  | 'banners'
  | 'saveData';

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Resumo', icon: LayoutDashboard },
  { id: 'financeiro', label: 'Financeiro', icon: Banknote },
  { id: 'usuarios', label: 'Usuários', icon: Users },
  { id: 'saveData', label: 'Dados do save', icon: Database },
  { id: 'banners', label: 'Banners', icon: Image },
  { id: 'gameSpirit', label: 'Game Spirit', icon: Brain },
  { id: 'createPlayer', label: 'Create player', icon: Sparkles },
  { id: 'leagues', label: 'Ligas', icon: Trophy },
  { id: 'user', label: 'Sessão local', icon: UserCog },
];

/** Hash na URL pode usar alias (ex.: #create-player). */
const HASH_TO_TAB: Record<string, TabId> = {
  'create-player': 'createPlayer',
  'game-spirit': 'gameSpirit',
  save: 'saveData',
};

function readHashTab(): TabId {
  const h = (typeof window !== 'undefined' && window.location.hash.replace(/^#/, '')) || '';
  const alias = HASH_TO_TAB[h];
  if (alias) return alias;
  if (TABS.some((t) => t.id === h)) return h as TabId;
  return 'overview';
}

export function AdminDashboard() {
  const [tab, setTab] = useState<TabId>(readHashTab);
  const clubName = useGameStore((s) => s.club.name);
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
    if (id === 'createPlayer') window.location.hash = 'create-player';
    else if (id === 'gameSpirit') window.location.hash = 'game-spirit';
    else if (id === 'saveData') window.location.hash = 'save';
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
          <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:px-3 md:pb-4">
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
          <div className="mt-auto hidden p-3 md:block">
            <Link
              to="/"
              className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao jogo
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-white/10 bg-black/30 px-4 py-4 md:px-8">
            <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-black tracking-tight md:text-3xl">Dashboard</h1>
                <p className="mt-1 text-sm text-white/45">
                  <span className="text-white/55">Plataforma:</span>{' '}
                  <span className="text-white/85">{platformUserCount}</span> conta(s) · Σ BRO{' '}
                  <span className="font-mono text-neon-yellow/90">{formatBroFromCents(platformAg.sumBroCents)}</span>
                  <span className="mx-2 text-white/20">·</span>
                  <span className="text-white/55">Save local:</span>{' '}
                  <span className="text-white/85">{clubName}</span>
                </p>
                <p className="mt-1 text-[10px] text-white/30">
                  <code className="text-neon-yellow/70">#overview</code>
                  <code className="ml-1.5 text-white/25">#financeiro</code>
                  <code className="ml-1.5 text-white/25">#usuarios</code>
                  <code className="ml-1.5 text-white/25">#leagues</code>
                  <code className="ml-1.5 text-white/25">#banners</code>
                  <code className="ml-1.5 text-white/25">#save</code>
                  <code className="ml-1.5 text-white/25">#user</code>
                  <code className="ml-1.5 text-white/25">#game-spirit</code>
                  <code className="ml-1.5 text-white/25">#create-player</code>
                </p>
              </div>
              <Link
                to="/"
                className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10 md:hidden"
              >
                ← Jogo
              </Link>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
            <div className="mx-auto max-w-6xl">
              {tab === 'overview' ? <AdminOverviewPanel /> : null}
              {tab === 'financeiro' ? <AdminFinanceiroPanel /> : null}
              {tab === 'usuarios' ? <AdminUsuariosPanel /> : null}
              {tab === 'leagues' ? <AdminLeaguesPanel /> : null}
              {tab === 'user' ? <AdminUserPanel /> : null}
              {tab === 'gameSpirit' ? <AdminGameSpiritPanel /> : null}
              {tab === 'banners' ? <AdminBannersPanel /> : null}
              {tab === 'saveData' ? <AdminSaveHubPanel /> : null}
              {tab === 'createPlayer' ? <AdminCreatePlayerPanel /> : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
