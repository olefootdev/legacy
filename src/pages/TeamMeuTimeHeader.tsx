import type { ReactNode } from 'react';
import {
  Users,
  Building2,
  Dumbbell,
  UserPlus,
  FlaskConical,
  LineChart,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { GameBannerBackdrop } from '@/components/GameBannerBackdrop';
import { VeracityPillarsStrip } from '@/components/VeracityPillarsStrip';

const TABS = [
  { id: 'elenco', label: 'ELENCO', icon: Users, path: '/team' },
  { id: 'evolutiva', label: 'LINHA', icon: LineChart, path: '/team/linha-evolutiva' },
  { id: 'clube', label: 'CLUBE', icon: Building2, path: '/city' },
  { id: 'treino', label: 'TREINO', icon: Dumbbell, path: '/team/treino' },
  { id: 'staff', label: 'STAFF', icon: UserPlus, path: '/team/staff' },
  { id: 'ailabs', label: 'AI LABS', icon: FlaskConical, path: '/team/ailabs' },
] as const;

function tabActive(pathname: string, path: string): boolean {
  if (path === '/team') return pathname === '/team';
  return pathname === path;
}

export type TeamMeuTimeHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  /** Linha extra sob o subtítulo (ex.: botões de formação no elenco). */
  actions?: ReactNode;
  showVeracity?: boolean;
  veracityClassName?: string;
};

export function TeamMeuTimeHeader({
  title,
  subtitle,
  actions,
  showVeracity = true,
  veracityClassName,
}: TeamMeuTimeHeaderProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <>
      {/* ── Banner / título ─────────────────────────────────────── */}
      <div className="relative rounded-xl overflow-hidden">
        <GameBannerBackdrop slot="team_header" imageOpacity={0.35} />
        <div className="relative z-10 px-3 pt-3 pb-3 md:px-4 md:pt-4 md:pb-4">
          <h2 className="font-display text-2xl font-black italic uppercase tracking-wider md:text-4xl">
            {title}
          </h2>
          {subtitle != null && (
            <div className="mt-0.5 text-[10px] font-medium text-gray-400 md:mt-1 md:text-sm">
              {subtitle}
            </div>
          )}
          {actions && <div className="mt-2">{actions}</div>}
        </div>
      </div>

      {/* ── Tab bar — sticky abaixo do header global do Layout ──── */}
      {/* top-12 = altura do header mobile (min-h-12); sm:top-14 = header sm */}
      <div className="sticky top-12 sm:top-14 z-30 -mx-3 sm:-mx-4 lg:-mx-8 bg-deep-black/95 backdrop-blur-md border-b border-white/10 shadow-md">
        <div className="hide-scrollbar flex gap-0 overflow-x-auto px-3 sm:px-4 lg:px-8">
          {TABS.map((tab) => {
            const active = tabActive(pathname, tab.path);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigate(tab.path)}
                className={cn(
                  'shrink-0 whitespace-nowrap border-b-2 px-3 py-3 font-display text-[10px] font-bold uppercase tracking-wider transition-all [-webkit-tap-highlight-color:transparent] sm:px-4 sm:text-xs md:px-5 md:py-3.5 md:text-[11px]',
                  active
                    ? 'border-neon-yellow text-neon-yellow'
                    : 'border-transparent text-gray-500 hover:text-white hover:border-white/30',
                )}
              >
                <span className="flex items-center gap-1.5">
                  <tab.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Veracidade — abaixo do tab bar, fora do sticky ──────── */}
      {showVeracity && (
        <VeracityPillarsStrip
          className={cn('border-b border-white/10 py-2', veracityClassName)}
        />
      )}
    </>
  );
}
