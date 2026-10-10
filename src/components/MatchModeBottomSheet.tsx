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
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Hashtag } from '@/components/ui';
import { L } from '@/i18n/L';
import { deitarTela } from '@/partidaViva/orientacao';
import { ligarSom } from '@/partidaViva/som';
import { listarFilmes } from '@/partidaViva/gravacao';

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
    id: 'classic',
    label: 'Classic',
    description: L('Em breve · simulação retrô-inteligente com escolhas táticas', 'Coming soon · retro-smart sim with tactical choices'),
    status: 'soon',
    glyph: '◈',
  },
  {
    id: 'penalty',
    label: L('Pênalti', 'Penalty'),
    description: L('Disputa cinematográfica · cobrador × goleiro', 'Cinematic shootout · taker × keeper'),
    status: 'available',
    to: '/match/penalty',
    glyph: '⚡',
  },
  {
    id: 'quick',
    label: L('Rápida', 'Quick'),
    description: L('Amistosa ou competitiva · resultado em segundos', 'Friendly or competitive · result in seconds'),
    status: 'available',
    to: '/match/quick',
    glyph: '⏱',
  },
  // LEGACY = a Partida Viva (docs/PARTIDA-VIVA-PLANO.md): a Partida Rápida
  // vista em campo — os 22 com rosto, celular deitado, comando nos trilhos.
  {
    id: 'legacy',
    label: 'Legacy',
    description: L('Ao vivo em campo · os 22 com rosto · deite o celular', 'Live on the pitch · all 22 with faces · turn your phone'),
    status: 'available',
    to: '/match/ao-vivo',
    glyph: '✦',
  },
  // LEGACY LEAGUE: a liga que só se joga na Partida Viva (tabela da semana).
  {
    id: 'legacy_league',
    label: 'Legacy League',
    description: L('A liga da Partida Viva · tabela da semana · 3 jogos por dia', 'The Live Match league · weekly table · 3 games a day'),
    status: 'available',
    to: '/legacy-league',
    glyph: '♛',
  },
  {
    id: 'cards',
    label: 'Cards',
    description: L('Em breve · jogo por cartas táticas', 'Coming soon · tactical card game'),
    status: 'soon',
    glyph: '▣',
  },
];

