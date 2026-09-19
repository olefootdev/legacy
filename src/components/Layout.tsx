import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Users,
  ArrowRightLeft,
  Wallet,
  Target,
  Trophy,
  Crown,
  User,
  Settings,
  Bell,
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
import { NotificationsDropdown } from '@/components/NotificationsDropdown';
import { getGameState, useGameStore } from '@/game/store';
import { formatExp } from '@/systems/economy';
import { getSupabase, isSupabaseConfigured } from '@/supabase/client';
import { signOutGame } from '@/supabase/auth';
import { hydrateManagerFirstNameFromSupabase } from '@/supabase/profileDisplayName';
import { applyPendingCredits } from '@/wallet/applyPendingCredits';
import { restoreWalletIfEmpty, startWalletAutoBackup } from '@/wallet/walletDurability';
import { LegacyOlefootWelcomeToast } from '@/components/LegacyOlefootWelcomeToast';
import { CoachActionApproval } from '@/components/CoachActionApproval';
import { ManagerScoreToast } from '@/components/ManagerScoreToast';
import { useTotalManagers } from '@/hooks/useTotalManagers';
import { MatchModeBottomSheet } from '@/components/MatchModeBottomSheet';
import { OleSmartHubPanel, OleSmartHubDrawer, OleSmartHubTrigger } from '@/components/OleSmartHub';

type NavItem = {
  icon: typeof Home;
  label: string;
  path: string;
  /** Item editorial — usa Moret italic neon-yellow + ícone amarelo
   *  permanente (sem depender do estado active). */
  accent?: boolean;
};

const mainNavItems: NavItem[] = [
  { icon: Home, label: 'HOME', path: '/' },
  { icon: Users, label: 'CLUBE', path: '/clube' },
  { icon: Trophy, label: 'COMPETIÇÃO', path: '/competicao' },
  { icon: Crown, label: 'LEGENDS', path: '/legend' },
  { icon: ArrowRightLeft, label: 'MERCADO', path: '/mercado' },
  { icon: User, label: 'MANAGER', path: '/manager' },
  { icon: Wallet, label: 'WALLET', path: '/wallet' },
];

/** Bottom nav (mobile <lg) — 5 slots fixos.
 *  Slot central é especial: JOGAR (BOLA) abre o MatchModeBottomSheet
 *  em vez de navegar. Modelado como `kind: 'action'` (sem path).
 *  Itens normais são `kind: 'link'` com `path` obrigatório. */
type BottomNavLink = {
  kind: 'link';
  icon: typeof Home;
  label: string;
  path: string;
};
type BottomNavAction = {
  kind: 'action';
  label: string;
  /** Identificador interno — Layout decide o handler pelo id. */
  actionId: 'open-match-modes';
};
type BottomNavItem = BottomNavLink | BottomNavAction;

const bottomNavItems: BottomNavItem[] = [
  { kind: 'link', icon: Home, label: 'INÍCIO', path: '/' },
  { kind: 'link', icon: Users, label: 'CLUBE', path: '/clube' },
  { kind: 'action', label: 'JOGAR', actionId: 'open-match-modes' },
  { kind: 'link', icon: ArrowRightLeft, label: 'MERCADO', path: '/mercado' },
  { kind: 'link', icon: Trophy, label: 'COMPETIÇÃO', path: '/competicao' },
];

/** Item secundário — mora no rodapé do menu lateral, perto do SAIR.
 *  Renderizado em Inter regular (não vira item principal "perdido"). */
