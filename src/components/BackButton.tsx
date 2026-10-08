import { Link } from 'react-router-dom';
import { L } from '@/i18n/L';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BackButtonProps = {
  to: string;
  label?: string;
  className?: string;
};

export function BackButton({ to, label = L('Voltar', 'Back'), className }: BackButtonProps) {
  return (
    <Link
      to={to}
      className={cn(
        'group inline-flex min-h-[40px] items-center gap-1.5 font-prova text-[12px] font-bold uppercase tracking-[0.18em] text-mudo transition-colors hover:text-rua focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rua',
        className,
      )}
    >
      <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
      <span>{label}</span>
    </Link>
  );
}
