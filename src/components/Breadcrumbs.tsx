import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        'flex items-center gap-2 text-sm overflow-x-auto pb-2 -mb-2',
        className,
      )}
    >
      {/* Home sempre visível */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-white/50 hover:text-neon-yellow transition-colors shrink-0"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}
      >
        <Home className="w-3.5 h-3.5" aria-hidden />
        <span className="hidden sm:inline">Home</span>
      </Link>

      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <div key={i} className="inline-flex items-center gap-2 shrink-0">
            <ChevronRight className="w-3.5 h-3.5 text-white/25" aria-hidden />
            {item.href && !isLast ? (
              <Link
                to={item.href}
                className="text-white/50 hover:text-neon-yellow transition-colors"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  'whitespace-nowrap',
                  isLast ? 'text-neon-yellow' : 'text-white/50',
                )}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
