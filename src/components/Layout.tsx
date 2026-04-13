import { useState, type ReactNode } from 'react';
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
  Play,
  Menu,
  X,
  Calendar,
  ShoppingBag,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { HeaderOtzStrip } from '@/components/HeaderOtzStrip';
import { TrainerAvatarHeaderControl } from '@/components/TrainerAvatarHeaderControl';

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
  { icon: Settings, label: 'CONFIG', path: '/config' },
];

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isQuickMatchRoute = location.pathname === '/match/quick';
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
            className="btn-primary flex max-w-[min(100%,10.5rem)] shrink-0 items-center gap-1 px-3 py-2 text-[10px] sm:max-w-none sm:gap-2 sm:px-4 sm:py-2 sm:text-xs"
          >
            <span className="btn-primary-inner truncate px-1 sm:px-2">
              <Play className="h-3 w-3 shrink-0 fill-black" />{' '}
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
            className="btn-primary flex max-w-[min(100%,9rem)] shrink-0 items-center gap-1 px-3 py-2 text-[10px] sm:max-w-none sm:gap-2 sm:px-4 sm:py-2 sm:text-xs"
          >
            <span className="btn-primary-inner truncate px-1 sm:px-2">
              <Settings className="h-3 w-3 shrink-0" /> Tática
            </span>
          </button>
        );
      default:
        return <HeaderOtzStrip />;
    }
  };

  return (
    <div className="flex min-h-[100dvh] w-full max-w-[100vw] min-w-0 flex-col overflow-x-hidden bg-deep-black font-sans md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 sports-panel border-r border-white/10 fixed h-screen z-50 rounded-none">
        <div className="flex items-center gap-3 mb-12 p-6 pb-0">
          <div className="w-12 h-12 bg-neon-yellow flex items-center justify-center font-display font-bold text-3xl text-black -skew-x-6">
            <span className="skew-x-6">O</span>
          </div>
          <h1 className="text-3xl font-display font-black tracking-widest text-white italic">OLEFOOT</h1>
        </div>

        <nav className="flex-1 space-y-1 px-4">
          {mainNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 transition-all duration-200 group relative",
                  isActive ? "text-white" : "text-gray-500 hover:text-white"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-neon-yellow" />
                )}
                <item.icon className={cn("w-5 h-5", isActive ? "text-neon-yellow" : "group-hover:text-neon-yellow transition-colors")} />
                <span className="font-display font-bold tracking-wider text-lg">{item.label}</span>
              </Link>
            );
          })}

          <div className="my-3 border-t border-white/10" />

          {drawerNavItems.filter(d => d.path !== '/').map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-4 px-4 py-2.5 transition-all duration-200 group relative",
                  isActive ? "text-white" : "text-gray-600 hover:text-white"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-neon-yellow" />
                )}
                <item.icon className={cn("w-4 h-4", isActive ? "text-neon-yellow" : "group-hover:text-neon-yellow transition-colors")} />
                <span className="font-display font-bold tracking-wider text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-white/10 bg-[#0a0a0a]">
          <Link to="/match/quick" className="btn-primary w-full flex justify-center">
            <span className="btn-primary-inner">
              <Play className="w-5 h-5 fill-black" />
              DIA DE JOGO
            </span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          'flex w-full min-w-0 flex-1 flex-col md:ml-64',
          isQuickMatchRoute
            ? 'h-[100dvh] min-h-0 md:h-auto md:min-h-screen'
            : 'min-h-0 min-h-screen',
        )}
      >
        {/* Top Menu */}
        <header
          className={cn(
            'sticky top-0 z-40 flex min-h-12 shrink-0 flex-row items-start justify-between gap-2 border-b border-white/10 bg-deep-black/90 px-3 py-2 backdrop-blur-md supports-[padding:max(0px)]:pt-[max(0.5rem,env(safe-area-inset-top,0px))] sm:min-h-16 sm:gap-3 sm:px-4 md:px-8',
            isQuickMatchRoute && 'hidden md:flex',
          )}
        >
          <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-4">
            <button 
              className="shrink-0 text-white transition-colors hover:text-neon-yellow md:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <TrainerAvatarHeaderControl />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[9px] font-bold uppercase tracking-widest text-neon-yellow sm:text-[10px]">
                Bem-vindo
              </span>
              <span className="truncate font-display text-xs font-bold tracking-wider text-white sm:text-sm">
                Olá, Treinador
              </span>
            </div>
          </div>

          <div className="flex min-w-0 shrink-0 items-start justify-end">
            {getPageAction(location.pathname)}
          </div>
        </header>

        <div
          className={cn(
            'flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden',
            isQuickMatchRoute && 'min-h-0 overflow-y-auto overflow-x-hidden md:min-h-0 md:overflow-visible',
            location.pathname === '/match' || location.pathname === '/match/live'
              ? ''
              : isQuickMatchRoute
                ? 'md:p-8 md:pb-8'
                : 'p-3 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] sm:p-4 md:p-8 md:pb-8',
          )}
        >
          {children}
        </div>
      </main>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 z-[60] md:hidden backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed top-0 left-0 bottom-0 w-64 bg-deep-black border-r border-white/10 z-[70] md:hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neon-yellow flex items-center justify-center font-display font-bold text-2xl text-black -skew-x-6">
                    <span className="skew-x-6">O</span>
                  </div>
                  <h1 className="text-2xl font-display font-black tracking-widest text-white italic">OLEFOOT</h1>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-4">
                {drawerNavItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-4 px-4 py-3 transition-all duration-200 group relative rounded-lg",
                        isActive ? "bg-white/10 text-white" : "text-gray-500 hover:text-white hover:bg-white/5"
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-2 bottom-2 w-1 bg-neon-yellow rounded-r" />
                      )}
                      <item.icon className={cn("w-5 h-5", isActive ? "text-neon-yellow" : "group-hover:text-neon-yellow transition-colors")} />
                      <span className="font-display font-bold tracking-wider text-lg">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="p-6 border-t border-white/10 bg-[#0a0a0a]">
                <Link to="/match/quick" onClick={() => setIsMobileMenuOpen(false)} className="btn-primary w-full flex justify-center">
                  <span className="btn-primary-inner">
                    <Play className="w-5 h-5 fill-black" />
                    DIA DE JOGO
                  </span>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Nav */}
      {!hideMobileBottomNav && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around border-t border-white/10 bg-[#0a0a0a] p-2 pb-safe">
          {mainNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1 transition-all [-webkit-tap-highlight-color:transparent]',
                  isActive ? 'text-neon-yellow' : 'text-gray-500',
                )}
              >
                {isActive && <div className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-neon-yellow" />}
                <item.icon className="h-6 w-6 shrink-0" />
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