const secondaryNavItems: NavItem[] = [
  { icon: GraduationCap, label: 'Como jogar', path: '/ajuda' },
];

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [matchModeSheetOpen, setMatchModeSheetOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const oleBalance = useGameStore((s) => s.finance.ole);
  const totalManagers = useTotalManagers();
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
    // Restaura o ledger da nuvem se o
    // localStorage estiver vazio (navegador limpo), depois liga o auto-backup.
    const syncWalletDurability = () => {
      void restoreWalletIfEmpty().finally(() => startWalletAutoBackup());
    };
    void run();
    void applyPendingCredits();
    syncWalletDurability();
    const sb = getSupabase();
    if (!sb) {
      return () => { cancelled = true; };
    }
    const { data: { subscription } } = sb.auth.onAuthStateChange(() => {
      void run();
      void applyPendingCredits();
      syncWalletDurability();
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

  // Swipe da borda direita para abrir o Smart Hub (mobile/tablet, < xl)
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const EDGE_ZONE = 28;
  const SWIPE_THRESHOLD = 60;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t.clientX >= window.innerWidth - EDGE_ZONE) {
      swipeStartX.current = t.clientX;
      swipeStartY.current = t.clientY;
    } else {
      swipeStartX.current = null;
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (swipeStartX.current === null || swipeStartY.current === null) return;
    const t = e.changedTouches[0];
    const dx = swipeStartX.current - t.clientX;
    const dy = Math.abs(t.clientY - swipeStartY.current);
    swipeStartX.current = null;
    if (dx > SWIPE_THRESHOLD && dy < dx * 1.2) {
      setHubOpen(true);
    }
  }, []);

  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOutGame();
    } catch { /* timeout ou erro — prossegue */ }
    window.location.href = '/login';
  };

  const coachGreetingName = remoteManagerFirst ?? (localManagerFirst || null);
  const coachGreetingLine = coachGreetingName ? `Olá, ${coachGreetingName}` : 'Olá, Treinador';
  const isQuickMatchRoute = location.pathname === '/match/quick';
  const isPenaltyRoute =
    location.pathname === '/match/penalty' ||
    location.pathname === '/match/penalty-legacy';
  const isImmersiveMatchRoute =
    location.pathname === '/match' ||
    location.pathname === '/match/live' ||
    isPenaltyRoute;
  const hideMobileBottomNav =
    location.pathname === '/match' ||
    location.pathname === '/match/live' ||
    location.pathname === '/match/quick' ||
    isPenaltyRoute;

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
    <div
      className="flex min-h-[100dvh] w-full max-w-[100vw] min-w-0 flex-col overflow-x-hidden bg-deep-black font-sans lg:flex-row"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {signingOut && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-neon-yellow" />
            <span className="text-sm text-white/70">Salvando progresso...</span>
          </div>
        </div>
      )}

      <LegacyOlefootWelcomeToast />

      {/* Desktop Sidebar — visible only at ≥1024px */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-panel border border-white/5 overflow-x-hidden overflow-y-visible border-r border-white/10 fixed h-screen z-50 rounded-none">
        <div className="flex items-center mb-10 p-6 pb-0">
          <img
            src="/brand/olefoot-yellow-01.svg"
            alt="Olefoot"
            className="w-auto"
            style={{ height: '24px' }}
          />
        </div>

        <nav className="flex-1 overflow-y-auto space-y-1 px-4">
          {mainNavItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            const isAccent = item.accent === true;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-4 px-4 py-3 transition-all duration-200 group relative',
                  isAccent
                    ? 'text-neon-yellow'
                    : isActive
                      ? 'text-white'
                      : 'text-gray-500 hover:text-white',
                )}
              >
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-neon-yellow" />}
                <item.icon
                  className={cn(
                    'w-5 h-5',
                    isAccent
                      ? 'text-neon-yellow'
                      : isActive
                        ? 'text-neon-yellow'
                        : 'group-hover:text-neon-yellow transition-colors',
                  )}
                />
                {isAccent ? (
                  <span
                    className="italic text-neon-yellow leading-none"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontWeight: 700,
                      fontSize: '24px',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {item.label.charAt(0) + item.label.slice(1).toLowerCase()}
                  </span>
                ) : (
                  <span className="font-display font-bold tracking-wider text-lg">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Botão JOGAR — desktop sidebar */}
        <div className="px-4 pb-2">
          <button
            type="button"
            onClick={() => setMatchModeSheetOpen(true)}
            aria-expanded={matchModeSheetOpen}
            className="group w-full flex items-center gap-4 px-4 py-3 transition-all duration-200 bg-neon-yellow hover:bg-neon-yellow/85 active:scale-[0.98] rounded-lg"
          >
            <span className="flex h-5 w-5 items-center justify-center">
              <img src="/test-botao-01-01.svg" alt="" aria-hidden className="w-5 h-5" />
            </span>
            <span
              className="italic text-black leading-none"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontWeight: 700,
                fontSize: '24px',
                letterSpacing: '-0.01em',
              }}
            >
              Jogar
            </span>
          </button>
        </div>

        {/* Bloco secundário: link "| Como jogar" em Inter regular,
            visual de footer link (não compete com nav principal) */}
        <div className="px-8 pt-1 pb-2">
          {secondaryNavItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'inline-flex items-center gap-2 transition-colors',
                  isActive ? 'text-white' : 'text-white/55 hover:text-neon-yellow',
                )}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  fontWeight: 500,
                  letterSpacing: '0.01em',
                }}
              >
                <span aria-hidden className="text-white/35">|</span>
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Status do jogo — Fase Beta sempre visível + número real de clubes. */}
        <div className="mx-4 mb-3 px-4 py-3 border border-white/10 bg-white/[0.02]" style={{ borderRadius: 'var(--radius-sm)' }}>
          <p className="text-white/55" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600 }}>
            Status do jogo
          </p>
          <p
            className="mt-1"
            style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500 }}
          >
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 text-neon-yellow"
              style={{
                border: '1px solid var(--color-divider-yellow-strong)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--color-neon-yellow)' }}
                aria-hidden
              />
              Fase Beta
            </span>
          </p>
          <p
            className="text-white/70 mt-2"
            style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500 }}
          >
            Clubes criados:{' '}
            <span className="text-neon-yellow font-semibold tabular-nums">
              {totalManagers != null ? totalManagers.toLocaleString('pt-BR') : '—'}
            </span>
          </p>
        </div>

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
          'flex min-w-0 flex-1 flex-col overflow-x-hidden lg:ml-64 xl:mr-72',
          isQuickMatchRoute
            ? 'h-[100dvh] min-h-0 lg:h-auto lg:min-h-screen'
            : isImmersiveMatchRoute
              ? 'min-h-screen'
              : 'min-h-0',
        )}
      >
        {/* Top Header — 3 zonas: [hamburger mobile] · [LOGO centro] · [ação rápida] */}
        {/* IMPORTANTE: Logo SEMPRE visível em todas as páginas e subpáginas */}
        {!isPenaltyRoute && (
        <header
          className="sticky top-0 z-40 grid grid-cols-[1fr_auto_1fr] min-h-14 shrink-0 items-center gap-3 border-b border-white/[0.07] bg-nav px-4 supports-[padding:max(0px)]:pt-[max(0px,env(safe-area-inset-top,0px))] sm:min-h-16 sm:px-6"
        >
          {/* Esquerda — hamburger (só abaixo de lg; desktop tem sidebar) */}
          <div className="flex justify-start">
            <button
              type="button"
              className="shrink-0 grid place-items-center text-white transition-colors hover:text-neon-yellow lg:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-6 w-6" strokeWidth={2.25} />
            </button>
          </div>

          {/* Centro — Logo Olefoot SEMPRE CENTRALIZADA no topmenu */}
          {/* Apenas ícone amarelo */}
          <div className="justify-self-center flex items-center justify-center">
            <Link
              to="/"
              className="flex items-center justify-center"
              aria-label="Olefoot — início"
            >
              <img src="/brand/olefoot-icone-yellow-01.svg" alt="Olefoot" className="h-8 w-8 sm:h-9 sm:w-9" />
            </Link>
          </div>

          {/* Direita — 3 ícones importantes: Notificações, Wallet, Config */}
          <div className="flex justify-end items-center gap-2 sm:gap-3">
            {/* Notificações com dropdown inteligente */}
            <NotificationsDropdown />

            {/* Wallet */}
            <Link
              to="/wallet"
              className="flex h-10 w-10 items-center justify-center border border-white/16 bg-nav text-white/80 transition-colors hover:border-white hover:text-white"
              aria-label="Wallet"
            >
              <Wallet className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2.25} />
            </Link>

            {/* Config */}
            <Link
              to="/manager/config"
              className="flex h-10 w-10 items-center justify-center border border-white/16 bg-nav text-white/80 transition-colors hover:border-white hover:text-white"
              aria-label="Configurações"
            >
              <Settings className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2.25} />
            </Link>

            {/* Smart Hub trigger (mobile/tablet) */}
            <OleSmartHubTrigger
              onClick={() => setHubOpen(true)}
              hasActivity={true}
            />
          </div>
        </header>
        )}

        <div
          className={cn(
            'flex w-full min-w-0 max-w-[100vw] flex-1 flex-col overflow-x-hidden',
            isQuickMatchRoute &&
              'min-h-0 overflow-y-auto [-webkit-overflow-scrolling:touch] lg:overflow-visible',
            location.pathname === '/match' || location.pathname === '/match/live' || isPenaltyRoute
              ? ''
              : isQuickMatchRoute
                ? 'lg:py-8'
                : 'pt-6 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:pt-8 lg:pt-10 lg:pb-8',
            location.pathname !== '/match' &&
              location.pathname !== '/match/live' &&
              !isPenaltyRoute &&
              'xl:px-6 2xl:px-10',
          )}
        >
          {children}
        </div>
        <OleSmartHubPanel />
      </main>
      <CoachActionApproval />
      <ManagerScoreToast />
      <OleSmartHubDrawer open={hubOpen} onClose={() => setHubOpen(false)} />

      {/* Mobile / Tablet Drawer — slides in below lg */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 z-[60] lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-deep-black border-r border-white/10 z-[70] lg:hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <img
                  src="/brand/olefoot-yellow-01.svg"
                  alt="Olefoot"
                  className="w-auto"
                  style={{ height: '22px' }}
                />
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
                {mainNavItems.map((item) => {
                  const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                  const isAccent = item.accent === true;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 group relative',
                        isAccent
                          ? 'text-neon-yellow hover:bg-neon-yellow/[0.06]'
                          : isActive
                            ? 'bg-white/10 text-white'
                            : 'text-gray-500 hover:text-white hover:bg-white/5',
                      )}
                    >
                      {isActive && <div className="absolute left-0 top-2 bottom-2 w-1 bg-neon-yellow rounded-r" />}
                      <item.icon
                        className={cn(
                          'w-5 h-5',
                          isAccent
                            ? 'text-neon-yellow'
                            : isActive
                              ? 'text-neon-yellow'
                              : 'group-hover:text-neon-yellow transition-colors',
                        )}
                      />
                      {isAccent ? (
                        <span
                          className="italic text-neon-yellow leading-none"
                          style={{
                            fontFamily: 'var(--font-serif-hero)',
                            fontWeight: 700,
                            fontSize: '22px',
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {item.label.charAt(0) + item.label.slice(1).toLowerCase()}
                        </span>
                      ) : (
                        <span className="font-display font-bold tracking-wider">{item.label}</span>
                      )}
                    </Link>
                  );
                })}
              </nav>

              {/* Link "| Como jogar" em Inter regular */}
              <div className="px-8 pt-1 pb-2">
                {secondaryNavItems.map((item) => {
                  const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        'inline-flex items-center gap-2 transition-colors',
                        isActive ? 'text-white' : 'text-white/55 hover:text-neon-yellow',
                      )}
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '13px',
                        fontWeight: 500,
                        letterSpacing: '0.01em',
                      }}
                    >
                      <span aria-hidden className="text-white/35">|</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>

              <div className="mx-4 mb-3 px-4 py-3 border border-white/10 bg-white/[0.02]" style={{ borderRadius: 'var(--radius-sm)' }}>
                <p className="text-white/55" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600 }}>
                  Status do jogo
                </p>
                <p
                  className="mt-1"
                  style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500 }}
                >
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 text-neon-yellow"
                    style={{
                      border: '1px solid var(--color-divider-yellow-strong)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '11px',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                    }}
                  >
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ background: 'var(--color-neon-yellow)' }}
                      aria-hidden
                    />
                    Fase Beta
                  </span>
                </p>
                <p
                  className="text-white/70 mt-2"
                  style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500 }}
                >
                  Clubes criados:{' '}
                  <span className="text-neon-yellow font-semibold tabular-nums">
                    {totalManagers != null ? totalManagers.toLocaleString('pt-BR') : '—'}
                  </span>
                </p>
              </div>

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

      {/* Mobile Bottom Nav — VOLT2 (hidden at lg+): faixa chapada, rótulo curto,
          risco volt no ativo e o JOGAR como círculo elevado. Sem gradiente,
          sem halo, sem vidro fosco. */}
      {!hideMobileBottomNav && (
        <nav
          aria-label="Navegação principal"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 items-start border-t border-white/[0.07] bg-nav pb-safe"
        >
          {bottomNavItems.map((item) => {
            if (item.kind === 'action') {
              return (
                <div key={item.actionId} className="flex justify-center">
                  <button
                    type="button"
                    aria-label={item.label}
                    aria-haspopup="dialog"
                    aria-expanded={matchModeSheetOpen}
                    onClick={() => setMatchModeSheetOpen(true)}
                    className="-mt-5 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-nav ring-1 ring-white/[0.08] transition-colors [-webkit-tap-highlight-color:transparent] hover:ring-neon-yellow/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-yellow"
                  >
                    {/* Símbolo em volt sobre o círculo escuro (o SVG de antes era preto, feito pro amarelo). */}
                    <img src="/brand/olefoot-icone-yellow-01.svg" alt="" draggable={false} className="h-11 w-11 object-contain" />
                  </button>
                </div>
              );
            }

            const isActive =
              location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-16 min-w-0 flex-col items-center gap-[5px] px-0.5 pt-3 pb-2 transition-colors [-webkit-tap-highlight-color:transparent]',
                  isActive ? 'text-white' : 'text-poeira hover:text-white/90',
                )}
              >
                {isActive ? (
                  <span aria-hidden className="absolute left-1/2 top-[-1px] h-0.5 w-6 -translate-x-1/2 bg-neon-yellow" />
                ) : null}
                <Icon className="h-[22px] w-[22px] shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
                <span className={cn('block max-w-full truncate text-[10px] leading-none', isActive ? 'font-semibold' : 'font-medium')}>
                  {item.label.charAt(0) + item.label.slice(1).toLowerCase()}
                </span>
              </Link>
            );
          })}
        </nav>
      )}

      {/* Bottom sheet de modos de partida (acionado pelo slot JOGAR) */}
      <MatchModeBottomSheet
        open={matchModeSheetOpen}
        onClose={() => setMatchModeSheetOpen(false)}
      />
    </div>
  );
}
