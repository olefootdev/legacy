import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Building2, ArrowRightLeft, Wallet, Target, Trophy, User, Settings, Play, Menu, X } from 'lucide-react';
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
  { icon: Trophy, label: 'LIGAS', path: '/leagues' },
  { icon: User, label: 'PROFILE', path: '/profile' },
  { icon: Settings, label: 'CONFIG', path: '/config' },
];

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isQuickMatchRoute = location.pathname === '/match/quick';
  const hideMobileBottomNav =
    location.pathname === '/match' || location.pathname === '/match/quick';

  const getPageAction = (pathname: string) => {
    switch (pathname) {
      case '/':
        return (
          <Link to="/match" className="btn-primary text-xs py-2 px-4 flex items-center gap-2">
            <span className="btn-primary-inner px-2">
              <Play className="w-3 h-3 fill-black" /> Próximo Jogo
            </span>
          </Link>
        );
      case '/match':
        return (
          <button className="btn-primary text-xs py-2 px-4 flex items-center gap-2">
            <span className="btn-primary-inner px-2">
              <Settings className="w-3 h-3" /> Tática
            </span>
          </button>
        );
      default:
        return <HeaderOtzStrip />;
    }
  };

  return (
    <div className="min-h-screen bg-deep-black flex flex-col md:flex-row font-sans">
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
          <Link to="/match" className="btn-primary w-full flex justify-center">
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
          'flex flex-1 flex-col md:ml-64',
          isQuickMatchRoute
            ? 'h-[100dvh] min-h-0 md:h-auto md:min-h-screen'
            : 'min-h-screen',
        )}
      >
        {/* Top Menu */}
        <header
          className={cn(
            'sticky top-0 z-40 shrink-0 flex h-16 items-center justify-between border-b border-white/10 bg-deep-black/90 px-4 backdrop-blur-md md:px-8',
            isQuickMatchRoute && 'hidden md:flex',
          )}
        >
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden text-white hover:text-neon-yellow transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <TrainerAvatarHeaderControl />
            <div className="flex min-w-0 flex-col">
              <span className="text-[10px] text-neon-yellow font-bold uppercase tracking-widest">Bem-vindo</span>
              <span className="text-sm font-display font-bold text-white tracking-wider">Olá, Treinador</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {getPageAction(location.pathname)}
          </div>
        </header>

        <div
          className={cn(
            'flex flex-1 flex-col',
            isQuickMatchRoute && 'min-h-0 overflow-hidden md:min-h-0 md:overflow-visible',
            location.pathname === '/match'
              ? ''
              : isQuickMatchRoute
                ? 'md:p-8 md:pb-8'
                : 'p-4 pb-24 md:p-8 md:pb-8',
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
                <Link to="/match" onClick={() => setIsMobileMenuOpen(false)} className="btn-primary w-full flex justify-center">
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
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-white/10 p-2 pb-safe z-50 flex justify-around items-center">
          {mainNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 transition-all relative",
                  isActive ? "text-neon-yellow" : "text-gray-500"
                )}
              >
                {isActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-neon-yellow rounded-full" />}
                <item.icon className="w-6 h-6" />
                <span className="text-[9px] font-display font-bold tracking-wider">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
