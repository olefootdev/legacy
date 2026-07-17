/**
 * Busca de manager + convite de amizade.
 *
 * Até 2026-07-17 NÃO existia jeito nenhum de convidar alguém: o catálogo de
 * clubes era NPC inventado e só o reducer o lia — na prática o manager só podia
 * receber o pedido fake do "WOLVES" que nascia no estado inicial.
 *
 * Busca por nome do clube, username ou e-mail EXATO (RPC `search_managers`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, UserPlus, Loader2, Check } from 'lucide-react';
import { searchManagers, type ManagerSearchResult } from '@/supabase/friendships';
import { cn } from '@/lib/utils';

const MIN_CHARS = 3;

export function FriendSearchBlock({
  onInvite,
  /** uuids que já são amigo ou têm convite pendente — não oferecemos convite de novo. */
  linkedIds,
  error,
}: {
  onInvite: (managerId: string) => Promise<boolean>;
  linkedIds: Set<string>;
  error: string | null;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ManagerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState(false);
  const seq = useRef(0);

  const run = useCallback(async (term: string) => {
    const mine = ++seq.current;
    if (term.trim().length < MIN_CHARS) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const found = await searchManagers(term);
    // Descarta resposta de busca antiga que chegou atrasada.
    if (mine !== seq.current) return;
    setResults(found);
    setSearching(false);
  }, []);

  // Debounce: não dispara RPC a cada tecla.
  useEffect(() => {
    const t = setTimeout(() => void run(q), 350);
    return () => clearTimeout(t);
  }, [q, run]);

  const handleInvite = async (id: string) => {
    setInviting(id);
    const ok = await onInvite(id);
    if (ok) setInvited((prev) => new Set(prev).add(id));
    setInviting(null);
  };

  const showEmpty = touched && q.trim().length >= MIN_CHARS && !searching && results.length === 0;

  return (
    <div className="space-y-3">
      <div className="ole-eyebrow !text-cyan-400">
        <span>Encontrar manager</span>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setTouched(true); }}
          placeholder="Nome do clube, usuário ou e-mail"
          className="w-full rounded-[var(--radius-sm)] border border-white/12 bg-black/40 py-3 pl-10 pr-10 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-500/50"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/40" />
        )}
      </div>

      {error && <p className="text-[11px] text-red-400">{error}</p>}

      {showEmpty && (
        <p className="rounded-[var(--radius-sm)] border border-dashed border-white/10 bg-black/20 px-3 py-3 text-xs text-gray-500">
          Nenhum manager encontrado. Pelo e-mail, precisa ser exato.
        </p>
      )}

      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((m) => {
            const already = linkedIds.has(m.id);
            const done = invited.has(m.id);
            return (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-white/10 bg-[#1c1c1c] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-bold uppercase tracking-wide text-white">
                    {m.clubName ?? m.displayName ?? 'Manager'}
                  </p>
                  {m.username && <p className="truncate text-[10px] text-gray-500">@{m.username}</p>}
                </div>
                <button
                  type="button"
                  disabled={already || done || inviting === m.id}
                  onClick={() => void handleInvite(m.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-sm px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-wider transition-colors',
                    already || done
                      ? 'cursor-default border border-white/10 text-white/35'
                      : 'bg-cyan-500 text-black hover:bg-white disabled:opacity-50',
                  )}
                >
                  {already ? (
                    'Na rede'
                  ) : done ? (
                    <><Check className="h-3 w-3" /> Enviado</>
                  ) : inviting === m.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <><UserPlus className="h-3 w-3" /> Convidar</>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
