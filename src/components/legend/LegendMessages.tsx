/**
 * LegendMessages — feed de mensagens dos managers para a lenda.
 *
 * Composer + lista. Reaproveitável: passa o slug + nome.
 * O state vive no hook `useLegendSocial(slug)` (localStorage hoje;
 * Supabase quando as tabelas existirem).
 */
import { useMemo, useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import type { LegendMessage } from '@/hooks/useLegendSocial';
import { useGameStore } from '@/game/store';

interface LegendMessagesProps {
  legendName: string;
  messages: LegendMessage[];
  onPost: (input: { managerName: string; managerInitials: string; message: string }) => void;
  onRemove?: (id: string) => void;
}

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  return new Date(ts).toLocaleDateString('pt-BR');
}

export function LegendMessages({ legendName, messages, onPost, onRemove }: LegendMessagesProps) {
  const profile = useGameStore((s) => s.userSettings.managerProfile);
  const club = useGameStore((s) => s.club);

  const managerName = useMemo(() => {
    const first = profile?.firstName?.trim();
    const last = profile?.lastName?.trim();
    return [first, last].filter(Boolean).join(' ').trim() || 'Manager Anônimo';
  }, [profile?.firstName, profile?.lastName]);

  const managerInitials = useMemo(() => {
    const first = profile?.firstName?.trim()?.[0] ?? '';
    const last = profile?.lastName?.trim()?.[0] ?? '';
    const fallback = club?.shortName?.trim()?.slice(0, 3) ?? '';
    return ((first + last) || fallback || 'M').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'M';
  }, [profile?.firstName, profile?.lastName, club?.shortName]);

  const [draft, setDraft] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onPost({ managerName, managerInitials, message: draft });
    setDraft('');
  };

  const remaining = 150 - draft.length;
  const tooLong = remaining < 0;

  return (
    <section
      aria-label={`Mural de mensagens para ${legendName}`}
      className="relative bg-deep-black py-10 sm:py-14"
    >
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <header className="flex items-center gap-3 mb-3">
          <span aria-hidden className="w-1 h-8 bg-neon-yellow" />
          <h2
            className="font-impact uppercase text-neon-yellow leading-[1.1]"
            style={{ fontSize: 'clamp(28px, 4.5vw, 40px)' }}
          >
            Mural dos Managers
          </h2>
        </header>
        <p className="mb-5 truncate font-mono text-[11.5px] text-cimento">
          Recado pra {legendName} · visível pra todos os managers
        </p>

        {/* Composer */}
        <form
          onSubmit={handleSubmit}
          className="border border-l-[3px] border-white/10 border-l-neon-yellow bg-panel p-4 sm:p-5 mb-6"
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="ole-num grid place-items-center h-9 w-9 bg-neon-yellow text-black uppercase shrink-0"
              style={{ fontSize: '12px' }}
              aria-hidden
            >
              {managerInitials}
            </div>
            <div className="min-w-0">
              <p className="text-white uppercase truncate font-mono" style={{ fontSize: '11px', letterSpacing: '0.14em' }}>
                {managerName}
              </p>
              <p className="text-cimento mt-0.5 font-mono" style={{ fontSize: '10px' }}>
                Postando como você
              </p>
            </div>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 180))}
            rows={3}
            placeholder={`Manda um recado pra ${legendName.split(' ')[0]}...`}
            className="w-full resize-none border border-white/16 bg-deep-black px-3 py-2.5 text-sm text-white placeholder:text-poeira focus:border-neon-yellow/60 focus:outline-none"
          />
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <span
              className={`ole-num ${tooLong ? 'text-baixa' : 'text-cimento'}`}
              style={{ fontSize: '10.5px' }}
            >
              {remaining}/150
            </span>
            <button
              type="submit"
              disabled={!draft.trim() || tooLong}
              className="ole-num inline-flex h-11 items-center gap-2 bg-neon-yellow text-black uppercase px-5 transition-colors hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed [--corte:10px] [clip-path:var(--clip-corte)]"
              style={{ fontSize: '12px' }}
            >
              <Send className="w-3.5 h-3.5" strokeWidth={2.5} />
              Publicar
            </button>
          </div>
        </form>

        {/* Lista */}
        {messages.length === 0 ? (
          <div className="border border-dashed border-white/16 px-5 py-8 text-center">
            <p className="text-cimento" style={{ fontSize: '15px' }}>
              Seja o primeiro a deixar uma mensagem.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((msg) => (
              <li
                key={msg.id}
                className="border border-l-[3px] border-white/10 border-l-white/16 bg-panel p-4 transition-colors hover:border-l-neon-yellow"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="ole-num grid place-items-center h-8 w-8 bg-deep-black border border-neon-yellow/50 text-neon-yellow uppercase shrink-0"
                    style={{ fontSize: '11px' }}
                    aria-hidden
                  >
                    {msg.managerInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white uppercase truncate font-mono" style={{ fontSize: '11px', letterSpacing: '0.14em' }}>
                      {msg.managerName}
                    </p>
                    <p className="text-cimento mt-0.5 font-mono" style={{ fontSize: '10px' }}>
                      {timeAgo(msg.createdAt)}
                    </p>
                  </div>
                  {onRemove ? (
                    <button
                      type="button"
                      onClick={() => onRemove(msg.id)}
                      className="text-poeira hover:text-baixa transition-colors text-[14px] font-mono"
                      aria-label="Remover mensagem"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <p
                  className="text-giz leading-relaxed whitespace-pre-line"
                  style={{ fontSize: '13px' }}
                >
                  {msg.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
