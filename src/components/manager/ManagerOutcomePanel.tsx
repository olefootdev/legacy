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
    border: 'border-alta/45',
    bg: 'bg-panel',
    icon: CheckCircle2,
    iconWrap: 'border-alta/40 bg-alta/15',
    iconClass: 'text-alta',
  },
  error: {
    border: 'border-baixa/45',
    bg: 'bg-panel',
    icon: AlertCircle,
    iconWrap: 'border-baixa/40 bg-baixa/15',
    iconClass: 'text-baixa',
  },
  info: {
    border: 'border-white/16',
    bg: 'bg-panel',
    icon: Info,
    iconWrap: 'border-white/16 bg-card-hi',
    iconClass: 'text-white',
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
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/85 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
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
          'relative w-full max-w-md overflow-hidden border',
          s.border,
          s.bg,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-2 top-2 p-2 text-cimento transition hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
        <div className="flex gap-3 px-4 pb-4 pt-5 sm:px-5">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center border',
              s.iconWrap,
            )}
          >
            <Icon className={cn('h-5 w-5', s.iconClass)} aria-hidden />
          </div>
          <div className="min-w-0 flex-1 pr-6">
            <h2 id="manager-outcome-title" className="font-impact text-lg uppercase leading-[1.1] text-white">
              {title}
            </h2>
            <p id="manager-outcome-desc" className="mt-2 text-sm leading-relaxed text-giz">
              {message}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {actions.map((a, i) => (
                <button
                  key={`${a.label}-${i}`}
                  type="button"
                  onClick={a.onClick}
                  className={cn(
                    'ole-num min-h-[44px] px-4 py-3 text-[12px] uppercase transition sm:flex-1',
                    a.variant === 'primary' || (!a.variant && i === 0)
                      ? 'btn-primary border-0'
                      : a.variant === 'ghost'
                        ? 'text-cimento hover:bg-white/5 hover:text-white'
                        : 'border border-white/30 text-white hover:border-white',
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
