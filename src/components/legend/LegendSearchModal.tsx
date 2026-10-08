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
import { Hashtag } from '@/components/ui';
import { L } from '@/i18n/L';

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
          className="fixed inset-0 z-[200] flex items-start justify-center rua-grao bg-black/95"
          onClick={onClose}
          role="dialog"
          aria-label={L('Buscar lendas', 'Search legends')}
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
              className="flex items-stretch gap-2 border-l-[5px] border-ouro-27 bg-concreto p-2 sm:p-2.5"
            >
              <div className="flex items-center gap-3 flex-1 px-3">
                <Search className="w-4 h-4 text-ouro-27 shrink-0" strokeWidth={2.5} />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={L('Buscar lenda… (nome, epíteto, era)', 'Search legend… (name, epithet, era)')}
                  className="min-w-0 flex-1 bg-transparent font-impact text-[20px] uppercase outline-none text-papel placeholder:text-fio"
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
                    className="text-cimento hover:text-white text-[11px] uppercase font-mono"
                    style={{ letterSpacing: '0.12em' }}
                    aria-label={L('Limpar busca', 'Clear search')}
                  >
                    {L('Limpar', 'Clear')}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center w-10 text-cimento hover:text-ouro-27 transition-colors"
                aria-label={L('Fechar busca', 'Close search')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Eyebrow editorial */}
            <div className="flex items-center justify-between gap-2 px-1 mt-4 mb-2">
              <Hashtag className="font-bold uppercase tracking-[0.16em] text-ouro-27">{L('#halldafama', '#halloffame')}</Hashtag>
              <span className="shrink-0 font-mono text-cimento" style={{ fontSize: '10.5px' }}>
                {filtered.length} {filtered.length === 1 ? L('lenda', 'legend') : L('lendas', 'legends')}
              </span>
            </div>

            {/* Lista de lendas */}
            <div
              className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-2"
              style={{ scrollbarGutter: 'stable' }}
            >
              {filtered.length === 0 ? (
                <div className="border-2 border-dashed border-fio px-5 py-10 text-center">
                  <p className="text-cimento" style={{ fontSize: '15px' }}>
                    {L(`Nenhuma lenda encontrada para "${query}".`, `No legend found for "${query}".`)}
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
                      className={`group w-full flex items-stretch gap-0 overflow-hidden border-[3px] bg-concreto text-left transition-colors hover:border-ouro-27 ${
                        isCurrent ? 'border-ouro-27' : 'border-transparent'
                      }`}
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
                          <div className="absolute inset-0 grid place-items-center bg-card">
                            <span
                              className="font-voz text-ouro-27/60 leading-none"
                              style={{ fontSize: '40px' }}
                              aria-hidden
                            >
                              {l.name.charAt(0)}
                            </span>
                          </div>
                        )}
                        {/* OVR */}
                        <div className="absolute top-1.5 left-1.5 z-10 bg-black px-1 py-0.5">
                          <p
                            className="font-impact text-ouro-27 leading-none"
                            style={{ fontSize: 'clamp(15px, 2.4vw, 19px)' }}
                          >
                            {l.ovr}
                          </p>
                        </div>
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center px-3 py-3 sm:px-4">
                        <span
                          className="truncate font-mono uppercase text-cimento"
                          style={{ fontSize: '9.5px', letterSpacing: '0.14em' }}
                        >
                          {l.epithet}
                        </span>
                        <p
                          className="truncate font-voz text-papel mt-0.5 leading-none"
                          style={{ fontSize: 'clamp(20px, 3vw, 26px)' }}
                        >
                          {l.name.charAt(0) + l.name.slice(1).toLowerCase()}
                        </p>
                        <span
                          className="truncate font-mono uppercase text-poeira mt-1.5"
                          style={{ fontSize: '10px', letterSpacing: '0.12em' }}
                        >
                          {l.era} · {l.nationality}
                        </span>
                      </div>
                      {/* Indicador current/seta */}
                      <div className="flex items-center pr-3 sm:pr-4">
                        <span
                          className={`whitespace-nowrap font-impact uppercase ${
                            isCurrent ? 'text-ouro-27' : 'text-mudo group-hover:text-ouro-27'
                          }`}
                          style={{ fontSize: '16px' }}
                        >
                          {isCurrent ? L('Aqui', 'Here') : L('Ver →', 'View →')}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer hint */}
            <p
              className="text-center text-poeira mt-3 font-mono uppercase"
              style={{ fontSize: '10px', letterSpacing: '0.14em' }}
            >
              {L('ESC pra fechar', 'ESC to close')}
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