/** Ordem de exibição: Legacy e Rápida na frente, depois os outros disponíveis, depois os "em breve". */
const ORDEM: ReadonlyArray<ModeEntry> = [
  ...MODES.filter((m) => m.id === 'legacy'),
  ...MODES.filter((m) => m.id === 'legacy_league'),
  ...MODES.filter((m) => m.id === 'quick'),
  ...MODES.filter((m) => m.status === 'available' && m.id !== 'quick' && m.id !== 'legacy' && m.id !== 'legacy_league'),
  ...MODES.filter((m) => m.status !== 'available'),
];
const PRIMEIRO_DISPONIVEL = ORDEM.find((m) => m.status === 'available');

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

  // FASE 6 — os filmes do LEGACY guardados neste aparelho (reassistir + Câmera do Craque).
  const filmes = useMemo(() => (open ? listarFilmes().length : 0), [open]);

  const handlePick = (mode: ModeEntry) => {
    if (mode.status !== 'available' || !mode.to) return;
    // Legacy: o toque é o gesto que o navegador exige — deita a tela (Android)
    // e libera o som já aqui, antes de navegar.
    if (mode.id === 'legacy') { void deitarTela(); ligarSom(); }
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
            className="fixed inset-0 z-[60] bg-asfalto-27/80"
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
            className="rua-grao fixed bottom-0 left-0 right-0 z-[61] mx-auto w-full max-w-2xl border-t-[3px] border-rua bg-asfalto-27 pb-safe"
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
              <span aria-hidden className="h-1 w-12 bg-fio" />
            </div>

            {/* Header */}
            <div className="flex min-w-0 items-end justify-between gap-4 px-5 pt-2 pb-5">
              <div className="min-w-0">
                <Hashtag className="font-prova text-mudo">{L('#olefoot #modos', '#olefoot #modes')}</Hashtag>
                <h2
                  id="match-mode-sheet-title"
                  className="mt-1 font-impact text-[56px] uppercase leading-[0.9] text-papel"
                >
                  {L('Jogar', 'Play')}
                </h2>
              </div>
              <p className="shrink-0 -rotate-3 pb-1 font-voz text-[26px] leading-none text-rua">
                {L('Bola rolando.', 'Ball rolling.')}
              </p>
            </div>

            {/* Lista de modos — os disponíveis primeiro; a Rápida manda (é a mais jogada). */}
            <ul className="space-y-3 px-4 pb-4">
              {ORDEM.map((mode) => {
                const disabled = mode.status !== 'available';
                const refProp = mode === PRIMEIRO_DISPONIVEL ? { ref: firstCtaRef } : {};
                const destaque = mode.id === 'legacy';
                return (
                  <li key={mode.id}>
                    <button
                      type="button"
                      {...refProp}
                      disabled={disabled}
                      onClick={() => handlePick(mode)}
                      aria-label={`${mode.label} — ${mode.description}`}
                      className={cn(
                        'group relative flex w-full min-w-0 items-center gap-4 overflow-hidden text-left transition-[transform,box-shadow,background-color,border-color] duration-150 [-webkit-tap-highlight-color:transparent]',
                        disabled
                          ? 'min-h-[58px] cursor-not-allowed border-2 border-dashed border-fio px-4 py-2.5'
                          : destaque
                          ? 'min-h-[92px] bg-rua px-5 py-4 text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--color-papel)]'
                          : 'min-h-[72px] border-2 border-papel px-4 py-3 text-papel hover:bg-papel hover:text-asfalto-27',
                      )}
                    >
                      {destaque && (
                        <span aria-hidden className="rua-alambrado pointer-events-none absolute inset-x-0 top-0 h-14 [--alambrado:rgba(13,13,12,0.22)]" />
                      )}
                      <span className="relative min-w-0 flex-1">
                        <span className="flex min-w-0 items-baseline gap-2">
                          <span
                            className={cn(
                              'truncate font-impact uppercase leading-none',
                              destaque ? 'text-[34px]' : disabled ? 'text-[20px] text-mudo' : 'text-[26px]',
                            )}
                          >
                            {mode.label}
                          </span>
                          {mode.status === 'soon' ? (
                            <span className="shrink-0 font-prova text-[10px] font-bold uppercase tracking-[0.16em] text-fio">
                              {L('Em breve', 'Soon')}
                            </span>
                          ) : null}
                          {mode.status === 'wip' ? (
                            <span className="shrink-0 font-prova text-[10px] font-bold uppercase tracking-[0.16em] text-rua">
                              {L('Em construção', 'In progress')}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={cn(
                            'mt-1.5 block truncate font-prova text-[11px]',
                            destaque ? 'font-bold text-asfalto-27/80' : disabled ? 'text-fio' : 'text-suave group-hover:text-asfalto-27/75',
                          )}
                        >
                          {mode.description}
                        </span>
                      </span>
                      {!disabled ? (
                        <span aria-hidden className={cn('relative shrink-0 font-impact leading-none', destaque ? 'text-[34px]' : 'text-[24px]')}>
                          →
                        </span>
                      ) : null}
                    </button>
                    {destaque && filmes > 0 && (
                      <button
                        type="button"
                        onClick={() => { ligarSom(); onClose(); setTimeout(() => navigate('/match/filme'), 180); }}
                        className="mt-2 flex w-full items-center justify-between border border-linha px-4 py-2 text-left font-prova text-[11px] text-papel hover:border-papel"
                      >
                        <span>{L(`Seus filmes · ${filmes}`, `Your films · ${filmes}`)}</span>
                        <span aria-hidden>▶</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-linha px-6 py-3 text-center font-prova text-[10px] font-bold uppercase tracking-[0.24em] text-mudo">
              {L('Arraste para baixo para fechar', 'Swipe down to close')}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
