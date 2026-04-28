/**
 * LegendSearchModal — galeria de busca dos lendas cadastradas.
 *
 * Surface importante do "museu vivo": o usuário pode filtrar por nome,
 * epíteto ou era. Cada item mostra foto B&W + OVR Moret + epíteto.
 * Clicar navega pra /legend/{slug} (com transição via React Router).
 *
 * Usado pelo LegendSearchBar no topo da página /legend.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X } from 'lucide-react';
import { LEGENDS_BY_SLUG, type LegendData } from '@/data/legends';

interface LegendSearchModalProps {
  open: boolean;
  onClose: () => void;
  /** Slug atual (para destacar como "viewing now"). */
  currentSlug?: string;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function LegendSearchModal({ open, onClose, currentSlug }: LegendSearchModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus no input ao abrir
  useEffect(() => {
    if (open) {
      setQuery('');
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  // ESC fecha
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Bloqueia scroll do body
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const allLegends = useMemo(() => Object.values(LEGENDS_BY_SLUG), []);

  const filtered = useMemo<LegendData[]>(() => {
    const q = normalize(query.trim());
    if (!q) return allLegends;
    return allLegends.filter((l) => {
      const haystack = normalize(`${l.name} ${l.fullName} ${l.epithet} ${l.era} ${l.nationality}`);
      return haystack.includes(q);
    });
  }, [allLegends, query]);

  const handleNavigate = (slug: string) => {
    onClose();
    if (slug !== currentSlug) navigate(`/legend/${slug}`);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[200] flex items-start justify-center bg-deep-black/95 backdrop-blur"
          onClick={onClose}
          role="dialog"
          aria-label="Buscar lendas"
          aria-modal="true"
        >
          <motion.div
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl mx-4 mt-[8vh] sm:mt-[12vh] flex flex-col max-h-[80vh]"
          >
            {/* Header — input + close */}
            <div
              className="flex items-stretch gap-2 border border-l-[3px] border-[var(--color-border)] border-l-neon-yellow bg-dark-gray p-2 sm:p-2.5"
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              <div className="flex items-center gap-3 flex-1 px-3">
                <Search className="w-4 h-4 text-neon-yellow shrink-0" strokeWidth={2.5} />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar lenda… (nome, epíteto, era)"
                  className="flex-1 bg-transparent outline-none text-white placeholder:text-white/40"
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '15px',
                  }}
                  autoComplete="off"
                  spellCheck={false}
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="text-white/45 hover:text-white text-[11px] uppercase font-display font-bold"
                    style={{ letterSpacing: '0.16em' }}
                    aria-label="Limpar busca"
                  >
                    Limpar
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center w-10 text-white/55 hover:text-neon-yellow hover:bg-white/5 transition-colors"
                style={{ borderRadius: 'var(--radius-sm)' }}
                aria-label="Fechar busca"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Eyebrow editorial */}
            <div className="flex items-center justify-between gap-2 px-1 mt-4 mb-2">
              <span
                className="font-display font-black uppercase text-neon-yellow"
                style={{ fontSize: '10px', letterSpacing: '0.32em' }}
              >
                Olefoot · Hall of Fame
              </span>
              <span
                className="text-white/45 tabular-nums font-display"
                style={{ fontSize: '10px', letterSpacing: '0.18em' }}
              >
                {filtered.length} {filtered.length === 1 ? 'lenda' : 'lendas'}
              </span>
            </div>

            {/* Lista de lendas */}
            <div
              className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-2"
              style={{ scrollbarGutter: 'stable' }}
            >
              {filtered.length === 0 ? (
                <div
                  className="border border-dashed border-white/15 bg-deep-black/40 px-5 py-10 text-center"
                  style={{ borderRadius: 'var(--radius-md)' }}
                >
                  <p
                    className="italic text-white/55"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontSize: '15px',
                    }}
                  >
                    Nenhuma lenda encontrada para "{query}".
                  </p>
                </div>
              ) : (
                filtered.map((l) => {
                  const isCurrent = l.slug === currentSlug;
                  return (
                    <button
                      key={l.slug}
                      type="button"
                      onClick={() => handleNavigate(l.slug)}
                      aria-current={isCurrent ? 'page' : undefined}
                      className={`group w-full flex items-stretch gap-0 overflow-hidden border border-l-[3px] border-[var(--color-border)] bg-dark-gray text-left transition-all hover:border-neon-yellow/45 hover:-translate-y-0.5 ${
                        isCurrent ? 'border-l-neon-yellow ring-1 ring-neon-yellow/30' : 'border-l-white/15'
                      }`}
                      style={{ borderRadius: 'var(--radius-md)' }}
                    >
                      {/* Foto / fallback */}
                      <div className="relative w-[80px] sm:w-[96px] aspect-[4/5] shrink-0 overflow-hidden bg-black">
                        {l.photoUrl ? (
                          <img
                            src={l.photoUrl}
                            alt=""
                            aria-hidden
                            className="absolute inset-0 w-full h-full object-cover object-top grayscale transition-all duration-300 group-hover:grayscale-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-neon-yellow/10 to-transparent">
                            <span
                              className="italic text-neon-yellow/70 leading-none"
                              style={{
                                fontFamily: 'var(--font-serif-hero)',
                                fontWeight: 700,
                                fontSize: '40px',
                              }}
                              aria-hidden
                            >
                              {l.name.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/45 via-black/10 to-black/55"
                        />
                        {/* OVR */}
                        <div className="absolute top-1.5 left-1.5 z-10">
                          <p
                            className="italic text-neon-yellow tabular-nums leading-none drop-shadow-[0_3px_8px_rgba(0,0,0,0.95)]"
                            style={{
                              fontFamily: 'var(--font-serif-hero)',
                              fontWeight: 700,
                              fontSize: 'clamp(20px, 3vw, 26px)',
                              letterSpacing: '-0.04em',
                            }}
                          >
                            {l.ovr}
                          </p>
                        </div>
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center px-3 py-3 sm:px-4">
                        <span
                          className="font-display font-bold uppercase text-white/55"
                          style={{ fontSize: '9px', letterSpacing: '0.28em' }}
                        >
                          {l.epithet}
                        </span>
                        <p
                          className="italic text-white mt-0.5 leading-tight"
                          style={{
                            fontFamily: 'var(--font-serif-hero)',
                            fontWeight: 700,
                            fontSize: 'clamp(20px, 3vw, 26px)',
                            letterSpacing: '-0.02em',
                          }}
                        >
                          {l.name.charAt(0) + l.name.slice(1).toLowerCase()}
                        </p>
                        <span
                          className="font-display font-bold uppercase text-white/40 mt-1.5"
                          style={{ fontSize: '10px', letterSpacing: '0.22em' }}
                        >
                          {l.era} · {l.nationality}
                        </span>
                      </div>
                      {/* Indicador current/seta */}
                      <div className="flex items-center pr-3 sm:pr-4">
                        <span
                          className={`font-display font-black uppercase ${
                            isCurrent ? 'text-neon-yellow' : 'text-white/35 group-hover:text-neon-yellow'
                          }`}
                          style={{ fontSize: '10px', letterSpacing: '0.22em' }}
                        >
                          {isCurrent ? 'Aqui' : 'Ver →'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer hint */}
            <p
              className="text-center text-white/35 mt-3 font-display font-bold uppercase"
              style={{ fontSize: '9px', letterSpacing: '0.28em' }}
            >
              ESC pra fechar · O museu vivo do futebol
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
