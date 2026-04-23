import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Users,
  Building2,
  ArrowRightLeft,
  Wallet,
  Target,
  Trophy,
  User,
  Settings,
  GraduationCap,
  Play,
  Menu,
  X,
  Calendar,
  ShoppingBag,
  LogOut,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { HeaderOtzStrip } from '@/components/HeaderOtzStrip';
import { TrainerAvatarHeaderControl } from '@/components/TrainerAvatarHeaderControl';
import { getGameState, useGameStore } from '@/game/store';
import { getSupabase, isSupabaseConfigured } from '@/supabase/client';
import { hydrateManagerFirstNameFromSupabase } from '@/supabase/profileDisplayName';
import { applyPendingCredits } from '@/wallet/applyPendingCredits';
import { TutorialOverlay } from '@/components/TutorialOverlay';
import { AssistantWidget } from '@/components/AssistantWidget';

const mainNavItems = [
  { icon: Home, label: 'HOME', path: '/' },
  { icon: Users, label: 'MEU TIME', path: '/team' },
  { icon: Building2, label: 'CLUBE', path: '/city' },
  { icon: ArrowRightLeft, label: 'MERCADO', path: '/transfer' },
  { icon: Wallet, label: 'WALLET', path: '/wallet' },
];

const drawerNavItems = [
  { icon: Home, label: 'HOME', path: '/' },
  { icon: Target, label: 'MISSÕES', path: '/missions' },
  { icon: Calendar, label: 'CALENDÁRIO', path: '/calendar' },
  { icon: ShoppingBag, label: 'LOJA', path: '/store' },
  { icon: Trophy, label: 'LIGAS', path: '/leagues' },
  { icon: User, label: 'PROFILE', path: '/profile' },
  { icon: GraduationCap, label: 'COMO JOGAR', path: '/how-to-play' },
  { icon: Settings, label: 'CONFIG', path: '/config' },
];

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const localManagerFirst = useGameStore((s) => s.userSettings?.managerProfile?.firstName?.trim() ?? '');
  const [remoteManagerFirst, setRemoteManagerFirst] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const readLocal = () => getGameState().userSettings?.managerProfile?.firstName?.trim() ?? '';
    const run = async () => {
      if (!isSupabaseConfigured()) {
        if (!cancelled) setRemoteManagerFirst(null);
        return;
      }
      const remote = await hydrateManagerFirstNameFromSupabase(readLocal());
      if (!cancelled) setRemoteManagerFirst(remote);
    };
    void run();
    void applyPendingCredits();
    const sb = getSupabase();
    if (!sb) {
      return () => { cancelled = true; };
    }
    const { data: { subscription } } = sb.auth.onAuthStateChange(() => {
      void run();
      void applyPendingCredits();
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [localManagerFirst]);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    const sb = getSupabase();
    if (sb) {
      try { await sb.auth.signOut(); } catch { /* noop */ }
    }
    // Limpa o save local — sem isto o Zustand mantém `managerProfile` e o
    // `RedirectIfRegistered` em `/login` joga o usuário de volta pra home
    // (aparentando que o botão SAIR não fez nada).
    try {
      localStorage.removeItem('olefoot-game-v1');
    } catch { /* noop */ }
    // Hard reload — Zustand re-inicializa em estado limpo no /login.
    window.location.href = '/login';
  };

  const coachGreetingName = remoteManagerFirst ?? (localManagerFirst || null);
  const coachGreetingLine = coachGreetingName ? `Olá, ${coachGreetingName}` : 'Olá, Treinador';
  const isQuickMatchRoute = location.pathname === '/match/quick';
  const isImmersiveMatchRoute = location.pathname === '/match' || location.pathname === '/match/live';
  const hideMobileBottomNav =
    location.pathname === '/match' ||
    location.pathname === '/match/live' ||
    location.pathname === '/match/quick';

  const getPageAction = (pathname: string) => {
    switch (pathname) {
      case '/':
        return (
          <Link
            to="/match/quick"
            className="btn-primary flex shrink-0 items-center gap-1 px-3 py-2 text-[10px] sm:gap-2 sm:px-4 sm:py-2 sm:text-xs"
          >
            <span className="btn-primary-inner px-1 sm:px-2">
              <Play className="h-3 w-3 shrink-0 fill-black" />
              <span className="hidden min-[360px]:inline">RÁPIDA</span>
              <span className="min-[360px]:hidden">JOGO</span>
            </span>
          </Link>
        );
      case '/match':
      case '/match/live':
        return (
          <button
            type="button"
            className="btn-primary flex shrink-0 items-center gap-1 px-3 py-2 text-[10px] sm:gap-2 sm:px-4 sm:py-2 sm:text-xs"
          >
            <span className="btn-primary-inner px-1 sm:px-2">
              <Settings className="h-3 w-3 shrink-0" /> Tática
            </span>
          </button>
        );
      default:
        return <HeaderOtzStrip />;
    }
  };

  return (
    <div className="flex min-h-[100dvh] w-full min-w-0 flex-col overflow-x-hidden bg-deep-black font-sans lg:flex-row">

      {/* Desktop Sidebar — visible only at ≥1024px */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 sports-panel border-r border-white/10 fixed h-screen z-50 rounded-none">
        <div className="flex items-center mb-10 p-6 pb-0">
          <img src="/test-pitch/olefoot-logo-game.svg" alt="Olefoot" className="h-10 w-auto" />
        </div>

        <nav className="flex-1 overflow-y-auto space-y-1 px-4">
          {mainNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-4 px-4 py-3 transition-all duration-200 group relative',
                  isActive ? 'text-white' : 'text-gray-500 hover:text-white',
                )}
              >
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-neon-yellow" />}
                <item.icon className={cn('w-5 h-5', isActive ? 'text-neon-yellow' : 'group-hover:text-neon-yellow transition-colors')} />
                <span className="font-display font-bold tracking-wider text-lg">{item.label}</span>
              </Link>
            );
          })}

          <div className="my-3 border-t border-white/10" />

          {drawerNavItems.filter((d) => d.path !== '/').map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-4 px-4 py-2.5 transition-all duration-200 group relative',
                  isActive ? 'text-white' : 'text-gray-600 hover:text-white',
                )}
              >
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-neon-yellow" />}
                <item.icon className={cn('w-4 h-4', isActive ? 'text-neon-yellow' : 'group-hover:text-neon-yellow transition-colors')} />
                <span className="font-display font-bold tracking-wider text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-white/10 bg-[#0a0a0a]">
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex w-full items-center gap-3 px-4 py-3 text-gray-500 hover:text-white transition-colors group"
          >
            <LogOut className="w-5 h-5 group-hover:text-neon-yellow transition-colors" />
            <span className="font-display font-bold tracking-wider text-sm">SAIR</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          'flex w-full min-w-0 flex-1 flex-col lg:ml-64',
          isQuickMatchRoute
            ? 'h-[100dvh] min-h-0 lg:h-auto lg:min-h-screen'
            : isImmersiveMatchRoute
              ? 'min-h-screen'
              : 'min-h-0',
        )}
      >
        {/* Top Header */}
        <header
          className={cn(
            'sticky top-0 z-40 flex min-h-12 shrink-0 flex-row items-center justify-between gap-2 border-b border-white/10 bg-deep-black/90 px-3 py-2 backdrop-blur-md supports-[padding:max(0px)]:pt-[max(0.5rem,env(safe-area-inset-top,0px))] sm:min-h-14 sm:gap-3 sm:px-4',
            isQuickMatchRoute && 'hidden lg:flex',
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            {/* Hamburger — only below lg */}
            <button
              type="button"
              className="shrink-0 text-white transition-colors hover:text-neon-yellow lg:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <TrainerAvatarHeaderControl />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[9px] font-bold uppercase tracking-widest text-neon-yellow sm:text-[10px]">
                Bem-vindo
              </span>
              <span className="truncate font-display text-xs font-bold tracking-wider text-white sm:text-sm">
                {coachGreetingLine}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center">
            {getPageAction(location.pathname)}
          </div>
        </header>

        <div
          className={cn(
            'flex w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden',
            isQuickMatchRoute &&
              'min-h-0 overflow-y-auto [-webkit-overflow-scrolling:touch] lg:overflow-visible',
            location.pathname === '/match' || location.pathname === '/match/live'
              ? ''
              : isQuickMatchRoute
                ? 'lg:p-8 lg:pb-8'
                : 'p-3 pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] sm:p-4 lg:p-8 lg:pb-8',
          )}
        >
          {children}
        </div>
      </main>
      <TutorialOverlay />
      <AssistantWidget />

      {/* Mobile / Tablet Drawer — slides in below lg */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 z-[60] lg:hidden backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-deep-black border-r border-white/10 z-[70] lg:hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <img src="/test-pitch/olefoot-logo-game.svg" alt="Olefoot" className="h-9 w-auto" />
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-gray-400 hover:text-white p-1"
                  aria-label="Fechar menu"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-4">
                {[...mainNavItems, ...drawerNavItems.filter((d) => d.path !== '/')].map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 group relative',
                        isActive ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5',
                      )}
                    >
                      {isActive && <div className="absolute left-0 top-2 bottom-2 w-1 bg-neon-yellow rounded-r" />}
                      <item.icon className={cn('w-5 h-5', isActive ? 'text-neon-yellow' : 'group-hover:text-neon-yellow transition-colors')} />
                      <span className="font-display font-bold tracking-wider">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="p-5 border-t border-white/10 bg-[#0a0a0a]">
                <button
                  type="button"
                  onClick={() => { setIsMobileMenuOpen(false); void handleSignOut(); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-gray-500 hover:text-white transition-colors group rounded-lg hover:bg-white/5"
                >
                  <LogOut className="w-5 h-5 group-hover:text-neon-yellow transition-colors" />
                  <span className="font-display font-bold tracking-wider">SAIR</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Nav — hidden at lg+ */}
      {!hideMobileBottomNav && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around border-t border-white/10 bg-[#0a0a0a] pb-safe">
          {mainNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 transition-all [-webkit-tap-highlight-color:transparent]',
                  isActive ? 'text-neon-yellow' : 'text-gray-500',
                )}
              >
                {isActive && <div className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-neon-yellow" />}
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="max-w-full truncate text-center text-[8px] font-display font-bold leading-tight tracking-wider min-[360px]:text-[9px]">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
