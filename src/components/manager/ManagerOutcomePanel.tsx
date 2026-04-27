import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Padrão Olefoot — feedback para managers (erro, sucesso, confirmação de resultado).
 *
 * **Regras de produto**
 * - Título curto (o que aconteceu).
 * - Corpo: uma frase dizendo o que falta para a ação funcionar, ou o que foi feito com sucesso.
 * - Sempre oferecer pelo menos um botão: CTA de resolução (ir corrigir) ou “Fechar” / “Sair”.
 * - Erros: tom claro, sem culpar o jogador; indicar o próximo passo.
 * - Sucesso: confirmar o resultado e, se fizer sentido, um CTA para o passo seguinte (ex.: Meu Time, Wallet).
 *
 * Use `variant="success"` também para confirmações de ação concluída (compra, gravação, etc.).
 */
export type ManagerOutcomeVariant = 'success' | 'error' | 'info';

export type ManagerOutcomePanelAction = {
  label: string;
  onClick: () => void;
  /** primary = destaque (amarelo / ação principal), secondary = borda, ghost = texto */
  variant?: 'primary' | 'secondary' | 'ghost';
};

export type ManagerOutcomePanelProps = {
  open: boolean;
  variant: ManagerOutcomeVariant;
  title: string;
  message: string;
  actions: ReadonlyArray<ManagerOutcomePanelAction>;
  /** Fechar pelo X e pelo fundo (quando definido). */
  onDismiss?: () => void;
};

const shell: Record<ManagerOutcomeVariant, { border: string; bg: string; icon: typeof CheckCircle2; iconWrap: string; iconClass: string }> = {
  success: {
    border: 'border-emerald-500/45',
    bg: 'bg-[#0a1210]',
    icon: CheckCircle2,
    iconWrap: 'border-emerald-400/40 bg-emerald-500/15',
    iconClass: 'text-emerald-300',
  },
  error: {
    border: 'border-rose-500/45',
    bg: 'bg-[#120a0c]',
    icon: AlertCircle,
    iconWrap: 'border-rose-400/40 bg-rose-500/15',
    iconClass: 'text-rose-300',
  },
  info: {
    border: 'border-cyan-500/40',
    bg: 'bg-[#0a1014]',
    icon: Info,
    iconWrap: 'border-cyan-400/35 bg-cyan-500/12',
    iconClass: 'text-cyan-200',
  },
};

export function ManagerOutcomePanel({
  open,
  variant,
  title,
  message,
  actions,
  onDismiss,
}: ManagerOutcomePanelProps) {
  if (!open) return null;

  const s = shell[variant];
  const Icon = s.icon;
  const role = variant === 'error' ? 'alertdialog' : 'dialog';
  const ariaLive = variant === 'error' ? 'assertive' : 'polite';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-6"
      role="presentation"
      onClick={() => onDismiss?.()}
    >
      <div
        role={role}
        aria-modal="true"
        aria-labelledby="manager-outcome-title"
        aria-describedby="manager-outcome-desc"
        aria-live={ariaLive}
        className={cn(
          'relative w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl',
          s.border,
          s.bg,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-2 top-2 rounded-full p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
        <div className="flex gap-3 px-4 pb-4 pt-5 sm:px-5">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
              s.iconWrap,
            )}
          >
            <Icon className={cn('h-5 w-5', s.iconClass)} aria-hidden />
          </div>
          <div className="min-w-0 flex-1 pr-6">
            <h2 id="manager-outcome-title" className="font-display text-sm font-black uppercase tracking-wide text-white">
              {title}
            </h2>
            <p id="manager-outcome-desc" className="mt-2 text-sm leading-relaxed text-gray-300">
              {message}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {actions.map((a, i) => (
                <button
                  key={`${a.label}-${i}`}
                  type="button"
                  onClick={a.onClick}
                  className={cn(
                    'min-h-[44px] rounded-xl px-4 py-3 font-display text-[10px] font-black uppercase tracking-wide transition sm:flex-1',
                    a.variant === 'primary' || (!a.variant && i === 0)
                      ? 'btn-primary border-0'
                      : a.variant === 'ghost'
                        ? 'text-gray-400 hover:bg-white/5 hover:text-white'
                        : 'border border-white/20 bg-white/[0.06] text-white hover:bg-white/10',
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
