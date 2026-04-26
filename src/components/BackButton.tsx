import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BackButtonProps = {
  to: string;
  label?: string;
  className?: string;
};

export function BackButton({ to, label = 'Voltar', className }: BackButtonProps) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center gap-1.5 text-white/50 hover:text-neon-yellow transition-colors group',
        className,
      )}
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
      }}
    >
      <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
      <span>{label}</span>
    </Link>
  );
}
