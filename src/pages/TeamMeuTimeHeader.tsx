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
      {/* ── Banner / título — editorial Olefoot ─────────────────── */}
      <div
        className="relative overflow-hidden border border-[var(--color-border)]"
        style={{ borderRadius: 'var(--radius-md)' }}
      >
        <GameBannerBackdrop slot="team_header" imageOpacity={0.32} />
        <div className="relative z-10 px-5 sm:px-7 py-6 sm:py-8 flex flex-col items-start gap-3">
          {/* Eyebrow */}
          <div
            className="inline-flex items-center gap-3 text-neon-yellow"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            <span aria-hidden className="h-px w-8 bg-neon-yellow/50" />
            <span
              className="uppercase font-semibold"
              style={{ fontSize: '10px', letterSpacing: '0.22em' }}
            >
              OLE Football · Meu Time
            </span>
          </div>
          {/* Headline — Moret italic case mixto (assinatura /legend) */}
          <h2
            className="italic text-white leading-[1.05] [overflow-wrap:anywhere]"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontWeight: 700,
              fontSize: 'clamp(1.85rem, 4.5vw, 3rem)',
              letterSpacing: '-0.015em',
            }}
          >
            {title}
          </h2>
          {/* Régua decorativa */}
          <span aria-hidden className="block w-12 h-[3px] bg-neon-yellow" />
          {/* Subtítulo */}
          {subtitle != null && (
            <div
              className="text-white/65"
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              {subtitle}
            </div>
          )}
          {actions && <div className="mt-1 w-full">{actions}</div>}
        </div>
      </div>

      {/* ── Tab bar scoreboard-tape — sticky abaixo do header global ── */}
      <div className="sticky top-12 sm:top-14 z-30 -mx-3 sm:-mx-4 lg:-mx-8 bg-deep-black/95 backdrop-blur-md border-b border-[var(--color-border)] shadow-md">
        <div className="hide-scrollbar flex gap-0 overflow-x-auto px-3 sm:px-4 lg:px-8">
          {TABS.map((tab) => {
            const active = tabActive(pathname, tab.path);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigate(tab.path)}
                className={cn(
                  'relative shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap px-3 sm:px-5 py-3 transition-colors [-webkit-tap-highlight-color:transparent]',
                  active ? 'text-neon-yellow' : 'text-white/45 hover:text-white/85',
                )}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '11px',
                  letterSpacing: '0.18em',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-neon-yellow"
                  />
                )}
                <tab.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className={active ? 'pl-0.5' : ''}>{tab.label}</span>
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 right-0 -bottom-px h-[2px] bg-neon-yellow"
                  />
                )}
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
