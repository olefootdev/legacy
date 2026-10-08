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
import { L } from '@/i18n/L';
import { SecaoRua } from '@/components/ui';

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
    <div id="buscar-manager" className="flex scroll-mt-24 flex-col gap-3">
      <SecaoRua label={L('Encontrar manager', 'Find manager')} />

      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mudo" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setTouched(true); }}
          placeholder={L('Nome do clube, usuário ou e-mail', 'Club name, username or email')}
          aria-label={L('Buscar manager', 'Search manager')}
          className="min-h-[50px] w-full border-2 border-linha bg-concreto py-3 pl-10 pr-10 text-[15px] text-papel outline-none placeholder:text-fio focus:border-rua"
        />
        {searching && (
          <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-mudo" />
        )}
      </div>

      {error && <p role="alert" className="border-l-[5px] border-baixa bg-concreto px-3 py-2 text-[12.5px] text-papel">{error}</p>}

      {showEmpty && (
        <p className="border-2 border-dashed border-fio px-4 py-3.5 font-voz text-[20px] leading-[1.1] text-papel">
          {L('Nenhum manager encontrado. Pelo e-mail, precisa ser exato.', 'No manager found. Email must be exact.')}
        </p>
      )}

      {results.length > 0 && (
        <ul className="flex flex-col">
          {results.map((m) => {
            const already = linkedIds.has(m.id);
            const done = invited.has(m.id);
            return (
              <li
                key={m.id}
                className="flex min-w-0 items-center justify-between gap-3 border-b border-linha py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-voz text-[22px] leading-none text-papel">
                    {m.clubName ?? m.displayName ?? 'Manager'}
                  </p>
                  {m.username && <p className="mt-1 truncate font-prova text-[11.5px] text-mudo">@{m.username}</p>}
                </div>
                <button
                  type="button"
                  disabled={already || done || inviting === m.id}
                  onClick={() => void handleInvite(m.id)}
                  className={cn(
                    'flex min-h-[42px] shrink-0 items-center gap-1.5 px-3.5 font-impact text-[15px] uppercase leading-none transition-colors',
                    already || done
                      ? 'cursor-default border-2 border-dashed border-linha text-mudo'
                      : 'bg-rua text-asfalto-27 hover:bg-papel disabled:opacity-50',
                  )}
                >
                  {already ? (
                    L('Na rede', 'Connected')
                  ) : done ? (
                    <><Check className="h-4 w-4" aria-hidden /> {L('Enviado', 'Sent')}</>
                  ) : inviting === m.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <><UserPlus className="h-4 w-4" aria-hidden /> {L('Convidar', 'Invite')}</>
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
