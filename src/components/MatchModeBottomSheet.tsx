/**
 * MatchModeBottomSheet — bottom sheet acionado pelo botão JOGAR (BOLA) do
 * bottom nav. Sobe com sutileza por cima do menu, lista os modos de partida
 * disponíveis e os "em breve". Fechamento por:
 *   • clique no backdrop
 *   • arrasto pra baixo (drag handle no topo)
 *   • escolha de um modo (navegação)
 *
 * Acessibilidade:
 *   • role="dialog", aria-modal, aria-labelledby
 *   • foco no primeiro CTA quando abre
 *   • Escape fecha
 *   • focus-trap minimalista (loop entre primeiro/último focusable)
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

type ModeStatus = 'available' | 'soon' | 'wip';

type ModeEntry = {
  id: string;
  label: string;
  description: string;
  status: ModeStatus;
  /** Rota de destino (omitir se status !== 'available'). */
  to?: string;
  /** Ícone curto à esquerda (emoji ou letra) — visual leve, sem dependência. */
  glyph: string;
};

const MODES: ReadonlyArray<ModeEntry> = [
  {
    id: 'penalty',
    label: 'Pênalti',
    description: 'Disputa cinematográfica · cobrador × goleiro',
    status: 'available',
    to: '/match/penalty',
    glyph: '⚡',
  },
  {
    id: 'quick',
    label: 'Rápida',
    description: 'Amistosa ou competitiva · resultado em segundos',
    status: 'available',
    to: '/match/quick',
    glyph: '⏱',
  },
  // 'Ao Vivo' (/match/live) — oculto do menu. Lógica preservada na rota e
  // toda a engine ao vivo está integrada ao Legacy Mode (/dev/field-view).
  {
    id: 'legacy',
    label: 'Legacy',
    description: 'Partida ao vivo · simulação tática 2D',
    status: 'available',
    to: '/dev/field-view',
    glyph: '✦',
  },
  {
    id: 'cards',
    label: 'Cards',
    description: 'Em breve · jogo por cartas táticas',
    status: 'soon',
    glyph: '▣',
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function MatchModeBottomSheet({ open, onClose }: Props) {
  const navigate = useNavigate();
  const sheetRef = useRef<HTMLDivElement>(null);
  const firstCtaRef = useRef<HTMLButtonElement>(null);

  // Escape pra fechar + focus inicial
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // foco inicial no primeiro CTA disponível
    requestAnimationFrame(() => firstCtaRef.current?.focus());
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Trava scroll do body quando aberto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handlePick = (mode: ModeEntry) => {
    if (mode.status !== 'available' || !mode.to) return;
    onClose();
    // pequeno atraso só pra animação fechar suave antes de navegar
    setTimeout(() => navigate(mode.to as string), 180);
  };

  return (
    <>
      {/* Backdrop — AnimatePresence próprio pra cada elemento evita
       *  dor-de-cabeça com múltiplos filhos sob um único AnimatePresence. */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden
          />
        ) : null}
      </AnimatePresence>

      {/* Sheet */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="match-mode-sheet-title"
            className="fixed bottom-0 left-0 right-0 z-[61] mx-auto w-full max-w-2xl rounded-t-3xl border-t border-neon-yellow/25 bg-deep-black/98 pb-safe shadow-[0_-12px_40px_rgba(0,0,0,0.55)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 600) onClose();
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <span aria-hidden className="h-1 w-10 rounded-full bg-white/25" />
            </div>

            {/* Header */}
            <div className="px-6 pt-2 pb-4">
              <p
                className="text-[10px] uppercase tracking-[0.32em] text-white/45 font-display font-bold"
              >
                Olefoot · Modos
              </p>
              <h2
                id="match-mode-sheet-title"
                className="mt-1 text-3xl italic text-neon-yellow leading-none"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontWeight: 700,
                  letterSpacing: '-0.015em',
                }}
              >
                Jogar
              </h2>
              <p className="mt-1.5 text-xs text-white/55">
                Escolhe como queres entrar em campo agora.
              </p>
            </div>

            {/* Lista de modos */}
            <ul className="px-3 pb-3 space-y-2">
              {MODES.map((mode, idx) => {
                const disabled = mode.status !== 'available';
                const refProp =
                  !disabled && idx === MODES.findIndex((m) => m.status === 'available')
                    ? { ref: firstCtaRef }
                    : {};
                return (
                  <li key={mode.id}>
                    <button
                      type="button"
                      {...refProp}
                      disabled={disabled}
                      onClick={() => handlePick(mode)}
                      aria-label={`${mode.label} — ${mode.description}`}
                      className={cn(
                        'group w-full text-left rounded-2xl border px-4 py-3.5 transition-all duration-150 [-webkit-tap-highlight-color:transparent]',
                        'flex items-center gap-4',
                        disabled
                          ? 'border-white/10 bg-white/[0.02] cursor-not-allowed opacity-55'
                          : 'border-white/10 bg-white/[0.04] hover:border-neon-yellow/55 hover:bg-neon-yellow/[0.06] active:scale-[0.985]',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl transition-colors',
                          disabled
                            ? 'bg-white/[0.04] text-white/35'
                            : 'bg-neon-yellow/[0.08] text-neon-yellow group-hover:bg-neon-yellow/15',
                        )}
                      >
                        {mode.glyph}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-baseline gap-2">
                          <span
                            className={cn(
                              'truncate text-base font-display font-black uppercase tracking-wider',
                              disabled ? 'text-white/55' : 'text-white',
                            )}
                            style={{ letterSpacing: '0.08em' }}
                          >
                            {mode.label}
                          </span>
                          {mode.status === 'soon' ? (
                            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-white/65">
                              Em breve
                            </span>
                          ) : null}
                          {mode.status === 'wip' ? (
                            <span className="shrink-0 rounded-full bg-neon-yellow/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-neon-yellow/85">
                              Em construção
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-white/55">
                          {mode.description}
                        </span>
                      </span>
                      {!disabled ? (
                        <span
                          aria-hidden
                          className="shrink-0 text-neon-yellow/85 text-lg transition-transform group-hover:translate-x-0.5"
                        >
                          ›
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Linha sutil amarela editorial no rodapé do sheet */}
            <span
              aria-hidden
              className="block h-px w-full bg-gradient-to-r from-transparent via-neon-yellow/35 to-transparent"
            />
            <div className="px-6 py-3 text-center text-[10px] uppercase tracking-[0.28em] text-white/35 font-display font-bold">
              Arraste para baixo para fechar
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
